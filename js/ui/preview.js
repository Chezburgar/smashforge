/* SMASHFORGE — live fighter preview rig + cosmetic thumbnail renderer. */
(function (SB) {
  'use strict';
  const U = SB.U, D = SB.D;

  /* A tiny flat world so the real Fighter code can run in the preview. */
  const PREV_STAGE = {
    id: '_preview',
    ground: { x: -900, y: 0, w: 1800, h: 200 },
    plats: [],
    solids: [{ x: -900, y: 0, w: 1800, h: 200, soft: false }],
    spawns: [{ x: 0, y: 0 }],
    blast: { l: -3000, r: 3000, t: -3000, b: 3000 },
    rim: '#bcd9ff'
  };

  function Rig(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.cmd = new SB.Cmd();
    this.world = {
      stage: PREV_STAGE, fighters: [], projectiles: [], teams: null,
      spawnProjectile: function (owner, mv, x, y, ang) {
        if (this.projectiles.length > 10) this.projectiles.shift();
        this.projectiles.push(new SB.Projectile(owner, mv, x, y, ang));
      },
      onKO: function () { }
    };
    this.t = 0;
    this.queue = null;
    this.idleGap = 0;
    this.autoCycle = false;
    this.f = null;
  }
  SB.Rig = Rig;

  Rig.prototype.setBuild = function (spec) {
    this.f = new SB.Fighter(spec, { x: 0, y: 0, dir: 1, playerCol: spec.col ? spec.col.glow : '#4fc3f7' });
    this.f.stageRim = '#bcd9ff';
    this.f.invuln = 0;
    this.f.grounded = true;
    this.world.fighters = [this.f];
    this.world.projectiles.length = 0;
  };

  Rig.prototype.play = function (slotOrMove) {
    if (!this.f) return;
    const mv = typeof slotOrMove === 'string' ? (this.f.kit[slotOrMove] || SB.MOVE(slotOrMove)) : slotOrMove;
    if (!mv) return;
    this.f.move = null; this.f.mvTiming = null; this.f.chargeT = 0;
    this.f.hitstun = 0; this.f.hitstop = 0;
    this.f.vx = 0; this.f.vy = 0;
    this.f.x = 0;
    if (mv.air || mv.slot === 'recov' || mv.slot === 'gp') {
      this.f.grounded = false; this.f.y = -150; this.f.vy = mv.slot === 'gp' ? -2 : 0;
    } else { this.f.y = 0; this.f.grounded = true; }
    this.f.startMove(mv);
    this.queue = mv;
    this.idleGap = 0;
  };

  Rig.prototype.step = function () {
    if (!this.f) return;
    this.t += 1 / 60;
    const f = this.f;
    this.cmd.clear();
    /* keep the preview fighter home and upright */
    if (!f.move && f.hitstun <= 0) {
      f.vx *= 0.7;
      if (f.grounded) f.x = U.damp(f.x, 0, 6, 1 / 60);
      if (!f.grounded && f.y > -6) { f.y = 0; f.grounded = true; f.vy = 0; }
      this.idleGap++;
      if (this.autoCycle && this.idleGap > 70) {
        const slots = SB.SLOT_ORDER;
        this.play(slots[Math.floor(Math.random() * slots.length)]);
      }
    }
    f.update(this.cmd, this.world);
    if (f.x < -260) f.x = -260;
    if (f.x > 260) f.x = 260;
    if (f.y > 0) { f.y = 0; f.grounded = true; f.vy = 0; }
    for (let i = this.world.projectiles.length - 1; i >= 0; i--) {
      const p = this.world.projectiles[i];
      p.update(this.world);
      if (p.dead) this.world.projectiles.splice(i, 1);
    }
  };

  Rig.prototype.draw = function () {
    const cv = this.cv, ctx = this.ctx, f = this.f;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 360, H = cv.clientHeight || 340;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!f) return;

    /* backdrop */
    const g = ctx.createRadialGradient(W / 2, H * 0.34, 10, W / 2, H * 0.5, H * 0.9);
    g.addColorStop(0, 'rgba(79,195,247,0.13)');
    g.addColorStop(1, 'rgba(6,9,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    const scale = Math.min(1.5, (H * 0.62) / f.h);
    const baseY = H * 0.86;
    ctx.save();
    ctx.translate(W / 2, baseY);
    ctx.scale(scale, scale);
    ctx.translate(-f.x, 0);

    /* floor disc */
    ctx.save();
    ctx.globalAlpha = 0.30;
    const fg = ctx.createLinearGradient(0, 0, 0, 26);
    fg.addColorStop(0, 'rgba(150,200,255,0.35)');
    fg.addColorStop(1, 'rgba(150,200,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.ellipse(f.x, 2, f.h * 0.62, 13, 0, 0, U.TAU); ctx.fill();
    ctx.restore();

    for (const p of this.world.projectiles) p.draw(ctx, this.t);

    if (f.trail.length > 2 && f.move) {
      const style = f.cosItems.trail && !f.cosItems.trail.none ? f.cosItems.trail.shape : 3;
      SB.FX.drawTrail(ctx, f.trail, f.move.fx.col, f.move.fx.col2, f.h * 0.10 * (f.arch.trailW || 1), style, 0.95);
    }
    SB.drawFighter(ctx, f, this.t, {});
    ctx.restore();

    /* move readout */
    if (f.move) {
      const T = f.mvTiming;
      const phase = f.mvFrame <= T.startup ? 'STARTUP' : (f.mvFrame <= T.startup + T.active ? 'ACTIVE' : 'RECOVERY');
      const col = phase === 'ACTIVE' ? '#ff6b7a' : phase === 'STARTUP' ? '#ffd24a' : '#7fb3ff';
      U.text(ctx, f.move.name, W / 2, 24, { size: 15, align: 'center', weight: 800, fill: '#eaf2ff', stroke: 'rgba(4,7,14,.8)', lw: 4 });
      U.text(ctx, phase + '  ' + f.mvFrame + '/' + T.total, W / 2, 42, { size: 12, align: 'center', weight: 700, fill: col });
      const bw = W * 0.7, bx = (W - bw) / 2;
      ctx.fillStyle = 'rgba(255,255,255,.10)'; U.roundRect(ctx, bx, 48, bw, 5, 3); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.fillRect(bx, 48, bw * (T.startup / T.total), 5);
      ctx.fillStyle = '#ff6b7a'; ctx.fillRect(bx + bw * (T.startup / T.total), 48, bw * (T.active / T.total), 5);
      ctx.fillStyle = '#4f80c0'; ctx.fillRect(bx + bw * ((T.startup + T.active) / T.total), 48, bw * (T.recovery / T.total), 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx + bw * (f.mvFrame / T.total) - 1, 45, 2, 11);
    }
  };

  /* ---------------- static thumbnails ---------------- */
  SB.renderThumb = function (canvas, spec, opt) {
    opt = opt || {};
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 200, H = canvas.clientHeight || 150;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    let f;
    try { f = new SB.Fighter(spec, { x: 0, y: 0, dir: 1 }); } catch (e) { return; }
    f.stageRim = '#bcd9ff';
    f.pose = SB.POSES.idle(opt.t === undefined ? 0.7 : opt.t);
    f.skel = SB.computeSkel(f.pose, f.h, f.build);
    const sc = Math.min(1.6, (H * 0.80) / f.h);
    ctx.save();
    ctx.translate(W / 2, H * 0.94);
    ctx.scale(sc, sc);
    ctx.globalAlpha = 0.35;
    const fg = ctx.createLinearGradient(0, 0, 0, 20);
    fg.addColorStop(0, 'rgba(150,200,255,0.4)'); fg.addColorStop(1, 'rgba(150,200,255,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.ellipse(0, 2, f.h * 0.5, 10, 0, 0, U.TAU); ctx.fill();
    ctx.globalAlpha = 1;
    SB.drawFighter(ctx, f, 0.7, {});
    ctx.restore();
  };

  /* Cosmetic item thumbnail — draws just the piece, on a ghost rig for context. */
  SB.drawCosThumb = function (canvas, item) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = canvas.clientWidth || 130, H = canvas.clientHeight || 72;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    if (item.none) {
      U.text(ctx, '—', W / 2, H / 2 + 7, { size: 22, align: 'center', fill: '#4a5769' });
      return;
    }
    const p = item.pal;
    const bg = ctx.createRadialGradient(W / 2, H * 0.42, 2, W / 2, H * 0.5, H);
    bg.addColorStop(0, U.rgba(p.g, 0.13)); bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const h = 78;
    const pose = SB.POSES.idle(0.6);
    const sk = SB.computeSkel(pose, h, 1);
    const e = { t: 0.9, vx: 0, vy: 0, build: 1, rim: '#bcd9ff' };

    ctx.save();
    switch (item.slot) {
      case 'head': case 'face': {
        /* park the head at 60% height — the shift below is in scaled space, so it
           cancels the skull's local offset and the anchor alone decides framing */
        ctx.translate(W / 2 - 2, H * 0.60); ctx.scale(2.2, 2.2); ctx.translate(0, h * 0.855);
        ghostHead(ctx, sk);
        (item.slot === 'head' ? SB.COS_DRAW.head : SB.COS_DRAW.face)(ctx, item, sk, e);
        break;
      }
      case 'torso': case 'shoulders': case 'back': {
        ctx.translate(W / 2, H * 0.96); ctx.scale(0.92, 0.92);
        ghostBody(ctx, sk);
        if (item.slot === 'back') SB.COS_DRAW.back(ctx, item, sk, e);
        else if (item.slot === 'torso') SB.COS_DRAW.torso(ctx, item, sk, e);
        else { SB.COS_DRAW.shoulders(ctx, item, sk, e, 'B'); SB.COS_DRAW.shoulders(ctx, item, sk, e, 'F'); }
        break;
      }
      case 'arms': case 'legs': {
        ctx.translate(W / 2, H * 0.96); ctx.scale(0.92, 0.92);
        ghostBody(ctx, sk);
        if (item.slot === 'arms') { SB.COS_DRAW.arms(ctx, item, sk, e, 'B'); SB.COS_DRAW.arms(ctx, item, sk, e, 'F'); }
        else { SB.COS_DRAW.legs(ctx, item, sk, e, 'B'); SB.COS_DRAW.legs(ctx, item, sk, e, 'F'); }
        break;
      }
      case 'weapon': {
        ctx.translate(W * 0.16, H * 0.72); ctx.rotate(-0.5);
        SB.drawWeapon(ctx, 'katana', SB.weaponPalette(SB.ARCHETYPES[0], item), 96, item, 0.6, 1);
        break;
      }
      case 'aura': {
        ctx.translate(W / 2, H * 0.94); ctx.scale(0.78, 0.78);
        ghostBody(ctx, sk, 0.25);
        SB.COS_DRAW.aura(ctx, item, sk, e);
        break;
      }
      case 'trail': {
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          pts.push({ x: 12 + u * (W - 24), y: H * 0.68 - Math.sin(u * Math.PI) * H * 0.42 });
        }
        SB.FX.drawTrail(ctx, pts, p.b, p.c, 13, item.shape, 1);
        break;
      }
      case 'hitfx': staticBurst(ctx, item, W / 2, H / 2); break;
      case 'emote': {
        ctx.translate(W / 2, H * 0.96); ctx.scale(0.86, 0.86);
        const tp = SB.POSES.taunt(0.5, item.shape);
        const sk2 = SB.computeSkel(tp, h, 1);
        ghostBody(ctx, sk2, 0.95, p);
        break;
      }
      case 'banner': {
        ctx.save();
        U.roundRect(ctx, 6, H * 0.22, W - 12, H * 0.56, 7); ctx.clip();
        ctx.fillStyle = D.lin(ctx, 0, 0, 0, H, [[0, p.b], [1, p.a]]);
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 0.3; ctx.fillStyle = p.c;
        for (let i = 0; i < 8; i++) ctx.fillRect(i * (W / 8), 0, W / 18, H);
        ctx.restore();
        break;
      }
      default: /* crest */
        SB.HUD.drawCrest(ctx, item, W / 2, H / 2, Math.min(W, H) * 0.30, 0);
        break;
    }
    ctx.restore();
  };

  function ghostBody(ctx, sk, alpha, pal) {
    ctx.save();
    ctx.globalAlpha = alpha === undefined ? 0.42 : alpha;
    const col = pal ? pal.b : '#37425a';
    const opt = { edge: 'rgba(0,0,0,.3)' };
    D.limb(ctx, sk.hipB, sk.knB, 4, 3.2, col, opt);
    D.limb(ctx, sk.knB, sk.ftB, 3.2, 2.4, col, opt);
    D.limb(ctx, sk.shB, sk.elB, 3.4, 2.8, col, opt);
    D.limb(ctx, sk.elB, sk.haB, 2.8, 2.2, col, opt);
    D.limb(ctx, sk.pelvis, sk.chest, 6.2, 7.8, col, opt);
    D.limb(ctx, sk.hipF, sk.knF, 4.2, 3.4, col, opt);
    D.limb(ctx, sk.knF, sk.ftF, 3.4, 2.5, col, opt);
    ctx.beginPath(); ctx.arc(sk.head.x, sk.head.y, sk.headR * 0.95, 0, U.TAU);
    ctx.fillStyle = col; ctx.fill();
    D.limb(ctx, sk.shF, sk.elF, 3.6, 2.9, col, opt);
    D.limb(ctx, sk.elF, sk.haF, 2.9, 2.3, col, opt);
    ctx.restore();
  }

  function ghostHead(ctx, sk) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    D.limb(ctx, sk.chest, sk.neck, 3.4, 3, '#37425a', {});
    ctx.beginPath(); ctx.arc(sk.head.x, sk.head.y, sk.headR * 0.95, 0, U.TAU);
    ctx.fillStyle = '#3b4256'; ctx.fill();
    ctx.restore();
  }

  function staticBurst(ctx, item, x, y) {
    const p = item.pal, s = item.shape % 8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = p.g; ctx.fillStyle = p.c; ctx.lineWidth = 2.4;
    switch (s) {
      case 0: for (let i = 0; i < 9; i++) { const a = (i / 9) * U.TAU; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6); ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22); ctx.stroke(); } break;
      case 1: for (let i = 0; i < 7; i++) { const a = (i / 7) * U.TAU; D.shard(ctx, x + Math.cos(a) * 10, y + Math.sin(a) * 10, a, 13, 4); ctx.fill(); } break;
      case 2: { const g = ctx.createRadialGradient(x, y, 1, x, y, 26); g.addColorStop(0, p.c); g.addColorStop(1, U.rgba(p.g, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, U.TAU); ctx.fill(); break; }
      case 3: ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - 20, y - 16); ctx.lineTo(x + 20, y + 16); ctx.moveTo(x + 20, y - 16); ctx.lineTo(x - 20, y + 16); ctx.stroke(); break;
      case 4: ctx.beginPath(); ctx.ellipse(x, y, 26, 10, 0, 0, U.TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, 16, 6, 0, 0, U.TAU); ctx.stroke(); break;
      case 5: ctx.beginPath(); ctx.arc(x, y, 12, 0, U.TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 22, 0, U.TAU); ctx.stroke(); break;
      case 6: U.star(ctx, x, y, 6, 24, 9, 0); ctx.stroke(); break;
      default: for (let i = 0; i < 12; i++) { const a = Math.random() * U.TAU, r = 8 + Math.random() * 18; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 2.4, 0, U.TAU); ctx.fill(); } break;
    }
    ctx.restore();
  }
})(window.SB);
