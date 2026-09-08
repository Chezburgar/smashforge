/* ORION DISC PRINTER — the label on the disc
 *
 * A music disc is a 16x16 item texture: a black ring with a coloured centre.
 * Vanilla ships twelve of them and they are told apart only by that colour, so
 * a pack that replaces the sound and leaves the picture alone gives you twelve
 * identical-looking discs playing different things.
 *
 * These are drawn instead of shipped: each track gets a label colour from its
 * mood, a groove pattern from its seed, and a small mark in the middle, so the
 * discs in your inventory are distinguishable at a glance. 16x16 is small
 * enough that every pixel has to be deliberate — everything below works in
 * whole pixels, with no anti-aliasing anywhere.
 */
window.ORION_DISCS = window.ORION_DISCS || {};
(function (NS) {
  'use strict';

  /* Label colours, keyed by mood. Chosen to stay apart from each other at
   * 16 pixels and to read against the dark ring. */
  const PALETTE = {
    nebula:    ['#8f6bff', '#c9b4ff'],
    orbit:     ['#37b6ff', '#b7e8ff'],
    deepfield: ['#2f7a6b', '#8ff0d8'],
    pulsar:    ['#ff5d8f', '#ffc2d4'],
    driftwood: ['#d99a3f', '#ffe1a8'],
    custom:    ['#9d7bff', '#dccdff']
  };
  NS.PALETTE = PALETTE;

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a ^= a << 13; a >>>= 0;
      a ^= a >> 17;
      a ^= a << 5; a >>>= 0;
      return a / 4294967296;
    };
  }

  /* Distance from the centre of a 16x16 grid, measured between pixel centres
   * so the ring comes out even rather than one pixel fat on one side. */
  function dist(x, y) {
    const dx = x - 7.5, dy = y - 7.5;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* mark: 0 none, 1 dot, 2 cross, 3 bar — a shape stamped in the label so two
   * discs with similar colours are still not the same picture. */
  NS.disc = function (opts) {
    const pal = PALETTE[opts.mood] || PALETTE.custom;
    const label = opts.color || pal[0];
    const shine = opts.shine || pal[1];
    const r = rng(opts.seed);
    const mark = opts.mark === undefined ? Math.floor(r() * 4) : opts.mark;

    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 16, 16);

    const px = (x, y, fill) => { g.fillStyle = fill; g.fillRect(x, y, 1, 1); };

    /* The vinyl: a dark disc with two lighter grooves, and one bright pixel
     * where the light catches it. */
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = dist(x, y);
        if (d > 7.4) continue;
        if (d > 6.6) px(x, y, '#0d0d12');
        else if (d > 6.1) px(x, y, '#23232e');
        else if (d > 5.4) px(x, y, '#15151d');
        else if (d > 4.7) px(x, y, '#262633');
        else if (d > 3.2) px(x, y, '#16161f');
        else px(x, y, label);
      }
    }

    /* Grooves: two arcs of slightly lighter pixels, placed from the seed. */
    const spokes = 2 + Math.floor(r() * 3);
    for (let i = 0; i < spokes; i++) {
      const ang = r() * Math.PI * 2;
      for (let d = 4.9; d < 7.1; d += 0.5) {
        const x = Math.round(7.5 + Math.cos(ang) * d);
        const y = Math.round(7.5 + Math.sin(ang) * d);
        if (x >= 0 && x < 16 && y >= 0 && y < 16 && dist(x, y) <= 7.4) px(x, y, '#33333f');
      }
    }

    /* The label mark, then the spindle hole. */
    if (mark === 1) { px(7, 5, shine); px(8, 5, shine); }
    if (mark === 2) { px(6, 6, shine); px(9, 9, shine); px(9, 6, shine); px(6, 9, shine); }
    if (mark === 3) { for (let x = 5; x <= 10; x++) px(x, 5, shine); }
    px(7, 7, '#07070a'); px(8, 7, '#07070a'); px(7, 8, '#07070a'); px(8, 8, '#07070a');
    px(5, 3, '#ffffff');

    return c;
  };

  /* pack.png, the picture a resource pack shows next to its own name. 64x64,
   * one big disc on the Orion background. */
  NS.packIcon = function (opts) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 64, 64);
    bg.addColorStop(0, '#150f2b');
    bg.addColorStop(1, '#070812');
    g.fillStyle = bg;
    g.fillRect(0, 0, 64, 64);

    const disc = NS.disc(opts);
    g.imageSmoothingEnabled = false;
    g.drawImage(disc, 4, 4, 56, 56);
    return c;
  };

  NS.toPng = function (canvas) {
    return new Promise((res, rej) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return rej(new Error('The picture could not be encoded.'));
        res(new Uint8Array(await blob.arrayBuffer()));
      }, 'image/png');
    });
  };
})(window.ORION_DISCS);

