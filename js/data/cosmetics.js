/* SMASHFORGE — cosmetic catalogue.
   14 equip slots x (8..12 shapes) x 10 colour themes = 1220 unique items,
   every one of which is drawn procedurally by render/cosmetic.js. */
(function (SB) {
  'use strict';
  const U = SB.U;

  const SLOTS = [
    { id: 'head',      name: 'Headgear',   layer: 'head' },
    { id: 'face',      name: 'Face',       layer: 'head' },
    { id: 'torso',     name: 'Torso',      layer: 'body' },
    { id: 'shoulders', name: 'Shoulders',  layer: 'body' },
    { id: 'arms',      name: 'Arms',       layer: 'limb' },
    { id: 'legs',      name: 'Legs',       layer: 'limb' },
    { id: 'back',      name: 'Back',       layer: 'back' },
    { id: 'weapon',    name: 'Weapon Skin',layer: 'weapon' },
    { id: 'aura',      name: 'Aura',       layer: 'fx' },
    { id: 'trail',     name: 'Trail',      layer: 'fx' },
    { id: 'hitfx',     name: 'Impact FX',  layer: 'fx' },
    { id: 'emote',     name: 'Taunt',      layer: 'anim' },
    { id: 'banner',    name: 'Banner',     layer: 'ui' },
    { id: 'crest',     name: 'Crest',      layer: 'ui' }
  ];

  const SHAPES = {
    head:      ['Hood', 'Crown', 'Warhelm', 'Horns', 'Topknot', 'Visor Helm', 'Halo Ring', 'Antlers', 'Plume Helm', 'Tricorn', 'Mane', 'Circlet'],
    face:      ['Oni Mask', 'Optic Visor', 'Warpaint', 'Wrap Scarf', 'Goggles', 'Blindfold', 'Fangs', 'Monocle', 'Respirator', 'Sigil Brand'],
    torso:     ['Cuirass', 'Robe', 'Harness', 'Duster', 'Fullplate', 'Chest Wraps', 'Scale Vest', 'Longcoat', 'Bandolier', 'Waist Sash', 'Carapace', 'Tunic'],
    shoulders: ['Pauldrons', 'Spiked Guards', 'Mantle', 'Epaulettes', 'Winglets', 'Round Guards', 'Fur Ruff', 'Layered Plates'],
    arms:      ['Bracers', 'Gloves', 'Claw Tips', 'Hand Wraps', 'Gauntlets', 'Signet Rings', 'Talons', 'Wide Cuffs'],
    legs:      ['Greaves', 'Boots', 'Sabatons', 'Leg Wraps', 'War Kilt', 'Hakama', 'Treads', 'Sandals'],
    back:      ['Cape', 'Hooded Cloak', 'Wings', 'War Banner', 'Thruster Pack', 'Trailing Scarf', 'Floating Tome', 'Quiver', 'Halo Wheel', 'Beast Tail'],
    weapon:    ['Etched', 'Runed', 'Crystalline', 'Bonecarved', 'Chromed', 'Emberforged', 'Stormbound', 'Ancient', 'Serrated', 'Prismatic', 'Voidtouched', 'Ceremonial'],
    aura:      ['Embers', 'Drifting Motes', 'Orbit Rings', 'Static Field', 'Falling Petals', 'Frost Motes', 'Spark Ring', 'Shadow Wisps', 'Bubbles', 'Rune Circle'],
    trail:     ['Ribbon', 'Smoke', 'Sparkle', 'Blade Arc', 'Ink Wash', 'Feathers', 'Lightning', 'Stardust'],
    hitfx:     ['Impact Burst', 'Shatter', 'Bloom', 'Cross Slash', 'Shockwave', 'Nova', 'Glyph Flash', 'Splash'],
    emote:     ['Bow', 'Blade Flourish', 'Point', 'Victory Spin', 'Salute', 'Kneel', 'Laugh', 'Flex'],
    banner:    ['Sigil', 'Stripes', 'Chevron', 'Beast Head', 'Falling Star', 'Skull', 'Bloom', 'Circuit'],
    crest:     ['Diamond', 'Wing', 'Watching Eye', 'Flame', 'Anchor', 'Fang', 'Gearwork', 'Leaf']
  };

  /* a:base  b:secondary  c:accent  g:glow/emissive */
  const THEMES = [
    { id: 'obsidian', name: 'Obsidian', adj: 'Obsidian', a: '#2b2f3a', b: '#454b5c', c: '#8e97ad', g: '#7f8cff' },
    { id: 'ember',    name: 'Ember',    adj: 'Ember',    a: '#7a1f0f', b: '#d8481c', c: '#ffb347', g: '#ff7a29' },
    { id: 'frost',    name: 'Frost',    adj: 'Frostbit', a: '#173b52', b: '#2f7fa8', c: '#bfeaff', g: '#79dcff' },
    { id: 'verdant',  name: 'Verdant',  adj: 'Verdant',  a: '#1f4526', b: '#4a8f43', c: '#cbe89a', g: '#8bdd5c' },
    { id: 'royal',    name: 'Royal',    adj: 'Royal',    a: '#2a2159', b: '#4f3fa8', c: '#d7c8ff', g: '#9d7bff' },
    { id: 'solar',    name: 'Solar',    adj: 'Solar',    a: '#7a5a10', b: '#d9a520', c: '#fff0b0', g: '#ffd24a' },
    { id: 'void',     name: 'Void',     adj: 'Voidborn', a: '#1a1030', b: '#3d2166', c: '#b98cff', g: '#c04cff' },
    { id: 'chrome',   name: 'Chrome',   adj: 'Chrome',   a: '#4a5058', b: '#8d99a6', c: '#e9f1f7', g: '#cfe6ff' },
    { id: 'blossom',  name: 'Blossom',  adj: 'Blossom',  a: '#6b1f3f', b: '#c3557f', c: '#ffd6e6', g: '#ff87b6' },
    { id: 'toxic',    name: 'Toxic',    adj: 'Toxic',    a: '#243b16', b: '#6aa32a', c: '#dcff6b', g: '#b6ff2e' }
  ];

  const RARITY = [
    { id: 'common',    name: 'Common',    col: '#9fb0c4', w: 0.44, glow: 0.0 },
    { id: 'rare',      name: 'Rare',      col: '#4fa3ff', w: 0.27, glow: 0.15 },
    { id: 'epic',      name: 'Epic',      col: '#b45cff', w: 0.17, glow: 0.35 },
    { id: 'legendary', name: 'Legendary', col: '#ffb028', w: 0.09, glow: 0.6 },
    { id: 'mythic',    name: 'Mythic',    col: '#ff4d6d', w: 0.03, glow: 1.0 }
  ];

  const SUFFIX = ['of the Rift', 'of Nine Suns', 'of the Long Vigil', 'of Hollow Ash', 'of the First Storm',
    'of Quiet Steel', 'of the Drowned King', 'of Ember Dawn', 'of the Last Gate', 'of Broken Stars'];

  const ALL = [];
  const BY_SLOT = Object.create(null);
  const BY_ID = Object.create(null);

  function rarityFor(seed) {
    const r = U.mulberry32(U.hash('rar|' + seed))();
    let acc = 0;
    for (let i = 0; i < RARITY.length; i++) { acc += RARITY[i].w; if (r < acc) return i; }
    return 0;
  }

  SLOTS.forEach((slot) => {
    BY_SLOT[slot.id] = [];
    /* "None" option so every slot can be left empty */
    const none = {
      id: slot.id + '_none', slot: slot.id, slotName: slot.name, layer: slot.layer,
      shape: -1, shapeName: 'None', theme: 'none', themeName: '—',
      pal: { a: '#555', b: '#777', c: '#999', g: '#888' },
      name: 'None', rarity: 0, rarityName: 'Common', rarityCol: '#8794a5', glow: 0, none: true
    };
    ALL.push(none); BY_SLOT[slot.id].push(none); BY_ID[none.id] = none;

    SHAPES[slot.id].forEach((shapeName, si) => {
      THEMES.forEach((th) => {
        const id = slot.id + '_' + si + '_' + th.id;
        const rIdx = rarityFor(id);
        const rar = RARITY[rIdx];
        const rng = U.rngFor('nm|' + id);
        let nm = th.adj + ' ' + shapeName;
        if (rIdx >= 3) nm = nm + ' ' + U.pick(SUFFIX, rng);
        const item = {
          id: id, slot: slot.id, slotName: slot.name, layer: slot.layer,
          shape: si, shapeName: shapeName,
          theme: th.id, themeName: th.name,
          pal: { a: th.a, b: th.b, c: th.c, g: th.g },
          name: nm,
          rarity: rIdx, rarityName: rar.name, rarityCol: rar.col,
          glow: rar.glow,
          /* deterministic per-item variation the renderers read */
          v: { n: 3 + Math.floor(rng() * 5), s: 0.85 + rng() * 0.35, r: rng() * Math.PI * 2, k: rng() }
        };
        ALL.push(item); BY_SLOT[slot.id].push(item); BY_ID[id] = item;
      });
    });
  });

  SB.COS_SLOTS = SLOTS;
  SB.COS_THEMES = THEMES;
  SB.COS_RARITY = RARITY;
  SB.COSMETICS = ALL;
  SB.cosBySlot = (s) => BY_SLOT[s] || [];
  SB.cos = (id) => BY_ID[id] || null;
  SB.COS_COUNT = ALL.length - SLOTS.length; /* excludes the 14 "None" entries */

  SB.emptyLoadout = function () {
    const o = Object.create(null);
    SLOTS.forEach((s) => { o[s.id] = s.id + '_none'; });
    return o;
  };

  SB.randomLoadout = function (rng, fill) {
    rng = rng || Math.random;
    const o = Object.create(null);
    SLOTS.forEach((s) => {
      const list = BY_SLOT[s.id];
      if (fill === false && rng() < 0.3) { o[s.id] = s.id + '_none'; return; }
      o[s.id] = list[1 + Math.floor(rng() * (list.length - 1))].id;
    });
    return o;
  };

  /* Colourways for the body itself — separate from equipped cosmetics. */
  SB.COLORWAYS = THEMES.map((t) => ({ id: t.id, name: t.name, primary: t.b, secondary: t.a, accent: t.c, glow: t.g }))
    .concat([
      { id: 'crimson', name: 'Crimson Guard', primary: '#c0392b', secondary: '#3a1414', accent: '#ffd9a0', glow: '#ff6b4a' },
      { id: 'azure', name: 'Azure Order', primary: '#2f6fd0', secondary: '#16224a', accent: '#cfe6ff', glow: '#59a6ff' },
      { id: 'jade', name: 'Jade Circuit', primary: '#1e8f7a', secondary: '#0e3a33', accent: '#d6fff2', glow: '#3ff0c4' },
      { id: 'mono', name: 'Monochrome', primary: '#7b8592', secondary: '#20242b', accent: '#f2f6fa', glow: '#ffffff' },
      { id: 'sunset', name: 'Sunset Run', primary: '#e0663f', secondary: '#3b1a3a', accent: '#ffd58a', glow: '#ff9d5c' },
      { id: 'ink', name: 'Ink & Gold', primary: '#242232', secondary: '#12111a', accent: '#e6cb76', glow: '#f0c46a' }
    ]);

  SB.SKIN_TONES = ['#f6d7c0', '#eec39a', '#dda87c', '#c68a5e', '#a56b45', '#7d4c30', '#5a3520', '#3c2416',
    '#cfd8e3', '#a9c7d6', '#c8b6e2', '#9ad6c0', '#e8b7b7', '#8fa5b8'];

  SB.HAIR_STYLES = ['Bald', 'Short Crop', 'Swept Back', 'Long Flow', 'Ponytail', 'Topknot', 'Mohawk',
    'Braids', 'Curls', 'Twin Tails', 'Wild Mane', 'Undercut'];

  SB.HAIR_COLORS = ['#1c1a1a', '#3b2b21', '#6b4a2f', '#a9762f', '#d9c07a', '#e8e3d8', '#9aa3ad',
    '#c0392b', '#2f6fd0', '#1e8f7a', '#b45cff', '#ff87b6', '#b6ff2e', '#ff7a29'];
})(window.SB);
