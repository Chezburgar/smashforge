/* SMASHFORGE — shared drawing primitives used by the body, cosmetic and FX renderers. */
(function (SB) {
  'use strict';
  const U = SB.U;
  const D = {};
  SB.D = D;

  D.lin = function (ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  };
  D.rad = function (ctx, x, y, r0, r1, stops, x1, y1) {
    const g = ctx.createRadialGradient(x, y, r0, x1 === undefined ? x : x1, y1 === undefined ? y : y1, r1);
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  };

  /* Tapered limb: a rounded trapezoid from p0 (w0 wide) to p1 (w1 wide),
     shaded across its axis so it reads as a cylinder. */
  D.limb = function (ctx, p0, p1, w0, w1, col, opt) {
    opt = opt || {};
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 0.0001;
    const nx = -dy / len, ny = dx / len;
    const a0 = { x: p0.x + nx * w0, y: p0.y + ny * w0 };
    const b0 = { x: p0.x - nx * w0, y: p0.y - ny * w0 };
    const a1 = { x: p1.x + nx * w1, y: p1.y + ny * w1 };
    const b1 = { x: p1.x - nx * w1, y: p1.y - ny * w1 };

    ctx.beginPath();
    ctx.moveTo(a0.x, a0.y);
    ctx.lineTo(a1.x, a1.y);
    ctx.arc(p1.x, p1.y, w1, Math.atan2(a1.y - p1.y, a1.x - p1.x), Math.atan2(b1.y - p1.y, b1.x - p1.x), true);
    ctx.lineTo(b0.x, b0.y);
    ctx.arc(p0.x, p0.y, w0, Math.atan2(b0.y - p0.y, b0.x - p0.x), Math.atan2(a0.y - p0.y, a0.x - p0.x), true);
    ctx.closePath();

    const shadeDir = opt.flip ? -1 : 1;
    ctx.fillStyle = D.lin(ctx,
      p0.x + nx * w0 * shadeDir, p0.y + ny * w0 * shadeDir,
      p0.x - nx * w0 * shadeDir, p0.y - ny * w0 * shadeDir,
      [[0, U.shade(col, 0.30)], [0.42, col], [1, U.shade(col, -0.42)]]);
    ctx.fill();

    if (opt.edge) {
      ctx.lineWidth = opt.edgeW || 1.4;
      ctx.strokeStyle = opt.edge;
      ctx.stroke();
    }
    if (opt.rim) {
      ctx.save();
      ctx.clip();
      ctx.lineWidth = (opt.rimW || 2.2);
      ctx.strokeStyle = opt.rim;
      ctx.globalAlpha = opt.rimA === undefined ? 0.55 : opt.rimA;
      ctx.beginPath();
      ctx.moveTo(a0.x, a0.y); ctx.lineTo(a1.x, a1.y);
      ctx.stroke();
      ctx.restore();
    }
  };

  D.capsule = function (ctx, p0, p1, w) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 0.0001;
    const nx = -dy / len * w, ny = dx / len * w;
    ctx.beginPath();
    ctx.moveTo(p0.x + nx, p0.y + ny);
    ctx.lineTo(p1.x + nx, p1.y + ny);
    ctx.arc(p1.x, p1.y, w, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
    ctx.lineTo(p0.x - nx, p0.y - ny);
    ctx.arc(p0.x, p0.y, w, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
    ctx.closePath();
  };

  /* Smooth closed blob through points, used for hair, capes, cloth. */
  D.blob = function (ctx, pts) {
    if (pts.length < 3) return;
    ctx.beginPath();
    const n = pts.length;
    let mx = (pts[n - 1][0] + pts[0][0]) / 2, my = (pts[n - 1][1] + pts[0][1]) / 2;
    ctx.moveTo(mx, my);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  };

  /* Ribbon strip along a point list with varying width — capes, trails, hair. */
  D.ribbon = function (ctx, pts, w0, w1) {
    if (pts.length < 2) return;
    const L = [], R = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = U.lerp(w0, w1, i / (pts.length - 1));
      L.push([p[0] - dy * w, p[1] + dx * w]);
      R.push([p[0] + dy * w, p[1] - dx * w]);
    }
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
  };

  D.spike = function (ctx, x, y, a, len, w) {
    const cx = Math.cos(a), cy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x + cx * len, y + cy * len);
    ctx.lineTo(x - cy * w, y + cx * w);
    ctx.lineTo(x + cy * w, y - cx * w);
    ctx.closePath();
  };

  D.shard = function (ctx, x, y, a, len, w) {
    const cx = Math.cos(a), cy = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x + cx * len, y + cy * len);
    ctx.lineTo(x - cy * w + cx * len * 0.35, y + cx * w + cy * len * 0.35);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cy * w + cx * len * 0.35, y - cx * w + cy * len * 0.35);
    ctx.closePath();
  };

  D.ring = function (ctx, x, y, r, w) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, U.TAU);
    ctx.arc(x, y, Math.max(0.1, r - w), 0, U.TAU, true);
    ctx.closePath();
  };

  D.plate = function (ctx, x, y, w, h, r, col, glowCol) {
    U.roundRect(ctx, x - w / 2, y - h / 2, w, h, r);
    ctx.fillStyle = D.lin(ctx, x, y - h / 2, x, y + h / 2,
      [[0, U.shade(col, 0.32)], [0.5, col], [1, U.shade(col, -0.38)]]);
    ctx.fill();
    if (glowCol) {
      ctx.strokeStyle = glowCol; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.7; ctx.stroke(); ctx.globalAlpha = 1;
    }
  };
})(window.SB);
