/* SMASHFORGE — fighter rendering: body, hair, layered cosmetics, weapon, status FX. */
(function (SB) {
  'use strict';
  const U = SB.U, D = SB.D, C = SB.COS_DRAW;
  const P = Math.PI;

  const LEN_MUL = {
    katana: 0.60, greatsword: 0.74, gauntlet: 0.30, spear: 0.98, hammer: 0.70,
    cannon: 0.62, scythe: 0.92, orb: 0.44, chakram: 0.46, bow: 0.54,
    katars: 0.36, axe: 0.68, lance: 1.02, staff: 0.90, blasters: 0.36
  };
  SB.weaponLen = (shape, h) => h * (LEN_MUL[shape] || 0.6);

  function skinShade(hex, k) { return U.shade(hex, k); }

  /* --------- hair --------- */
  function drawHair(ctx, f, sk, back, e) {
    const style = f.hair.style | 0;
    if (style === 0) return;
    const col = f.hair.color, R = sk.headR;
    const sway = U.clamp(-e.vx * 0.030, -0.8, 0.8) + Math.sin(e.t * 2.3) * 0.10;
    const lift = U.clamp(-e.vy * 0.016, -0.5, 0.7);
    ctx.save();
    ctx.translate(sk.head.x, sk.head.y);
    ctx.rotate(Math.atan2(sk.head.y - sk.neck.y, sk.head.x - sk.neck.x) + P / 2);
    const dark = U.shade(col, -0.35), lite = U.shade(col, 0.30);
    const g = D.lin(ctx, 0, -R * 1.4, 0, R * 1.4, [[0, lite], [0.5, col], [1, dark]]);

    function tail(len, w0, w1, yOff, spread) {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        pts.push([-u * len * (0.30 + sway * 0.8) - Math.sin(e.t * 3 + u * 3.4) * R * 0.16 * u,
          yOff + u * len * (0.85 + lift * 0.5) + spread * u * R]);
      }
      D.ribbon(ctx, pts, w0, w1);
      ctx.fillStyle = g; ctx.fill();
    }

    if (back) {
      switch (style) {
        case 3: tail(R * 3.4, R * 0.85, R * 0.30, -R * 0.3, 0); break;
        case 4: tail(R * 3.0, R * 0.42, R * 0.12, -R * 0.85, 0); break;
        case 5: tail(R * 1.7, R * 0.32, R * 0.10, -R * 1.15, 0); break;
        case 7: tail(R * 2.6, R * 0.30, R * 0.10, -R * 0.2, -0.4); tail(R * 2.6, R * 0.30, R * 0.10, -R * 0.2, 0.5); break;
        case 9: tail(R * 2.2, R * 0.34, R * 0.12, -R * 0.6, -0.7); tail(R * 2.2, R * 0.34, R * 0.12, -R * 0.6, 0.8); break;
        case 10: for (let i = 0; i < 5; i++) tail(R * (2.0 + i * 0.35), R * 0.30, R * 0.09, -R * 0.8 + i * R * 0.28, (i - 2) * 0.28); break;
        case 8: for (let i = 0; i < 4; i++) tail(R * 1.7, R * 0.42, R * 0.24, -R * 0.5 + i * R * 0.35, (i - 1.5) * 0.35); break;
      }
      ctx.restore();
      return;
    }

    /* skull cap */
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.16, R * 1.06, R * 1.10, 0, P * 0.98, P * 2.06);
    ctx.lineTo(R * 1.0, R * 0.1);
    ctx.quadraticCurveTo(0, R * 0.24, -R * 1.0, R * 0.05);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();

    switch (style) {
      case 2: /* swept back */
        ctx.beginPath();
        ctx.moveTo(R * 0.9, -R * 0.7);
        ctx.quadraticCurveTo(-R * 1.5, -R * 1.5, -R * 1.6, -R * 0.1);
        ctx.quadraticCurveTo(-R * 0.9, -R * 0.5, R * 0.5, -R * 0.4);
        ctx.closePath(); ctx.fillStyle = g; ctx.fill();
        break;
      case 6: /* mohawk */
        ctx.beginPath();
        ctx.moveTo(R * 0.55, -R * 0.85);
        for (let i = 0; i < 5; i++) ctx.lineTo(R * (0.4 - i * 0.24), -R * (1.5 + Math.sin(i) * 0.28));
        ctx.lineTo(-R * 0.7, -R * 0.75);
        ctx.closePath(); ctx.fillStyle = g; ctx.fill();
        break;
      case 11: /* undercut */
        ctx.fillStyle = U.shade(col, -0.45);
        ctx.fillRect(-R * 1.02, -R * 0.35, R * 2.04, R * 0.4);
        break;
      case 1: default: break;
    }
    /* front fringe */
    ctx.beginPath();
    ctx.moveTo(R * 0.20, -R * 1.02);
    ctx.quadraticCurveTo(R * 1.30, -R * 0.85, R * 1.02, -R * 0.05);
    ctx.quadraticCurveTo(R * 0.70, -R * 0.55, R * 0.16, -R * 0.60);
    ctx.closePath();
    ctx.fillStyle = U.shade(col, 0.12); ctx.fill();
    ctx.restore();
  }

  /* --------- face --------- */
  function drawFace(ctx, f, sk, e) {
    const R = sk.headR;
    ctx.save();
    ctx.translate(sk.head.x, sk.head.y);
    ctx.rotate(Math.atan2(sk.head.y - sk.neck.y, sk.head.x - sk.neck.x) + P / 2);
    const blink = (Math.sin(e.t * 0.9 + f.seed) > 0.985) ? 0.15 : 1;
    const eyeY = -R * 0.22;
    ctx.fillStyle = '#141820';
    ctx.beginPath(); ctx.ellipse(R * 0.42, eyeY, R * 0.13, R * 0.17 * blink, -0.1, 0, U.TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(R * 0.78, eyeY + R * 0.02, R * 0.10, R * 0.15 * blink, -0.1, 0, U.TAU); ctx.fill();
    if (blink > 0.5) {
      ctx.fillStyle = U.rgba('#ffffff', 0.85);
      ctx.beginPath(); ctx.arc(R * 0.46, eyeY - R * 0.05, R * 0.045, 0, U.TAU); ctx.fill();
    }
    ctx.strokeStyle = U.shade(f.hair.color, -0.3); ctx.lineWidth = R * 0.10; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(R * 0.28, eyeY - R * 0.30); ctx.lineTo(R * 0.58, eyeY - R * 0.36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R * 0.70, eyeY - R * 0.32); ctx.lineTo(R * 0.90, eyeY - R * 0.26); ctx.stroke();
    ctx.strokeStyle = U.rgba(skinShade(f.skin, -0.45), 0.8); ctx.lineWidth = R * 0.07;
    ctx.beginPath(); ctx.moveTo(R * 0.52, R * 0.34); ctx.lineTo(R * 0.80, R * 0.30); ctx.stroke();
    ctx.restore();
  }

  /* --------- torso body --------- */
  function drawTorso(ctx, f, sk, e) {
    const h = sk.h, b = f.build;
    const w1 = 0.090 * h * b, w0 = 0.072 * h * b;
    const col = f.col.primary;
    D.limb(ctx, sk.pelvis, sk.chest, w0, w1, col, { edge: U.rgba(U.shade(col, -0.6), 0.55), rim: e.rim, rimA: 0.28 });
    /* neck */
    D.limb(ctx, sk.chest, sk.neck, 0.036 * h, 0.031 * h, skinShade(f.skin, -0.10), {});
    /* chest accent */
    ctx.save();
    ctx.translate(sk.chest.x, sk.chest.y);
    ctx.rotate(Math.atan2(sk.chest.y - sk.pelvis.y, sk.chest.x - sk.pelvis.x) + P / 2);
    ctx.fillStyle = U.rgba(f.col.secondary, 0.9);
    U.roundRect(ctx, -w1 * 0.9, 0, w1 * 1.8, h * 0.06, h * 0.012); ctx.fill();
    ctx.restore();
  }

  /* --------- public --------- */
  SB.drawFighter = function (ctx, f, t, opt) {
    opt = opt || {};
    const sk = f.skel;
    if (!sk) return;
    const h = sk.h;
    const e = { t: t, vx: f.vx || 0, vy: f.vy || 0, build: f.build, rim: f.stageRim || '#bcd9ff' };
    const cos = f.cosItems;

    ctx.save();
    ctx.translate(f.x, f.y);
    if (sk.bodyRot) { ctx.translate(0, -h * 0.5); ctx.rotate(sk.bodyRot * f.dir); ctx.translate(0, h * 0.5); }
    ctx.scale(f.dir, 1);
    if (opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;

    /* aura sits behind everything */
    if (cos.aura && !cos.aura.none) C.aura(ctx, cos.aura, sk, e);
    if (cos.back && !cos.back.none) C.back(ctx, cos.back, sk, e);

    drawHair(ctx, f, sk, true, e);

    const skinC = f.skin;
    const limbC = f.col.secondary;
    const dark = { edge: U.rgba('#0a0d14', 0.42) };
    const rimO = { edge: U.rgba('#0a0d14', 0.42), rim: e.rim, rimA: 0.30 };

    /* ---- back limbs ---- */
    ctx.save(); ctx.globalAlpha *= 0.82;
    D.limb(ctx, sk.hipB, sk.knB, 0.049 * h * f.build, 0.039 * h * f.build, limbC, dark);
    D.limb(ctx, sk.knB, sk.ftB, 0.039 * h * f.build, 0.029 * h * f.build, limbC, dark);
    footShape(ctx, sk.knB, sk.ftB, h, U.shade(limbC, -0.35));
    ctx.restore();
    if (cos.legs && !cos.legs.none) C.legs(ctx, cos.legs, sk, e, 'B');

    ctx.save(); ctx.globalAlpha *= 0.82;
    D.limb(ctx, sk.shB, sk.elB, 0.041 * h * f.build, 0.034 * h * f.build, limbC, dark);
    D.limb(ctx, sk.elB, sk.haB, 0.034 * h * f.build, 0.027 * h * f.build, skinC, dark);
    ctx.beginPath(); ctx.arc(sk.haB.x, sk.haB.y, 0.032 * h, 0, U.TAU); ctx.fillStyle = skinC; ctx.fill();
    ctx.restore();
    if (cos.shoulders && !cos.shoulders.none) C.shoulders(ctx, cos.shoulders, sk, e, 'B');
    if (cos.arms && !cos.arms.none) C.arms(ctx, cos.arms, sk, e, 'B');

    /* ---- body ---- */
    drawTorso(ctx, f, sk, e);
    if (cos.torso && !cos.torso.none) C.torso(ctx, cos.torso, sk, e);

    /* ---- front leg ---- */
    D.limb(ctx, sk.hipF, sk.knF, 0.052 * h * f.build, 0.041 * h * f.build, limbC, rimO);
    D.limb(ctx, sk.knF, sk.ftF, 0.041 * h * f.build, 0.030 * h * f.build, limbC, rimO);
    footShape(ctx, sk.knF, sk.ftF, h, U.shade(limbC, -0.3));
    if (cos.legs && !cos.legs.none) C.legs(ctx, cos.legs, sk, e, 'F');

    /* ---- head ---- */
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(sk.head.x, sk.head.y, sk.headR * 0.94, sk.headR * 1.02,
      Math.atan2(sk.head.y - sk.neck.y, sk.head.x - sk.neck.x) + P / 2, 0, U.TAU);
    ctx.fillStyle = D.rad(ctx, sk.head.x + sk.headR * 0.3, sk.head.y - sk.headR * 0.4, 0, sk.headR * 1.8,
      [[0, skinShade(skinC, 0.22)], [0.6, skinC], [1, skinShade(skinC, -0.3)]]);
    ctx.fill();
    ctx.strokeStyle = U.rgba('#0a0d14', 0.35); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    drawFace(ctx, f, sk, e);
    drawHair(ctx, f, sk, false, e);
    if (cos.face && !cos.face.none) C.face(ctx, cos.face, sk, e);
    if (cos.head && !cos.head.none) C.head(ctx, cos.head, sk, e);

    /* ---- front arm + weapon ---- */
    D.limb(ctx, sk.shF, sk.elF, 0.044 * h * f.build, 0.035 * h * f.build, limbC, rimO);
    D.limb(ctx, sk.elF, sk.haF, 0.035 * h * f.build, 0.028 * h * f.build, skinC, rimO);
    ctx.beginPath(); ctx.arc(sk.haF.x, sk.haF.y, 0.034 * h, 0, U.TAU); ctx.fillStyle = skinC; ctx.fill();
    ctx.strokeStyle = U.rgba('#0a0d14', 0.3); ctx.lineWidth = 1; ctx.stroke();
    if (cos.shoulders && !cos.shoulders.none) C.shoulders(ctx, cos.shoulders, sk, e, 'F');
    if (cos.arms && !cos.arms.none) C.arms(ctx, cos.arms, sk, e, 'F');

    /* weapon — a borrowed move shows a spectral echo of its own weapon */
    const wSkin = cos.weapon;
    const arch = SB.archetype(f.archId);
    const pal = SB.weaponPalette(arch, wSkin);
    const echo = f.move && f.move.shape !== arch.shape ? f.move : null;
    ctx.save();
    ctx.translate(sk.weapon.x, sk.weapon.y);
    ctx.rotate(sk.weapon.a);
    SB.drawWeapon(ctx, arch.shape, pal, SB.weaponLen(arch.shape, h), wSkin, t, echo ? 0.22 : 1);
    if (echo) {
      const eArch = SB.archetype(echo.arch);
      const ePal = { a: U.shade(echo.fx.col, -0.4), b: echo.fx.col, c: echo.fx.col2, g: echo.fx.col };
      ctx.save();
      ctx.globalAlpha *= 0.92;
      ctx.shadowColor = echo.fx.col; ctx.shadowBlur = 16;
      SB.drawWeapon(ctx, eArch.shape, ePal, SB.weaponLen(eArch.shape, h), wSkin, t, 1);
      ctx.restore();
    }
    ctx.restore();

    ctx.restore();

    /* ---- status overlays (world space, not mirrored) ---- */
    drawStatus(ctx, f, sk, t);
  };

  function footShape(ctx, kn, ft, h, col) {
    const a = Math.atan2(ft.y - kn.y, ft.x - kn.x) - P / 2;
    ctx.save();
    ctx.translate(ft.x, ft.y);
    ctx.rotate(a);
    ctx.fillStyle = col;
    U.roundRect(ctx, -h * 0.022, -h * 0.016, h * 0.078, h * 0.032, h * 0.014);
    ctx.fill();
    ctx.restore();
  }

  function drawStatus(ctx, f, sk, t) {
    const h = sk.h;
    /* white flash on hit */
    if (f.flash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = U.sat(f.flash) * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(f.x, f.y - h * 0.5, h * 0.28, h * 0.55, 0, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }
    /* signature charge */
    if (f.chargeT > 0) {
      const k = U.sat(f.chargeT / 40);
      const col = f.chargeMove ? f.chargeMove.fx.col : '#ffd24a';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 8; i++) {
        const a = t * 6 + i * 0.785;
        const r = h * (0.55 - k * 0.30);
        ctx.globalAlpha = 0.35 + k * 0.4;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(a) * r, f.y - h * 0.5 + Math.sin(a) * r * 0.85, h * 0.018 * (0.6 + k), 0, U.TAU);
        ctx.fill();
      }
      if (k >= 1) {
        ctx.globalAlpha = 0.30 + Math.sin(t * 18) * 0.16;
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(f.x, f.y - h * 0.5, h * 0.34, h * 0.62, 0, 0, U.TAU); ctx.stroke();
      }
      ctx.restore();
    }
    /* shield bubble */
    if (f.shieldHP > 0 && f.state === 'shield') {
      const k = f.shieldHP / f.shieldMax;
      ctx.save();
      const r = h * (0.34 + k * 0.22);
      const g = ctx.createRadialGradient(f.x, f.y - h * 0.5, r * 0.2, f.x, f.y - h * 0.5, r);
      g.addColorStop(0, U.rgba(f.col.glow, 0.05));
      g.addColorStop(0.72, U.rgba(f.col.glow, 0.16));
      g.addColorStop(1, U.rgba(f.col.glow, 0.46));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - h * 0.5, r * 0.92, r * 1.08, 0, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = U.rgba('#ffffff', 0.35 + 0.2 * k); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.restore();
    }
    /* counter stance */
    if (f.counterT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.30 + Math.sin(t * 22) * 0.18;
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - h * 0.5, h * 0.36, h * 0.62, 0, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }
    /* ward buff */
    if (f.wardT > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.22 + Math.sin(t * 5) * 0.08;
      ctx.strokeStyle = f.col.glow; ctx.lineWidth = 2.4;
      for (let i = 0; i < 6; i++) {
        const a = t * 1.2 + i * 1.047;
        ctx.beginPath();
        ctx.arc(f.x + Math.cos(a) * h * 0.30, f.y - h * 0.5 + Math.sin(a) * h * 0.52, h * 0.05, 0, U.TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    /* armour flash while a Titan signature charges through a hit */
    if (f.armorFlash > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = U.sat(f.armorFlash) * 0.6;
      ctx.strokeStyle = '#ffcf6a'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y - h * 0.5, h * 0.4, h * 0.66, 0, 0, U.TAU); ctx.stroke();
      ctx.restore();
    }
  }

  /* Small portrait used by the roster, designer and HUD. */
  SB.drawPortrait = function (ctx, f, cx, cy, size, t) {
    const saveH = f.h, saveX = f.x, saveY = f.y, saveDir = f.dir, savePose = f.pose, saveSkel = f.skel;
    f.h = size;
    f.x = cx; f.y = cy + size * 0.5;
    f.dir = 1;
    f.pose = SB.POSES.idle(t);
    f.skel = SB.computeSkel(f.pose, f.h, f.build);
    SB.drawFighter(ctx, f, t, {});
    f.h = saveH; f.x = saveX; f.y = saveY; f.dir = saveDir; f.pose = savePose; f.skel = saveSkel;
  };
})(window.SB);
