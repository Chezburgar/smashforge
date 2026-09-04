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
  L.signatureURL = () => L.base() + 'signature.txt';

  /* A signed build carries a detached signature. The client reads it from
   * window.eaglercraftXClientSignature exactly once at startup: supply it and
   * the main menu reads "Digitally Signed" and the offline-download button
   * appears; omit it and a signed bundle reports "Signature Invalid!", because
   * it cannot prove it is the build its author published. Unsigned builds
   * simply have no signature.txt and skip all of this. */
  async function loadSignature() {
    try {
      const res = await fetch(L.signatureURL(), { cache: 'no-store' });
      if (!res.ok) return null;
      const text = (await res.text()).trim();
      /* Must be the detached-signature data URI, not an HTML error page. */
      return /^data:[^;]*;base64,[A-Za-z0-9+/=\s]+$/.test(text) ? text.replace(/\s+/g, '') : null;
    } catch (e) {
      return null;
    }
  }

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

  /* Two bundle shapes exist in the wild. A "split" build ships classes.js
   * next to assets.epk. An "offline" build has the asset packages compiled
   * into classes.js and needs no .epk at all — so only classes.js decides
   * whether we can launch, and assets.epk merely selects which shape we are
   * looking at. */
  L.probe = async function () {
    const base = L.base();
    const [classes, assets, signature] = await Promise.all([
      exists(L.classesURL()),
      exists(L.assetsURL()),
      exists(L.signatureURL())
    ]);
    return {
      base: base,
      classes: classes,
      assets: assets,
      signature: signature,
      selfContained: classes.ok && !assets.ok,
      ready: classes.ok
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

  /* Newer bundles hand their options over as "hints": the tail of classes.js
   * adopts window.eaglercraftXOptsHints wholesale when hintsVersion is 1, and
   * otherwise REPLACES window.eaglercraftXOpts with its own built-in defaults.
   * So the hints object is the one that has to carry our settings — writing
   * only eaglercraftXOpts gets silently discarded on those builds. Older split
   * bundles read eaglercraftXOpts directly, so launch() sets both. */
  L.buildOpts = function (containerId, joinAddr, shape) {
    const opts = {
      hintsVersion: 1,
      container: containerId,
      worldsDB: 'worlds',
      demoMode: false,
      servers: optsServers(),
      relays: O.Relays.forOpts()
    };
    /* A self-contained build appends its own embedded assetsURI list after
     * reading the hints, so naming a path here would only send it fetching an
     * assets.epk that isn't there. A split build needs to be told. */
    if (!shape || !shape.selfContained) {
      opts.assetsURI = L.assetsURL();
      opts.localesURI = L.base() + 'lang/';
    }
    if (joinAddr) opts.joinServer = joinAddr;
    return opts;
  };

  /* Start the game. `joinAddr`, when given, drops the player straight into
   * that server instead of the main menu. */
  L.launch = async function (containerId, joinAddr, shape) {
    if (launched) throw new Error('The client is already running — reload the page to start it again.');
    if (!document.getElementById(containerId)) throw new Error('Launch container #' + containerId + ' is missing.');

    /* Fetched before the bundle is injected, because the client consumes the
     * global during its own startup and never looks again. */
    const signature = (!shape || shape.signature === undefined || shape.signature.ok) ? await loadSignature() : null;
    if (signature) window.eaglercraftXClientSignature = signature;

    return new Promise(function (resolve, reject) {

      /* Both must exist before classes.js evaluates. Hints is what modern
       * bundles honour; eaglercraftXOpts covers older ones that read it
       * directly. Same object either way, so they cannot disagree. */
      const opts = L.buildOpts(containerId, joinAddr, shape);
      window.eaglercraftXOptsHints = opts;
      window.eaglercraftXOpts = opts;

      const s = document.createElement('script');
      s.src = L.classesURL();
      s.async = false;
      s.onload = function () {
        launched = true;
        /* The bundle rewrites window.eaglercraftXOpts as it starts, so report
         * what it actually ended up running with, not what we asked for. */
        resolve({ requested: opts, effective: window.eaglercraftXOpts, signed: !!signature });
      };
      s.onerror = function () {
        reject(new Error('Could not load the client bundle from ' + L.classesURL() + '.'));
      };
      document.body.appendChild(s);
    });
  };
})(window.ORION);
