/* SMASHFORGE — in-match HUD: health bars, stocks, charge meters, off-screen markers. */
(function (SB) {
  'use strict';
  const U = SB.U, D = SB.D;

  const HUD = {};
  SB.HUD = HUD;

  /* ---- crest + banner marks used on the panels ---- */
  HUD.drawCrest = function (ctx, item, x, y, s, t) {
    const p = item && !item.none ? item.pal : { a: '#3b4250', b: '#6d7889', c: '#c9d4e2', g: '#9fb0c4' };
    const sh = item && !item.none ? item.shape % 8 : 0;
    ctx.save();
    ctx.translate(x, y);
    if (item && item.glow > 0) { ctx.shadowColor = p.g; ctx.shadowBlur = 4 + item.glow * 10; }
    ctx.fillStyle = D.lin(ctx, 0, -s, 0, s, [[0, U.shade(p.c, 0.3)], [0.55, p.b], [1, U.shade(p.a, -0.1)]]);
    switch (sh) {
      case 0: ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.72, 0); ctx.closePath(); ctx.fill(); break;
      case 1: ctx.beginPath(); ctx.moveTo(-s, s * 0.4); ctx.quadraticCurveTo(0, -s * 1.1, s, s * 0.4); ctx.quadraticCurveTo(0, -s * 0.1, -s, s * 0.4); ctx.closePath(); ctx.fill(); break;
      case 2: ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.62, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = p.g; ctx.beginPath(); ctx.arc(0, 0, s * 0.32, 0, U.TAU); ctx.fill(); break;
      case 3: ctx.beginPath(); ctx.moveTo(0, -s); ctx.quadraticCurveTo(s * 0.8, -s * 0.1, 0, s);
        ctx.quadraticCurveTo(-s * 0.8, -s * 0.1, 0, -s); ctx.closePath(); ctx.fill(); break;
      case 4: ctx.fillRect(-s * 0.18, -s, s * 0.36, s * 1.7);
        ctx.beginPath(); ctx.arc(0, s * 0.45, s * 0.62, 0.2, Math.PI - 0.2); ctx.lineWidth = s * 0.22; ctx.strokeStyle = p.b; ctx.stroke(); break;
      case 5: ctx.beginPath(); ctx.moveTo(-s * 0.6, -s); ctx.lineTo(s * 0.6, -s); ctx.lineTo(0, s); ctx.closePath(); ctx.fill(); break;
      case 6: D.ring(ctx, 0, 0, s * 0.9, s * 0.3); ctx.fill();
        for (let i = 0; i < 6; i++) { const a = (i / 6) * U.TAU; ctx.fillRect(Math.cos(a) * s * 0.95 - s * 0.09, Math.sin(a) * s * 0.95 - s * 0.09, s * 0.18, s * 0.18); } break;
      default: ctx.beginPath(); ctx.moveTo(0, s); ctx.quadraticCurveTo(s, 0, 0, -s); ctx.quadraticCurveTo(-s, 0, 0, s); ctx.closePath(); ctx.fill(); break;
    }
    ctx.restore();
  };

  function bannerBG(ctx, item, x, y, w, h, r) {
    const p = item && !item.none ? item.pal : { a: '#141922', b: '#1d2532', c: '#2b3546', g: '#4b5568' };
    const sh = item && !item.none ? item.shape % 8 : 1;
    ctx.save();
    U.roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = D.lin(ctx, x, y, x, y + h, [[0, U.rgba(p.b, 0.92)], [1, U.rgba(p.a, 0.96)]]);
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = p.c;
    switch (sh) {
      case 0: for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + w * (i / 5) + 20, y + h * 0.5, h * 0.34, 0, U.TAU); ctx.fill(); } break;
      case 1: for (let i = 0; i < 8; i++) ctx.fillRect(x + i * (w / 8), y, w / 16, h); break;
      case 2: for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + i * 40, y + h); ctx.lineTo(x + i * 40 + 22, y); ctx.lineTo(x + i * 40 + 40, y); ctx.lineTo(x + i * 40 + 18, y + h); ctx.closePath(); ctx.fill(); } break;
      case 3: ctx.beginPath(); ctx.arc(x + w * 0.82, y + h * 0.5, h * 0.7, 0, U.TAU); ctx.fill(); break;
      case 4: for (let i = 0; i < 9; i++) U.star(ctx, x + 18 + i * (w / 9), y + h * (i % 2 ? 0.32 : 0.68), 5, 6, 2.6, 0), ctx.fill(); break;
      case 5: ctx.beginPath(); ctx.ellipse(x + w * 0.15, y + h * 0.5, h * 0.5, h * 0.5, 0, 0, U.TAU); ctx.fill(); break;
      case 6: for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + 30 + i * 46, y + h * 0.5, h * 0.3, 0, U.TAU); ctx.fill(); } break;
      default:
        ctx.lineWidth = 2; ctx.strokeStyle = p.c;
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + i * 42, y + h); ctx.lineTo(x + i * 42 + 20, y + h * 0.35); ctx.lineTo(x + i * 42 + 46, y + h * 0.35); ctx.stroke(); }
        break;
    }
    ctx.restore();
  }

  /* ---- pre-rendered portraits so the HUD stays cheap ---- */
  HUD.makePortraits = function (fighters) {
    for (const f of fighters) {
      const c = document.createElement('canvas');
      const S = 128;
      c.width = S; c.height = S;
      const cx = c.getContext('2d');
      cx.save();
      cx.translate(S * 0.5, S * 0.06);
      cx.scale(1.75, 1.75);
      const saved = { x: f.x, y: f.y, dir: f.dir, pose: f.pose, skel: f.skel };
      f.x = 0; f.y = S * 0.52; f.dir = 1;
      f.pose = SB.POSES.idle(0.4);
      f.skel = SB.computeSkel(f.pose, f.h * 0.92, f.build);
      try { SB.drawFighter(cx, f, 0.4, {}); } catch (e) { }
      f.x = saved.x; f.y = saved.y; f.dir = saved.dir; f.pose = saved.pose; f.skel = saved.skel;
      cx.restore();
      f.portrait = c;
    }
  };

  /* ---- the health panel ---- */
  function panel(ctx, f, x, y, w, h, t) {
    const hpFrac = U.sat(f.hp / f.d.maxHP);
    if (f.hudLag === undefined) f.hudLag = hpFrac;
    f.hudLag = f.hudLag > hpFrac ? Math.max(hpFrac, f.hudLag - 0.006) : hpFrac;
    if (f.hudShake === undefined) f.hudShake = 0;
    f.hudShake = Math.max(0, f.hudShake - 0.06);

    const sx = (Math.random() - 0.5) * f.hudShake * 7;
    const sy = (Math.random() - 0.5) * f.hudShake * 4;

    ctx.save();
    ctx.translate(x + sx, y + sy);

    /* body */
    bannerBG(ctx, f.cosItems.banner, 0, 0, w, h, 12);
    ctx.strokeStyle = U.rgba(f.playerCol, 0.75); ctx.lineWidth = 2;
    U.roundRect(ctx, 0, 0, w, h, 12); ctx.stroke();

    /* portrait */
    ctx.save();
    U.roundRect(ctx, 6, 6, h - 12, h - 12, 9); ctx.clip();
    ctx.fillStyle = U.rgba(f.col.secondary, 0.9); ctx.fillRect(6, 6, h - 12, h - 12);
    const pg = ctx.createRadialGradient(6 + (h - 12) / 2, 6 + (h - 12) * 0.35, 2, 6 + (h - 12) / 2, 6 + (h - 12) * 0.4, h);
    pg.addColorStop(0, U.rgba(f.col.glow, 0.35)); pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg; ctx.fillRect(6, 6, h - 12, h - 12);
    if (f.portrait) ctx.drawImage(f.portrait, 6, 6, h - 12, h - 12);
    ctx.restore();
    ctx.strokeStyle = U.rgba('#ffffff', 0.16); ctx.lineWidth = 1.4;
    U.roundRect(ctx, 6, 6, h - 12, h - 12, 9); ctx.stroke();

    const bx = h + 4, bw = w - h - 14;

    /* name + crest */
    HUD.drawCrest(ctx, f.cosItems.crest, bx + 8, 17, 8, t);
    U.text(ctx, f.name.toUpperCase(), bx + 22, 21, { size: 13, weight: 800, fill: '#eaf2ff', letter: '0.06em', shadow: 'rgba(0,0,0,0.8)', blur: 4 });

    /* stocks */
    for (let i = 0; i < 5; i++) {
      const px = bx + bw - 12 - i * 15;
      const on = i < f.stocks;
      ctx.globalAlpha = on ? 1 : 0.18;
      HUD.drawCrest(ctx, f.cosItems.crest, px, 17, 6.2, t);
      ctx.globalAlpha = 1;
      if (!on) continue;
    }

    /* health bar */
    const by = 28, bh = 15;
    U.roundRect(ctx, bx, by, bw, bh, bh / 2);
    ctx.fillStyle = 'rgba(6,9,16,0.85)'; ctx.fill();

    /* lag bar */
    if (f.hudLag > hpFrac + 0.001) {
      ctx.save();
      U.roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.clip();
      ctx.fillStyle = 'rgba(255,235,235,0.55)';
      ctx.fillRect(bx, by, bw * f.hudLag, bh);
      ctx.restore();
    }

    /* fill */
    const hue = U.lerp(2, 128, Math.pow(hpFrac, 0.85));
    const c1 = U.hsl2hex(hue, 88, 58), c2 = U.hsl2hex(hue, 92, 42);
    ctx.save();
    U.roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.clip();
    ctx.fillStyle = D.lin(ctx, bx, by, bx, by + bh, [[0, U.shade(c1, 0.34)], [0.5, c1], [1, c2]]);
    ctx.fillRect(bx, by, bw * hpFrac, bh);
    /* moving sheen */
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#ffffff';
    const sh = ((t * 90) % (bw + 120)) - 60;
    ctx.fillRect(bx + sh, by, 26, bh);
    ctx.globalAlpha = 1;
    /* segment ticks every 25 hp */
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    const seg = 25 / f.d.maxHP;
    for (let s = seg; s < 1; s += seg) ctx.fillRect(bx + bw * s, by, 1.5, bh);
    ctx.restore();

    ctx.strokeStyle = U.rgba('#ffffff', 0.22); ctx.lineWidth = 1.2;
    U.roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
    if (hpFrac < 0.28) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.30 + Math.sin(t * 7) * 0.20;
      ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = 2.6;
      U.roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
      ctx.restore();
    }

    U.text(ctx, Math.max(0, Math.ceil(f.hp)) + '', bx + bw - 4, by + bh - 3,
      { size: 13, weight: 900, align: 'right', fill: '#ffffff', stroke: 'rgba(4,7,12,0.9)', lw: 3.5 });

    /* shield + charge meters */
    const my = by + bh + 4;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(bx, my, bw, 4);
    ctx.fillStyle = U.rgba(f.col.glow, 0.9);
    ctx.fillRect(bx, my, bw * U.sat(f.shieldHP / f.shieldMax), 4);
    if (f.chargeT > 0) {
      const k = U.sat(f.chargeT / 40);
      ctx.fillStyle = k >= 1 ? '#ffd24a' : '#ffa640';
      ctx.fillRect(bx, my + 5, bw * k, 3);
    }

    ctx.restore();
  }

  HUD.draw = function (ctx, w, W, H, t) {
    const fs = w.fighters;
    const pw = Math.min(300, (W - 90) / fs.length - 16);
    const ph = 58;
    const total = fs.length * (pw + 16) - 16;
    let x = (W - total) / 2;
    for (const f of fs) {
      panel(ctx, f, x, H - ph - 16, pw, ph, t);
      x += pw + 16;
    }

    /* timer */
    if (w.timeLimit > 0) {
      const s = Math.max(0, Math.ceil(w.timeLeft / 60));
      const mm = Math.floor(s / 60), ss = s % 60;
      const str = mm + ':' + (ss < 10 ? '0' : '') + ss;
      ctx.save();
      U.roundRect(ctx, W / 2 - 62, 12, 124, 42, 10);
      ctx.fillStyle = 'rgba(8,12,20,0.72)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.4; ctx.stroke();
      U.text(ctx, str, W / 2, 44, {
        size: 28, weight: 900, align: 'center',
        fill: s <= 10 ? '#ff6b7a' : '#eaf2ff', shadow: s <= 10 ? '#ff2d4a' : '#000', blur: s <= 10 ? 14 : 5
      });
      ctx.restore();
    }

    /* off-screen markers */
    const cam = w.cam;
    for (const f of fs) {
      if (f.dead || f.state === 'ko') continue;
      const sx = (f.x - cam.x) * cam.z + W / 2;
      const sy = (f.y - f.h * 0.5 - cam.y) * cam.z + H / 2;
      const m = 62;
      if (sx > m && sx < W - m && sy > m && sy < H - m - 70) continue;
      const cx = U.clamp(sx, m, W - m), cy = U.clamp(sy, m, H - m - 70);
      const ang = Math.atan2(sy - cy, sx - cx);
      const danger = U.sat((Math.abs(f.x) - 700) / 480);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = danger > 0.6 ? '#ff5a6a' : f.playerCol;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(-10, 13); ctx.lineTo(-4, 0); ctx.lineTo(-10, -13); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = 'rgba(8,12,20,0.8)';
      ctx.beginPath(); ctx.arc(0, 0, 17, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = f.playerCol; ctx.lineWidth = 2; ctx.stroke();
      HUD.drawCrest(ctx, f.cosItems.crest, 0, 0, 8, t);
      ctx.restore();
    }

    /* announcements */
    if (w.banner && w.bannerT > 0) {
      const u = 1 - w.bannerT / w.bannerMax;
      ctx.save();
      ctx.globalAlpha = u < 0.12 ? u / 0.12 : U.sat((1 - u) * 5);
      const sc = 1 + (1 - U.sat(u * 6)) * 0.35;
      ctx.translate(W / 2, H * 0.30);
      ctx.scale(sc, sc);
      U.text(ctx, w.banner, 0, 0, {
        size: 58, weight: 900, align: 'center', fill: w.bannerCol || '#ffffff',
        stroke: 'rgba(4,6,12,0.9)', lw: 9, shadow: w.bannerCol || '#fff', blur: 26, letter: '0.04em'
      });
      if (w.bannerSub) U.text(ctx, w.bannerSub, 0, 38, { size: 20, weight: 700, align: 'center', fill: '#dfe8f5', stroke: 'rgba(4,6,12,0.85)', lw: 5 });
      ctx.restore();
    }
  };
})(window.SB);
