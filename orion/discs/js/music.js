/* ORION DISC PRINTER — the music
 *
 * SMASHFORGE's soundtrack (js/audio.js) is generated rather than recorded: an
 * eight-bar loop of oscillators whose filter opens as a fight heats up. That is
 * the sound this borrows, rearranged for something you would actually put on a
 * record — an intro, a middle that moves, and an ending, instead of a loop that
 * runs until the match does.
 *
 * Everything is rendered through an OfflineAudioContext, which runs as fast as
 * the machine can rather than in real time, so a three-minute track takes a
 * few seconds. The result is raw samples, which wav.js turns into a file.
 *
 * A track is decided entirely by its mood and its seed, so the same two always
 * give the same music: you can write a seed down and get your disc back.
 */
window.ORION_DISCS = window.ORION_DISCS || {};
(function (NS) {
  'use strict';

  /* ------------------------------------------------------------------ rng */
  /* mulberry32 — small, fast, and the same everywhere, which matters more
   * here than statistical perfection. */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  NS.seedFromText = function (text) {
    let h = 2166136261 >>> 0;
    const s = String(text || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };

  /* ---------------------------------------------------------------- moods */
  /* Each mood is a scale, a tempo range and how loud each layer sits. The
   * names are the ones shown on the disc. */
  const MOODS = {
    nebula: {
      label: 'Nebula',
      blurb: 'Slow pads and a soft pulse. The one to build to.',
      scale: [0, 3, 5, 7, 10],            /* minor pentatonic */
      root: 55,                            /* A1 */
      bpm: [84, 96],
      drums: 0.55, bass: 0.85, arp: 0.5, pad: 1, sparkle: 0.7,
      swing: 0.02
    },
    orbit: {
      label: 'Orbit',
      blurb: 'Steady four-to-the-floor. Good for a jukebox in a hallway.',
      scale: [0, 2, 3, 5, 7, 10],
      root: 58,
      bpm: [118, 128],
      drums: 1, bass: 1, arp: 0.75, pad: 0.55, sparkle: 0.5,
      swing: 0
    },
    deepfield: {
      label: 'Deep Field',
      blurb: 'Almost no drums. Long chords and a lot of room.',
      scale: [0, 2, 5, 7, 9],
      root: 49,
      bpm: [64, 74],
      drums: 0.15, bass: 0.6, arp: 0.3, pad: 1, sparkle: 0.85,
      swing: 0
    },
    pulsar: {
      label: 'Pulsar',
      blurb: 'Fast, bright and a bit relentless.',
      scale: [0, 3, 5, 6, 7, 10],
      root: 62,
      bpm: [138, 152],
      drums: 1, bass: 0.9, arp: 1, pad: 0.35, sparkle: 0.45,
      swing: 0
    },
    driftwood: {
      label: 'Driftwood',
      blurb: 'Warm, swung, slightly out of tune on purpose.',
      scale: [0, 2, 4, 7, 9],             /* major pentatonic */
      root: 52,
      bpm: [92, 104],
      drums: 0.7, bass: 0.8, arp: 0.65, pad: 0.7, sparkle: 0.6,
      swing: 0.06
    }
  };
  NS.MOODS = MOODS;
  NS.moodList = () => Object.keys(MOODS).map((k) => ({ id: k, label: MOODS[k].label, blurb: MOODS[k].blurb }));

  /* ------------------------------------------------------------ rendering */

  /* One shared noise buffer per render, for drums and for the air underneath
   * everything. */
  function noiseBuffer(ctx, r) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
    return buf;
  }

  function env(gain, t, peak, atk, dur) {
    gain.setValueAtTime(0.0001, t);
    gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
    gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(ctx, bus, o) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, o.t);
    if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), o.t + o.dur);
    if (o.detune) osc.detune.setValueAtTime(o.detune, o.t);
    env(g.gain, o.t, o.gain, o.atk || 0.006, o.dur);
    let node = osc;
    if (o.cutoff) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(o.cutoff, o.t);
      if (o.cutoff1) f.frequency.linearRampToValueAtTime(o.cutoff1, o.t + o.dur);
      f.Q.value = o.q || 0.9;
      node.connect(f); node = f;
    }
    node.connect(g); g.connect(bus);
    osc.start(o.t); osc.stop(o.t + o.dur + 0.05);
  }

  function hit(ctx, bus, buf, o) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f0, o.t);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), o.t + o.dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    env(g.gain, o.t, o.gain, o.atk || 0.002, o.dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(o.t, (o.offset || 0) % 1.5);
    src.stop(o.t + o.dur + 0.05);
  }

  const semi = (root, n) => root * Math.pow(2, n / 12);

  /* A track is bars of eight eighth-notes. Sections decide how busy each bar
   * is, so the record has a shape instead of running flat all the way
   * through. */
  function sections(bars) {
    const intro = Math.max(2, Math.round(bars * 0.12));
    const outro = Math.max(2, Math.round(bars * 0.14));
    const build = Math.round((bars - intro - outro) * 0.35);
    return function (bar) {
      if (bar < intro) return 0.25 + (bar / Math.max(1, intro)) * 0.2;
      if (bar >= bars - outro) {
        const k = (bars - bar) / Math.max(1, outro);
        return 0.25 + k * 0.5;
      }
      const b = bar - intro;
      if (b < build) return 0.45 + (b / Math.max(1, build)) * 0.35;
      return 0.8 + Math.sin(b * 0.7) * 0.18;
    };
  }

  /* Rendered at 22050 Hz mono on purpose: it is what fits in a resource pack
   * (see the note in app.js about size), and a jukebox in a cave is not the
   * place anyone notices the difference. */
  NS.SAMPLE_RATE = 22050;

  NS.render = async function (opts) {
    const mood = MOODS[opts.mood] || MOODS.nebula;
    const seconds = Math.max(8, Math.min(300, opts.seconds || 90));
    const r = rng(opts.seed >>> 0);
    const rate = opts.sampleRate || NS.SAMPLE_RATE;

    const bpm = mood.bpm[0] + r() * (mood.bpm[1] - mood.bpm[0]);
    const step = 60 / bpm / 2;                    /* an eighth note */
    const bars = Math.max(4, Math.floor(seconds / (step * 8)));
    const total = bars * step * 8 + 2.5;          /* room for the last tail */
    const busy = sections(bars);

    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OC) throw new Error('This browser cannot render audio offline.');
    const ctx = new OC(1, Math.ceil(total * rate), rate);

    /* master chain: a limiter so stacked hits never clip, then a gentle
     * high cut so the low bitrate has less to fight with. */
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.knee.value = 22; comp.ratio.value = 9;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    const air = ctx.createBiquadFilter();
    air.type = 'lowpass'; air.frequency.value = Math.min(9000, rate * 0.42);
    comp.connect(air); air.connect(master); master.connect(ctx.destination);

    const drums = ctx.createGain(); drums.gain.value = 0.9 * mood.drums; drums.connect(comp);
    const music = ctx.createGain(); music.gain.value = 0.85; music.connect(comp);
    const noise = noiseBuffer(ctx, r);

    /* An eight-bar chord movement, picked once per track. */
    const degrees = mood.scale.length;
    const prog = [];
    for (let i = 0; i < 8; i++) prog.push(Math.floor(r() * degrees));
    prog[0] = 0;
    prog[4] = Math.max(1, prog[4]);

    const arpShape = [0, 2, 1, 3, 2, 4, 1, 2].map((n) => (n + Math.floor(r() * 2)) % degrees);

    for (let bar = 0; bar < bars; bar++) {
      const inten = busy(bar);
      const chord = prog[bar % 8];
      const rootHz = semi(mood.root, mood.scale[chord]);

      /* pad: one long chord per bar, the thing that makes it a record rather
       * than a drum loop */
      if (mood.pad > 0.05) {
        const t = bar * 8 * step;
        const dur = step * 8 * 0.98;
        const cut = 320 + inten * 1500;
        tone(ctx, music, { t: t, type: 'sawtooth', f0: rootHz * 2, dur: dur, gain: 0.05 * mood.pad, atk: dur * 0.35, cutoff: cut, cutoff1: cut * 0.7 });
        tone(ctx, music, { t: t, type: 'sawtooth', f0: rootHz * 3, dur: dur, gain: 0.032 * mood.pad, atk: dur * 0.45, cutoff: cut, detune: 6 });
        tone(ctx, music, { t: t + step * 0.5, type: 'triangle', f0: rootHz * 4, dur: dur * 0.7, gain: 0.02 * mood.pad, atk: dur * 0.4 });
      }

      for (let beat = 0; beat < 8; beat++) {
        const swing = (beat % 2 === 1) ? mood.swing * step : 0;
        const t = (bar * 8 + beat) * step + swing;

        if (mood.drums > 0.05) {
          if (beat === 0 || beat === 3 || (beat === 6 && bar % 2 === 1)) {
            tone(ctx, drums, { t: t, type: 'sine', f0: 132, f1: 38, dur: 0.26, gain: 0.5 * inten });
            hit(ctx, drums, noise, { t: t, f0: 210, f1: 60, dur: 0.06, gain: 0.13, filter: 'lowpass', offset: r() });
          }
          if (inten > 0.4 && (beat === 4 || (beat === 7 && bar % 4 === 3))) {
            hit(ctx, drums, noise, { t: t, f0: 1900, f1: 780, dur: 0.14, gain: 0.15 * inten, q: 0.9, offset: r() });
          }
          if (inten > 0.55 && beat % 2 === 1) {
            hit(ctx, drums, noise, { t: t, f0: 8200, f1: 6000, dur: 0.035, gain: 0.05 * inten, q: 2.4, offset: r() });
          }
        }

        /* bass */
        if (beat % 2 === 0) {
          const oct = (beat === 6 && inten > 0.6) ? 12 : 0;
          tone(ctx, music, {
            t: t, type: 'sawtooth', f0: semi(mood.root, mood.scale[chord] + oct),
            dur: step * 1.7, gain: 0.15 * mood.bass, cutoff: 260 + inten * 900
          });
        }

        /* arpeggio, only once the track has warmed up */
        if (inten > 0.5 && beat % 2 === 1 && mood.arp > 0.1) {
          const d = mood.scale[arpShape[(bar + beat) % arpShape.length]];
          tone(ctx, music, {
            t: t, type: 'triangle', f0: semi(mood.root * 4, d),
            dur: step * 1.15, gain: (0.045 + inten * 0.04) * mood.arp
          });
        }

        /* a sparkle here and there so no two bars are identical */
        if (mood.sparkle > 0.2 && r() < 0.08 * mood.sparkle * inten) {
          const d = mood.scale[Math.floor(r() * degrees)];
          tone(ctx, music, {
            t: t, type: 'sine', f0: semi(mood.root * 8, d),
            dur: step * 2.4, gain: 0.03 * mood.sparkle, atk: 0.02
          });
        }
      }
    }

    /* Fade the very end so a record never clicks when it stops. */
    const buf = await ctx.startRendering();
    const data = buf.getChannelData(0);
    const fade = Math.min(data.length, Math.floor(rate * 1.2));
    for (let i = 0; i < fade; i++) data[data.length - 1 - i] *= i / fade;
    const rise = Math.min(data.length, Math.floor(rate * 0.05));
    for (let i = 0; i < rise; i++) data[i] *= i / rise;

    return {
      samples: data,
      sampleRate: rate,
      seconds: data.length / rate,
      bpm: Math.round(bpm),
      bars: bars,
      mood: opts.mood,
      seed: opts.seed >>> 0
    };
  };
})(window.ORION_DISCS);
