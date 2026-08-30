/* SMASHFORGE — skeletal pose system.
   Angle convention: 0 = straight down, +PI/2 = forward (facing +x), PI = straight up.
   Everything is expressed in body units so one rig fits every body size. */
(function (SB) {
  'use strict';
  const U = SB.U;
  const P = Math.PI;

  const FIELDS = ['hipX', 'hipY', 'lean', 'chest', 'head', 'wRot', 'bodyRot', 'squash', 'shrug', 'weaponHold'];
  const LIMBS = ['armF', 'armB', 'legF', 'legB'];

  function base() {
    return {
      hipX: 0, hipY: 0, lean: 0.05, chest: 0, head: 0,
      armF: [0.28, 0.26], armB: [-0.22, 0.30],
      legF: [0.07, -0.11], legB: [-0.07, -0.11],
      wRot: 0.42, bodyRot: 0, squash: 1, shrug: 0, weaponHold: 1
    };
  }

  function clone(p) {
    const o = {};
    for (const f of FIELDS) o[f] = p[f];
    for (const l of LIMBS) o[l] = [p[l][0], p[l][1]];
    return o;
  }

  function blend(a, b, t) {
    if (t <= 0) return clone(a);
    if (t >= 1) return clone(b);
    const o = {};
    for (const f of FIELDS) o[f] = a[f] + (b[f] - a[f]) * t;
    for (const l of LIMBS) o[l] = [a[l][0] + (b[l][0] - a[l][0]) * t, a[l][1] + (b[l][1] - a[l][1]) * t];
    return o;
  }

  /* delta objects only list what they change */
  function apply(src, d) {
    const o = clone(src);
    if (!d) return o;
    for (const f of FIELDS) if (d[f] !== undefined) o[f] = d[f];
    for (const l of LIMBS) if (d[l]) o[l] = [d[l][0], d[l][1]];
    return o;
  }

  const Pose = { base: base, clone: clone, blend: blend, apply: apply };
  SB.Pose = Pose;

  /* ---------------- locomotion / reaction poses ---------------- */
  const POSES = {};
  SB.POSES = POSES;

  POSES.idle = function (t) {
    const b = base();
    const s = Math.sin(t * 2.1), s2 = Math.sin(t * 2.1 - 0.7);
    b.hipY = 0.010 + s * 0.010;
    b.lean = 0.05 + s * 0.012;
    b.chest = -s * 0.02;
    b.head = s2 * 0.035;
    b.armF = [0.26 + s2 * 0.05, 0.30 + s * 0.05];
    b.armB = [-0.24 + s2 * 0.05, 0.34 + s * 0.05];
    b.legF = [0.06, -0.10];
    b.legB = [-0.06, -0.10];
    b.wRot = 0.44 + s * 0.05;
    return b;
  };

  POSES.walk = function (ph) {
    const b = base();
    const a = ph * U.TAU;
    const s = Math.sin(a), c = Math.cos(a);
    b.lean = 0.11;
    b.hipY = 0.014 + Math.abs(Math.sin(a * 2)) * 0.018;
    b.legF = [s * 0.52, -0.20 - Math.max(0, c) * 0.42];
    b.legB = [-s * 0.52, -0.20 - Math.max(0, -c) * 0.42];
    b.armF = [0.28 - s * 0.38, 0.30];
    b.armB = [-0.22 + s * 0.42, 0.34];
    b.chest = s * 0.05;
    b.head = -s * 0.03;
    return b;
  };

  POSES.run = function (ph) {
    const b = base();
    const a = ph * U.TAU;
    const s = Math.sin(a), c = Math.cos(a);
    b.lean = 0.30;
    b.hipY = 0.030 + Math.abs(Math.sin(a * 2)) * 0.030;
    b.legF = [s * 0.86, -0.30 - Math.max(0, c) * 0.86];
    b.legB = [-s * 0.86, -0.30 - Math.max(0, -c) * 0.86];
    b.armF = [0.30 - s * 0.62, 0.55];
    b.armB = [-0.24 + s * 0.70, 0.62];
    b.chest = s * 0.09;
    b.head = -0.10 - s * 0.04;
    b.wRot = 0.62;
    return b;
  };

  POSES.dash = function (t) {
    const b = base();
    b.lean = 0.42;
    b.hipY = 0.055;
    b.legF = [0.72, -0.62];
    b.legB = [-0.62, -0.30];
    b.armF = [0.10, 0.75];
    b.armB = [-0.62, 0.80];
    b.chest = 0.12; b.head = -0.14;
    return b;
  };

  POSES.crouch = function () {
    const b = base();
    b.hipY = 0.20; b.lean = 0.24;
    b.legF = [0.60, -1.15];
    b.legB = [-0.52, -1.05];
    b.armF = [0.55, 0.55];
    b.armB = [-0.10, 0.60];
    b.chest = 0.10; b.head = -0.14;
    return b;
  };

  POSES.jump = function (t) {
    const b = base();
    b.lean = 0.06 - t * 0.10;
    b.hipY = -0.02;
    b.legF = [0.34 - t * 0.28, -0.62 + t * 0.42];
    b.legB = [-0.30 + t * 0.16, -0.50 + t * 0.34];
    b.armF = [0.30 + t * 1.10, 0.30 - t * 0.18];
    b.armB = [-0.24 - t * 0.60, 0.34];
    b.head = 0.10 * t;
    b.squash = 1 + t * 0.07;
    return b;
  };

  POSES.fall = function (t, vy) {
    const b = base();
    const f = U.sat((vy || 0) / 16);
    b.lean = -0.04 - f * 0.08;
    b.hipY = 0.02;
    b.legF = [0.34 + f * 0.10, -0.44];
    b.legB = [-0.26, -0.30 - f * 0.20];
    b.armF = [0.55 + f * 0.30, 0.45];
    b.armB = [-0.55 - f * 0.35, 0.50];
    b.head = -0.05;
    b.squash = 1 + f * 0.04;
    return b;
  };

  POSES.land = function (t) {
    const k = 1 - U.sat(t);
    const b = base();
    b.hipY = 0.24 * k;
    b.lean = 0.20 * k;
    b.legF = [0.55 * k, -1.10 * k - 0.10];
    b.legB = [-0.48 * k, -1.00 * k - 0.10];
    b.armF = [0.28 + 0.50 * k, 0.30 + 0.35 * k];
    b.armB = [-0.22 - 0.45 * k, 0.34 + 0.35 * k];
    b.squash = 1 - 0.14 * k;
    b.head = -0.12 * k;
    return b;
  };

  POSES.airIdle = function (t) {
    const b = base();
    const s = Math.sin(t * 3.0);
    b.lean = -0.02;
    b.legF = [0.30 + s * 0.06, -0.42];
    b.legB = [-0.24, -0.34];
    b.armF = [0.62 + s * 0.08, 0.42];
    b.armB = [-0.58 - s * 0.08, 0.46];
    return b;
  };

  POSES.dodge = function (t) {
    const b = base();
    const k = Math.sin(U.sat(t) * P);
    b.hipY = 0.26 * k;
    b.lean = 0.34 * k;
    b.legF = [0.72 * k, -1.20 * k - 0.10];
    b.legB = [-0.62 * k, -1.05 * k - 0.10];
    b.armF = [0.30 + 0.85 * k, 0.30 + 0.70 * k];
    b.armB = [-0.22 - 0.30 * k, 0.34 + 0.70 * k];
    b.squash = 1 - 0.10 * k;
    b.head = -0.18 * k;
    return b;
  };

  POSES.roll = function (t) {
    const b = base();
    b.bodyRot = U.sat(t) * U.TAU;
    b.hipY = 0.16;
    b.legF = [0.95, -1.55];
    b.legB = [0.75, -1.45];
    b.armF = [0.90, 1.30];
    b.armB = [0.70, 1.30];
    b.lean = 0.55; b.head = -0.30;
    b.squash = 0.92;
    return b;
  };

  POSES.airdodge = function (t) {
    const b = base();
    b.bodyRot = U.sat(t) * U.TAU * 0.85;
    b.hipY = 0.10;
    b.legF = [0.85, -1.35];
    b.legB = [0.65, -1.25];
    b.armF = [0.80, 1.15];
    b.armB = [0.60, 1.15];
    b.lean = 0.40;
    return b;
  };

  POSES.shield = function (t) {
    const b = base();
    const s = Math.sin(t * 4) * 0.02;
    b.hipY = 0.13 + s;
    b.lean = 0.18;
    b.legF = [0.42, -0.86];
    b.legB = [-0.40, -0.80];
    b.armF = [1.12, 1.00];
    b.armB = [0.78, 1.05];
    b.chest = 0.06; b.head = -0.08;
    b.wRot = -0.55;
    return b;
  };

  POSES.hurt = function (t, heavy) {
    const b = base();
    const k = 1 - U.sat(t);
    const m = heavy ? 1.5 : 1;
    b.lean = -0.34 * k * m;
    b.chest = -0.22 * k * m;
    b.head = 0.26 * k * m;
    b.hipY = 0.06 * k;
    b.hipX = -0.03 * k * m;
    b.armF = [0.28 - 0.75 * k * m, 0.30 + 0.30 * k];
    b.armB = [-0.22 - 0.80 * k * m, 0.34 + 0.30 * k];
    b.legF = [0.10 - 0.30 * k, -0.20];
    b.legB = [-0.30 * k - 0.06, -0.24];
    b.squash = 1 - 0.05 * k;
    return b;
  };

  POSES.launch = function (t, spin) {
    const b = base();
    b.bodyRot = spin || 0;
    b.lean = -0.20;
    b.armF = [-0.95, 0.32];
    b.armB = [-1.15, 0.36];
    b.legF = [0.55, -0.35];
    b.legB = [-0.35, -0.28];
    b.head = 0.22;
    b.squash = 1.04;
    return b;
  };

  POSES.ko = function (t) {
    const b = base();
    b.bodyRot = t * 9;
    b.lean = -0.3;
    b.armF = [-1.3, 0.2]; b.armB = [-1.5, 0.2];
    b.legF = [0.9, -0.2]; b.legB = [-0.7, -0.2];
    b.head = 0.3;
    return b;
  };

  POSES.respawn = function (t) {
    const b = base();
    const k = 1 - U.sat(t);
    b.hipY = -0.03 * k;
    b.lean = 0.02;
    b.armF = [0.30 + k * 0.5, 0.30];
    b.armB = [-0.24 - k * 0.5, 0.34];
    b.legF = [0.20 * k + 0.06, -0.22];
    b.legB = [-0.20 * k - 0.06, -0.22];
    b.squash = 1 + k * 0.10;
    return b;
  };

  POSES.ledge = function (t) {
    const b = base();
    const s = Math.sin(t * 2.4) * 0.03;
    b.hipY = 0.10 + s;
    b.lean = 0.10;
    b.armF = [2.85, 0.10];
    b.armB = [2.70, 0.14];
    b.legF = [0.35, -0.55];
    b.legB = [-0.25, -0.40];
    b.head = 0.12;
    return b;
  };

  /* taunts — index maps to the equipped emote cosmetic */
  POSES.taunt = function (t, variant) {
    const b = base();
    const u = U.sat(t), s = Math.sin(u * P);
    switch (variant % 8) {
      case 0: b.lean = 0.55 * s; b.head = -0.35 * s; b.armF = [0.9 * s + 0.28, 0.9 * s + 0.3]; b.armB = [-0.9 * s - 0.22, 0.4]; break;
      case 1: b.bodyRot = 0; b.armF = [0.28 + 3.0 * s, 0.30 - 0.2 * s]; b.wRot = 0.42 + 5 * s; b.lean = 0.1 * s; break;
      case 2: b.armF = [1.55, 0.02]; b.lean = 0.18 * s; b.head = -0.1 * s; b.hipY = 0.02; break;
      case 3: b.bodyRot = u * U.TAU; b.armF = [2.2, 0.2]; b.armB = [-2.0, 0.2]; b.legF = [0.5, -0.6]; break;
      case 4: b.armF = [2.55, 1.25]; b.head = -0.08; b.lean = -0.05; b.legF = [0.05, -0.05]; b.legB = [-0.05, -0.05]; break;
      case 5: b.hipY = 0.30 * s; b.legF = [0.75 * s, -1.35 * s - 0.1]; b.legB = [-0.55 * s, -1.2 * s - 0.1]; b.head = 0.2 * s; b.lean = 0.3 * s; break;
      case 6: b.head = 0.35 * s; b.chest = -0.2 * s; b.lean = -0.18 * s; b.armF = [0.28 - 0.6 * s, 0.9]; b.armB = [-0.22 - 0.6 * s, 0.9]; break;
      default: b.armF = [1.95, 1.55]; b.armB = [-1.85, 1.55]; b.chest = 0.06; b.lean = 0.02; b.hipY = -0.02 * s; break;
    }
    return b;
  };

  /* ---------------- swing keyframes ----------------
     K1 = anticipation, K2 = strike, K3 = follow-through. */
  const SW = {};
  SB.SWINGS = SW;
  function def(id, k1, k2, k3) { SW[id] = { a: k1, b: k2, c: k3 }; }

  def('jab',
    { armF: [0.50, 0.70], lean: -0.06, chest: -0.12, wRot: 0.10, armB: [-0.45, 0.45] },
    { armF: [1.50, 0.08], lean: 0.22, chest: 0.20, wRot: 0.30, armB: [-0.05, 0.60], hipX: 0.02 },
    { armF: [1.22, 0.38], lean: 0.10, chest: 0.08, wRot: 0.45, armB: [-0.20, 0.50] });

  def('punch',
    { armF: [0.30, 1.05], armB: [-0.60, 0.55], lean: -0.10, chest: -0.18, hipX: -0.015 },
    { armF: [1.55, 0.03], armB: [-0.20, 0.90], lean: 0.26, chest: 0.26, hipX: 0.030 },
    { armF: [1.30, 0.35], armB: [-0.40, 0.70], lean: 0.10, chest: 0.10 });

  def('flurry',
    { armF: [0.55, 0.95], armB: [-0.55, 0.95], lean: 0.05, chest: -0.10 },
    { armF: [1.58, 0.02], armB: [-0.10, 1.05], lean: 0.22, chest: 0.24, hipX: 0.025 },
    { armF: [-0.10, 1.05], armB: [1.58, 0.02], lean: 0.22, chest: -0.10, hipX: 0.025 });

  def('thrust',
    { armF: [0.62, 1.15], armB: [-0.50, 0.65], lean: -0.12, chest: -0.22, wRot: -0.35, hipX: -0.02, legF: [-0.10, -0.18] },
    { armF: [1.48, 0.02], armB: [-0.05, 0.80], lean: 0.24, chest: 0.30, wRot: 0.00, hipX: 0.045, legF: [0.62, -0.55] },
    { armF: [1.35, 0.28], armB: [-0.25, 0.62], lean: 0.12, chest: 0.14, wRot: 0.12, legF: [0.42, -0.45] });

  def('thrustDash',
    { armF: [0.55, 1.20], lean: -0.16, chest: -0.24, wRot: -0.40, legF: [-0.20, -0.15] },
    { armF: [1.50, 0.00], lean: 0.48, chest: 0.30, wRot: 0.02, legF: [0.85, -0.70], legB: [-0.75, -0.30], hipY: 0.05 },
    { armF: [1.40, 0.24], lean: 0.32, chest: 0.16, legF: [0.55, -0.55] });

  def('slashH',
    { armF: [-0.58, 0.55], armB: [-0.70, 0.40], lean: -0.16, chest: -0.32, head: 0.10, wRot: -0.65 },
    { armF: [1.52, 0.12], armB: [0.10, 0.70], lean: 0.26, chest: 0.38, head: -0.12, wRot: 0.55, hipX: 0.03 },
    { armF: [2.05, 0.36], armB: [-0.10, 0.60], lean: 0.14, chest: 0.24, wRot: 0.95 });

  def('slashD',
    { armF: [3.25, 0.32], armB: [-0.70, 0.42], lean: -0.14, chest: -0.26, head: 0.14, wRot: -0.35 },
    { armF: [1.05, 0.10], armB: [0.05, 0.72], lean: 0.30, chest: 0.34, head: -0.14, wRot: 0.35, hipY: 0.04 },
    { armF: [0.52, 0.30], armB: [-0.20, 0.60], lean: 0.22, chest: 0.20, hipY: 0.07, wRot: 0.60 });

  def('bigslash',
    { armF: [3.55, 0.42], armB: [-0.85, 0.50], lean: -0.26, chest: -0.42, head: 0.20, wRot: -0.55, hipY: -0.02, legB: [-0.40, -0.28] },
    { armF: [1.00, 0.06], armB: [0.20, 0.80], lean: 0.42, chest: 0.46, head: -0.20, wRot: 0.42, hipY: 0.08, legF: [0.70, -0.62] },
    { armF: [0.40, 0.28], armB: [-0.15, 0.62], lean: 0.28, chest: 0.28, hipY: 0.12, wRot: 0.75 });

  def('sweep',
    { armF: [-0.35, 0.60], armB: [-0.60, 0.45], lean: 0.10, chest: -0.24, hipY: 0.14, legF: [0.42, -0.85], legB: [-0.40, -0.80] },
    { armF: [0.92, -0.10], armB: [0.00, 0.70], lean: 0.32, chest: 0.28, hipY: 0.22, wRot: 0.30, legF: [0.60, -1.10], legB: [-0.55, -1.00] },
    { armF: [1.35, 0.22], armB: [-0.20, 0.55], lean: 0.22, chest: 0.16, hipY: 0.18, wRot: 0.60 });

  def('slam',
    { armF: [3.50, 0.48], armB: [3.20, 0.55], lean: -0.24, chest: -0.34, head: 0.22, wRot: -0.20, hipY: -0.03 },
    { armF: [0.85, 0.04], armB: [0.55, 0.30], lean: 0.36, chest: 0.36, head: -0.18, wRot: 0.20, hipY: 0.10, legF: [0.50, -0.90] },
    { armF: [0.50, 0.22], armB: [0.20, 0.45], lean: 0.26, chest: 0.20, hipY: 0.14, wRot: 0.40 });

  def('uppercut',
    { armF: [0.22, 0.55], armB: [-0.35, 0.50], lean: 0.22, chest: 0.16, hipY: 0.18, legF: [0.45, -0.95], legB: [-0.42, -0.90], wRot: -0.10 },
    { armF: [2.95, 0.06], armB: [-0.55, 0.45], lean: -0.22, chest: -0.28, head: 0.18, hipY: -0.08, legF: [0.15, -0.28], legB: [-0.15, -0.24], wRot: 0.10, squash: 1.06 },
    { armF: [2.60, 0.24], armB: [-0.40, 0.45], lean: -0.10, chest: -0.12, hipY: 0.02 });

  def('uppercutFist',
    { armF: [0.18, 1.00], armB: [-0.35, 0.60], lean: 0.20, chest: 0.14, hipY: 0.16 },
    { armF: [2.90, 0.02], armB: [-0.50, 0.55], lean: -0.20, chest: -0.26, hipY: -0.06, squash: 1.05 },
    { armF: [2.50, 0.26], armB: [-0.35, 0.50], lean: -0.08, hipY: 0.02 });

  def('thrustUp',
    { armF: [0.45, 1.05], lean: 0.16, chest: 0.10, hipY: 0.14, wRot: -0.25 },
    { armF: [3.06, 0.00], lean: -0.14, chest: -0.20, hipY: -0.05, wRot: 0.00, squash: 1.05 },
    { armF: [2.85, 0.20], lean: -0.06, hipY: 0.02 });

  def('spin',
    { armF: [-0.50, 0.50], armB: [-0.60, 0.45], lean: -0.12, chest: -0.25, wRot: -0.40 },
    { armF: [1.75, 0.14], armB: [1.30, 0.35], lean: 0.10, chest: 0.20, wRot: 0.50 },
    { armF: [2.10, 0.32], armB: [1.60, 0.45], lean: 0.06, chest: 0.10, wRot: 0.85 });

  def('aerialSpin',
    { armF: [1.30, 0.40], armB: [-1.10, 0.45], lean: 0.00, legF: [0.45, -0.60], legB: [-0.40, -0.55] },
    { armF: [1.80, 0.16], armB: [1.40, 0.30], lean: 0.05, legF: [0.60, -0.85], legB: [-0.55, -0.75] },
    { armF: [2.10, 0.34], armB: [1.65, 0.42], lean: 0.02, legF: [0.45, -0.65], legB: [-0.40, -0.60] });

  def('kick',
    { legF: [-0.35, -0.50], lean: 0.14, armF: [0.10, 0.80], armB: [-0.60, 0.60], hipY: 0.06 },
    { legF: [1.32, -0.14], lean: -0.20, armF: [-0.35, 0.65], armB: [-0.85, 0.55], hipY: -0.02 },
    { legF: [0.85, -0.40], lean: -0.06, armF: [0.05, 0.70], hipY: 0.04 });

  def('lowKick',
    { legF: [-0.25, -0.55], lean: 0.24, hipY: 0.20, armF: [0.35, 0.85], armB: [-0.50, 0.70] },
    { legF: [0.98, -0.06], lean: 0.10, hipY: 0.28, armF: [0.10, 0.95], armB: [-0.70, 0.75], legB: [-0.55, -1.05] },
    { legF: [0.60, -0.35], lean: 0.18, hipY: 0.24 });

  def('stomp',
    { legF: [-0.45, -0.55], legB: [-0.30, -0.50], lean: -0.12, armF: [0.55, 0.85], armB: [-0.70, 0.70], hipY: -0.04 },
    { legF: [0.28, -0.04], legB: [0.12, -0.06], lean: 0.10, armF: [0.85, 0.60], armB: [-0.45, 0.55], hipY: 0.04, squash: 1.07 },
    { legF: [0.35, -0.24], legB: [0.05, -0.22], lean: 0.04, hipY: 0.02 });

  def('lunge',
    { armF: [0.35, 0.90], lean: -0.08, hipY: 0.14, legF: [-0.20, -0.40] },
    { armF: [1.45, 0.08], lean: 0.44, hipY: 0.10, legF: [0.95, -0.70], legB: [-0.70, -0.25], chest: 0.24 },
    { armF: [1.30, 0.30], lean: 0.30, hipY: 0.14, legF: [0.62, -0.65] });

  def('charge',
    { armF: [0.70, 1.05], lean: 0.06, chest: -0.14, wRot: -0.30, legF: [-0.25, -0.35] },
    { armF: [1.52, 0.00], lean: 0.52, chest: 0.22, wRot: 0.02, legF: [0.80, -0.55], legB: [-0.85, -0.20], hipY: 0.02 },
    { armF: [1.42, 0.22], lean: 0.36, chest: 0.12, legF: [0.55, -0.50] });

  def('drill',
    { armF: [0.30, 0.55], armB: [0.20, 0.55], lean: -0.10, legF: [0.30, -0.55], legB: [-0.25, -0.50] },
    { armF: [0.14, 0.04], armB: [0.10, 0.08], lean: 0.02, legF: [0.10, -0.12], legB: [-0.08, -0.12], bodyRot: 0, squash: 1.10 },
    { armF: [0.22, 0.20], armB: [0.16, 0.22], legF: [0.20, -0.30], legB: [-0.16, -0.30] });

  def('quake',
    { armF: [3.40, 0.42], armB: [3.10, 0.50], lean: -0.24, chest: -0.32, hipY: -0.05, head: 0.20 },
    { armF: [0.55, 0.04], armB: [0.35, 0.24], lean: 0.34, chest: 0.34, hipY: 0.22, head: -0.20, legF: [0.55, -1.05], legB: [-0.50, -1.00], squash: 0.94 },
    { armF: [0.38, 0.20], armB: [0.22, 0.34], lean: 0.26, hipY: 0.20 });

  def('shockwave',
    { armF: [3.30, 0.45], lean: -0.20, hipY: -0.04 },
    { armF: [0.60, 0.05], lean: 0.36, hipY: 0.24, legF: [0.55, -1.05], squash: 0.94 },
    { armF: [0.45, 0.22], lean: 0.24, hipY: 0.18 });

  def('groundpound',
    { armF: [3.10, 0.35], armB: [3.30, 0.35], lean: -0.10, legF: [0.35, -0.55], legB: [-0.30, -0.50], squash: 1.10 },
    { armF: [0.18, 0.05], armB: [0.14, 0.08], lean: 0.06, legF: [0.10, -0.08], legB: [-0.08, -0.08], squash: 0.90 },
    { armF: [0.30, 0.24], armB: [0.24, 0.26], legF: [0.22, -0.26], legB: [-0.18, -0.26] });

  def('rise',
    { armF: [0.35, 0.70], lean: 0.18, hipY: 0.14, legF: [0.40, -0.80] },
    { armF: [3.00, 0.06], lean: -0.18, hipY: -0.05, legF: [0.15, -0.20], legB: [-0.12, -0.18], squash: 1.12, wRot: 0.05 },
    { armF: [2.75, 0.22], lean: -0.08, hipY: 0.02, squash: 1.04 });

  def('aoe',
    { armF: [0.70, 0.90], armB: [-0.65, 0.90], lean: 0.10, chest: -0.10, hipY: 0.08 },
    { armF: [2.25, 0.24], armB: [-2.05, 0.26], lean: -0.12, chest: 0.06, hipY: -0.04, head: 0.10, squash: 1.05 },
    { armF: [1.95, 0.36], armB: [-1.75, 0.38], lean: -0.04, hipY: 0.02 });

  def('cast',
    { armF: [0.80, 1.00], armB: [-0.40, 0.70], lean: -0.10, chest: -0.16, wRot: -0.30 },
    { armF: [1.56, 0.04], armB: [-0.10, 0.85], lean: 0.20, chest: 0.24, wRot: 0.10, hipX: 0.02 },
    { armF: [1.42, 0.26], armB: [-0.25, 0.68], lean: 0.10, chest: 0.10 });

  def('shootF',
    { armF: [1.25, 0.55], armB: [-0.35, 0.75], lean: -0.06, chest: -0.10, wRot: -0.15 },
    { armF: [1.57, 0.00], armB: [-0.05, 0.90], lean: 0.14, chest: 0.18, hipX: -0.020, wRot: 0.00 },
    { armF: [1.66, 0.16], armB: [-0.20, 0.75], lean: 0.04, chest: 0.06, hipX: 0.010 });

  def('shootU',
    { armF: [2.30, 0.55], lean: 0.10, chest: 0.06, hipY: 0.08 },
    { armF: [3.02, 0.00], lean: -0.12, chest: -0.14, hipY: -0.02, head: 0.16 },
    { armF: [2.86, 0.18], lean: -0.04, hipY: 0.02 });

  def('shootD',
    { armF: [0.70, 0.55], lean: -0.06, legF: [0.30, -0.45] },
    { armF: [0.22, 0.02], lean: 0.10, legF: [0.20, -0.30], head: -0.16 },
    { armF: [0.36, 0.18], lean: 0.04, legF: [0.26, -0.36] });

  def('shootArc',
    { armF: [1.55, 0.60], lean: -0.08, hipY: 0.04 },
    { armF: [2.12, 0.05], lean: 0.06, chest: 0.10, hipX: -0.015 },
    { armF: [1.98, 0.22], lean: 0.02 });

  def('throwArc',
    { armF: [-0.55, 0.70], armB: [-0.35, 0.50], lean: -0.18, chest: -0.30, head: 0.14, wRot: -0.50 },
    { armF: [1.92, 0.10], armB: [0.05, 0.70], lean: 0.28, chest: 0.34, head: -0.12, wRot: 0.60, hipX: 0.03 },
    { armF: [2.30, 0.30], armB: [-0.15, 0.60], lean: 0.14, chest: 0.18, wRot: 0.90 });

  def('grab',
    { armF: [0.95, 0.85], armB: [0.75, 0.90], lean: 0.06, chest: -0.08 },
    { armF: [1.52, 0.06], armB: [1.42, 0.10], lean: 0.26, chest: 0.16, hipX: 0.03 },
    { armF: [0.85, 0.95], armB: [0.75, 1.00], lean: -0.10, chest: -0.10, hipX: -0.02 });

  def('guard',
    { armF: [1.15, 1.05], armB: [0.85, 1.00], lean: 0.14, hipY: 0.10, wRot: -0.60, legF: [0.35, -0.72], legB: [-0.35, -0.70] },
    { armF: [1.22, 1.10], armB: [0.92, 1.05], lean: 0.16, hipY: 0.12, wRot: -0.62, legF: [0.38, -0.76], legB: [-0.38, -0.74] },
    { armF: [1.60, 0.20], armB: [0.30, 0.70], lean: 0.34, chest: 0.30, hipY: 0.06, wRot: 0.30 });

  /* ---------------- attack pose evaluation ---------------- */
  /* u = 0..1 across the whole move; u1/u2 mark startup and active boundaries. */
  Pose.attack = function (mv, u, neutral, spinAmt) {
    const sw = SW[mv.swing] || SW.jab;
    const K0 = neutral;
    const K1 = apply(K0, sw.a);
    const K2 = apply(K0, sw.b);
    const K3 = apply(K0, sw.c);
    const u1 = mv.startup / mv.total;
    const u2 = (mv.startup + mv.active) / mv.total;
    let p;
    if (u < u1) {
      p = blend(K0, K1, U.easeOut2(u1 <= 0 ? 1 : u / u1));
    } else if (u < u2) {
      const a = (u - u1) / Math.max(0.0001, u2 - u1);
      if (mv.swing === 'flurry') {
        const osc = 0.5 - 0.5 * Math.cos(a * Math.PI * 2 * Math.max(2, mv.hits));
        p = blend(blend(K1, K2, U.easeOut(Math.min(1, a * 4))), K3, osc);
      } else if (a < 0.42) {
        p = blend(K1, K2, U.easeOut(a / 0.42));
      } else {
        p = blend(K2, K3, ((a - 0.42) / 0.58) * 0.5);
      }
    } else {
      const a = (u - u2) / Math.max(0.0001, 1 - u2);
      p = blend(blend(K2, K3, 0.5), K0, U.smooth(a));
    }
    if (spinAmt) p.bodyRot += spinAmt;
    return p;
  };

  /* ---------------- forward kinematics ---------------- */
  function pt(from, a, len) {
    return { x: from.x + Math.sin(a) * len, y: from.y + Math.cos(a) * len };
  }

  /* h = fighter pixel height (feet to crown). Returns joints in local space,
     origin at the feet, y negative upward, +x = facing direction. */
  SB.computeSkel = function (pose, h, build) {
    const bw = build || 1;
    const B = {
      spine: 0.208 * h, neck: 0.082 * h, headR: 0.096 * h,
      upArm: 0.152 * h, foreArm: 0.146 * h,
      thigh: 0.224 * h, shin: 0.214 * h, foot: 0.062 * h
    };
    const pelvis = { x: pose.hipX * h, y: (-0.485 + pose.hipY) * h };
    const t0 = P - pose.lean;
    const chest = pt(pelvis, t0, B.spine * pose.squash);
    const t1 = t0 - pose.chest;
    const neck = pt(chest, t1, B.neck * pose.squash);
    const t2 = t1 - pose.head;
    const head = pt(neck, t2, B.headR * 0.72);

    const fwd = { x: Math.cos(t1 - P / 2), y: -Math.sin(t1 - P / 2) };
    const sOff = 0.028 * h * bw;
    const shF = { x: neck.x + fwd.x * sOff, y: neck.y + fwd.y * sOff + 0.010 * h - pose.shrug * 0.02 * h };
    const shB = { x: neck.x - fwd.x * sOff, y: neck.y - fwd.y * sOff + 0.016 * h - pose.shrug * 0.02 * h };

    const elF = pt(shF, pose.armF[0], B.upArm);
    const haF = pt(elF, pose.armF[0] + pose.armF[1], B.foreArm);
    const elB = pt(shB, pose.armB[0], B.upArm);
    const haB = pt(elB, pose.armB[0] + pose.armB[1], B.foreArm);

    const hipF = { x: pelvis.x + 0.030 * h * bw, y: pelvis.y + 0.012 * h };
    const hipB = { x: pelvis.x - 0.030 * h * bw, y: pelvis.y + 0.012 * h };
    const knF = pt(hipF, pose.legF[0], B.thigh);
    const ftF = pt(knF, pose.legF[0] + pose.legF[1], B.shin);
    const knB = pt(hipB, pose.legB[0], B.thigh);
    const ftB = pt(knB, pose.legB[0] + pose.legB[1], B.shin);

    const wA = pose.armF[0] + pose.armF[1] + pose.wRot;
    return {
      h: h, B: B, pose: pose,
      pelvis: pelvis, chest: chest, neck: neck, head: head, headR: B.headR,
      shF: shF, elF: elF, haF: haF, shB: shB, elB: elB, haB: haB,
      hipF: hipF, knF: knF, ftF: ftF, hipB: hipB, knB: knB, ftB: ftB,
      footLen: B.foot,
      weapon: { x: haF.x, y: haF.y, a: P / 2 - wA, rawA: wA },
      bodyRot: pose.bodyRot, squash: pose.squash
    };
  };
})(window.SB);
