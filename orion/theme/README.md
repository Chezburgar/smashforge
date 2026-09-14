# The menu theme

The client's main menu, its buttons and the screen you stare at while it loads
are textures, and a resource pack can replace textures. So the theme is not a
patch to the client — it is a pack, built in the browser out of the same
palette the launcher uses.

```
orion/theme/index.html      palette, wordmark, and a preview of each screen
orion/theme/js/textures.js  draws every file the pack contains
orion/theme/js/app.js       the preview, the install, the download
orion/js/autotheme.js       the same textures, installed by the launcher itself
```

**The default menu comes from here.** `orion/js/autotheme.js` calls the same
drawing code as this page, with the `orion` palette and the wordmark *ORION
CLIENT*, and writes the pack into the client's storage during the launch — so a
fresh browser gets an Orion menu without anyone visiting this page. The
checkbox beside **Launch client** turns that off and removes the pack; this page
is for building a different one.

It takes two launches to arrive in full. The buttons are painted over the
client's own `widgets.png`, and that sheet can only be copied while the game is
running, so the first launch gets everything else and the second picks up the
buttons.

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
way to get letters that straddle the join. Those numbers are texture units of a
256-wide sheet rather than pixels, so a bigger sheet is sampled in the same
places and simply arrives sharper: the theme draws at 1024, because at 256 a
wordmark spanning the screen is eleven pixels tall and looks it.

**The widget sheet** holds far more than buttons. The hotbar sits at
`(0,0,182,22)`, the selected-slot outline at `(0,22,24,24)`, the three button
states at `(0,46)`, `(0,66)` and `(0,86)` — and in EaglercraftX, the globe and
padlock icons the multiplayer server list draws are in there too. A pack
replaces whole files, so a `widgets.png` containing only buttons deletes all of
that. The first version of this theme did exactly that: it restyled the buttons
and took the hotbar with them.

Restyling buttons *only* therefore needs a copy of the client's own sheet to
paint over, and `orion/js/widgets.js` takes one from the client installed here
rather than committing artwork to this repository. The client turns every PNG
into pixels by drawing it into a canvas and calling `getImageData`, so hooking
that during launch hands over every texture it decodes. The hook cannot see
file names, so `widgets.png` is recognised by its contents — the three button
greys, and transparency just past where the hotbar ends:

| Probe | Expected |
|---|---|
| `(100,76)` | `112,112,112,255` — button, normal |
| `(100,96)` | `128,138,192,255` — button, hovered |
| `(100,56)` | `45,45,45,255` — button, disabled |
| `(190,10)` | fully transparent — right of the hotbar |

Those four were enough to tell it from every other 256×256 texture the client
loads, which was checked against all of them. It is captured once, kept in
`localStorage` keyed by build, and the hook removes itself. Until it has been
captured — a browser that has not launched the game yet — the theme leaves
`widgets.png` out of the pack and the page says why, rather than shipping a
sheet with holes in it.

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

## Menus only

Everything in the table is menu furniture and cannot appear in a world, with
one exception: the lettering. `font/ascii.png` is a single texture, so
replacing it changes chat, item names and signs along with the menus — there is
no way to have one without the other, and the page's checkbox turns it off for
anyone who wants strictly menus.

The hotbar in particular is left exactly as the client draws it. Verified by
launching vanilla, screenshotting the hotbar in a world, installing the theme,
and screenshotting the same spot again.

## What it cannot do

A resource pack can change pictures and sounds, and nothing else. The words on
the buttons come from the language file; where they sit is compiled into the
client, which is signed and cannot be edited without breaking that signature.

**The panorama is not drawn as given.** The client lays a white-to-nothing
gradient over the skybox. That was measured, not guessed: a pack of six pure
black faces was installed and the rendered menu sampled, on a 1280×800 window.

| where | rendered |
| --- | --- |
| y = 80 (behind the title) | rgb 109 |
| y = 300 | rgb 65 |
| y = 700 | rgb 9 |
| y = 760 | rgb 3 |

So the top of the menu cannot be darker than about 43% grey however dark the
texture is, and the bottom two thirds are as dark as you draw them. Blanking
`gui/title/background/panorama_overlay.png` changes nothing in either
direction — this build does not draw that texture at all.

Two consequences, both visible in the default theme: the sky is near-black
because the half of the screen that holds the buttons can be, and the wordmark
is drawn on a soft dark plate of its own, because the part of the screen it sits
on cannot be.

The client also blurs the skybox, so single pixels are softened: the nebula is
large and faint, and the stars are sparse rather than a thousand specks.

The main-menu preview lays the same measured gradient over its own panorama, so
what it shows is what the game draws. Every other screen in the table above is
untouched by any of this and comes out exactly as previewed.

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
