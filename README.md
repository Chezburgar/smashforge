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
```

## Notes

- 60 Hz fixed-step simulation with an accumulator; rendering is decoupled.
- Animation is pose-based: ~30 named poses plus a 34-entry swing library, blended with
  easing and layered with procedural secondary motion (hair, capes, weapon trails).
- All colour, geometry and naming derive from seeded RNG, so the catalogue is stable
  across sessions and machines.
