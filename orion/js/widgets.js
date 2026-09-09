/* ORION CLIENT — borrowing the client's own button sheet
 *
 * The theme restyles the menu buttons, and the buttons live in
 * textures/gui/widgets.png. So does a lot else: the hotbar at (0,0,182,22),
 * the selected-slot outline at (0,22,24,24), and — in EaglercraftX
 * specifically — the little globe and padlock icons the multiplayer server
 * list draws. A pack replaces a whole file, so a widgets.png with only
 * buttons in it wipes all of that out. That is exactly what an earlier
 * version of the theme did: it restyled the buttons and quietly took the
 * hotbar with it.
 *
 * The fix is to keep the client's own sheet and paint over only the three
 * button strips. Which needs a copy of that sheet — and rather than commit
 * one, Orion takes it from the client already installed here, so it is always
 * the right sheet for the right build and no artwork is redistributed.
 *
 * How: the client turns every PNG into pixels by drawing it into a canvas and
 * calling getImageData. Hooking that during launch hands us every texture it
 * decodes. The hook cannot see file names, so widgets.png is recognised by
 * what is in it — the three button greys, and transparency just right of where
 * the hotbar ends. Those four probes are enough to tell it from every other
 * 256x256 texture the client loads, which was checked against the lot.
 *
 * Captured once, kept in localStorage, and the hook removes itself. If it has
 * never been captured — a browser that has not launched the game yet — the
 * theme leaves widgets.png out of the pack entirely and says so, rather than
 * shipping a sheet with holes in it.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const W = {};
  O.Widgets = W;

  /* Keyed by build: 1.8 and 1.12.2 do not have the same sheet, and using one
   * for the other would put the wrong hotbar in the pack. */
  const KEY = 'orion.widgets.v1';
  const keyFor = (version) => KEY + '.' + (version || '1.8');

  /* Points inside regions that vanilla fills with flat colour, and one just
   * past the end of the hotbar that has to be transparent. */
  const PROBES = [
    { x: 100, y: 76, rgba: [112, 112, 112, 255] },   /* button, normal */
    { x: 100, y: 96, rgba: [128, 138, 192, 255] },   /* button, hovered */
    { x: 100, y: 56, rgba: [45, 45, 45, 255] },      /* button, disabled */
    { x: 190, y: 10, rgba: [0, 0, 0, 0] }            /* right of the hotbar */
  ];
  const TOLERANCE = 26;

  function looksLikeWidgets(data, w, h) {
    if (w !== 256 || h !== 256) return false;
    for (const probe of PROBES) {
      const i = ((probe.y * w) + probe.x) * 4;
      const want = probe.rgba;
      /* Alpha first: a transparent probe against an opaque pixel is a instant
       * no, and it is what rules out most other sheets. */
      if (Math.abs(data[i + 3] - want[3]) > TOLERANCE) return false;
      if (want[3] === 0) continue;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(data[i + k] - want[k]) > TOLERANCE) return false;
      }
    }
    return true;
  }

  W.cached = function (version) {
    try {
      return localStorage.getItem(keyFor(version));
    } catch (e) {
      return null;
    }
  };

  W.forget = function (version) {
    try { localStorage.removeItem(keyFor(version)); } catch (e) { /* nothing to do */ }
  };

  /* The cached sheet as something drawable. */
  W.load = function (version) {
    const url = W.cached(version);
    if (!url) return Promise.resolve(null);
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  let installed = false;
  let original = null;

  W.install = function (version) {
    if (installed || W.cached(version)) return false;
    if (typeof CanvasRenderingContext2D === 'undefined') return false;
    const key = keyFor(version);

    original = CanvasRenderingContext2D.prototype.getImageData;
    const proto = CanvasRenderingContext2D.prototype;

    proto.getImageData = function (x, y, w, h) {
      const out = original.apply(this, arguments);
      /* Wrapped in its own try: a failure here must never take the game with
       * it, and this runs on every texture the client decodes. */
      try {
        if (w === 256 && h === 256 && looksLikeWidgets(out.data, w, h)) {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').putImageData(out, 0, 0);
          localStorage.setItem(key, c.toDataURL('image/png'));
          W.uninstall();
          console.info('[Orion] learned the client’s widgets.png — the theme can now restyle ' +
                       'buttons without touching the hotbar');
        }
      } catch (e) { /* not fatal; the theme just leaves buttons alone */ }
      return out;
    };

    installed = true;
    return true;
  };

  W.uninstall = function () {
    if (!installed) return;
    CanvasRenderingContext2D.prototype.getImageData = original;
    installed = false;
  };
})(window.ORION);
