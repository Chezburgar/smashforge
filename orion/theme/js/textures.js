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
      blurb: 'Silver on a night sky. The default.',
      void: '#04060c', bg: '#0a0f1a', panel: '#0f1726', line: '#33456b',
      accent: '#9fc0f0', accent2: '#6f8ab0',
      text: '#f2f6ff', dim: '#adbdd8', star: '#dce9ff',
      /* The sky is drawn behind a fixed white-to-nothing gradient the client
       * lays over it — see the note on NS.panorama — so near-black is the
       * right floor: it is the bottom two thirds of the screen that can
       * actually be dark. */
      sky0: '#080d18', sky1: '#03050a', cloud: '#1b2b4d', cloud2: '#122038'
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
   * The wordmark, and the one texture anybody actually looks at.
   *
   * Two things about it are the game's decision rather than ours:
   *
   *   1.8 blits the title from two halves of one sheet — (0,0,155,44) and then
   *   (0,45,155,44) placed beside it — so the wordmark is drawn once across a
   *   310-wide strip and cut down the middle. Nothing else produces letters
   *   that straddle the join.
   *
   *   Those numbers are texture units of a 256-wide sheet, not pixels. A
   *   bigger sheet is sampled in the same places and simply arrives sharper,
   *   so this draws at 4x: at 256, a wordmark that spans the screen is eleven
   *   pixels tall and looks it.
   */
  const TITLE_SCALE = 4;
  NS.TITLE_SCALE = TITLE_SCALE;
  const TITLE_FONT = (px, weight) =>
    weight + ' ' + px + 'px "Segoe UI", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif';

  NS.title = function (pal, word, subtitle) {
    const S = TITLE_SCALE;
    const text = (word || 'ORION CLIENT').toUpperCase().slice(0, 22);
    const sub = subtitle === undefined ? 'eaglercraft javascript runtime' : String(subtitle || '');

    const stripW = 310 * S;
    const stripH = 44 * S;
    const strip = cv(stripW, stripH);
    const g = strip.g;
    g.imageSmoothingEnabled = true;

    /* The lettering is drawn on its own layer first, then that layer is drawn
     * twice: once blurred for the glow, once sharp on top. Drawing a shadow
     * per character instead stacks the shadows where letters overlap, and what
     * should be a halo comes out as a row of solid blobs. */
    const layer = cv(stripW, stripH);
    const lg = layer.g;
    lg.imageSmoothingEnabled = true;
    lg.textBaseline = 'alphabetic';

    /* Fit the word, then space it out. Wide tracking is most of what reads as
     * modern, and it has to be applied by hand because canvas has no
     * letter-spacing everywhere. */
    let size = 30 * S;
    let track = Math.round(size * 0.06);
    const widthOf = (px, sp) => {
      lg.font = TITLE_FONT(px, '300');
      let w = 0;
      for (const ch of text) w += lg.measureText(ch).width + sp;
      return w - sp;
    };
    while (size > 8 * S && widthOf(size, track) > stripW - 24 * S) {
      size -= S;
      track = Math.round(size * 0.06);
    }

    const w = widthOf(size, track);
    const startX = Math.round((stripW - w) / 2);
    const baseline = Math.round(stripH * 0.62);

    /* Silver rather than flat white: a vertical ramp is what gives the letters
     * any weight at all at this size. */
    const silver = lg.createLinearGradient(0, baseline - size * 0.78, 0, baseline + size * 0.1);
    silver.addColorStop(0, '#ffffff');
    silver.addColorStop(0.55, pal.text);
    silver.addColorStop(1, pal.dim);

    lg.font = TITLE_FONT(size, '300');
    lg.fillStyle = silver;
    let x = startX;
    for (const ch of text) {
      lg.fillText(ch, x, baseline);
      x += lg.measureText(ch).width + track;
    }

    if (sub) {
      const subSize = Math.round(size * 0.34);
      const subTrack = Math.round(subSize * 0.04);
      lg.font = TITLE_FONT(subSize, '400');
      let total = 0;
      for (const ch of sub) total += lg.measureText(ch).width + subTrack;
      total -= subTrack;
      let sx = Math.round((stripW - total) / 2);
      const subBase = Math.min(stripH - 3 * S, baseline + Math.round(size * 0.46));
      lg.fillStyle = pal.dim;
      for (const ch of sub) {
        lg.fillText(ch, sx, subBase);
        sx += lg.measureText(ch).width + subTrack;
      }
    }

    /* Now the part that decides whether any of this is readable.
     *
     * The client lays a white gradient over the whole menu, strongest exactly
     * where the title sits — measured at about 43% at the top of the screen —
     * so the wordmark is drawn on light grey, not on the near-black sky. A
     * white halo would make that worse, and a dark plate behind the strip
     * comes out as a visible blob however softly it is faded, because the strip
     * is 310x44 and there is nowhere for the fade to go.
     *
     * What works is a shadow shaped like the letters themselves: the lettering
     * is turned into a black silhouette, blurred, and laid down before the
     * sharp copy. It darkens only what is right behind the strokes, follows
     * every curve, and has no edge of its own to see.
     */
    const shade = cv(stripW, stripH);
    const sg = shade.g;
    sg.drawImage(layer.c, 0, 0);
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = '#000000';
    sg.fillRect(0, 0, stripW, stripH);
    sg.globalCompositeOperation = 'source-over';

    const blur = (px) => (typeof g.filter === 'string' ? 'blur(' + Math.max(2, Math.round(px)) + 'px)' : 'none');

    /* Twice, at two radii: the wide pass darkens the area, the tight one puts
     * an edge back under the strokes. */
    g.save();
    g.globalAlpha = 0.3;
    g.filter = blur(size * 0.2);
    g.drawImage(shade.c, 0, 0);
    g.globalAlpha = 0.6;
    g.filter = blur(size * 0.06);
    g.drawImage(shade.c, 0, 0);
    g.restore();

    /* A whisper of light around the strokes, for the lit look the launcher's
     * own headings have. Kept low: on grey it is nearly invisible, and on the
     * dark half of the menu it is the whole effect. */
    g.save();
    g.globalAlpha = 0.3;
    g.filter = blur(size * 0.1);
    g.drawImage(layer.c, 0, 0);
    g.restore();

    g.drawImage(layer.c, 0, 0);

    const out = cv(256 * S, 256 * S);
    out.g.drawImage(strip.c, 0, 0, 155 * S, 44 * S, 0, 0, 155 * S, 44 * S);
    out.g.drawImage(strip.c, 155 * S, 0, 155 * S, 44 * S, 0, 45 * S, 155 * S, 44 * S);
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
      g.font = TITLE_FONT(px, weight);
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
    spaced(label, 24, '300', pal.text, 196);
    spaced('LOADING', 11, '400', pal.dim, 222);
    return c;
  };

  /* ----------------------------------------------------------- menu backdrop
   * A 16x16 tile, repeated across every screen that is not the main menu.
   * Vanilla's is dirt, which is why every Minecraft menu looks like the inside
   * of a hole. This is a near-flat wash with a very faint grid, so at menu
   * scale it reads as one calm surface rather than a texture.
   *
   * The client draws it dark. Measured rather than guessed: a tile of
   * #0a0f1a — rgb(10,15,26) — renders as rgb(3,4,7), so it arrives at about
   * 28% brightness. The tile is therefore painted roughly 3.5x lighter than
   * the colour wanted on screen, which is what stops the backdrop coming out
   * as flat black.
   */
  const DARKENED_TO = 0.28;

  function lift(hex, factor) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '#000000');
    if (!m) return hex;
    const up = (h) => Math.min(255, Math.round(parseInt(h, 16) * factor));
    return 'rgb(' + up(m[1]) + ',' + up(m[2]) + ',' + up(m[3]) + ')';
  }

  NS.background = function (pal, seed) {
    const { c, g } = cv(16, 16);
    const factor = 1 / DARKENED_TO;
    g.fillStyle = lift(pal.bg, factor);
    g.fillRect(0, 0, 16, 16);
    /* One hairline in each direction: enough to catch the light, not enough to
     * be a pattern. */
    g.globalAlpha = 0.14;
    g.fillStyle = lift(pal.panel, factor * 1.1);
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.globalAlpha = 0.12;
    g.fillStyle = lift(pal.void, factor * 0.6);
    g.fillRect(15, 0, 1, 16);
    g.fillRect(0, 15, 16, 1);
    g.globalAlpha = 1;
    return c;
  };

  /* --------------------------------------------------------------- panorama
   * The six faces of the skybox that turns behind the main menu: 0 north,
   * 1 east, 2 south, 3 west, 4 up, 5 down.
   *
   * What the client does to it was measured, not guessed: a pack of six pure
   * black faces was installed and the rendered menu sampled. The result, on a
   * 1280x800 window:
   *
   *     y = 80    rgb 109      y = 300   rgb 65
   *     y = 700   rgb 9        y = 760   rgb 3
   *
   * So the client lays a white-to-nothing vertical gradient over the skybox:
   * about 43% at the very top, gone by two thirds of the way down. (An earlier
   * version of this note said a dark sky was impossible. That was drawn from
   * one flat magenta test and was too broad — the wash is only at the top, and
   * the bottom two thirds of the screen are as dark as the texture is.
   * Blanking gui/title/background/panorama_overlay.png changes nothing, in
   * either direction: this build does not draw it.)
   *
   * So: near-black, with stars that survive the wash where it is weakest, and
   * one soft drift of nebula. The buttons sit in the dark half, which is what
   * matters most.
   */
  NS.panorama = function (pal, seed, size) {
    const n = size || 256;
    const faces = [];
    for (let i = 0; i < 6; i++) faces.push(cv(n, n));

    const sky0 = pal.sky0 || pal.bg;
    const sky1 = pal.sky1 || pal.void;

    for (let f = 0; f < 6; f++) {
      const g = faces[f].g;
      const rnd = rng((seed || 1) * 977 + f * 131 + 7);

      if (f < 4) {
        /* Sides: a shade lighter toward the horizon, so the sky has a
         * direction without ever leaving near-black. */
        const grad = g.createLinearGradient(0, 0, 0, n);
        grad.addColorStop(0, sky1);
        grad.addColorStop(0.52, sky0);
        grad.addColorStop(1, sky1);
        g.fillStyle = grad;
        g.fillRect(0, 0, n, n);
      } else {
        const grad = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n * 0.75);
        grad.addColorStop(0, f === 4 ? sky0 : sky1);
        grad.addColorStop(1, sky1);
        g.fillStyle = grad;
        g.fillRect(0, 0, n, n);
      }

      /* One drift of nebula per face, wide and faint. Anything with an edge is
       * lost to the blur, but a large soft blob survives as colour. */
      const cxs = [0.3, 0.72, 0.5, 0.2, 0.5, 0.5];
      const nb = g.createRadialGradient(
        n * cxs[f], n * (f === 4 ? 0.5 : 0.34), 0,
        n * cxs[f], n * (f === 4 ? 0.5 : 0.34), n * 0.62
      );
      nb.addColorStop(0, pal.cloud || sky0);
      nb.addColorStop(0.5, pal.cloud2 || sky0);
      nb.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = f === 5 ? 0.12 : 0.34;
      g.fillStyle = nb;
      g.fillRect(0, 0, n, n);
      g.globalAlpha = 1;

      /* Stars. Down gets fewer: it is the bottom of the screen, which is the
       * part the wash leaves alone, so a dense field there reads as noise. */
      const count = f === 5 ? 40 : 150;
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rnd() * n);
        const y = Math.floor(rnd() * n);
        const bright = 0.25 + rnd() * 0.75;
        g.fillStyle = pal.star || '#ffffff';
        g.globalAlpha = bright;
        g.fillRect(x, y, 1, 1);
        /* A handful are given a second pixel so a few stars read as brighter
         * rather than every one being identical. */
        if (bright > 0.9) {
          g.globalAlpha = bright * 0.5;
          g.fillRect(x + 1, y, 1, 1);
          g.fillRect(x, y + 1, 1, 1);
        }
      }
      g.globalAlpha = 1;
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
   * rules out anything with horizontal structure, and leaves a flat fill, a
   * one-pixel border and a single row of sheen.
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
      /* A single lighter row under the top border: enough to read as a
       * surface rather than a flat rectangle, not enough to be a gradient. */
      if (opts.sheen) fill(1, y + 1, 198, 1, opts.sheen, 0.28);
    };

    /* Translucent on purpose: the sky showing faintly through the fill is what
     * makes these read as glass laid over the menu rather than as grey slabs
     * stuck on it. */
    button(NS.BUTTON_ROWS.disabled, {
      fill: pal.void, alpha: 0.5, border: pal.line, borderAlpha: 0.28
    });
    button(NS.BUTTON_ROWS.normal, {
      fill: pal.panel, alpha: 0.72, border: pal.accent2, borderAlpha: 0.75, sheen: pal.accent2
    });
    button(NS.BUTTON_ROWS.hover, {
      fill: pal.panel, alpha: 0.88, border: pal.accent, borderAlpha: 1, sheen: pal.accent
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
