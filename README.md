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
- **An Orion account** — the launcher is behind a sign-in. Make a name and a
  password once and it is remembered on that browser; there is no email to give
  and nothing to confirm.
- **Friends** — add someone by their Orion name, and once they accept you can
  see when they are online, what they are playing and join the server they are
  on in one click, straight from the launcher.
- **A free-hosting route** — for a world that outlives the host's tab, the
  *Host* tab walks through creating a free server on FalixNodes and putting
  EaglerXServer on it, including the `wss://` requirement that decides whether
  it will work at all.

- **Two versions** — **1.8.9** (EaglercraftX 1.8-u53, signed) and **1.12.2**
  (Eaglercraft 1.12.2-u3). Pick one on the Play tab; the choice is remembered.
  1.8 is the default because 1.12.2's own first-run screen calls itself early
  and buggy.

- **A mod store** — resource packs at [`orion/mods/`](orion/mods/), filtered by
  the version they work on. Every pack is opened and checked before it can be
  published, so what is listed is known to load.
- **A skin designer** — [`orion/skin/`](orion/skin/) draws a Minecraft skin on
  a real 64×64 sheet with a live 3D preview, and exports a PNG the client
  accepts.

Both builds are installed in [`orion/client/`](orion/client/README.md), so the
client runs as shipped. That directory's README documents what differs between
them — which global carries the launch options, which one starts itself and
which Orion has to start, and why `signature.txt` must be handed over before
the client loads. `tools/unpack-eaglercraft.js` pulls a build out of an offline
`.html` and prints the settings it needs.

The Orion mark is generated, not stored as a bitmap:
`node tools/make-orion-logo.js > orion/assets/orion-logo.svg`.

Pages publishes this repository from `main` using GitHub's built-in branch
source, so merging to `main` is all that is needed to put Orion online — no
Pages settings to change. `.github/workflows/checks.yml` validates instead of
deploying: it parses every tracked `.js` file and fails if the committed logo
no longer matches its generator.

### Accounts, friends and the mod store need a backend

Everything else in Orion is static and per-browser. Who is online cannot be, so
it lives in Supabase behind `orion/js/config.js`.

Orion accounts are **Orion's own**, separate from anything else on this site: a
name, a password, and nothing else — no email, so there is nothing to verify
and nothing to leak. Passwords are stored as bcrypt hashes (`extensions.crypt`
with a per-password salt; pgcrypto lives in the `extensions` schema, so every
call has to be schema-qualified). Signing in returns a random session token
which the browser keeps in `localStorage`; only its hash is stored server-side,
and it expires.

The tables are unreachable with the publishable key — `anon` has no grant on
them at all, and the helper functions are revoked `from public` as well as from
`anon`, because Postgres grants `EXECUTE` to `PUBLIC` by default. Every read
and write goes through a `SECURITY DEFINER` function that checks the token
first. Names are stripped to `[A-Za-z0-9_.-]` before storage, so a name cannot
smuggle markup into anyone's page.

Presence is friends-only: a friend sees that you are online and what you are
playing, and a stranger sees nothing at all. Friendship needs both sides — a
request, then an accept — and either side can remove it.

The mod store publishes from the same account system. Anyone signed in can
browse and install; only an account with the `owner` role can upload. An upload
is not taken on trust: the browser opens the `.zip`, reads its central
directory, inflates `pack.mcmeta` and checks the `pack_format` (1 for 1.8, 3
for 1.12.2), confirms the textures are where the game will look for them, and
rejects the pack with a reason if anything is off. Only a pack that passes is
sent to the `orion-mods` Edge Function and stored in the `orion-mods` bucket.

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
orion/js/account.js   Orion accounts, friends, presence (Supabase-backed)
orion/js/versions.js  the builds Orion can launch, and how each one boots
orion/js/turn.js      TURN injection for shared worlds
orion/js/config.js    API + TURN endpoints; blank either to disable it
orion/client/1.8/     EaglercraftX 1.8-u53 + its signature
orion/client/1.12.2/  Eaglercraft 1.12.2-u3
orion/mods/           mod store: browse, install, and (for the owner) upload
orion/mods/js/pack.js reads a .zip in the browser and rules on compatibility
orion/skin/           skin designer: 64x64 sheet editor with a 3D preview
tools/unpack-eaglercraft.js  pull a client out of an offline .html
tools/make-orion-logo.js   rasterises the Orion mark to SVG
```

## Notes

- 60 Hz fixed-step simulation with an accumulator; rendering is decoupled.
- Animation is pose-based: ~30 named poses plus a 34-entry swing library, blended with
  easing and layered with procedural secondary motion (hair, capes, weapon trails).
- All colour, geometry and naming derive from seeded RNG, so the catalogue is stable
  across sessions and machines.
