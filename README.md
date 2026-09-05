# SMASHFORGE

A browser platform fighter with a full character forge. No build step, no dependencies,
no asset files — every character, weapon, cosmetic, stage and sound is generated in code.

**Just open `index.html`.** It runs straight off the filesystem.
(For a local server instead: `node tools/serve.js` → <http://localhost:8123>)

---

## What's in it

| | |
|---|---|
| **585 moves** | 15 weapon archetypes × 13 attack slots × 3 fighting styles, each with its own frame data, knockback profile, hitbox layout, animation and VFX colour |
| **1,300 cosmetics** | 14 equip slots × 130 procedural shapes × 10 colour themes, across 5 rarity tiers |
| **15 weapons** | Katana, Greatsword, Gauntlets, Spear, Warhammer, Cannon, Scythe, Astral Orb, Chakrams, Warbow, Katars, Greataxe, Rocket Lance, Rune Staff, Twin Blasters |
| **4 stages** | Skyfall Terrace, Emberforge, Frostwatch, The Nullstead |
| **4 modes** | Quick Fight, Local Versus, Gauntlet, Training |

## Controls

| Action | Player 1 | Player 2 | Gamepad |
|---|---|---|---|
| Move / aim | `W A S D` | Arrow keys | Stick / D-pad |
| Jump (×3) | `Space` | `Num 0` | A |
| Light attack | `J` | `Num 1` | X |
| Signature — hold to charge | `K` | `Num 2` | Y |
| Weapon special | `I` | `Num 4` | B |
| Dodge / roll / air dodge | `L` | `Num 3` | RB / RT |
| Shield | `Shift` | `Num .` | LB / LT |
| Taunt | `T` | `Num 5` | Start |

`Esc` pauses · `Q` quits from pause · `F1` toggles hitboxes · `R` resets Training.
Gamepads are picked up automatically.

## How fights work

Health drops as you take hits, and **the lower it gets, the further every hit sends you**.
You lose a stock by running out of health *or* by crossing a blast zone — so a fresh
fighter is hard to launch and a hurt one is one clean signature from the void.

- **Light attacks** chain into each other; **signatures** are slow, chargeable and lethal.
- **Dodges** have real invincibility frames but leave you open on the way out.
- **Shields** block anything but drain, and break loudly if you hold them too long.
- Repeating the same move **stales** it (up to −42% damage), so mix the kit.
- Off the edge: hold toward the stage, spend your double jumps, then your **Recovery**
  (signature while airborne). Grabbing a ledge refunds your jumps.
- **DI** steers your launch trajectory; **teching** (dodge on impact) cancels a bounce.

## The Forge

Everything about a fighter is editable, and it all round-trips through `localStorage`.

- **Identity** — weapon archetype and fighting style (Swift / Titan / Arcane), which
  together define the native 13-move kit.
- **Stats** — 26 points across Strength, Dexterity, Defense and Speed (3–10 each).
  The budget is enforced, and the live **Power Rating** scores the whole build
  against the stock starter (50 = neutral).
- **Body** — height, build, skin, 12 hair styles, 16 colourways plus custom colours.
- **Cosmetics** — all 1,300 items, searchable and filterable by theme and rarity,
  each drawn on a live preview of *your* fighter.
- **Moveset** — any of the 585 moves can go in any matching slot, regardless of which
  weapon it came from. Borrowed moves render as a spectral echo of their own weapon
  mid-swing. Full frame data (startup / active / recovery) is shown per move, and the
  preview plays it back with a frame-phase scrubber.

## Orion Client

This repository also hosts **Orion Client** at [`orion/`](orion/) — a separate
browser launcher for **EaglercraftX 1.8** with a built-in server book for
joining and hosting [EaglerXServer](https://github.com/lax1dude/eaglerxserver/releases)
servers. On GitHub Pages it lives at `/orion/`; SMASHFORGE stays at the root.

- **Server book** — add a server once and it stays, saved in the browser. Bare
  `host:port` gets the right scheme filled in, `ws://` on an HTTPS page is
  caught and explained, and **Test** opens a real socket to prove the server
  answers before you try to join.
- **One-click join** — Orion passes the address to the client as `joinServer`,
  so you land on the server instead of the main menu.
- **Share links** — **Share** copies a URL that adds that server to anyone
  else's Orion.
- **Hosting guide** — which jar from the release page, why online mode has to
  go off, which port players actually need, and how to get the `wss://` address
  that browsers require.

- **Play together with no server at all** — the easy path, and the one most
  people want: open a singleplayer world to other players and it registers with
  a relay, so friends see it on their own Multiplayer screen without typing an
  address or forwarding a port. Orion manages the relay list and can test each
  one. See the *Together* tab.
- **A players list** — everyone with Orion open who has chosen to appear, what
  they are hosting, and a request you can send to ask into their world. Hosts
  either publish their join code openly or keep it hidden until they accept.
- **A free-hosting route** — for a world that outlives the host's tab, the
  *Host* tab walks through creating a free server on FalixNodes and putting
  EaglerXServer on it, including the `wss://` requirement that decides whether
  it will work at all.

An **EaglercraftX 1.8-u53** build is installed in
[`orion/client/`](orion/client/README.md), so the client runs as shipped. That
directory's README documents the bundle contract — why settings go through
`eaglercraftXOptsHints` rather than `eaglercraftXOpts`, why there is no
`assets.epk`, and why `signature.txt` has to be handed over before the bundle
loads.

The Orion mark is generated, not stored as a bitmap:
`node tools/make-orion-logo.js > orion/assets/orion-logo.svg`.

Pages publishes this repository from `main` using GitHub's built-in branch
source, so merging to `main` is all that is needed to put Orion online — no
Pages settings to change. `.github/workflows/checks.yml` validates instead of
deploying: it parses every tracked `.js` file and fails if the committed logo
no longer matches its generator.

### The players list needs a backend

Everything else in Orion is static and per-browser. "Who is online" cannot be,
so it lives in Supabase — three functions and a view behind
`orion/js/config.js`. Blank out `config.lobby.url` and the tab disappears while
the rest of Orion carries on.

There are no accounts. Each browser mints a random session id and a secret;
the secret proves the row is yours and only its hash is stored. The tables
themselves are unreachable with the publishable key — `anon` has no grant on
them at all — and every write goes through a `SECURITY DEFINER` function that
checks the secret first. Reads come from a view that omits secrets, drops rows
older than 75 seconds, and withholds a host's join code unless they chose to
publish it. Usernames are stripped to `[A-Za-z0-9 _-.]` before storage, so a
name cannot smuggle markup into anyone's page.

Appearing in the list is opt-in and off on every load: the name you type there
is visible to strangers, which the tab says plainly before you go online.

### TURN for shared worlds

A shared world is a direct WebRTC connection between two browsers, which many
networks do not allow. A TURN server forwards the traffic instead, and it is
the only thing that helps once a direct connection is impossible — the TURN
servers that shipped with Eaglercraft stopped answering in 2024.

The client has no option for ICE servers: it uses whatever list the relay hands
it. So `orion/js/turn.js` wraps `RTCPeerConnection` before the bundle is
injected, and every peer connection the game opens is built with our servers
instead. The bundle is not modified — editing it would break its signature.

The provider's API key is **not** in this repository. It sits in the
`orion-turn` Edge Function in the Supabase project; the page only ever receives
the short-lived credentials that function returns, and the function caches them
in `orion_client_turn_cache` (service-role only) so the provider is called at
most twice an hour however often the endpoint is hit. An in-process cache was
tried first and cached nothing: Edge Functions get a fresh isolate per request.

Set `config.turn.credentialsUrl` to the provider directly if you would rather
skip the proxy, but then the key is readable by every visitor. `mode` chooses
between replacing the relay's ICE list (`replace`) and adding to it (`append`).
If the fetch fails, the game keeps the relay's list — a broken TURN endpoint
leaves shared worlds exactly as they were rather than worse.

## Layout

```
index.html            entry point, script order
css/style.css         UI shell
js/util.js            math, easing, colour, rng, canvas helpers
js/input.js           keyboard + gamepad → per-fighter command structs
js/audio.js           procedural WebAudio SFX + adaptive music bed
js/data/              archetypes · moves (the 585) · cosmetics (the 1300) · stages
js/render/            prims · skeleton+poses · weapons · cosmetics · vfx · fighter · stage
js/game/              build model · fighter sim · combat · AI · match
js/ui/                hud · preview rig · screens · designer
tools/serve.js        optional dev server

orion/index.html      Orion Client launcher (server book, guides)
orion/js/servers.js   server book: validation, storage, reachability probes
orion/js/launch.js    bundle discovery + eaglercraftXOpts handoff
orion/js/app.js       launcher UI
orion/js/relays.js    relay book: the no-server path for playing together
orion/js/lobby.js     players list, play requests (Supabase-backed)
orion/js/turn.js      TURN injection for shared worlds
orion/js/config.js    lobby + TURN endpoints; blank either to disable it
orion/client/         the EaglercraftX 1.8 bundle + its signature
tools/make-orion-logo.js   rasterises the Orion mark to SVG
```

## Notes

- 60 Hz fixed-step simulation with an accumulator; rendering is decoupled.
- Animation is pose-based: ~30 named poses plus a 34-entry swing library, blended with
  easing and layered with procedural secondary motion (hair, capes, weapon trails).
- All colour, geometry and naming derive from seeded RNG, so the catalogue is stable
  across sessions and machines.
