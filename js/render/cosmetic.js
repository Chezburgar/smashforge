/* SMASHFORGE — procedural cosmetic renderers.
   Every function draws in fighter-local space (origin at the feet, y negative up,
   +x = facing). `sk` is the computed skeleton, `e` carries time/motion context. */
(function (SB) {
  'use strict';
  const U = SB.U, D = SB.D;
  const P = Math.PI;

  function frame(ctx, from, to) {
    ctx.translate(to.x, to.y);
    ctx.rotate(Math.atan2(to.y - from.y, to.x - from.x) + P / 2);
  }
  function glowOn(ctx, item) {
    if (item.glow > 0) { ctx.shadowColor = item.pal.g; ctx.shadowBlur = 5 + item.glow * 16; }
  }

  const C = {};
  SB.COS_DRAW = C;

  /* ============================= HEAD ============================= */
  C.head = function (ctx, item, sk, e) {
    const p = item.pal, R = sk.headR;
    ctx.save();
    frame(ctx, sk.neck, sk.head);
    glowOn(ctx, item);
    const s = item.v.s;
    switch (item.shape % 12) {
      case 0: { /* Hood */
        ctx.beginPath();
        ctx.moveTo(-R * 1.15, R * 0.9);
        ctx.quadraticCurveTo(-R * 1.35, -R * 1.15, 0, -R * 1.30 * s);
        ctx.quadraticCurveTo(R * 1.30, -R * 1.05, R * 1.02, R * 1.0);
        ctx.quadraticCurveTo(R * 0.4, R * 0.45, -R * 1.15, R * 0.9);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, -R, 0, R, [[0, U.shade(p.b, 0.25)], [1, U.shade(p.a, -0.2)]]);
        ctx.fill();
        ctx.fillStyle = U.rgba('#000', 0.42);
        ctx.beginPath(); ctx.ellipse(R * 0.30, R * 0.05, R * 0.62, R * 0.52, 0, 0, U.TAU); ctx.fill();
        break;
      }
      case 1: { /* Crown */
        const n = 3 + (item.v.n % 4);
        ctx.beginPath();
        ctx.moveTo(-R * 1.02, -R * 0.72);
        for (let i = 0; i <= n; i++) {
          const x = -R * 1.02 + (2.04 * R) * (i / n);
          ctx.lineTo(x, -R * (1.05 + 0.5 * s));
          if (i < n) ctx.lineTo(x + R * 1.02 / n, -R * 0.78);
        }
        ctx.lineTo(R * 1.02, -R * 0.55);
        ctx.lineTo(-R * 1.02, -R * 0.55);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, -R * 1.5, 0, -R * 0.5, [[0, U.shade(p.c, 0.4)], [1, p.b]]);
        ctx.fill();
        ctx.fillStyle = p.g;
        ctx.beginPath(); ctx.arc(0, -R * 0.72, R * 0.16, 0, U.TAU); ctx.fill();
        break;
      }
      case 2: { /* Warhelm */
        ctx.beginPath();
        ctx.ellipse(0, -R * 0.12, R * 1.12, R * 1.20 * s, 0, P, 0);
        ctx.lineTo(R * 1.12, R * 0.55);
        ctx.lineTo(-R * 1.12, R * 0.55);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, -R, -R, R, R, [[0, U.shade(p.b, 0.45)], [0.55, p.b], [1, U.shade(p.a, -0.15)]]);
        ctx.fill();
        ctx.fillStyle = U.rgba('#05070c', 0.9);
        U.roundRect(ctx, R * 0.10, -R * 0.36, R * 1.02, R * 0.26, R * 0.1); ctx.fill();
        ctx.fillStyle = p.g; ctx.globalAlpha = 0.85;
        ctx.fillRect(R * 0.18, -R * 0.30, R * 0.85, R * 0.09); ctx.globalAlpha = 1;
        ctx.fillStyle = p.c;
        ctx.fillRect(-R * 0.06, -R * 1.32 * s, R * 0.12, R * 1.0); /* crest ridge */
        break;
      }
      case 3: { /* Horns */
        for (let sd = -1; sd <= 1; sd += 2) {
          ctx.beginPath();
          ctx.moveTo(sd * R * 0.72, -R * 0.62);
          ctx.quadraticCurveTo(sd * R * 1.55, -R * 1.35 * s, sd * R * 1.05, -R * 2.05 * s);
          ctx.quadraticCurveTo(sd * R * 1.20, -R * 1.20, sd * R * 0.42, -R * 0.55);
          ctx.closePath();
          ctx.fillStyle = D.lin(ctx, sd * R, -R * 2, sd * R * 0.4, -R * 0.5,
            [[0, U.shade(p.c, 0.35)], [1, U.shade(p.a, -0.1)]]);
          ctx.fill();
        }
        ctx.fillStyle = p.b;
        U.roundRect(ctx, -R * 1.0, -R * 0.80, R * 2.0, R * 0.26, R * 0.1); ctx.fill();
        break;
      }
      case 4: { /* Topknot */
        ctx.fillStyle = p.b;
        U.roundRect(ctx, -R * 1.02, -R * 0.86, R * 2.04, R * 0.24, R * 0.1); ctx.fill();
        ctx.fillStyle = D.lin(ctx, 0, -R * 2, 0, -R, [[0, U.shade(p.c, 0.3)], [1, p.a]]);
        ctx.beginPath(); ctx.ellipse(-R * 0.12, -R * 1.30 * s, R * 0.42, R * 0.55, 0.2, 0, U.TAU); ctx.fill();
        ctx.strokeStyle = p.c; ctx.lineWidth = R * 0.14; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-R * 0.2, -R * 1.6 * s); ctx.quadraticCurveTo(-R * 1.1, -R * 1.9 * s, -R * 1.4, -R * 0.9); ctx.stroke();
        break;
      }
      case 5: { /* Visor Helm */
        ctx.beginPath(); ctx.ellipse(0, -R * 0.10, R * 1.08, R * 1.14 * s, 0, 0, U.TAU);
        ctx.fillStyle = D.lin(ctx, 0, -R * 1.2, 0, R * 0.8, [[0, U.shade(p.c, 0.35)], [0.6, p.b], [1, U.shade(p.a, -0.2)]]);
        ctx.fill();
        ctx.save(); ctx.shadowColor = p.g; ctx.shadowBlur = 14;
        ctx.fillStyle = p.g;
        ctx.beginPath();
        ctx.moveTo(-R * 0.2, -R * 0.42); ctx.lineTo(R * 1.05, -R * 0.30);
        ctx.lineTo(R * 1.0, R * 0.02); ctx.lineTo(-R * 0.2, -R * 0.08); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }
      case 6: { /* Halo Ring */
        ctx.save();
        ctx.translate(0, -R * (1.9 + Math.sin(e.t * 2) * 0.10));
        ctx.scale(1, 0.34);
        ctx.shadowColor = p.g; ctx.shadowBlur = 18;
        D.ring(ctx, 0, 0, R * 0.95 * s, R * 0.16);
        ctx.fillStyle = D.lin(ctx, -R, 0, R, 0, [[0, p.b], [0.5, U.shade(p.c, 0.4)], [1, p.b]]);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 7: { /* Antlers */
        for (let sd = -1; sd <= 1; sd += 2) {
          ctx.strokeStyle = D.lin(ctx, 0, -R * 2.4, 0, -R * 0.5, [[0, U.shade(p.c, 0.4)], [1, p.a]]);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.lineWidth = R * 0.20;
          ctx.beginPath();
          ctx.moveTo(sd * R * 0.55, -R * 0.70);
          ctx.quadraticCurveTo(sd * R * 1.10, -R * 1.60 * s, sd * R * 0.80, -R * 2.35 * s);
          ctx.stroke();
          ctx.lineWidth = R * 0.13;
          for (let i = 0; i < 3; i++) {
            const yy = -R * (1.05 + i * 0.45) * s;
            ctx.beginPath();
            ctx.moveTo(sd * R * (0.72 + i * 0.05), yy);
            ctx.lineTo(sd * R * (1.55 + i * 0.16), yy - R * 0.42);
            ctx.stroke();
          }
        }
        break;
      }
      case 8: { /* Plume Helm */
        ctx.beginPath(); ctx.ellipse(0, -R * 0.14, R * 1.06, R * 1.10, 0, P, 0);
        ctx.lineTo(R * 1.06, R * 0.4); ctx.lineTo(-R * 1.06, R * 0.4); ctx.closePath();
        ctx.fillStyle = D.lin(ctx, -R, -R, R, R, [[0, U.shade(p.b, 0.4)], [1, U.shade(p.a, -0.15)]]); ctx.fill();
        const pts = [];
        for (let i = 0; i <= 6; i++) {
          const u = i / 6;
          pts.push([-u * R * 1.9 - Math.sin(e.t * 3 + u * 3) * R * 0.14 * u,
            -R * (1.35 + 0.35 * Math.sin(u * P)) + u * R * 0.9]);
        }
        D.ribbon(ctx, pts, R * 0.34 * s, R * 0.05);
        ctx.fillStyle = D.lin(ctx, 0, -R * 1.6, -R * 2, 0, [[0, U.shade(p.c, 0.3)], [1, p.g]]); ctx.fill();
        break;
      }
      case 9: { /* Tricorn */
        ctx.beginPath();
        ctx.moveTo(-R * 1.7, -R * 0.55);
        ctx.quadraticCurveTo(0, -R * 1.35 * s, R * 1.7, -R * 0.55);
        ctx.quadraticCurveTo(R * 0.9, -R * 0.20, 0, -R * 0.28);
        ctx.quadraticCurveTo(-R * 0.9, -R * 0.20, -R * 1.7, -R * 0.55);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, -R * 1.4, 0, -R * 0.2, [[0, U.shade(p.b, 0.25)], [1, U.shade(p.a, -0.2)]]); ctx.fill();
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(R * 0.85, -R * 0.62, R * 0.18, 0, U.TAU); ctx.fill();
        break;
      }
      case 10: { /* Mane */
        const n = 12;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = P * 0.15 + (i / n) * P * 1.7;
          const rr = R * (1.35 + 0.28 * Math.sin(i * 2.3 + item.v.r)) * s;
          const x = -Math.sin(a) * rr, y = -Math.cos(a) * rr * 0.95 - R * 0.1;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = D.rad(ctx, 0, -R * 0.1, R * 0.4, R * 1.7, [[0, p.b], [1, U.shade(p.a, -0.25)]]);
        ctx.fill();
        break;
      }
      default: { /* Circlet */
        ctx.strokeStyle = D.lin(ctx, -R, 0, R, 0, [[0, p.a], [0.5, U.shade(p.c, 0.45)], [1, p.a]]);
        ctx.lineWidth = R * 0.16;
        ctx.beginPath(); ctx.ellipse(0, -R * 0.55, R * 1.06, R * 0.42, 0, P * 0.05, P * 0.95); ctx.stroke();
        ctx.fillStyle = p.g; ctx.shadowColor = p.g; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(R * 0.25, -R * 1.05); ctx.lineTo(R * 0.46, -R * 0.72); ctx.lineTo(R * 0.25, -R * 0.42); ctx.lineTo(R * 0.04, -R * 0.72); ctx.closePath(); ctx.fill();
        break;
      }
    }
    ctx.restore();
  };

  /* ============================= FACE ============================= */
  C.face = function (ctx, item, sk, e) {
    const p = item.pal, R = sk.headR;
    ctx.save();
    frame(ctx, sk.neck, sk.head);
    glowOn(ctx, item);
    switch (item.shape % 10) {
      case 0: /* Oni Mask */
        ctx.beginPath();
        ctx.moveTo(-R * 0.35, -R * 0.75); ctx.quadraticCurveTo(R * 1.05, -R * 0.85, R * 1.00, R * 0.05);
        ctx.quadraticCurveTo(R * 0.75, R * 0.85, R * 0.05, R * 0.70);
        ctx.quadraticCurveTo(-R * 0.45, R * 0.30, -R * 0.35, -R * 0.75);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, -R, 0, R, [[0, U.shade(p.b, 0.3)], [1, U.shade(p.a, -0.1)]]); ctx.fill();
        ctx.fillStyle = p.g;
        ctx.beginPath(); ctx.moveTo(R * 0.30, -R * 0.34); ctx.lineTo(R * 0.86, -R * 0.20); ctx.lineTo(R * 0.36, -R * 0.06); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f4f6fa';
        for (let i = 0; i < 3; i++) { D.spike(ctx, R * (0.35 + i * 0.22), R * 0.42, P / 2, R * 0.24, R * 0.07); ctx.fill(); }
        break;
      case 1: /* Optic Visor */
        ctx.save(); ctx.shadowColor = p.g; ctx.shadowBlur = 16;
        ctx.fillStyle = D.lin(ctx, -R * 0.3, 0, R, 0, [[0, U.shade(p.g, -0.2)], [1, U.shade(p.g, 0.5)]]);
        U.roundRect(ctx, -R * 0.25, -R * 0.38, R * 1.30, R * 0.30, R * 0.14); ctx.fill();
        ctx.restore();
        ctx.fillStyle = U.rgba('#fff', 0.55);
        ctx.fillRect(R * 0.4, -R * 0.34, R * 0.3, R * 0.07);
        break;
      case 2: /* Warpaint */
        ctx.fillStyle = U.rgba(p.b, 0.9);
        for (let i = 0; i < 3; i++) ctx.fillRect(R * (0.15 + i * 0.28), -R * 0.42, R * 0.13, R * 0.62);
        ctx.fillStyle = U.rgba(p.c, 0.8);
        ctx.fillRect(-R * 0.1, R * 0.20, R * 1.0, R * 0.10);
        break;
      case 3: /* Wrap Scarf */
        ctx.beginPath();
        ctx.moveTo(-R * 0.9, R * 0.05);
        ctx.quadraticCurveTo(R * 0.2, R * 0.30, R * 0.98, R * 0.02);
        ctx.quadraticCurveTo(R * 0.5, R * 0.95, -R * 0.85, R * 0.72);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, 0, 0, R, [[0, p.b], [1, U.shade(p.a, -0.15)]]); ctx.fill();
        break;
      case 4: /* Goggles */
        ctx.strokeStyle = p.a; ctx.lineWidth = R * 0.14;
        ctx.beginPath(); ctx.moveTo(-R * 0.85, -R * 0.28); ctx.lineTo(R * 0.85, -R * 0.28); ctx.stroke();
        for (let i = 0; i < 2; i++) {
          const x = R * (0.34 + i * 0.5);
          ctx.beginPath(); ctx.arc(x, -R * 0.26, R * 0.26, 0, U.TAU);
          ctx.fillStyle = D.rad(ctx, x - R * 0.08, -R * 0.34, 0, R * 0.3, [[0, U.shade(p.g, 0.6)], [1, p.b]]); ctx.fill();
          ctx.strokeStyle = p.c; ctx.lineWidth = R * 0.07; ctx.stroke();
        }
        break;
      case 5: /* Blindfold */
        ctx.fillStyle = D.lin(ctx, 0, -R * 0.5, 0, 0, [[0, p.b], [1, U.shade(p.a, -0.1)]]);
        U.roundRect(ctx, -R * 1.0, -R * 0.46, R * 2.05, R * 0.36, R * 0.06); ctx.fill();
        ctx.fillStyle = p.g; ctx.globalAlpha = 0.8;
        ctx.fillRect(R * 0.2, -R * 0.36, R * 0.55, R * 0.06); ctx.globalAlpha = 1;
        break;
      case 6: /* Fangs */
        ctx.fillStyle = '#f6f8fb';
        for (let i = 0; i < 2; i++) { D.spike(ctx, R * (0.45 + i * 0.30), R * 0.30, P / 2, R * 0.26, R * 0.07); ctx.fill(); }
        ctx.fillStyle = U.rgba(p.g, 0.6);
        ctx.beginPath(); ctx.arc(R * 0.6, R * 0.30, R * 0.30, 0, P); ctx.fill();
        break;
      case 7: /* Monocle */
        ctx.strokeStyle = p.c; ctx.lineWidth = R * 0.09;
        ctx.beginPath(); ctx.arc(R * 0.55, -R * 0.28, R * 0.28, 0, U.TAU); ctx.stroke();
        ctx.fillStyle = U.rgba(p.g, 0.30); ctx.fill();
        ctx.lineWidth = R * 0.04;
        ctx.beginPath(); ctx.moveTo(R * 0.35, -R * 0.05); ctx.quadraticCurveTo(R * 0.1, R * 0.45, -R * 0.35, R * 0.5); ctx.stroke();
        break;
      case 8: /* Respirator */
        ctx.fillStyle = D.lin(ctx, 0, 0, 0, R, [[0, U.shade(p.b, 0.3)], [1, U.shade(p.a, -0.2)]]);
        U.roundRect(ctx, R * 0.02, -R * 0.05, R * 1.0, R * 0.72, R * 0.18); ctx.fill();
        ctx.fillStyle = p.a;
        for (let i = 0; i < 3; i++) ctx.fillRect(R * (0.20 + i * 0.22), R * 0.12, R * 0.10, R * 0.42);
        ctx.fillStyle = p.g; ctx.beginPath(); ctx.arc(R * 0.90, R * 0.10, R * 0.10, 0, U.TAU); ctx.fill();
        break;
      default: /* Sigil Brand */
        ctx.save(); ctx.shadowColor = p.g; ctx.shadowBlur = 12;
        ctx.strokeStyle = p.g; ctx.lineWidth = R * 0.10;
        ctx.beginPath();
        ctx.arc(R * 0.5, -R * 0.20, R * 0.34, item.v.r, item.v.r + 4.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(R * 0.5, -R * 0.54); ctx.lineTo(R * 0.5, R * 0.30); ctx.stroke();
        ctx.restore();
        break;
    }
    ctx.restore();
  };

  /* ============================= TORSO ============================= */
  C.torso = function (ctx, item, sk, e) {
    const p = item.pal, h = sk.h;
    const w = 0.094 * h * e.build, hw = 0.080 * h * e.build;
    ctx.save();
    frame(ctx, sk.pelvis, sk.chest);
    glowOn(ctx, item);
    const L = Math.hypot(sk.chest.x - sk.pelvis.x, sk.chest.y - sk.pelvis.y);
    /* local frame: origin at chest, -y toward pelvis is +y here (frame points +? ) */
    ctx.translate(0, 0);
    const top = -L * 0.10, bot = L * 1.02;
    switch (item.shape % 12) {
      case 0: /* Cuirass */
        ctx.beginPath();
        ctx.moveTo(-w, top); ctx.lineTo(w, top);
        ctx.quadraticCurveTo(w * 1.1, bot * 0.6, hw * 0.85, bot);
        ctx.lineTo(-hw * 0.85, bot);
        ctx.quadraticCurveTo(-w * 1.1, bot * 0.6, -w, top);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, -w, 0, w, 0, [[0, U.shade(p.b, 0.35)], [0.5, p.b], [1, U.shade(p.a, -0.2)]]); ctx.fill();
        ctx.strokeStyle = U.rgba(p.c, 0.6); ctx.lineWidth = 1.3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(0, bot * 0.9); ctx.stroke();
        break;
      case 1: /* Robe */
        ctx.beginPath();
        ctx.moveTo(-w * 0.9, top); ctx.lineTo(w * 0.9, top);
        ctx.quadraticCurveTo(w * 1.5, bot, w * 1.25 + Math.sin(e.t * 2) * 2, bot * 1.5);
        ctx.lineTo(-w * 1.25 + Math.sin(e.t * 2) * 2, bot * 1.5);
        ctx.quadraticCurveTo(-w * 1.5, bot, -w * 0.9, top);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, top, 0, bot * 1.5, [[0, p.b], [1, U.shade(p.a, -0.25)]]); ctx.fill();
        ctx.strokeStyle = U.rgba(p.c, 0.55); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(0, bot * 1.45); ctx.stroke();
        break;
      case 2: /* Harness */
        ctx.strokeStyle = p.b; ctx.lineWidth = w * 0.30; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-w * 0.8, top); ctx.lineTo(w * 0.7, bot * 0.85); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w * 0.8, top); ctx.lineTo(-w * 0.7, bot * 0.85); ctx.stroke();
        ctx.strokeStyle = p.a; ctx.lineWidth = w * 0.24;
        ctx.beginPath(); ctx.moveTo(-w, bot * 0.8); ctx.lineTo(w, bot * 0.8); ctx.stroke();
        ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, bot * 0.45, w * 0.26, 0, U.TAU); ctx.fill();
        break;
      case 3: /* Duster */
        for (let s = -1; s <= 1; s += 2) {
          ctx.beginPath();
          ctx.moveTo(s * w * 0.15, top);
          ctx.lineTo(s * w * 1.15, top + L * 0.1);
          ctx.quadraticCurveTo(s * w * 1.35, bot * 1.2, s * (w * 0.95 + Math.sin(e.t * 2.4 + s) * 2.5), bot * 1.9);
          ctx.lineTo(s * w * 0.10, bot * 1.7);
          ctx.closePath();
          ctx.fillStyle = D.lin(ctx, 0, top, 0, bot * 1.9, [[0, U.shade(p.b, 0.2)], [1, U.shade(p.a, -0.3)]]); ctx.fill();
          ctx.strokeStyle = U.rgba(p.c, 0.45); ctx.lineWidth = 1.1; ctx.stroke();
        }
        break;
      case 4: /* Fullplate */
        for (let i = 0; i < 4; i++) {
          const y = top + (bot - top) * (i / 4);
          const ww = w * (1.02 - i * 0.06);
          U.roundRect(ctx, -ww, y, ww * 2, (bot - top) / 4 * 1.05, w * 0.2);
          ctx.fillStyle = D.lin(ctx, -ww, y, ww, y, [[0, U.shade(p.c, 0.2)], [0.4, p.b], [1, U.shade(p.a, -0.25)]]);
          ctx.fill();
          ctx.strokeStyle = U.rgba(p.a, 0.7); ctx.lineWidth = 1; ctx.stroke();
        }
        break;
      case 5: /* Chest Wraps */
        ctx.strokeStyle = p.b; ctx.lineWidth = w * 0.34;
        for (let i = 0; i < 5; i++) {
          const y = top + (bot - top) * (i / 5) + w * 0.2;
          ctx.beginPath(); ctx.moveTo(-w * 0.95, y - w * 0.1); ctx.lineTo(w * 0.95, y + w * 0.1); ctx.stroke();
        }
        break;
      case 6: /* Scale Vest */
        for (let r = 0; r < 5; r++) for (let cI = -2; cI <= 2; cI++) {
          const x = cI * w * 0.42, y = top + (bot - top) * (r / 5) + (Math.abs(cI) % 2) * w * 0.16;
          ctx.beginPath(); ctx.arc(x, y, w * 0.26, P, 0); ctx.closePath();
          ctx.fillStyle = r % 2 ? p.b : U.shade(p.b, -0.15); ctx.fill();
          ctx.strokeStyle = U.rgba(p.a, 0.5); ctx.lineWidth = 0.8; ctx.stroke();
        }
        break;
      case 7: /* Longcoat */
        ctx.beginPath();
        ctx.moveTo(-w * 1.05, top); ctx.lineTo(w * 1.05, top);
        ctx.quadraticCurveTo(w * 1.2, bot * 1.4, w * 0.9 + Math.sin(e.t * 2) * 3, bot * 2.3);
        ctx.lineTo(-w * 0.9 + Math.sin(e.t * 2) * 3, bot * 2.3);
        ctx.quadraticCurveTo(-w * 1.2, bot * 1.4, -w * 1.05, top);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, -w, 0, w, 0, [[0, U.shade(p.b, 0.25)], [0.5, p.b], [1, U.shade(p.a, -0.3)]]); ctx.fill();
        ctx.fillStyle = U.rgba(p.c, 0.85);
        ctx.fillRect(-w * 0.10, top, w * 0.20, (bot - top) * 2.2);
        break;
      case 8: /* Bandolier */
        ctx.strokeStyle = D.lin(ctx, -w, top, w, bot, [[0, p.b], [1, U.shade(p.a, -0.2)]]);
        ctx.lineWidth = w * 0.40;
        ctx.beginPath(); ctx.moveTo(-w * 0.85, top); ctx.lineTo(w * 0.80, bot * 0.95); ctx.stroke();
        ctx.fillStyle = p.c;
        for (let i = 0; i < 4; i++) {
          const u = 0.15 + i * 0.22;
          U.roundRect(ctx, U.lerp(-w * 0.85, w * 0.8, u) - w * 0.11, U.lerp(top, bot * 0.95, u) - w * 0.13, w * 0.22, w * 0.28, 2); ctx.fill();
        }
        break;
      case 9: /* Waist Sash */
        ctx.fillStyle = D.lin(ctx, 0, bot * 0.6, 0, bot * 1.1, [[0, p.b], [1, U.shade(p.a, -0.2)]]);
        U.roundRect(ctx, -w * 1.02, bot * 0.62, w * 2.04, (bot - top) * 0.28, 3); ctx.fill();
        const sway = Math.sin(e.t * 2.6) * 4;
        D.ribbon(ctx, [[w * 0.3, bot * 0.8], [w * 0.5 + sway, bot * 1.3], [w * 0.35 + sway * 1.6, bot * 1.9]], w * 0.3, w * 0.12);
        ctx.fillStyle = p.c; ctx.fill();
        break;
      case 10: /* Carapace */
        for (let i = 0; i < 5; i++) {
          const y = top + (bot - top) * (i / 5);
          ctx.beginPath();
          ctx.ellipse(0, y + w * 0.2, w * (1.02 - i * 0.05), w * 0.34, 0, P, 0);
          ctx.closePath();
          ctx.fillStyle = D.lin(ctx, -w, 0, w, 0, [[0, U.shade(p.c, 0.25)], [0.45, p.b], [1, U.shade(p.a, -0.3)]]);
          ctx.fill();
          ctx.strokeStyle = U.rgba(p.g, 0.35); ctx.lineWidth = 1; ctx.stroke();
        }
        break;
      default: /* Tunic */
        ctx.beginPath();
        ctx.moveTo(-w * 0.95, top); ctx.lineTo(w * 0.95, top);
        ctx.lineTo(w * 1.0, bot * 1.05); ctx.lineTo(-w * 1.0, bot * 1.05); ctx.closePath();
        ctx.fillStyle = D.lin(ctx, -w, 0, w, 0, [[0, U.shade(p.b, 0.3)], [1, U.shade(p.a, -0.15)]]); ctx.fill();
        ctx.fillStyle = p.c; ctx.fillRect(-w * 1.0, bot * 0.82, w * 2.0, w * 0.22);
        break;
    }
    ctx.restore();
  };

  /* ============================= SHOULDERS ============================= */
  C.shoulders = function (ctx, item, sk, e, which) {
    const p = item.pal, h = sk.h;
    const sh = which === 'B' ? sk.shB : sk.shF;
    const el = which === 'B' ? sk.elB : sk.elF;
    const s = 0.062 * h * item.v.s * e.build;
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.rotate(Math.atan2(el.y - sh.y, el.x - sh.x) - P / 2);
    if (which === 'B') ctx.globalAlpha *= 0.85;
    glowOn(ctx, item);
    switch (item.shape % 8) {
      case 0: /* Pauldrons */
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.15, s * 1.0, 0, P, 0); ctx.closePath();
        ctx.fillStyle = D.lin(ctx, -s, -s, s, s, [[0, U.shade(p.c, 0.3)], [0.5, p.b], [1, U.shade(p.a, -0.25)]]); ctx.fill();
        ctx.strokeStyle = U.rgba(p.a, 0.7); ctx.lineWidth = 1.2; ctx.stroke();
        break;
      case 1: /* Spiked Guards */
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.05, s * 0.9, 0, P, 0); ctx.closePath();
        ctx.fillStyle = p.b; ctx.fill();
        for (let i = 0; i < 3; i++) { ctx.fillStyle = p.c; D.spike(ctx, -s * 0.6 + i * s * 0.6, -s * 0.55, -P / 2 - 0.3 + i * 0.3, s * 0.85, s * 0.16); ctx.fill(); }
        break;
      case 2: /* Mantle */
        ctx.beginPath();
        ctx.moveTo(-s * 1.3, -s * 0.2); ctx.quadraticCurveTo(0, -s * 1.1, s * 1.3, -s * 0.2);
        ctx.quadraticCurveTo(s * 1.1, s * 1.3, 0, s * 1.5); ctx.quadraticCurveTo(-s * 1.1, s * 1.3, -s * 1.3, -s * 0.2);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, -s, 0, s * 1.5, [[0, p.b], [1, U.shade(p.a, -0.3)]]); ctx.fill();
        break;
      case 3: /* Epaulettes */
        U.roundRect(ctx, -s * 1.0, -s * 0.55, s * 2.0, s * 0.7, s * 0.22);
        ctx.fillStyle = D.lin(ctx, 0, -s * 0.5, 0, s * 0.2, [[0, U.shade(p.c, 0.35)], [1, p.b]]); ctx.fill();
        ctx.fillStyle = p.c;
        for (let i = 0; i < 4; i++) ctx.fillRect(-s * 0.8 + i * s * 0.45, s * 0.1, s * 0.12, s * 0.55);
        break;
      case 4: /* Winglets */
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, -s * 0.2);
          ctx.quadraticCurveTo(-s * (0.9 + i * 0.35), -s * (0.7 + i * 0.3), -s * (1.3 + i * 0.5), -s * (0.1 + i * 0.15));
          ctx.quadraticCurveTo(-s * 0.7, s * 0.2, 0, s * 0.2);
          ctx.closePath();
          ctx.fillStyle = U.rgba(i % 2 ? p.c : p.b, 0.9 - i * 0.15); ctx.fill();
        }
        break;
      case 5: /* Round Guards */
        ctx.beginPath(); ctx.arc(0, 0, s * 0.95, 0, U.TAU);
        ctx.fillStyle = D.rad(ctx, -s * 0.3, -s * 0.3, 0, s * 1.2, [[0, U.shade(p.c, 0.4)], [1, U.shade(p.a, -0.2)]]); ctx.fill();
        ctx.strokeStyle = U.rgba(p.g, 0.6); ctx.lineWidth = 1.4; ctx.stroke();
        break;
      case 6: /* Fur Ruff */
        for (let i = 0; i < 8; i++) {
          const a = P + (i / 7) * P;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * s * 1.5, Math.sin(a) * s * 1.5);
          ctx.lineTo(Math.cos(a + 0.34) * s * 1.35, Math.sin(a + 0.34) * s * 1.35);
          ctx.closePath();
          ctx.fillStyle = i % 2 ? p.b : U.shade(p.b, 0.2); ctx.fill();
        }
        break;
      default: /* Layered Plates */
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(0, i * s * 0.42, s * (1.05 - i * 0.16), s * 0.55, 0, P, 0); ctx.closePath();
          ctx.fillStyle = D.lin(ctx, -s, 0, s, 0, [[0, U.shade(p.c, 0.25)], [1, U.shade(p.a, -0.2)]]); ctx.fill();
          ctx.strokeStyle = U.rgba(p.a, 0.6); ctx.lineWidth = 1; ctx.stroke();
        }
        break;
    }
    ctx.restore();
  };

  /* ============================= ARMS ============================= */
  C.arms = function (ctx, item, sk, e, which) {
    const p = item.pal, h = sk.h;
    const el = which === 'B' ? sk.elB : sk.elF;
    const ha = which === 'B' ? sk.haB : sk.haF;
    const s = 0.040 * h * item.v.s * e.build;
    ctx.save();
    ctx.translate(ha.x, ha.y);
    ctx.rotate(Math.atan2(ha.y - el.y, ha.x - el.x));
    if (which === 'B') ctx.globalAlpha *= 0.85;
    glowOn(ctx, item);
    switch (item.shape % 8) {
      case 0: /* Bracers */
        ctx.translate(-s * 1.6, 0);
        U.roundRect(ctx, -s * 0.9, -s * 0.85, s * 1.9, s * 1.7, s * 0.35);
        ctx.fillStyle = D.lin(ctx, 0, -s, 0, s, [[0, U.shade(p.c, 0.3)], [0.5, p.b], [1, U.shade(p.a, -0.3)]]); ctx.fill();
        ctx.strokeStyle = U.rgba(p.g, 0.5); ctx.lineWidth = 1.1; ctx.stroke();
        break;
      case 1: /* Gloves */
        ctx.beginPath(); ctx.arc(0, 0, s * 1.0, 0, U.TAU);
        ctx.fillStyle = D.rad(ctx, -s * 0.3, -s * 0.3, 0, s * 1.3, [[0, U.shade(p.b, 0.3)], [1, U.shade(p.a, -0.2)]]); ctx.fill();
        ctx.fillStyle = p.c; ctx.fillRect(-s * 1.5, -s * 0.75, s * 0.5, s * 1.5);
        break;
      case 2: /* Claw Tips */
        ctx.fillStyle = p.b; ctx.beginPath(); ctx.arc(0, 0, s * 0.85, 0, U.TAU); ctx.fill();
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = U.shade(p.c, 0.2);
          D.spike(ctx, s * 0.5, -s * 0.6 + i * s * 0.6, -0.35 + i * 0.35, s * 1.5, s * 0.16); ctx.fill();
        }
        break;
      case 3: /* Hand Wraps */
        ctx.strokeStyle = p.b; ctx.lineWidth = s * 0.36;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-s * (0.2 + i * 0.55), -s * 0.8); ctx.lineTo(-s * (0.0 + i * 0.55), s * 0.8); ctx.stroke();
        }
        break;
      case 4: /* Gauntlets */
        ctx.translate(-s * 0.8, 0);
        U.roundRect(ctx, -s * 1.5, -s * 1.0, s * 3.0, s * 2.0, s * 0.4);
        ctx.fillStyle = D.lin(ctx, 0, -s, 0, s, [[0, U.shade(p.c, 0.35)], [0.45, p.b], [1, U.shade(p.a, -0.35)]]); ctx.fill();
        ctx.fillStyle = p.c;
        for (let i = 0; i < 3; i++) ctx.fillRect(-s * 1.2 + i * s * 0.9, -s * 1.0, s * 0.24, s * 2.0);
        break;
      case 5: /* Signet Rings */
        ctx.fillStyle = p.c; ctx.shadowColor = p.g; ctx.shadowBlur = 8;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.55 + i * s * 0.55, s * 0.22, 0, U.TAU); ctx.fill(); }
        break;
      case 6: /* Talons */
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 ? p.c : p.b;
          D.spike(ctx, s * 0.3, -s * 0.85 + i * s * 0.55, -0.5 + i * 0.33, s * 1.9, s * 0.13); ctx.fill();
        }
        break;
      default: /* Wide Cuffs */
        ctx.translate(-s * 1.9, 0);
        ctx.beginPath();
        ctx.moveTo(-s * 1.1, -s * 1.3); ctx.lineTo(s * 0.7, -s * 0.7);
        ctx.lineTo(s * 0.7, s * 0.7); ctx.lineTo(-s * 1.1, s * 1.3); ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, -s, 0, s, [[0, p.b], [1, U.shade(p.a, -0.25)]]); ctx.fill();
        ctx.strokeStyle = U.rgba(p.c, 0.7); ctx.lineWidth = 1.2; ctx.stroke();
        break;
    }
    ctx.restore();
  };

  /* ============================= LEGS ============================= */
  C.legs = function (ctx, item, sk, e, which) {
    const p = item.pal, h = sk.h;
    const kn = which === 'B' ? sk.knB : sk.knF;
    const ft = which === 'B' ? sk.ftB : sk.ftF;
    const s = 0.048 * h * item.v.s * e.build;
    ctx.save();
    ctx.translate(ft.x, ft.y);
    ctx.rotate(Math.atan2(ft.y - kn.y, ft.x - kn.x) - P / 2);
    if (which === 'B') ctx.globalAlpha *= 0.85;
    glowOn(ctx, item);
    switch (item.shape % 8) {
      case 0: /* Greaves */
        U.roundRect(ctx, -s * 0.75, -s * 2.2, s * 1.5, s * 2.1, s * 0.3);
        ctx.fillStyle = D.lin(ctx, -s, 0, s, 0, [[0, U.shade(p.c, 0.3)], [0.5, p.b], [1, U.shade(p.a, -0.3)]]); ctx.fill();
        ctx.strokeStyle = U.rgba(p.g, 0.45); ctx.lineWidth = 1.1; ctx.stroke();
        ctx.fillStyle = p.a; U.roundRect(ctx, -s * 0.6, -s * 0.25, s * 2.0, s * 0.5, s * 0.2); ctx.fill();
        break;
      case 1: /* Boots */
        ctx.fillStyle = D.lin(ctx, 0, -s * 1.6, 0, s * 0.3, [[0, p.b], [1, U.shade(p.a, -0.25)]]);
        U.roundRect(ctx, -s * 0.7, -s * 1.7, s * 1.4, s * 1.7, s * 0.25); ctx.fill();
        ctx.fillStyle = U.shade(p.a, -0.1);
        U.roundRect(ctx, -s * 0.7, -s * 0.35, s * 2.1, s * 0.6, s * 0.22); ctx.fill();
        ctx.fillStyle = p.c; ctx.fillRect(-s * 0.7, -s * 1.7, s * 1.4, s * 0.22);
        break;
      case 2: /* Sabatons */
        for (let i = 0; i < 3; i++) {
          U.roundRect(ctx, -s * (0.72 - i * 0.06), -s * (2.0 - i * 0.62), s * (1.44 - i * 0.12), s * 0.6, s * 0.16);
          ctx.fillStyle = i % 2 ? p.b : U.shade(p.b, 0.18); ctx.fill();
          ctx.strokeStyle = U.rgba(p.a, 0.6); ctx.lineWidth = 0.9; ctx.stroke();
        }
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.moveTo(-s * 0.7, s * 0.2); ctx.lineTo(s * 1.5, s * 0.05); ctx.lineTo(s * 1.5, -s * 0.4); ctx.lineTo(-s * 0.7, -s * 0.3); ctx.closePath(); ctx.fill();
        break;
      case 3: /* Leg Wraps */
        ctx.strokeStyle = p.b; ctx.lineWidth = s * 0.34;
        for (let i = 0; i < 5; i++) {
          const y = -s * (0.2 + i * 0.42);
          ctx.beginPath(); ctx.moveTo(-s * 0.65, y); ctx.lineTo(s * 0.65, y - s * 0.12); ctx.stroke();
        }
        break;
      case 4: /* War Kilt */
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.moveTo(i * s * 0.42, -s * 3.6);
          ctx.lineTo(i * s * 0.42 + s * 0.38, -s * 3.6);
          ctx.lineTo(i * s * 0.46 + s * 0.30, -s * 2.1);
          ctx.lineTo(i * s * 0.46, -s * 2.1);
          ctx.closePath();
          ctx.fillStyle = i % 2 ? p.b : U.shade(p.a, 0.1); ctx.fill();
        }
        break;
      case 5: /* Hakama */
        ctx.beginPath();
        ctx.moveTo(-s * 0.9, -s * 3.8); ctx.lineTo(s * 0.9, -s * 3.8);
        ctx.lineTo(s * 1.35 + Math.sin(e.t * 3) * 1.5, -s * 0.6);
        ctx.lineTo(-s * 1.35 + Math.sin(e.t * 3) * 1.5, -s * 0.6);
        ctx.closePath();
        ctx.fillStyle = D.lin(ctx, 0, -s * 3.8, 0, -s * 0.6, [[0, p.b], [1, U.shade(p.a, -0.25)]]); ctx.fill();
        break;
      case 6: /* Treads */
        ctx.fillStyle = p.a;
        U.roundRect(ctx, -s * 0.85, -s * 0.55, s * 2.3, s * 0.85, s * 0.2); ctx.fill();
        ctx.fillStyle = p.c;
        for (let i = 0; i < 4; i++) ctx.fillRect(-s * 0.7 + i * s * 0.55, s * 0.05, s * 0.3, s * 0.25);
        ctx.fillStyle = p.b; U.roundRect(ctx, -s * 0.7, -s * 1.5, s * 1.4, s * 1.0, s * 0.2); ctx.fill();
        break;
      default: /* Sandals */
        ctx.fillStyle = p.b;
        U.roundRect(ctx, -s * 0.7, -s * 0.2, s * 2.0, s * 0.35, s * 0.15); ctx.fill();
        ctx.strokeStyle = p.c; ctx.lineWidth = s * 0.18;
        ctx.beginPath(); ctx.moveTo(s * 0.7, -s * 0.15); ctx.lineTo(0, -s * 1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.15); ctx.lineTo(0, -s * 1.2); ctx.stroke();
        break;
    }
    ctx.restore();
  };

  /* ============================= BACK ============================= */
  C.back = function (ctx, item, sk, e) {
    const p = item.pal, h = sk.h;
    const s = 0.10 * h * item.v.s;
    const sway = Math.sin(e.t * 2.2) * 0.10 + U.clamp(-e.vx * 0.020, -0.55, 0.55);
    const lift = U.clamp(-e.vy * 0.012, -0.35, 0.55);
    ctx.save();
    frame(ctx, sk.pelvis, sk.chest);
    glowOn(ctx, item);
    const segs = (t, len, w0, w1) => {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        pts.push([-u * len * (0.35 + sway * 0.9) - Math.sin(e.t * 3 + u * 4) * s * 0.10 * u,
          -s * 0.2 + u * len * (0.95 + lift * 0.4)]);
      }
      D.ribbon(ctx, pts, w0, w1);
    };
    switch (item.shape % 10) {
      case 0: /* Cape */
        segs(e.t, s * 3.2, s * 0.65, s * 1.05);
        ctx.fillStyle = D.lin(ctx, 0, -s, 0, s * 3, [[0, U.shade(p.b, 0.25)], [1, U.shade(p.a, -0.35)]]); ctx.fill();
        break;
      case 1: /* Hooded Cloak */
        segs(e.t, s * 3.6, s * 0.75, s * 1.25);
        ctx.fillStyle = D.lin(ctx, 0, -s, 0, s * 3.4, [[0, p.b], [1, U.shade(p.a, -0.4)]]); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-s * 0.25, -s * 0.75, s * 0.75, s * 0.62, 0.2, 0, U.TAU);
        ctx.fillStyle = U.shade(p.a, 0.05); ctx.fill();
        break;
      case 2: /* Wings */
        for (let w = 0; w < 2; w++) {
          ctx.save();
          ctx.scale(w ? 0.78 : 1, 1); ctx.globalAlpha *= w ? 0.6 : 1;
          const flap = Math.sin(e.t * 3 + w) * 0.16 + lift * 0.35;
          for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(0, -s * 0.3);
            ctx.quadraticCurveTo(-s * (1.2 + i * 0.5), -s * (1.4 + i * 0.3) + flap * s * 2,
              -s * (1.6 + i * 0.75), -s * (0.2 - i * 0.42) + flap * s * 2.4);
            ctx.quadraticCurveTo(-s * 0.9, s * 0.35, 0, s * 0.15);
            ctx.closePath();
            ctx.fillStyle = U.rgba(i % 2 ? p.b : p.c, 0.92 - i * 0.13); ctx.fill();
          }
          ctx.restore();
        }
        break;
      case 3: /* War Banner */
        ctx.strokeStyle = p.a; ctx.lineWidth = s * 0.14;
        ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 1.4); ctx.lineTo(-s * 0.35, s * 2.4); ctx.stroke();
        const bp = [];
        for (let i = 0; i <= 5; i++) bp.push([-s * 0.35 - i * s * 0.3, -s * 1.2 + i * s * 0.42 + Math.sin(e.t * 3 + i) * s * 0.1]);
        D.ribbon(ctx, bp, s * 0.55, s * 0.45);
        ctx.fillStyle = D.lin(ctx, 0, -s, -s * 2, s, [[0, p.b], [1, U.shade(p.a, -0.2)]]); ctx.fill();
        ctx.fillStyle = U.rgba(p.g, 0.8);
        ctx.beginPath(); ctx.arc(-s * 1.1, -s * 0.1, s * 0.24, 0, U.TAU); ctx.fill();
        break;
      case 4: /* Thruster Pack */
        ctx.fillStyle = D.lin(ctx, -s, 0, s * 0.4, 0, [[0, U.shade(p.a, -0.2)], [1, p.b]]);
        U.roundRect(ctx, -s * 0.95, -s * 0.9, s * 0.95, s * 1.9, s * 0.2); ctx.fill();
        for (let i = 0; i < 2; i++) {
          const y = -s * 0.4 + i * s * 0.95;
          ctx.fillStyle = p.a; U.roundRect(ctx, -s * 1.1, y - s * 0.2, s * 0.35, s * 0.4, s * 0.12); ctx.fill();
          ctx.globalAlpha = 0.55 + Math.sin(e.t * 20 + i) * 0.2;
          ctx.fillStyle = D.lin(ctx, -s * 1.1, 0, -s * 2.1, 0, [[0, p.g], [1, U.rgba(p.g, 0)]]);
          ctx.beginPath(); ctx.moveTo(-s * 1.1, y - s * 0.18); ctx.lineTo(-s * 2.0, y); ctx.lineTo(-s * 1.1, y + s * 0.18); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 1;
        }
        break;
      case 5: /* Trailing Scarf */
        for (let k = 0; k < 2; k++) {
          const pts = [];
          for (let i = 0; i <= 7; i++) {
            const u = i / 7;
            pts.push([-u * s * 3.4 * (0.4 + sway) - Math.sin(e.t * 4 + u * 5 + k) * s * 0.22 * u,
              -s * 0.9 + u * s * 0.7 + k * s * 0.3 + Math.cos(e.t * 3.4 + u * 4 + k) * s * 0.18 * u]);
          }
          D.ribbon(ctx, pts, s * 0.24, s * 0.06);
          ctx.fillStyle = k ? U.shade(p.a, 0.1) : p.b; ctx.fill();
        }
        break;
      case 6: /* Floating Tome */
        ctx.save();
        ctx.translate(-s * 1.5, -s * 0.5 + Math.sin(e.t * 2) * s * 0.2);
        ctx.rotate(Math.sin(e.t * 1.4) * 0.24);
        ctx.fillStyle = p.b; U.roundRect(ctx, -s * 0.5, -s * 0.65, s * 1.0, s * 1.3, s * 0.1); ctx.fill();
        ctx.fillStyle = U.shade(p.c, 0.4); ctx.fillRect(-s * 0.36, -s * 0.5, s * 0.72, s * 1.0);
        ctx.fillStyle = p.g; ctx.shadowColor = p.g; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(0, 0, s * 0.16, 0, U.TAU); ctx.fill();
        ctx.restore();
        break;
      case 7: /* Quiver */
        ctx.save(); ctx.rotate(-0.35);
        ctx.fillStyle = D.lin(ctx, -s, 0, 0, 0, [[0, U.shade(p.a, -0.15)], [1, p.b]]);
        U.roundRect(ctx, -s * 1.15, -s * 0.7, s * 0.7, s * 2.2, s * 0.16); ctx.fill();
        for (let i = 0; i < 4; i++) {
          ctx.strokeStyle = p.c; ctx.lineWidth = s * 0.07;
          ctx.beginPath(); ctx.moveTo(-s * (1.0 - i * 0.14), -s * 0.7); ctx.lineTo(-s * (1.15 - i * 0.16), -s * 1.5); ctx.stroke();
          ctx.fillStyle = p.g;
          ctx.beginPath(); ctx.arc(-s * (1.15 - i * 0.16), -s * 1.55, s * 0.09, 0, U.TAU); ctx.fill();
        }
        ctx.restore();
        break;
      case 8: /* Halo Wheel */
        ctx.save();
        ctx.translate(-s * 1.2, -s * 0.4);
        ctx.rotate(e.t * 0.8);
        ctx.shadowColor = p.g; ctx.shadowBlur = 16;
        D.ring(ctx, 0, 0, s * 1.15, s * 0.14); ctx.fillStyle = p.c; ctx.fill();
        ctx.shadowBlur = 0;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * U.TAU;
          ctx.fillStyle = U.rgba(p.g, 0.8);
          D.spike(ctx, Math.cos(a) * s * 1.15, Math.sin(a) * s * 1.15, a, s * 0.4, s * 0.08); ctx.fill();
        }
        ctx.restore();
        break;
      default: /* Beast Tail */
        const tp = [];
        for (let i = 0; i <= 7; i++) {
          const u = i / 7;
          tp.push([-u * s * 2.8 * (0.5 + sway * 0.6), s * 0.6 + Math.sin(e.t * 3 + u * 4) * s * 0.4 * u + u * s * 0.5]);
        }
        D.ribbon(ctx, tp, s * 0.34, s * 0.07);
        ctx.fillStyle = D.lin(ctx, 0, 0, -s * 3, s, [[0, p.b], [1, U.shade(p.a, -0.2)]]); ctx.fill();
        break;
    }
    ctx.restore();
  };

  /* ============================= AURA ============================= */
  /* drawn behind the fighter, centred on the body, in local space */
  C.aura = function (ctx, item, sk, e) {
    if (item.none) return;
    const p = item.pal, h = sk.h, t = e.t;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cy = -h * 0.5;
    const n = 6 + item.v.n;
    switch (item.shape % 10) {
      case 0: /* Embers */
        for (let i = 0; i < n; i++) {
          const u = ((t * 0.5 + i / n) % 1);
          const x = Math.sin(i * 2.7 + t * 1.3) * h * 0.30;
          const y = -u * h * 1.15;
          ctx.globalAlpha = (1 - u) * 0.7;
          ctx.fillStyle = p.g;
          ctx.beginPath(); ctx.arc(x, y, h * 0.016 * (1 - u * 0.5), 0, U.TAU); ctx.fill();
        }
        break;
      case 1: /* Drifting Motes */
        for (let i = 0; i < n; i++) {
          const a = t * 0.6 + i * 1.9;
          ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 2 + i);
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(Math.cos(a) * h * 0.34, cy + Math.sin(a * 1.3) * h * 0.38, h * 0.013, 0, U.TAU); ctx.fill();
        }
        break;
      case 2: /* Orbit Rings */
        for (let i = 0; i < 3; i++) {
          ctx.save(); ctx.translate(0, cy); ctx.rotate(t * (0.5 + i * 0.3) + i);
          ctx.scale(1, 0.30);
          ctx.globalAlpha = 0.30;
          D.ring(ctx, 0, 0, h * (0.30 + i * 0.09), h * 0.010); ctx.fillStyle = p.g; ctx.fill();
          ctx.restore();
        }
        break;
      case 3: /* Static Field */
        ctx.strokeStyle = p.g; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.5;
        for (let i = 0; i < 4; i++) {
          const a0 = t * 5 + i * 1.6;
          ctx.beginPath();
          for (let k = 0; k <= 5; k++) {
            const a = a0 + k * 0.4, r = h * (0.24 + (k % 2) * 0.10);
            ctx.lineTo(Math.cos(a) * r, cy + Math.sin(a) * r * 1.3);
          }
          ctx.stroke();
        }
        break;
      case 4: /* Falling Petals */
        for (let i = 0; i < n; i++) {
          const u = ((t * 0.28 + i / n) % 1);
          const x = Math.sin(i * 3.1 + t * 0.9) * h * 0.38;
          const y = -h * 1.1 + u * h * 1.25;
          ctx.globalAlpha = 0.55 * Math.sin(u * P);
          ctx.fillStyle = p.c;
          ctx.save(); ctx.translate(x, y); ctx.rotate(t * 2 + i);
          ctx.beginPath(); ctx.ellipse(0, 0, h * 0.020, h * 0.010, 0, 0, U.TAU); ctx.fill();
          ctx.restore();
        }
        break;
      case 5: /* Frost Motes */
        for (let i = 0; i < n; i++) {
          const a = t * 0.4 + i * 1.6;
          const r = h * (0.24 + 0.12 * Math.sin(t + i));
          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = p.c; ctx.lineWidth = 1.1;
          const x = Math.cos(a) * r, y = cy + Math.sin(a) * r * 1.2;
          for (let k = 0; k < 3; k++) {
            const aa = k * 1.05 + t;
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(aa) * h * 0.014, y - Math.sin(aa) * h * 0.014);
            ctx.lineTo(x + Math.cos(aa) * h * 0.014, y + Math.sin(aa) * h * 0.014);
            ctx.stroke();
          }
        }
        break;
      case 6: /* Spark Ring */
        ctx.save(); ctx.translate(0, -h * 0.02); ctx.scale(1, 0.32);
        ctx.globalAlpha = 0.4 + 0.15 * Math.sin(t * 5);
        D.ring(ctx, 0, 0, h * 0.36, h * 0.03); ctx.fillStyle = p.g; ctx.fill();
        ctx.restore();
        for (let i = 0; i < 5; i++) {
          const a = t * 3 + i * 1.25;
          ctx.globalAlpha = 0.6;
          ctx.fillStyle = p.c;
          ctx.beginPath(); ctx.arc(Math.cos(a) * h * 0.36, -h * 0.02 + Math.sin(a) * h * 0.11, h * 0.012, 0, U.TAU); ctx.fill();
        }
        break;
      case 7: /* Shadow Wisps */
        ctx.globalCompositeOperation = 'source-over';
        for (let i = 0; i < 5; i++) {
          const a = t * 0.7 + i * 1.3;
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = p.a;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * h * 0.26, cy + Math.sin(a * 1.2) * h * 0.3, h * 0.07, h * 0.16, a, 0, U.TAU);
          ctx.fill();
        }
        break;
      case 8: /* Bubbles */
        for (let i = 0; i < n; i++) {
          const u = ((t * 0.35 + i / n) % 1);
          ctx.globalAlpha = (1 - u) * 0.45;
          ctx.strokeStyle = p.c; ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(Math.sin(i * 2.2 + t) * h * 0.28, -u * h * 1.1, h * (0.012 + 0.02 * (i % 3) / 3), 0, U.TAU);
          ctx.stroke();
        }
        break;
      default: /* Rune Circle */
        ctx.save(); ctx.translate(0, -h * 0.01); ctx.scale(1, 0.30); ctx.rotate(t * 0.5);
        ctx.globalAlpha = 0.42;
        D.ring(ctx, 0, 0, h * 0.42, h * 0.012); ctx.fillStyle = p.g; ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * U.TAU;
          ctx.fillStyle = p.c;
          ctx.fillRect(Math.cos(a) * h * 0.42 - h * 0.012, Math.sin(a) * h * 0.42 - h * 0.03, h * 0.024, h * 0.06);
        }
        ctx.restore();
        break;
    }
    ctx.restore();
  };
})(window.SB);
