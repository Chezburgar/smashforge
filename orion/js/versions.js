/* ORION CLIENT — the builds Orion can launch
 *
 * Eaglercraft builds do not all boot the same way, and the differences are not
 * cosmetic: hand a build the wrong style of options and it silently discards
 * them, or never starts at all. Each entry records what its build actually
 * needs, so launch.js has no version-specific branches of its own.
 *
 *   optsMode  'hints'  the bundle adopts window.eaglercraftXOptsHints when
 *                      hintsVersion is 1, and otherwise REPLACES
 *                      window.eaglercraftXOpts with its own defaults. Writing
 *                      only eaglercraftXOpts is thrown away a moment later.
 *             'direct' the bundle reads window.eaglercraftXOpts and mutates it
 *                      in place (its asset script adds assetsURI to it), so
 *                      settings written there survive.
 *
 *   scripts   loaded in order, from the version's own directory.
 *
 *   autoStart true  the bundle calls main() itself as it finishes loading.
 *             false Orion must call window.main() once every script is in.
 *                   Offline builds of this shape normally start from a
 *                   countdown screen wired to the window 'load' event, which
 *                   has already fired by the time Orion injects them — so
 *                   waiting for the bundle to start itself would hang forever.
 *
 *   signature a detached signature file, read once at startup. Present only on
 *             signed builds; without it they report "Signature Invalid!".
 *
 *   worldsDB  IndexedDB name for saved worlds. Deliberately different per
 *             version: world formats are not compatible across them, and every
 *             version here is served from one origin, so a shared database
 *             would let 1.12.2 open a 1.8 world and vice versa.
 *
 *   packsDB   IndexedDB name for installed resource packs, same reasoning.
 *             Passed to the build as resourcePacksDB and used by js/packs.js to
 *             find the storage it writes into, so the two cannot drift apart.
 *             null means Orion has not read that build's pack storage and will
 *             not write to it.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const V = {};
  O.Versions = V;

  const LIST = [
    {
      id: '1.8',
      label: '1.8.9',
      note: 'EaglercraftX 1.8-u53 · signed · stable',
      dir: 'client/1.8/',
      optsMode: 'hints',
      scripts: ['classes.js'],
      signature: 'signature.txt',
      autoStart: true,
      worldsDB: 'worlds',
      packsDB: 'resourcePacks',
      isDefault: true
    },
    {
      id: '1.12.2',
      label: '1.12.2',
      /* Its own author puts an "Important Disclaimer" on the first launch:
               * 1.12 is early, unofficial and buggy. Hence 1.8 is the default. */
              note: 'Eaglercraft 1.12.2-u3 · unsigned · early, expect bugs',
      dir: 'client/1.12.2/',
      optsMode: 'direct',
      scripts: ['classes.js', 'assets.js'],
      signature: null,
      autoStart: false,
      worldsDB: 'worlds_1_12_2',
      packsDB: null,
      isDefault: false
    }
  ];

  const KEY = 'orion.version.v1';

  V.all = () => LIST.slice();
  V.get = (id) => LIST.find((v) => v.id === id) || null;
  V.default = () => LIST.find((v) => v.isDefault) || LIST[0];

  V.selected = function () {
    let id = null;
    try {
      id = localStorage.getItem(KEY);
    } catch (e) { /* fall through to the default */ }
    return V.get(id) || V.default();
  };

  V.select = function (id) {
    const v = V.get(id);
    if (!v) return { ok: false, error: 'Unknown version.' };
    try {
      localStorage.setItem(KEY, v.id);
    } catch (e) { /* remembered for this session only */ }
    return { ok: true, version: v };
  };
})(window.ORION);
