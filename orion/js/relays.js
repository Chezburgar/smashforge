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

  const KEY = 'orion.relays.v2';
  const OLD_KEY = 'orion.relays.v1';
  const R = {};
  O.Relays = R;

  /* The public relays shipped with EaglercraftX, run by the Eaglercraft
   * community rather than by Orion. */
  const PUBLIC = [
    { addr: 'wss://relay.deev.is/', comment: 'lax1dude relay #1' },
    { addr: 'wss://relay.lax1dude.net/', comment: 'lax1dude relay #2' },
    { addr: 'wss://relay.shhnowisnottheti.me/', comment: 'ayunami relay #1' }
  ];

  /* Orion's own front door to those same relays. It forwards every byte
   * unchanged, and it lives on the host Orion already uses for accounts — so on
   * a network that blocks relay.deev.is but lets you sign in, this is the one
   * that gets through. Each entry pins the relay it forwards to, because a
   * shared world is registered with one relay: the people joining scan every
   * relay in their own list, so the host's has to be somewhere in it.
   * Source and limits: orion/relay/. */
  function orionRelays() {
    const base = (O.config && O.config.relay && O.config.relay.url) || '';
    if (!base) return [];
    const at = (host, label) => {
      let addr;
      try {
        const u = new URL(base);
        u.searchParams.set('to', host);
        /* Configured as https:// so the same address can be fetched as a plain
         * health check; a relay address has to be the WebSocket form of it. */
        addr = u.toString().replace(/^http/i, 'ws');
      } catch (e) {
        return null;
      }
      return { addr: addr, comment: label, orion: true };
    };
    return [at('relay.deev.is', 'Orion relay'), at('relay.lax1dude.net', 'Orion relay (backup)')]
      .filter(Boolean);
  }

  /* The public relays first, and Orion's own behind them as the fallback.
   * That order matters: Orion's proxy is capped at about 150 seconds per
   * connection, which costs a host nothing on a network where the public
   * relays already work — so it is not made primary until one is needed. When
   * the public ones cannot be reached, ensureReachable below moves to it
   * automatically, and because the proxy forwards to that same public relay,
   * someone stuck behind it still sees the worlds everyone else can see. */
  const defaults = () => PUBLIC.concat(orionRelays());

  let list = [];

  const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function seed() {
    return defaults().map((d, i) => ({
      id: uid(),
      addr: d.addr,
      comment: d.comment,
      primary: i === 0,
      builtin: true,
      orion: !!d.orion,
      lastOk: null,
      lastMs: null
    }));
  }

  /* Relay books saved before Orion had a relay of its own hold only the public
   * ones. Rather than throw that away, keep anything the person added
   * themselves and rebuild the built-in half around it. */
  function migrate() {
    let old;
    try {
      old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
    } catch (e) {
      return null;
    }
    if (!Array.isArray(old) || !old.length) return null;
    const mine = old
      .filter((e) => e && typeof e.addr === 'string' && !e.builtin)
      .map((e) => ({
        id: e.id || uid(),
        addr: e.addr,
        comment: e.comment || '',
        primary: false,
        builtin: false,
        orion: false,
        lastOk: null,
        lastMs: null
      }));
    return seed().concat(mine);
  }

  function load() {
    let migrated = false;
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) {
        list = parsed.filter((e) => e && typeof e.addr === 'string');
      } else {
        list = migrate() || seed();
        migrated = true;
      }
    } catch (e) {
      list = seed();
      migrated = true;
    }
    if (!list.some((e) => e.primary) && list.length) list[0].primary = true;
    if (migrated) save();
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
    const entry = { id: uid(), addr: n.addr, comment: String(comment || '').trim(), primary: false, builtin: false, orion: false, lastOk: null, lastMs: null };
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

  /* Run just before a launch. The game is handed one primary relay and sticks
   * with it, so handing it one this network cannot open is the difference
   * between "no worlds ever appear" and everything working. Each candidate gets
   * a short budget rather than the full ping timeout, because this sits in
   * front of the launch and a slow start is its own kind of broken. */
  R.ensureReachable = async function (timeoutMs, totalMs) {
    const budget = timeoutMs || 3500;
    /* A whole list of dead relays must not turn into half a minute of staring
     * at the boot screen, so the search gives up rather than trying them all. */
    const deadline = Date.now() + (totalMs || 11000);
    const first = R.primary();
    if (!first) return { ok: false, changed: false, tried: [] };

    /* Orion's own relays come straight after the current primary rather than in
     * list order: they are the ones most likely to answer when the primary did
     * not, and a launch cannot sit through every dead address first. */
    const rest = list.filter((e) => e.id !== first.id);
    const order = [first]
      .concat(rest.filter((e) => e.orion))
      .concat(rest.filter((e) => !e.orion));
    const tried = [];
    for (const e of order) {
      if (tried.length && Date.now() > deadline) break;
      const res = await O.Servers.ping(e.addr, budget);
      e.lastOk = res.ok;
      e.lastMs = res.ok ? res.ms : null;
      tried.push({ id: e.id, comment: e.comment || e.addr, ok: res.ok, ms: res.ms || null });
      if (res.ok) {
        const changed = e.id !== first.id;
        if (changed) R.setPrimary(e.id);
        else save();
        return { ok: true, changed: changed, entry: e, tried: tried };
      }
    }
    save();
    return { ok: false, changed: false, tried: tried };
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
