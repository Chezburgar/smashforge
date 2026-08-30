/* SMASHFORGE — CPU opponent. Utility-driven, with reaction delay and
   difficulty-scaled discipline so lower levels feel beatable, not broken. */
(function (SB) {
  'use strict';
  const U = SB.U;

  const LEVELS = [
    { id: 0, name: 'Rookie',  react: 20, aggro: 0.42, defend: 0.16, tech: 0.10, edge: 0.10, err: 0.34, cd: 34, charge: 0.10 },
    { id: 1, name: 'Skilled', react: 13, aggro: 0.60, defend: 0.34, tech: 0.32, edge: 0.34, err: 0.20, cd: 24, charge: 0.24 },
    { id: 2, name: 'Veteran', react: 8,  aggro: 0.76, defend: 0.56, tech: 0.58, edge: 0.62, err: 0.10, cd: 16, charge: 0.40 },
    { id: 3, name: 'Master',  react: 4,  aggro: 0.90, defend: 0.78, tech: 0.85, edge: 0.86, err: 0.03, cd: 10, charge: 0.55 }
  ];
  SB.AI_LEVELS = LEVELS;

  function AI(f, level) {
    this.f = f;
    this.lv = LEVELS[U.clamp(level | 0, 0, 3)];
    this.t = 0;
    this.cool = 0;
    this.holdSig = 0;
    this.plan = 'neutral';
    this.planT = 0;
    this.mem = [];
    this.jitter = U.rngFor('ai' + f.id + Math.random());
    this.driftBias = (this.jitter() - 0.5) * 40;
  }
  SB.AI = AI;

  AI.prototype.target = function (w) {
    let best = null, bd = 1e9;
    for (const o of w.fighters) {
      if (o === this.f || o.dead) continue;
      if (w.teams && w.teams[o.port] !== undefined && w.teams[o.port] === w.teams[this.f.port]) continue;
      const d = U.dist(this.f.x, this.f.y, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  };

  /* Snapshot the world `react` frames ago so the CPU visibly reacts late. */
  AI.prototype.perceive = function (foe) {
    this.mem.push({
      x: foe.x, y: foe.y, vx: foe.vx, vy: foe.vy,
      attacking: !!foe.move, mvFrame: foe.mvFrame,
      startup: foe.mvTiming ? foe.mvTiming.startup : 0,
      charging: foe.chargeT > 0, grounded: foe.grounded, hp: foe.hp, state: foe.state
    });
    if (this.mem.length > 40) this.mem.shift();
    const idx = Math.max(0, this.mem.length - 1 - this.lv.react);
    return this.mem[idx];
  };

  AI.prototype.think = function (cmd, w) {
    const me = this.f;
    const out = { left: false, right: false, up: false, down: false, jump: false, light: false, sig: false, special: false, dodge: false, shield: false, taunt: false };
    this.t++;
    if (this.cool > 0) this.cool--;
    if (me.state === 'ko' || me.dead) { cmd.commit(out); return; }

    const foe = this.target(w);
    if (!foe) { cmd.commit(out); return; }
    const P = this.perceive(foe);
    const g = w.stage.ground;
    const lv = this.lv;

    const dx = P.x - me.x, adx = Math.abs(dx), dy = P.y - me.y;
    const face = dx === 0 ? me.dir : Math.sign(dx);

    /* ---------- recovery: the single most important CPU behaviour ---------- */
    const offLeft = me.x < g.x + 6, offRight = me.x > g.x + g.w - 6;
    const below = me.y > g.y + 12;
    if ((offLeft || offRight) && !me.grounded) {
      const inward = offLeft ? 1 : -1;
      if (me.state === 'ledge') {
        if (this.jitter() < 0.5) out.up = true; else out.jump = true;
        cmd.commit(out); return;
      }
      if (inward > 0) out.right = true; else out.left = true;
      const dist = offLeft ? (g.x - me.x) : (me.x - (g.x + g.w));
      /* jump early, burn the recovery move late */
      if (me.vy > 1.5 && me.jumps > 0 && (below || dist > 120)) out.jump = true;
      else if (me.vy > 3 && me.jumps <= 0 && !me.recovUsed) { out.sig = true; out.up = true; }
      else if (below && me.jumps > 0) out.jump = true;
      if (me.vy > 10 && me.jumps <= 0 && me.recovUsed && this.jitter() < 0.4) out.dodge = true;
      cmd.commit(out); return;
    }
    if (below && !me.grounded && Math.abs(me.x - (g.x + g.w / 2)) < g.w / 2) {
      /* under the stage — drift out then up */
      if (me.x < g.x + g.w / 2) out.left = true; else out.right = true;
      if (me.jumps > 0) out.jump = true;
      cmd.commit(out); return;
    }

    /* ---------- edge-guard ---------- */
    const foeOff = (P.x < g.x - 10 || P.x > g.x + g.w + 10) && P.y > g.y - 260;
    if (foeOff && this.jitter() < lv.edge && me.grounded) {
      const edgeX = P.x < g.x ? g.x + 40 : g.x + g.w - 40;
      if (Math.abs(me.x - edgeX) > 26) { if (me.x < edgeX) out.right = true; else out.left = true; }
      else if (adx < 190 && this.cool <= 0) {
        out.jump = true;
        this.cool = lv.cd;
      }
      cmd.commit(out); return;
    }
    if (foeOff && !me.grounded && adx < 150 && this.cool <= 0) {
      if (dy > 20) { out.down = true; out.light = true; }
      else { out.light = true; if (dx !== 0) { if (dx > 0) out.right = true; else out.left = true; } }
      this.cool = lv.cd;
      cmd.commit(out); return;
    }

    /* ---------- defence ---------- */
    const incoming = P.attacking && P.mvFrame <= P.startup + 5 && adx < 190 && Math.abs(dy) < 130;
    if ((incoming || P.charging) && this.jitter() < lv.defend && this.cool <= 0) {
      if (me.grounded && this.jitter() < 0.45) { out.shield = true; }
      else {
        out.dodge = true;
        if (this.jitter() < 0.5) { if (dx > 0) out.left = true; else out.right = true; }
      }
      this.cool = 10;
      cmd.commit(out); return;
    }
    if (me.hitstun > 0) {
      /* DI away from the nearest blast zone, then tech */
      out[me.x > 0 ? 'left' : 'right'] = true;
      if (me.vy > 4) out.up = true;
      if (me.tumble && this.jitter() < lv.tech) out.dodge = true;
      cmd.commit(out); return;
    }

    /* ---------- choose an attack ---------- */
    const kit = me.kit;
    let pick = null, wantDown = false, wantSide = false, wantUp = false, useSig = false, useSpecial = false;
    const airborne = !me.grounded;

    if (airborne) {
      if (dy > 40) { pick = kit.dair; wantDown = true; }
      else if (adx > 40) { pick = kit.sair; wantSide = true; }
      else pick = kit.nair;
    } else if (dy < -70) {
      pick = kit.nsig; useSig = true;
    } else if (foe.hp / foe.d.maxHP < 0.42 && this.jitter() < lv.charge + 0.25) {
      pick = adx > 70 ? kit.ssig : kit.nsig; useSig = true; wantSide = adx > 70;
    } else if (adx > 190 && kit.special.proj && this.jitter() < 0.5) {
      pick = kit.special; useSpecial = true;
    } else if (adx < 46) {
      pick = kit.nlight;
    } else if (me.state === 'run' && adx < 130) {
      pick = kit.dash; wantSide = true;
    } else {
      pick = kit.slight; wantSide = true;
    }

    const range = SB.moveRange(pick) * me.h + me.h * 0.15;
    const vertOK = Math.abs(dy) < (airborne ? 120 : 96);
    const inRange = adx <= range && vertOK;

    /* ---------- movement ---------- */
    const desired = inRange ? 0 : range * 0.72;
    const wander = Math.sin(this.t * 0.03) * 18 + this.driftBias;
    const gap = adx - (desired + wander * 0.2);

    if (gap > 12) { if (dx > 0) out.right = true; else out.left = true; }
    else if (adx < range * 0.45 && this.jitter() < 0.25 - lv.aggro * 0.12) { if (dx > 0) out.left = true; else out.right = true; }

    /* vertical navigation */
    if (dy < -80 && me.grounded && this.jitter() < 0.10 + lv.aggro * 0.10) out.jump = true;
    if (dy > 90 && !me.grounded && this.jitter() < 0.30) out.down = true;
    if (!me.grounded && me.vy > 2 && me.y > g.y - 20 && me.jumps > 0 && Math.abs(me.x - (g.x + g.w / 2)) > g.w / 2 - 40) out.jump = true;

    /* ---------- fire ---------- */
    if (inRange && this.cool <= 0 && this.jitter() > lv.err * 0.5) {
      if (useSig) {
        out.sig = true;
        this.holdSig = this.jitter() < lv.charge ? 12 + Math.floor(this.jitter() * 30) : 1;
      } else if (useSpecial) out.special = true;
      else out.light = true;
      if (wantSide) { if (dx > 0) out.right = true; else out.left = true; }
      if (wantDown) out.down = true;
      if (wantUp) out.up = true;
      this.cool = lv.cd + Math.floor(this.jitter() * 12);
    }
    if (this.holdSig > 0) { out.sig = true; this.holdSig--; }

    /* occasional flourish when nothing is happening */
    if (adx > 420 && me.grounded && this.jitter() < 0.002) out.taunt = true;

    cmd.commit(out);
  };
})(window.SB);
