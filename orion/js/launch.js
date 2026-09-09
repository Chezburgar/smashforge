/* ORION CLIENT — locating and starting a client build
 *
 * Orion is the shell: the menu, the server book, the launch button. The game
 * is an Eaglercraft build under orion/client/<version>/. What differs between
 * builds — how options must be passed, how many scripts to load, whether the
 * bundle starts itself — is declared in versions.js, not decided here.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const KEY = 'orion.bundle.v1';
  const L = {};
  O.Launcher = L;

  /* Where the version directories live, relative to this page. Overridable so
   * a large build can be hosted elsewhere; the version's own subdirectory is
   * appended to it. */
  const DEFAULT_ROOT = '';

  L.root = function () {
    let r;
    try {
      r = localStorage.getItem(KEY) || '';
    } catch (e) {
      r = '';
    }
    r = (r || DEFAULT_ROOT).trim();
    if (!r) return '';
    return r.endsWith('/') ? r : r + '/';
  };

  L.setRoot = function (v) {
    const raw = String(v == null ? '' : v).trim();
    if (!raw) {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      return { ok: true, root: DEFAULT_ROOT };
    }
    if (/^(javascript|data|blob|vbscript):/i.test(raw)) {
      return { ok: false, error: 'That is not a valid location for the client.' };
    }
    if (/^https?:\/\//i.test(raw)) {
      try {
        new URL(raw);
      } catch (e) {
        return { ok: false, error: 'That is not a valid URL.' };
      }
      if (location.protocol === 'https:' && /^http:\/\//i.test(raw)) {
        return { ok: false, error: 'This page is HTTPS, so it can only load a client from an https:// URL.' };
      }
    } else if (/^\/\//.test(raw) || raw.includes('\\')) {
      return { ok: false, error: 'Use a relative path, or a full https:// URL.' };
    }
    const root = raw.endsWith('/') ? raw : raw + '/';
    try { localStorage.setItem(KEY, root); } catch (e) { /* ignore */ }
    return { ok: true, root: root };
  };

  /* Every URL for a version is built from these two, so nothing else needs to
   * know how the directories are laid out. */
  L.base = (version) => L.root() + version.dir;
  L.scriptURL = (version, name) => L.base(version) + name;
  L.signatureURL = (version) => (version.signature ? L.base(version) + version.signature : null);

  /* ------------------------------------------------------------- probing */

  async function exists(url) {
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (head.ok) return { ok: true, size: Number(head.headers.get('content-length')) || null };
      if (head.status !== 405 && head.status !== 501) return { ok: false, status: head.status };
    } catch (e) {
      /* often CORS on HEAD; fall through to a ranged GET */
    }
    try {
      const res = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
      if (res.ok || res.status === 206) return { ok: true, size: null };
      return { ok: false, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /* A version is launchable when every script it declares is present. The
   * signature is optional: missing it costs the "Digitally Signed" badge, not
   * the ability to play. */
  L.probe = async function (version) {
    const v = version || O.Versions.selected();
    const files = await Promise.all(v.scripts.map((n) => exists(L.scriptURL(v, n))));
    const sigURL = L.signatureURL(v);
    const signature = sigURL ? await exists(sigURL) : null;

    const scripts = {};
    v.scripts.forEach((n, i) => { scripts[n] = files[i]; });

    return {
      version: v,
      base: L.base(v),
      scripts: scripts,
      missing: v.scripts.filter((n, i) => !files[i].ok),
      signature: signature,
      totalBytes: files.reduce((sum, f) => sum + (f.size || 0), 0),
      ready: files.every((f) => f.ok)
    };
  };

  L.probeAll = async function () {
    const out = {};
    for (const v of O.Versions.all()) out[v.id] = await L.probe(v);
    return out;
  };

  /* ------------------------------------------------------------ signature */

  async function loadSignature(version) {
    const url = L.signatureURL(version);
    if (!url) return null;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return null;
      const text = (await res.text()).trim();
      return /^data:[^;]*;base64,[A-Za-z0-9+/=\s]+$/.test(text) ? text.replace(/\s+/g, '') : null;
    } catch (e) {
      return null;
    }
  }

  /* ---------------------------------------------------------------- launch */

  let launched = null;
  L.hasLaunched = () => !!launched;
  L.launchedVersion = () => launched;

  function optsServers() {
    return O.Servers.all().map((e) => ({ addr: e.addr, name: e.name }));
  }

  L.buildOpts = function (version, containerId, joinAddr) {
    const v = version || O.Versions.selected();
    const opts = {
      container: containerId,
      worldsDB: v.worldsDB,
      /* Named explicitly rather than left to the build's default, because
       * js/packs.js writes into that exact database to install a pack, and
       * into "<localStorageNamespace>.g" to switch one on. */
      resourcePacksDB: v.packsDB || 'resourcePacks',
      localStorageNamespace: v.storageNamespace || '_eaglercraftX',
      demoMode: false,
      servers: optsServers(),
      relays: O.Relays.forOpts()
    };
    /* Only a hints-style build reads this, and it is what makes that build
     * adopt our object instead of replacing it with its own defaults. */
    if (v.optsMode === 'hints') opts.hintsVersion = 1;
    if (joinAddr) opts.joinServer = joinAddr;
    return opts;
  };

  function injectScript(url) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = url;
      s.async = false;
      s.onload = () => resolve(url);
      s.onerror = () => reject(new Error('Could not load ' + url + '.'));
      document.body.appendChild(s);
    });
  }

  L.launch = async function (containerId, joinAddr, version) {
    const v = version || O.Versions.selected();
    if (launched) throw new Error('The client is already running — reload the page to start it again.');
    if (!document.getElementById(containerId)) throw new Error('Launch container #' + containerId + ' is missing.');

    /* Consumed by the client during its own startup, so it has to be in place
     * before the first script runs. */
    const signature = await loadSignature(v);
    if (signature) window.eaglercraftXClientSignature = signature;

    const opts = L.buildOpts(v, containerId, joinAddr);
    window.eaglercraftXOpts = opts;
    /* Harmless on a direct-mode build, essential on a hints-mode one. */
    window.eaglercraftXOptsHints = opts;

    for (const name of v.scripts) {
      await injectScript(L.scriptURL(v, name));
    }

    /* A build that does not start itself expects its page to call main() once
     * everything is loaded. Its own offline page does that from a countdown
     * wired to the window 'load' event, which fired long before we got here. */
    if (!v.autoStart) {
      if (typeof window.main !== 'function') {
        throw new Error('The ' + v.label + ' client loaded but exposed no entry point to start it.');
      }
      window.main();
    }

    launched = v;
    return { version: v, requested: opts, effective: window.eaglercraftXOpts, signed: !!signature };
  };
})(window.ORION);
