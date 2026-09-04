#!/usr/bin/env node
/* ORION CLIENT — logo rasteriser.
 *
 * Draws the Orion mark as a pixel grid and emits crisp-edged SVG: a wide
 * indigo nova diamond with a four-point white core, a thin vertical spike
 * through it, and a tilted orbital ring that passes behind the core but in
 * front of the body's dark rim.
 *
 * node tools/make-orion-logo.js > orion/assets/orion-logo.svg
 */
'use strict';

const N = 32;                 // grid is N x N pixels
const C = (N - 1) / 2;        // centre
const BODY_A = 11.5;          // diamond half-width
const BODY_B = 8.5;           // diamond half-height
const SPIKE_W = 1.2;          // vertical spike half-width
const SPIKE_H = 15.5;
const RING_DEG = -32;         // orbit tilt
const RING_A = 15.0;          // orbit half-major
const RING_B = 6.4;           // orbit half-minor
const RING_T = 1.15;          // orbit band thickness, in pixels

/* Nova body, darkest rim first. Intensity 0..1 indexes into this. */
const BODY = ['#231d4d', '#2e2661', '#413583', '#6a51b8', '#9c86dc', '#d6c9f7', '#ffffff'];
const SPIKE = '#221c49';
const RING_LO = '#6f7fdd';
const RING_HI = '#e8ecff';

const lerp = (a, b, t) => a + (b - a) * t;
const sat = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function mixHex(lo, hi, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const [r1, g1, b1] = p(lo);
  const [r2, g2, b2] = p(hi);
  const h2 = (v) => Math.round(v).toString(16).padStart(2, '0');
  return '#' + h2(lerp(r1, r2, t)) + h2(lerp(g1, g2, t)) + h2(lerp(b1, b2, t));
}

/* Body intensity: a diamond falloff lifted by a bright cross along both axes,
 * which is what gives the mark its four-point star core. */
function bodyIntensity(dx, dy) {
  const d = Math.abs(dx) / BODY_A + Math.abs(dy) / BODY_B;
  if (d > 1) return -1;
  const base = sat(1 - d) * 0.72;
  const armH = sat(1 - Math.abs(dy) / 3.2) * sat(1 - Math.abs(dx) / 10.5);
  const armV = sat(1 - Math.abs(dx) / 2.6) * sat(1 - Math.abs(dy) / 8.0);
  return sat(Math.max(base, armH * 1.2, armV * 1.2));
}

/* Distance of a point from the tilted orbit, converted from the implicit
 * ellipse value into real pixels via the gradient so the band stays a thin,
 * even line instead of fanning out at the tips. */
function ringFactor(dx, dy) {
  const t = (RING_DEG * Math.PI) / 180;
  const xr = dx * Math.cos(t) + dy * Math.sin(t);
  const yr = -dx * Math.sin(t) + dy * Math.cos(t);
  const f = (xr / RING_A) ** 2 + (yr / RING_B) ** 2 - 1;
  const grad = Math.hypot((2 * xr) / (RING_A * RING_A), (2 * yr) / (RING_B * RING_B));
  if (grad === 0) return null;
  if (Math.abs(f / grad) > RING_T) return null;
  return sat(Math.abs(xr) / RING_A);   // 0 near centre, 1 at the far tips
}

const px = [];
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const dx = x - C;
    const dy = y - C;
    let color = null;

    const bi = bodyIntensity(dx, dy);

    if (Math.abs(dx) <= SPIKE_W && Math.abs(dy) <= SPIKE_H) color = SPIKE;
    if (bi >= 0) {
      const step = Math.min(BODY.length - 1, Math.floor(bi * BODY.length));
      color = BODY[step];
    }

    /* The orbit passes behind the nova, so it only paints where the body
     * isn't — leaving the two lobes that read as an orbital ring. */
    const rf = ringFactor(dx, dy);
    if (rf !== null && bi < 0) color = mixHex(RING_LO, RING_HI, rf);

    if (color) px.push({ x, y, color });
  }
}

/* Merge horizontal runs of equal colour into single rects. */
const rects = [];
for (let y = 0; y < N; y++) {
  const row = px.filter((p) => p.y === y).sort((a, b) => a.x - b.x);
  let i = 0;
  while (i < row.length) {
    let j = i;
    while (j + 1 < row.length && row[j + 1].x === row[j].x + 1 && row[j + 1].color === row[i].color) j++;
    rects.push(`<rect x="${row[i].x}" y="${y}" width="${row[j].x - row[i].x + 1}" height="1" fill="${row[i].color}"/>`);
    i = j + 1;
  }
}

process.stdout.write(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" width="${N * 16}" height="${N * 16}" shape-rendering="crispEdges" role="img" aria-label="Orion Client">\n` +
  `<title>Orion Client</title>\n` +
  rects.join('\n') + '\n</svg>\n'
);
