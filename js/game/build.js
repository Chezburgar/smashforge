/* SMASHFORGE — character build model: stats, body, colours, cosmetics, move loadout.
   A build is plain JSON so the whole roster round-trips through localStorage. */
(function (SB) {
  'use strict';
  const U = SB.U;

  const STAT_MIN = 3, STAT_MAX = 10, STAT_BUDGET = 26;
  SB.STAT_MIN = STAT_MIN; SB.STAT_MAX = STAT_MAX; SB.STAT_BUDGET = STAT_BUDGET;

  SB.STAT_INFO = [
    { id: 'str', name: 'Strength', blurb: 'Raises damage and knockback dealt.' },
    { id: 'dex', name: 'Dexterity', blurb: 'Shortens startup and recovery on every move.' },
    { id: 'def', name: 'Defense', blurb: 'More health, and less knockback taken.' },
    { id: 'spd', name: 'Speed', blurb: 'Faster run, higher jumps, quicker air drift.' }
  ];

  const FIRST = ['Kade', 'Rowan', 'Vex', 'Sable', 'Juno', 'Orin', 'Mira', 'Dax', 'Ash', 'Nyx',
    'Bram', 'Cyra', 'Tovar', 'Wren', 'Grim', 'Lyra', 'Kest', 'Sol', 'Riven', 'Odele'];
  const LAST = ['Vale', 'Hollow', 'Ironsong', 'Thorne', 'Kestrel', 'Marrow', 'Ashford', 'Crowe',
    'Winter', 'Voss', 'Draeger', 'Solace', 'Quill', 'Barrow', 'Storm', 'Wilde'];

  SB.defaultBuild = function (name) {
    const arch = SB.ARCHETYPES[0];
    const kit = SB.kitFor(arch.id, 'swift');
    const moves = Object.create(null);
    SB.SLOT_ORDER.forEach((s) => { moves[s] = kit[s].id; });
    return {
      id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: name || 'New Fighter',
      archId: arch.id, styleId: 'swift',
      stats: { str: 6, dex: 7, def: 6, spd: 7 },
      body: { height: 0.5, build: 0.5, skin: SB.SKIN_TONES[1], hairStyle: 1, hairColor: SB.HAIR_COLORS[1] },
      col: { primary: '#2f6fd0', secondary: '#16224a', accent: '#cfe6ff', glow: '#59a6ff' },
      loadout: SB.emptyLoadout(),
      moves: moves,
      created: Date.now()
    };
  };

  SB.randomBuild = function (seed) {
    const rng = seed === undefined ? Math.random : U.rngFor(seed);
    const arch = SB.ARCHETYPES[Math.floor(rng() * SB.ARCHETYPES.length)];
    const style = SB.STYLES[Math.floor(rng() * SB.STYLES.length)];
    const b = SB.defaultBuild(U.pick(FIRST, rng) + ' ' + U.pick(LAST, rng));
    b.archId = arch.id; b.styleId = style.id;

    /* spend the stat budget randomly but legally */
    const st = { str: STAT_MIN, dex: STAT_MIN, def: STAT_MIN, spd: STAT_MIN };
    const keys = ['str', 'dex', 'def', 'spd'];
    let left = STAT_BUDGET - STAT_MIN * 4;
    while (left > 0) {
      const k = keys[Math.floor(rng() * 4)];
      if (st[k] < STAT_MAX) { st[k]++; left--; }
      else if (keys.every((q) => st[q] >= STAT_MAX)) break;
    }
    b.stats = st;

    b.body = {
      height: rng(), build: rng(),
      skin: SB.SKIN_TONES[Math.floor(rng() * SB.SKIN_TONES.length)],
      hairStyle: Math.floor(rng() * SB.HAIR_STYLES.length),
      hairColor: SB.HAIR_COLORS[Math.floor(rng() * SB.HAIR_COLORS.length)]
    };
    const cw = SB.COLORWAYS[Math.floor(rng() * SB.COLORWAYS.length)];
    b.col = { primary: cw.primary, secondary: cw.secondary, accent: cw.accent, glow: cw.glow };
    b.loadout = SB.randomLoadout(rng, false);

    /* mostly the native kit, with a couple of borrowed moves for flavour */
    const kit = SB.kitFor(arch.id, style.id);
    SB.SLOT_ORDER.forEach((s) => {
      if (rng() < 0.18) {
        const pool = SB.movesForSlot(s);
        b.moves[s] = pool[Math.floor(rng() * pool.length)].id;
      } else b.moves[s] = kit[s].id;
    });
    return b;
  };

  /* Repairs anything missing or out of range (old saves, hand-edited JSON). */
  SB.normalizeBuild = function (b) {
    const d = SB.defaultBuild();
    if (!b || typeof b !== 'object') return d;
    b.id = b.id || d.id;
    b.name = String(b.name || 'Fighter').slice(0, 22);
    if (!SB.archetype(b.archId) || !SB.ARCHETYPES.some((a) => a.id === b.archId)) b.archId = d.archId;
    if (!SB.STYLES.some((s) => s.id === b.styleId)) b.styleId = d.styleId;

    b.stats = b.stats || {};
    ['str', 'dex', 'def', 'spd'].forEach((k) => {
      b.stats[k] = U.clamp(Math.round(b.stats[k] || 6), STAT_MIN, STAT_MAX);
    });
    b.body = Object.assign({}, d.body, b.body || {});
    b.body.height = U.sat(b.body.height);
    b.body.build = U.sat(b.body.build);
    b.body.hairStyle = U.clamp(b.body.hairStyle | 0, 0, SB.HAIR_STYLES.length - 1);
    b.col = Object.assign({}, d.col, b.col || {});

    const lo = SB.emptyLoadout();
    if (b.loadout) for (const k in lo) { if (b.loadout[k] && SB.cos(b.loadout[k]) && SB.cos(b.loadout[k]).slot === k) lo[k] = b.loadout[k]; }
    b.loadout = lo;

    const kit = SB.kitFor(b.archId, b.styleId);
    const mv = Object.create(null);
    SB.SLOT_ORDER.forEach((s) => {
      const cand = b.moves && b.moves[s] ? SB.MOVE(b.moves[s]) : null;
      mv[s] = cand && cand.slot === s ? cand.id : kit[s].id;
    });
    b.moves = mv;
    return b;
  };

  /* Numbers the simulation actually runs on. */
  SB.derive = function (b) {
    const arch = SB.archetype(b.archId);
    const s = b.stats;
    const h = 74 + b.body.height * 26;
    return {
      arch: arch,
      h: h,
      build: 0.84 + b.body.build * 0.36,
      maxHP: Math.round(108 + s.def * 6.4),
      weight: arch.weight * (0.90 + s.def * 0.028) * (0.92 + b.body.build * 0.16),
      runSpeed: (4.9 + s.spd * 0.30) * (0.94 + arch.spd * 0.06),
      walkSpeed: 2.5 + s.spd * 0.13,
      jumpV: -(13.6 + s.spd * 0.26),
      djumpV: -(12.4 + s.spd * 0.24),
      airAccel: 0.44 + s.spd * 0.030,
      airMax: 5.0 + s.spd * 0.20,
      dmgMul: 0.84 + s.str * 0.044,
      kbMul: 0.86 + s.str * 0.040,
      atkSpeed: 0.86 + s.dex * 0.032,
      kbTaken: 1.26 - s.def * 0.038,
      shieldMax: 52 + s.def * 4.2,
      dodgeFrames: Math.round(24 - s.dex * 0.6)
    };
  };

  /* Raw strength score. Calibrated below so a stock build reads ~50. */
  function rawPower(b) {
    const d = SB.derive(b);
    const s = b.stats;
    let kit = 0, n = 0;
    SB.SLOT_ORDER.forEach((slot) => {
      const m = SB.MOVE(b.moves[slot]);
      if (!m) return;
      const dps = m.dmg * m.hits / Math.max(6, m.total);
      const kbv = (m.bkb * 0.55 + m.kbs * m.dmg * 3) / 34;
      const rng = SB.moveRange(m) / 1.4;
      kit += dps * 20 + kbv * 15 + rng * 7 + (m.proj ? 3 : 0);
      n++;
    });
    kit = n ? kit / n : 0;
    const statScore = (s.str + s.dex + s.def + s.spd - STAT_MIN * 4) / (STAT_MAX * 4 - STAT_MIN * 4);
    const mobility = (d.runSpeed / 8.2 + (-d.jumpV) / 16.5) / 2;
    return kit * 1.15 * d.dmgMul * d.atkSpeed + statScore * 34 + mobility * 16 + d.maxHP * 0.045 + (1.3 - d.kbTaken) * 22;
  }

  let REF = 0;
  function reference() {
    if (!REF) REF = rawPower(SB.defaultBuild('ref'));
    return REF;
  }

  /* 0..100 power rating; 50 is the stock starter build. Shown live in the Forge. */
  SB.powerRating = function (b) {
    return U.clamp(Math.round(50 * rawPower(b) / reference()), 1, 100);
  };

  SB.statTotal = (b) => b.stats.str + b.stats.dex + b.stats.def + b.stats.spd;
  SB.statsLegal = (b) => SB.statTotal(b) <= STAT_BUDGET;

  /* Move-set flavour tags shown on the roster card. */
  SB.buildTags = function (b) {
    const d = SB.derive(b);
    const t = [];
    if (d.runSpeed > 7.1) t.push('Fast');
    if (d.runSpeed < 6.0) t.push('Deliberate');
    if (b.stats.str >= 8) t.push('Heavy Hitter');
    if (b.stats.def >= 8) t.push('Tanky');
    if (b.stats.dex >= 8) t.push('Frame Advantage');
    let proj = 0, sig = 0;
    SB.SLOT_ORDER.forEach((s) => { const m = SB.MOVE(b.moves[s]); if (m && m.proj) proj++; });
    if (proj >= 3) t.push('Zoner');
    const archs = {};
    SB.SLOT_ORDER.forEach((s) => { const m = SB.MOVE(b.moves[s]); if (m) archs[m.arch] = 1; });
    const mix = Object.keys(archs).length;
    if (mix >= 4) t.push('Freestyle');
    else if (mix === 1) t.push('Pure ' + SB.archetype(b.archId).kind);
    return t;
  };

  /* ---------------- roster persistence ---------------- */
  const KEY = 'smashforge.roster.v1';
  SB.loadRoster = function () {
    let list = [];
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) list = JSON.parse(raw);
    } catch (e) { list = []; }
    if (!Array.isArray(list) || !list.length) {
      list = [];
      for (let i = 0; i < 4; i++) list.push(SB.randomBuild('starter' + i));
      list[0].name = 'Riftblade Cadet';
      list[0].archId = 'blade'; list[0].styleId = 'swift';
      const kit = SB.kitFor('blade', 'swift');
      SB.SLOT_ORDER.forEach((s) => { list[0].moves[s] = kit[s].id; });
    }
    return list.map(SB.normalizeBuild);
  };
  SB.saveRoster = function (list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  };

  const OKEY = 'smashforge.opts.v1';
  SB.loadOpts = function () {
    const d = { sfx: 0.7, mus: 0.3, shake: 1, stocks: 3, time: 180, hitboxes: false, particles: 1 };
    try { const raw = localStorage.getItem(OKEY); if (raw) return Object.assign(d, JSON.parse(raw)); } catch (e) { }
    return d;
  };
  SB.saveOpts = function (o) { try { localStorage.setItem(OKEY, JSON.stringify(o)); } catch (e) { } };
})(window.SB);
