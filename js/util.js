/* SMASHFORGE — core math, color, rng utilities */
window.SB = window.SB || {};
(function (SB) {
  'use strict';
  const U = {};
  SB.U = U;

  const TAU = Math.PI * 2;
  U.TAU = TAU;
  U.PI = Math.PI;

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.remap = (v, a, b, c, d) => U.lerp(c, d, U.sat(U.inv(a, b, v)));
  U.sign = (v) => (v < 0 ? -1 : 1);
  U.rad = (d) => (d * Math.PI) / 180;
  U.deg = (r) => (r * 180) / Math.PI;
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  U.dist2 = (x1, y1, x2, y2) => (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);

  /* ---- easing ---- */
  U.smooth = (t) => { t = U.sat(t); return t * t * (3 - 2 * t); };
  U.smoother = (t) => { t = U.sat(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  U.easeOut = (t) => 1 - Math.pow(1 - U.sat(t), 3);
  U.easeOut2 = (t) => 1 - Math.pow(1 - U.sat(t), 2);
  U.easeOut5 = (t) => 1 - Math.pow(1 - U.sat(t), 5);
  U.easeIn = (t) => { t = U.sat(t); return t * t * t; };
  U.easeIn2 = (t) => { t = U.sat(t); return t * t; };
  U.easeInOut = (t) => { t = U.sat(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  U.easeBack = (t) => { t = U.sat(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  U.easeElastic = (t) => {
    t = U.sat(t);
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  };
  U.approach = (cur, tgt, step) => (cur < tgt ? Math.min(cur + step, tgt) : Math.max(cur - step, tgt));
  U.damp = (cur, tgt, lambda, dt) => U.lerp(cur, tgt, 1 - Math.exp(-lambda * dt));
  U.wrapAngle = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  U.lerpAngle = (a, b, t) => a + U.wrapAngle(b - a) * t;

  /* ---- deterministic rng ---- */
  U.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = function (str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  U.rngFor = (seed) => U.mulberry32(U.hash(seed));
  U.pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];
  U.rr = (r, a, b) => a + r() * (b - a);
  U.ri = (r, a, b) => Math.floor(a + r() * (b - a + 1));
  U.shuffle = (arr, r) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  U.uid = (() => { let n = 0; return () => ++n; })();

  /* ---- color ---- */
  function h2n(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const v = parseInt(h, 16);
    return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
  }
  U.h2n = h2n;
  U.n2h = (r, g, b) =>
    '#' + ((1 << 24) + (U.clamp(Math.round(r), 0, 255) << 16) + (U.clamp(Math.round(g), 0, 255) << 8) + U.clamp(Math.round(b), 0, 255)).toString(16).slice(1);

  U.shade = function (hex, amt) {
    const c = h2n(hex);
    if (amt >= 0) return U.n2h(c.r + (255 - c.r) * amt, c.g + (255 - c.g) * amt, c.b + (255 - c.b) * amt);
    return U.n2h(c.r * (1 + amt), c.g * (1 + amt), c.b * (1 + amt));
  };
  U.mixHex = function (a, b, t) {
    const x = h2n(a), y = h2n(b);
    return U.n2h(U.lerp(x.r, y.r, t), U.lerp(x.g, y.g, t), U.lerp(x.b, y.b, t));
  };
  U.rgba = function (hex, a) {
    const c = h2n(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  };
  U.lum = function (hex) { const c = h2n(hex); return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255; };
  U.hsl = (h, s, l, a) => 'hsla(' + (((h % 360) + 360) % 360) + ',' + s + '%,' + l + '%,' + (a === undefined ? 1 : a) + ')';

  U.hsl2hex = function (h, s, l) {
    h = (((h % 360) + 360) % 360) / 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hk = (t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hk(h + 1 / 3); g = hk(h); b = hk(h - 1 / 3);
    }
    return U.n2h(r * 255, g * 255, b * 255);
  };

  U.rgb2hsl = function (hex) {
    const c = h2n(hex);
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s * 100, l: l * 100 };
  };
  U.rotateHue = function (hex, deg, satMul, lumAdd) {
    const c = U.rgb2hsl(hex);
    return U.hsl2hex(c.h + deg, U.clamp(c.s * (satMul === undefined ? 1 : satMul), 0, 100), U.clamp(c.l + (lumAdd || 0), 0, 100));
  };

  /* ---- geometry ---- */
  U.circleRect = function (cx, cy, r, rx, ry, rw, rh) {
    const nx = U.clamp(cx, rx, rx + rw), ny = U.clamp(cy, ry, ry + rh);
    return U.dist2(cx, cy, nx, ny) <= r * r;
  };
  U.circles = (x1, y1, r1, x2, y2, r2) => U.dist2(x1, y1, x2, y2) <= (r1 + r2) * (r1 + r2);
  U.rects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  /* circle vs vertical capsule — hurtbox test. (px,py) is the FOOT point. */
  U.circleCapsule = function (cx, cy, cr, px, py, ph, pr) {
    const ty = U.clamp(cy, py - ph, py);
    return U.dist2(cx, cy, px, ty) <= (cr + pr) * (cr + pr);
  };

  /* ---- canvas helpers ---- */
  U.roundRect = function (ctx, x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  U.star = function (ctx, x, y, spikes, outer, inner, rot) {
    ctx.beginPath();
    let a = rot === undefined ? -Math.PI / 2 : rot;
    const step = Math.PI / spikes;
    ctx.moveTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
    for (let i = 0; i < spikes; i++) {
      a += step; ctx.lineTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner);
      a += step; ctx.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer);
    }
    ctx.closePath();
  };
  U.poly = function (ctx, pts, close) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); }
    if (close !== false) ctx.closePath();
  };
  /* Catmull-Rom smoothed polyline */
  U.smoothPath = function (ctx, pts) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i > 0 ? i - 1 : 0], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      for (let s = 1; s <= 6; s++) {
        const t = s / 6, t2 = t * t, t3 = t2 * t;
        const x = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        const y = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        ctx.lineTo(x, y);
      }
    }
  };
  U.text = function (ctx, str, x, y, opt) {
    opt = opt || {};
    ctx.save();
    ctx.font = (opt.weight || 800) + ' ' + (opt.size || 16) + 'px ' + (opt.font || 'Rajdhani, "Segoe UI", system-ui, sans-serif');
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.base || 'alphabetic';
    if (opt.letter !== undefined) { try { ctx.letterSpacing = opt.letter; } catch (e) { /* older browsers */ } }
    if (opt.shadow) { ctx.shadowColor = opt.shadow; ctx.shadowBlur = opt.blur || 10; }
    if (opt.stroke) { ctx.lineWidth = opt.lw || 4; ctx.lineJoin = 'round'; ctx.strokeStyle = opt.stroke; ctx.strokeText(str, x, y); }
    ctx.fillStyle = opt.fill || '#fff';
    ctx.fillText(str, x, y);
    ctx.restore();
  };
})(window.SB);