/* ORION DISC PRINTER — the printer itself, as a block
 *
 * A resource pack cannot add a block. Blocks are code: a registry entry, a
 * model, a state, an item form, and network ids that both sides agree on. The
 * client is compiled and signed, so there is nowhere to put any of that.
 *
 * What a pack *can* do is change what an existing block looks like and what it
 * is called. The jukebox is already the disc machine — it is the thing you put
 * a record into — so it is retextured into an Orion Disc Printer and renamed.
 * That is a real block in the world, in your hand and in the creative
 * inventory, and it plays the discs this page prints. It is a reskin of the
 * jukebox and the page says so; what it is not is a thirteenth block.
 */
(function (NS) {
  'use strict';

  /* The three textures a 1.8 jukebox uses. `top` is the face with the slot in
   * it, `side` wraps the other four, and the bottom reuses the side. */
  NS.printerBlock = function (opts) {
    const pal = (NS.PALETTE[opts && opts.mood] || NS.PALETTE.custom);
    const accent = (opts && opts.color) || pal[0];
    const shine = (opts && opts.shine) || pal[1];

    const make = () => {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      return { c: c, g: g };
    };
    const px = (g, x, y, w, h, fill) => { g.fillStyle = fill; g.fillRect(x, y, w, h); };

    /* Casing colours, dark enough that the accent reads against them. */
    const CASE = '#1a1630';
    const CASE_HI = '#2a2450';
    const CASE_LO = '#0d0b1a';
    const METAL = '#3b3560';

    /* --- side: a panel with a vent, a status light and a disc slot --- */
    const side = make();
    px(side.g, 0, 0, 16, 16, CASE);
    px(side.g, 0, 0, 16, 1, CASE_HI);
    px(side.g, 0, 15, 16, 1, CASE_LO);
    px(side.g, 0, 0, 1, 16, CASE_HI);
    px(side.g, 15, 0, 1, 16, CASE_LO);
    /* the slot a disc goes into */
    px(side.g, 3, 5, 10, 2, '#05050a');
    px(side.g, 3, 5, 10, 1, METAL);
    /* vents */
    for (let y = 9; y <= 13; y += 2) {
      px(side.g, 3, y, 10, 1, CASE_LO);
      px(side.g, 3, y + 1, 10, 1, METAL);
    }
    /* status light, on */
    px(side.g, 12, 2, 2, 2, accent);
    px(side.g, 12, 2, 1, 1, shine);

    /* --- top: the platter, seen from above --- */
    const top = make();
    px(top.g, 0, 0, 16, 16, CASE);
    px(top.g, 0, 0, 16, 1, CASE_HI);
    px(top.g, 0, 15, 16, 1, CASE_LO);
    px(top.g, 0, 0, 1, 16, CASE_HI);
    px(top.g, 15, 0, 1, 16, CASE_LO);
    /* recessed well */
    px(top.g, 2, 2, 12, 12, CASE_LO);
    px(top.g, 3, 3, 10, 10, '#07070d');
    /* the record on the platter */
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = y - 7.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 4.6) continue;
        if (d > 4.0) px(top.g, x, y, 1, 1, '#15151d');
        else if (d > 3.2) px(top.g, x, y, 1, 1, '#23232e');
        else if (d > 2.2) px(top.g, x, y, 1, 1, '#15151d');
        else px(top.g, x, y, 1, 1, accent);
      }
    }
    px(top.g, 7, 7, 2, 2, '#05050a');
    /* a corner mark so the block reads as machinery rather than a hole */
    px(top.g, 13, 13, 2, 2, METAL);
    px(top.g, 13, 13, 1, 1, shine);

    return { side: side.c, top: top.c };
  };
})(window.ORION_DISCS);
