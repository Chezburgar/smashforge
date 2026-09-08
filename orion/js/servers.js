/* ORION CLIENT — server book: validation, storage, reachability probing */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const KEY = 'orion.servers.v1';
  const S = {};
  O.Servers = S;

  /* ---------------------------------------------------------------- model */

  let list = [];

  const uid = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      list = Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.addr === 'string') : [];
    } catch (e) {
      list = [];
    }
    return list;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      /* storage full or blocked (private mode) — the session still works,
       * it just won't survive a reload. */
      O.warn && O.warn('Could not save your server list: ' + e.message);
    }
  }

  S.all = () => list.slice();
  S.count = () => list.length;
  S.get = (id) => list.find((e) => e.id === id) || null;

  /* ----------------------------------------------------------- addressing */

  /* EaglerXServer speaks the Minecraft protocol over a WebSocket, so an
   * address is always a ws:// or wss:// URL. Players habitually type a bare
   * `host:port`, so fill in the scheme that the current page can actually
   * open: an https:// page may only open wss://. */
  S.defaultScheme = () => (location.protocol === 'https:' ? 'wss://' : 'ws://');

  S.normalise = function (input) {
    let raw = String(input == null ? '' : input).trim();
    if (!raw) return { ok: false, error: 'Enter a server address.' };

    /* Strip a pasted "join" prefix and any stray wrapping. */
    raw = raw.replace(/^\/?(join|connect)\s+/i, '').replace(/^<|>$/g, '').trim();

    if (/^https?:\/\//i.test(raw)) {
      /* A helpful rewrite rather than a dead end: people paste the http URL
       * of the page their server is behind. */
      raw = raw.replace(/^http:\/\//i, 'ws://').replace(/^https:\/\//i, 'wss://');
    } else if (!/^wss?:\/\//i.test(raw)) {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
        return { ok: false, error: 'Only ws:// and wss:// addresses can be joined.' };
      }
      raw = S.defaultScheme() + raw;
    }

    let url;
    try {
      url = new URL(raw);
    } catch (e) {
      return { ok: false, error: 'That is not a valid address.' };
    }
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      return { ok: false, error: 'Only ws:// and wss:// addresses can be joined.' };
    }
    if (!url.hostname) return { ok: false, error: 'That address has no hostname.' };

    /* Keep the path — EaglerXServer is often mounted behind a proxy on a
     * subpath — but drop a bare trailing "/" for tidier display. */
    let addr = url.protocol + '//' + url.host + (url.pathname === '/' ? '/' : url.pathname);
    if (url.search) addr += url.search;

    return { ok: true, addr: addr, url: url, insecure: url.protocol === 'ws:' };
  };

  /* An https:// page is not allowed to open a ws:// socket. This is the single
   * most common reason a server "does not work" on a Pages-hosted client, so
   * it gets its own check rather than being buried in a failed connection. */
  S.isBlockedMixed = function (addr) {
    return location.protocol === 'https:' && /^ws:\/\//i.test(addr);
  };

  const isLoopback = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';

  S.hostLabel = function (addr) {
    const n = S.normalise(addr);
    return n.ok ? n.url.host : addr;
  };

  /* --------------------------------------------------------------- writing */

  S.add = function (name, addr, note) {
    const n = S.normalise(addr);
    if (!n.ok) return n;
    if (list.some((e) => e.addr.toLowerCase() === n.addr.toLowerCase())) {
      return { ok: false, error: 'That server is already in your list.' };
    }
    const entry = {
      id: uid(),
      name: String(name || '').trim() || n.url.host,
      addr: n.addr,
      note: String(note || '').trim(),
      added: Date.now(),
      lastOk: null,
      lastMs: null
    };
    list.push(entry);
    save();
    return { ok: true, entry: entry };
  };

  S.update = function (id, patch) {
    const e = S.get(id);
    if (!e) return { ok: false, error: 'That server is no longer in your list.' };
    if (patch.addr != null && patch.addr !== e.addr) {
      const n = S.normalise(patch.addr);
      if (!n.ok) return n;
      if (list.some((o) => o !== e && o.addr.toLowerCase() === n.addr.toLowerCase())) {
        return { ok: false, error: 'Another entry already uses that address.' };
      }
      e.addr = n.addr;
      e.lastOk = null;
      e.lastMs = null;
    }
    if (patch.name != null) e.name = String(patch.name).trim() || S.hostLabel(e.addr);
    if (patch.note != null) e.note = String(patch.note).trim();
    save();
    return { ok: true, entry: e };
  };

  S.remove = function (id) {
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) return false;
    list.splice(i, 1);
    save();
    return true;
  };

  S.move = function (id, delta) {
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) return false;
    const j = Math.max(0, Math.min(list.length - 1, i + delta));
    if (i === j) return false;
    list.splice(j, 0, list.splice(i, 1)[0]);
    save();
    return true;
  };

  /* ------------------------------------------------------------- probing */

  /* Open a socket and see whether it completes a handshake. A server that
   * accepts the upgrade is reachable; we close immediately without sending a
   * login packet, so this never shows up as a join attempt in-game. */
  S.ping = function (addr, timeoutMs) {
    const budget = timeoutMs || 6000;
    return new Promise(function (resolve) {
      if (S.isBlockedMixed(addr)) {
        return resolve({
          ok: false,
          code: 'mixed',
          detail: 'This page is served over HTTPS, so the browser blocks plain ws:// connections. The server needs a wss:// (TLS) address.'
        });
      }

      let sock;
      const t0 = performance.now();
      let done = false;

      const finish = (res) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          if (sock && sock.readyState <= 1) sock.close();
        } catch (e) { /* already gone */ }
        resolve(res);
      };

      const timer = setTimeout(function () {
        finish({
          ok: false,
          code: 'timeout',
          detail: 'No response within ' + Math.round(budget / 1000) + 's. The host may be offline, or a firewall may be dropping the port.'
        });
      }, budget);

      try {
        sock = new WebSocket(addr);
      } catch (e) {
        return finish({ ok: false, code: 'refused', detail: 'The browser refused to open that address: ' + e.message });
      }

      sock.onopen = function () {
        finish({ ok: true, code: 'open', ms: Math.round(performance.now() - t0) });
      };
      /* The browser deliberately hides *why* a socket failed, so say what it
       * could be instead of inventing a specific cause. */
      sock.onerror = function () {
        finish({
          ok: false,
          code: 'error',
          detail: isLoopback(S.normalise(addr).ok ? S.normalise(addr).url.hostname : '')
            ? 'Could not connect. Is the server running on this machine right now?'
            : 'Could not connect — wrong port, server offline, or TLS certificate rejected.'
        });
      };
      sock.onclose = function () {
        finish({ ok: false, code: 'closed', detail: 'The server closed the connection before the handshake finished.' });
      };
    });
  };

  /* A server that "does not work" is nearly always one of a handful of things,
   * and the browser refuses to say which: a failed WebSocket reports no reason
   * at all, by design. So instead of guessing, try the alternatives and report
   * what actually answered. Runs several probes, so it takes a few seconds.
   *
   * The cases this separates, in the order they bite people:
   *   1. a ws:// address on an HTTPS page   — blocked before it leaves the tab
   *   2. the Java port instead of the WebSocket one — nothing is listening
   *   3. no EaglerXServer / wrong port      — refused or silent
   *   4. TLS only on 443                    — works, but not where you asked
   */
  S.diagnose = async function (input, onStep) {
    const n = S.normalise(input);
    const step = (t) => { try { onStep && onStep(t); } catch (e) { /* display only */ } };
    if (!n.ok) return { addr: null, findings: [{ level: 'bad', title: 'That address cannot be read', text: n.error }] };

    const url = n.addr && n.url;
    const host = url.hostname;
    const givenPort = url.port || (url.protocol === 'wss:' ? '443' : '80');
    const path = url.pathname === '/' ? '/' : url.pathname;
    const findings = [];
    let suggestion = null;

    /* The Java port is the right port. EaglerXServer's listener has dual_stack
     * on by default, and it works out which kind of connection it is from the
     * first packet: an HTTP/1.1 request is treated as Eaglercraft, anything
     * else as ordinary Java. So one port serves both, and telling people to
     * hunt for a second one — which an earlier version of this did — sends
     * them looking for something that does not exist. */
    const JAVA_PORTS = ['25565', '25566', '25567'];
    if (JAVA_PORTS.includes(givenPort)) {
      findings.push({
        level: 'ok',
        title: 'The port looks right',
        text: 'Port ' + givenPort + ' is the Java port, and that is the one to use: ' +
              "EaglerXServer listens for both kinds of connection on your server's own port " +
              'and tells them apart from the first packet. There is no separate WebSocket port to find.'
      });
    }

    /* 1. Would the browser even let this out of the tab? */
    if (S.isBlockedMixed(n.addr)) {
      findings.push({
        level: 'bad',
        title: 'This page cannot open a ws:// address at all',
        text: 'Orion is served over HTTPS, and every browser blocks an unencrypted ws:// socket ' +
              'from a secure page. Nothing on the server side changes this — the address itself has to be wss://.'
      });
      const alt = 'wss://' + url.host + path;
      step('Trying the same address over TLS…');
      const r = await S.ping(alt, 7000);
      if (r.ok) {
        suggestion = alt;
        findings.push({
          level: 'ok',
          title: 'Good news — it answers over TLS',
          text: 'The same host and port responded in ' + r.ms + ' ms as ' + alt + '. Use that address instead.'
        });
      } else {
        findings.push({
          level: 'warn',
          title: 'It does not answer over TLS either',
          text: 'So the server is not offering an encrypted endpoint on that port. That is the thing to fix: ' +
                'a browser on an HTTPS page can only reach wss://.'
        });
      }
    } else {
      /* 2. Try what they actually asked for. */
      step('Connecting to ' + n.addr + '…');
      const r = await S.ping(n.addr, 8000);
      if (r.ok) {
        findings.push({
          level: 'ok',
          title: 'This address works',
          text: 'The server completed a WebSocket handshake in ' + r.ms + ' ms. If the game still will not join, ' +
                'the problem is past the connection — check online-mode=false, and that EaglerXServer is the ' +
                'thing listening on this port.'
        });
        return { addr: n.addr, findings: findings, ok: true };
      }
      findings.push({
        level: 'bad',
        title: r.code === 'timeout' ? 'Nothing answered in time' : 'The connection was refused',
        text: r.detail
      });

      /* 3. Is there TLS on the standard port instead? Hosts that terminate TLS
       *    usually do it on 443, not on the game port. */
      if (givenPort !== '443') {
        const alt = 'wss://' + host + path;
        step('Checking whether anything answers on the standard TLS port…');
        const r443 = await S.ping(alt, 7000);
        if (r443.ok) {
          suggestion = alt;
          findings.push({
            level: 'ok',
            title: 'Something answers on port 443',
            text: alt + ' responded in ' + r443.ms + ' ms. If that is your EaglerXServer listener, use this address.'
          });
        } else {
          findings.push({
            level: 'warn',
            title: 'Nothing on port 443 either',
            text: 'So there is no TLS endpoint on this host that a browser can reach. On a shared host that ' +
                  'usually means the WebSocket listener is not exposed, or is exposed without a certificate.'
          });
        }
      }
    }

    if (!findings.some((f) => f.level === 'ok' && /works|answers|TLS/.test(f.title))) {
      findings.push({
        level: 'warn',
        title: 'What to check, in order',
        list: [
          'Is EaglerXServer.jar in plugins/, and did the server restart after you put it there? It needs Java 17 or newer.',
          'Use your normal Java address and port. EaglerXServer\u2019s listener has dual_stack on by default and serves both kinds of connection on the one port \u2014 there is no second port to find.',
          'Is TLS on? This is the usual answer. A browser on an HTTPS page can only open wss://, and EaglerXServer ships with enable_tls set to false, so a fresh install only speaks plain ws:// and no browser on this page can reach it. Open the TLS helper below.',
          'If you turn TLS on, set require_tls to false as well, or the same port stops accepting your Java players.',
          'Is online-mode=false in server.properties? Eaglercraft players have no Mojang account, so with it on you connect and then get kicked at login \u2014 which looks different from this.',
          'Running behind Cloudflare or nginx? Then set forward_ip so the real address reaches the server, or EaglerXServer\u2019s rate limiter sees every player as one IP.'
        ]
      });
    }

    return { addr: n.addr, findings: findings, suggestion: suggestion, ok: false };
  };

  /* Probe one entry and record the outcome on it. */
  S.probe = async function (id, timeoutMs) {
    const e = S.get(id);
    if (!e) return { ok: false, error: 'gone' };
    const res = await S.ping(e.addr, timeoutMs);
    e.lastOk = res.ok;
    e.lastMs = res.ok ? res.ms : null;
    e.lastSeen = Date.now();
    save();
    return res;
  };

  /* ------------------------------------------------- import / export / share */

  S.exportJSON = function () {
    return JSON.stringify(
      { kind: 'orion-server-book', version: 1, servers: list.map((e) => ({ name: e.name, addr: e.addr, note: e.note })) },
      null,
      2
    );
  };

  S.importJSON = function (text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, error: 'That is not valid JSON.' };
    }
    const rows = Array.isArray(data) ? data : Array.isArray(data.servers) ? data.servers : null;
    if (!rows) return { ok: false, error: 'No server list found in that file.' };

    let added = 0;
    const skipped = [];
    rows.forEach(function (r) {
      const addr = r && (r.addr || r.address || r.ip);
      if (!addr) return;
      const res = S.add(r.name || r.serverName, addr, r.note);
      if (res.ok) added++;
      else skipped.push((r.name || addr) + ' — ' + res.error);
    });
    return { ok: true, added: added, skipped: skipped };
  };

  /* A share link carries one or more servers as ?add=addr&name=… so a host can
   * hand players a single URL that pre-fills their list. */
  S.shareLink = function (entry) {
    const u = new URL(location.href);
    u.hash = '';
    u.search = '';
    u.searchParams.set('add', entry.addr);
    if (entry.name && entry.name !== S.hostLabel(entry.addr)) u.searchParams.set('name', entry.name);
    return u.toString();
  };

  /* Read any ?add= parameters, add them, and clean the URL so a refresh does
   * not add them twice. */
  S.consumeShareLink = function () {
    const q = new URLSearchParams(location.search);
    const addrs = q.getAll('add');
    if (!addrs.length) return null;
    const names = q.getAll('name');
    const results = addrs.map((addr, i) => ({ addr: addr, res: S.add(names[i] || '', addr) }));
    try {
      history.replaceState(null, '', location.pathname + location.hash);
    } catch (e) { /* non-fatal */ }
    return results;
  };

  load();
})(window.ORION);
