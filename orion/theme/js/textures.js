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
   * The two 155x44 halves the main menu blits side by side. The wordmark is
   * drawn once across a 310-wide strip and then cut down the middle, which is
   * the only way to get letters that straddle the join. */
  NS.title = function (pal, word) {
    const text = (word || 'ORION').toUpperCase().slice(0, 12);
    const strip = cv(310, 44);
    /* The letters have to fit in 310x44 with room for the extrusion, and the
     * scale is whole so every pixel stays on the grid. */
    const scale = Math.max(3, Math.min(7, Math.floor(298 / Math.max(1, textWidth(text, 1, 1)))));
    const w = textWidth(text, scale, scale);
    const x = Math.round((310 - w) / 2);
    const y = Math.round((44 - 5 * scale) / 2) - 1;

    /* Two extrusions and then the face: a dark one for the drop and a mid one
     * to catch the light, which is what gives the vanilla logo its weight.
     * No blur anywhere — this is a texture drawn at 1:1 and then magnified by
     * the game, so anything soft here arrives as mush. */
    drawText(strip.g, text, x, y, scale, pal.accent, 'rgba(0,0,0,0.8)');
    drawText(strip.g, text, x, y, scale, pal.text, null);

    const out = cv(256, 256);
    out.g.drawImage(strip.c, 0, 0, 155, 44, 0, 0, 155, 44);
    out.g.drawImage(strip.c, 155, 0, 155, 44, 0, 45, 155, 44);
    return out.c;
  };

  /* --------------------------------------------------------- loading screen */
  NS.mojang = function (pal, word) {
    const { c, g } = cv(256, 256);
    g.fillStyle = pal.void;
    g.fillRect(0, 0, 256, 256);

    /* The same ring the launcher's logo uses, drawn in pixels. */
    const cx = 128, cy = 112;
    for (let i = 0; i < 360; i += 2) {
      const a = (i * Math.PI) / 180;
      const rx = 74, ry = 26;
      const x = Math.round(cx + Math.cos(a) * rx);
      const y = Math.round(cy + Math.sin(a) * ry);
      g.fillStyle = pal.accent;
      g.fillRect(x, y, 3, 3);
    }
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, 34);
    core.addColorStop(0, pal.text);
    core.addColorStop(0.35, pal.accent);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = core;
    g.fillRect(cx - 40, cy - 40, 80, 80);

    const text = (word || 'ORION').toUpperCase().slice(0, 12);
    const scale = 4;
    const w = textWidth(text, scale, scale);
    drawText(g, text, Math.round((256 - w) / 2), 176, scale, pal.text, 'rgba(0,0,0,0.6)');
    drawText(g, 'LOADING', Math.round((256 - textWidth('LOADING', 2, 2)) / 2), 210, 2, pal.dim);
    return c;
  };

  /* ----------------------------------------------------------- menu backdrop
   * 16x16, tiled everywhere. Vanilla's is dirt, which is why every menu looks
   * like a hole in the ground. */
  NS.background = function (pal, seed) {
    const { c, g } = cv(16, 16);
    const r = rng(seed || 1);
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const n = r();
        if (n < 0.16) { g.fillStyle = pal.panel; g.fillRect(x, y, 1, 1); }
        else if (n < 0.2) { g.fillStyle = pal.void; g.fillRect(x, y, 1, 1); }
        else if (n < 0.205) { g.fillStyle = pal.line; g.fillRect(x, y, 1, 1); }
      }
    }
    return c;
  };

  /* --------------------------------------------------------------- panorama
   * One sky, six faces. Stars are placed on a sphere and then projected into
   * whichever face they fall on, so a star never lands on two faces and the
   * sky reads as continuous while the menu turns.
   *
   * Two things about this face are decided by the client rather than by taste,
   * both established by installing probe packs and looking at the result:
   *
   *   It blends the skybox heavily toward white. Six flat #ff00aa faces arrive
   *   on screen as pale pink; six transparent faces arrive as light grey. So a
   *   near-black starfield — the obvious way to draw a space sky — comes out
   *   flat grey, and darkening it does not help, because the floor is set by
   *   the blend. Saturated mid-tones do survive: deep violet stays violet.
   *
   *   It blurs it. Individual pixels are gone by the time it is on screen, so
   *   detail here is wasted work. What reads is large shapes and the overall
   *   colour, which is why the nebula is big and soft and the stars are few and
   *   fat rather than a thousand single pixels.
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
        /* Sides: darker overhead, brighter at the horizon, like a sky. */
        const grad = g.createLinearGradient(0, 0, 0, n);
        grad.addColorStop(0, sky1);
        grad.addColorStop(0.58, sky0);
        grad.addColorStop(1, sky1);
        g.fillStyle = grad;
      } else if (f === 4) {
        const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n * 0.72);
        grad.addColorStop(0, sky1);
        grad.addColorStop(1, sky0);
        g.fillStyle = grad;
      } else {
        g.fillStyle = sky1;
      }
      g.fillRect(0, 0, n, n);
    }

    /* Nebula on the four side faces, seeded so a theme always gets the same sky. */
    const r = rng(seed || 99);
    for (let f = 0; f < 4; f++) {
      const g = faces[f].g;
      for (let i = 0; i < 18; i++) {
        const x = r() * n, y = n * 0.2 + r() * n * 0.6;
        const rad = n * (0.16 + r() * 0.3);
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, r() < 0.5 ? (pal.cloud || pal.accent) : (pal.cloud2 || pal.accent2));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.16 + r() * 0.2;
        g.fillStyle = grad;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      g.globalAlpha = 1;
    }

    /* Stars, dark against a ground the client is going to lighten anyway. */
    const sr = rng((seed || 99) ^ 0x5f5f);
    for (let i = 0; i < 420; i++) {
      /* Uniform on the sphere, so no clumping at the poles. */
      const z = sr() * 2 - 1;
      const t = sr() * Math.PI * 2;
      const rad = Math.sqrt(1 - z * z);
      const v = [Math.cos(t) * rad, z, Math.sin(t) * rad];

      const ax = Math.abs(v[0]), ay = Math.abs(v[1]), az = Math.abs(v[2]);
      let face, u, w;
      if (az >= ax && az >= ay) {
        face = v[2] > 0 ? 2 : 0;
        u = (v[2] > 0 ? -v[0] : v[0]) / az; w = -v[1] / az;
      } else if (ax >= ay) {
        face = v[0] > 0 ? 1 : 3;
        u = (v[0] > 0 ? v[2] : -v[2]) / ax; w = -v[1] / ax;
      } else {
        face = v[1] > 0 ? 4 : 5;
        u = v[0] / ay; w = (v[1] > 0 ? v[2] : -v[2]) / ay;
      }

      const px = Math.round(((u + 1) / 2) * (n - 1));
      const py = Math.round(((w + 1) / 2) * (n - 1));
      const bright = sr();
      const g = faces[face].g;
      /* A few bright ones for sparkle, the rest darker than the sky so they
       * survive the blend. */
      const w2 = Math.max(2, Math.round(n / 64));
      if (bright > 0.8) {
        /* A bright core with a halo, which is what a star looks like once the
         * client has blurred it. */
        const grad = g.createRadialGradient(px, py, 0, px, py, w2 * 2.5);
        grad.addColorStop(0, pal.star);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(px - w2 * 3, py - w2 * 3, w2 * 6, w2 * 6);
      } else {
        g.fillStyle = bright > 0.4 ? sky1 : (pal.cloud2 || pal.accent2);
        g.globalAlpha = 0.7;
        g.fillRect(px, py, w2, w2);
        g.globalAlpha = 1;
      }
    }

    return faces.map((f) => f.c);
  };

  /* ---------------------------------------------------------------- widgets */
  NS.widgets = function (pal) {
    const { c, g } = cv(256, 256);
    g.clearRect(0, 0, 256, 256);

    /* hotbar: (0,0,182,22) */
    g.fillStyle = pal.void;
    g.fillRect(0, 0, 182, 22);
    g.fillStyle = pal.panel;
    g.fillRect(1, 1, 180, 20);
    for (let i = 0; i < 9; i++) {
      const x = 1 + i * 20;
      g.fillStyle = pal.bg;
      g.fillRect(x, 1, 20, 20);
      g.fillStyle = pal.line;
      g.fillRect(x, 1, 20, 1);
      g.fillRect(x, 1, 1, 20);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(x, 20, 20, 1);
      g.fillRect(x + 19, 1, 1, 20);
    }

    /* selected slot: (0,22,24,24) — a bright frame that sits over a slot */
    g.fillStyle = pal.accent;
    g.fillRect(0, 22, 24, 24);
    g.fillStyle = 'rgba(0,0,0,0)';
    g.clearRect(2, 24, 20, 20);
    g.fillStyle = pal.text;
    g.fillRect(0, 22, 24, 1);
    g.fillRect(0, 45, 24, 1);
    g.fillRect(0, 22, 1, 24);
    g.fillRect(23, 22, 1, 24);

    /* the three button strips */
    const button = (y, fill, edge, top, label) => {
      g.fillStyle = edge;
      g.fillRect(0, y, 200, 20);
      g.fillStyle = fill;
      g.fillRect(1, y + 1, 198, 18);
      g.fillStyle = top;
      g.fillRect(1, y + 1, 198, 1);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(1, y + 18, 198, 1);
      /* corners knocked out, the way vanilla's buttons are */
      g.clearRect(0, y, 1, 1);
      g.clearRect(199, y, 1, 1);
      g.clearRect(0, y + 19, 1, 1);
      g.clearRect(199, y + 19, 1, 1);
      if (label) {
        g.fillStyle = label;
        g.fillRect(1, y + 1, 1, 18);
        g.fillRect(198, y + 1, 1, 18);
      }
    };
    button(46, '#2a2a31', '#15151a', 'rgba(255,255,255,0.05)');            /* disabled */
    button(66, pal.panel, pal.void, 'rgba(255,255,255,0.10)', pal.line);   /* normal */
    button(86, pal.line, pal.accent, 'rgba(255,255,255,0.22)', pal.accent);/* hovered */

    return c;
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
