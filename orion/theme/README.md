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

Two of those have layouts that cannot be guessed at:

**The title** is not one picture. 1.8 draws it from two blits of the same
sheet — `(0,0,155,44)`, then `(0,45,155,44)` placed beside it — so the wordmark
is drawn once across a 310-wide strip and cut down the middle, which is the only
way to get letters that straddle the join.

**The widget sheet** holds more than buttons: the hotbar at `(0,0,182,22)` and
the selected-slot outline at `(0,22,24,24)` share it with the three button
states at `(0,46)`, `(0,66)` and `(0,86)`. Replacing it means drawing all of
them, so restyling the buttons necessarily restyles the hotbar. The page says
so and lets you turn it off.

The letters come from a 3x5 pixel alphabet in `textures.js` rather than a font
file, so the theme needs nothing from the network.

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

## Verifying a change

The preview is built from the actual files the pack will contain, blitted the
way the client blits them, so a wrong texture shows up as a wrong preview. That
is not a substitute for looking, though: `scratchpad/theme-ingame.js` installs
the theme, launches the real client, selects the pack through the game's own
Resource Packs screen and photographs the menu.
