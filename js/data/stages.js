/* SMASHFORGE — stages. World origin sits at the centre-top of the main platform. */
(function (SB) {
  'use strict';

  const STAGES = [
    {
      id: 'terrace', name: 'Skyfall Terrace',
      blurb: 'A broad stone shelf above the cloud line. Neutral, symmetrical, no excuses.',
      ground: { x: -430, y: 0, w: 860, h: 150 },
      plats: [
        { x: -320, y: -200, w: 210, h: 22 },
        { x: 110, y: -200, w: 210, h: 22 },
        { x: -95, y: -378, w: 190, h: 22 }
      ],
      spawns: [{ x: -250, y: -40 }, { x: 250, y: -40 }, { x: -215, y: -240 }, { x: 215, y: -240 }],
      blast: { l: -1180, r: 1180, t: -1000, b: 760 },
      sky: ['#1b2a52', '#3d5a94', '#8aa9d6', '#f0c9a0'],
      sun: { x: 0.72, y: 0.30, col: '#ffdca8', r: 150 },
      fog: '#a8c0e0', ambient: '#ffe6c2', rim: '#9fd0ff',
      rock: { a: '#5a6272', b: '#3b414e', c: '#8892a3', moss: '#6f8f5a' },
      weather: { kind: 'leaf', n: 34, col: '#ffe1a8', spd: 0.5 },
      layers: 'mountains'
    },
    {
      id: 'emberforge', name: 'Emberforge',
      blurb: 'A working foundry. The floor is warm, the air is not, and the platforms are uneven on purpose.',
      ground: { x: -400, y: 0, w: 800, h: 150 },
      plats: [
        { x: -360, y: -168, w: 190, h: 20 },
        { x: 168, y: -232, w: 210, h: 20 },
        { x: -70, y: -380, w: 170, h: 20 }
      ],
      spawns: [{ x: -230, y: -40 }, { x: 230, y: -40 }, { x: -265, y: -208 }, { x: 270, y: -272 }],
      blast: { l: -1140, r: 1140, t: -980, b: 720 },
      sky: ['#160a08', '#3d1208', '#8a2b0c', '#ff7a29'],
      sun: { x: 0.5, y: 0.86, col: '#ff8b3d', r: 260 },
      fog: '#5c1e0c', ambient: '#ffb072', rim: '#ff7a3d',
      rock: { a: '#4a3a34', b: '#2b201d', c: '#7b6055', moss: '#c0632a' },
      weather: { kind: 'ember', n: 56, col: '#ffb457', spd: -0.9 },
      layers: 'forge'
    },
    {
      id: 'frostwatch', name: 'Frostwatch',
      blurb: 'A narrow summit with generous platforms. Vertical fights, brutal edges.',
      ground: { x: -330, y: 0, w: 660, h: 150 },
      plats: [
        { x: -400, y: -186, w: 180, h: 20 },
        { x: 220, y: -186, w: 180, h: 20 },
        { x: -125, y: -330, w: 250, h: 20 },
        { x: -80, y: -486, w: 160, h: 20 }
      ],
      spawns: [{ x: -190, y: -40 }, { x: 190, y: -40 }, { x: -310, y: -226 }, { x: 310, y: -226 }],
      blast: { l: -1200, r: 1200, t: -1060, b: 740 },
      sky: ['#0e1c30', '#1d3b5c', '#4f7fa8', '#cfe9ff'],
      sun: { x: 0.3, y: 0.22, col: '#dff2ff', r: 110 },
      fog: '#9dc3e0', ambient: '#dff0ff', rim: '#8fd8ff',
      rock: { a: '#5d6b7d', b: '#39434f', c: '#a9bccd', moss: '#e8f6ff' },
      weather: { kind: 'snow', n: 74, col: '#e9f6ff', spd: 0.35 },
      layers: 'peaks'
    },
    {
      id: 'nullstead', name: 'The Nullstead',
      blurb: 'Broken slabs adrift in nothing. Small stage, short edges, fast stocks.',
      ground: { x: -300, y: 0, w: 600, h: 130 },
      plats: [
        { x: -290, y: -215, w: 170, h: 20 },
        { x: 120, y: -215, w: 170, h: 20 },
        { x: -85, y: -400, w: 170, h: 20 }
      ],
      spawns: [{ x: -175, y: -40 }, { x: 175, y: -40 }, { x: -205, y: -255 }, { x: 205, y: -255 }],
      blast: { l: -1080, r: 1080, t: -960, b: 700 },
      sky: ['#07060f', '#170f2e', '#33195c', '#7a3fb0'],
      sun: { x: 0.5, y: 0.42, col: '#c04cff', r: 190 },
      fog: '#2a1348', ambient: '#d9b3ff', rim: '#c04cff',
      rock: { a: '#3a2b55', b: '#1f1533', c: '#7d63a8', moss: '#b98cff' },
      weather: { kind: 'mote', n: 62, col: '#c9a6ff', spd: -0.25 },
      layers: 'void'
    }
  ];

  STAGES.forEach((s) => {
    /* collision list: main platform is solid, the rest are drop-through */
    s.solids = [{ x: s.ground.x, y: s.ground.y, w: s.ground.w, h: s.ground.h, soft: false }];
    s.plats.forEach((p) => s.solids.push({ x: p.x, y: p.y, w: p.w, h: p.h, soft: true }));
    s.centerY = -180;
  });

  SB.STAGES = STAGES;
  SB.stage = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
})(window.SB);
