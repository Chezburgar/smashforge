/* DEADEYE — weapon definitions
 *
 * Pure data. Three consumers read this file:
 *   viewmodel.js  — builds the first-person model from `model.parts`
 *   player.js     — firing, recoil, spread, reload timing
 *   audio.js      — the `sound` block drives the gunshot synthesiser
 *
 * Damage is tuned around 100 HP. The comment on each weapon gives the
 * resulting body-shot time-to-kill so the balance stays legible when editing.
 */
( function( global ) {
"use strict";

var DE = global.DE = global.DE || {};

/* Recoil patterns are sampled per shot index and clamped at the end, so a long
 * spray walks a learnable path rather than climbing forever. Values are
 * [ horizontal, vertical ] in degrees. */
function pattern( pts ) { return pts; }

/* Shared palette so all the guns read as one armoury. */
var C = {
	body:    0x33383f,
	bodyLt:  0x454b54,
	dark:    0x22262b,
	rail:    0x2c3138,
	grip:    0x2a2d33,
	furn:    0x6a5236,   // wood furniture
	metal:   0x8d949c,
	brass:   0xb08d42,
	glass:   0x7fd4e8,
	accent:  0xc8503a
};

var WEAPONS = {

/* ---------------------------------------------------------------- */
rk77: {
	id: "rk77", name: "RK-77", short: "RK77", cls: "Assault Rifle", slot: 0,
	damage: 28, headMult: 2.0, limbMult: 0.85,      // 4 shots ≈ 290ms TTK
	rpm: 620, auto: true, pellets: 1,
	magSize: 30, reserve: 210, reloadTime: 2.15, reloadEmpty: 2.75, reloadType: "mag",
	falloffStart: 26, falloffEnd: 60, falloffMin: 0.62,
	spreadHip: 2.4, spreadMove: 2.9, spreadADS: 0.18, spreadJump: 6.5,
	spreadGrow: 0.30, spreadMax: 5.4, spreadRecover: 5.5,
	recoilV: 0.62, recoilH: 0.30, recoilRecover: 9.0, kick: 0.030,
	pattern: pattern( [ [ 0, 1 ], [ -0.1, 1 ], [ 0.15, 0.95 ], [ 0.3, 0.85 ],
	                    [ 0.5, 0.7 ], [ 0.6, 0.55 ], [ 0.45, 0.45 ], [ 0.1, 0.4 ],
	                    [ -0.35, 0.4 ], [ -0.7, 0.35 ], [ -0.8, 0.3 ], [ -0.5, 0.3 ] ] ),
	adsTime: 0.22, adsFov: 55, moveMult: 1.0, adsMoveMult: 0.52, switchTime: 0.5,
	bulletSpeed: 380,
	sound: { level: 1.0, bright: 2400, decay: 0.145, thump: 150, crack: 0.30, q: 1.1, action: 1 },
	crosshair: { gap: 7, len: 7, thick: 2 },
	model: {
		muzzle: [ 0, 0.012, -0.62 ], eject: [ 0.05, 0.01, -0.10 ],
		parts: [
			{ n: "receiver", x: 0, y: 0, z: -0.10, w: 0.075, h: 0.10, d: 0.42, c: C.body },
			{ n: "upper",    x: 0, y: 0.058, z: -0.13, w: 0.062, h: 0.045, d: 0.40, c: C.bodyLt },
			{ n: "barrel",   x: 0, y: 0.012, z: -0.46, w: 0.032, h: 0.032, d: 0.30, c: C.dark },
			{ n: "muzzle",   x: 0, y: 0.012, z: -0.60, w: 0.046, h: 0.046, d: 0.075, c: C.dark },
			{ n: "handguard",x: 0, y: 0.008, z: -0.36, w: 0.058, h: 0.062, d: 0.22, c: C.rail },
			{ n: "mag",      x: 0, y: -0.115, z: -0.10, w: 0.048, h: 0.17, d: 0.10, c: C.dark,
			  curve: true },
			{ n: "grip",     x: 0, y: -0.105, z: 0.045, w: 0.046, h: 0.15, d: 0.075, c: C.grip,
			  tilt: 0.22 },
			{ n: "stock",    x: 0, y: -0.005, z: 0.20, w: 0.05, h: 0.085, d: 0.24, c: C.body },
			{ n: "cheek",    x: 0, y: 0.05, z: 0.20, w: 0.045, h: 0.035, d: 0.20, c: C.bodyLt },
			{ n: "bolt",     x: 0.042, y: 0.052, z: -0.02, w: 0.018, h: 0.022, d: 0.09, c: C.metal },
			{ n: "sightF",   x: 0, y: 0.085, z: -0.44, w: 0.012, h: 0.05, d: 0.014, c: C.metal },
			{ n: "sightR",   x: 0, y: 0.085, z: 0.02, w: 0.05, h: 0.04, d: 0.016, c: C.metal,
			  hollow: true },
			{ n: "optic",    x: 0, y: 0.10, z: -0.06, w: 0.05, h: 0.05, d: 0.13, c: C.dark },
			{ n: "lens",     x: 0, y: 0.10, z: -0.126, w: 0.036, h: 0.036, d: 0.012, c: C.glass,
			  glow: true }
		]
	}
},

/* ---------------------------------------------------------------- */
vector9: {
	id: "vector9", name: "VECTOR-9", short: "VEC9", cls: "SMG", slot: 0,
	damage: 22, headMult: 1.9, limbMult: 0.9,       // 5 shots ≈ 267ms TTK
	rpm: 900, auto: true, pellets: 1,
	magSize: 32, reserve: 224, reloadTime: 1.85, reloadEmpty: 2.35, reloadType: "mag",
	falloffStart: 14, falloffEnd: 34, falloffMin: 0.5,
	spreadHip: 2.0, spreadMove: 2.3, spreadADS: 0.32, spreadJump: 5.5,
	spreadGrow: 0.26, spreadMax: 5.0, spreadRecover: 7.0,
	recoilV: 0.44, recoilH: 0.34, recoilRecover: 11.0, kick: 0.022,
	pattern: pattern( [ [ 0, 1 ], [ 0.15, 0.95 ], [ -0.2, 0.9 ], [ -0.45, 0.8 ],
	                    [ -0.5, 0.6 ], [ -0.2, 0.5 ], [ 0.3, 0.45 ], [ 0.7, 0.4 ],
	                    [ 0.85, 0.35 ], [ 0.6, 0.3 ] ] ),
	adsTime: 0.16, adsFov: 62, moveMult: 1.10, adsMoveMult: 0.68, switchTime: 0.4,
	bulletSpeed: 340,
	sound: { level: 0.82, bright: 1950, decay: 0.10, thump: 132, crack: 0.18, q: 1.3, action: 1.2 },
	crosshair: { gap: 8, len: 6, thick: 2 },
	model: {
		muzzle: [ 0, 0.01, -0.42 ], eject: [ 0.045, 0.012, -0.06 ],
		parts: [
			{ n: "receiver", x: 0, y: 0, z: -0.08, w: 0.07, h: 0.098, d: 0.34, c: C.body },
			{ n: "upper",    x: 0, y: 0.056, z: -0.10, w: 0.058, h: 0.04, d: 0.32, c: C.bodyLt },
			{ n: "barrel",   x: 0, y: 0.01, z: -0.30, w: 0.028, h: 0.028, d: 0.18, c: C.dark },
			{ n: "muzzle",   x: 0, y: 0.01, z: -0.40, w: 0.042, h: 0.042, d: 0.06, c: C.dark },
			{ n: "handguard",x: 0, y: 0.004, z: -0.25, w: 0.054, h: 0.058, d: 0.16, c: C.rail },
			{ n: "foregrip", x: 0, y: -0.085, z: -0.24, w: 0.04, h: 0.11, d: 0.05, c: C.grip },
			{ n: "mag",      x: 0, y: -0.125, z: -0.04, w: 0.042, h: 0.19, d: 0.075, c: C.dark },
			{ n: "grip",     x: 0, y: -0.10, z: 0.055, w: 0.044, h: 0.14, d: 0.07, c: C.grip,
			  tilt: 0.2 },
			{ n: "stock",    x: 0, y: 0.015, z: 0.16, w: 0.042, h: 0.06, d: 0.16, c: C.dark },
			{ n: "bolt",     x: 0.04, y: 0.05, z: 0.0, w: 0.016, h: 0.02, d: 0.08, c: C.metal },
			{ n: "sightF",   x: 0, y: 0.082, z: -0.28, w: 0.011, h: 0.042, d: 0.013, c: C.metal },
			{ n: "sightR",   x: 0, y: 0.082, z: 0.04, w: 0.046, h: 0.036, d: 0.015, c: C.metal,
			  hollow: true },
			{ n: "optic",    x: 0, y: 0.098, z: -0.04, w: 0.046, h: 0.046, d: 0.10, c: C.dark },
			{ n: "lens",     x: 0, y: 0.098, z: -0.092, w: 0.032, h: 0.032, d: 0.01, c: C.glass,
			  glow: true }
		]
	}
},

/* ---------------------------------------------------------------- */
breach12: {
	id: "breach12", name: "BREACH-12", short: "BR12", cls: "Shotgun", slot: 0,
	damage: 12, headMult: 1.5, limbMult: 1.0,       // 9 pellets = 108 point blank
	rpm: 75, auto: false, pellets: 9, pump: 0.62,
	magSize: 6, reserve: 48, reloadTime: 0.52, reloadType: "shell", reloadFirst: 0.35,
	falloffStart: 7, falloffEnd: 22, falloffMin: 0.18,
	spreadHip: 4.6, spreadMove: 5.2, spreadADS: 3.2, spreadJump: 7.5,
	spreadGrow: 0, spreadMax: 6.0, spreadRecover: 6.0,
	recoilV: 2.6, recoilH: 0.5, recoilRecover: 6.5, kick: 0.11,
	adsTime: 0.24, adsFov: 64, moveMult: 0.96, adsMoveMult: 0.55, switchTime: 0.55,
	bulletSpeed: 260,
	sound: { level: 1.3, bright: 1300, decay: 0.32, thump: 82, crack: 0.10, q: 0.75 },
	crosshair: { gap: 14, len: 8, thick: 2 },
	model: {
		muzzle: [ 0, 0.014, -0.60 ], eject: [ 0.05, 0.0, -0.08 ],
		parts: [
			{ n: "receiver", x: 0, y: 0, z: -0.06, w: 0.072, h: 0.105, d: 0.32, c: C.body },
			{ n: "barrel",   x: 0, y: 0.032, z: -0.40, w: 0.044, h: 0.044, d: 0.44, c: C.dark },
			{ n: "tube",     x: 0, y: -0.022, z: -0.38, w: 0.038, h: 0.038, d: 0.40, c: C.metal },
			{ n: "pump",     x: 0, y: -0.022, z: -0.30, w: 0.062, h: 0.062, d: 0.15, c: C.furn },
			{ n: "grip",     x: 0, y: -0.095, z: 0.07, w: 0.046, h: 0.14, d: 0.075, c: C.furn,
			  tilt: 0.25 },
			{ n: "stock",    x: 0, y: -0.01, z: 0.22, w: 0.05, h: 0.10, d: 0.26, c: C.furn },
			{ n: "cheek",    x: 0, y: 0.055, z: 0.20, w: 0.046, h: 0.03, d: 0.20, c: C.furn },
			{ n: "sightF",   x: 0, y: 0.062, z: -0.58, w: 0.014, h: 0.026, d: 0.014, c: C.brass },
			{ n: "shellPort",x: 0.038, y: 0.0, z: -0.02, w: 0.014, h: 0.03, d: 0.09, c: C.dark }
		]
	}
},

/* ---------------------------------------------------------------- */
longbow: {
	id: "longbow", name: "LONGBOW", short: "LB", cls: "Sniper", slot: 0,
	damage: 100, headMult: 1.5, limbMult: 0.55,     // one-shot to the chest
	rpm: 45, auto: false, pellets: 1, bolt: 1.05,
	magSize: 5, reserve: 30, reloadTime: 2.9, reloadEmpty: 3.3, reloadType: "mag",
	falloffStart: 90, falloffEnd: 150, falloffMin: 0.8,
	spreadHip: 6.5, spreadMove: 7.5, spreadADS: 0.0, spreadJump: 10,
	spreadGrow: 0, spreadMax: 8, spreadRecover: 4,
	recoilV: 3.4, recoilH: 0.4, recoilRecover: 5.0, kick: 0.14,
	adsTime: 0.34, adsFov: 18, scope: true, moveMult: 0.92, adsMoveMult: 0.32,
	switchTime: 0.7, bulletSpeed: 620,
	sound: { level: 1.45, bright: 3000, decay: 0.42, thump: 96, crack: 0.55, q: 0.9 },
	crosshair: { gap: 12, len: 10, thick: 1 },
	model: {
		muzzle: [ 0, 0.012, -0.80 ], eject: [ 0.05, 0.02, -0.02 ],
		parts: [
			{ n: "receiver", x: 0, y: 0, z: -0.04, w: 0.07, h: 0.10, d: 0.36, c: C.body },
			{ n: "barrel",   x: 0, y: 0.012, z: -0.48, w: 0.034, h: 0.034, d: 0.56, c: C.dark },
			{ n: "muzzle",   x: 0, y: 0.012, z: -0.78, w: 0.05, h: 0.05, d: 0.09, c: C.dark },
			{ n: "handguard",x: 0, y: 0.004, z: -0.30, w: 0.056, h: 0.06, d: 0.26, c: C.rail },
			{ n: "bipodL",   x: -0.05, y: -0.09, z: -0.40, w: 0.014, h: 0.13, d: 0.014, c: C.metal,
			  tilt: -0.3 },
			{ n: "bipodR",   x: 0.05, y: -0.09, z: -0.40, w: 0.014, h: 0.13, d: 0.014, c: C.metal,
			  tilt: 0.3 },
			{ n: "mag",      x: 0, y: -0.10, z: -0.06, w: 0.045, h: 0.11, d: 0.09, c: C.dark },
			{ n: "grip",     x: 0, y: -0.10, z: 0.08, w: 0.046, h: 0.145, d: 0.075, c: C.grip,
			  tilt: 0.2 },
			{ n: "stock",    x: 0, y: -0.01, z: 0.24, w: 0.05, h: 0.11, d: 0.28, c: C.body },
			{ n: "cheek",    x: 0, y: 0.062, z: 0.22, w: 0.048, h: 0.04, d: 0.22, c: C.bodyLt },
			{ n: "bolt",     x: 0.05, y: 0.03, z: 0.04, w: 0.02, h: 0.02, d: 0.10, c: C.metal },
			{ n: "boltKnob", x: 0.075, y: 0.03, z: 0.08, w: 0.032, h: 0.032, d: 0.032, c: C.metal },
			{ n: "scopeR",   x: 0, y: 0.115, z: 0.02, w: 0.06, h: 0.06, d: 0.14, c: C.dark },
			{ n: "scopeF",   x: 0, y: 0.115, z: -0.16, w: 0.052, h: 0.052, d: 0.16, c: C.dark },
			{ n: "scopeTube",x: 0, y: 0.115, z: -0.07, w: 0.038, h: 0.038, d: 0.10, c: C.dark },
			{ n: "lens",     x: 0, y: 0.115, z: -0.242, w: 0.044, h: 0.044, d: 0.012, c: C.glass,
			  glow: true },
			{ n: "ringF",    x: 0, y: 0.115, z: -0.14, w: 0.058, h: 0.058, d: 0.022, c: C.rail },
			{ n: "ringR",    x: 0, y: 0.115, z: 0.0, w: 0.058, h: 0.058, d: 0.022, c: C.rail }
		]
	}
},

/* ---------------------------------------------------------------- */
m14: {
	id: "m14", name: "MARKSMAN", short: "MK", cls: "DMR", slot: 0,
	damage: 45, headMult: 2.0, limbMult: 0.8,       // 3 shots ≈ 343ms TTK
	rpm: 340, auto: false, pellets: 1,
	magSize: 12, reserve: 96, reloadTime: 2.25, reloadEmpty: 2.8, reloadType: "mag",
	falloffStart: 48, falloffEnd: 95, falloffMin: 0.72,
	spreadHip: 3.0, spreadMove: 3.6, spreadADS: 0.05, spreadJump: 7,
	spreadGrow: 0.5, spreadMax: 4.5, spreadRecover: 6.0,
	recoilV: 1.35, recoilH: 0.34, recoilRecover: 7.5, kick: 0.055,
	adsTime: 0.26, adsFov: 34, moveMult: 0.97, adsMoveMult: 0.46, switchTime: 0.55,
	bulletSpeed: 520,
	sound: { level: 1.08, bright: 2600, decay: 0.20, thump: 128, crack: 0.38, q: 1.0 },
	crosshair: { gap: 9, len: 8, thick: 2 },
	model: {
		muzzle: [ 0, 0.012, -0.68 ], eject: [ 0.05, 0.02, -0.04 ],
		parts: [
			{ n: "receiver", x: 0, y: 0, z: -0.06, w: 0.07, h: 0.10, d: 0.36, c: C.body },
			{ n: "barrel",   x: 0, y: 0.014, z: -0.44, w: 0.03, h: 0.03, d: 0.44, c: C.dark },
			{ n: "muzzle",   x: 0, y: 0.014, z: -0.66, w: 0.042, h: 0.042, d: 0.07, c: C.dark },
			{ n: "handguard",x: 0, y: 0.006, z: -0.30, w: 0.056, h: 0.062, d: 0.26, c: C.furn },
			{ n: "mag",      x: 0, y: -0.115, z: -0.06, w: 0.044, h: 0.16, d: 0.085, c: C.dark },
			{ n: "grip",     x: 0, y: -0.095, z: 0.07, w: 0.045, h: 0.135, d: 0.07, c: C.furn,
			  tilt: 0.22 },
			{ n: "stock",    x: 0, y: -0.008, z: 0.22, w: 0.05, h: 0.10, d: 0.26, c: C.furn },
			{ n: "cheek",    x: 0, y: 0.058, z: 0.20, w: 0.046, h: 0.032, d: 0.20, c: C.furn },
			{ n: "scopeR",   x: 0, y: 0.108, z: 0.0, w: 0.052, h: 0.052, d: 0.11, c: C.dark },
			{ n: "scopeF",   x: 0, y: 0.108, z: -0.13, w: 0.046, h: 0.046, d: 0.12, c: C.dark },
			{ n: "lens",     x: 0, y: 0.108, z: -0.192, w: 0.038, h: 0.038, d: 0.01, c: C.glass,
			  glow: true },
			{ n: "bolt",     x: 0.042, y: 0.045, z: 0.0, w: 0.018, h: 0.022, d: 0.08, c: C.metal }
		]
	}
},

/* ---------------------------------------------------------------- */
saw60: {
	id: "saw60", name: "SAW-60", short: "SAW", cls: "LMG", slot: 0,
	damage: 26, headMult: 1.8, limbMult: 0.85,      // 4 shots ≈ 240ms TTK
	rpm: 750, auto: true, pellets: 1,
	magSize: 75, reserve: 225, reloadTime: 4.4, reloadEmpty: 4.9, reloadType: "mag",
	falloffStart: 30, falloffEnd: 70, falloffMin: 0.6,
	spreadHip: 4.2, spreadMove: 5.0, spreadADS: 0.42, spreadJump: 9,
	spreadGrow: 0.20, spreadMax: 6.5, spreadRecover: 4.0,
	recoilV: 0.52, recoilH: 0.44, recoilRecover: 7.0, kick: 0.034,
	pattern: pattern( [ [ 0, 1 ], [ 0.2, 1 ], [ 0.45, 0.9 ], [ 0.55, 0.8 ], [ 0.3, 0.65 ],
	                    [ -0.2, 0.55 ], [ -0.6, 0.5 ], [ -0.85, 0.45 ], [ -0.7, 0.4 ],
	                    [ -0.25, 0.35 ], [ 0.35, 0.35 ], [ 0.8, 0.3 ], [ 0.9, 0.3 ],
	                    [ 0.5, 0.25 ], [ -0.1, 0.25 ] ] ),
	adsTime: 0.36, adsFov: 58, moveMult: 0.82, adsMoveMult: 0.36, switchTime: 0.85,
	bulletSpeed: 400,
	sound: { level: 1.12, bright: 2100, decay: 0.175, thump: 118, crack: 0.32, q: 1.0, action: 1.4 },
	crosshair: { gap: 11, len: 8, thick: 2 },
	model: {
		muzzle: [ 0, 0.014, -0.70 ], eject: [ 0.055, -0.01, -0.10 ],
		parts: [
			{ n: "receiver", x: 0, y: 0, z: -0.10, w: 0.082, h: 0.115, d: 0.44, c: C.body },
			{ n: "upper",    x: 0, y: 0.066, z: -0.12, w: 0.07, h: 0.05, d: 0.42, c: C.bodyLt },
			{ n: "barrel",   x: 0, y: 0.014, z: -0.50, w: 0.038, h: 0.038, d: 0.42, c: C.dark },
			{ n: "muzzle",   x: 0, y: 0.014, z: -0.685, w: 0.05, h: 0.05, d: 0.085, c: C.dark },
			{ n: "heatgd",   x: 0, y: 0.014, z: -0.40, w: 0.056, h: 0.056, d: 0.20, c: C.rail,
			  vents: true },
			{ n: "box",      x: 0, y: -0.135, z: -0.06, w: 0.09, h: 0.17, d: 0.20, c: C.dark },
			{ n: "belt",     x: 0.05, y: -0.03, z: -0.06, w: 0.03, h: 0.05, d: 0.14, c: C.brass },
			{ n: "grip",     x: 0, y: -0.105, z: 0.10, w: 0.048, h: 0.15, d: 0.078, c: C.grip,
			  tilt: 0.2 },
			{ n: "bipodL",   x: -0.055, y: -0.10, z: -0.44, w: 0.015, h: 0.15, d: 0.015, c: C.metal,
			  tilt: -0.32 },
			{ n: "bipodR",   x: 0.055, y: -0.10, z: -0.44, w: 0.015, h: 0.15, d: 0.015, c: C.metal,
			  tilt: 0.32 },
			{ n: "stock",    x: 0, y: -0.005, z: 0.24, w: 0.055, h: 0.10, d: 0.26, c: C.body },
			{ n: "carry",    x: 0, y: 0.10, z: -0.32, w: 0.03, h: 0.03, d: 0.20, c: C.rail },
			{ n: "sightR",   x: 0, y: 0.10, z: 0.02, w: 0.05, h: 0.042, d: 0.016, c: C.metal,
			  hollow: true },
			{ n: "sightF",   x: 0, y: 0.10, z: -0.50, w: 0.013, h: 0.05, d: 0.014, c: C.metal }
		]
	}
},

/* ---------------------------------------------------------------- */
p9: {
	id: "p9", name: "SIDEARM P9", short: "P9", cls: "Pistol", slot: 1,
	damage: 30, headMult: 2.0, limbMult: 0.85,      // 4 shots
	rpm: 420, auto: false, pellets: 1,
	magSize: 15, reserve: 90, reloadTime: 1.5, reloadEmpty: 1.95, reloadType: "mag",
	falloffStart: 16, falloffEnd: 40, falloffMin: 0.5,
	spreadHip: 1.8, spreadMove: 2.4, spreadADS: 0.22, spreadJump: 5,
	spreadGrow: 0.4, spreadMax: 4.5, spreadRecover: 8.0,
	recoilV: 0.9, recoilH: 0.3, recoilRecover: 10.0, kick: 0.036,
	adsTime: 0.16, adsFov: 62, moveMult: 1.14, adsMoveMult: 0.78, switchTime: 0.3,
	bulletSpeed: 320,
	sound: { level: 0.78, bright: 2250, decay: 0.105, thump: 168, crack: 0.16, q: 1.2, action: 0.8 },
	crosshair: { gap: 7, len: 6, thick: 2 },
	model: {
		muzzle: [ 0, 0.018, -0.20 ], eject: [ 0.035, 0.024, -0.02 ],
		parts: [
			{ n: "slide",    x: 0, y: 0.026, z: -0.06, w: 0.042, h: 0.05, d: 0.26, c: C.bodyLt },
			{ n: "frame",    x: 0, y: -0.012, z: -0.04, w: 0.04, h: 0.035, d: 0.20, c: C.body },
			{ n: "grip",     x: 0, y: -0.11, z: 0.05, w: 0.042, h: 0.135, d: 0.062, c: C.grip,
			  tilt: 0.22 },
			{ n: "mag",      x: 0, y: -0.115, z: 0.05, w: 0.032, h: 0.13, d: 0.05, c: C.dark,
			  tilt: 0.22 },
			{ n: "trigger",  x: 0, y: -0.042, z: 0.008, w: 0.014, h: 0.03, d: 0.014, c: C.metal },
			{ n: "guard",    x: 0, y: -0.05, z: 0.005, w: 0.03, h: 0.05, d: 0.06, c: C.body,
			  hollow: true },
			{ n: "sightF",   x: 0, y: 0.056, z: -0.175, w: 0.008, h: 0.014, d: 0.01, c: C.metal },
			{ n: "sightR",   x: 0, y: 0.056, z: 0.05, w: 0.03, h: 0.014, d: 0.012, c: C.metal,
			  hollow: true }
		]
	}
},

/* ---------------------------------------------------------------- */
hcannon: {
	id: "hcannon", name: "HAND CANNON", short: "HC", cls: "Revolver", slot: 1,
	damage: 62, headMult: 1.8, limbMult: 0.7,       // 2 shots
	rpm: 150, auto: false, pellets: 1,
	magSize: 6, reserve: 36, reloadTime: 2.5, reloadType: "mag",
	falloffStart: 22, falloffEnd: 50, falloffMin: 0.55,
	spreadHip: 2.6, spreadMove: 3.4, spreadADS: 0.15, spreadJump: 6,
	spreadGrow: 0.6, spreadMax: 5.0, spreadRecover: 6.5,
	recoilV: 2.4, recoilH: 0.5, recoilRecover: 6.0, kick: 0.095,
	adsTime: 0.22, adsFov: 55, moveMult: 1.05, adsMoveMult: 0.6, switchTime: 0.45,
	bulletSpeed: 380,
	sound: { level: 1.2, bright: 2500, decay: 0.25, thump: 108, crack: 0.32, q: 0.95 },
	crosshair: { gap: 9, len: 7, thick: 2 },
	model: {
		muzzle: [ 0, 0.02, -0.30 ], eject: null,
		parts: [
			{ n: "barrel",   x: 0, y: 0.024, z: -0.18, w: 0.036, h: 0.046, d: 0.26, c: C.bodyLt },
			{ n: "rib",      x: 0, y: 0.05, z: -0.18, w: 0.018, h: 0.012, d: 0.24, c: C.body },
			{ n: "frame",    x: 0, y: 0.012, z: -0.01, w: 0.04, h: 0.07, d: 0.12, c: C.body },
			{ n: "cyl",      x: 0, y: 0.012, z: -0.03, w: 0.062, h: 0.062, d: 0.09, c: C.metal,
			  round: true },
			{ n: "grip",     x: 0, y: -0.10, z: 0.06, w: 0.042, h: 0.14, d: 0.07, c: C.furn,
			  tilt: 0.28 },
			{ n: "hammer",   x: 0, y: 0.056, z: 0.05, w: 0.016, h: 0.028, d: 0.024, c: C.dark },
			{ n: "guard",    x: 0, y: -0.045, z: 0.02, w: 0.03, h: 0.05, d: 0.06, c: C.body,
			  hollow: true },
			{ n: "sightF",   x: 0, y: 0.062, z: -0.29, w: 0.008, h: 0.018, d: 0.01, c: C.metal }
		]
	}
},

/* ---------------------------------------------------------------- */
knife: {
	id: "knife", name: "COMBAT KNIFE", short: "KNF", cls: "Melee", slot: 2,
	damage: 55, backstab: 100, headMult: 1.0, limbMult: 1.0,
	rpm: 110, auto: false, melee: true, range: 2.4, pellets: 0,
	magSize: 0, reserve: 0, reloadTime: 0, reloadType: "none",
	falloffStart: 2, falloffEnd: 2.4, falloffMin: 1,
	spreadHip: 0, spreadMove: 0, spreadADS: 0, spreadJump: 0,
	spreadGrow: 0, spreadMax: 0, spreadRecover: 1,
	recoilV: 0, recoilH: 0, recoilRecover: 10, kick: 0,
	adsTime: 0.14, adsFov: 70, moveMult: 1.22, adsMoveMult: 1.15, switchTime: 0.25,
	sound: { level: 0.5, bright: 3200, decay: 0.08, thump: 200, crack: 0.1 },
	crosshair: { gap: 6, len: 5, thick: 2 },
	model: {
		muzzle: [ 0, 0, -0.3 ], eject: null,
		parts: [
			{ n: "blade",    x: 0, y: 0.01, z: -0.17, w: 0.022, h: 0.05, d: 0.26, c: 0xc3cbd4,
			  blade: true },
			{ n: "guard",    x: 0, y: 0.005, z: -0.02, w: 0.07, h: 0.02, d: 0.022, c: C.dark },
			{ n: "handle",   x: 0, y: -0.002, z: 0.07, w: 0.03, h: 0.036, d: 0.16, c: C.grip },
			{ n: "pommel",   x: 0, y: -0.002, z: 0.155, w: 0.034, h: 0.04, d: 0.03, c: C.dark }
		]
	}
},

/* ---------------------------------------------------------------- */
frag: {
	id: "frag", name: "FRAG", short: "FRAG", cls: "Grenade", slot: 3,
	damage: 120, radius: 6.0, fuse: 2.6, throwSpeed: 18, count: 2,
	headMult: 1, limbMult: 1, rpm: 60, auto: false, grenade: true, pellets: 0,
	magSize: 0, reserve: 0, reloadTime: 0, reloadType: "none",
	falloffStart: 0, falloffEnd: 6, falloffMin: 0.15,
	spreadHip: 0, spreadMove: 0, spreadADS: 0, spreadJump: 0,
	spreadGrow: 0, spreadMax: 0, spreadRecover: 1,
	recoilV: 0, recoilH: 0, recoilRecover: 10, kick: 0,
	adsTime: 0.2, adsFov: 68, moveMult: 1.1, adsMoveMult: 1.0, switchTime: 0.35,
	sound: { level: 0.6, bright: 1200, decay: 0.1, thump: 150, crack: 0 },
	crosshair: { gap: 10, len: 6, thick: 2 },
	model: {
		muzzle: [ 0, 0, -0.1 ], eject: null,
		parts: [
			{ n: "body",   x: 0, y: 0, z: -0.04, w: 0.075, h: 0.105, d: 0.075, c: 0x46543c,
			  round: true },
			{ n: "top",    x: 0, y: 0.062, z: -0.04, w: 0.045, h: 0.03, d: 0.045, c: 0x6b6b60 },
			{ n: "lever",  x: 0.03, y: 0.05, z: -0.04, w: 0.012, h: 0.075, d: 0.02, c: 0x8d949c },
			{ n: "pin",    x: 0, y: 0.082, z: -0.04, w: 0.032, h: 0.008, d: 0.032, c: 0xb0a060,
			  round: true }
		]
	}
}

};

/* Weapons offered in the loadout screen, in menu order. */
DE.PRIMARIES = [ "rk77", "vector9", "breach12", "longbow", "m14", "saw60" ];
DE.SECONDARIES = [ "p9", "hcannon" ];

DE.WEAPONS = WEAPONS;

/* Seconds between shots, derived once. */
Object.keys( WEAPONS ).forEach( function( k ) {
	var w = WEAPONS[ k ];
	w.interval = 60 / w.rpm;
	if ( w.pump ) w.interval = Math.max( w.interval, w.pump );
	if ( w.bolt ) w.interval = Math.max( w.interval, w.bolt );
	w.reloadEmpty = w.reloadEmpty || w.reloadTime;
} );

/* Damage after range falloff. */
DE.falloff = function( w, dist ) {
	if ( dist <= w.falloffStart ) return 1;
	if ( dist >= w.falloffEnd ) return w.falloffMin;
	var t = ( dist - w.falloffStart ) / ( w.falloffEnd - w.falloffStart );
	return 1 + ( w.falloffMin - 1 ) * t;
};

} )( window );
