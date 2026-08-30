/* SMASHFORGE — particles, impact flashes, weapon trails, KO effects, screen shake. */
(function (SB) {
  'use strict';
  const U = SB.U, D = SB.D;

  const MAXP = 1400;
  const FX = {
    parts: [], arcs: [], rings: [], texts: [], flashes: [],
    shake: 0, shakeX: 0, shakeY: 0, hitstop: 0, zoomPunch: 0, flashScreen: 0, flashCol: '#fff',
    slow: 0
  };
  SB.FX = FX;

  function P() {
    if (FX.parts.length >= MAXP) return null;
    const p = { x: 0, y: 0, vx: 0, vy: 0, life: 1, max: 1, size: 2, col: '#fff', type: 'spark', rot: 0, spin: 0, grav: 0, drag: 0.96, add: true, len: 0 };
    FX.parts.push(p);
    return p;
  }

  FX.reset = function () {
    FX.parts.length = 0; FX.arcs.length = 0; FX.rings.length = 0; FX.texts.length = 0; FX.flashes.length = 0;
    FX.shake = 0; FX.shakeX = 0; FX.shakeY = 0; FX.hitstop = 0; FX.zoomPunch = 0; FX.flashScreen = 0; FX.slow = 0;
  };

  FX.shakeScale = 1;
  FX.addShake = function (v) { FX.shake = Math.min(46, FX.shake + v * FX.shakeScale); };
  FX.punch = function (v) { FX.zoomPunch = Math.min(0.14, FX.zoomPunch + v); };
  FX.screenFlash = function (col, v) { FX.flashCol = col; FX.flashScreen = Math.min(0.85, FX.flashScreen + v); };

  /* ---------------- spawners ---------------- */
  FX.spark = function (x, y, n, col, spd, size, spread, dir) {
    for (let i = 0; i < n; i++) {
      const p = P(); if (!p) return;
      const a = dir === undefined ? Math.random() * U.TAU : dir + (Math.random() - 0.5) * (spread || 1.2);
      const s = spd * (0.35 + Math.random() * 0.9);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = 12 + Math.random() * 16;
      p.size = size * (0.5 + Math.random()); p.col = col; p.type = 'spark';
      p.drag = 0.90; p.grav = 0.16; p.len = 0.9 + Math.random();
    }
  };

  FX.glow = function (x, y, n, col, spd, size) {
    for (let i = 0; i < n; i++) {
      const p = P(); if (!p) return;
      const a = Math.random() * U.TAU, s = spd * Math.random();
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = 14 + Math.random() * 20;
      p.size = size * (0.6 + Math.random() * 0.8); p.col = col; p.type = 'glow';
      p.drag = 0.93; p.grav = -0.02;
    }
  };

  FX.smoke = function (x, y, n, col, spd, size) {
    for (let i = 0; i < n; i++) {
      const p = P(); if (!p) return;
      const a = Math.random() * U.TAU, s = spd * Math.random();
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 0.3;
      p.max = p.life = 26 + Math.random() * 26;
      p.size = size * (0.8 + Math.random()); p.col = col; p.type = 'smoke';
      p.drag = 0.94; p.grav = -0.03; p.add = false; p.spin = (Math.random() - 0.5) * 0.1;
    }
  };

  FX.shards = function (x, y, n, col, spd, size) {
    for (let i = 0; i < n; i++) {
      const p = P(); if (!p) return;
      const a = Math.random() * U.TAU, s = spd * (0.4 + Math.random());
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.max = p.life = 18 + Math.random() * 18;
      p.size = size * (0.5 + Math.random()); p.col = col; p.type = 'shard';
      p.rot = a; p.spin = (Math.random() - 0.5) * 0.3; p.drag = 0.92; p.grav = 0.22;
    }
  };

  FX.dust = function (x, y, dir, n, col) {
    for (let i = 0; i < (n || 8); i++) {
      const p = P(); if (!p) return;
      p.x = x + (Math.random() - 0.5) * 12; p.y = y;
      p.vx = (dir || 0) * (0.6 + Math.random() * 2.2) + (Math.random() - 0.5) * 1.2;
      p.vy = -Math.random() * 1.9;
      p.max = p.life = 16 + Math.random() * 16;
      p.size = 3 + Math.random() * 6; p.col = col || '#cbd6e6'; p.type = 'smoke';
      p.add = false; p.drag = 0.90; p.grav = 0.04;
    }
  };

  FX.ring = function (x, y, r0, r1, col, life, w, sx, sy) {
    FX.rings.push({ x: x, y: y, r0: r0, r1: r1, col: col, life: life, max: life, w: w || 4, sx: sx || 1, sy: sy === undefined ? 1 : sy });
  };

  FX.arc = function (x, y, a0, a1, rad, col, life, w) {
    FX.arcs.push({ x: x, y: y, a0: a0, a1: a1, rad: rad, col: col, life: life, max: life, w: w || 10 });
  };

  FX.text = function (x, y, str, col, size, vy) {
    FX.texts.push({ x: x, y: y, s: str, col: col, size: size || 22, life: 46, max: 46, vy: vy === undefined ? -1.5 : vy, vx: (Math.random() - 0.5) * 0.8 });
  };

  FX.flashAt = function (x, y, r, col, life) {
    FX.flashes.push({ x: x, y: y, r: r, col: col, life: life || 10, max: life || 10 });
  };

  /* ---------------- composite effects ---------------- */
  /* hitfx cosmetic (0..7) chooses the impact signature */
  FX.impact = function (x, y, dir, col, col2, power, style) {
    const s = (style === undefined ? 0 : style) % 8;
    const pw = U.clamp(power, 0.4, 3);
    FX.flashAt(x, y, 16 + pw * 22, col2, 8 + pw * 3);
    switch (s) {
      case 0: /* Impact Burst */
        FX.spark(x, y, 10 + pw * 8, col, 5 + pw * 3, 2.2 + pw, 1.5, dir > 0 ? -0.5 : Math.PI + 0.5);
        FX.ring(x, y, 6, 34 + pw * 26, col2, 16, 3 + pw);
        break;
      case 1: /* Shatter */
        FX.shards(x, y, 8 + pw * 6, col, 5 + pw * 2.5, 4 + pw * 2);
        FX.ring(x, y, 4, 26 + pw * 18, col, 14, 2.5);
        break;
      case 2: /* Bloom */
        FX.glow(x, y, 14 + pw * 8, col2, 3 + pw, 6 + pw * 3);
        FX.ring(x, y, 8, 40 + pw * 26, col, 22, 2);
        break;
      case 3: /* Cross Slash */
        for (let i = 0; i < 2; i++) {
          const a = i ? 0.9 : -0.9;
          FX.arc(x, y, a - 1.5, a + 1.5, 30 + pw * 20, col2, 12, 6 + pw * 3);
        }
        FX.spark(x, y, 8 + pw * 5, col, 5 + pw * 2, 2, 2);
        break;
      case 4: /* Shockwave */
        FX.ring(x, y, 6, 46 + pw * 34, col, 18, 5 + pw * 2, 1.35, 0.55);
        FX.spark(x, y, 8, col2, 4 + pw * 2, 2, 0.8, dir > 0 ? 0 : Math.PI);
        break;
      case 5: /* Nova */
        FX.ring(x, y, 4, 30 + pw * 22, col2, 14, 3);
        FX.ring(x, y, 4, 48 + pw * 30, col, 22, 2);
        FX.glow(x, y, 10 + pw * 6, col2, 4 + pw, 5 + pw * 2);
        break;
      case 6: /* Glyph Flash */
        FX.ring(x, y, 20 + pw * 10, 20 + pw * 10, col, 18, 3);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * U.TAU;
          FX.spark(x + Math.cos(a) * 18, y + Math.sin(a) * 18, 2, col2, 3, 2, 0.5, a);
        }
        break;
      default: /* Splash */
        FX.spark(x, y, 14 + pw * 8, col2, 6 + pw * 3, 2, 2.6);
        FX.smoke(x, y, 5, col, 2, 8 + pw * 3);
        break;
    }
  };

  FX.ko = function (x, y, col) {
    FX.screenFlash('#ffffff', 0.5);
    FX.addShake(24);
    FX.punch(0.09);
    FX.ring(x, y, 10, 260, col, 30, 8);
    FX.ring(x, y, 10, 180, '#ffffff', 22, 5);
    FX.spark(x, y, 46, col, 14, 4, 6.28);
    FX.shards(x, y, 20, '#ffffff', 12, 6);
    FX.glow(x, y, 24, col, 8, 12);
  };

  FX.blastMark = function (x, y, col) {
    FX.ring(x, y, 4, 120, col, 24, 6);
    FX.spark(x, y, 22, col, 10, 3, 6.28);
  };

  /* ---------------- weapon trails ---------------- */
  /* trailStyle 0..7 from the equipped Trail cosmetic */
  FX.drawTrail = function (ctx, pts, col, col2, width, style, alpha) {
    if (!pts || pts.length < 3) return;
    const s = (style === undefined ? 0 : style) % 8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha);
    const P2 = pts.map((p) => [p.x, p.y]);
    switch (s) {
      case 1: /* Smoke */
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < pts.length; i += 2) {
          const u = i / pts.length;
          ctx.globalAlpha = u * 0.35 * (alpha === undefined ? 1 : alpha);
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, width * (0.6 + u * 1.4), 0, U.TAU); ctx.fill();
        }
        break;
      case 2: /* Sparkle */
        for (let i = 0; i < pts.length; i++) {
          const u = i / pts.length;
          ctx.globalAlpha = u * 0.9 * (alpha === undefined ? 1 : alpha);
          ctx.fillStyle = i % 2 ? col : col2;
          U.star(ctx, pts[i].x, pts[i].y, 4, width * u * 1.5, width * u * 0.5, i);
          ctx.fill();
        }
        break;
      case 4: /* Ink Wash */
        ctx.globalCompositeOperation = 'source-over';
        D.ribbon(ctx, P2, width * 0.2, width * 1.5);
        ctx.fillStyle = U.rgba(col, 0.5); ctx.fill();
        break;
      case 5: /* Feathers */
        for (let i = 0; i < pts.length; i += 2) {
          const u = i / pts.length;
          ctx.globalAlpha = u * 0.7 * (alpha === undefined ? 1 : alpha);
          ctx.fillStyle = i % 3 ? col : col2;
          ctx.save(); ctx.translate(pts[i].x, pts[i].y); ctx.rotate(i * 0.6);
          ctx.beginPath(); ctx.ellipse(0, 0, width * u * 1.3, width * u * 0.4, 0, 0, U.TAU); ctx.fill();
          ctx.restore();
        }
        break;
      case 6: /* Lightning */
        ctx.strokeStyle = col2; ctx.lineWidth = 2; ctx.shadowColor = col; ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const j = (i / pts.length);
          ctx.lineTo(pts[i].x + (Math.random() - 0.5) * width * j * 2, pts[i].y + (Math.random() - 0.5) * width * j * 2);
        }
        ctx.stroke();
        break;
      case 7: /* Stardust */
        for (let i = 0; i < pts.length; i++) {
          const u = i / pts.length;
          ctx.globalAlpha = u * 0.8 * (alpha === undefined ? 1 : alpha);
          ctx.fillStyle = col2;
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, width * u * 0.55, 0, U.TAU); ctx.fill();
        }
        break;
      case 3: /* Blade Arc */
      default: /* Ribbon */
        D.ribbon(ctx, P2, width * 0.12, width * (s === 3 ? 1.9 : 1.25));
        const first = pts[0], last = pts[pts.length - 1];
        ctx.fillStyle = D.lin(ctx, first.x, first.y, last.x, last.y,
          [[0, U.rgba(col, 0)], [0.55, U.rgba(col, 0.55)], [1, U.rgba(col2, 0.95)]]);
        ctx.fill();
        if (s === 3) {
          ctx.strokeStyle = U.rgba('#ffffff', 0.55); ctx.lineWidth = 1.4;
          U.smoothPath(ctx, P2); ctx.stroke();
        }
        break;
    }
    ctx.restore();
  };

  /* ---------------- update / draw ---------------- */
  FX.update = function () {
    const ps = FX.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life--;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      p.x += p.vx; p.y += p.vy;
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav;
      p.rot += p.spin;
    }
    for (let i = FX.rings.length - 1; i >= 0; i--) { if (--FX.rings[i].life <= 0) FX.rings.splice(i, 1); }
    for (let i = FX.arcs.length - 1; i >= 0; i--) { if (--FX.arcs[i].life <= 0) FX.arcs.splice(i, 1); }
    for (let i = FX.flashes.length - 1; i >= 0; i--) { if (--FX.flashes[i].life <= 0) FX.flashes.splice(i, 1); }
    for (let i = FX.texts.length - 1; i >= 0; i--) {
      const t = FX.texts[i];
      t.life--; t.y += t.vy; t.x += t.vx; t.vy *= 0.94;
      if (t.life <= 0) FX.texts.splice(i, 1);
    }
    FX.shake *= 0.86;
    if (FX.shake < 0.1) FX.shake = 0;
    FX.shakeX = (Math.random() - 0.5) * FX.shake;
    FX.shakeY = (Math.random() - 0.5) * FX.shake;
    FX.zoomPunch *= 0.88;
    FX.flashScreen *= 0.82;
    if (FX.hitstop > 0) FX.hitstop--;
    if (FX.slow > 0) FX.slow--;
  };

  FX.draw = function (ctx) {
    ctx.save();
    /* additive layer */
    ctx.globalCompositeOperation = 'lighter';
    for (const r of FX.rings) {
      const u = 1 - r.life / r.max;
      const rad = U.lerp(r.r0, r.r1, U.easeOut(u));
      ctx.globalAlpha = (1 - u) * 0.85;
      ctx.strokeStyle = r.col; ctx.lineWidth = r.w * (1 - u * 0.65);
      ctx.save(); ctx.translate(r.x, r.y); ctx.scale(r.sx, r.sy);
      ctx.beginPath(); ctx.arc(0, 0, rad, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }
    for (const a of FX.arcs) {
      const u = 1 - a.life / a.max;
      ctx.globalAlpha = (1 - u) * 0.8;
      ctx.strokeStyle = a.col; ctx.lineWidth = a.w * (1 - u * 0.7); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(a.x, a.y, a.rad * (0.7 + u * 0.5), a.a0, a.a1); ctx.stroke();
    }
    for (const f of FX.flashes) {
      const u = 1 - f.life / f.max;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * (0.6 + u));
      g.addColorStop(0, U.rgba(f.col, (1 - u) * 0.9));
      g.addColorStop(0.4, U.rgba(f.col, (1 - u) * 0.35));
      g.addColorStop(1, U.rgba(f.col, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.6 + u), 0, U.TAU); ctx.fill();
    }
    for (const p of FX.parts) {
      if (!p.add) continue;
      drawPart(ctx, p);
    }
    ctx.restore();

    /* normal layer */
    ctx.save();
    for (const p of FX.parts) {
      if (p.add) continue;
      drawPart(ctx, p);
    }
    ctx.restore();

    for (const t of FX.texts) {
      const u = 1 - t.life / t.max;
      ctx.save();
      ctx.globalAlpha = u < 0.15 ? u / 0.15 : U.sat((1 - u) * 3.2);
      const sc = 1 + (1 - U.sat(u * 5)) * 0.5;
      ctx.translate(t.x, t.y); ctx.scale(sc, sc);
      U.text(ctx, t.s, 0, 0, { size: t.size, align: 'center', fill: t.col, stroke: 'rgba(6,8,14,0.85)', lw: 5, weight: 900, shadow: t.col, blur: 12 });
      ctx.restore();
    }
  };

  function drawPart(ctx, p) {
    const u = p.life / p.max;
    ctx.globalAlpha = U.sat(u * 1.35);
    switch (p.type) {
      case 'spark': {
        const l = p.size * p.len * 2.4;
        const a = Math.atan2(p.vy, p.vx);
        ctx.strokeStyle = p.col; ctx.lineWidth = p.size * u; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.cos(a) * l * u, p.y - Math.sin(a) * l * u);
        ctx.stroke();
        break;
      }
      case 'glow': {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * (2 - u));
        g.addColorStop(0, U.rgba(p.col, 0.85 * u));
        g.addColorStop(1, U.rgba(p.col, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - u), 0, U.TAU); ctx.fill();
        break;
      }
      case 'shard':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.moveTo(p.size * u, 0); ctx.lineTo(-p.size * 0.4 * u, p.size * 0.42 * u);
        ctx.lineTo(-p.size * 0.4 * u, -p.size * 0.42 * u); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      default: /* smoke */
        ctx.globalAlpha = U.sat(u) * 0.42;
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - u * 0.7), 0, U.TAU); ctx.fill();
        break;
    }
  }
})(window.SB);
