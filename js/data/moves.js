/* SMASHFORGE — move generator.
   15 archetypes x 13 slots x 3 styles = 585 distinct moves, each with its own
   frame data, knockback profile, hitbox layout, animation and VFX colour.
   Every move here is selectable in the character designer. */
(function (SB) {
  'use strict';
  const U = SB.U;
  const SLOT_BASE = SB.SLOT_BASE, SLOT_ORDER = SB.SLOT_ORDER, STYLES = SB.STYLES;

  const PREFIX = {
    swift:  ['Swift', 'Tempest', 'Flicker', 'Gale', 'Quick', 'Hollow', 'Feather', 'Sable'],
    titan:  ['Iron', 'Grand', 'Titan', 'Ruinous', 'Bastion', 'Heavy', 'Elder', 'Adamant'],
    arcane: ['Astral', 'Rune', 'Void', 'Ether', 'Starlit', 'Umbral', 'Prism', 'Aurora']
  };

  const SLOT_NAME = {
    nlight:  (p, n, v) => p + ' ' + v,
    slight:  (p, n, v) => p + ' ' + n + ' ' + v,
    dlight:  (p, n, v) => 'Low ' + n + ' ' + v,
    dash:    (p, n, v) => p + ' ' + n + ' Rush',
    nair:    (p, n, v) => 'Aerial ' + p + ' ' + v,
    sair:    (p, n, v) => p + ' Sky ' + v,
    dair:    (p, n, v) => 'Falling ' + n + ' ' + v,
    recov:   (p, n, v) => p + ' ' + n + ' Ascent',
    gp:      (p, n, v) => n + ' Descent',
    nsig:    (p, n, v) => p + ' ' + n + ' Rising',
    ssig:    (p, n, v) => p + ' ' + n + ' ' + v + 'er',
    dsig:    (p, n, v) => n + ' Quake',
    special: (p, n, v) => p + ' '
  };

  /* -------- hitbox layouts, in body units (1.0 = fighter height).
     x is forward, y is negative-up from the feet. t is 0..1 across
     the active window so sweeping arcs actually sweep.            -------- */
  const arc = (t, a0, a1, rad, cx, cy, r) => {
    const a = U.lerp(a0, a1, t);
    return [{ x: cx + Math.cos(a) * rad, y: cy - Math.sin(a) * rad, r: r }];
  };

  const LAYOUT = {
    jab:        (t, R) => [{ x: R * 0.90, y: -0.62, r: 0.20 }],
    punch:      (t, R) => [{ x: R * 0.92, y: -0.63, r: 0.19 }],
    flurry:     (t, R) => [{ x: R * (0.75 + 0.25 * t), y: -0.60 - 0.05 * Math.sin(t * 12), r: 0.17 }],
    thrust:     (t, R) => [{ x: R * (0.55 + 0.55 * U.easeOut(t)), y: -0.62, r: 0.18 },
                           { x: R * (0.30 + 0.35 * U.easeOut(t)), y: -0.62, r: 0.15 }],
    slashH:     (t, R) => arc(t, 1.15, -0.35, R * 0.86, R * 0.10, -0.66, 0.23),
    slashD:     (t, R) => arc(t, 1.55, -0.55, R * 0.90, R * 0.14, -0.62, 0.24),
    bigslash:   (t, R) => arc(t, 1.75, -0.60, R * 1.00, R * 0.16, -0.64, 0.30),
    sweep:      (t, R) => arc(t, 0.30, -0.62, R * 0.88, R * 0.06, -0.44, 0.24),
    lowKick:    (t, R) => [{ x: R * (0.55 + 0.4 * t), y: -0.22, r: 0.19 }],
    kick:       (t, R) => [{ x: R * (0.6 + 0.4 * t), y: -0.55, r: 0.21 }],
    stomp:      (t, R) => [{ x: R * 0.25, y: -0.10 + 0.1 * t, r: 0.22 }],
    slam:       (t, R) => arc(t, 1.85, 0.10, R * 0.92, R * 0.12, -0.60, 0.27),
    uppercut:   (t, R) => arc(t, -0.30, 1.75, R * 0.86, R * 0.10, -0.58, 0.26),
    uppercutFist:(t, R) => arc(t, -0.10, 1.70, R * 0.72, R * 0.08, -0.56, 0.23),
    thrustUp:   (t, R) => [{ x: R * 0.36, y: -0.72 - R * 0.60 * U.easeOut(t), r: 0.20 }],
    spin:       (t, R) => { const a = t * Math.PI * 2 - 0.4; return [
                             { x: Math.cos(a) * R * 0.82, y: -0.62 - Math.sin(a) * R * 0.55, r: 0.24 },
                             { x: Math.cos(a + Math.PI) * R * 0.82, y: -0.62 - Math.sin(a + Math.PI) * R * 0.55, r: 0.21 }]; },
    aerialSpin: (t, R) => { const a = t * Math.PI * 2; return [
                             { x: Math.cos(a) * R * 0.70, y: -0.60 - Math.sin(a) * R * 0.50, r: 0.23 },
                             { x: Math.cos(a + 2.09) * R * 0.70, y: -0.60 - Math.sin(a + 2.09) * R * 0.50, r: 0.20 }]; },
    lunge:      (t, R) => [{ x: R * (0.45 + 0.45 * t), y: -0.58, r: 0.26 }],
    charge:     (t, R) => [{ x: R * (0.60 + 0.50 * t), y: -0.60, r: 0.25 }, { x: R * 0.30, y: -0.58, r: 0.20 }],
    drill:      (t, R) => [{ x: R * 0.24, y: -0.22 + R * 0.30 * t, r: 0.22 }],
    quake:      (t, R) => [{ x: R * (0.55 + 0.9 * U.easeOut(t)), y: -0.22, r: 0.30 },
                           { x: R * (0.25 + 0.4 * U.easeOut(t)), y: -0.26, r: 0.24 }],
    groundpound:(t, R) => [{ x: 0, y: 0.10, r: R * 0.55 }],
    rise:       (t, R) => [{ x: R * 0.18, y: -0.70 - R * 0.55 * t, r: 0.26 }],
    aoe:        (t, R) => [{ x: R * 0.30, y: -0.60, r: R * (0.35 + 0.35 * U.easeOut(t)) }],
    cast:       (t, R) => [{ x: R * 0.78, y: -0.64, r: 0.22 }],
    shootF:     (t, R) => [{ x: R * 0.62, y: -0.62, r: 0.16 }],
    shootU:     (t, R) => [{ x: R * 0.24, y: -0.92, r: 0.18 }],
    shootD:     (t, R) => [{ x: R * 0.20, y: -0.18, r: 0.18 }],
    shootArc:   (t, R) => [{ x: R * 0.55, y: -0.72, r: 0.18 }],
    throwArc:   (t, R) => [{ x: R * 0.72, y: -0.64, r: 0.20 }],
    thrustDash: (t, R) => [{ x: R * (0.40 + 0.70 * t), y: -0.62, r: 0.22 }],
    shockwave:  (t, R) => [{ x: R * (0.4 + 1.5 * U.easeOut(t)), y: -0.24, r: 0.28 }],
    grab:       (t, R) => [{ x: R * 0.62, y: -0.60, r: 0.22 }],
    guard:      () => []
  };
  SB.LAYOUT = LAYOUT;

  /* Which swings hit behind the fighter as well as in front. */
  const TWO_SIDED = { spin: true, aerialSpin: true, aoe: true, groundpound: true, quake: true };

  /* Human-readable animation family for the pose system. */
  SB.swingStance = function (swing) {
    if (swing === 'groundpound' || swing === 'stomp' || swing === 'drill') return 'down';
    if (swing === 'rise' || swing === 'thrustUp' || swing === 'shootU' || swing === 'uppercut' || swing === 'uppercutFist') return 'up';
    return 'fwd';
  };

  const MOVES = [];
  const BY_ID = Object.create(null);
  const KITS = Object.create(null);
  const USED = Object.create(null);
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  function tag(mv) {
    const t = [];
    if (mv.sig) t.push('Signature');
    if (mv.proj) t.push('Projectile');
    if (mv.hits > 1) t.push(mv.hits + '-Hit');
    if (mv.ang > 180 && mv.ang < 340) t.push('Spike');
    if (mv.ang >= 60 && mv.ang <= 120) t.push('Launcher');
    if (mv.back) t.push('Hits Behind');
    if (mv.kind === 'counter') t.push('Counter');
    if (mv.kind === 'grab') t.push('Grab');
    if (mv.kind === 'buff') t.push('Support');
    if (mv.mv >= 5) t.push('Mobile');
    if (mv.startup <= 5) t.push('Fast');
    if (mv.dmg >= 20) t.push('Heavy');
    return t;
  }

  function build() {
    SB.ARCHETYPES.forEach((ar) => {
      KITS[ar.id] = Object.create(null);
      STYLES.forEach((st) => {
        const kit = Object.create(null);
        SLOT_ORDER.forEach((slot) => {
          const base = SLOT_BASE[slot];
          const tw = (ar.tweaks && ar.tweaks[slot]) || {};
          const swing = (ar.swings && ar.swings[slot]) || base.swing;
          const rng = U.rngFor(ar.id + '|' + st.id + '|' + slot);

          const spd = ar.spd * st.spd;
          let startup = Math.max(3, Math.round((base.startup + (tw.startup || 0)) / spd));
          let recovery = Math.max(4, Math.round((base.recovery + (tw.recovery || 0)) / spd));
          let active = Math.max(2, Math.round(base.active + (tw.active || 0)));

          let dmg = (base.dmg + (tw.dmg || 0)) * ar.pow * st.pow;
          let bkb = (base.bkb + (tw.bkb || 0)) * ar.kb * st.kb;
          let kbs = base.kbs * ar.kb * st.kb;
          let reach = (base.reach + (tw.reach || 0)) * ar.reach * (1 + st.reach);
          let ang = base.ang + (tw.ang !== undefined ? tw.ang - base.ang : 0);
          if (tw.ang !== undefined) ang = tw.ang;

          /* multi-hit: swift style adds a tick to anything already multi-hit */
          let hits = tw.hits || (swing === 'flurry' ? 3 : 1);
          if (hits > 1) hits += st.hits;
          if (hits > 1) { dmg = dmg / (hits * 0.62); bkb *= 0.72; active = Math.max(active, hits * 3); }

          /* projectiles: tweak-defined, or granted by the Arcane style on the special */
          let projKey = tw.proj || null;
          if (!projKey && st.id === 'arcane' && slot === 'special' && ar.specialKind !== 'counter' && ar.specialKind !== 'grab') projKey = 'energy';
          if (!projKey && slot === 'special' && ar.specialKind === 'projectile') {
            projKey = ar.id === 'spear' ? 'javelin' : ar.id === 'scythe' ? 'reap' : ar.id === 'chakram' ? 'disc'
              : ar.id === 'bow' ? 'bigarrow' : ar.id === 'cannon' ? 'bigshell' : ar.id === 'orb' ? 'lance' : 'beam';
          }
          const proj = projKey ? Object.assign({ key: projKey }, SB.PROJECTILES[projKey]) : null;

          /* the weapon special carries the archetype's identity mechanic */
          let kind = 'strike';
          if (slot === 'special') {
            kind = ar.specialKind;
            if (st.id === 'arcane' && (kind === 'projectile' || kind === 'dash' || kind === 'trap')) kind = 'projectile';
          }
          if (kind === 'counter') { dmg *= 1.45; bkb *= 1.35; active = 14; }
          if (kind === 'grab') { dmg *= 0.55; bkb *= 0.45; }
          if (kind === 'buff') { dmg = 0; bkb = 0; active = 4; }

          const mv = {
            id: ar.id + '_' + st.id + '_' + slot,
            slot: slot, slotName: base.name,
            arch: ar.id, archName: ar.name, archKind: ar.kind, shape: ar.shape,
            style: st.id, styleName: st.name,
            kind: kind,
            startup: startup, active: active, recovery: recovery,
            total: startup + active + recovery,
            dmg: Math.round(dmg * 10) / 10,
            bkb: Math.round(bkb * 10) / 10,
            kbs: Math.round(kbs * 1000) / 1000,
            ang: ang,
            reach: Math.round(reach * 1000) / 1000,
            swing: swing,
            stance: SB.swingStance(swing),
            hits: hits,
            rehit: hits > 1 ? Math.max(2, Math.floor(active / hits)) : 0,
            mv: (tw.mv !== undefined ? tw.mv : base.mv) * (0.85 + st.spd * 0.15),
            adv: base.adv + (st.id === 'swift' ? 1 : 0),
            air: !!base.air, sig: !!base.sig, spc: !!base.spc,
            back: !!tw.back || !!TWO_SIDED[swing],
            proj: proj,
            armor: st.id === 'titan' && base.sig ? true : false,
            hitstop: 0, fx: null, name: '', desc: '', tags: null
          };

          mv.hitstop = Math.round(U.clamp(3 + mv.dmg * 0.42, 3, 16));
          const hue = st.hue + (rng() * 14 - 7);
          mv.fx = {
            col: U.rotateHue(ar.col, hue, st.id === 'arcane' ? 1.05 : 1, st.id === 'titan' ? -4 : 3),
            col2: U.rotateHue(ar.col2, hue, 0.9, 4),
            size: 0.8 + mv.dmg * 0.035 + (mv.sig ? 0.35 : 0)
          };

          /* names must be unique — the designer lists all 585 side by side */
          let name = '';
          for (let attempt = 0; attempt < 24 && !name; attempt++) {
            const pre = PREFIX[st.id][(Math.floor(rng() * 97) + attempt) % PREFIX[st.id].length];
            const noun = ar.words.n[(Math.floor(rng() * 97) + attempt) % ar.words.n.length];
            const verb = ar.words.v[(Math.floor(rng() * 97) + attempt) % ar.words.v.length];
            const cand = (slot === 'special' ? pre + ' ' + ar.specialName
              : SLOT_NAME[slot](pre, noun, verb)).replace(/\s+/g, ' ').trim();
            if (!USED[cand]) name = cand;
          }
          if (!name) {
            const pre = U.pick(PREFIX[st.id], rng);
            name = (pre + ' ' + ar.kind + ' ' + SLOT_BASE[slot].name).replace(/\s+/g, ' ').trim();
            let k = 2;
            while (USED[name]) { name = name.replace(/ [IVX]+$/, '') + ' ' + ROMAN[k % ROMAN.length]; k++; }
          }
          USED[name] = 1;
          mv.name = name;

          mv.tags = tag(mv);
          mv.desc = describe(mv);

          kit[slot] = mv;
          MOVES.push(mv);
          BY_ID[mv.id] = mv;
        });
        KITS[ar.id][st.id] = kit;
      });
    });
  }

  function describe(mv) {
    const s = [];
    if (mv.kind === 'counter') s.push('Braces for ' + mv.active + ' frames and answers any hit with a devastating riposte.');
    else if (mv.kind === 'grab') s.push('Snatches the opponent and slams them, low damage but a guaranteed reset.');
    else if (mv.kind === 'buff') s.push('Raises a ward that absorbs the next hit and refunds a dodge.');
    else if (mv.kind === 'dash') s.push('Closes distance instantly, striking through anything in the path.');
    else if (mv.proj) s.push('Fires a ' + mv.proj.kind + ' round that travels ' + (mv.proj.pierce ? 'through targets' : 'until it connects') + '.');
    else s.push('A ' + (mv.startup <= 6 ? 'snappy' : mv.startup <= 12 ? 'measured' : 'heavily telegraphed') + ' ' + mv.swing.replace(/([A-Z])/g, ' $1').toLowerCase() + '.');
    if (mv.hits > 1) s.push('Connects ' + mv.hits + ' times.');
    if (mv.ang > 180 && mv.ang < 340) s.push('Spikes airborne targets straight down.');
    else if (mv.ang >= 60) s.push('Launches upward for follow-ups.');
    if (mv.armor) s.push('Super-armour through startup.');
    return s.join(' ');
  }

  build();

  SB.MOVES = MOVES;
  SB.MOVE = (id) => BY_ID[id];
  SB.KITS = KITS;
  SB.kitFor = (archId, styleId) => (KITS[archId] && KITS[archId][styleId]) || KITS.blade.swift;
  SB.movesForSlot = (slot) => MOVES.filter((m) => m.slot === slot);

  /* Hitbox circles for a move at normalised active-window time t (0..1).
     Returned in body units; combat.js maps them into world space. */
  SB.moveHitboxes = function (mv, t) {
    const fn = LAYOUT[mv.swing] || LAYOUT.jab;
    const boxes = fn(U.sat(t), mv.reach);
    if (!mv.back) return boxes;
    const out = boxes.slice();
    for (let i = 0; i < boxes.length; i++) out.push({ x: -boxes[i].x, y: boxes[i].y, r: boxes[i].r * 0.9 });
    return out;
  };

  /* Farthest reach of a move — used by the AI for spacing decisions. */
  SB.moveRange = function (mv) {
    let best = 0;
    for (let i = 0; i <= 8; i++) {
      const bs = SB.moveHitboxes(mv, i / 8);
      for (const b of bs) best = Math.max(best, Math.abs(b.x) + b.r);
    }
    if (mv.proj) best += 6;
    return best + mv.mv * 0.012;
  };
})(window.SB);
