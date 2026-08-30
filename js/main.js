/* SMASHFORGE — bootstrap, canvas sizing, fixed-step loop, match lifecycle. */
(function (SB) {
  'use strict';
  const U = SB.U, FX = SB.FX;

  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d', { alpha: false });
  let dpr = 1;

  SB.VW = 1280; SB.VH = 720;
  SB.match = null;
  let inMatch = false;
  let resultShown = false;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth, H = window.innerHeight;
    SB.VW = W; SB.VH = H;
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  window.addEventListener('resize', resize);

  /* ---------------- match lifecycle ---------------- */
  SB.startMatch = function (cfg) {
    SB.Audio.init();
    SB.Audio.resume();
    FX.shakeScale = SB.G.opts.shake;
    SB.match = new SB.Match(cfg);
    SB.match.hitboxDebug = !!SB.G.opts.hitboxes;
    inMatch = true;
    resultShown = false;
    SB.Input.active = true;
    hideScreens();
  };

  function hideScreens() {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('on', 'fade'));
  }

  function quitMatch(toResults) {
    inMatch = false;
    SB.Input.active = false;
    SB.Audio.stopMusic();
    if (toResults && SB.match && SB.match.result) SB.showResults(SB.match);
    else {
      SB.UI.stack.length = 0;
      SB.UI.show('sc-title', false);
    }
  }
  SB.quitMatch = quitMatch;

  /* ---------------- loop ---------------- */
  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0, clock = 0, slowTick = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = now - last;
    last = now;
    if (dt > 220) dt = 220;
    acc += dt;
    clock += dt / 1000;

    let steps = 0;
    while (acc >= STEP && steps < 5) {
      acc -= STEP;
      steps++;
      tick();
    }
    render();
    SB.Input.endFrame();
  }

  function tick() {
    SB.Audio.update(1 / 60);

    if (inMatch && SB.match) {
      /* brief slow-motion after a KO for readability */
      if (FX.slow > 0) {
        slowTick = (slowTick + 1) % 3;
        if (slowTick !== 0) { FX.update(); return; }
      }
      SB.match.update();
      if (SB.match.phase === 'over' && SB.match.phaseT > 130 && !resultShown) {
        resultShown = true;
        quitMatch(true);
      }
      return;
    }
    if (SB.UI.cur === 'sc-designer') SB.Designer.step();
  }

  function render() {
    const W = SB.VW, H = SB.VH;
    if (inMatch && SB.match) {
      SB.match.draw(ctx, W, H, clock);
    } else {
      ctx.fillStyle = '#05070e';
      ctx.fillRect(0, 0, W, H);
    }
  }

  /* ---------------- global keys ---------------- */
  window.addEventListener('keydown', (e) => {
    if (SB.Input.capturing) return;
    if (inMatch && SB.match) {
      if (e.code === 'Escape') { SB.match.paused = !SB.match.paused; SB.Audio.play('uiBack'); }
      else if (e.code === 'KeyQ' && SB.match.paused) quitMatch(false);
      else if (e.code === 'KeyR' && SB.match.mode === 'training') {
        const m = SB.match;
        m.fighters.forEach((f, i) => {
          const sp = m.stage.spawns[i % m.stage.spawns.length];
          const stocks = f.stocks;
          f.reset(sp.x, sp.y, sp.x > 0 ? -1 : 1);
          f.stocks = stocks;
        });
        FX.reset();
        SB.toast('Training reset');
      }
      else if (e.code === 'F1') { SB.match.hitboxDebug = !SB.match.hitboxDebug; e.preventDefault(); }
      return;
    }
    if (e.code === 'Escape' && SB.UI.cur !== 'sc-title') SB.UI.back();
  });

  /* first gesture unlocks WebAudio */
  function unlock() {
    SB.Audio.init();
    SB.Audio.resume();
    SB.Audio.setSfx(SB.G.opts.sfx);
    SB.Audio.setMus(SB.G.opts.mus);
  }
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  /* ---------------- boot ---------------- */
  function boot() {
    resize();
    SB.Input.init();
    SB.initScreens();
    SB.Designer.wire();
    requestAnimationFrame(frame);

    /* eslint-disable no-console */
    console.log('%cSMASHFORGE', 'font:900 22px sans-serif;color:#4fc3f7',
      '\n' + SB.MOVES.length + ' moves · ' + SB.COS_COUNT + ' cosmetics · ' +
      SB.ARCHETYPES.length + ' weapons · ' + SB.STAGES.length + ' stages');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.SB);
