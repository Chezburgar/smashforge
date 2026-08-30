/* SMASHFORGE — 15 weapon archetypes. Each defines reach, weight, swing flavour
   and per-slot tweaks; combined with 3 fighting styles this generates the kits. */
(function (SB) {
  'use strict';

  /* ---------------- baseline frame data, 60fps ----------------
     Tuned so lights combo into lights, aerials are safer than
     signatures, and signatures are the commit-heavy KO tools.    */
  const SLOT_BASE = {
    nlight:  { name: 'Neutral Light',   startup: 6,  active: 3,  recovery: 10, dmg: 6.5, bkb: 20, kbs: 0.26, ang: 42,  swing: 'jab',        reach: 0.52, adv: 1.6, mv: 1.4,  air: false },
    slight:  { name: 'Side Light',      startup: 8,  active: 4,  recovery: 13, dmg: 8.5, bkb: 25, kbs: 0.38, ang: 28,  swing: 'slashH',     reach: 0.76, adv: 1.2, mv: 2.6,  air: false },
    dlight:  { name: 'Down Light',      startup: 7,  active: 4,  recovery: 13, dmg: 8.0, bkb: 23, kbs: 0.34, ang: 66,  swing: 'sweep',      reach: 0.70, adv: 1.5, mv: 1.8,  air: false },
    dash:    { name: 'Dash Attack',     startup: 9,  active: 5,  recovery: 16, dmg: 9.5, bkb: 27, kbs: 0.40, ang: 46,  swing: 'lunge',      reach: 0.80, adv: 0.7, mv: 5.4,  air: false },
    nair:    { name: 'Neutral Air',     startup: 6,  active: 6,  recovery: 11, dmg: 7.5, bkb: 23, kbs: 0.32, ang: 56,  swing: 'aerialSpin', reach: 0.62, adv: 1.3, mv: 0.6,  air: true },
    sair:    { name: 'Side Air',        startup: 8,  active: 5,  recovery: 14, dmg: 9.5, bkb: 29, kbs: 0.44, ang: 34,  swing: 'slashH',     reach: 0.82, adv: 0.9, mv: 1.8,  air: true },
    dair:    { name: 'Down Air',        startup: 10, active: 5,  recovery: 17, dmg: 10.5,bkb: 25, kbs: 0.40, ang: 272, swing: 'slam',       reach: 0.66, adv: 0.6, mv: 1.0,  air: true },
    recov:   { name: 'Recovery',        startup: 7,  active: 8,  recovery: 20, dmg: 7.5, bkb: 28, kbs: 0.24, ang: 84,  swing: 'rise',       reach: 0.60, adv: 0.4, mv: 2.2,  air: true },
    gp:      { name: 'Ground Pound',    startup: 8,  active: 12, recovery: 19, dmg: 11.5,bkb: 32, kbs: 0.28, ang: 82,  swing: 'groundpound',reach: 0.78, adv: 0.5, mv: 0.0,  air: true },
    nsig:    { name: 'Neutral Signature', startup: 21, active: 5, recovery: 25, dmg: 17,  bkb: 50, kbs: 0.60, ang: 52,  swing: 'uppercut',   reach: 0.95, adv: 0.0, mv: 1.6,  air: false, sig: true },
    ssig:    { name: 'Side Signature',  startup: 23, active: 6,  recovery: 27, dmg: 19,  bkb: 56, kbs: 0.64, ang: 30,  swing: 'bigslash',   reach: 1.15, adv: 0.0, mv: 4.0,  air: false, sig: true },
    dsig:    { name: 'Down Signature',  startup: 25, active: 6,  recovery: 29, dmg: 18,  bkb: 52, kbs: 0.58, ang: 70,  swing: 'quake',      reach: 1.05, adv: 0.0, mv: 1.2,  air: false, sig: true },
    special: { name: 'Weapon Special',  startup: 12, active: 6,  recovery: 19, dmg: 8.5, bkb: 24, kbs: 0.28, ang: 40,  swing: 'cast',       reach: 0.90, adv: 0.8, mv: 1.0,  air: false, spc: true }
  };
  const SLOT_ORDER = ['nlight', 'slight', 'dlight', 'dash', 'nair', 'sair', 'dair', 'recov', 'gp', 'nsig', 'ssig', 'dsig', 'special'];
  SB.SLOT_BASE = SLOT_BASE;
  SB.SLOT_ORDER = SLOT_ORDER;

  /* ---------------- 3 fighting styles ----------------
     Multipliers applied on top of archetype numbers.    */
  const STYLES = [
    {
      id: 'swift', name: 'Swift', blurb: 'Fewer commitments, faster frames, built to chain hits into hits.',
      spd: 1.20, pow: 0.84, kb: 0.88, reach: -0.04, hits: 1, amp: 0.90, hue: -22,
      trait: 'Light attacks link 1 frame sooner and multi-hit moves gain an extra tick.'
    },
    {
      id: 'titan', name: 'Titan', blurb: 'Slow, enormous, and lethal — signatures shrug off a hit while charging.',
      spd: 0.84, pow: 1.26, kb: 1.20, reach: 0.06, hits: 0, amp: 1.16, hue: 14,
      trait: 'Signatures carry super-armour during startup and deal +25% knockback.'
    },
    {
      id: 'arcane', name: 'Arcane', blurb: 'Extended reach and channelled energy — the special becomes a true projectile.',
      spd: 1.02, pow: 1.00, kb: 1.02, reach: 0.20, hits: 0, amp: 1.02, hue: 152,
      trait: 'All hitboxes extend 20% further and the weapon special fires an energy round.'
    }
  ];
  SB.STYLES = STYLES;

  /* ---------------- archetypes ---------------- */
  function A(o) { return o; }

  const ARCHETYPES = [
    A({
      id: 'blade', name: 'Riftblade', kind: 'Katana', shape: 'katana',
      blurb: 'The honest weapon. Quick draw-cuts, clean arcs, no bad matchups and no free wins.',
      weight: 1.00, reach: 1.00, spd: 1.06, pow: 0.98, kb: 0.98,
      col: '#4fc3f7', col2: '#e8f6ff', trailW: 1.0,
      specialKind: 'dash', specialName: 'Iai Step',
      words: { n: ['Crescent', 'Falling Leaf', 'Rift', 'Mirror', 'Silk', 'Dawn'], v: ['Cut', 'Draw', 'Slash', 'Sever', 'Arc'] },
      swings: { nsig: 'uppercut', ssig: 'bigslash', dsig: 'sweep', special: 'thrustDash' },
      tweaks: { slight: { recovery: -1 }, sair: { dmg: 0.5 }, nsig: { ang: 62 } }
    }),
    A({
      id: 'greatsword', name: 'Warcleaver', kind: 'Greatsword', shape: 'greatsword',
      blurb: 'A slab of iron on a long handle. Every swing is a threat and every whiff is a punish.',
      weight: 1.20, reach: 1.22, spd: 0.80, pow: 1.28, kb: 1.20,
      col: '#c9a227', col2: '#fff3c4', trailW: 1.6,
      specialKind: 'counter', specialName: 'Ironwall',
      words: { n: ['Iron', 'Sunder', 'Bulwark', 'Ruin', 'Colossus', 'Hearth'], v: ['Cleave', 'Crash', 'Fell', 'Break', 'Rend'] },
      swings: { nlight: 'slashD', slight: 'bigslash', dsig: 'quake', nair: 'slashD', special: 'guard' },
      tweaks: { ssig: { reach: 0.2, dmg: 2 }, dair: { dmg: 2 } }
    }),
    A({
      id: 'gauntlets', name: 'Stormfist', kind: 'Gauntlets', shape: 'gauntlet',
      blurb: 'No blade, no reach, no mercy. Rushdown that lives inside the opponent’s hurtbox.',
      weight: 0.92, reach: 0.72, spd: 1.30, pow: 0.78, kb: 0.86,
      col: '#ff7043', col2: '#ffe0b2', trailW: 0.7,
      specialKind: 'grab', specialName: 'Collar Snap',
      words: { n: ['Tiger', 'Thunder', 'Piston', 'Hail', 'Ember', 'Drum'], v: ['Fist', 'Rush', 'Barrage', 'Strike', 'Blow'] },
      swings: { nlight: 'punch', slight: 'punch', dlight: 'lowKick', dash: 'lunge', nair: 'kick', sair: 'punch', dair: 'stomp', nsig: 'uppercutFist', ssig: 'punch', dsig: 'quake', special: 'grab' },
      tweaks: { nlight: { startup: -1, recovery: -2, hits: 2 }, nsig: { ang: 76 } }
    }),
    A({
      id: 'spear', name: 'Lancer', kind: 'Spear', shape: 'spear',
      blurb: 'Wins the neutral from two body-lengths away. Loses it the moment you get inside.',
      weight: 0.98, reach: 1.34, spd: 1.00, pow: 0.96, kb: 0.96,
      col: '#66bb6a', col2: '#dcedc8', trailW: 0.8,
      specialKind: 'projectile', specialName: 'Javelin Toss',
      words: { n: ['Viper', 'Pike', 'Thorn', 'Reach', 'Wyrm', 'Gale'], v: ['Thrust', 'Pierce', 'Skewer', 'Lance', 'Jab'] },
      swings: { nlight: 'thrust', slight: 'thrust', dlight: 'sweep', dash: 'thrust', nair: 'thrust', sair: 'thrust', nsig: 'thrustUp', ssig: 'thrust', special: 'throwArc' },
      tweaks: { slight: { reach: 0.18 }, ssig: { reach: 0.25, mv: 5.5 } }
    }),
    A({
      id: 'hammer', name: 'Skullbreaker', kind: 'Warhammer', shape: 'hammer',
      blurb: 'Physics as a weapon. Slow enough to read, heavy enough that reading it barely helps.',
      weight: 1.26, reach: 1.06, spd: 0.76, pow: 1.34, kb: 1.32,
      col: '#8d6e63', col2: '#ffccbc', trailW: 1.8,
      specialKind: 'trap', specialName: 'Fault Line',
      words: { n: ['Anvil', 'Quake', 'Meteor', 'Grave', 'Bell', 'Bastion'], v: ['Smash', 'Slam', 'Crush', 'Drop', 'Pound'] },
      swings: { nlight: 'slam', slight: 'slam', dlight: 'sweep', dash: 'slam', nair: 'aerialSpin', sair: 'slam', dair: 'slam', nsig: 'uppercut', ssig: 'slam', dsig: 'quake', special: 'shockwave' },
      tweaks: { dsig: { dmg: 3, reach: 0.2 }, gp: { dmg: 2.5 } }
    }),
    A({
      id: 'cannon', name: 'Bombardier', kind: 'Cannon', shape: 'cannon',
      blurb: 'Half siege engine, half club. Explosions cover the approach you were never going to win.',
      weight: 1.14, reach: 1.02, spd: 0.86, pow: 1.16, kb: 1.14,
      col: '#ef5350', col2: '#ffcdd2', trailW: 1.3,
      specialKind: 'projectile', specialName: 'Mortar Shell',
      words: { n: ['Powder', 'Siege', 'Fuse', 'Blast', 'Cinder', 'Broadside'], v: ['Blast', 'Boom', 'Shell', 'Burst', 'Volley'] },
      swings: { nlight: 'slam', slight: 'shootF', dlight: 'sweep', dash: 'lunge', nair: 'aerialSpin', sair: 'shootF', dair: 'shootD', nsig: 'shootU', ssig: 'shootF', dsig: 'quake', special: 'shootArc' },
      tweaks: { slight: { proj: 'shell' }, sair: { proj: 'shell' }, ssig: { proj: 'bigshell', dmg: 2 } }
    }),
    A({
      id: 'scythe', name: 'Reaper', kind: 'Scythe', shape: 'scythe',
      blurb: 'Sweeping arcs that hit behind you. Rewards spacing you did not plan on purpose.',
      weight: 1.00, reach: 1.16, spd: 0.96, pow: 1.06, kb: 1.04,
      col: '#ab47bc', col2: '#e1bee7', trailW: 1.4,
      specialKind: 'projectile', specialName: 'Soul Reap',
      words: { n: ['Harvest', 'Hollow', 'Vigil', 'Shade', 'Requiem', 'Crescent'], v: ['Reap', 'Sweep', 'Carve', 'Draw', 'Cull'] },
      swings: { nlight: 'sweep', slight: 'spin', dlight: 'sweep', dash: 'spin', nair: 'spin', sair: 'sweep', dair: 'slam', nsig: 'spin', ssig: 'bigslash', dsig: 'sweep', special: 'cast' },
      tweaks: { slight: { back: true }, nair: { back: true }, nsig: { back: true, hits: 3 } }
    }),
    A({
      id: 'orb', name: 'Voidcaller', kind: 'Astral Orb', shape: 'orb',
      blurb: 'Floating shards do the hitting. Fragile up close, oppressive at any other range.',
      weight: 0.86, reach: 1.10, spd: 1.04, pow: 0.94, kb: 0.94,
      col: '#7e57c2', col2: '#d1c4e9', trailW: 1.1,
      specialKind: 'projectile', specialName: 'Null Sphere',
      words: { n: ['Void', 'Astral', 'Nova', 'Eclipse', 'Sigil', 'Prism'], v: ['Pulse', 'Bloom', 'Fracture', 'Cast', 'Wave'] },
      swings: { nlight: 'cast', slight: 'cast', dlight: 'aoe', dash: 'cast', nair: 'aoe', sair: 'cast', dair: 'shootD', nsig: 'aoe', ssig: 'cast', dsig: 'aoe', special: 'cast' },
      tweaks: { slight: { proj: 'bolt' }, sair: { proj: 'bolt' }, ssig: { proj: 'lance', dmg: 1 }, dsig: { hits: 3 } }
    }),
    A({
      id: 'chakram', name: 'Spinner', kind: 'Chakrams', shape: 'chakram',
      blurb: 'Discs that leave and come back. Controls space in two directions at once.',
      weight: 0.90, reach: 1.08, spd: 1.14, pow: 0.86, kb: 0.90,
      col: '#26c6da', col2: '#b2ebf2', trailW: 0.9,
      specialKind: 'projectile', specialName: 'Return Arc',
      words: { n: ['Orbit', 'Halo', 'Cyclone', 'Ring', 'Tide', 'Mirage'], v: ['Spin', 'Loop', 'Whirl', 'Sling', 'Cut'] },
      swings: { nlight: 'slashH', slight: 'throwArc', dlight: 'sweep', dash: 'spin', nair: 'spin', sair: 'throwArc', dair: 'spin', nsig: 'spin', ssig: 'throwArc', dsig: 'aoe', special: 'throwArc' },
      tweaks: { slight: { proj: 'disc' }, sair: { proj: 'disc' }, ssig: { proj: 'bigdisc' }, nair: { hits: 3 } }
    }),
    A({
      id: 'bow', name: 'Longshot', kind: 'Warbow', shape: 'bow',
      blurb: 'Terrifying at range, awkward in a corner. Every melee button is a panic button.',
      weight: 0.84, reach: 0.96, spd: 1.08, pow: 0.86, kb: 0.88,
      col: '#9ccc65', col2: '#f0f4c3', trailW: 0.7,
      specialKind: 'projectile', specialName: 'Piercing Shot',
      words: { n: ['Hawk', 'Sky', 'Splitwood', 'Quill', 'Longshot', 'Feather'], v: ['Loose', 'Shot', 'Volley', 'Pierce', 'Nock'] },
      swings: { nlight: 'kick', slight: 'shootF', dlight: 'sweep', dash: 'lunge', nair: 'kick', sair: 'shootF', dair: 'shootD', nsig: 'shootU', ssig: 'shootF', dsig: 'sweep', special: 'shootF' },
      tweaks: { slight: { proj: 'arrow' }, sair: { proj: 'arrow' }, ssig: { proj: 'bigarrow' }, nsig: { proj: 'arrowUp' }, dair: { proj: 'arrowDown' } }
    }),
    A({
      id: 'katars', name: 'Duelist', kind: 'Katars', shape: 'katars',
      blurb: 'The fastest hands in the roster. Damage arrives in instalments, but it never stops.',
      weight: 0.88, reach: 0.78, spd: 1.36, pow: 0.74, kb: 0.82,
      col: '#ec407a', col2: '#f8bbd0', trailW: 0.6,
      specialKind: 'dash', specialName: 'Phantom Step',
      words: { n: ['Whisper', 'Twin', 'Needle', 'Flicker', 'Crimson', 'Hush'], v: ['Stab', 'Flurry', 'Rip', 'Dart', 'Slice'] },
      swings: { nlight: 'thrust', slight: 'flurry', dlight: 'lowKick', dash: 'thrust', nair: 'flurry', sair: 'thrust', dair: 'stomp', nsig: 'uppercutFist', ssig: 'flurry', dsig: 'sweep', special: 'thrustDash' },
      tweaks: { nlight: { hits: 2 }, slight: { hits: 3 }, nair: { hits: 3 }, ssig: { hits: 4 } }
    }),
    A({
      id: 'axe', name: 'Executioner', kind: 'Greataxe', shape: 'axe',
      blurb: 'Commits harder than anything else on the roster, and gets paid for it in stocks.',
      weight: 1.16, reach: 1.10, spd: 0.82, pow: 1.30, kb: 1.26,
      col: '#d84315', col2: '#ffab91', trailW: 1.7,
      specialKind: 'counter', specialName: 'Gravekeeper',
      words: { n: ['Verdict', 'Gallow', 'Bloodoak', 'Chop', 'Sentence', 'Widow'], v: ['Chop', 'Hew', 'Split', 'Fell', 'Swing'] },
      swings: { nlight: 'slashD', slight: 'slashD', dlight: 'sweep', dash: 'slam', nair: 'spin', sair: 'slashD', dair: 'slam', nsig: 'uppercut', ssig: 'bigslash', dsig: 'quake', special: 'guard' },
      tweaks: { ssig: { dmg: 3, bkb: 6 }, dair: { ang: 270, dmg: 2 } }
    }),
    A({
      id: 'lance', name: 'Vanguard', kind: 'Rocket Lance', shape: 'lance',
      blurb: 'Movement is the moveset. Every button is a commitment in a direction.',
      weight: 1.10, reach: 1.24, spd: 0.92, pow: 1.12, kb: 1.10,
      col: '#42a5f5', col2: '#bbdefb', trailW: 1.2,
      specialKind: 'dash', specialName: 'Afterburner',
      words: { n: ['Comet', 'Vanguard', 'Bulwark', 'Jet', 'Charger', 'Spire'], v: ['Charge', 'Ram', 'Drive', 'Pierce', 'Break'] },
      swings: { nlight: 'thrust', slight: 'charge', dlight: 'sweep', dash: 'charge', nair: 'spin', sair: 'charge', dair: 'drill', nsig: 'thrustUp', ssig: 'charge', dsig: 'quake', special: 'charge' },
      tweaks: { slight: { mv: 6.5 }, ssig: { mv: 8.0, reach: 0.2 }, dash: { mv: 7.0 } }
    }),
    A({
      id: 'staff', name: 'Runeweaver', kind: 'Rune Staff', shape: 'staff',
      blurb: 'Poking, zoning and one very rude uppercut. Rewards patience over pressure.',
      weight: 0.94, reach: 1.20, spd: 1.00, pow: 0.96, kb: 0.98,
      col: '#26a69a', col2: '#b2dfdb', trailW: 1.0,
      specialKind: 'buff', specialName: 'Ward Sigil',
      words: { n: ['Rune', 'Willow', 'Tide', 'Lantern', 'Oath', 'Glyph'], v: ['Weave', 'Sweep', 'Twirl', 'Ward', 'Strike'] },
      swings: { nlight: 'thrust', slight: 'spin', dlight: 'sweep', dash: 'spin', nair: 'spin', sair: 'sweep', dair: 'slam', nsig: 'uppercut', ssig: 'spin', dsig: 'aoe', special: 'guard' },
      tweaks: { slight: { back: true }, nair: { hits: 2 }, ssig: { back: true, hits: 2 } }
    }),
    A({
      id: 'blasters', name: 'Gunslinger', kind: 'Twin Blasters', shape: 'blasters',
      blurb: 'Chip damage from everywhere. Struggles to close a stock without setting one up first.',
      weight: 0.86, reach: 0.94, spd: 1.22, pow: 0.76, kb: 0.84,
      col: '#ffca28', col2: '#fff9c4', trailW: 0.6,
      specialKind: 'projectile', specialName: 'Overcharge',
      words: { n: ['Quickdraw', 'Tracer', 'Sunspot', 'Bandit', 'Kicker', 'Scatter'], v: ['Shot', 'Blast', 'Spray', 'Fan', 'Pop'] },
      swings: { nlight: 'shootF', slight: 'shootF', dlight: 'lowKick', dash: 'lunge', nair: 'spin', sair: 'shootF', dair: 'shootD', nsig: 'shootU', ssig: 'shootF', dsig: 'sweep', special: 'shootF' },
      tweaks: { nlight: { proj: 'pellet' }, slight: { proj: 'pellet', hits: 2 }, sair: { proj: 'pellet' }, nsig: { proj: 'beamUp' }, ssig: { proj: 'beam', dmg: 1 }, dair: { proj: 'pelletDown' } }
    })
  ];

  const byId = Object.create(null);
  ARCHETYPES.forEach((a, i) => { a.index = i; byId[a.id] = a; });

  SB.ARCHETYPES = ARCHETYPES;
  SB.archetype = (id) => byId[id] || ARCHETYPES[0];

  /* Projectile definitions referenced by tweaks above. */
  SB.PROJECTILES = {
    shell:      { speed: 12.5, grav: 0.16, life: 90,  r: 11, kind: 'bomb',  burst: 38, dmgMul: 1.00 },
    bigshell:   { speed: 11.0, grav: 0.18, life: 110, r: 16, kind: 'bomb',  burst: 58, dmgMul: 1.15 },
    bolt:       { speed: 13.5, grav: 0.00, life: 70,  r: 9,  kind: 'magic', burst: 0,  dmgMul: 1.00 },
    lance:      { speed: 16.0, grav: 0.00, life: 80,  r: 13, kind: 'magic', burst: 0,  dmgMul: 1.10, pierce: 1 },
    disc:       { speed: 14.0, grav: 0.00, life: 64,  r: 12, kind: 'disc',  burst: 0,  dmgMul: 0.95, boomerang: true },
    bigdisc:    { speed: 12.0, grav: 0.00, life: 90,  r: 17, kind: 'disc',  burst: 0,  dmgMul: 1.10, boomerang: true },
    arrow:      { speed: 18.0, grav: 0.05, life: 80,  r: 7,  kind: 'arrow', burst: 0,  dmgMul: 1.00 },
    bigarrow:   { speed: 21.0, grav: 0.04, life: 95,  r: 10, kind: 'arrow', burst: 0,  dmgMul: 1.12, pierce: 1 },
    arrowUp:    { speed: 17.0, grav: 0.08, life: 70,  r: 8,  kind: 'arrow', burst: 0,  dmgMul: 1.00, dir: 'up' },
    arrowDown:  { speed: 16.0, grav: 0.10, life: 60,  r: 8,  kind: 'arrow', burst: 0,  dmgMul: 1.00, dir: 'down' },
    pellet:     { speed: 17.0, grav: 0.00, life: 34,  r: 6,  kind: 'bolt',  burst: 0,  dmgMul: 0.90 },
    pelletDown: { speed: 15.0, grav: 0.06, life: 34,  r: 6,  kind: 'bolt',  burst: 0,  dmgMul: 0.90, dir: 'down' },
    beam:       { speed: 22.0, grav: 0.00, life: 46,  r: 10, kind: 'beam',  burst: 0,  dmgMul: 1.05, pierce: 2 },
    beamUp:     { speed: 20.0, grav: 0.00, life: 40,  r: 10, kind: 'beam',  burst: 0,  dmgMul: 1.05, dir: 'up' },
    energy:     { speed: 15.0, grav: 0.00, life: 62,  r: 11, kind: 'magic', burst: 0,  dmgMul: 1.00 },
    javelin:    { speed: 16.5, grav: 0.13, life: 90,  r: 9,  kind: 'arrow', burst: 0,  dmgMul: 1.08 },
    reap:       { speed: 11.0, grav: 0.00, life: 66,  r: 15, kind: 'magic', burst: 0,  dmgMul: 1.00, pierce: 2 }
  };
})(window.SB);
