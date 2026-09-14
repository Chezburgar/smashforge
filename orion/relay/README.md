# The Orion relay

A shared world needs **two different things**, and they fail separately. Nearly
every "online does not work" turns out to be one specific half being blocked:

| Step | What it needs | What it looks like when it is blocked |
| --- | --- | --- |
| **1. Being introduced** | A WebSocket to a **relay**, so the two browsers can swap the details they need to reach each other. | Nothing happens at all. No world ever appears in anyone's Multiplayer list. |
| **2. The connection itself** | A direct browser-to-browser link, or a **TURN** server to carry it when a direct one is impossible. | The world appears, but joining hangs or drops straight away. |

**TURN only fixes step 2.** It cannot do anything about step 1: if the network
will not let the browser open a WebSocket to `relay.deev.is`, the game never
gets as far as needing a TURN server. That is worth saying plainly, because
"add a TURN server" is the usual advice and it is the wrong fix for the
commonest failure.

This directory is the fix for step 1.

## What it is

A proxy that speaks WebSocket to the browser and forwards every byte, unread
and unchanged, to a real relay. It is a dumb pipe:

- it does not parse, cache or store the relay protocol — it does not know what
  the bytes mean;
- it only forwards to the relays listed in `upstreams.ts`, so it cannot be used
  as an open proxy to anything else;
- each address pins the relay it forwards to (`?to=relay.deev.is`), because a
  shared world is registered with **one** relay. The people joining scan every
  relay in their own list, so the host's has to be somewhere in that list — which
  it is, as long as both sides are running Orion with its built-in relays.

The point is the address it lives at. Orion's copy runs on the same Supabase
project Orion already uses for accounts, so a network that lets you sign in to
Orion lets the relay through too — even when it blocks `relay.deev.is` by name.

## Files

| File | What it is |
| --- | --- |
| `index.ts` | The Supabase Edge Function. Deployed as `orion-relay`. |
| `upstreams.ts` | The relays it is allowed to forward to, and the rule for picking one. Shared by the function so the list cannot drift. |
| `cloudflare-worker.js` | The same pipe as a single file for Cloudflare Workers, for when you want to run your own. |

Orion points at its own copy through `relay.url` in `orion/js/config.js`. Blank
that out and Orion goes back to the public relays alone.

## The limit, and it is a real one

A Supabase Edge Function worker is capped at **150 seconds** on the free plan
(400 on paid). When that runs out the socket closes.

- **Joining** a world is a few seconds of signalling, so joining is unaffected.
- **Hosting** holds the connection open for as long as the world is shared, so
  a world hosted through an Orion relay **stops being listed after a couple of
  minutes**. People already in it stay in — that traffic goes browser to
  browser and never touches the relay — but nobody new can find it.

So: open the world, let your friends in, keep playing. If you want to host all
evening, run the same proxy somewhere without that cap.

## Running your own (about three minutes, free, no card)

A Cloudflare Worker has no duration cap:

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) and open
   **Workers & Pages**.
2. **Create** a Worker, click **Edit code**, paste `cloudflare-worker.js` over
   what is there, and **Deploy**.
3. Copy the worker's address — `https://<name>.<you>.workers.dev` — change
   `https://` to `wss://`, add `?to=relay.deev.is`, and add it in Orion under
   **Shared worlds → Relays**. Make it primary.

Everyone you play with adds the same address. A joiner only finds a world if
the relay it was registered with is in their own list, so a worker only you have
added is a worker only you can host through.

Anywhere that can hold a WebSocket open works the same way: Deno Deploy, a
Fly.io machine, a Raspberry Pi at home behind a tunnel. The worker file is
sixty lines and has no dependencies.

## Checking it

The launcher's **Shared worlds** tab has a **Test online play** button. It tests
the two steps in the order they happen and names the one that is broken, rather
than leaving you to guess from an empty Multiplayer screen. A plain `GET` to the
proxy (no WebSocket upgrade) returns a small JSON status, which is what makes
that check possible without opening a socket.
