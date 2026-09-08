/* ORION SKIN — the Minecraft skin layout, in one place
 *
 * A skin is a 64x64 sheet where every rectangle is the texture for one face of
 * one box. Nothing about that layout is guessable, so it is written out once
 * here and everything else — the editor's guides, the 3D preview, the part
 * navigator — reads it from this table. If a face were wrong, the preview would
 * show it immediately, which is exactly why the preview exists.
 *
 * Boxes are in Minecraft pixel units: the head is 8x8x8, the body 8x12x4.
 * Each box has a base layer and an overlay ("hat", "jacket", "sleeve",
 * "trousers") drawn very slightly larger, which is how capes of hair and
 * clothing sit on top of the body.
 *
 * The old 64x32 format had no left arm or left leg of its own — it mirrored the
 * right — so those regions are marked `wide: true` and are blank when a legacy
 * skin is loaded.
 */
window.ORION_SKIN = window.ORION_SKIN || {};
(function (NS) {
  'use strict';

  NS.SHEET = 64;

  /* faces(x, y, w, h, d) lays out the six rectangles of a box the way Mojang
   * does: the two caps sit side by side on the top row, then right, front,
   * left and back run along the row beneath. */
  function faces(x, y, w, h, d) {
    return {
      top:    { x: x + d,         y: y,     w: w, h: d },
      bottom: { x: x + d + w,     y: y,     w: w, h: d },
      right:  { x: x,             y: y + d, w: d, h: h },
      front:  { x: x + d,         y: y + d, w: w, h: h },
      left:   { x: x + d + w,     y: y + d, w: d, h: h },
      back:   { x: x + d + w + d, y: y + d, w: w, h: h }
    };
  }

  /* size is [w, h, d]; origin is the box's centre-bottom in model space, with
   * y up and the body standing on y = 0. */
  NS.PARTS = [
    { id: 'head',      label: 'Head',       size: [8, 8, 8],  origin: [0, 24, 0], uv: faces(0, 0, 8, 8, 8) },
    { id: 'hat',       label: 'Hat',        size: [8, 8, 8],  origin: [0, 24, 0], uv: faces(32, 0, 8, 8, 8), overlay: 'head', inflate: 0.5 },

    { id: 'body',      label: 'Body',       size: [8, 12, 4], origin: [0, 12, 0], uv: faces(16, 16, 8, 12, 4) },
    { id: 'jacket',    label: 'Jacket',     size: [8, 12, 4], origin: [0, 12, 0], uv: faces(16, 32, 8, 12, 4), overlay: 'body', inflate: 0.25 },

    { id: 'armR',      label: 'Right arm',  size: [4, 12, 4], origin: [-6, 12, 0], uv: faces(40, 16, 4, 12, 4) },
    { id: 'sleeveR',   label: 'Right sleeve', size: [4, 12, 4], origin: [-6, 12, 0], uv: faces(40, 32, 4, 12, 4), overlay: 'armR', inflate: 0.25 },

    { id: 'legR',      label: 'Right leg',  size: [4, 12, 4], origin: [-2, 0, 0], uv: faces(0, 16, 4, 12, 4) },
    { id: 'trouserR',  label: 'Right trouser', size: [4, 12, 4], origin: [-2, 0, 0], uv: faces(0, 32, 4, 12, 4), overlay: 'legR', inflate: 0.25 },

    /* 64x64 only. */
    { id: 'armL',      label: 'Left arm',   size: [4, 12, 4], origin: [6, 12, 0], uv: faces(32, 48, 4, 12, 4), wide: true },
    { id: 'sleeveL',   label: 'Left sleeve', size: [4, 12, 4], origin: [6, 12, 0], uv: faces(48, 48, 4, 12, 4), overlay: 'armL', inflate: 0.25, wide: true },

    { id: 'legL',      label: 'Left leg',   size: [4, 12, 4], origin: [2, 0, 0], uv: faces(16, 48, 4, 12, 4), wide: true },
    { id: 'trouserL',  label: 'Left trouser', size: [4, 12, 4], origin: [2, 0, 0], uv: faces(0, 48, 4, 12, 4), overlay: 'legL', inflate: 0.25, wide: true }
  ];

  NS.part = (id) => NS.PARTS.find((p) => p.id === id) || null;
  NS.bases = () => NS.PARTS.filter((p) => !p.overlay);

  /* Every rectangle the layout actually uses, for drawing guides and for
   * telling a stray pixel from one that belongs to a face. */
  NS.rects = function () {
    const out = [];
    NS.PARTS.forEach(function (p) {
      Object.keys(p.uv).forEach(function (face) {
        out.push(Object.assign({ part: p.id, face: face, label: p.label, wide: !!p.wide, overlay: !!p.overlay }, p.uv[face]));
      });
    });
    return out;
  };

  /* Which face, if any, a sheet pixel belongs to. */
  NS.at = function (x, y) {
    const hit = NS.rects().find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    return hit || null;
  };

  /* The bounding box of a part across all six faces, so the editor can frame
   * one limb at a time. */
  NS.bounds = function (id) {
    const p = NS.part(id);
    if (!p) return null;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    Object.values(p.uv).forEach(function (r) {
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  };
})(window.ORION_SKIN);
