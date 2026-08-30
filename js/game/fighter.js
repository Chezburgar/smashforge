/* SMASHFORGE — the fighter: physics, state machine, attacks, reactions. 60fps fixed step. */
(function (SB) {
  'use strict';
  const U = SB.U, FX = SB.FX, POSES = SB.POSES, Pose = SB.Pose;

  const GRAV = 0.76, MAXFALL = 16.5, FASTFALL_MAX = 23.5;
  const GROUND_ACC = 1.25, FRICTION = 0.74, AIR_DRAG = 0.985;
  const JUMPSQUAT = 4, LAND_LAG = 5;
  const HITSTUN_MAX = 68, TUMBLE_KB = 24;

  let NEXT_ID = 1;

  function Fighter(build, opt) {
    opt = opt || {};
    this.id = NEXT_ID++;
    this.spec = SB.normalizeBuild(build);
    this.d = SB.derive(this.spec);
    this.arch = this.d.arch;
    this.archId = this.spec.archId;
    this.name = this.spec.name;
    this.seed = U.hash(this.spec.id) % 1000;

    this.h = this.d.h;
    this.r = this.h * 0.15;
    this.build = this.d.build; /* numeric body-width scale used by the renderer */
    this.skin = this.spec.body.skin;
    this.hair = { style: this.spec.body.hairStyle, color: this.spec.body.hairColor };
    this.col = this.spec.col;
    this.playerCol = opt.playerCol || '#4fc3f7';
    this.port = opt.port || 0;
    this.human = !!opt.human;
    this.inputSlot = opt.inputSlot || null;
    this.padIndex = opt.padIndex === undefined ? null : opt.padIndex;

    /* resolved cosmetics + moves */
    this.cosItems = Object.create(null);
    for (const k in this.spec.loadout) this.cosItems[k] = SB.cos(this.spec.loadout[k]) || { none: true, glow: 0, pal: { a: '#555', b: '#777', c: '#999', g: '#888' }, shape: 0, v: { n: 4, s: 1, r: 0, k: 0 } };
    this.kit = Object.create(null);
    SB.SLOT_ORDER.forEach((s) => { this.kit[s] = SB.MOVE(this.spec.moves[s]) || SB.kitFor(this.archId, this.spec.styleId)[s]; });

    this.reset(opt.x || 0, opt.y || 0, opt.dir || 1);
    this.stocks = opt.stocks === undefined ? 3 : opt.stocks;
    this.kos = 0; this.falls = 0; this.dealt = 0; this.taken = 0; this.biggest = 0;
  }
  SB.Fighter = Fighter;

  Fighter.prototype.reset = function (x, y, dir) {
    this.x = x; this.y = y; this.dir = dir || 1;
    this.vx = 0; this.vy = 0;
    this.hp = this.d.maxHP;
    this.state = 'air'; this.stateT = 0;
    this.grounded = false; this.prevGrounded = false;
    this.jumps = 2; this.airDodges = 1;
    this.move = null; this.mvFrame = 0; this.mvTiming = null; this.hitIds = null;
    this.chargeT = 0; this.chargeMove = null; this.chargeSlot = null;
    this.hitstun = 0; this.hitstop = 0; this.tumble = false; this.spin = 0; this.spinAcc = 0;
    this.invuln = 90; this.iframes = 0;
    this.shieldHP = this.d.shieldMax; this.shieldMax = this.d.shieldMax; this.shieldBreak = 0;
    this.counterT = 0; this.counterMove = null; this.wardT = 0; this.armorFlash = 0;
    this.flash = 0; this.combo = 0; this.comboT = 0;
    this.dropT = 0; this.ledge = null; this.ledgeT = 0; this.ledgeCool = 0;
    this.fastFall = false; this.walkPhase = 0; this.animT = 0;
    this.pose = POSES.idle(0); this.prevPose = this.pose; this.blendT = 1;
    this.skel = SB.computeSkel(this.pose, this.h, this.d.build);
    this.trail = []; this.trailOn = false;
    this.stale = [];
    this.grabbed = null; this.grabT = 0; this.grabbedBy = null;
    this.tauntT = 0; this.hitLag = 0; this.landLag = 0;
    this.recovUsed = false;
    this.koT = 0; this.respawnT = 0;
    this.lastHitBy = null;
    this.dead = false;
  };

  Fighter.prototype.moveFor = function (slot) { return this.kit[slot]; };

  /* ---------------- damage staling: repeating a move costs you ---------------- */
  Fighter.prototype.staleMul = function (mv) {
    let n = 0;
    for (let i = 0; i < this.stale.length; i++) if (this.stale[i] === mv.id) n++;
    return 1 - Math.min(0.42, n * 0.11);
  };
  Fighter.prototype.pushStale = function (mv) {
    this.stale.unshift(mv.id);
    if (this.stale.length > 8) this.stale.pop();
  };

  /* ---------------- starting a move ---------------- */
  Fighter.prototype.canAct = function () {
    return this.hitstun <= 0 && !this.move && this.state !== 'ko' && this.state !== 'respawn' &&
      this.state !== 'dodge' && this.state !== 'roll' && this.state !== 'airdodge' &&
      this.state !== 'jumpsquat' && this.shieldBreak <= 0 && this.landLag <= 0 && this.grabbedBy === null;
  };

  Fighter.prototype.startMove = function (mv, chargeMul) {
    if (!mv) return;
    const sp = this.d.atkSpeed;
    const st = Math.max(2, Math.round(mv.startup / sp));
    const ac = Math.max(2, mv.active);
    const rc = Math.max(3, Math.round(mv.recovery / sp));
    this.move = mv;
    this.mvFrame = 0;
    this.chargeMul = chargeMul || 1;
    this.mvTiming = { startup: st, active: ac, recovery: rc, total: st + ac + rc, swing: mv.swing, hits: mv.hits };
    this.hitIds = Object.create(null);
    this.rehitT = 0;
    this.state = 'attack'; this.stateT = 0;
    this.projFired = false;
    this.trail.length = 0;
    this.pushStale(mv);
    SB.Audio.play('swing', { weight: 0.6 + mv.dmg * 0.05 });
    if (mv.kind === 'counter') { this.counterT = st + ac; this.counterMove = mv; }
    if (mv.kind === 'buff') { this.wardT = 300; SB.Audio.play('chargeReady'); }
  };

  /* Contextual attack selection — the whole moveset off two buttons. */
  Fighter.prototype.pickLight = function (cmd) {
    if (!this.grounded) {
      if (cmd.held.down) return this.kit.dair;
      if (cmd.stickX !== 0) return this.kit.sair;
      return this.kit.nair;
    }
    if (this.state === 'run' && Math.abs(this.vx) > this.d.runSpeed * 0.55) return this.kit.dash;
    if (cmd.held.down) return this.kit.dlight;
    if (cmd.stickX !== 0) return this.kit.slight;
    return this.kit.nlight;
  };

  Fighter.prototype.pickSig = function (cmd) {
    if (!this.grounded) {
      if (cmd.held.down) return this.kit.gp;
      return this.kit.recov;
    }
    if (cmd.held.down) return this.kit.dsig;
    if (cmd.stickX !== 0) return this.kit.ssig;
    return this.kit.nsig;
  };

  /* ---------------- main update ---------------- */
  Fighter.prototype.update = function (cmd, w) {
    this.animT += 1 / 60;
    if (this.hitstop > 0) {
      this.hitstop--;
      this.flash = Math.max(0, this.flash - 0.04);
      this.updatePose(cmd, true);
      return;
    }

    this.flash = Math.max(0, this.flash - 0.075);
    this.armorFlash = Math.max(0, this.armorFlash - 0.09);
    if (this.invuln > 0) this.invuln--;
    if (this.iframes > 0) this.iframes--;
    if (this.ledgeCool > 0) this.ledgeCool--;
    if (this.comboT > 0) { this.comboT--; if (this.comboT === 0) this.combo = 0; }
    if (this.wardT > 0) this.wardT--;
    if (this.counterT > 0) this.counterT--;
    if (this.dropT > 0) this.dropT--;
    if (this.tauntT > 0) this.tauntT--;

    /* shield regen */
    if (this.state !== 'shield') {
      this.shieldHP = Math.min(this.shieldMax, this.shieldHP + 0.24);
    }
    if (this.shieldBreak > 0) {
      this.shieldBreak--;
      if (this.shieldBreak === 0) this.shieldHP = this.shieldMax * 0.5;
    }

    if (this.state === 'ko') { this.updateKO(w); return; }
    if (this.state === 'respawn') { this.updateRespawn(cmd, w); return; }

    if (this.grabbedBy) { this.updateGrabbed(w); return; }

    /* hitstun / tumble */
    if (this.hitstun > 0) {
      this.hitstun--;
      /* directional influence */
      if (cmd.stickX || cmd.stickY) {
        const sp = Math.hypot(this.vx, this.vy);
        if (sp > 1) {
          const ang = Math.atan2(this.vy, this.vx);
          const want = Math.atan2(cmd.stickY, cmd.stickX);
          const diff = U.wrapAngle(want - ang);
          const na = ang + U.clamp(diff, -0.055, 0.055);
          this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
        }
      }
      /* tech out of a tumble on contact */
      if (this.tumble && cmd.buffered('dodge') && (this.nearGround(w) || this.nearWall(w))) {
        cmd.consume('dodge');
        this.tech(w);
      }
      this.physics(w, true);
      this.updatePose(cmd);
      return;
    }
    this.tumble = false;

    if (this.landLag > 0) { this.landLag--; this.vx *= FRICTION; this.physics(w, false); this.updatePose(cmd); return; }
    if (this.shieldBreak > 0) { this.vx *= 0.9; this.physics(w, false); this.updatePose(cmd); return; }

    if (this.state === 'ledge') { this.updateLedge(cmd, w); return; }

    /* ---- active move ---- */
    if (this.move) { this.updateMove(cmd, w); return; }

    /* ---- signature charging ---- */
    if (this.chargeT > 0) {
      const stillHeld = cmd.held.sig;
      this.chargeT++;
      if (this.chargeT === 41) SB.Audio.play('chargeReady');
      if (this.chargeT % 7 === 0 && this.chargeT < 42) SB.Audio.play('charge');
      this.vx *= this.grounded ? 0.82 : 0.94;
      if (!stillHeld || this.chargeT > 74) {
        const mul = 1 + 0.38 * U.sat((this.chargeT - 1) / 40);
        const mv = this.chargeMove;
        this.chargeT = 0; this.chargeMove = null;
        this.startMove(mv, mul);
      }
      this.physics(w, false);
      this.updatePose(cmd);
      return;
    }

    this.act(cmd, w);
    this.physics(w, false);
    this.updatePose(cmd);
  };

  /* ---------------- intent ---------------- */
  Fighter.prototype.act = function (cmd, w) {
    const d = this.d;

    /* jumpsquat */
    if (this.state === 'jumpsquat') {
      this.stateT++;
      this.vx *= 0.86;
      if (this.stateT >= JUMPSQUAT) {
        this.vy = d.jumpV * (cmd.held.jump ? 1 : 0.72);
        this.grounded = false;
        this.state = 'air'; this.stateT = 0;
        SB.Audio.play('jump');
        FX.dust(this.x, this.y, 0, 6, '#dfe8f5');
      }
      return;
    }

    /* dodges */
    if (this.state === 'dodge' || this.state === 'roll' || this.state === 'airdodge') {
      this.stateT++;
      const dur = this.state === 'airdodge' ? 30 : (this.state === 'roll' ? 26 : d.dodgeFrames);
      if (this.state === 'roll') this.vx = this.rollDir * 7.4 * (1 - this.stateT / dur * 0.55);
      else if (this.state === 'dodge') this.vx *= 0.80;
      else this.vx *= 0.95, this.vy *= 0.95;
      if (this.stateT >= dur) { this.state = this.grounded ? 'idle' : 'air'; this.stateT = 0; }
      return;
    }

    /* shielding */
    if (this.state === 'shield') {
      this.stateT++;
      this.vx *= 0.72;
      this.shieldHP -= 0.42;
      if (this.shieldHP <= 0) { this.breakShield(); return; }
      if (!cmd.held.shield || !this.grounded) { this.state = this.grounded ? 'idle' : 'air'; this.stateT = 0; }
      else if (cmd.buffered('dodge')) {
        cmd.consume('dodge');
        if (cmd.stickX !== 0) { this.state = 'roll'; this.rollDir = cmd.stickX; this.iframes = 18; }
        else { this.state = 'dodge'; this.iframes = 14; }
        this.stateT = 0;
        SB.Audio.play('dodge');
      } else if (cmd.buffered('jump')) { cmd.consume('jump'); this.state = 'jumpsquat'; this.stateT = 0; }
      return;
    }

    /* taunt */
    if (cmd.buffered('taunt') && this.grounded && Math.abs(this.vx) < 0.6) {
      cmd.consume('taunt');
      this.tauntT = 52;
      this.state = 'taunt'; this.stateT = 0;
    }
    if (this.state === 'taunt') {
      this.stateT++;
      this.vx *= 0.8;
      if (this.tauntT <= 0 || cmd.stickX !== 0 || cmd.buffered('jump') || cmd.buffered('light')) { this.state = 'idle'; this.tauntT = 0; }
      else return;
    }

    /* attacks */
    if (cmd.buffered('light')) {
      cmd.consume('light');
      const mv = this.pickLight(cmd);
      if (mv) { this.faceInput(cmd); this.startMove(mv); return; }
    }
    if (cmd.buffered('special')) {
      cmd.consume('special');
      this.faceInput(cmd);
      this.startMove(this.kit.special);
      return;
    }
    if (cmd.buffered('sig')) {
      cmd.consume('sig');
      this.faceInput(cmd);
      const mv = this.pickSig(cmd);
      if (mv && mv.sig && this.grounded) { this.chargeT = 1; this.chargeMove = mv; SB.Audio.play('charge'); return; }
      if (mv) { this.startMove(mv); return; }
    }

    /* dodge / air dodge */
    if (cmd.buffered('dodge')) {
      cmd.consume('dodge');
      SB.Audio.play('dodge');
      if (this.grounded) {
        if (cmd.stickX !== 0) { this.state = 'roll'; this.rollDir = cmd.stickX; this.iframes = 18; }
        else { this.state = 'dodge'; this.iframes = 15; }
        this.stateT = 0;
      } else if (this.airDodges > 0) {
        this.airDodges--;
        this.state = 'airdodge'; this.stateT = 0; this.iframes = 16;
        const ax = cmd.stickX, ay = cmd.stickY;
        if (ax || ay) {
          const l = Math.hypot(ax, ay);
          this.vx = (ax / l) * 11.5; this.vy = (ay / l) * 11.5;
        } else { this.vx *= 0.4; this.vy = -1.5; }
      }
      return;
    }

    /* shield */
    if (cmd.held.shield && this.grounded && this.shieldHP > 2) {
      this.state = 'shield'; this.stateT = 0;
      return;
    }

    /* jump */
    if (cmd.buffered('jump')) {
      if (this.grounded) { cmd.consume('jump'); this.state = 'jumpsquat'; this.stateT = 0; }
      else if (this.jumps > 0) {
        cmd.consume('jump');
        this.jumps--;
        this.vy = this.d.djumpV;
        if (cmd.stickX !== 0) this.vx = U.clamp(this.vx + cmd.stickX * 3.4, -this.d.airMax * 1.25, this.d.airMax * 1.25);
        SB.Audio.play('djump');
        FX.ring(this.x, this.y - this.h * 0.15, 8, 42, this.col.glow, 16, 3, 1.4, 0.5);
        FX.glow(this.x, this.y - this.h * 0.1, 6, this.col.glow, 2.4, 5);
      }
    }

    /* drop through a soft platform */
    if (this.grounded && this.onSoft && cmd.pressed('down')) {
      this.dropT = 11; this.grounded = false; this.y += 3;
    }

    /* locomotion */
    if (this.grounded) {
      const target = cmd.stickX * (cmd.held.shield ? this.d.walkSpeed : this.d.runSpeed);
      if (cmd.stickX !== 0) {
        this.vx = U.approach(this.vx, target, GROUND_ACC);
        this.dir = cmd.stickX;
        const spd = Math.abs(this.vx);
        this.state = spd > this.d.walkSpeed + 0.8 ? 'run' : 'walk';
        this.walkPhase += spd / (this.state === 'run' ? 46 : 30);
      } else {
        this.vx *= FRICTION;
        if (Math.abs(this.vx) < 0.12) this.vx = 0;
        this.state = cmd.held.down ? 'crouch' : 'idle';
      }
    } else {
      if (cmd.stickX !== 0) {
        this.vx = U.approach(this.vx, cmd.stickX * this.d.airMax, this.d.airAccel);
        if (this.hitstun <= 0) this.dir = cmd.stickX;
      } else this.vx *= AIR_DRAG;
      if (cmd.held.down && this.vy > 0.5) this.fastFall = true;
      if (!cmd.held.down) this.fastFall = false;
      this.state = 'air';
    }
  };

  Fighter.prototype.faceInput = function (cmd) {
    if (cmd.stickX !== 0) this.dir = cmd.stickX;
  };

  /* ---------------- active move ---------------- */
  Fighter.prototype.updateMove = function (cmd, w) {
    const mv = this.move, T = this.mvTiming;
    this.mvFrame++;
    const f = this.mvFrame;
    const inActive = f > T.startup && f <= T.startup + T.active;

    /* movement impulses */
    if (f === T.startup + 1) {
      if (mv.slot === 'recov') {
        this.vy = -(10.5 + mv.mv * 0.9);
        this.vx += this.dir * mv.mv * 0.5;
        this.jumps = 0;
        this.recovUsed = true;
      } else if (mv.slot === 'gp') {
        this.vy = 19; this.vx *= 0.35;
      } else if (this.grounded) {
        this.vx += this.dir * mv.mv * 0.62;
      } else {
        this.vx += this.dir * mv.mv * 0.30;
      }
      if (mv.proj && !this.projFired) { this.fireProjectile(w, mv); this.projFired = true; }
    }
    if (inActive && (mv.swing === 'charge' || mv.swing === 'thrustDash' || mv.swing === 'lunge')) {
      this.vx = this.dir * mv.mv * 1.15;
      if (!this.grounded) this.vy *= 0.72;
    }
    if (inActive && mv.slot === 'gp') this.vy = Math.max(this.vy, 19);

    /* multi-hit rehit windows */
    if (mv.hits > 1 && inActive) {
      this.rehitT--;
      if (this.rehitT <= 0) { this.hitIds = Object.create(null); this.rehitT = mv.rehit; }
    }

    /* weapon trail while the hitbox is live */
    this.trailOn = inActive;
    if (inActive) {
      const tip = this.weaponTip();
      this.trail.push(tip);
      if (this.trail.length > 14) this.trail.shift();
    } else if (this.trail.length) this.trail.shift();

    if (this.grounded) this.vx *= 0.90; else this.vx *= 0.995;

    if (f >= T.total) {
      this.endMove();
    }
    this.physics(w, false);
    this.updatePose(cmd);
  };

  Fighter.prototype.endMove = function () {
    this.move = null; this.mvTiming = null; this.mvFrame = 0;
    this.counterT = 0; this.counterMove = null;
    this.state = this.grounded ? 'idle' : 'air';
    this.stateT = 0;
    this.trailOn = false;
  };

  Fighter.prototype.weaponTip = function () {
    const sk = this.skel;
    const L = SB.weaponLen(this.arch.shape, this.h) * 0.92;
    const a = sk.weapon.a;
    return { x: this.x + (sk.weapon.x + Math.cos(a) * L) * this.dir, y: this.y + sk.weapon.y + Math.sin(a) * L };
  };

  Fighter.prototype.fireProjectile = function (w, mv) {
    const p = mv.proj;
    let ang = 0;
    if (p.dir === 'up') ang = -Math.PI / 2 + this.dir * 0.22;
    else if (p.dir === 'down') ang = Math.PI / 2 - this.dir * 0.22;
    else ang = this.dir > 0 ? 0 : Math.PI;
    if (mv.swing === 'shootArc' || mv.swing === 'throwArc') ang += this.dir > 0 ? -0.42 : 0.42;
    const sk = this.skel;
    w.spawnProjectile(this, mv, this.x + sk.weapon.x * this.dir + this.dir * this.h * 0.22, this.y + sk.weapon.y, ang);
    SB.Audio.play('shoot', { pitch: 0.8 + mv.dmg * 0.02 });
  };

  /* ---------------- physics + collision ---------------- */
  Fighter.prototype.physics = function (w, launched) {
    const st = w.stage;
    this.prevGrounded = this.grounded;
    const prevFeet = this.y;

    /* gravity */
    if (!this.grounded) {
      const g = this.state === 'airdodge' ? GRAV * 0.55 : GRAV;
      this.vy += g;
      const cap = this.fastFall ? FASTFALL_MAX : MAXFALL;
      if (this.vy > cap) this.vy = cap;
    }
    if (launched) { this.vx *= 0.962; this.vy *= 0.968; }

    this.x += this.vx;
    this.y += this.vy;

    /* wall collision on the main platform only */
    const g = st.ground;
    const halfW = this.r;
    if (this.y > g.y + 6 && this.y - this.h * 0.2 < g.y + g.h + 240) {
      if (this.x + halfW > g.x && this.x - halfW < g.x + g.w) {
        const fromLeft = Math.abs(this.x - g.x);
        const fromRight = Math.abs(this.x - (g.x + g.w));
        if (fromLeft < fromRight) this.x = g.x - halfW; else this.x = g.x + g.w + halfW;
        if (launched && Math.abs(this.vx) > 9) {
          this.vx *= -0.55;
          FX.impact(this.x, this.y - this.h * 0.5, this.dir, '#ffffff', this.col.glow, 1.4, 4);
          FX.addShake(6);
          SB.Audio.play('hit', { power: 1 });
        } else this.vx = 0;
      }
    }

    /* platform landing */
    this.grounded = false;
    this.onSoft = false;
    if (this.vy >= 0 && this.dropT <= 0) {
      for (const p of st.solids) {
        if (this.x + halfW * 0.55 < p.x || this.x - halfW * 0.55 > p.x + p.w) continue;
        if (prevFeet <= p.y + 2 && this.y >= p.y) {
          this.y = p.y;
          this.land(p, launched);
          break;
        }
      }
    }
    if (this.grounded) { this.vy = 0; this.fastFall = false; }

    /* ledge grab */
    if (!this.grounded && this.ledgeCool <= 0 && this.state !== 'ledge' && this.vy > -2.5 && this.hitstun <= 0 && !this.move) {
      const ls = SB.ledges(st);
      for (const L of ls) {
        if (Math.sign(this.x - L.x) === L.dir) continue;
        if (Math.abs(this.x - L.x) > 34) continue;
        if (this.y < L.y - 4 || this.y > L.y + 62) continue;
        this.grabLedge(L);
        break;
      }
    }
  };

  Fighter.prototype.land = function (p, launched) {
    this.grounded = true;
    this.onSoft = !!p.soft;
    this.jumps = 2; this.airDodges = 1; this.recovUsed = false;
    if (launched && Math.abs(this.vy) > 10 && this.tumble) {
      /* bounce — techable */
      this.vy = -Math.abs(this.vy) * 0.42;
      this.grounded = false;
      FX.dust(this.x, this.y, 0, 12, '#e6eef8');
      FX.addShake(4);
      SB.Audio.play('land', { hard: true });
      return;
    }
    if (!this.prevGrounded) {
      const hard = this.vy > 12;
      SB.Audio.play('land', { hard: hard });
      FX.dust(this.x, this.y, 0, hard ? 12 : 5, '#dfe8f5');
      if (hard) FX.addShake(2.5);
      if (this.move && this.move.slot === 'gp') {
        this.groundPoundImpact();
      }
      if (this.move && this.move.air) { this.endMove(); this.landLag = LAND_LAG + 3; }
      else if (this.state === 'airdodge') { this.state = 'idle'; this.landLag = LAND_LAG; }
      else this.landLag = this.vy > 12 ? 4 : 2;
      this.state = 'land';
    }
  };

  Fighter.prototype.groundPoundImpact = function () {
    const mv = this.move;
    FX.ring(this.x, this.y, 10, 190, mv.fx.col, 22, 7, 1.6, 0.4);
    FX.dust(this.x - 30, this.y, -1, 10, '#e6eef8');
    FX.dust(this.x + 30, this.y, 1, 10, '#e6eef8');
    FX.addShake(11);
    SB.Audio.play('heavy');
    this.quakeX = this.x;
    this.quakeT = 6;
  };

  Fighter.prototype.nearGround = function (w) {
    for (const p of w.stage.solids) {
      if (this.x < p.x - 10 || this.x > p.x + p.w + 10) continue;
      if (this.y > p.y - 26 && this.y < p.y + 20) return true;
    }
    return false;
  };
  Fighter.prototype.nearWall = function (w) {
    const g = w.stage.ground;
    return this.y > g.y && (Math.abs(this.x - g.x) < 26 || Math.abs(this.x - (g.x + g.w)) < 26);
  };
  Fighter.prototype.tech = function (w) {
    this.hitstun = 0; this.tumble = false;
    this.vx *= 0.25; this.vy = -3;
    this.iframes = 22; this.state = this.grounded ? 'roll' : 'airdodge'; this.stateT = 0;
    this.rollDir = this.dir * -1;
    FX.ring(this.x, this.y - this.h * 0.4, 6, 60, '#ffffff', 16, 3);
    FX.text(this.x, this.y - this.h * 1.2, 'TECH', '#ffffff', 18);
    SB.Audio.play('dodge');
  };

  /* ---------------- ledges ---------------- */
  Fighter.prototype.grabLedge = function (L) {
    this.ledge = L; this.state = 'ledge'; this.stateT = 0; this.ledgeT = 0;
    this.x = L.x - L.dir * 16; this.y = L.y + 44;
    this.vx = 0; this.vy = 0;
    this.dir = -L.dir;
    this.jumps = 2; this.airDodges = 1; this.recovUsed = false;
    this.iframes = 22;
    FX.glow(this.x, this.y - this.h * 0.4, 5, this.col.glow, 1.6, 5);
  };

  Fighter.prototype.updateLedge = function (cmd, w) {
    this.ledgeT++;
    const L = this.ledge;
    if (this.ledgeT > 220) { this.dropLedge(); return; }
    if (cmd.buffered('jump')) {
      cmd.consume('jump');
      this.dropLedge();
      this.vy = this.d.jumpV * 0.98; this.vx = -L.dir * 3.4;
      SB.Audio.play('jump');
      return;
    }
    if (cmd.buffered('light')) {
      cmd.consume('light');
      this.x = L.x - L.dir * 26; this.y = L.y;
      this.state = 'idle'; this.ledge = null; this.grounded = true; this.ledgeCool = 26;
      this.startMove(this.kit.nlight);
      return;
    }
    if (cmd.buffered('dodge')) {
      cmd.consume('dodge');
      this.x = L.x - L.dir * 34; this.y = L.y;
      this.state = 'roll'; this.rollDir = -L.dir; this.stateT = 0; this.iframes = 20;
      this.ledge = null; this.grounded = true; this.ledgeCool = 26;
      return;
    }
    if (cmd.held.down || cmd.stickX === L.dir) { this.dropLedge(); return; }
    if (cmd.held.up || cmd.stickX === -L.dir) {
      this.x = L.x - L.dir * 30; this.y = L.y;
      this.state = 'land'; this.landLag = 6; this.grounded = true;
      this.ledge = null; this.ledgeCool = 26;
      return;
    }
    this.updatePose(cmd);
  };

  Fighter.prototype.dropLedge = function () {
    this.ledge = null; this.state = 'air'; this.ledgeCool = 22; this.stateT = 0;
  };

  /* ---------------- grabs ---------------- */
  Fighter.prototype.updateGrabbed = function (w) {
    this.grabT--;
    const g = this.grabbedBy;
    if (!g || g.dead || g.state === 'ko') {
      if (g) g.grabbed = null;
      this.grabbedBy = null;
      this.hitstun = Math.max(this.hitstun, 6);
      return;
    }
    if (this.grabT <= 0) {
      /* the throw: a scaled-up version of the grabber's special */
      g.grabbed = null;
      this.grabbedBy = null;
      const base = g.kit.special;
      const thrown = Object.create(base);
      thrown.dmg = base.dmg * 2.1;
      thrown.bkb = base.bkb * 2.0;
      thrown.kbs = base.kbs * 1.7;
      thrown.ang = 48;
      this.iframes = 0; this.invuln = 0;
      this.takeHit(g, thrown, this.x, this.y - this.h * 0.5, 1, w);
      FX.text(g.x, g.y - g.h * 1.5, 'THROW', g.playerCol, 20);
      return;
    }
    this.x = g.x + g.dir * this.h * 0.42;
    this.y = g.y;
    this.vx = 0; this.vy = 0;
    this.flash = Math.max(this.flash, 0.3);
    this.updatePose(null);
  };

  /* ---------------- KO / respawn ---------------- */
  Fighter.prototype.updateKO = function (w) {
    this.koT++;
    if (this.koT > 62) {
      if (this.stocks <= 0) { this.dead = true; this.state = 'gone'; return; }
      this.state = 'respawn'; this.respawnT = 0;
      const sp = w.stage.spawns[this.port % w.stage.spawns.length];
      this.x = sp.x; this.y = sp.y - 240;
      this.vx = 0; this.vy = 0;
      this.hp = this.d.maxHP;
      this.invuln = 110;
      this.stale.length = 0;
      SB.Audio.play('spawn');
    }
  };

  Fighter.prototype.updateRespawn = function (cmd, w) {
    this.respawnT++;
    this.vy = 0;
    this.y = U.damp(this.y, w.stage.spawns[this.port % w.stage.spawns.length].y - 40, 6, 1 / 60);
    if (this.respawnT > 34 && (this.respawnT > 70 || (cmd && (cmd.held.left || cmd.held.right || cmd.held.jump || cmd.held.light)))) {
      this.state = 'air'; this.stateT = 0;
      this.jumps = 2; this.airDodges = 1;
    }
    this.updatePose(cmd);
  };

  Fighter.prototype.breakShield = function () {
    this.shieldHP = 0; this.shieldBreak = 96;
    this.state = 'hurt'; this.stateT = 0;
    this.vy = -8; this.grounded = false;
    FX.ring(this.x, this.y - this.h * 0.5, 8, 130, '#8fd8ff', 24, 6);
    FX.shards(this.x, this.y - this.h * 0.5, 16, '#bfeaff', 7, 7);
    FX.text(this.x, this.y - this.h * 1.4, 'SHIELD BREAK', '#8fd8ff', 22);
    FX.addShake(12);
    SB.Audio.play('explode');
  };

  /* ---------------- taking a hit ---------------- */
  /* Returns true if the hit connected (used by combat.js for hitstop). */
  Fighter.prototype.takeHit = function (src, mv, hx, hy, chargeMul, w) {
    if (this.invuln > 0 || this.iframes > 0 || this.state === 'ko' || this.dead) return false;

    /* counter window */
    if (this.counterT > 0 && this.counterMove) {
      const cm = this.counterMove;
      this.counterT = 0;
      this.iframes = 16;
      FX.ring(this.x, this.y - this.h * 0.5, 8, 120, '#ffe08a', 20, 6);
      FX.screenFlash('#ffe6a8', 0.3);
      FX.text(this.x, this.y - this.h * 1.35, 'COUNTER', '#ffe08a', 24);
      SB.Audio.play('parry');
      FX.hitstop = 12;
      src.takeHit(this, cm, src.x, src.y - src.h * 0.5, 1.25, w);
      return false;
    }

    /* ward absorbs one hit */
    if (this.wardT > 0) {
      this.wardT = 0;
      this.iframes = 20;
      this.airDodges = 1;
      FX.ring(this.x, this.y - this.h * 0.5, 6, 110, this.col.glow, 20, 5);
      FX.text(this.x, this.y - this.h * 1.3, 'WARDED', this.col.glow, 20);
      SB.Audio.play('parry');
      return false;
    }

    /* shield */
    if (this.state === 'shield' && this.shieldHP > 0) {
      const dmg = mv.dmg * (chargeMul || 1);
      this.shieldHP -= dmg * 1.25 + 4;
      this.vx += Math.sign(this.x - src.x || src.dir) * (1.2 + dmg * 0.08);
      FX.ring(hx, hy, 6, 40, this.col.glow, 12, 3);
      FX.spark(hx, hy, 6, '#dff2ff', 3, 2, 1.4);
      SB.Audio.play('block');
      FX.hitstop = Math.max(FX.hitstop, 4);
      if (this.shieldHP <= 0) this.breakShield();
      return true;
    }

    /* Titan super-armour while charging a signature */
    if (src !== this && this.chargeT > 0 && this.chargeMove && this.chargeMove.armor && mv.dmg < 15) {
      this.hp -= mv.dmg * 0.35 * (src.d ? src.d.dmgMul : 1);
      this.armorFlash = 1;
      FX.spark(hx, hy, 6, '#ffcf6a', 3, 2, 1.5);
      SB.Audio.play('block');
      if (this.hp <= 0) this.knockOut(w, src);
      return true;
    }

    const stale = src.staleMul ? src.staleMul(mv) : 1;
    const cm = chargeMul || 1;
    const dmg = mv.dmg * cm * (src.d ? src.d.dmgMul : 1) * stale;
    this.hp -= dmg;
    this.taken += dmg;
    if (src !== this) { src.dealt += dmg; src.biggest = Math.max(src.biggest, dmg); }
    this.lastHitBy = src;

    /* knockback: scales with how much health the victim has already lost */
    const lost = 1 - U.sat(this.hp / this.d.maxHP);
    let kb = (mv.bkb * 0.55 + mv.kbs * dmg * (0.6 + lost * 5.0)) * cm;
    kb *= (src.d ? src.d.kbMul : 1) * this.d.kbTaken / this.d.weight;
    kb = U.clamp(kb, 4, 120);

    const angRad = U.rad(mv.ang);
    const face = mv.back ? (this.x < src.x ? -1 : 1) : src.dir;
    const vel = kb * 0.30;
    this.vx = Math.cos(angRad) * vel * face;
    this.vy = -Math.sin(angRad) * vel;
    if (mv.ang > 180 && mv.ang < 340) this.vy = Math.abs(this.vy); /* spike */

    this.hitstun = U.clamp(Math.round(kb * 0.95), 7, HITSTUN_MAX);
    this.tumble = kb > TUMBLE_KB;
    this.spin = (Math.random() < 0.5 ? -1 : 1) * (0.10 + kb * 0.004);
    this.spinAcc = 0;
    this.grounded = false;
    this.state = this.tumble ? 'launch' : 'hurt';
    this.stateT = 0;
    this.flash = 1;
    this.hudShake = 1;
    this.hitstop = Math.round(mv.hitstop * (0.7 + cm * 0.4));
    this.move = null; this.mvTiming = null; this.chargeT = 0; this.chargeMove = null;
    this.ledge = null;
    if (this.state === 'ledge') this.ledgeCool = 20;

    /* combo bookkeeping on the attacker */
    if (src !== this) {
      src.combo++; src.comboT = 90;
      if (src.combo >= 2) {
        FX.text(src.x, src.y - src.h * 1.5, src.combo + ' HIT', src.playerCol, 18 + Math.min(12, src.combo));
        SB.Audio.play('combo', { n: src.combo });
      }
    }

    /* visuals */
    const style = this.cosItems.hitfx && !this.cosItems.hitfx.none ? this.cosItems.hitfx.shape
      : (src.cosItems && src.cosItems.hitfx && !src.cosItems.hitfx.none ? src.cosItems.hitfx.shape : 0);
    const pw = U.clamp(dmg / 9, 0.5, 3);
    FX.impact(hx, hy, face, mv.fx.col, mv.fx.col2, pw, style);
    FX.addShake(2.5 + pw * 3.4);
    FX.punch(0.012 + pw * 0.012);
    if (dmg > 14) FX.screenFlash(mv.fx.col2, 0.14);
    FX.text(hx, hy - 18, Math.round(dmg) + '', dmg > 14 ? '#ffd66a' : '#ffffff', 14 + Math.min(14, dmg));
    SB.Audio.play(dmg > 14 ? 'heavy' : 'hit', { power: pw });

    if (this.hp <= 0) this.knockOut(w, src);
    return true;
  };

  Fighter.prototype.knockOut = function (w, src) {
    this.hp = 0;
    this.state = 'ko'; this.koT = 0;
    this.stocks--; this.falls++;
    if (src && src !== this) src.kos++;
    FX.ko(this.x, this.y - this.h * 0.5, this.playerCol);
    FX.text(this.x, this.y - this.h * 1.4, 'K.O.', '#ffffff', 34);
    SB.Audio.play('ko');
    if (w && w.onKO) w.onKO(this, src);
  };

  /* Ring-out: called by the match when a fighter crosses a blast zone. */
  Fighter.prototype.blastKO = function (w, edge) {
    if (this.state === 'ko') return;
    this.stocks--; this.falls++;
    if (this.lastHitBy && this.lastHitBy !== this) this.lastHitBy.kos++;
    this.state = 'ko'; this.koT = 0;
    this.hp = 0;
    FX.blastMark(edge.x, edge.y, this.playerCol);
    FX.screenFlash('#ffffff', 0.35);
    FX.addShake(16);
    SB.Audio.play('ko');
    if (w && w.onKO) w.onKO(this, this.lastHitBy);
  };

  /* ---------------- animation ---------------- */
  Fighter.prototype.updatePose = function (cmd, frozen) {
    const t = this.animT;
    let target;
    const mv = this.move, T = this.mvTiming;

    if (this.state === 'ko') target = POSES.ko(this.koT / 12);
    else if (this.state === 'respawn') target = POSES.respawn(this.respawnT / 34);
    else if (this.grabbedBy) target = POSES.hurt(0.5, true);
    else if (this.shieldBreak > 0) target = POSES.hurt(1 - this.shieldBreak / 96, true);
    else if (mv && T) {
      const u = this.mvFrame / T.total;
      let spin = 0;
      if (mv.swing === 'spin' || mv.swing === 'aerialSpin' || mv.swing === 'drill') {
        const a = U.sat((this.mvFrame - T.startup) / Math.max(1, T.active));
        spin = a * U.TAU * (mv.swing === 'drill' ? 2.2 : 1);
      }
      target = Pose.attack({ startup: T.startup, active: T.active, total: T.total, swing: mv.swing, hits: mv.hits },
        u, POSES.idle(t), spin);
    } else if (this.chargeT > 0 && this.chargeMove) {
      const k = U.sat(this.chargeT / 40);
      const sw = SB.SWINGS[this.chargeMove.swing] || SB.SWINGS.jab;
      target = Pose.blend(POSES.idle(t), Pose.apply(POSES.idle(t), sw.a), U.easeOut(k));
      target.hipY += Math.sin(t * 22) * 0.006 * k;
    } else if (this.hitstun > 0) {
      if (this.tumble) { this.spinAcc = (this.spinAcc || 0) + this.spin; target = POSES.launch(1, this.spinAcc); }
      else target = POSES.hurt(1 - this.hitstun / 22, false);
    } else if (this.state === 'ledge') target = POSES.ledge(t);
    else if (this.state === 'taunt') {
      const em = this.cosItems.emote && !this.cosItems.emote.none ? this.cosItems.emote.shape : 0;
      target = POSES.taunt(1 - this.tauntT / 52, em);
    } else if (this.state === 'shield') target = POSES.shield(t);
    else if (this.state === 'dodge') target = POSES.dodge(this.stateT / this.d.dodgeFrames);
    else if (this.state === 'roll') target = POSES.roll(this.stateT / 26);
    else if (this.state === 'airdodge') target = POSES.airdodge(this.stateT / 30);
    else if (this.state === 'jumpsquat') target = POSES.land(1 - this.stateT / JUMPSQUAT);
    else if (this.landLag > 0) target = POSES.land(1 - this.landLag / 8);
    else if (!this.grounded) {
      if (this.vy < -1) target = POSES.jump(U.sat(-this.vy / 13));
      else target = POSES.fall(0, this.vy);
    } else if (this.state === 'crouch') target = POSES.crouch();
    else if (this.state === 'run') target = POSES.run(this.walkPhase % 1);
    else if (this.state === 'walk') target = POSES.walk(this.walkPhase % 1);
    else target = POSES.idle(t);

    /* short cross-fade keeps transitions clean instead of snapping */
    if (!frozen) {
      const speed = mv ? 0.55 : 0.30;
      this.pose = Pose.blend(this.pose, target, speed);
    }
    this.skel = SB.computeSkel(this.pose, this.h, this.d.build);
  };

  /* Live hitboxes in world space, or null when nothing is active. */
  Fighter.prototype.activeHitboxes = function () {
    const mv = this.move, T = this.mvTiming;
    if (!mv || !T) return null;
    const f = this.mvFrame;
    if (f <= T.startup || f > T.startup + T.active) return null;
    if (mv.kind === 'counter' || mv.kind === 'buff') return null;
    const u = (f - T.startup - 1) / Math.max(1, T.active - 1);
    const boxes = SB.moveHitboxes(mv, u);
    const out = [];
    for (const b of boxes) {
      out.push({ x: this.x + b.x * this.h * this.dir, y: this.y + b.y * this.h, r: b.r * this.h });
    }
    return out;
  };

  Fighter.prototype.hurtbox = function () {
    return { x: this.x, y: this.y, h: this.h * 0.92, r: this.r };
  };
})(window.SB);
