/* ORION THEME — drawing the menu
 *
 * The client's main menu, its buttons and its loading screens are textures,
 * and a resource pack can replace textures. So the theme is not a patch to the
 * client — it is a pack, built here, out of the same palette the launcher uses.
 *
 * What each file is, and why the sizes are what they are:
 *
 *   gui/title/minecraft.png        256x256. 1.8 draws the title from two
 *                                  blits of this sheet — (0,0,155,44) then
 *                                  (0,45,155,44) placed beside it — so the
 *                                  wordmark has to be split across those two
 *                                  rows, in that order, or it comes out
 *                                  scrambled.
 *   gui/title/mojang.png           256x256, drawn once while the game loads
 *                                  its resources. This is the loading screen
 *                                  everyone sees first.
 *   gui/title/background/panorama_0..5.png
 *                                  the six faces of the skybox that turns
 *                                  behind the main menu: 0 north, 1 east,
 *                                  2 south, 3 west, 4 up, 5 down. Vanilla
 *                                  ships 1024s; 256 is plenty for a starfield
 *                                  and keeps the pack small.
 *   gui/options_background.png     a 16x16 tile. Every menu that is not the
 *                                  main menu is this, repeated.
 *   gui/widgets.png                256x256, and the fiddly one: it holds the
 *                                  hotbar and the slot highlight as well as
 *                                  the three button states, so replacing it
 *                                  means drawing all of them. The regions are
 *                                  fixed by the game:
 *                                    (0,0,182,22)   hotbar
 *                                    (0,22,24,24)   selected-slot highlight
 *                                    (0,46,200,20)  button, disabled
 *                                    (0,66,200,20)  button, normal
 *                                    (0,86,200,20)  button, hovered
 *                                  A button is drawn as two halves of that
 *                                  strip, so its left and right ends are what
 *                                  show — the middle is stretched.
 */
