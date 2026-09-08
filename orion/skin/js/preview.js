/* ORION SKIN — 3D preview
 *
 * Draws the skin on the actual body, because a skin sheet tells you almost
 * nothing about how it will look: the faces are scattered across the sheet and
 * four of the six on every box are mirrored or rotated relative to how you
 * read them flat.
 *
 * No 3D library. Under an orthographic camera the projection of a flat
 * rectangle is a parallelogram, and mapping a rectangle onto a parallelogram is
 * exactly what a 2D affine transform does — so each face is one transformed
 * drawImage of its region of the sheet. Faces pointing away are dropped by the
 * sign of their projected area, and the rest are painted far to near.
 */
window.ORION_SKIN = window.ORION_SKIN || {};
(function (NS) {
  'use strict';

  const P = {};
  NS.Preview = P;

  /* Corner of each face at texture (0,0), and the directions u and v run in.
   * Derived from the sheet's layout: right, front, left and back form one
   * continuous band around the box, so each face's u=max edge is the next
   * face's u=0 edge. Getting one of these wrong shows up instantly as a seam
   * or a mirrored feature, which is the point of drawing this at all. */
  const FACE = {
    top:    { o: ['x0', 'y1', 'z0'], u: [1, 0, 0],  v: [0, 0, 1]  },
    bottom: { o: ['x0', 'y0', 'z1'], u: [1, 0, 0],  v: [0, 0, -1] },
    right:  { o: ['x0', 'y1', 'z0'], u: [0, 0, 1],  v: [0, -1, 0] },
    front:  { o: ['x0', 'y1', 'z1'], u: [1, 0, 0],  v: [0, -1, 0] },
    left:   { o: ['x1', 'y1', 'z1'], u: [0, 0, -1], v: [0, -1, 0] },
    back:   { o: ['x1', 'y1', 'z0'], u: [-1, 0, 0], v: [0, -1, 0] }
  };

  function boxOf(part) {
    const [w, h, d] = part.size;
    const [ox, oy, oz] = part.origin;
    const g = part.inflate || 0;
    return {
      x0: ox - w / 2 - g, x1: ox + w / 2 + g,
      y0: oy - g,         y1: oy + h + g,
      z0: oz - d / 2 - g, z1: oz + d / 2 + g
    };
  }

  /* yaw about the vertical, then pitch, then straight orthographic. */
  function project(p, yaw, pitch, scale, cx, cy) {
    const cy_ = Math.cos(yaw), sy = Math.sin(yaw);
    const x1 = p[0] * cy_ - p[2] * sy;
    const z1 = p[0] * sy + p[2] * cy_;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const y2 = p[1] * cp - z1 * sp;
    const z2 = p[1] * sp + z1 * cp;
    return { x: cx + x1 * scale, y: cy - y2 * scale, depth: z2 };
  }

  /* Shading is baked into copies of the whole sheet rather than painted over
   * each face. Painting per face would darken whatever was already drawn
   * beneath it, and on a transparent overlay pixel it would leave a dark
   * rectangle where there should be nothing. Compositing 'source-atop' onto a
   * copy of the sheet keeps the tint exactly where the sheet is opaque. */
  let shadeCache = { key: null, levels: {} };

  function shaded(sheet, level, key) {
    if (level >= 1) return sheet;
    if (shadeCache.key !== key) shadeCache = { key: key, levels: {} };
    const tag = level.toFixed(3);
    if (shadeCache.levels[tag]) return shadeCache.levels[tag];

    const c = document.createElement('canvas');
    c.width = sheet.width;
    c.height = sheet.height;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    cx.drawImage(sheet, 0, 0);
    cx.globalCompositeOperation = 'source-atop';
    cx.fillStyle = 'rgba(0,0,0,' + (1 - level).toFixed(3) + ')';
    cx.fillRect(0, 0, c.width, c.height);
    shadeCache.levels[tag] = c;
    return c;
  }

  /* opts: { yaw, pitch, scale, showOverlays, wide, parts, version } */
  P.draw = function (ctx, sheet, opts) {
    const o = opts || {};
    const yaw = o.yaw || 0;
    const pitch = o.pitch || 0;
    const cv = ctx.canvas;
    const w = cv.width, h = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    /* The model is 32 units tall; leave a margin. */
    const scale = o.scale || Math.min(w / 24, h / 40);
    const cx = w / 2;
    const cy = h / 2 + 16 * scale;

    const quads = [];
    NS.PARTS.forEach(function (part) {
      if (part.overlay && o.showOverlays === false) return;
      if (part.wide && o.wide === false) return;
      if (o.parts && o.parts.indexOf(part.id) < 0) return;
      const b = boxOf(part);

      Object.keys(part.uv).forEach(function (faceName) {
        const f = FACE[faceName];
        const rect = part.uv[faceName];
        const origin = [b[f.o[0]], b[f.o[1]], b[f.o[2]]];

        /* Face extent in world units along u and v. */
        const uLen = Math.abs(f.u[0]) * (b.x1 - b.x0) + Math.abs(f.u[1]) * (b.y1 - b.y0) + Math.abs(f.u[2]) * (b.z1 - b.z0);
        const vLen = Math.abs(f.v[0]) * (b.x1 - b.x0) + Math.abs(f.v[1]) * (b.y1 - b.y0) + Math.abs(f.v[2]) * (b.z1 - b.z0);

        const p0 = origin;
        const p1 = [origin[0] + f.u[0] * uLen, origin[1] + f.u[1] * uLen, origin[2] + f.u[2] * uLen];
        const p3 = [origin[0] + f.v[0] * vLen, origin[1] + f.v[1] * vLen, origin[2] + f.v[2] * vLen];
        const p2 = [p1[0] + p3[0] - p0[0], p1[1] + p3[1] - p0[1], p1[2] + p3[2] - p0[2]];

        const a = project(p0, yaw, pitch, scale, cx, cy);
        const bb = project(p1, yaw, pitch, scale, cx, cy);
        const c = project(p2, yaw, pitch, scale, cx, cy);
        const d = project(p3, yaw, pitch, scale, cx, cy);

        /* Signed area: negative means we are looking at its back. */
        const area = (bb.x - a.x) * (d.y - a.y) - (d.x - a.x) * (bb.y - a.y);
        if (area <= 0) return;

        quads.push({
          depth: (a.depth + bb.depth + c.depth + d.depth) / 4,
          rect: rect,
          a: a, b: bb, d: d,
          /* Flat faces catch less light; a touch of shading makes the shape
           * legible without a real light model. */
          shade: faceName === 'top' ? 1 : faceName === 'bottom' ? 0.62
               : (faceName === 'front' || faceName === 'back') ? 0.88 : 0.76
        });
      });
    });

    quads.sort((x, y) => x.depth - y.depth);

    const key = (o.version == null ? 0 : o.version) + 'x' + sheet.width;
    quads.forEach(function (q) {
      const ux = (q.b.x - q.a.x) / q.rect.w, uy = (q.b.y - q.a.y) / q.rect.w;
      const vx = (q.d.x - q.a.x) / q.rect.h, vy = (q.d.y - q.a.y) / q.rect.h;
      ctx.setTransform(ux, uy, vx, vy, q.a.x, q.a.y);
      ctx.drawImage(shaded(sheet, q.shade, key), q.rect.x, q.rect.y, q.rect.w, q.rect.h, 0, 0, q.rect.w, q.rect.h);
    });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  };
})(window.ORION_SKIN);
