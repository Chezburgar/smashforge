/* SMASHFORGE — the 15 weapon silhouettes. Drawn with the grip at the origin,
   pointing along +x. `sk` is the weapon-skin cosmetic (may be null). */
(function (SB) {
  'use strict';
  const U = SB.U, D = SB.D;

  /* Weapon-skin surface treatments, indexed by cosmetic shape. */
  function surface(ctx, skin, x, y, w, h, ang) {
    if (!skin || skin.none) return;
    const p = skin.pal;
    ctx.save();
    ctx.globalAlpha = 0.85;
    switch (skin.shape % 12) {
      case 0: /* Etched */
        ctx.strokeStyle = U.rgba(p.c, 0.75); ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 4, y - h / 2); ctx.lineTo(x + w * i / 4, y + h / 2); ctx.stroke(); }
        break;
      case 1: /* Runed */
        ctx.fillStyle = p.g; ctx.shadowColor = p.g; ctx.shadowBlur = 8;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + w * (0.2 + i * 0.22), y, h * 0.16, 0, U.TAU); ctx.fill(); }
        break;
      case 2: /* Crystalline */
        ctx.fillStyle = U.rgba(p.c, 0.5);
        for (let i = 0; i < 5; i++) { D.shard(ctx, x + w * (0.15 + i * 0.18), y - h * 0.1, -0.5, h * 0.6, h * 0.16); ctx.fill(); }
        break;
      case 3: /* Bonecarved */
        ctx.strokeStyle = U.rgba(p.c, 0.65); ctx.lineWidth = 1.6;
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(x + w * (0.14 + i * 0.19), y, h * 0.28, 0.4, 2.8); ctx.stroke(); }
        break;
      case 4: /* Chromed */
        ctx.fillStyle = U.rgba('#ffffff', 0.55);
        ctx.fillRect(x, y - h * 0.34, w, h * 0.16);
        break;
      case 5: /* Emberforged */
        ctx.fillStyle = D.lin(ctx, x, y, x + w, y, [[0, U.rgba(p.g, 0.0)], [0.6, U.rgba(p.g, 0.55)], [1, U.rgba(p.c, 0.8)]]);
        ctx.fillRect(x, y - h / 2, w, h);
        break;
      case 6: /* Stormbound */
        ctx.strokeStyle = p.g; ctx.lineWidth = 1.3; ctx.shadowColor = p.g; ctx.shadowBlur = 9;
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) ctx.lineTo(x + w * i / 6, y + (i % 2 ? -h * 0.24 : h * 0.24));
        ctx.stroke();
        break;
      case 7: /* Ancient */
        ctx.fillStyle = U.rgba(p.a, 0.55);
        for (let i = 0; i < 7; i++) ctx.fillRect(x + w * (i / 7), y - h * 0.4 + (i % 3) * h * 0.2, w * 0.05, h * 0.2);
        break;
      case 8: /* Serrated */
        ctx.fillStyle = U.rgba(p.b, 0.85);
        for (let i = 0; i < 7; i++) { D.spike(ctx, x + w * (0.12 + i * 0.13), y + h * 0.4, Math.PI / 2, h * 0.3, h * 0.09); ctx.fill(); }
        break;
      case 9: /* Prismatic */
        for (let i = 0; i < 6; i++) { ctx.fillStyle = U.hsl(i * 60 + ang * 40, 90, 62, 0.32); ctx.fillRect(x + w * i / 6, y - h / 2, w / 6, h); }
        break;
      case 10: /* Voidtouched */
        ctx.fillStyle = D.lin(ctx, x, y - h / 2, x, y + h / 2, [[0, U.rgba(p.a, 0.9)], [1, U.rgba(p.g, 0.35)]]);
        ctx.fillRect(x, y - h / 2, w, h);
        ctx.shadowColor = p.g; ctx.shadowBlur = 14; ctx.strokeStyle = U.rgba(p.g, 0.7); ctx.lineWidth = 1; ctx.strokeRect(x, y - h / 2, w, h);
        break;
      default: /* Ceremonial */
        ctx.strokeStyle = U.rgba(p.c, 0.85); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x, y - h * 0.32); ctx.lineTo(x + w, y - h * 0.32);
        ctx.moveTo(x, y + h * 0.32); ctx.lineTo(x + w, y + h * 0.32); ctx.stroke();
        break;
    }
    ctx.restore();
  }

  function blade(ctx, L, W, metal, edge, tipCurve) {
    ctx.beginPath();
    ctx.moveTo(0, -W * 0.5);
    ctx.lineTo(L * 0.86, -W * 0.5 - (tipCurve || 0));
    ctx.quadraticCurveTo(L, -W * 0.1, L, 0);
    ctx.quadraticCurveTo(L, W * 0.2, L * 0.84, W * 0.5);
    ctx.lineTo(0, W * 0.5);
    ctx.closePath();
    ctx.fillStyle = D.lin(ctx, 0, -W * 0.5, 0, W * 0.5,
      [[0, U.shade(metal, 0.55)], [0.35, metal], [0.62, U.shade(metal, -0.30)], [1, U.shade(metal, -0.05)]]);
    ctx.fill();
    ctx.strokeStyle = U.rgba(edge, 0.9); ctx.lineWidth = 1; ctx.stroke();
  }

  function grip(ctx, back, W, colA, colB) {
    U.roundRect(ctx, -back, -W * 0.5, back, W, W * 0.4);
    ctx.fillStyle = D.lin(ctx, 0, -W * 0.5, 0, W * 0.5, [[0, U.shade(colA, 0.3)], [1, U.shade(colA, -0.35)]]);
    ctx.fill();
    ctx.fillStyle = colB;
    for (let i = 0; i < 4; i++) ctx.fillRect(-back + i * back / 4 + back * 0.06, -W * 0.5, back * 0.06, W);
  }

  const W = {};

  W.katana = function (ctx, L, p, sk, t) {
    grip(ctx, L * 0.20, L * 0.045, p.a, p.c);
    ctx.fillStyle = p.c;
    U.roundRect(ctx, -L * 0.015, -L * 0.055, L * 0.045, L * 0.11, L * 0.02); ctx.fill();
    ctx.save(); ctx.translate(L * 0.03, 0);
    blade(ctx, L * 0.80, L * 0.052, p.b, p.g, L * 0.012);
    surface(ctx, sk, 0, 0, L * 0.78, L * 0.052, t);
    ctx.restore();
  };

  W.greatsword = function (ctx, L, p, sk, t) {
    grip(ctx, L * 0.26, L * 0.055, p.a, p.c);
    ctx.fillStyle = p.c;
    U.roundRect(ctx, -L * 0.02, -L * 0.10, L * 0.05, L * 0.20, L * 0.02); ctx.fill();
    ctx.save(); ctx.translate(L * 0.03, 0);
    blade(ctx, L * 0.80, L * 0.115, p.b, p.g, 0);
    ctx.fillStyle = U.rgba(p.c, 0.5);
    ctx.fillRect(0, -L * 0.012, L * 0.74, L * 0.024);
    surface(ctx, sk, 0, 0, L * 0.76, L * 0.11, t);
    ctx.restore();
  };

  W.gauntlet = function (ctx, L, p, sk, t) {
    ctx.save();
    D.plate(ctx, L * 0.10, 0, L * 0.30, L * 0.26, L * 0.07, p.b, p.g);
    for (let i = 0; i < 3; i++) { D.spike(ctx, L * 0.24, -L * 0.09 + i * L * 0.09, 0, L * 0.13, L * 0.028); ctx.fillStyle = p.c; ctx.fill(); }
    D.plate(ctx, -L * 0.12, 0, L * 0.22, L * 0.20, L * 0.05, p.a, null);
    surface(ctx, sk, -L * 0.02, 0, L * 0.26, L * 0.20, t);
    ctx.restore();
  };

  W.spear = function (ctx, L, p, sk, t) {
    U.roundRect(ctx, -L * 0.30, -L * 0.022, L * 1.02, L * 0.044, L * 0.02);
    ctx.fillStyle = D.lin(ctx, 0, -L * 0.022, 0, L * 0.022, [[0, U.shade(p.a, 0.35)], [1, U.shade(p.a, -0.35)]]);
    ctx.fill();
    ctx.save(); ctx.translate(L * 0.66, 0);
    ctx.fillStyle = p.c; U.roundRect(ctx, -L * 0.02, -L * 0.042, L * 0.05, L * 0.084, L * 0.02); ctx.fill();
    blade(ctx, L * 0.30, L * 0.062, p.b, p.g, 0);
    surface(ctx, sk, 0, 0, L * 0.28, L * 0.06, t);
    ctx.restore();
    ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(-L * 0.29, 0, L * 0.028, 0, U.TAU); ctx.fill();
  };

  W.hammer = function (ctx, L, p, sk, t) {
    U.roundRect(ctx, -L * 0.28, -L * 0.028, L * 0.86, L * 0.056, L * 0.02);
    ctx.fillStyle = D.lin(ctx, 0, -L * 0.03, 0, L * 0.03, [[0, U.shade(p.a, 0.3)], [1, U.shade(p.a, -0.4)]]); ctx.fill();
    ctx.save(); ctx.translate(L * 0.62, 0);
    D.plate(ctx, 0, 0, L * 0.30, L * 0.34, L * 0.05, p.b, p.g);
    ctx.fillStyle = U.rgba(p.c, 0.8);
    ctx.fillRect(-L * 0.15, -L * 0.17, L * 0.05, L * 0.34);
    ctx.fillRect(L * 0.10, -L * 0.17, L * 0.05, L * 0.34);
    surface(ctx, sk, -L * 0.14, 0, L * 0.28, L * 0.30, t);
    ctx.restore();
  };

  W.cannon = function (ctx, L, p, sk, t) {
    U.roundRect(ctx, -L * 0.22, -L * 0.075, L * 0.92, L * 0.15, L * 0.05);
    ctx.fillStyle = D.lin(ctx, 0, -L * 0.075, 0, L * 0.075, [[0, U.shade(p.b, 0.35)], [0.5, p.b], [1, U.shade(p.b, -0.42)]]); ctx.fill();
    ctx.fillStyle = p.a;
    U.roundRect(ctx, L * 0.58, -L * 0.095, L * 0.13, L * 0.19, L * 0.03); ctx.fill();
    ctx.fillStyle = U.rgba('#101014', 0.85);
    ctx.beginPath(); ctx.ellipse(L * 0.70, 0, L * 0.022, L * 0.075, 0, 0, U.TAU); ctx.fill();
    ctx.fillStyle = p.c;
    for (let i = 0; i < 3; i++) { U.roundRect(ctx, -L * 0.10 + i * L * 0.20, -L * 0.09, L * 0.035, L * 0.18, L * 0.015); ctx.fill(); }
    surface(ctx, sk, -L * 0.18, 0, L * 0.70, L * 0.13, t);
  };

  W.scythe = function (ctx, L, p, sk, t) {
    U.roundRect(ctx, -L * 0.42, -L * 0.024, L * 1.02, L * 0.048, L * 0.02);
    ctx.fillStyle = D.lin(ctx, 0, -L * 0.03, 0, L * 0.03, [[0, U.shade(p.a, 0.3)], [1, U.shade(p.a, -0.4)]]); ctx.fill();
    ctx.save(); ctx.translate(L * 0.58, 0);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(L * 0.34, -L * 0.10, L * 0.42, -L * 0.42);
    ctx.quadraticCurveTo(L * 0.22, -L * 0.16, 0, -L * 0.10);
    ctx.closePath();
    ctx.fillStyle = D.lin(ctx, 0, 0, L * 0.4, -L * 0.4, [[0, U.shade(p.b, -0.25)], [0.5, p.b], [1, U.shade(p.b, 0.55)]]);
    ctx.fill();
    ctx.strokeStyle = U.rgba(p.g, 0.85); ctx.lineWidth = 1.2; ctx.stroke();
    surface(ctx, sk, L * 0.04, -L * 0.16, L * 0.30, L * 0.16, t);
    ctx.restore();
  };

  W.orb = function (ctx, L, p, sk, t) {
    const bob = Math.sin(t * 2.2) * L * 0.03;
    ctx.save(); ctx.translate(L * 0.34, bob - L * 0.06);
    ctx.shadowColor = p.g; ctx.shadowBlur = 22;
    ctx.beginPath(); ctx.arc(0, 0, L * 0.15, 0, U.TAU);
    ctx.fillStyle = D.rad(ctx, -L * 0.05, -L * 0.05, L * 0.01, L * 0.18,
      [[0, U.shade(p.c, 0.5)], [0.5, p.b], [1, U.shade(p.a, -0.2)]]);
    ctx.fill();
    ctx.shadowBlur = 0;
    for (let i = 0; i < 3; i++) {
      const a = t * (1.1 + i * 0.4) + i * 2.1;
      ctx.save(); ctx.rotate(a); ctx.scale(1, 0.34);
      D.ring(ctx, 0, 0, L * (0.22 + i * 0.05), L * 0.012);
      ctx.fillStyle = U.rgba(p.g, 0.55 - i * 0.12); ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < 4; i++) {
      const a = t * 1.6 + i * 1.57;
      ctx.fillStyle = U.rgba(p.c, 0.8);
      D.shard(ctx, Math.cos(a) * L * 0.26, Math.sin(a) * L * 0.26 * 0.6, a, L * 0.09, L * 0.022); ctx.fill();
    }
    ctx.restore();
  };

  W.chakram = function (ctx, L, p, sk, t) {
    ctx.save(); ctx.translate(L * 0.26, 0); ctx.rotate(t * 3.2);
    D.ring(ctx, 0, 0, L * 0.22, L * 0.055);
    ctx.fillStyle = D.lin(ctx, -L * 0.22, 0, L * 0.22, 0, [[0, U.shade(p.b, -0.3)], [0.5, p.b], [1, U.shade(p.b, 0.5)]]);
    ctx.fill();
    ctx.strokeStyle = U.rgba(p.g, 0.8); ctx.lineWidth = 1.1; ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * U.TAU;
      ctx.fillStyle = p.c;
      D.spike(ctx, Math.cos(a) * L * 0.22, Math.sin(a) * L * 0.22, a, L * 0.075, L * 0.018); ctx.fill();
    }
    ctx.restore();
    ctx.save(); ctx.translate(-L * 0.08, L * 0.10); ctx.rotate(-t * 2.4); ctx.globalAlpha = 0.85;
    D.ring(ctx, 0, 0, L * 0.14, L * 0.04); ctx.fillStyle = p.a; ctx.fill();
    ctx.restore();
  };

  W.bow = function (ctx, L, p, sk, t) {
    ctx.save(); ctx.rotate(Math.PI / 2); ctx.translate(0, L * 0.06);
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.42);
    ctx.quadraticCurveTo(L * 0.26, -L * 0.20, L * 0.20, 0);
    ctx.quadraticCurveTo(L * 0.26, L * 0.20, 0, L * 0.42);
    ctx.lineWidth = L * 0.035; ctx.lineCap = 'round';
    ctx.strokeStyle = D.lin(ctx, 0, -L * 0.4, 0, L * 0.4, [[0, U.shade(p.b, 0.4)], [0.5, p.b], [1, U.shade(p.b, -0.35)]]);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -L * 0.42); ctx.lineTo(-L * 0.02, 0); ctx.lineTo(0, L * 0.42);
    ctx.lineWidth = 1.4; ctx.strokeStyle = U.rgba(p.c, 0.9); ctx.stroke();
    ctx.fillStyle = p.a; U.roundRect(ctx, L * 0.14, -L * 0.09, L * 0.07, L * 0.18, L * 0.03); ctx.fill();
    ctx.restore();
    surface(ctx, sk, -L * 0.05, -L * 0.02, L * 0.2, L * 0.1, t);
  };

  W.katars = function (ctx, L, p, sk, t) {
    for (let s = 0; s < 2; s++) {
      ctx.save();
      ctx.translate(s ? -L * 0.10 : 0, s ? L * 0.10 : -L * 0.05);
      ctx.globalAlpha = s ? 0.9 : 1;
      ctx.fillStyle = p.a;
      U.roundRect(ctx, -L * 0.16, -L * 0.05, L * 0.20, L * 0.10, L * 0.03); ctx.fill();
      ctx.save(); ctx.translate(L * 0.04, 0);
      blade(ctx, L * 0.42, L * 0.048, p.b, p.g, 0);
      ctx.restore();
      ctx.restore();
    }
    surface(ctx, sk, L * 0.06, -L * 0.04, L * 0.34, L * 0.05, t);
  };

  W.axe = function (ctx, L, p, sk, t) {
    U.roundRect(ctx, -L * 0.30, -L * 0.030, L * 0.90, L * 0.060, L * 0.02);
    ctx.fillStyle = D.lin(ctx, 0, -L * 0.03, 0, L * 0.03, [[0, U.shade(p.a, 0.3)], [1, U.shade(p.a, -0.4)]]); ctx.fill();
    ctx.save(); ctx.translate(L * 0.50, 0);
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.05);
    ctx.quadraticCurveTo(L * 0.28, -L * 0.34, L * 0.34, -L * 0.02);
    ctx.quadraticCurveTo(L * 0.28, L * 0.30, 0, L * 0.05);
    ctx.closePath();
    ctx.fillStyle = D.lin(ctx, 0, -L * 0.3, L * 0.34, L * 0.3, [[0, U.shade(p.b, 0.45)], [0.55, p.b], [1, U.shade(p.b, -0.35)]]);
    ctx.fill();
    ctx.strokeStyle = U.rgba(p.g, 0.7); ctx.lineWidth = 1.2; ctx.stroke();
    surface(ctx, sk, L * 0.04, 0, L * 0.24, L * 0.24, t);
    ctx.restore();
  };

  W.lance = function (ctx, L, p, sk, t) {
    U.roundRect(ctx, -L * 0.26, -L * 0.036, L * 1.06, L * 0.072, L * 0.03);
    ctx.fillStyle = D.lin(ctx, 0, -L * 0.04, 0, L * 0.04, [[0, U.shade(p.b, 0.4)], [0.5, p.b], [1, U.shade(p.b, -0.4)]]); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(L * 0.80, -L * 0.085); ctx.lineTo(L * 1.02, 0); ctx.lineTo(L * 0.80, L * 0.085); ctx.closePath();
    ctx.fillStyle = D.lin(ctx, L * 0.8, 0, L * 1.02, 0, [[0, p.c], [1, U.shade(p.c, 0.5)]]); ctx.fill();
    ctx.fillStyle = p.a;
    U.roundRect(ctx, L * 0.14, -L * 0.10, L * 0.16, L * 0.20, L * 0.04); ctx.fill();
    /* thruster flame */
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(t * 22) * 0.2;
    ctx.fillStyle = D.lin(ctx, -L * 0.26, 0, -L * 0.55, 0, [[0, U.rgba(p.g, 0.9)], [1, U.rgba(p.g, 0)]]);
    ctx.beginPath(); ctx.moveTo(-L * 0.26, -L * 0.05); ctx.lineTo(-L * 0.55, 0); ctx.lineTo(-L * 0.26, L * 0.05); ctx.closePath(); ctx.fill();
    ctx.restore();
    surface(ctx, sk, 0, 0, L * 0.70, L * 0.07, t);
  };

  W.staff = function (ctx, L, p, sk, t) {
    U.roundRect(ctx, -L * 0.42, -L * 0.026, L * 1.00, L * 0.052, L * 0.02);
    ctx.fillStyle = D.lin(ctx, 0, -L * 0.03, 0, L * 0.03, [[0, U.shade(p.a, 0.35)], [1, U.shade(p.a, -0.4)]]); ctx.fill();
    ctx.save(); ctx.translate(L * 0.56, 0);
    ctx.shadowColor = p.g; ctx.shadowBlur = 16;
    D.ring(ctx, 0, 0, L * 0.13, L * 0.032);
    ctx.fillStyle = p.c; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(0, 0, L * 0.062, 0, U.TAU);
    ctx.fillStyle = D.rad(ctx, 0, 0, 0, L * 0.07, [[0, U.shade(p.g, 0.55)], [1, U.rgba(p.g, 0.25)]]); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = t * 1.4 + i * 2.09;
      ctx.fillStyle = U.rgba(p.g, 0.75);
      ctx.beginPath(); ctx.arc(Math.cos(a) * L * 0.19, Math.sin(a) * L * 0.19, L * 0.018, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
    surface(ctx, sk, -L * 0.2, 0, L * 0.5, L * 0.05, t);
  };

  W.blasters = function (ctx, L, p, sk, t) {
    for (let s = 0; s < 2; s++) {
      ctx.save();
      ctx.translate(s ? -L * 0.09 : L * 0.02, s ? L * 0.12 : -L * 0.06);
      ctx.globalAlpha = s ? 0.92 : 1;
      ctx.fillStyle = D.lin(ctx, 0, -L * 0.05, 0, L * 0.05, [[0, U.shade(p.b, 0.4)], [1, U.shade(p.b, -0.4)]]);
      U.roundRect(ctx, -L * 0.08, -L * 0.055, L * 0.42, L * 0.11, L * 0.03); ctx.fill();
      ctx.fillStyle = p.a;
      U.roundRect(ctx, -L * 0.07, L * 0.02, L * 0.10, L * 0.17, L * 0.03); ctx.fill();
      ctx.fillStyle = p.c;
      U.roundRect(ctx, L * 0.26, -L * 0.026, L * 0.14, L * 0.052, L * 0.02); ctx.fill();
      ctx.fillStyle = U.rgba(p.g, 0.9);
      ctx.beginPath(); ctx.arc(L * 0.12, -L * 0.012, L * 0.02, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
    surface(ctx, sk, L * 0.0, -L * 0.05, L * 0.3, L * 0.08, t);
  };

  SB.WEAPON_DRAW = W;

  /* Public: draw a weapon of `shape` with grip at origin, blade along +x. */
  SB.drawWeapon = function (ctx, shape, pal, L, skin, t, alpha) {
    const fn = W[shape] || W.katana;
    ctx.save();
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha *= alpha;
    fn(ctx, L, pal, skin && !skin.none ? skin : null, t || 0);
    ctx.restore();
  };

  /* Default palette when no weapon skin is equipped — derived from the archetype. */
  SB.weaponPalette = function (arch, skin) {
    if (skin && !skin.none) {
      return { a: U.shade(skin.pal.a, -0.1), b: skin.pal.b, c: skin.pal.c, g: skin.pal.g };
    }
    return { a: '#3a3f4a', b: U.mixHex(arch.col, '#c9ced6', 0.45), c: arch.col2, g: arch.col };
  };
})(window.SB);
