/* ORION CLIENT — lobby: who is online, and asking to join their world
 *
 * There are no accounts. On first use this browser mints a random session id
 * and a random secret; the secret proves the session is ours and is the only
 * thing standing between us and someone else editing our row, so it stays in
 * localStorage and is never displayed. The server stores only its hash.
 *
 * Going online is opt-in and off by default, because the username entered here
 * becomes visible to everyone else on the site.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const B = {};
  O.Lobby = B;

  const KEY_ID = 'orion.lobby.id.v1';
  const KEY_ME = 'orion.lobby.me.v1';
  const cfg = (O.config && O.config.lobby) || {};

  B.available = () => !!(cfg.url && cfg.key);

  /* ------------------------------------------------------------- identity */

  function rand(bytes) {
    const a = new Uint8Array(bytes);
    crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  let ident = null;
  function identity() {
    if (ident) return ident;
    try {
      ident = JSON.parse(localStorage.getItem(KEY_ID) || 'null');
    } catch (e) {
      ident = null;
    }
    if (!ident || !ident.session || !ident.secret) {
      ident = { session: 'o' + rand(12), secret: rand(24) };
      try { localStorage.setItem(KEY_ID, JSON.stringify(ident)); } catch (e) { /* session-only then */ }
    }
    return ident;
  }
  B.sessionId = () => identity().session;

  /* ----------------------------------------------------------------- state */

  const defaults = { online: false, username: '', status: 'idle', world: '', code: '', open: false };
  let me = Object.assign({}, defaults);
  try {
    Object.assign(me, JSON.parse(localStorage.getItem(KEY_ME) || '{}'));
  } catch (e) { /* defaults */ }
  me.online = false;   // never auto-broadcast on load; going online is deliberate

  function persist() {
    try {
      localStorage.setItem(KEY_ME, JSON.stringify({ username: me.username, code: me.code, open: me.open, world: me.world }));
    } catch (e) { /* non-fatal */ }
  }

  B.me = () => Object.assign({}, me);
  B.isOnline = () => me.online;

  /* ------------------------------------------------------------------- http */

  async function call(fn, args) {
    const res = await fetch(cfg.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.key,
        Authorization: 'Bearer ' + cfg.key
      },
      body: JSON.stringify(args)
    });
    if (!res.ok) {
      let msg = 'Request failed (' + res.status + ')';
      try {
        const body = await res.json();
        /* Postgres RAISE messages are written for players to read. */
        if (body && (body.message || body.hint)) msg = body.message || body.hint;
      } catch (e) { /* keep the status text */ }
      throw new Error(msg);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async function read(path) {
    const res = await fetch(cfg.url + '/rest/v1/' + path, {
      headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key }
    });
    if (!res.ok) throw new Error('Could not read the lobby (' + res.status + ')');
    return res.json();
  }

  /* --------------------------------------------------------------- actions */

  const id = () => identity();

  async function beat() {
    const i = id();
    await call('orion_client_heartbeat', {
      p_session: i.session,
      p_secret: i.secret,
      p_username: me.username,
      p_status: me.status,
      p_world: me.world || null,
      p_code: me.code || null,
      p_open: !!me.open
    });
  }

  let timer = null;

  B.goOnline = async function (username) {
    if (!B.available()) return { ok: false, error: 'The lobby is not configured for this site.' };
    const name = String(username || '').trim();
    if (name.length < 2) return { ok: false, error: 'Pick a name of at least 2 characters.' };
    me.username = name;
    me.online = true;
    persist();
    try {
      await beat();
    } catch (e) {
      me.online = false;
      return { ok: false, error: e.message };
    }
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      beat().catch(() => { /* a missed beat just ages the row out */ });
    }, cfg.heartbeatMs || 20000);
    return { ok: true };
  };

  B.goOffline = async function () {
    me.online = false;
    if (timer) { clearInterval(timer); timer = null; }
    const i = id();
    try {
      await call('orion_client_leave', { p_session: i.session, p_secret: i.secret });
    } catch (e) { /* the row expires on its own anyway */ }
    return { ok: true };
  };

  /* What this player is up to, which is what everyone else sees. */
  B.setActivity = async function (patch) {
    Object.assign(me, patch || {});
    persist();
    if (!me.online) return { ok: true };
    try {
      await beat();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  B.players = async function () {
    const rows = await read('orion_client_online?select=*&order=status.desc,username.asc');
    const mine = id().session;
    return rows.map((r) => Object.assign({}, r, { isMe: r.session_id === mine }));
  };

  B.inbox = async function () {
    const i = id();
    if (!me.online) return [];
    return (await call('orion_client_inbox', { p_session: i.session, p_secret: i.secret })) || [];
  };

  B.ask = async function (targetSession) {
    const i = id();
    try {
      await call('orion_client_ask', { p_session: i.session, p_secret: i.secret, p_target: targetSession });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  B.respond = async function (requestId, accept) {
    const i = id();
    try {
      await call('orion_client_respond', { p_session: i.session, p_secret: i.secret, p_id: requestId, p_accept: !!accept });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  B.cancel = async function (requestId) {
    const i = id();
    try {
      await call('orion_client_cancel', { p_session: i.session, p_secret: i.secret, p_id: requestId });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* Best effort: tell the lobby we are gone when the tab closes, so the list
   * does not show ghosts for up to 75 seconds. */
  addEventListener('pagehide', function () {
    if (!me.online || !B.available()) return;
    const i = id();
    try {
      const body = JSON.stringify({ p_session: i.session, p_secret: i.secret });
      navigator.sendBeacon(
        cfg.url + '/rest/v1/rpc/orion_client_leave?apikey=' + encodeURIComponent(cfg.key),
        new Blob([body], { type: 'application/json' })
      );
    } catch (e) { /* the row expires regardless */ }
  });
})(window.ORION);
