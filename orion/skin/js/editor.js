/* ORION SKIN — the pixel editor's model
 *
 * Holds the 64x64 sheet, the tools that change it, and the undo stack. Knows
 * nothing about the DOM, so the same state can drive the grid, the 3D preview
 * and the exporter without any of them disagreeing.
 *
 * The sheet lives in a canvas rather than a typed array because everything
 * downstream wants a canvas anyway: the preview textures from it and the
 * exporter calls toBlob on it.
 */
window.ORION_SKIN = window.ORION_SKIN || {};
(function (NS) {
  'use strict';

  const E = {};
  NS.Editor = E;

  const SIZE = NS.SHEET;
  const MAX_UNDO = 60;

  let canvas = null;
  let ctx = null;
  let undo = [];
  let redo = [];
  let version = 0;

  E.size = SIZE;
  E.canvas = () => canvas;
  E.version = () => version;
  E.canUndo = () => undo.length > 0;
  E.canRedo = () => redo.length > 0;

  E.init = function () {
    canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    E.reset();
    return canvas;
  };

  /* ------------------------------------------------------------- history */

  function snapshot() {
    return ctx.getImageData(0, 0, SIZE, SIZE);
  }

  /* Called before a change, so a stroke records the state it started from. */
  E.mark = function () {
    undo.push(snapshot());
    if (undo.length > MAX_UNDO) undo.shift();
    redo.length = 0;
  };

  E.undo = function () {
    if (!undo.length) return false;
    redo.push(snapshot());
    ctx.putImageData(undo.pop(), 0, 0);
    version++;
    return true;
  };

  E.redo = function () {
    if (!redo.length) return false;
    undo.push(snapshot());
    ctx.putImageData(redo.pop(), 0, 0);
    version++;
    return true;
  };

  /* --------------------------------------------------------------- pixels */

  E.get = function (x, y) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  };

  E.hexAt = function (x, y) {
    const p = E.get(x, y);
    if (!p || p.a === 0) return null;
    const h = (v) => v.toString(16).padStart(2, '0');
    return '#' + h(p.r) + h(p.g) + h(p.b);
  };

  E.set = function (x, y, hex, alpha) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    ctx.clearRect(x, y, 1, 1);
    if (hex !== null) {
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, 1, 1);
      ctx.globalAlpha = 1;
    }
    version++;
  };

  E.erase = (x, y) => E.set(x, y, null);

  /* Flood fill within one face. Stopping at the face boundary is deliberate:
   * the sheet's neighbouring rectangles are unrelated parts of the body, so a
   * fill that leaked across would ruin an arm while painting a leg. */
  E.fill = function (x, y, hex) {
    const face = NS.at(x, y);
    const bx = face ? face.x : 0, by = face ? face.y : 0;
    const bw = face ? face.w : SIZE, bh = face ? face.h : SIZE;

    const img = ctx.getImageData(bx, by, bw, bh);
    const d = img.data;
    const at = (px, py) => ((py - by) * bw + (px - bx)) * 4;

    const start = at(x, y);
    const target = [d[start], d[start + 1], d[start + 2], d[start + 3]];

    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return;
    const n = parseInt(m[1], 16);
    const rep = [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    if (target.every((v, i) => v === rep[i])) return;

    const same = (i) => d[i] === target[0] && d[i + 1] === target[1] && d[i + 2] === target[2] && d[i + 3] === target[3];
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < bx || cy < by || cx >= bx + bw || cy >= by + bh) continue;
      const i = at(cx, cy);
      if (!same(i)) continue;
      d[i] = rep[0]; d[i + 1] = rep[1]; d[i + 2] = rep[2]; d[i + 3] = rep[3];
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    ctx.putImageData(img, bx, by);
    version++;
  };

  /* ------------------------------------------------------- whole-sheet ops */

  E.clear = function () {
    ctx.clearRect(0, 0, SIZE, SIZE);
    version++;
  };

  /* A plain starting body, generated rather than shipped: Mojang's own skins
   * are not ours to include. Flat colours with a little per-pixel variation so
   * it does not look like painted plastic. */
  E.reset = function () {
    const SKIN = '#c98d6b', SKIN_D = '#b87d5d';
    const HAIR = '#4b3621';
    const SHIRT = '#5b6ee1', SHIRT_D = '#4a5bc4';
    const TROUSER = '#3b4a6b', TROUSER_D = '#32405c';
    const SHOE = '#4a3b32';
    const EYE = '#2b2b3a', EYE_W = '#e8e8f0';

    E.clear();

    const box = (id, top, side, front) => {
      const p = NS.part(id);
      if (!p) return;
      paint(p.uv.top, top);
      paint(p.uv.bottom, top);
      paint(p.uv.right, side);
      paint(p.uv.left, side);
      paint(p.uv.back, side);
      paint(p.uv.front, front == null ? side : front);
    };

    function paint(rect, hex) {
      for (let y = 0; y < rect.h; y++) {
        for (let x = 0; x < rect.w; x++) {
          /* A stable, seeded wobble: same skin every time, no RNG drift. */
          const n = ((rect.x + x) * 73856093 ^ (rect.y + y) * 19349663) & 7;
          E.set(rect.x + x, rect.y + y, n === 0 ? shade(hex, -8) : n === 1 ? shade(hex, 6) : hex);
        }
      }
    }

    function shade(hex, by) {
      const n = parseInt(hex.slice(1), 16);
      const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, v + by)));
      return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
    }

    box('head', HAIR, SKIN, SKIN);
    box('body', SHIRT, SHIRT, SHIRT_D);
    box('armR', SKIN, SKIN, SKIN_D);
    box('armL', SKIN, SKIN, SKIN_D);
    box('legR', TROUSER, TROUSER, TROUSER_D);
    box('legL', TROUSER, TROUSER, TROUSER_D);

    /* Boots and a hairline, so the starting body reads as dressed. */
    const foot = (id) => {
      const p = NS.part(id);
      ['front', 'back', 'left', 'right'].forEach(function (f) {
        const r = p.uv[f];
        for (let y = r.h - 3; y < r.h; y++) {
          for (let x = 0; x < r.w; x++) E.set(r.x + x, r.y + y, SHOE);
        }
      });
      paint(p.uv.bottom, SHOE);
    };
    foot('legR');
    foot('legL');

    /* Hair wraps the whole head, not just the face — a band across every side
     * face plus the crown. Painting only the front leaves the character bald
     * from every other angle, which is exactly the sort of thing the 3D
     * preview is there to catch. */
    const head = NS.part('head');
    paint(head.uv.top, HAIR);
    ['front', 'back', 'left', 'right'].forEach(function (f) {
      const r = head.uv[f];
      for (let x = 0; x < r.w; x++) {
        for (let y = 0; y < 2; y++) E.set(r.x + x, r.y + y, HAIR);
      }
    });
    /* A slightly longer fringe at the back. */
    const hb = head.uv.back;
    for (let x = 0; x < hb.w; x++) E.set(hb.x + x, hb.y + 2, HAIR);

    const hf = head.uv.front;
    /* Eyes, two pixels each with a white inside edge. */
    [[2, 3], [5, 3]].forEach(function (e, i) {
      E.set(hf.x + e[0], hf.y + e[1], i === 0 ? EYE_W : EYE);
      E.set(hf.x + e[0] + 1, hf.y + e[1], i === 0 ? EYE : EYE_W);
    });
    /* Mouth. */
    for (let x = 3; x < 5; x++) E.set(hf.x + x, hf.y + 6, shade(SKIN, -30));

    undo.length = 0;
    redo.length = 0;
    version++;
  };

  /* Load a PNG the player already has. A 64x32 legacy skin is placed in the
   * top half and its missing left limbs are mirrored from the right, which is
   * what the old format meant implicitly. */
  E.loadImage = function (img) {
    if (!img || !img.width) return { ok: false, error: 'That image could not be read.' };
    const w = img.width, h = img.height;
    const legacy = (w === 64 && h === 32);
    if (!(w === 64 && (h === 64 || h === 32))) {
      return { ok: false, error: 'A skin must be 64x64, or 64x32 for an old one. That image is ' + w + 'x' + h + '.' };
    }
    E.mark();
    E.clear();
    ctx.drawImage(img, 0, 0);

    if (legacy) {
      /* Mirror right limbs into the left ones the old format did not store. */
      mirrorLimb('armR', 'armL');
      mirrorLimb('legR', 'legL');
    }
    version++;
    return { ok: true, legacy: legacy };
  };

  function mirrorLimb(fromId, toId) {
    const a = NS.part(fromId), b = NS.part(toId);
    /* left/right swap as well as the flip, or the limb comes out inside-out. */
    const pairs = [['front', 'front'], ['back', 'back'], ['top', 'top'], ['bottom', 'bottom'], ['right', 'left'], ['left', 'right']];
    pairs.forEach(function ([fa, fb]) {
      const src = a.uv[fa], dst = b.uv[fb];
      const img = ctx.getImageData(src.x, src.y, src.w, src.h);
      const out = ctx.createImageData(dst.w, dst.h);
      for (let y = 0; y < dst.h; y++) {
        for (let x = 0; x < dst.w; x++) {
          const sx = src.w - 1 - x;
          const si = (y * src.w + sx) * 4;
          const di = (y * dst.w + x) * 4;
          out.data[di] = img.data[si];
          out.data[di + 1] = img.data[si + 1];
          out.data[di + 2] = img.data[si + 2];
          out.data[di + 3] = img.data[si + 3];
        }
      }
      ctx.putImageData(out, dst.x, dst.y);
    });
  }

  E.toBlob = function (cb) {
    canvas.toBlob(cb, 'image/png');
  };

  E.toDataURL = () => canvas.toDataURL('image/png');
})(window.ORION_SKIN);
