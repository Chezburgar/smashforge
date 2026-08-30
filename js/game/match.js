/* SMASHFORGE — match world: camera, loop, KO handling, results. */
(function (SB) {
  'use strict';
  const U = SB.U, FX = SB.FX;

  const PLAYER_COLS = ['#4fc3f7', '#ff6b6b', '#ffd24a', '#7ee787'];

  function Match(cfg) {
    this.cfg = cfg;
    this.stage = SB.stage(cfg.stageId);
    this.mode = cfg.mode || 'versus';
    this.stocks = cfg.stocks === undefined ? 3 : cfg.stocks;
    this.timeLimit = cfg.timeLimit === undefined ? 180 * 60 : cfg.timeLimit * 60;
    this.timeLeft = this.timeLimit;
    this.fighters = [];
    this.ais = [];
    this.cmds = [];
    this.projectiles = [];
    this.teams = null;
    this.frame = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.banner = 'READY'; this.bannerT = 70; this.bannerMax = 70; this.bannerCol = '#eaf2ff'; this.bannerSub = '';
    this.result = null;
    this.paused = false;
    this.hitboxDebug = false;
    this.wave = 1;

    SB.initWeather(this.stage);
    FX.reset();

    cfg.fighters.forEach((spec, i) => {
      const sp = this.stage.spawns[i % this.stage.spawns.length];
      /* gauntlet waves are one-and-done; training never runs out */
      let stocks = this.stocks;
      if (this.mode === 'training') stocks = 99;
      else if (this.mode === 'gauntlet' && i > 0) stocks = 1;
      if (spec.stocks !== undefined) stocks = spec.stocks;
      const f = new SB.Fighter(spec.build, {
        x: sp.x, y: sp.y, dir: sp.x > 0 ? -1 : 1,
        playerCol: spec.color || PLAYER_COLS[i % 4],
        port: i, human: !!spec.human,
        inputSlot: spec.inputSlot, padIndex: spec.padIndex,
        stocks: stocks
      });
      f.stageRim = this.stage.rim;
      f.hudLag = 1;
      this.fighters.push(f);
      this.cmds.push(new SB.Cmd());
      this.ais.push(spec.human ? null : new SB.AI(f, spec.level === undefined ? 1 : spec.level));
    });

    SB.HUD.makePortraits(this.fighters);

    this.cam = {
      x: 0, y: this.stage.centerY, z: 1,
      tx: 0, ty: this.stage.centerY, tz: 1
    };
    this.updateCamera(true);
  }
  SB.Match = Match;
  SB.PLAYER_COLS = PLAYER_COLS;

  Match.prototype.spawnProjectile = function (owner, mv, x, y, ang) {
    if (this.projectiles.length > 44) this.projectiles.shift();
    this.projectiles.push(new SB.Projectile(owner, mv, x, y, ang));
  };

  Match.prototype.say = function (text, col, sub, frames) {
    this.banner = text; this.bannerCol = col || '#eaf2ff';
    this.bannerSub = sub || '';
    this.bannerT = this.bannerMax = frames || 70;
  };

  Match.prototype.onKO = function (f, src) {
    FX.slow = 22;
    const who = src && src !== f ? src : null;
    if (this.mode === 'training') { f.stocks = 99; return; }
    if (f.stocks <= 0) {
      this.say('K.O.', f.playerCol, f.name + ' is out', 80);
    } else {
      this.say('K.O.', who ? who.playerCol : '#ffffff', who ? who.name + ' scores' : '', 54);
    }
  };

  Match.prototype.aliveCount = function () {
    let n = 0;
    for (const f of this.fighters) if (f.stocks > 0 || f.state === 'ko') n++;
    return n;
  };

  Match.prototype.checkEnd = function () {
    if (this.phase === 'over') return;
    /* wait out any in-flight KO animation so the last hit reads properly */
    const settling = this.fighters.some((f) => f.state === 'ko');
    if (settling) return;
    const alive = this.fighters.filter((f) => f.stocks > 0);

    if (this.mode === 'gauntlet') {
      const player = this.fighters[0];
      if (player.stocks <= 0) { this.finish(null); return; }
      if (this.fighters.length > 1 && !this.fighters.slice(1).some((f) => f.stocks > 0)) this.nextWave();
      return;
    }
    if (this.mode === 'training') return;
    if (alive.length === 1) { this.finish(alive[0]); return; }
    if (alive.length === 0) {
      /* everyone went out together — the KO count decides it */
      let best = null;
      for (const f of this.fighters) {
        if (!best || f.kos > best.kos || (f.kos === best.kos && f.falls < best.falls)) best = f;
      }
      const tied = this.fighters.filter((f) => f.kos === best.kos && f.falls === best.falls).length > 1;
      this.finish(tied ? null : best, tied ? 'draw' : 'double');
    }
  };

  Match.prototype.nextWave = function () {
    this.wave++;
    this.say('WAVE ' + this.wave, '#ffd24a', 'Incoming', 80);
    const lvl = U.clamp(Math.floor(this.wave / 2), 0, 3);
    const n = Math.min(3, 1 + Math.floor(this.wave / 3));
    this.fighters = [this.fighters[0]];
    this.cmds = [this.cmds[0]];
    this.ais = [this.ais[0]];
    for (let i = 0; i < n; i++) {
      const sp = this.stage.spawns[(i + 1) % this.stage.spawns.length];
      const f = new SB.Fighter(SB.randomBuild('wave' + this.wave + '_' + i), {
        x: sp.x, y: sp.y - 200, dir: sp.x > 0 ? -1 : 1,
        playerCol: PLAYER_COLS[(i + 1) % 4], port: i + 1, stocks: 1
      });
      f.stageRim = this.stage.rim;
      this.fighters.push(f);
      this.cmds.push(new SB.Cmd());
      this.ais.push(new SB.AI(f, lvl));
    }
    SB.HUD.makePortraits(this.fighters);
    this.fighters[0].hp = Math.min(this.fighters[0].d.maxHP, this.fighters[0].hp + 30);
  };

  Match.prototype.finish = function (winner, how) {
    this.phase = 'over';
    this.phaseT = 0;
    this.result = {
      winner: winner,
      how: how || (winner ? 'ko' : 'time'),
      wave: this.wave,
      rows: this.fighters.map((f) => ({
        name: f.name, col: f.playerCol, kos: f.kos, falls: f.falls,
        dealt: Math.round(f.dealt), taken: Math.round(f.taken), biggest: Math.round(f.biggest),
        fighter: f
      }))
    };
    const draw = !winner && this.mode !== 'gauntlet';
    this.say(this.mode === 'gauntlet' && !winner ? 'DEFEAT' : (draw ? 'DRAW' : 'GAME'),
      winner ? winner.playerCol : (draw ? '#9fb0c4' : '#ff6b6b'),
      winner ? winner.name + ' wins' : (draw ? 'Nobody left standing' : 'Better luck next run'), 120);
    SB.Audio.play('victory');
    SB.Audio.stopMusic();
  };

  /* ---------------- update ---------------- */
  Match.prototype.update = function () {
    this.frame++;
    FX.update();

    if (this.phase === 'intro') {
      this.phaseT++;
      if (this.phaseT === 1) this.say('READY', '#eaf2ff', this.stage.name, 60);
      if (this.phaseT === 66) this.say('FIGHT', '#ffd24a', '', 46);
      if (this.phaseT > 66) { this.phase = 'play'; SB.Audio.startMusic(); }
      this.updateCamera(false);
      if (this.bannerT > 0) this.bannerT--;
      return;
    }
    if (this.bannerT > 0) this.bannerT--;

    if (this.phase === 'over') {
      this.phaseT++;
      this.stepWorld(true);
      this.updateCamera(false);
      return;
    }

    if (this.paused) return;

    /* global hit-freeze for weight */
    if (FX.hitstop > 0) { this.updateCamera(false); return; }

    this.stepWorld(false);

    if (this.timeLimit > 0) {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        let best = null;
        for (const f of this.fighters) {
          if (!best) { best = f; continue; }
          if (f.stocks > best.stocks || (f.stocks === best.stocks && f.hp > best.hp)) best = f;
        }
        this.finish(best);
      }
    }

    /* music intensity tracks the closest, most damaged pairing */
    let inten = 0;
    for (const f of this.fighters) inten = Math.max(inten, 1 - f.hp / f.d.maxHP);
    SB.Audio.setIntensity(inten * 0.75 + (this.fighters.some((f) => f.combo > 2) ? 0.25 : 0));

    this.checkEnd();
    this.updateCamera(false);
  };

  Match.prototype.stepWorld = function (frozenInput) {
    /* input */
    for (let i = 0; i < this.fighters.length; i++) {
      const f = this.fighters[i], cmd = this.cmds[i];
      if (f.dead) { cmd.clear(); continue; }
      if (frozenInput) { cmd.clear(); continue; }
      if (f.human) SB.readHuman(cmd, f.inputSlot, f.padIndex);
      else if (this.ais[i]) this.ais[i].think(cmd, this);
      else cmd.clear();
    }

    for (let i = 0; i < this.fighters.length; i++) {
      const f = this.fighters[i];
      if (f.dead) continue;
      f.update(this.cmds[i], this);
    }

    SB.Combat.resolve(this);

    /* soft body separation so two fighters never fully occlude each other */
    for (let i = 0; i < this.fighters.length; i++) {
      for (let j = i + 1; j < this.fighters.length; j++) {
        const a = this.fighters[i], b = this.fighters[j];
        if (a.dead || b.dead || a.state === 'ko' || b.state === 'ko') continue;
        if (a.hitstun > 0 || b.hitstun > 0 || a.grabbedBy || b.grabbedBy) continue;
        const dx = b.x - a.x;
        const want = (a.r + b.r) * 0.95;
        const d = Math.abs(dx);
        if (d >= want || Math.abs(a.y - b.y) > a.h * 0.7) continue;
        const push = (want - d) * 0.22;
        const s = dx === 0 ? (a.port < b.port ? -1 : 1) : Math.sign(dx);
        a.x -= s * push; b.x += s * push;
      }
    }

    /* blast zones */
    const b = this.stage.blast;
    for (const f of this.fighters) {
      if (f.dead || f.state === 'ko' || f.state === 'respawn') continue;
      if (f.x < b.l || f.x > b.r || f.y < b.t || f.y > b.b) {
        const ex = U.clamp(f.x, b.l, b.r), ey = U.clamp(f.y, b.t, b.b);
        f.blastKO(this, { x: ex, y: ey });
      }
    }
  };

  Match.prototype.updateCamera = function (snap) {
    const alive = this.fighters.filter((f) => !f.dead && f.state !== 'ko');
    const list = alive.length ? alive : this.fighters;
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const f of list) {
      minX = Math.min(minX, f.x); maxX = Math.max(maxX, f.x);
      minY = Math.min(minY, f.y - f.h); maxY = Math.max(maxY, f.y);
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 - 40;
    const spreadX = maxX - minX, spreadY = maxY - minY;
    const W = SB.VW, H = SB.VH;
    let z = Math.min(W / (spreadX + 560), H / (spreadY + 470));
    z = U.clamp(z, 0.55, 1.75);
    /* never zoom so far in that the stage loses context */
    z = Math.min(z, Math.max(0.55, H / 760));

    this.cam.tx = U.clamp(cx, -900, 900);
    this.cam.ty = U.clamp(cy, this.stage.blast.t + 300, 260);
    this.cam.tz = z;

    if (snap) { this.cam.x = this.cam.tx; this.cam.y = this.cam.ty; this.cam.z = this.cam.tz; return; }
    this.cam.x = U.damp(this.cam.x, this.cam.tx, 7, 1 / 60);
    this.cam.y = U.damp(this.cam.y, this.cam.ty, 6, 1 / 60);
    this.cam.z = U.damp(this.cam.z, this.cam.tz, 4.5, 1 / 60);
  };

  /* ---------------- draw ---------------- */
  Match.prototype.draw = function (ctx, W, H, t) {
    const cam = this.cam;
    const z = cam.z * (1 + FX.zoomPunch);
    const camX = cam.x + FX.shakeX, camY = cam.y + FX.shakeY;

    SB.drawSky(ctx, this.stage, { x: camX, y: camY }, t, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(z, z);
    ctx.translate(-camX, -camY);

    SB.drawWeather(ctx, this.stage, { x: camX, y: camY }, t);
    SB.drawStage(ctx, this.stage, t);

    /* respawn platforms */
    for (const f of this.fighters) {
      if (f.state !== 'respawn') continue;
      ctx.save();
      ctx.globalAlpha = 0.55 + Math.sin(t * 5) * 0.15;
      ctx.fillStyle = U.rgba(f.playerCol, 0.35);
      U.roundRect(ctx, f.x - 52, f.y + 2, 104, 12, 6); ctx.fill();
      ctx.strokeStyle = f.playerCol; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
    }

    for (const p of this.projectiles) p.draw(ctx, t);

    /* fighters: trail behind, body in front */
    for (const f of this.fighters) {
      if (f.dead) continue;
      if (f.trail.length > 2 && f.move) {
        const style = f.cosItems.trail && !f.cosItems.trail.none ? f.cosItems.trail.shape : 3;
        const col = f.move.fx.col, col2 = f.move.fx.col2;
        FX.drawTrail(ctx, f.trail, col, col2, f.h * 0.10 * (f.arch.trailW || 1), style, 0.9);
      }
    }
    /* player-coloured ground markers — the fastest way to tell fighters apart */
    for (const f of this.fighters) {
      if (f.dead || f.state === 'ko') continue;
      let gy = null;
      for (const p of this.stage.solids) {
        if (f.x < p.x - 6 || f.x > p.x + p.w + 6) continue;
        if (p.y >= f.y - 4 && (gy === null || p.y < gy)) gy = p.y;
      }
      if (gy === null || gy - f.y > 460) continue;
      const drop = U.sat(1 - (gy - f.y) / 460);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.16 + drop * 0.30;
      const rw = f.h * (0.30 + drop * 0.24);
      const gr = ctx.createRadialGradient(f.x, gy + 3, 0, f.x, gy + 3, rw);
      gr.addColorStop(0, U.rgba(f.playerCol, 0.85));
      gr.addColorStop(1, U.rgba(f.playerCol, 0));
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(f.x, gy + 3, rw, rw * 0.24, 0, 0, U.TAU); ctx.fill();
      ctx.restore();
    }

    for (const f of this.fighters) {
      if (f.dead) continue;
      let alpha = 1;
      if (f.invuln > 0 && f.state !== 'respawn') alpha = 0.45 + 0.4 * Math.sin(this.frame * 0.6);
      if (f.iframes > 0) alpha = Math.min(alpha, 0.55);
      if (f.state === 'ko') alpha = U.sat(1 - f.koT / 50);
      SB.drawFighter(ctx, f, t, { alpha: alpha });
    }

    FX.draw(ctx);
    if (this.hitboxDebug) SB.Combat.debugDraw(ctx, this);

    ctx.restore();

    SB.drawGrade(ctx, this.stage, W, H, t);

    if (FX.flashScreen > 0.004) {
      ctx.save();
      ctx.globalAlpha = U.sat(FX.flashScreen);
      ctx.fillStyle = FX.flashCol;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    SB.HUD.draw(ctx, this, W, H, t);

    if (this.paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(4,7,14,0.62)';
      ctx.fillRect(0, 0, W, H);
      U.text(ctx, 'PAUSED', W / 2, H / 2 - 8, { size: 54, align: 'center', weight: 900, fill: '#eaf2ff', letter: '0.1em', shadow: '#4fc3f7', blur: 22 });
      U.text(ctx, 'Esc — resume     Q — quit to menu', W / 2, H / 2 + 34, { size: 18, align: 'center', fill: '#9fb0c4' });
      ctx.restore();
    }
  };
})(window.SB);
