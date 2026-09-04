/* ORION CLIENT — client bundle discovery and launch
 *
 * Orion is the shell: the menu, the server book, the launch button. The game
 * itself is the EaglercraftX 1.8 bundle (classes.js + assets.epk), which is
 * not redistributed here — see orion/client/README.md. This module finds that
 * bundle, hands it the player's server list through window.eaglercraftXOpts,
 * and starts it.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const KEY = 'orion.bundle.v1';
  const L = {};
  O.Launcher = L;

  const DEFAULT_BASE = 'client/';

  /* lax1dude's public relays, used by the client for shared singleplayer
   * worlds (LAN worlds over WebRTC). They have nothing to do with joining an
   * EaglerXServer, and a player can replace them in-game. */
  const DEFAULT_RELAYS = [
    { addr: 'wss://relay.deev.is/', comment: 'lax1dude relay #1', primary: false },
    { addr: 'wss://relay.lax1dude.net/', comment: 'lax1dude relay #2', primary: false },
    { addr: 'wss://relay.shhnowisnottheti.me/', comment: 'ayunami relay #1', primary: false }
  ];

  /* ------------------------------------------------------- bundle location */

  L.base = function () {
    let b;
    try {
      b = localStorage.getItem(KEY) || '';
    } catch (e) {
      b = '';
    }
    b = (b || DEFAULT_BASE).trim();
    return b.endsWith('/') ? b : b + '/';
  };

  L.setBase = function (v) {
    const raw = String(v == null ? '' : v).trim();
    if (!raw) {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      return { ok: true, base: DEFAULT_BASE };
    }
    /* Reject anything that isn't a plain relative path or an http(s) origin,
     * so a pasted share link can't turn into a script source. */
    if (/^(javascript|data|blob|vbscript):/i.test(raw)) {
      return { ok: false, error: 'That is not a valid location for the client bundle.' };
    }
    if (/^https?:\/\//i.test(raw)) {
      try {
        new URL(raw);
      } catch (e) {
        return { ok: false, error: 'That is not a valid URL.' };
      }
      if (location.protocol === 'https:' && /^http:\/\//i.test(raw)) {
        return { ok: false, error: 'This page is HTTPS, so it can only load a bundle from an https:// URL.' };
      }
    } else if (/^\/\//.test(raw) || raw.includes('\\')) {
      return { ok: false, error: 'Use a relative path like client/ or a full https:// URL.' };
    }
    const base = raw.endsWith('/') ? raw : raw + '/';
    try { localStorage.setItem(KEY, base); } catch (e) { /* ignore */ }
    return { ok: true, base: base };
  };

  L.classesURL = () => L.base() + 'classes.js';
  L.assetsURL = () => L.base() + 'assets.epk';

  /* Check whether the bundle is actually there before launching, so a missing
   * install shows instructions instead of a blank canvas. Some static hosts
   * reject HEAD, so fall back to a single-byte ranged GET. */
  async function exists(url) {
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (head.ok) return { ok: true, size: Number(head.headers.get('content-length')) || null };
      if (head.status !== 405 && head.status !== 501) return { ok: false, status: head.status };
    } catch (e) {
      /* fall through to the ranged GET — this is often CORS on HEAD */
    }
    try {
      const res = await fetch(url, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
      if (res.ok || res.status === 206) return { ok: true, size: null };
      return { ok: false, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  L.probe = async function () {
    const base = L.base();
    const [classes, assets] = await Promise.all([exists(L.classesURL()), exists(L.assetsURL())]);
    return {
      base: base,
      classes: classes,
      assets: assets,
      ready: classes.ok && assets.ok
    };
  };

  /* ---------------------------------------------------------------- launch */

  let launched = false;
  L.hasLaunched = () => launched;

  /* Seed the in-game multiplayer list from the server book. EaglercraftX keeps
   * its own copy once the player has run it, so this only supplies the
   * defaults; `joinServer` is what makes a specific server open immediately. */
  function optsServers() {
    return O.Servers.all().map((e) => ({ addr: e.addr, name: e.name }));
  }

  L.buildOpts = function (containerId, joinAddr) {
    const opts = {
      container: containerId,
      assetsURI: L.assetsURL(),
      localesURI: L.base() + 'lang/',
      worldsDB: 'orion_worlds',
      resourcePacksDB: 'orion_resource_packs',
      demoMode: false,
      servers: optsServers(),
      relays: DEFAULT_RELAYS.map((r, i) => ({ addr: r.addr, comment: r.comment, primary: i === 0 }))
    };
    if (joinAddr) opts.joinServer = joinAddr;
    return opts;
  };

  /* Start the game. `joinAddr`, when given, drops the player straight into
   * that server instead of the main menu. */
  L.launch = function (containerId, joinAddr) {
    return new Promise(function (resolve, reject) {
      if (launched) return reject(new Error('The client is already running — reload the page to start it again.'));

      const container = document.getElementById(containerId);
      if (!container) return reject(new Error('Launch container #' + containerId + ' is missing.'));

      /* Must exist before classes.js evaluates: the client reads it on start. */
      window.eaglercraftXOpts = L.buildOpts(containerId, joinAddr);
      window._eaglercraftXOpts = window.eaglercraftXOpts;

      const s = document.createElement('script');
      s.src = L.classesURL();
      s.async = false;
      s.onload = function () {
        launched = true;
        resolve({ opts: window.eaglercraftXOpts });
      };
      s.onerror = function () {
        reject(new Error('Could not load the client bundle from ' + L.classesURL() + '.'));
      };
      document.body.appendChild(s);
    });
  };
})(window.ORION);
