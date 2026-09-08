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
   * Sleek rather than chiselled: no extrusion, no outline, wide letter
   * spacing, and a thin accent rule under the word — the launcher's own
   * heading treatment. Vanilla's logo is a stone slab with a drop shadow; this
   * deliberately is not.
   *
   * The layout constraint is the game's: 1.8 blits the title from two halves
   * of one sheet, (0,0,155,44) then (0,45,155,44) beside it, so the wordmark
   * is drawn once across a 310-wide strip and cut down the middle. That is the
   * only way to get letters that straddle the join.
   */
  NS.title = function (pal, word) {
    const text = (word || 'ORION').toUpperCase().slice(0, 12);
    const strip = cv(310, 44);

    /* Wide tracking is most of what makes it read as modern, so the gap gets
     * its own share of the width rather than being a fraction of the glyph. */
    const scale = Math.max(2, Math.min(6, Math.floor(292 / Math.max(1, textWidth(text, 1, 2)))));
    const gap = Math.max(scale, Math.round(scale * 1.9));
    const w = textWidth(text, scale, gap);
    const x = Math.round((310 - w) / 2);
    const y = Math.round((44 - 5 * scale) / 2) - 3;

    drawText(strip.g, text, x, y, scale, pal.text, null, gap);

    /* A hairline under the word, in the accent, inset a little at each end. */
    const ruleY = y + 5 * scale + Math.max(3, scale);
    strip.g.fillStyle = pal.accent;
    strip.g.fillRect(x, ruleY, w, Math.max(1, Math.round(scale / 3)));

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

    const text = (word || 'ORION').toUpperCase().slice(0, 12);
    const scale = 3;
    const gap = 6;
    const w = textWidth(text, scale, gap);
    drawText(g, text, Math.round((256 - w) / 2), 178, scale, pal.text, null, gap);
    const sub = 'LOADING';
    const sw = textWidth(sub, 2, 5);
    drawText(g, sub, Math.round((256 - sw) / 2), 206, 2, pal.dim, null, 5);
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
      for (let i = 0; i < 9; i++) {
        const x = r() * n, y = n * 0.2 + r() * n * 0.6;
        const rad = n * (0.16 + r() * 0.3);
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, r() < 0.5 ? (pal.cloud || pal.accent) : (pal.cloud2 || pal.accent2));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalAlpha = 0.1 + r() * 0.13;
        g.fillStyle = grad;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      g.globalAlpha = 1;
    }

    /* Only the bright, bloomed stars are kept. The small ones were single
     * pixels, and single pixels do not survive the blur — they were work that
     * arrived as nothing. */
    const sr = rng((seed || 99) ^ 0x5f5f);
    for (let i = 0; i < 46; i++) {
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
      const w2 = Math.max(1, Math.round(n / 110));
      /* A core with a halo, which is what a star looks like once the client
       * has blurred it. */
      const size = w2 * (1.4 + bright * 2.4);
      const grad = g.createRadialGradient(px, py, 0, px, py, size);
      grad.addColorStop(0, pal.star);
      grad.addColorStop(0.25, pal.star);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.18 + bright * 0.34;
      g.fillStyle = grad;
      g.fillRect(px - size, py - size, size * 2, size * 2);
      g.globalAlpha = 1;
    }

    return faces.map((f) => f.c);
  };

  /* ---------------------------------------------------------------- widgets
   * Flat, not Minecrafty. Vanilla's buttons are a bevel: a light top edge, a
   * dark bottom one and a gradient between, which is what makes the menu look
   * like 2011. These are the launcher's buttons instead — one thin border, one
   * flat fill, and a left-hand accent bar on the hovered state to show focus
   * the way the launcher's own nav does.
   *
   * The regions are still fixed by the game and still have to be filled:
   *   (0,0,182,22)   hotbar
   *   (0,22,24,24)   selected-slot highlight
   *   (0,46,200,20)  button, disabled
   *   (0,66,200,20)  button, normal
   *   (0,86,200,20)  button, hovered
   * A button is stretched from the middle of its strip, so the left and right
   * ends are what show and the centre is smeared — which is why the accent is
   * a bar at the very edge rather than anything with detail in it.
   */
  NS.widgets = function (pal) {
    const { c, g } = cv(256, 256);
    g.clearRect(0, 0, 256, 256);

    const hex = (h) => h;
    /* Slightly transparent fills, so the sky behind the main menu shows
     * through the way a modern overlay would. */
    const fill = (x, y, w, h, colour, alpha) => {
      g.globalAlpha = alpha === undefined ? 1 : alpha;
      g.fillStyle = colour;
      g.fillRect(x, y, w, h);
      g.globalAlpha = 1;
    };

    /* --- hotbar: one flat bar, nine hairline cells --- */
    fill(0, 0, 182, 22, pal.void, 0.82);
    fill(0, 0, 182, 1, pal.line, 0.55);
    fill(0, 21, 182, 1, pal.line, 0.3);
    for (let i = 1; i < 9; i++) fill(1 + i * 20, 3, 1, 16, pal.line, 0.4);

    /* --- selected slot: a thin accent frame, nothing inside it --- */
    fill(0, 22, 24, 1, pal.accent);
    fill(0, 45, 24, 1, pal.accent);
    fill(0, 22, 1, 24, pal.accent);
    fill(23, 22, 1, 24, pal.accent);
    fill(1, 23, 22, 1, pal.accent, 0.3);
    fill(1, 44, 22, 1, pal.accent, 0.3);

    /* --- the three button states --- */
    const button = (y, opts) => {
      /* flat fill */
      fill(0, y, 200, 20, opts.fill, opts.alpha);
      /* one-pixel border, all four sides the same weight — no bevel */
      fill(0, y, 200, 1, opts.border, opts.borderAlpha);
      fill(0, y + 19, 200, 1, opts.border, opts.borderAlpha);
      fill(0, y, 1, 20, opts.border, opts.borderAlpha);
      fill(199, y, 1, 20, opts.border, opts.borderAlpha);
      /* the accent bar, at the left edge so stretching cannot smear it */
      if (opts.accent) fill(1, y + 1, 2, 18, opts.accent);
    };

    /* disabled: barely there */
    button(46, { fill: pal.void, alpha: 0.5, border: pal.line, borderAlpha: 0.28 });
    /* normal: the launcher's panel colour */
    button(66, { fill: pal.panel, alpha: 0.86, border: pal.line, borderAlpha: 0.6 });
    /* hovered: brighter, with the accent bar lit */
    button(86, { fill: pal.panel, alpha: 0.97, border: pal.accent, borderAlpha: 0.85, accent: pal.accent });

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
