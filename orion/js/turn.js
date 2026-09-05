/* ORION CLIENT — TURN for shared worlds
 *
 * A shared world is a direct WebRTC connection between two browsers. When both
 * sides are on ordinary home networks that works; on a school or office network
 * it usually does not, because the UDP peer-to-peer needs is blocked, or the
 * NAT is symmetric and hole punching cannot get through. A TURN server fixes
 * that by forwarding the traffic through a host both sides can reach.
 *
 * The client has no option for setting ICE servers: it takes whatever list the
 * relay hands it (an internal setIceServers call), and the TURN servers that
 * shipped with Eaglercraft stopped answering in 2024. So Orion supplies its own
 * list here instead — by wrapping RTCPeerConnection before the game loads, so
 * every connection the game opens is built with our servers. Nothing in the
 * game bundle is modified, which matters: editing it would break its signature.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const T = {};
  O.Turn = T;

  const cfg = (O.config && O.config.turn) || {};
  let servers = null;      // the list currently in force
  let fetchedAt = null;
  let lastError = null;
  let installed = false;

  T.configured = () => !!cfg.credentialsUrl;
  T.state = () => ({
    configured: T.configured(),
    installed: installed,
    count: servers ? servers.length : 0,
    servers: servers ? servers.map(summarise) : [],
    fetchedAt: fetchedAt,
    error: lastError,
    mode: cfg.mode === 'append' ? 'append' : 'replace'
  });

  /* Never hand usernames or credentials to the UI — only what a person needs
   * to see to tell whether TURN is actually present. */
  function summarise(s) {
    const urls = Array.isArray(s.urls) ? s.urls : [s.urls];
    return {
      urls: urls,
      kind: urls.some((u) => /^turns:/i.test(u)) ? 'turns'
          : urls.some((u) => /^turn:/i.test(u)) ? 'turn'
          : 'stun',
      hasCredential: !!(s.username && s.credential)
    };
  }

  /* Accepts either a bare array (what Metered returns) or a { iceServers: [] }
   * wrapper, and keeps only the fields RTCPeerConnection reads. */
  function normalise(payload) {
    const rows = Array.isArray(payload)
      ? payload
      : payload && Array.isArray(payload.iceServers)
        ? payload.iceServers
        : null;
    if (!rows) return null;

    const out = [];
    rows.forEach(function (r) {
      if (!r) return;
      const urls = r.urls || r.url;
      if (typeof urls !== 'string' && !Array.isArray(urls)) return;
      const entry = { urls: urls };
      if (typeof r.username === 'string') entry.username = r.username;
      if (typeof r.credential === 'string') entry.credential = r.credential;
      out.push(entry);
    });
    return out.length ? out : null;
  }

  T.refresh = async function () {
    if (!T.configured()) {
      lastError = 'No TURN endpoint is configured.';
      return { ok: false, error: lastError };
    }
    try {
      const res = await fetch(cfg.credentialsUrl, {
        cache: 'no-store',
        headers: cfg.headers || {}
      });
      if (!res.ok) throw new Error('The TURN endpoint returned ' + res.status + '.');
      const list = normalise(await res.json());
      if (!list) throw new Error('The TURN endpoint returned no usable ICE servers.');
      servers = list;
      fetchedAt = new Date().toISOString();
      lastError = null;
      return { ok: true, count: list.length };
    } catch (e) {
      lastError = e.message;
      return { ok: false, error: e.message };
    }
  };

  /* Build the configuration the game's peer connection should actually use.
   * With no list of our own we return the game's own config untouched, so a
   * failed fetch leaves shared worlds exactly as they were rather than worse. */
  function apply(config) {
    if (!servers || !servers.length) return config;
    const base = config && typeof config === 'object' ? config : {};
    const theirs = Array.isArray(base.iceServers) ? base.iceServers : [];
    return Object.assign({}, base, {
      iceServers: cfg.mode === 'append' ? theirs.concat(servers) : servers.slice()
    });
  }

  /* Wrap every peer-connection constructor the bundle might reach for. It
   * probes RTCPeerConnection, webkitRTCPeerConnection and mozRTCPeerConnection
   * in turn, so all three are wrapped or the probe could slip past us. */
  T.install = function () {
    if (installed) return true;
    let any = false;

    ['RTCPeerConnection', 'webkitRTCPeerConnection', 'mozRTCPeerConnection'].forEach(function (name) {
      const Native = window[name];
      if (typeof Native !== 'function') return;

      function Wrapped(config, constraints) {
        return arguments.length > 1
          ? new Native(apply(config), constraints)
          : new Native(apply(config));
      }
      /* Keep instanceof and any static properties working, so the wrapper is
       * indistinguishable from the real constructor to everything else. */
      Wrapped.prototype = Native.prototype;
      try { Object.setPrototypeOf(Wrapped, Native); } catch (e) { /* not fatal */ }
      Object.defineProperty(Wrapped, 'name', { value: name, configurable: true });
      Wrapped.__orionNative = Native;

      try {
        window[name] = Wrapped;
        any = true;
      } catch (e) { /* frozen global; leave it alone */ }
    });

    installed = any;
    return any;
  };

  /* Fetch, then install, then keep the credentials fresh. Called before the
   * game bundle is injected so the game only ever sees the wrapper. */
  T.prepare = async function () {
    if (!T.configured()) return { ok: false, error: 'not configured' };
    const res = await T.refresh();
    T.install();
    if (!T.__timer && cfg.refreshMs) {
      T.__timer = setInterval(() => { T.refresh(); }, cfg.refreshMs);
    }
    return res;
  };
})(window.ORION);
