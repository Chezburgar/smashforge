# The skin designer

A Minecraft skin editor at `/orion/skin/`, with a live 3D preview and a PNG
export the client accepts.

```
orion/skin/index.html      the editor
orion/skin/skin.css        editor styling
orion/skin/js/uv.js        the 64x64 sheet's face rectangles
orion/skin/js/preview.js   the 3D preview
orion/skin/js/editor.js    the drawing surface, tools and history
orion/skin/js/app.js       wiring, presets, import and export
```

## The sheet is the real thing

Skins are not free-form images: a 64×64 sheet is a fixed atlas of **72
rectangles** — six faces each for the head, body, both arms and both legs, and
again for the overlay layer that carries hair, sleeves and trouser legs.
`uv.js` holds that layout once, and both the editor and the preview read it, so
a pixel you paint on the arm is the same pixel the game samples.

Everything works on the sheet directly. Import someone's existing skin and the
tools work on it; export and you get a PNG the game accepts without conversion.

## The preview

The preview is orthographic, drawn by transforming each face rectangle with an
affine transform on a 2D canvas — no WebGL, so it works on the same machines
the launcher already runs on.

Shading is per-face, but it is **not** applied per-face at draw time: doing that
with `source-atop` darkened whatever had already been drawn underneath and left
dark rectangles wherever the overlay layer was transparent. Instead the whole
sheet is pre-shaded once per brightness level and cached, and each face is
drawn from the copy that matches it.

The default skin is generated rather than shipped as a bitmap. The first
version had hair only on the front of the head, which looked fine head-on and
bald from every other angle; the band now wraps all four side faces and the
crown.