window.ORION_THEME = window.ORION_THEME || {};
(function (NS) {
  'use strict';

  /* The launcher's own palette, so the game and the page around it match. */
  const PALETTES = {
    orion: {
      label: 'Orion',
      blurb: 'The launcher’s violet, on near-black.',
      void: '#07060f', bg: '#120e26', panel: '#1b1540',
      line: '#4a3f86', accent: '#9c86dc', accent2: '#6f7fdd',
      text: '#ece9ff', dim: '#a49cd0', star: '#e8e2ff',
      /* The skybox is the one place the client overrides us — see the note on
       * NS.panorama — so it gets its own saturated pair rather than reusing
       * the near-black backdrop colours. */
      sky0: '#4a1fb5', sky1: '#150a4a', cloud: '#8a4dff', cloud2: '#3f5bff'
    },
    ember: {
      label: 'Ember',
      blurb: 'Warmer — rust and amber over brown-black.',
      void: '#0d0705', bg: '#241009', panel: '#33170d',
      line: '#8a4526', accent: '#ff9d4d', accent2: '#e0632f',
      text: '#fff0e4', dim: '#d3a988', star: '#ffe8cf',
      sky0: '#b53a06', sky1: '#3d1004', cloud: '#ff7a1a', cloud2: '#c22a2a'
    },
    tide: {
      label: 'Tide',
      blurb: 'Cold teal, the deep-water one.',
      void: '#03090c', bg: '#08202a', panel: '#0b2e3b',
      line: '#1d6b7f', accent: '#4fd6dd', accent2: '#3aa0c9',
      text: '#e2fbff', dim: '#93c4cf', star: '#d6feff',
      sky0: '#046b86', sky1: '#02222e', cloud: '#00c2d6', cloud2: '#1466a8'
    },
    bone: {
      label: 'Bone',
      blurb: 'Pale and quiet. Easiest to read.',
      void: '#0e0e11', bg: '#1e1e24', panel: '#2b2b34',
      line: '#6e6e80', accent: '#d9d9e6', accent2: '#a8a8bd',
      text: '#f4f4f8', dim: '#b9b9c8', star: '#ffffff',
      sky0: '#3d3d4d', sky1: '#15151b', cloud: '#7b7b93', cloud2: '#575768'
    }
  };
  NS.PALETTES = PALETTES;
  NS.paletteList = () => Object.keys(PALETTES).map((k) => ({ id: k, label: PALETTES[k].label, blurb: PALETTES[k].blurb }));

  function rng(seed) {
    let a = (seed >>> 0) || 7;
    return function () {
      a ^= a << 13; a >>>= 0;
      a ^= a >> 17;
      a ^= a << 5; a >>>= 0;
      return a / 4294967296;
    };
  }

  const cv = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { c: c, g: g };
  };

  /* ------------------------------------------------------------- the letters
   * A 3x5 pixel alphabet, enough for a wordmark. Drawn rather than loaded so
   * the theme needs no font file and no network. */
  const GLYPHS = {
    A: ['010', '101', '111', '101', '101'],
    B: ['110', '101', '110', '101', '110'],
    C: ['011', '100', '100', '100', '011'],
    D: ['110', '101', '101', '101', '110'],
    E: ['111', '100', '110', '100', '111'],
    F: ['111', '100', '110', '100', '100'],
    G: ['011', '100', '101', '101', '011'],
    H: ['101', '101', '111', '101', '101'],
    I: ['111', '010', '010', '010', '111'],
    J: ['001', '001', '001', '101', '010'],
    K: ['101', '101', '110', '101', '101'],
    L: ['100', '100', '100', '100', '111'],
    M: ['101', '111', '111', '101', '101'],
    N: ['110', '101', '101', '101', '101'],
    O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'],
    Q: ['010', '101', '101', '111', '011'],
    R: ['110', '101', '110', '101', '101'],
    S: ['011', '100', '010', '001', '110'],
    T: ['111', '010', '010', '010', '010'],
    U: ['101', '101', '101', '101', '011'],
    V: ['101', '101', '101', '101', '010'],
    W: ['101', '101', '111', '111', '101'],
    X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '010', '010', '010'],
    Z: ['111', '001', '010', '100', '111'],
    ' ': ['000', '000', '000', '000', '000'],
    '.': ['000', '000', '000', '000', '010'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['110', '001', '010', '100', '111'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    '0': ['111', '101', '101', '101', '111']
  };

  function textWidth(text, scale, gap) {
    return text.length * (3 * scale + gap) - gap;
  }

  /* Draws text in whole pixels. `shade` gives every letter an extrusion below
   * and to the right, the way the Minecraft logo has one — offset by a whole
   * number of pixels, because a half-pixel offset lands between the grid and
   * the letters come out furry at the size the menu draws them. */
  function drawText(g, text, x, y, scale, colour, shade, gap) {
    const step = 3 * scale + (gap === undefined ? scale : gap);
    const drop = Math.max(1, Math.round(scale / 3));
    let at = x;

    if (shade) {
      let sx = x;
      g.fillStyle = shade;
      for (const ch of text.toUpperCase()) {
        const rows = GLYPHS[ch] || GLYPHS[' '];
        for (let ry = 0; ry < rows.length; ry++) {
          for (let rx = 0; rx < 3; rx++) {
            if (rows[ry][rx] !== '1') continue;
            g.fillRect(sx + rx * scale + drop, y + ry * scale + drop, scale, scale);
          }
        }
        sx += step;
      }
    }

    for (const ch of text.toUpperCase()) {
      const rows = GLYPHS[ch] || GLYPHS[' '];
      for (let ry = 0; ry < rows.length; ry++) {
        for (let rx = 0; rx < 3; rx++) {
          if (rows[ry][rx] !== '1') continue;
          g.fillStyle = colour;
          g.fillRect(at + rx * scale, y + ry * scale, scale, scale);
        }
      }
      at += step;
    }
    return at - x;
  }
  NS.drawText = drawText;
  NS.textWidth = textWidth;

  /* ------------------------------------------------------------------ title
   * Drawn with a real typeface rather than the 3x5 pixel alphabet below. The
   * sheet is 256x256 for a wordmark that is only 44 tall, so there is room for
   * proper letterforms, and pixel-art capitals were most of what made the
   * menu still look like Minecraft.
   *
   * The layout constraint is the game's: 1.8 blits the title from two halves
   * of one sheet, (0,0,155,44) then (0,45,155,44) beside it, so the wordmark is
   * drawn once across a 310-wide strip and cut down the middle. That is the
   * only way to get letters that straddle the join.
   */
  NS.title = function (pal, word) {
    const text = (word || 'ORION').toUpperCase().slice(0, 16);
    const strip = cv(310, 44);
    const g = strip.g;
    g.imageSmoothingEnabled = true;

    /* Fit the word to the strip, then space it out: wide tracking is most of
     * what reads as modern. Tracking is applied by drawing character by
     * character, since canvas has no letter-spacing everywhere. */
    let size = 30;
    let track = Math.max(2, Math.round(size * 0.16));
    const font = (px) => '700 ' + px + 'px "Rajdhani", "Segoe UI", system-ui, -apple-system, sans-serif';
    const widthOf = (px, sp) => {
      g.font = font(px);
      let w = 0;
      for (const ch of text) w += g.measureText(ch).width + sp;
      return w - sp;
    };
    while (size > 8 && widthOf(size, track) > 286) {
      size -= 1;
      track = Math.max(2, Math.round(size * 0.16));
    }

    const w = widthOf(size, track);
    let x = Math.round((310 - w) / 2);
    const baseline = 30;

    g.font = font(size);
    g.textBaseline = 'alphabetic';
    for (const ch of text) {
      g.fillStyle = pal.text;
      g.fillText(ch, x, baseline);
      x += g.measureText(ch).width + track;
    }

    /* A hairline under the word, in the accent — the launcher's own heading
     * treatment, and the thing that makes it look designed rather than
     * dropped in. */
    g.fillStyle = pal.accent;
    g.fillRect(Math.round((310 - w) / 2), baseline + 6, Math.round(w), 2);

    const out = cv(256, 256);
    out.g.drawImage(strip.c, 0, 0, 155, 44, 0, 0, 155, 44);
    out.g.drawImage(strip.c, 155, 0, 155, 44, 0, 45, 155, 44);
    return out.c;
  };

  /* --------------------------------------------------------- loading screen
   * What the client shows while it reads its resources. Made to match the
   * launcher's own boot screen: a thin ring, a soft core, the wordmark and one
   * word underneath. Flat colours, no bevels, nothing pixel-arty. */
  NS.mojang = function (pal, word) {
    const { c, g } = cv(256, 256);
    g.fillStyle = pal.void;
    g.fillRect(0, 0, 256, 256);

    const cx = 128, cy = 104;

    /* the halo */
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, 74);
    halo.addColorStop(0, pal.accent);
    halo.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.5;
    g.fillStyle = halo;
    g.fillRect(cx - 80, cy - 80, 160, 160);
    g.globalAlpha = 1;

    /* one thin ellipse, drawn as a stroke rather than stamped squares */
    g.save();
    g.translate(cx, cy);
    g.rotate(-0.34);
    g.strokeStyle = pal.accent;
    g.lineWidth = 3;
    g.beginPath();
    g.ellipse(0, 0, 70, 24, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = pal.text;
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(0, 0, 70, 24, 0, Math.PI * 0.1, Math.PI * 0.8);
    g.stroke();
    g.restore();

    /* the core */
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, 22);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.3, pal.text);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = core;
    g.fillRect(cx - 26, cy - 26, 52, 52);

    /* Same typeface as the title, for the same reason. */
    const label = (word || 'ORION').toUpperCase().slice(0, 16);
    g.textBaseline = 'alphabetic';
    const spaced = (str, px, weight, colour, y) => {
      g.font = weight + ' ' + px + 'px "Rajdhani", "Segoe UI", system-ui, -apple-system, sans-serif';
      const track = Math.max(2, Math.round(px * 0.18));
      let total = 0;
      for (const ch of str) total += g.measureText(ch).width + track;
      total -= track;
      let x = Math.round((256 - total) / 2);
      g.fillStyle = colour;
      for (const ch of str) {
        g.fillText(ch, x, y);
        x += g.measureText(ch).width + track;
      }
    };
    spaced(label, 26, '700', pal.text, 196);
    spaced('LOADING', 12, '600', pal.dim, 222);
    return c;
  };

  /* ----------------------------------------------------------- menu backdrop
   * A 16x16 tile, repeated across every screen that is not the main menu.
   * Vanilla's is dirt, which is why every Minecraft menu looks like the inside
   * of a hole. This is a near-flat wash with a very faint grid, so at menu
   * scale it reads as one calm surface rather than a texture — the launcher's
   * panel, essentially. The client darkens whatever is here, so it is drawn a
   * step lighter than the colour wanted on screen.
   */
  NS.background = function (pal, seed) {
    const { c, g } = cv(16, 16);
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, 16, 16);
    /* One hairline in each direction: enough to catch the light, not enough to
     * be a pattern. */
    g.globalAlpha = 0.22;
    g.fillStyle = pal.panel;
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.globalAlpha = 0.16;
    g.fillStyle = pal.void;
    g.fillRect(15, 0, 1, 16);
    g.fillRect(0, 15, 16, 1);
    g.globalAlpha = 1;
    return c;
  };

  /* --------------------------------------------------------------- panorama
   * The six faces of the skybox that turns behind the main menu: 0 north,
   * 1 east, 2 south, 3 west, 4 up, 5 down.
   *
   * Two things about this face are the client's decision, not ours, and both
   * were established by installing probe packs and looking rather than by
   * guessing:
   *
   *   It blends the skybox heavily toward white. Six flat #ff00aa faces arrive
   *   on screen as pale pink; six transparent faces arrive as light grey. So a
   *   dark sky is not achievable here at all — the floor is set by the blend.
   *   Saturated mid-tones survive it best.
   *
   *   It blurs it, hard. Detail is gone by the time it is on screen.
   *
   * The first version fought both of those with a starfield and drifts of
   * nebula, and the result was exactly what you would expect: pale lilac
   * cloud. So this is a plain vertical gradient with a soft vignette and
   * nothing else. A clean gradient is the one thing that survives a blur
   * intact, and it is what the launcher's own background is.
   */
  NS.panorama = function (pal, seed, size) {
    const n = size || 256;
    const faces = [];
    for (let i = 0; i < 6; i++) faces.push(cv(n, n));

    const sky0 = pal.sky0 || pal.bg;
    const sky1 = pal.sky1 || pal.void;

    for (let f = 0; f < 6; f++) {
      const g = faces[f].g;

      if (f < 4) {
        /* Sides: darkest at the top, opening out toward the horizon, then
         * darkening again below it. */
        const grad = g.createLinearGradient(0, 0, 0, n);
        grad.addColorStop(0, sky1);
        grad.addColorStop(0.46, sky0);
        grad.addColorStop(0.62, sky0);
        grad.addColorStop(1, sky1);
        g.fillStyle = grad;
        g.fillRect(0, 0, n, n);

        /* A vignette at the left and right edges so the four side faces meet
         * without a visible seam when it turns. */
        const edge = g.createLinearGradient(0, 0, n, 0);
        edge.addColorStop(0, 'rgba(0,0,0,0.16)');
        edge.addColorStop(0.5, 'rgba(0,0,0,0)');
        edge.addColorStop(1, 'rgba(0,0,0,0.16)');
        g.fillStyle = edge;
        g.fillRect(0, 0, n, n);
      } else {
        /* Up and down: flat, with the zenith and nadir a shade deeper so the
         * sky does not read as a box. */
        const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n * 0.75);
        grad.addColorStop(0, sky1);
        grad.addColorStop(1, f === 4 ? sky0 : sky1);
        g.fillStyle = grad;
        g.fillRect(0, 0, n, n);
      }
    }

    return faces.map((f) => f.c);
  };

  /* ---------------------------------------------------------------- widgets
   * The three button strips, painted over the client's own sheet.
   *
   * widgets.png is not just buttons. It also holds the hotbar at
   * (0,0,182,22), the selected-slot outline at (0,22,24,24) and, in
   * EaglercraftX, the globe and padlock icons the multiplayer list draws. A
   * pack replaces whole files, so a widgets.png containing only buttons
   * deletes all of that — which is precisely what the first version of this
   * theme did, and why the hotbar changed when nobody asked it to.
   *
   * So `base` is the client's own sheet, captured by js/widgets.js from the
   * running game. It is drawn first, and only these three rows are painted
   * over:
   *
   *   (0,46,200,20)  button, disabled
   *   (0,66,200,20)  button, normal
   *   (0,86,200,20)  button, hovered
   *
   * Everything else in the file is left exactly as the client shipped it.
   * Without a base there is nothing safe to build, so this returns null and
   * the pack simply has no widgets.png in it.
   *
   * A button is stretched from the middle of its strip — left half, then right
   * half — so detail in the centre is smeared and only the ends survive. That
   * is why the accent is a bar at the very edge.
   */
  NS.BUTTON_ROWS = { disabled: 46, normal: 66, hover: 86 };

  NS.widgets = function (pal, base) {
    if (!base) return null;

    const { c, g } = cv(256, 256);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 256, 256);
    g.drawImage(base, 0, 0);

    /* Wipe only the button rows before repainting them, or the vanilla grey
     * shows through wherever ours is translucent. */
    const fill = (x, y, w, h, colour, alpha) => {
      g.globalAlpha = alpha === undefined ? 1 : alpha;
      g.fillStyle = colour;
      g.fillRect(x, y, w, h);
      g.globalAlpha = 1;
    };

    const button = (y, opts) => {
      g.clearRect(0, y, 200, 20);
      fill(0, y, 200, 20, opts.fill, opts.alpha);
      /* One-pixel border, the same weight on all four sides — a bevel is what
       * makes vanilla's buttons look like 2011. */
      fill(0, y, 200, 1, opts.border, opts.borderAlpha);
      fill(0, y + 19, 200, 1, opts.border, opts.borderAlpha);
      fill(0, y, 1, 20, opts.border, opts.borderAlpha);
      fill(199, y, 1, 20, opts.border, opts.borderAlpha);
      if (opts.accent) fill(1, y + 1, 2, 18, opts.accent);
      /* A single lighter row under the top border: enough to read as a
       * surface rather than a flat rectangle, not enough to be a gradient. */
      if (opts.sheen) fill(1, y + 1, 198, 1, opts.sheen, 0.5);
    };

    button(NS.BUTTON_ROWS.disabled, {
      fill: pal.void, alpha: 0.62, border: pal.line, borderAlpha: 0.3
    });
    button(NS.BUTTON_ROWS.normal, {
      fill: pal.panel, alpha: 0.92, border: pal.line, borderAlpha: 0.7, sheen: pal.line
    });
    button(NS.BUTTON_ROWS.hover, {
      fill: pal.panel, alpha: 1, border: pal.accent, borderAlpha: 0.95,
      accent: pal.accent, sheen: pal.accent
    });

    return c;
  };

  const FONT_CELL = 32;
  const FONT_SHEET = FONT_CELL * 16;

  NS.font = function (pal) {
    const { c, g } = cv(FONT_SHEET, FONT_SHEET);
    g.imageSmoothingEnabled = true;
    g.clearRect(0, 0, FONT_SHEET, FONT_SHEET);

    /* Pure white: the game tints text by multiplying, so anything else here
     * would fight every colour code in the game. */
    g.fillStyle = '#ffffff';
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';

    /* Two things decide these numbers, and getting them wrong shows up as
     * litter on every screen — which it did on the first attempt.
     *
     * The glyph has to fit its cell *including its descender*. The game slices
     * the sheet into equal cells, so a 'p' whose tail hangs past the bottom of
     * its cell reappears as a stray mark above the row below. Baseline at 26
     * of 32 with a 19px face leaves room for the tail and still sits within a
     * pixel of where vanilla puts its own.
     *
     * And the glyph must not touch the right edge, because the game works out
     * each character's advance width by scanning its cell inward from the
     * right for the first pixel that is not transparent. A glyph that reaches
     * the edge measures as a full cell wide and the text comes out gappy.
     */
    const size = 19;
    const baseline = 26;
    const margin = 2;
    g.font = '600 ' + size + 'px "Rajdhani", "Segoe UI", system-ui, -apple-system, sans-serif';

    const draw = (code) => {
      const ch = String.fromCharCode(code);
      const col = code % 16;
      const row = Math.floor(code / 16);
      const x = col * FONT_CELL;
      const y = row * FONT_CELL;

      /* Clipped to the cell as insurance: whatever the metrics say, nothing
       * from this character can land in another one's box. */
      g.save();
      g.beginPath();
      g.rect(x, y, FONT_CELL, FONT_CELL);
      g.clip();

      /* Squeeze the few glyphs that are wider than the cell allows rather
       * than letting them be cut off. */
      const w = g.measureText(ch).width;
      const room = FONT_CELL - margin * 2;
      if (w > room && w > 0) {
        const k = room / w;
        g.translate(x + margin, y + baseline);
        g.scale(k, 1);
        g.fillText(ch, 0, 0);
      } else {
        g.fillText(ch, x + margin, y + baseline);
      }
      g.restore();
    };

    /* Printable ASCII, then Latin-1 so accented names do not fall back to a
     * different font mid-word. Codes below 32 are control characters and stay
     * empty, which is what vanilla has there too. Space is left blank: the
     * game gives an empty cell a fixed width of its own. */
    for (let code = 33; code <= 126; code++) draw(code);
    for (let code = 161; code <= 255; code++) draw(code);

    /* Antialiasing leaves a haze of nearly-invisible pixels past the edge of
     * every glyph, and the width scan counts those, so letters end up spaced
     * as if they were all as wide as the widest. Clearing the faintest pixels
     * makes the measured width the real one while leaving the smooth edge
     * that makes this look like type rather than pixel art. */
    const img = g.getImageData(0, 0, FONT_SHEET, FONT_SHEET);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 40) d[i] = 0;
    }
    g.putImageData(img, 0, 0);

    return c;
  };

  /* ---------------------------------------------------------------- splashes
   * The yellow line that flops over the logo comes from
   * assets/minecraft/texts/splashes.txt — one splash per line, picked at
   * random — so a pack can replace it. Vanilla's are Minecraft in-jokes, which
   * is exactly the wrong note for a themed menu.
   */
  NS.splashes = function (word) {
    const name = (word || 'ORION').toUpperCase().slice(0, 16);
    return [
      name,
      'Runs in a tab',
      'No install, no launcher',
      'Bring your friends',
      'Now with proximity voice',
      'Print your own records',
      'Built on GitHub Pages',
      'Same port as Java',
      'wss:// or nothing',
      'Made in a browser'
    ].join('\n') + '\n';
  };

  NS.toPng = function (canvas) {
    return new Promise((res, rej) => {
      canvas.toBlob(async (b) => {
        if (!b) return rej(new Error('That image could not be encoded.'));
        res(new Uint8Array(await b.arrayBuffer()));
      }, 'image/png');
    });
  };
})(window.ORION_THEME);
