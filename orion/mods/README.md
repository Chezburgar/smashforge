# The Orion mod store

Resource packs for Eaglercraft, listed at `/orion/mods/`. Anyone with an Orion
account can browse and download.
**Only an account with the `owner` role can upload** — the store is curated, not
a free-for-all.

```
orion/mods/index.html   the store front and the upload panel
orion/mods/mods.css     store-specific styling
orion/mods/js/pack.js   reads a .zip in the browser and rules on compatibility
orion/mods/js/app.js    store UI, install, upload
```

## What "mod" means here

Eaglercraft runs the real Minecraft client compiled to JavaScript. It does not
load Forge or Fabric mods — there is no JVM to load them into. What it *does*
load is **resource packs**: textures, sounds, fonts, and the models and GUI
layouts that go with them. So that is what the store carries, and the upload
panel says so rather than letting someone spend an afternoon on a `.jar` that
can never work.

## Compatibility is checked, not promised

A pack is validated in the uploader's own browser before it is sent anywhere,
and the reason for a rejection is shown next to the file. `pack.js` does this
with no dependencies:

1. Reads the ZIP **central directory** from the end of the file, so it never has
   to walk the whole archive.
2. Inflates `pack.mcmeta` with `DecompressionStream('deflate-raw')` and parses
   it. A pack with no `pack.mcmeta`, or one whose JSON is broken, is refused.
3. Reads `pack_format` and maps it to a version — **1 → 1.8**, **3 → 1.12.2**.
   An unknown format is refused rather than guessed at, because the game will
   simply ignore a pack it does not understand and the player would see nothing
   happen.
4. Checks the layout. `pack.mcmeta` sitting one folder down is refused with the
   fix spelled out — zipping the pack folder instead of its contents is the
   single most common mistake, and the game simply ignores the result. No
   `assets/` at all is refused; `assets/` with nothing under
   `assets/minecraft/` is a warning, since the pack then changes no vanilla
   content.
5. Refuses anything over 25 MB, anything using Zip64, and any entry name that
   climbs out of its folder (`..`, a leading `/`, a drive letter).
6. Samples the PNGs and warns about non-power-of-two sizes, shaders and
   OptiFine-only files — warnings, not refusals, because the rest of the pack
   still loads.

Only a pack that passes every step is sent to the `orion-mods` Edge Function,
which re-checks the account's role server-side — the browser deciding it is the
owner counts for nothing — and stores the file in the `orion-mods` bucket.

## Using a pack

**Download** hands over the `.zip` exactly as it was published; the game then
loads it through its own *Options → Resource Packs* screen, where it stays in
that browser afterwards. The client has no hook for putting a pack there from
outside, so the store does not pretend to install one — it says which version
each pack is for, and the store page walks through the two steps.

`pack.png` is pulled out during validation and stored with the listing, so a
pack that has an icon shows it.
