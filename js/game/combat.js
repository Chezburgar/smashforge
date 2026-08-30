/* SMASHFORGE — hit resolution, projectiles, grabs. */
(function (SB) {
  'use strict';
  const U = SB.U, D = SB.D, FX = SB.FX;

  function Projectile(owner, mv, x, y, ang) {
    const p = mv.proj;
    this.owner = owner; this.mv = mv; this.def = p;
    this.x = x; this.y = y;
    this.vx = Math.cos(ang) * p.speed;
    this.vy = Math.sin(ang) * p.speed;
    this.grav = p.grav;
    this.life = p.life; this.maxLife = p.life;
    this.r = p.r;
    this.kind = p.kind;
    this.rot = ang;
    this.spin = this.kind === 'disc' ? 0.42 : (this.kind === 'bomb' ? 0.14 : 0);
    this.pierce = p.pierce || 0;
    this.hit = Object.create(null);
    this.dead = false;
    this.boomerang = !!p.boomerang;
    this.trail = [];
  }
  SB.Projectile = Projectile;

  Projectile.prototype.update = function (w) {
    this.life--;
    if (this.life <= 0) { this.expire(w); return; }
    if (this.boomerang && this.life < this.maxLife * 0.5) {
      const dx = this.owner.x - this.x, dy = (this.owner.y - this.owner.h * 0.5) - this.y;
      const l = Math.hypot(dx, dy) || 1;
      this.vx = U.lerp(this.vx, (dx / l) * this.def.speed, 0.10);
      this.vy = U.lerp(this.vy, (dy / l) * this.def.speed, 0.10);
      if (l < 26) { this.dead = true; return; }
    }
    this.vy += this.grav;
    this.x += this.vx; this.y += this.vy;
    this.rot += this.spin || (this.grav ? Math.atan2(this.vy, this.vx) * 0 : 0);
    if (!this.spin) this.rot = Math.atan2(this.vy, this.vx);

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 9) this.trail.shift();

    /* stage collision — bombs detonate, everything else dies */
    if (!this.boomerang) {
      for (const s of w.stage.solids) {
        if (s.soft) continue;
        if (U.circleRect(this.x, this.y, this.r, s.x, s.y, s.w, s.h + 240)) { this.expire(w); return; }
      }
    }
    const b = w.stage.blast;
    if (this.x < b.l || this.x > b.r || this.y < b.t || this.y > b.b) { this.dead = true; return; }

    /* fighters */
    for (const f of w.fighters) {
      if (f === this.owner || f.dead || f.state === 'ko' || f.state === 'respawn') continue;
      if (this.hit[f.id]) continue;
      const hb = f.hurtbox();
      if (!U.circleCapsule(this.x, this.y, this.r, hb.x, hb.y, hb.h, hb.r)) continue;
      this.hit[f.id] = 1;
      const scaled = Object.create(this.mv);
      scaled.dmg = this.mv.dmg * (this.def.dmgMul || 1);
      const connected = f.takeHit(this.owner, scaled, this.x, this.y, 1, w);
      if (connected) FX.hitstop = Math.max(FX.hitstop, Math.min(4, Math.round(this.mv.hitstop * 0.25)));
      if (this.pierce > 0) this.pierce--;
      else { this.expire(w); return; }
    }
  };

  Projectile.prototype.expire = function (w) {
    this.dead = true;
    const p = this.def;
    if (p.burst) {
      FX.ring(this.x, this.y, 8, p.burst * 2.2, this.mv.fx.col, 20, 5);
      FX.spark(this.x, this.y, 16, this.mv.fx.col2, 7, 3, 6.28);
      FX.smoke(this.x, this.y, 6, '#6a6a72', 2, 12);
      FX.addShake(5);
      SB.Audio.play('explode');
      /* splash damage */
      for (const f of w.fighters) {
        if (f === this.owner || f.dead || f.state === 'ko') continue;
        const hb = f.hurtbox();
        if (U.dist(this.x, this.y, hb.x, hb.y - hb.h * 0.5) < p.burst + hb.r) {
          const scaled = Object.create(this.mv);
          scaled.dmg = this.mv.dmg * 0.7;
          f.takeHit(this.owner, scaled, this.x, this.y, 1, w);
        }
      }
    } else {
      FX.spark(this.x, this.y, 5, this.mv.fx.col, 3, 2, 6.28);
    }
  };

  Projectile.prototype.draw = function (ctx, t) {
    const c = this.mv.fx.col, c2 = this.mv.fx.col2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (this.trail.length > 2) {
      D.ribbon(ctx, this.trail.map((p) => [p.x, p.y]), this.r * 0.15, this.r * 0.85);
      ctx.fillStyle = U.rgba(c, 0.55); ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.shadowColor = c; ctx.shadowBlur = 16;
    switch (this.kind) {
      case 'bomb':
        ctx.fillStyle = D.rad(ctx, -this.r * 0.3, -this.r * 0.3, 0, this.r * 1.4, [[0, U.shade(c2, 0.4)], [1, U.shade(c, -0.3)]]);
        ctx.beginPath(); ctx.arc(0, 0, this.r, 0, U.TAU); ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath(); ctx.arc(this.r * 0.6, -this.r * 0.6, this.r * 0.28 * (0.6 + Math.sin(t * 30) * 0.4), 0, U.TAU); ctx.fill();
        break;
      case 'disc':
        ctx.rotate(t * 12);
        D.ring(ctx, 0, 0, this.r, this.r * 0.34);
        ctx.fillStyle = D.lin(ctx, -this.r, 0, this.r, 0, [[0, c], [0.5, c2], [1, c]]); ctx.fill();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * U.TAU;
          ctx.fillStyle = c2;
          D.spike(ctx, Math.cos(a) * this.r, Math.sin(a) * this.r, a, this.r * 0.5, this.r * 0.14); ctx.fill();
        }
        break;
      case 'arrow':
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.moveTo(this.r * 1.9, 0); ctx.lineTo(-this.r * 0.4, this.r * 0.55);
        ctx.lineTo(-this.r * 1.9, this.r * 0.2); ctx.lineTo(-this.r * 1.9, -this.r * 0.2);
        ctx.lineTo(-this.r * 0.4, -this.r * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = c;
        ctx.fillRect(-this.r * 1.9, -this.r * 0.18, this.r * 1.2, this.r * 0.36);
        break;
      case 'beam':
        ctx.fillStyle = D.lin(ctx, -this.r * 3, 0, this.r * 2, 0, [[0, U.rgba(c, 0)], [0.5, c], [1, c2]]);
        U.roundRect(ctx, -this.r * 3, -this.r * 0.42, this.r * 5, this.r * 0.84, this.r * 0.42); ctx.fill();
        break;
      case 'bolt':
        ctx.fillStyle = D.rad(ctx, 0, 0, 0, this.r * 1.6, [[0, '#ffffff'], [0.4, c2], [1, U.rgba(c, 0)]]);
        ctx.beginPath(); ctx.ellipse(0, 0, this.r * 1.7, this.r * 0.8, 0, 0, U.TAU); ctx.fill();
        break;
      default: /* magic */
        ctx.fillStyle = D.rad(ctx, 0, 0, 0, this.r * 1.5, [[0, '#ffffff'], [0.35, c2], [1, U.rgba(c, 0.1)]]);
        ctx.beginPath(); ctx.arc(0, 0, this.r * 1.4, 0, U.TAU); ctx.fill();
        for (let i = 0; i < 4; i++) {
          const a = t * 6 + i * 1.57;
          ctx.fillStyle = U.rgba(c2, 0.8);
          D.shard(ctx, Math.cos(a) * this.r * 1.5, Math.sin(a) * this.r * 1.5, a, this.r * 0.7, this.r * 0.2);
          ctx.fill();
        }
        break;
    }
    ctx.restore();
  };

  /* ---------------- frame resolution ---------------- */
  const Combat = {};
  SB.Combat = Combat;

  Combat.resolve = function (w) {
    for (const a of w.fighters) {
      if (a.dead || a.state === 'ko' || a.state === 'respawn') continue;
      const boxes = a.activeHitboxes();
      if (!boxes || !boxes.length) continue;
      const mv = a.move;

      for (const b of w.fighters) {
        if (b === a || b.dead || b.state === 'ko' || b.state === 'respawn') continue;
        if (w.teams && w.teams[a.port] !== undefined && w.teams[a.port] === w.teams[b.port]) continue;
        if (a.hitIds[b.id]) continue;
        const hb = b.hurtbox();
        let hitX = 0, hitY = 0, found = false;
        for (const box of boxes) {
          if (U.circleCapsule(box.x, box.y, box.r, hb.x, hb.y, hb.h, hb.r)) {
            hitX = (box.x + hb.x) * 0.5;
            hitY = U.clamp(box.y, hb.y - hb.h, hb.y - hb.h * 0.15);
            found = true; break;
          }
        }
        if (!found) continue;
        a.hitIds[b.id] = 1;

        if (mv.kind === 'grab' && !b.grabbedBy && b.state !== 'shield') {
          b.grabbedBy = a; b.grabT = 30; a.grabbed = b;
          b.hitstun = 0; b.move = null; b.mvTiming = null;
          FX.ring(hitX, hitY, 6, 40, mv.fx.col, 12, 3);
          SB.Audio.play('block');
          continue;
        }

        const connected = b.takeHit(a, mv, hitX, hitY, a.chargeMul || 1, w);
        if (connected) {
          a.hitstop = Math.max(a.hitstop, Math.round(mv.hitstop * 0.85));
          /* a short world freeze on top, only for the meaty ones */
          FX.hitstop = Math.max(FX.hitstop, Math.min(5, Math.round(mv.hitstop * 0.30)));
        }
      }
    }

    /* projectiles */
    for (let i = w.projectiles.length - 1; i >= 0; i--) {
      const p = w.projectiles[i];
      p.update(w);
      if (p.dead) w.projectiles.splice(i, 1);
    }
  };

  /* Debug overlay for hit/hurt boxes. */
  Combat.debugDraw = function (ctx, w) {
    ctx.save();
    ctx.lineWidth = 2;
    for (const f of w.fighters) {
      const hb = f.hurtbox();
      ctx.strokeStyle = 'rgba(90,220,140,0.85)';
      ctx.beginPath();
      ctx.moveTo(hb.x - hb.r, hb.y - hb.h);
      ctx.arc(hb.x, hb.y - hb.h, hb.r, Math.PI, 0);
      ctx.lineTo(hb.x + hb.r, hb.y);
      ctx.arc(hb.x, hb.y, hb.r, 0, Math.PI);
      ctx.closePath(); ctx.stroke();
      const boxes = f.activeHitboxes();
      if (boxes) {
        ctx.strokeStyle = 'rgba(255,90,110,0.95)';
        ctx.fillStyle = 'rgba(255,90,110,0.16)';
        for (const b of boxes) {
          ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, U.TAU); ctx.fill(); ctx.stroke();
        }
      }
    }
    ctx.restore();
  };
})(window.SB);
