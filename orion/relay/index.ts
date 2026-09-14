// ORION CLIENT — signalling relay proxy (Supabase Edge Function)
//
// A shared world needs two separate things, and they fail separately:
//
//   1. SIGNALLING. Both browsers open a WebSocket to a relay and swap the
//      details needed to reach each other. Without it nothing happens at all —
//      no world ever appears in anyone's list.
//   2. THE CONNECTION ITSELF. Once introduced, the two browsers talk directly,
//      and a TURN server carries that traffic when they cannot.
//
// TURN fixes (2) and can do nothing about (1). On a network that blocks the
// community relays — school networks especially — the game never gets past step
// one. This is the fix for step one: it speaks WebSocket to the browser and
// forwards every byte, unread and unchanged, to a real relay, from the same
// host Orion already uses for accounts.
//
// It is a dumb pipe: it does not parse, cache or store anything, and it only
// forwards to the relays in upstreams.ts, so it cannot be turned into an open
// proxy to somewhere else.
//
// THE UPSTREAM IS CONNECTED BEFORE THE BROWSER IS ACCEPTED, and that is the
// whole lesson of the first version. That one upgraded the browser's socket
// immediately and connected onward afterwards: when the onward connection
// failed, the game was left holding a socket that had opened and would never
// say anything, which looks exactly like a relay that answered and then did
// nothing. Anything that tested it — including Orion's own launcher — called
// that a working relay, because from the near end it is indistinguishable from
// one. Now a failure upstream is a failed connection, which is the truth, and
// ?probe=1 answers the same question over plain HTTPS without opening a socket
// at all.
//
// LIMIT, and it is a real one: an Edge Function worker lives 150s on the free
// plan (400s on paid), after which the socket closes. Joining a world is a few
// seconds of signalling, so joining is unaffected. HOSTING holds the socket
// open for as long as the world is shared, so a world hosted through here stops
// being listed after a couple of minutes — players already in it stay in,
// because that traffic is peer-to-peer and never touches this. To host all
// evening, run the same proxy somewhere without that cap: cloudflare-worker.js
// next to this file is the same pipe for Cloudflare Workers.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ALLOWED, DEFAULT_UPSTREAM, resolveUpstream } from "./upstreams.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const OPEN_TIMEOUT_MS = 8000;

/* Opens a socket to the relay and settles as soon as it is either usable or
 * hopeless. Frames that arrive before the browser is ready are kept: the relay
 * can speak first, and dropping its opening line would be a bug that only
 * showed up under load. */
function connectUpstream(url: string) {
  const socket = new WebSocket(url);
  socket.binaryType = "arraybuffer";
  const early: (string | ArrayBuffer)[] = [];
  socket.onmessage = (e) => early.push(e.data);

  const ready = new Promise<{ ok: true } | { ok: false; why: string }>((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, why: "it did not answer in time" }), OPEN_TIMEOUT_MS);
    socket.onopen = () => { clearTimeout(timer); resolve({ ok: true }); };
    socket.onerror = () => { clearTimeout(timer); resolve({ ok: false, why: "the connection was refused" }); };
    socket.onclose = (e) => {
      clearTimeout(timer);
      resolve({ ok: false, why: "it closed the connection (" + e.code + ")" });
    };
  });

  return { socket, early, ready };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const picked = resolveUpstream(url.searchParams.get("to"));
  const upgrade = (req.headers.get("upgrade") || "").toLowerCase();

  /* A health check that actually checks something: it opens a socket to the
   * relay, waits for it, and closes it again. This is what the launcher asks,
   * so "the relay works" means the whole path works rather than the near end
   * of it. */
  if (upgrade !== "websocket" && url.searchParams.has("probe")) {
    if (!picked.ok) return json(403, { ok: false, error: picked.error });
    const started = Date.now();
    const { socket, ready } = connectUpstream(picked.url);
    const res = await ready;
    try { socket.close(); } catch { /* already gone */ }
    const ms = Date.now() - started;
    console.log(`probe ${picked.host} ${res.ok ? "ok" : "failed"} ${ms}ms${res.ok ? "" : " — " + res.why}`);
    return res.ok
      ? json(200, { ok: true, upstream: picked.host, ms })
      : json(502, { ok: false, upstream: picked.host, ms, error: `${picked.host} could not be reached: ${res.why}` });
  }

  if (upgrade !== "websocket") {
    return json(200, {
      ok: true,
      service: "orion-relay",
      forwardsTo: ALLOWED,
      defaultUpstream: DEFAULT_UPSTREAM,
      note: "connect with a WebSocket, optionally ?to=<relay hostname>; add ?probe=1 for a health check",
    });
  }

  if (!picked.ok) return json(403, { ok: false, error: picked.error });

  /* Upstream first. A browser that gets a 101 here has a relay on the other
   * end of it. */
  const { socket: upstream, early, ready } = connectUpstream(picked.url);
  const up = await ready;
  if (!up.ok) {
    try { upstream.close(); } catch { /* already gone */ }
    console.log(`refused: ${picked.host} — ${up.why}`);
    return json(502, { ok: false, error: `${picked.host} could not be reached: ${up.why}` });
  }

  const { socket: client, response } = Deno.upgradeWebSocket(req);
  client.binaryType = "arraybuffer";

  /* The browser sends its handshake the instant its socket opens, which can be
   * before this side has finished wiring up. Holding those frames rather than
   * dropping them is the difference between this working and not. */
  const pending: (string | ArrayBuffer)[] = [];
  let closed = false;
  let resolveClosed: () => void = () => {};
  const untilClosed = new Promise<void>((resolve) => { resolveClosed = resolve; });

  const closeBoth = (code: number, reason: string) => {
    if (closed) return;
    closed = true;
    /* 1005 and 1006 are "no status" codes that close() may not send, and they
     * are exactly what an abrupt disconnect reports. */
    const safe = code >= 1000 && code !== 1005 && code !== 1006 && code < 5000 ? code : 1000;
    try { client.close(safe, reason.slice(0, 120)); } catch { /* already gone */ }
    try { upstream.close(safe, reason.slice(0, 120)); } catch { /* already gone */ }
    resolveClosed();
  };

  const flushToClient = () => {
    while (early.length && client.readyState === WebSocket.OPEN) client.send(early.shift()!);
  };

  client.onopen = flushToClient;
  client.onmessage = (e) => {
    if (upstream.readyState === WebSocket.OPEN) upstream.send(e.data);
    else pending.push(e.data);
  };
  client.onclose = (e) => closeBoth(e.code, e.reason || "the player disconnected");
  client.onerror = () => closeBoth(1011, "the browser connection failed");

  upstream.onmessage = (e) => {
    if (client.readyState === WebSocket.OPEN) client.send(e.data);
    else early.push(e.data);
  };
  upstream.onclose = (e) => {
    console.log(`upstream ${picked.host} closed (${e.code}${e.reason ? " " + e.reason : ""})`);
    closeBoth(e.code, e.reason || picked.host + " closed the connection");
  };
  upstream.onerror = () => {
    console.log(`upstream ${picked.host} errored`);
    closeBoth(1011, "the connection to " + picked.host + " failed");
  };
  while (pending.length) upstream.send(pending.shift()!);
  flushToClient();

  console.log(`open: ${picked.host}`);

  /* Without this the worker counts as idle the moment the upgrade response is
   * returned, and can be retired with the socket still open. */
  EdgeRuntime.waitUntil(untilClosed);

  return response;
});
