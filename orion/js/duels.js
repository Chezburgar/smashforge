/* ORION CLIENT — duels
 *
 * Host a lobby, hand somebody a five-character code, fight best of three with
 * the same kit. Orion runs the lobby and the scoreboard; the fight itself is an
 * ordinary shared world, which is what puts it through the relay and the TURN
 * servers like any other game between two browsers.
 *
 * What this cannot be, and pretending otherwise would be a lie in the
 * interface: a game mode. The client is signed and compiled — nothing can be
 * added inside it, no plugin sees a kill, and there is no server to referee.
 * So rounds are reported by the people playing them, and reported in the one
 * way that cannot be gamed: **conceding is instant, winning has to be agreed**.
 * Nobody claims a loss they did not take, so "I lost that one" is trusted on
 * sight, while "I won that one" waits for the other player to concede it. Two
 * players claiming the same round is shown to both as a disagreement rather
 * than settled by whoever clicked first.
 *
 * The kit is a list of commands rather than an inventory Orion can write: a
 * resource pack cannot give anybody an iron sword. The host pastes them into
 * chat, which is why the world has to be opened to LAN with cheats on.
 */
window.ORION = window.ORION || {};
(function (O) {
  'use strict';

  const D = {};
  O.Duels = D;

  /* ------------------------------------------------------------------ kits
   * 1.8 command syntax, and checked against it rather than 1.12's: `/give`
   * takes a count as its third argument, `@a` is everyone in the world, and
   * `@e[type=Item]` is the litter left on the floor after a round. */
  const KITS = {
    basic: {
      id: 'basic',
      label: 'Basic kit',
      blurb: 'Iron armour, an iron sword, a bow and a couple of apples — the same for both of you.',
      items: [
        'Iron sword',
        'Full iron armour',
        'Bow and 16 arrows',
        '16 steak',
        '2 golden apples'
      ],
      /* Run once, when the world is first opened. */
      arena: [
        '/difficulty 3',
        '/gamerule doDaylightCycle false',
        '/gamerule doWeatherCycle false',
        '/gamerule doMobSpawning false',
        '/gamerule keepInventory false',
        '/time set 6000',
        '/weather clear'
      ],
      /* Run at the start of every round: clear the floor, heal and feed both
       * players, hand out the kit again. */
      round: [
        '/kill @e[type=Item]',
        '/clear @a',
        '/effect @a minecraft:instant_health 1 20',
        '/effect @a minecraft:saturation 2 20',
        '/give @a minecraft:iron_sword 1',
        '/give @a minecraft:iron_helmet 1',
        '/give @a minecraft:iron_chestplate 1',
        '/give @a minecraft:iron_leggings 1',
        '/give @a minecraft:iron_boots 1',
        '/give @a minecraft:bow 1',
        '/give @a minecraft:arrow 16',
        '/give @a minecraft:cooked_beef 16',
        '/give @a minecraft:golden_apple 2'
      ]
    }
  };

  D.kits = () => Object.keys(KITS).map((k) => ({ id: k, label: KITS[k].label, blurb: KITS[k].blurb }));
  D.kit = (id) => KITS[id] || KITS.basic;

  /* ------------------------------------------------------------------- rpc */

  const acct = () => O.Account;

  async function call(fn, args) {
    const A = acct();
    if (!A || !A.signedIn()) throw new Error('Sign in first — a duel needs two named players.');
    return A.rpc(fn, Object.assign({ p_token: A.token() }, args || {}));
  }

  /* Every call comes back the same way, so the UI has one shape to render and
   * one shape to report a failure with. */
  async function attempt(fn, args) {
    try {
      return { ok: true, duel: await call(fn, args) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  D.create = (bestOf, kit) => attempt('orion_client_duel_create', {
    p_best_of: bestOf || 3,
    p_kit: kit || 'basic'
  });
  D.join = (code) => attempt('orion_client_duel_join', { p_code: String(code || '').trim() });
  D.mine = () => attempt('orion_client_duel_mine', {});
  D.state = (id) => attempt('orion_client_duel_state', { p_id: id });
  D.ready = (id, on) => attempt('orion_client_duel_ready', { p_id: id, p_ready: !!on });
  D.rematch = (id) => attempt('orion_client_duel_rematch', { p_id: id });

  /* winner is 'me' or 'them', said by whoever is calling. */
  D.report = (id, round, winner) => attempt('orion_client_duel_report', {
    p_id: id, p_round: round, p_winner: winner
  });

  D.leave = async function (id) {
    try {
      await call('orion_client_duel_leave', { p_id: id });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };

  /* ---------------------------------------------------------------- reading
   * The same duel looks different from each side, and every screen needs the
   * same handful of answers about it. Working them out in one place keeps the
   * rendering free of "am I the host" arithmetic. */
  D.read = function (duel) {
    if (!duel) return null;
    const mine = duel.youAre === 'guest' ? duel.guest : duel.host;
    const theirs = duel.youAre === 'guest' ? duel.host : duel.guest;
    const played = (duel.rounds || []).length;
    const claim = duel.claim || null;
    const claimMine = !!claim && claim.by === duel.youAre;

    return {
      id: duel.id,
      code: duel.code,
      state: duel.state,
      bestOf: duel.bestOf,
      needed: duel.needed,
      kit: D.kit(duel.kit),
      me: mine,
      them: theirs,
      myWins: (mine && mine.wins) || 0,
      theirWins: (theirs && theirs.wins) || 0,
      round: played + 1,
      rounds: duel.rounds || [],
      /* A claim waiting on me is the only thing that needs answering. */
      claim: claim,
      claimIsMine: claimMine,
      awaitingMe: !!claim && !claim.conflict && !claimMine,
      conflict: !!(claim && claim.conflict),
      bothReady: !!(mine && mine.ready && theirs && theirs.ready),
      waitingForOpponent: !duel.guest,
      finished: duel.state === 'done',
      iWon: duel.state === 'done' && !!mine && duel.winner === mine.id,
      winnerName: duel.state === 'done'
        ? (duel.winner === (duel.host && duel.host.id) ? duel.host.name : (duel.guest && duel.guest.name))
        : null
    };
  };

  /* ---------------------------------------------------------------- polling
   * Both sides are looking at rows only the other one writes, so the page has
   * to ask. Same cadence as the friends list, and it stops itself the moment
   * the duel is gone rather than hammering a dead id. */
  D.watch = function (id, onUpdate, everyMs) {
    let live = true;
    let timer = null;

    async function tick() {
      if (!live) return;
      const res = await D.state(id);
      if (!live) return;
      if (res.ok) {
        onUpdate(res.duel, null);
      } else {
        onUpdate(null, res.error);
        /* A duel that has been cancelled or swept is not coming back. */
        if (/not yours|is over/i.test(res.error || '')) return stop();
      }
      timer = setTimeout(tick, everyMs || ((O.config && O.config.api && O.config.api.pollMs) || 5000));
    }

    function stop() {
      live = false;
      if (timer) clearTimeout(timer);
      timer = null;
    }

    tick();
    return stop;
  };
})(window.ORION);
