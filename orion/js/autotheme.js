/* ORION CLIENT — the menu the game wears out of the box
 *
 * The theme builder at theme/ makes a resource pack out of the launcher's own
 * palette. This is the same thing without the visit: before the client starts,
 * Orion builds that pack and switches it on, so the first thing anyone sees is
 * an Orion menu rather than a Minecraft one.
 *
 * What it replaces is the menu and nothing else — the title, the loading
 * screen, the backdrop behind menus, the skybox, and the three button states.
 * The hotbar, the slot outline and the server-list icons in widgets.png are
 * kept exactly as the client draws them, and the lettering is left alone, so
 * nothing in the world or on the HUD changes. The lettering can be swapped too
 * — it is the last thing that still looks like Minecraft once the buttons are
 * flat — but that one reaches chat, signs and item names as well, so it is off
 * unless it is asked for.
 *
 * Two things make it a per-launch job rather than a one-off:
 *
 *   The button textures need the client's own widgets.png to paint over, and
 *   that is only captured while the game runs. So a brand new profile gets
 *   everything but the buttons on its first launch, and the buttons on the
 *   second — this notices the sheet has arrived and rebuilds.
 *
 *   The palette or the wordmark can change between versions of Orion. The
 *   marker records what was built, so a rebuild happens when it no longer
 *   matches rather than on every start.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const KEY = 'orion.autotheme.v1';
  const TITLE = 'Orion Menu';
  const WORD = 'ORION CLIENT';
  const SUBTITLE = 'eaglercraft javascript runtime';
  const PALETTE = 'orion';
  /* Bumped when the textures themselves change, so an install from an older
   * Orion is replaced rather than left in place looking wrong. */
  const BUILD = 10;

  const AT = {};
  O.AutoTheme = AT;

  function readMark() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeMark(mark) {
    try {
      localStorage.setItem(KEY, JSON.stringify(mark));
    } catch (e) { /* the theme is rebuilt next launch instead */ }
  }

  /* Off is remembered; on is the absence of an off. */
  AT.enabled = function () {
    const m = readMark();
    return !(m && m.off);
  };

  AT.setEnabled = function (on) {
    const m = readMark() || {};
    m.off = !on;
    writeMark(m);
    return !m.off;
  };

  /* The lettering is the one part of this that reaches past the menus: the
   * game draws chat, item names and signs from the same sheet. Off unless
   * asked for, and asking for it forces a rebuild. */
  AT.font = function () {
    const m = readMark();
    return !!(m && m.font);
  };

  AT.setFont = function (on) {
    const m = readMark() || {};
    m.font = !!on;
    m.build = null;
    writeMark(m);
    return m.font;
  };

  AT.state = function () {
    const m = readMark() || {};
    return {
      enabled: !m.off,
      installed: !!m.build,
      build: m.build || null,
      withButtons: !!m.buttons,
      withFont: !!m.font,
      version: m.version || null,
      at: m.at || null
    };
  };

  AT.forget = function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing to do */ }
  };

  function ready(version) {
    if (!AT.enabled()) return { ok: false, reason: 'turned off' };
    if (!O.Packs || !O.Packs.supported(version)) {
      return { ok: false, reason: 'only the 1.8 client can be written to from here' };
    }
    if (!window.ORION_THEME) return { ok: false, reason: 'the theme builder did not load' };
    return { ok: true };
  }

  /* Everything the pack contains, drawn here and now. `base` is the client's
   * own widgets.png if it has been seen; without it there simply is no
   * widgets.png in the pack, because a pack replaces whole files and one
   * containing only buttons would delete the hotbar with them. */
  async function build(version, base, withFont) {
    const T = window.ORION_THEME;
    const pal = T.PALETTES[PALETTE] || T.PALETTES[Object.keys(T.PALETTES)[0]];
    const A = 'assets/minecraft/textures/gui/';

    const title = T.title(pal, WORD, SUBTITLE);
    const mojang = T.mojang(pal, 'ORION');
    const backdrop = T.background(pal);
    const sky = T.panorama(pal, 7, 256);
    const widgets = T.widgets(pal, base);
    const font = withFont ? T.font(pal) : null;

    const files = [
      { name: 'pack.mcmeta', bytes: JSON.stringify({
          pack: { pack_format: version === '1.12.2' ? 3 : 1, description: 'Orion — the menu, by Orion Client' }
        }, null, 2) },
      { name: 'pack.png', bytes: await T.toPng(mojang) },
      { name: A + 'title/minecraft.png', bytes: await T.toPng(title) },
      { name: A + 'title/mojang.png', bytes: await T.toPng(mojang) },
      { name: A + 'options_background.png', bytes: await T.toPng(backdrop) }
    ];
    for (let i = 0; i < 6; i++) {
      files.push({ name: A + 'title/background/panorama_' + i + '.png', bytes: await T.toPng(sky[i]) });
    }
    if (widgets) files.push({ name: A + 'widgets.png', bytes: await T.toPng(widgets) });

    if (font) files.push({ name: 'assets/minecraft/textures/font/ascii.png', bytes: await T.toPng(font) });

    /* The yellow line that swings over the logo is a text file, and it lands
     * squarely on the wordmark's second line. It cannot simply be emptied: the
     * client trims each line and drops the blank ones, and with no splashes
     * left it keeps its built-in "missingno" — which is what the first attempt
     * at this produced. A lone formatting code survives the trim and draws no
     * glyphs, so the splash is picked as usual and renders as nothing. Main
     * menu only, like everything else here. */
    files.push({ name: 'assets/minecraft/texts/splashes.txt', bytes: '\u00a7r\n' });

    return { files: files, buttons: !!widgets, font: !!font };
  }

  /* Called from the launch, before the bundle is injected. Returns what it did
   * rather than throwing: a theme that will not build is a cosmetic problem,
   * and must never be the reason the game does not start. */
  AT.ensure = async function (version) {
    const v = version || '1.8';
    const can = ready(v);
    if (!can.ok) return { ok: false, skipped: true, reason: can.reason };

    const mark = readMark() || {};
    const base = O.Widgets && O.Widgets.cached(v) ? await O.Widgets.load(v) : null;
    const wantFont = !!mark.font;

    /* Already installed, current, and not missing the buttons it could now
     * have — nothing to do. */
    if (mark.build === BUILD && mark.version === v && (mark.buttons || !base)) {
      return { ok: true, skipped: true, reason: 'already installed', buttons: !!mark.buttons };
    }

    let res;
    try {
      const pack = await build(v, base, wantFont);
      res = await O.Packs.install({ version: v, title: TITLE, files: pack.files });
      writeMark({
        off: false,
        build: BUILD,
        version: v,
        buttons: pack.buttons,
        font: pack.font,
        folder: res.folder,
        at: new Date().toISOString()
      });
      return {
        ok: true,
        skipped: false,
        folder: res.folder,
        files: res.files,
        enabled: res.enabled,
        enableReason: res.enableReason,
        buttons: pack.buttons,
        font: pack.font,
        rebuilt: mark.build === BUILD
      };
    } catch (e) {
      return { ok: false, skipped: false, reason: e.message };
    }
  };

  /* Taking it off again: the pack is removed and the marker cleared, so the
   * client goes back to its own menu the next time it starts. */
  AT.remove = async function (version) {
    const v = version || '1.8';
    const mark = readMark() || {};
    let removed = false;
    if (mark.folder && O.Packs && O.Packs.supported(v)) {
      try { removed = await O.Packs.remove(mark.folder, v); } catch (e) { removed = false; }
    }
    writeMark({ off: true, font: !!mark.font });
    return { removed: removed, folder: mark.folder || null };
  };
})(window.ORION);
