# The menu theme

The client's main menu, its buttons and the screen you stare at while it loads
are textures, and a resource pack can replace textures. So the theme is not a
patch to the client — it is a pack, built in the browser out of the same
palette the launcher uses.

```
orion/theme/index.html      palette, wordmark, and a preview of each screen
orion/theme/js/textures.js  draws every file the pack contains
orion/theme/js/app.js       the preview, the install, the download
```

## What it replaces

| File | What you see change |
|---|---|
| `gui/title/minecraft.png` | the big logo on the main menu |
| `gui/title/mojang.png` | the screen while the game loads its resources |
| `gui/title/background/panorama_0…5.png` | the world turning behind the main menu |
| `gui/options_background.png` | the tiled backdrop on every other menu |
| `gui/widgets.png` | buttons, the hotbar and the selected-slot outline |
| `font/ascii.png` | every letter the game draws, in menus and in game |
| `texts/splashes.txt` | the yellow line flopped over the logo |

Three of those have layouts or rules that cannot be guessed at:

**The title** is not one picture. 1.8 draws it from two blits of the same
sheet — `(0,0,155,44)`, then `(0,45,155,44)` placed beside it — so the wordmark
is drawn once across a 310-wide strip and cut down the middle, which is the only
way to get letters that straddle the join.

**The widget sheet** holds more than buttons: the hotbar at `(0,0,182,22)` and
the selected-slot outline at `(0,22,24,24)` share it with the three button
states at `(0,46)`, `(0,66)` and `(0,86)`. Replacing it means drawing all of
them, so restyling the buttons necessarily restyles the hotbar. The page says
so and lets you turn it off.

**The font** is the one that most decides whether a menu still looks like
Minecraft, and it is a texture like the rest: `font/ascii.png` is a 16x16 grid
of cells where the cell index *is* the character code, so cell 65 is `A` and
drawing by char code needs no table. Vanilla's sheet is 128x128 — 8x8 a
glyph — and the game derives each character's advance width by scanning its
cell inward from the right for the first pixel that is not transparent, so a
font drawn here is measured automatically and needs no widths file.

This one is 512x512, so 32x32 a cell. The game draws text the same size on
screen either way, so the extra resolution goes on detail: at 8x8 every letter
has to be pixel art, and at 32x32 a real typeface fits.

Two rules fall out of how the game slices and measures that sheet, and breaking
either one litters every screen — the first attempt broke both:

- A glyph must fit its cell **including its descender**, or the tail of a `p`
  reappears as a stray mark above the row below. Baseline at 26 of 32 with a
  19px face leaves room, and every glyph is clipped to its cell as insurance.
- A glyph must not reach the right edge, or it measures as a full cell wide and
  the text comes out gappy. Antialiasing is the trap here: it leaves a haze of
  nearly-invisible pixels past the edge of every letter and the width scan
  counts them, so anything under alpha 40 is cleared. The edge stays smooth,
  the measured width becomes the real one.

Everything is drawn with the browser's own UI font rather than a font file,
because a font file would have to be fetched and this site fetches nothing.

## What it cannot do

A resource pack can change pictures and sounds, and nothing else. The words on
the buttons come from the language file; where they sit is compiled into the
client, which is signed and cannot be edited without breaking that signature.

**The panorama is not drawn as given.** The client does two things to it, both
established by installing probe packs and looking at the result rather than by
guessing:

- It blends the skybox heavily toward white. Six flat `#ff00aa` faces arrive on
  screen as pale pink; six transparent faces arrive as light grey. So a
  near-black starfield lands as flat grey and darkening it does not help — the
  floor is set by the blend. Saturated mid-tones survive, so the sky is drawn as
  a deep violet that stays violet, and there is no way to get a genuinely dark
  main menu this way.
- It blurs it. Single pixels are gone by the time it is on screen, so the nebula
  is large and soft and the stars are few and fat instead of a thousand specks.

The main-menu preview copies the wash by eye for that reason: without it you
would be shown a dark sky the game will never draw. Every other screen in the
table above is untouched by any of this and comes out exactly as previewed.

Orion's own loading screen — the one before the game appears, with the stages
and the elapsed time — is part of the launcher, not the client, so it is not in
this pack and already matches.

The client's own corner labels — *Minecraft 1.8.8*, *EaglercraftX 1.8-u53*, the
Mojang copyright, the *Collector's Edition* badge — are strings compiled into
the bundle rather than files in a pack, so they stay. Everything else on the
menu is ours.

## Verifying a change

The preview is built from the actual files the pack will contain, blitted the
way the client blits them, so a wrong texture shows up as a wrong preview. That
is not a substitute for looking, though: `scratchpad/theme-ingame.js` installs
the theme, launches the real client, selects the pack through the game's own
Resource Packs screen and photographs the menu.
