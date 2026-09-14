/* ORION CLIENT — the same signalling relay proxy, for Cloudflare Workers.
 *
 * Orion ships a relay proxy on its own Supabase project and that is enough for
 * joining. It is not enough for hosting all evening: a Supabase Edge Function
 * worker is capped at 150 seconds on the free plan, so a world hosted through it
 * stops being listed after a couple of minutes. A Cloudflare Worker has no such
 * cap, costs nothing, and takes about three minutes to put up:
 *
 *   1. Sign in at dash.cloudflare.com (free, no card) and open Workers & Pages.
 *   2. Create a Worker, click Edit code, paste this file over what is there,
 *      and Deploy.
 *   3. Copy the worker's address — https://<name>.<you>.workers.dev — change
 *      https:// to wss://, and add it in Orion under Shared worlds → Relays.
 *      Make it primary. Everyone you play with adds the same one.
 *
 * It is a dumb pipe: it reads nothing, stores nothing, and only forwards to the
 * relays listed below, so it cannot be used as an open proxy to anywhere else.
 * Keep this list the same as orion/relay/upstreams.ts.
 */
const ALLOWED = [
  'relay.deev.is',
  'relay.lax1dude.net',
  'relay.shhnowisnottheti.me'
];

/* A shared world is registered with a single relay, and joiners only find it
 * by scanning the relays in their own list — so which relay a connection lands
 * on has to be predictable rather than whichever answered first. */
const DEFAULT_UPSTREAM = 'relay.deev.is';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

function resolveUpstream(raw) {
  let host = String(raw == null ? '' : raw).trim();
  if (!host) host = DEFAULT_UPSTREAM;
  if (/^wss?:\/\//i.test(host)) {
    try {
      host = new URL(host).hostname;
    } catch (e) {
      return { ok: false, error: 'that is not a valid relay address' };
    }
  }
  host = host.replace(/\/+$/, '').toLowerCase();
  if (ALLOWED.indexOf(host) < 0) {
    return { ok: false, error: host + ' is not one of the relays this proxy forwards to' };
  }
  return { ok: true, host: host, url: 'wss://' + host + '/' };
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const picked = resolveUpstream(url.searchParams.get('to'));
    const wantsSocket = (request.headers.get('Upgrade') || '').toLowerCase() === 'websocket';

    /* The health check the launcher asks: does the relay behind this proxy
     * answer? Opening a socket to the proxy only ever proves the proxy is
     * there, which is not the same question and was the bug in the first
     * version of the Supabase one. */
    if (!wantsSocket && url.searchParams.has('probe')) {
      if (!picked.ok) {
        return new Response(JSON.stringify({ ok: false, error: picked.error }), {
          status: 403, headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }
      try {
        const res = await fetch(picked.url, { headers: { Upgrade: 'websocket' } });
        if (!res.webSocket) throw new Error('no socket');
        res.webSocket.accept();
        res.webSocket.close(1000, 'probe');
        return new Response(JSON.stringify({ ok: true, upstream: picked.host }), {
          status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({
          ok: false, upstream: picked.host,
          error: picked.host + ' could not be reached: the connection was refused'
        }), { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
    }

    if (!wantsSocket) {
      return new Response(JSON.stringify({
        ok: true,
        service: 'orion-relay',
        forwardsTo: ALLOWED,
        defaultUpstream: DEFAULT_UPSTREAM,
        note: 'connect with a WebSocket, optionally ?to=<relay hostname>; ?probe=1 is a health check'
      }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    if (!picked.ok) {
      return new Response(JSON.stringify({ ok: false, error: picked.error }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    /* Upstream first, and a failure here is a refused connection rather than a
     * socket that opens and then says nothing for ever. A browser that gets a
     * 101 out of this has a relay on the far side of it. */
    let upstream;
    try {
      const res = await fetch(picked.url, { headers: { Upgrade: 'websocket' } });
      upstream = res.webSocket;
      if (!upstream) return new Response('the relay refused the connection', { status: 502 });
    } catch (e) {
      return new Response('could not reach ' + picked.host, { status: 502 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    upstream.accept();

    let closed = false;
    const closeBoth = (code, reason) => {
      if (closed) return;
      closed = true;
      /* 1005 and 1006 are "no status" codes close() may not send. */
      const safe = code >= 1000 && code !== 1005 && code !== 1006 && code < 5000 ? code : 1000;
      try { server.close(safe, String(reason || '').slice(0, 120)); } catch (e) { /* gone */ }
      try { upstream.close(safe, String(reason || '').slice(0, 120)); } catch (e) { /* gone */ }
    };

    server.addEventListener('message', (e) => { try { upstream.send(e.data); } catch (err) { closeBoth(1011, 'relay send failed'); } });
    upstream.addEventListener('message', (e) => { try { server.send(e.data); } catch (err) { closeBoth(1011, 'browser send failed'); } });
    server.addEventListener('close', (e) => closeBoth(e.code, e.reason || 'the player disconnected'));
    upstream.addEventListener('close', (e) => closeBoth(e.code, e.reason || picked.host + ' closed the connection'));
    server.addEventListener('error', () => closeBoth(1011, 'the browser connection failed'));
    upstream.addEventListener('error', () => closeBoth(1011, 'could not reach ' + picked.host));

    return new Response(null, { status: 101, webSocket: client });
  }
};
