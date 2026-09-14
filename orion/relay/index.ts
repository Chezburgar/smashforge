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
// one, and no amount of TURN rescues it. This is the fix for step one: it speaks
// WebSocket to the browser and forwards every byte, unread and unchanged, to a
// real relay. It lives on the same host Orion already uses for accounts, so a
// network that lets you sign in to Orion lets this through too.
//
// It is a dumb pipe: it does not parse, cache or store anything, and it only
// forwards to the relays in upstreams.ts, so it cannot be turned into an open
// proxy to somewhere else.
//
// LIMIT, and it is a real one: an Edge Function worker lives 150s on the free
// plan (400s on paid), after which the socket closes. Joining a world is a few
// seconds of signalling, so joining is unaffected. HOSTING holds the socket open
// for as long as the world is shared, so a world hosted through here stops being
// listed after a couple of minutes — players already in it stay in, because that
// traffic is peer-to-peer and never touches this. To host all evening, run the
// same proxy somewhere without that cap: cloudflare-worker.js next to this file
// is the same pipe for Cloudflare Workers, which are free and have no duration
// cap.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ALLOWED, DEFAULT_UPSTREAM, resolveUpstream } from "./upstreams.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve((req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const upgrade = (req.headers.get("upgrade") || "").toLowerCase();
  if (upgrade !== "websocket") {
    /* How the launcher checks this is alive without opening a socket. */
    return new Response(
      JSON.stringify({
        ok: true,
        service: "orion-relay",
        forwardsTo: ALLOWED,
        defaultUpstream: DEFAULT_UPSTREAM,
        note: "connect with a WebSocket, optionally ?to=<relay hostname>",
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const picked = resolveUpstream(url.searchParams.get("to"));
  if (!picked.ok) {
    return new Response(JSON.stringify({ ok: false, error: picked.error }), {
      status: 403,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { socket: client, response } = Deno.upgradeWebSocket(req);
  client.binaryType = "arraybuffer";

  const upstream = new WebSocket(picked.url);
  upstream.binaryType = "arraybuffer";

  /* The client sends its handshake the instant its socket opens, which is
   * before the upstream one is ready. Holding those frames rather than dropping
   * them is the difference between this working and not. */
  const pending: (string | ArrayBuffer)[] = [];
  let closed = false;
  let resolveClosed: () => void = () => {};
  const untilClosed = new Promise<void>((resolve) => { resolveClosed = resolve; });

  const closeBoth = (code: number, reason: string) => {
    if (closed) return;
    closed = true;
    /* 1005 and 1006 are "no status" codes that close() is not allowed to send
     * on, and they are exactly what an abrupt disconnect reports. */
    const safe = code >= 1000 && code !== 1005 && code !== 1006 && code < 5000 ? code : 1000;
    try { client.close(safe, reason.slice(0, 120)); } catch { /* already gone */ }
    try { upstream.close(safe, reason.slice(0, 120)); } catch { /* already gone */ }
    resolveClosed();
  };

  client.onmessage = (e) => {
    if (upstream.readyState === WebSocket.OPEN) upstream.send(e.data);
    else if (upstream.readyState === WebSocket.CONNECTING) pending.push(e.data);
  };
  client.onclose = (e) => closeBoth(e.code, e.reason || "the player disconnected");
  client.onerror = () => closeBoth(1011, "the browser connection failed");

  upstream.onopen = () => {
    while (pending.length) upstream.send(pending.shift()!);
  };
  upstream.onmessage = (e) => {
    if (client.readyState === WebSocket.OPEN) client.send(e.data);
  };
  upstream.onclose = (e) => closeBoth(e.code, e.reason || picked.host + " closed the connection");
  upstream.onerror = () => closeBoth(1011, "could not reach " + picked.host);

  /* Without this the worker counts as idle the moment the upgrade response is
   * returned, and can be retired with the socket still open. */
  EdgeRuntime.waitUntil(untilClosed);

  return response;
});
