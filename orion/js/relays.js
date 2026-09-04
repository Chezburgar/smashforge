/* ORION CLIENT — relay book
 *
 * Relays are how two browsers reach each other without either of them running
 * a server. The host opens a singleplayer world to other players; the client
 * registers that world with a relay and gets back a short join code. A friend
 * types the code, and the relay introduces the two browsers so they can talk
 * directly. No port forwarding, no domain, no TLS certificate, nothing to
 * install — which is why this, and not EaglerXServer, is the easy path.
 *
 * The relay only performs the introduction. It is not the server and the world
 * is not stored on it: the host's own browser runs the world, so when the host
 * closes the tab, the world closes with it.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const KEY = 'orion.relays.v1';
  const R = {};
  O.Relays = R;

  /* The public relays shipped with EaglercraftX, run by the Eaglercraft
   * community rather than by Orion. */
  const DEFAULTS = [
    { addr: 'wss://relay.deev.is/', comment: 'lax1dude relay #1' },
    { addr: 'wss://relay.lax1dude.net/', comment: 'lax1dude relay #2' },
    { addr: 'wss://relay.shhnowisnottheti.me/', comment: 'ayunami relay #1' }
  ];

  let list = [];

  const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function seed() {
    return DEFAULTS.map((d) => ({
      id: uid(),
      addr: d.addr,
      comment: d.comment,
      primary: false,
      builtin: true,
      lastOk: null,
      lastMs: null
    }));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      list = Array.isArray(parsed) && parsed.length ? parsed.filter((e) => e && typeof e.addr === 'string') : seed();
    } catch (e) {
      list = seed();
    }
    if (!list.some((e) => e.primary)) {
      /* Spread players across the public relays instead of stacking everyone
       * onto the first one, which is what the stock client does too. */
      const pick = list[Math.floor(Math.random() * list.length)];
      if (pick) pick.primary = true;
    }
    return list;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) { /* non-fatal: relays fall back to defaults next load */ }
  }

  R.all = () => list.slice();
  R.get = (id) => list.find((e) => e.id === id) || null;
  R.primary = () => list.find((e) => e.primary) || list[0] || null;

  R.setPrimary = function (id) {
    let hit = false;
    list.forEach((e) => {
      e.primary = e.id === id;
      if (e.primary) hit = true;
    });
    if (hit) save();
    return hit;
  };

  R.add = function (addr, comment) {
    const n = O.Servers.normalise(addr);
    if (!n.ok) return n;
    if (list.some((e) => e.addr.toLowerCase() === n.addr.toLowerCase())) {
      return { ok: false, error: 'That relay is already in your list.' };
    }
    const entry = { id: uid(), addr: n.addr, comment: String(comment || '').trim(), primary: false, builtin: false, lastOk: null, lastMs: null };
    list.push(entry);
    save();
    return { ok: true, entry: entry };
  };

  R.remove = function (id) {
    const i = list.findIndex((e) => e.id === id);
    if (i < 0) return false;
    const wasPrimary = list[i].primary;
    list.splice(i, 1);
    if (!list.length) list = seed();
    if (wasPrimary && !list.some((e) => e.primary)) list[0].primary = true;
    save();
    return true;
  };

  R.reset = function () {
    list = seed();
    if (list.length) list[0].primary = true;
    save();
    return list;
  };

  R.probe = async function (id, timeoutMs) {
    const e = R.get(id);
    if (!e) return { ok: false, error: 'gone' };
    const res = await O.Servers.ping(e.addr, timeoutMs || 7000);
    e.lastOk = res.ok;
    e.lastMs = res.ok ? res.ms : null;
    save();
    return res;
  };

  /* Shape the client expects: addr / comment / primary, with exactly one
   * primary — that is the relay a newly shared world registers itself with. */
  R.forOpts = function () {
    const all = R.all();
    const primaryId = (R.primary() || {}).id;
    return all.map((e) => ({ addr: e.addr, comment: e.comment || e.addr, primary: e.id === primaryId }));
  };

  load();
})(window.ORION);
