/* SMASHFORGE — fully procedural WebAudio SFX + adaptive music bed. No asset files. */
(function (SB) {
  'use strict';
  const U = SB.U;

  const A = {
    ctx: null, master: null, sfxBus: null, musBus: null,
    ready: false, enabled: true,
    volSfx: 0.7, volMus: 0.35,
    noiseBuf: null,
    musicOn: false, musTimer: 0, musStep: 0, musIntensity: 0
  };
  SB.Audio = A;

  A.init = function () {
    if (A.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { A.enabled = false; return; }
    A.ctx = new AC();
    A.master = A.ctx.createGain(); A.master.gain.value = 0.9; A.master.connect(A.ctx.destination);

    /* soft limiter so stacked hits never clip */
    const comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.18;
    comp.connect(A.master);

    A.sfxBus = A.ctx.createGain(); A.sfxBus.gain.value = A.volSfx; A.sfxBus.connect(comp);
    A.musBus = A.ctx.createGain(); A.musBus.gain.value = A.volMus; A.musBus.connect(comp);

    const len = A.ctx.sampleRate * 2;
    A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.ready = true;
  };

  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
  A.setSfx = function (v) { A.volSfx = v; if (A.sfxBus) A.sfxBus.gain.value = v; };
  A.setMus = function (v) { A.volMus = v; if (A.musBus) A.musBus.gain.value = v; };

  function now() { return A.ctx.currentTime; }

  /* ---- primitives ---- */
  function tone(o) {
    if (!A.ready || !A.enabled) return;
    const t = now() + (o.delay || 0);
    const osc = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    const peak = (o.gain === undefined ? 0.3 : o.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.atk || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.cutoff) {
      const f = A.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.setValueAtTime(o.cutoff, t);
      if (o.cutoff1) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.cutoff1), t + o.dur);
      node.connect(f); node = f;
    }
    node.connect(g); g.connect(o.bus || A.sfxBus);
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  function noise(o) {
    if (!A.ready || !A.enabled) return;
    const t = now() + (o.delay || 0);
    const src = A.ctx.createBufferSource();
    src.buffer = A.noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = A.ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.f1), t + o.dur);
    f.Q.value = o.q === undefined ? 1.2 : o.q;
    const g = A.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain === undefined ? 0.25 : o.gain, t + (o.atk || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g); g.connect(o.bus || A.sfxBus);
    src.start(t); src.stop(t + o.dur + 0.05);
  }

  /* ---- game sounds ---- */
  const S = {};
  A.play = function (name, p) {
    if (!A.ready || !A.enabled) return;
    const fn = S[name];
    if (fn) fn(p || {});
  };

  S.swing = (p) => {
    const w = U.clamp(p.weight || 1, 0.5, 2.2);
    noise({ f0: 2600 / w, f1: 700 / w, dur: 0.16 + w * 0.05, gain: 0.10 + w * 0.03, q: 0.7, rate: 1.4 });
  };
  S.hit = (p) => {
    const pw = U.clamp(p.power || 1, 0.3, 2.5);
    noise({ f0: 1800, f1: 260, dur: 0.09, gain: 0.30, q: 0.6, filter: 'lowpass' });
    tone({ type: 'triangle', f0: 300 / pw, f1: 70, dur: 0.13 + pw * 0.05, gain: 0.30 });
    tone({ type: 'square', f0: 900, f1: 400, dur: 0.05, gain: 0.07 });
  };
  S.heavy = (p) => {
    noise({ f0: 900, f1: 90, dur: 0.30, gain: 0.42, q: 0.4, filter: 'lowpass' });
    tone({ type: 'sine', f0: 160, f1: 42, dur: 0.42, gain: 0.44 });
    tone({ type: 'sawtooth', f0: 520, f1: 120, dur: 0.16, gain: 0.13, cutoff: 2200, cutoff1: 300 });
  };
  S.block = () => {
    tone({ type: 'square', f0: 1400, f1: 900, dur: 0.09, gain: 0.13 });
    noise({ f0: 4200, f1: 2400, dur: 0.10, gain: 0.16, q: 3 });
  };
  S.parry = () => {
    tone({ type: 'sine', f0: 1760, f1: 2640, dur: 0.22, gain: 0.24 });
    tone({ type: 'sine', f0: 2640, f1: 3520, dur: 0.30, gain: 0.14, delay: 0.05 });
    noise({ f0: 6000, f1: 3000, dur: 0.20, gain: 0.12, q: 4 });
  };
  S.jump = () => { tone({ type: 'sine', f0: 300, f1: 640, dur: 0.13, gain: 0.16 }); noise({ f0: 900, f1: 2200, dur: 0.09, gain: 0.05 }); };
  S.djump = () => { tone({ type: 'triangle', f0: 420, f1: 900, dur: 0.16, gain: 0.15 }); noise({ f0: 1400, f1: 3400, dur: 0.12, gain: 0.06 }); };
  S.land = (p) => { noise({ f0: 420, f1: 120, dur: 0.12, gain: 0.10 + (p.hard ? 0.14 : 0), filter: 'lowpass' }); tone({ type: 'sine', f0: 120, f1: 55, dur: 0.13, gain: 0.13 }); };
  S.dodge = () => { noise({ f0: 3200, f1: 900, dur: 0.17, gain: 0.10, q: 1.4, rate: 1.6 }); tone({ type: 'sine', f0: 700, f1: 1300, dur: 0.12, gain: 0.05 }); };
  S.charge = () => { tone({ type: 'sawtooth', f0: 90, f1: 260, dur: 0.62, gain: 0.09, cutoff: 500, cutoff1: 1800 }); };
  S.chargeReady = () => { tone({ type: 'square', f0: 880, f1: 1320, dur: 0.14, gain: 0.10 }); };
  S.shoot = (p) => {
    tone({ type: 'sawtooth', f0: 900 * (p.pitch || 1), f1: 180, dur: 0.16, gain: 0.16, cutoff: 3000, cutoff1: 500 });
    noise({ f0: 2400, f1: 500, dur: 0.13, gain: 0.13, q: 0.8 });
  };
  S.explode = () => {
    noise({ f0: 700, f1: 60, dur: 0.5, gain: 0.42, q: 0.3, filter: 'lowpass' });
    tone({ type: 'sine', f0: 130, f1: 32, dur: 0.6, gain: 0.4 });
  };
  S.ko = () => {
    noise({ f0: 2600, f1: 120, dur: 0.55, gain: 0.34, q: 0.5 });
    tone({ type: 'sawtooth', f0: 520, f1: 60, dur: 0.7, gain: 0.24, cutoff: 3000, cutoff1: 200 });
    tone({ type: 'sine', f0: 90, f1: 34, dur: 0.9, gain: 0.34 });
  };
  S.spawn = () => { tone({ type: 'sine', f0: 200, f1: 800, dur: 0.3, gain: 0.14 }); tone({ type: 'sine', f0: 400, f1: 1600, dur: 0.35, gain: 0.08, delay: 0.05 }); };
  S.ui = () => { tone({ type: 'square', f0: 620, f1: 900, dur: 0.05, gain: 0.05 }); };
  S.uiBig = () => { tone({ type: 'square', f0: 400, f1: 800, dur: 0.09, gain: 0.09 }); tone({ type: 'square', f0: 800, f1: 1200, dur: 0.12, gain: 0.05, delay: 0.06 }); };
  S.uiBack = () => { tone({ type: 'square', f0: 500, f1: 280, dur: 0.08, gain: 0.06 }); };
  S.combo = (p) => { const n = U.clamp(p.n || 2, 2, 12); tone({ type: 'sine', f0: 660 + n * 70, dur: 0.09, gain: 0.07 }); };
  S.victory = () => {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => tone({ type: 'triangle', f0: f, dur: 0.5, gain: 0.16, delay: i * 0.12 }));
  };

  /* ---- adaptive music bed: 8-bar minor loop, intensity opens the filter ---- */
  const SCALE = [0, 3, 5, 7, 10, 12, 15];
  const ROOT = 55; /* A1 */
  A.startMusic = function () { if (!A.ready) return; A.musicOn = true; A.musStep = 0; A.musTimer = 0; };
  A.stopMusic = function () { A.musicOn = false; };
  A.setIntensity = function (v) { A.musIntensity = U.clamp(v, 0, 1); };

  A.update = function (dtSec) {
    if (!A.ready || !A.musicOn || !A.enabled) return;
    A.musTimer -= dtSec;
    if (A.musTimer > 0) return;
    const bpm = 128 + A.musIntensity * 22;
    const step = 60 / bpm / 2; /* eighth notes */
    A.musTimer += step;
    const s = A.musStep++;
    const bar = Math.floor(s / 8) % 8;
    const beat = s % 8;
    const inten = A.musIntensity;
    const bus = A.musBus;

    /* kick */
    if (beat === 0 || beat === 3 || (beat === 6 && bar % 2 === 1)) {
      tone({ type: 'sine', f0: 130, f1: 38, dur: 0.24, gain: 0.5, bus: bus });
      noise({ f0: 220, f1: 60, dur: 0.07, gain: 0.14, filter: 'lowpass', bus: bus });
    }
    /* snare / clap */
    if (beat === 4 || (beat === 7 && bar % 4 === 3)) {
      noise({ f0: 2000, f1: 800, dur: 0.13, gain: 0.16 + inten * 0.08, q: 0.9, bus: bus });
    }
    /* hat */
    if (inten > 0.15 && beat % 2 === 1) {
      noise({ f0: 9000, f1: 6000, dur: 0.035, gain: 0.045 + inten * 0.03, q: 2.5, bus: bus });
    }
    /* bass */
    const prog = [0, 0, 5, 5, 3, 3, 7, 7][bar];
    if (beat % 2 === 0) {
      const f = ROOT * Math.pow(2, (SCALE[prog % SCALE.length] + (beat === 6 ? 12 : 0)) / 12);
      tone({ type: 'sawtooth', f0: f, dur: step * 1.7, gain: 0.16, cutoff: 300 + inten * 900, bus: bus });
    }
    /* lead arp — only when the fight heats up */
    if (inten > 0.34 && (beat === 1 || beat === 3 || beat === 5 || beat === 7)) {
      const idx = (prog + [0, 2, 4, 2][(beat - 1) / 2]) % SCALE.length;
      const f = ROOT * 4 * Math.pow(2, SCALE[idx] / 12);
      tone({ type: 'triangle', f0: f, dur: step * 1.2, gain: 0.05 + inten * 0.05, bus: bus });
    }
    /* pad swell at the top of each bar */
    if (beat === 0) {
      const f = ROOT * 2 * Math.pow(2, SCALE[prog % SCALE.length] / 12);
      tone({ type: 'sawtooth', f0: f, dur: step * 7, gain: 0.035 + inten * 0.03, cutoff: 400 + inten * 1400, bus: bus });
      tone({ type: 'sawtooth', f0: f * 1.5, dur: step * 7, gain: 0.025, cutoff: 500 + inten * 1200, bus: bus });
    }
  };
})(window.SB);
