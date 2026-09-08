/* ORION CLIENT — accounts, presence and friends
 *
 * An Orion Client account is its own thing: a username and a password held in
 * this launcher's own tables, with no email and no tie to any other account on
 * the site. Signing up is all it takes to get in — nobody has to be let in by
 * hand — and the same name is the same player on a phone and on a laptop.
 *
 * Signing in returns an opaque session token. It is the only credential the
 * browser holds and the only thing every call below sends; the server stores
 * just its hash, so a leak of the table proves nothing. Passwords are bcrypted
 * in the database and never touched again after being sent once.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const A = {};
  O.Account = A;

  const KEY = 'orion.session.v1';
  const cfg = (O.config && O.config.api) || {};

  A.available = () => !!(cfg.url && cfg.key);

  let token = null;
  let me = null;
  let beatTimer = null;

  try {
    token = localStorage.getItem(KEY) || null;
  } catch (e) {
    token = null;
  }

  A.me = () => (me ? Object.assign({}, me) : null);
  A.signedIn = () => !!(token && me);
  A.isOwner = () => !!(me && me.role === 'owner');
  A.token = () => token;

  function keep(t) {
    token = t;
    try {
      if (t) localStorage.setItem(KEY, t);
      else localStorage.removeItem(KEY);
    } catch (e) { /* session-only then */ }
  }

  /* ------------------------------------------------------------------ http */

  async function rpc(fn, args) {
    if (!A.available()) throw new Error('Accounts are not configured for this site.');
    const res = await fetch(cfg.url + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.key,
        Authorization: 'Bearer ' + cfg.key
      },
      body: JSON.stringify(args || {})
    });
    const text = await res.text();
    if (!res.ok) {
      let msg = 'Something went wrong (' + res.status + ').';
      try {
        const body = JSON.parse(text);
        /* Messages raised in SQL are written for players to read. */
        if (body && body.message) msg = body.message;
      } catch (e) { /* keep the status */ }
      /* A dead session should log you out rather than nag forever. */
      if (/ORION_SIGNED_OUT/.test(msg)) {
        keep(null);
        me = null;
        stopBeat();
        msg = 'You were signed out. Please sign in again.';
      }
      const err = new Error(msg.replace(/^ORION_[A-Z_]+:\s*/, ''));
      err.status = res.status;
      throw err;
    }
    return text ? JSON.parse(text) : null;
  }
  A.rpc = rpc;

  /* ------------------------------------------------------------- sign in/up */

  A.register = async function (username, password) {
    try {
      const out = await rpc('orion_client_register', { p_username: username, p_password: password });
      keep(out.token);
      me = out.account;
      startBeat();
      return { ok: true, account: me };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  A.login = async function (username, password) {
    try {
      const out = await rpc('orion_client_login', { p_username: username, p_password: password });
      keep(out.token);
      me = out.account;
      startBeat();
      return { ok: true, account: me };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* Called once at start-up: a stored token is worth nothing until the server
   * agrees it is still live. */
  A.resume = async function () {
    if (!token || !A.available()) return { ok: false };
    try {
      const out = await rpc('orion_client_me', { p_token: token });
      me = out.account;
      startBeat();
      return { ok: true, account: me };
    } catch (e) {
      keep(null);
      me = null;
      return { ok: false, error: e.message };
    }
  };

  A.logout = async function () {
    const t = token;
    keep(null);
    me = null;
    stopBeat();
    try {
      await rpc('orion_client_logout', { p_token: t });
    } catch (e) { /* the session lapses on its own */ }
    return { ok: true };
  };

  A.changePassword = async function (oldPw, newPw) {
    try {
      await rpc('orion_client_password', { p_token: token, p_old: oldPw, p_new: newPw });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* ----------------------------------------------------------- presence */

  let activity = { status: 'idle', version: null, world: '', code: '', server: '', open: false };

  A.activity = () => Object.assign({}, activity);

  async function beat() {
    if (!token) return;
    await rpc('orion_client_beat', {
      p_token: token,
      p_status: activity.status,
      p_version: activity.version,
      p_world: activity.world || null,
      p_code: activity.code || null,
      p_server: activity.server || null,
      p_open: !!activity.open
    });
  }

  function startBeat() {
    stopBeat();
    beat().catch(() => { /* a missed beat just ages the row out */ });
    beatTimer = setInterval(() => {
      beat().catch(() => {});
    }, cfg.heartbeatMs || 20000);
  }

  function stopBeat() {
    if (beatTimer) clearInterval(beatTimer);
    beatTimer = null;
  }

  A.setActivity = async function (patch) {
    Object.assign(activity, patch || {});
    if (!token) return { ok: true };
    try {
      await beat();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* ------------------------------------------------------------- friends */

  A.friends = async function () {
    const rows = await rpc('orion_client_friends_list', { p_token: token });
    return rows || [];
  };

  A.addFriend = async function (who) {
    try {
      const out = await rpc('orion_client_friend_add', { p_token: token, p_who: who });
      return { ok: true, result: out.result, username: out.username };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  A.respondFriend = async function (id, accept) {
    try {
      await rpc('orion_client_friend_respond', { p_token: token, p_id: id, p_accept: !!accept });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  A.removeFriend = async function (id) {
    try {
      await rpc('orion_client_friend_remove', { p_token: token, p_id: id });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* Tell the server we have gone, so friends do not see a ghost for a minute. */
  addEventListener('pagehide', function () {
    if (!token || !A.available()) return;
    try {
      navigator.sendBeacon(
        cfg.url + '/rest/v1/rpc/orion_client_beat?apikey=' + encodeURIComponent(cfg.key),
        new Blob([JSON.stringify({ p_token: token, p_status: 'idle' })], { type: 'application/json' })
      );
    } catch (e) { /* it lapses anyway */ }
  });
})(window.ORION);
