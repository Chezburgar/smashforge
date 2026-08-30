/* SMASHFORGE — screen manager and every menu except the Forge. */
(function (SB) {
  'use strict';
  const U = SB.U;

  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };
  const $ = (id) => document.getElementById(id);
  SB.el = el; SB.$ = $;

  const UI = {
    cur: 'sc-title',
    stack: [],
    show(id, push) {
      const old = $(this.cur);
      if (old) old.classList.remove('on', 'fade');
      if (push !== false && this.cur !== id) this.stack.push(this.cur);
      this.cur = id;
      const n = $(id);
      n.classList.add('on');
      void n.offsetWidth;
      n.classList.add('fade');
      SB.Audio.play('ui');
      if (UI.onShow[id]) UI.onShow[id]();
    },
    back() {
      const prev = this.stack.pop() || 'sc-title';
      SB.Audio.play('uiBack');
      const old = $(this.cur);
      if (old) old.classList.remove('on', 'fade');
      this.cur = prev;
      const n = $(prev);
      n.classList.add('on', 'fade');
      if (UI.onShow[prev]) UI.onShow[prev]();
    },
    onShow: {}
  };
  SB.UI = UI;

  let toastT = 0;
  SB.toast = function (msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove('on'), 1900);
  };

  /* ---------------- global game state ---------------- */
  const G = {
    roster: [],
    opts: SB.loadOpts(),
    mode: 'quick',
    picks: [],
    pickIdx: 0,
    cpuLevel: 1,
    stageId: 'terrace',
    rosterPurpose: 'select',
    selected: 0,
    editingIndex: -1
  };
  SB.G = G;

  /* ---------------- title ---------------- */
  function buildTitle() {
    const m = $('title-menu');
    m.innerHTML = '';
    const items = [
      ['FIGHT', 'primary', () => UI.show('sc-mode')],
      ['THE FORGE', '', () => { G.rosterPurpose = 'edit'; UI.show('sc-roster'); }],
      ['CONTROLS', 'ghost', () => UI.show('sc-controls')],
      ['OPTIONS', 'ghost', () => UI.show('sc-options')]
    ];
    items.forEach(([label, cls, fn]) => {
      const b = el('button', 'btn ' + cls, label);
      b.onclick = () => { SB.Audio.play('uiBig'); fn(); };
      m.appendChild(b);
    });
    $('title-stats').innerHTML =
      '<div>Moves<b>' + SB.MOVES.length + '</b></div>' +
      '<div>Cosmetics<b>' + SB.COS_COUNT + '</b></div>' +
      '<div>Weapons<b>' + SB.ARCHETYPES.length + '</b></div>' +
      '<div>Stages<b>' + SB.STAGES.length + '</b></div>';
  }

  /* ---------------- mode select ---------------- */
  const MODES = [
    { id: 'quick', name: 'Quick Fight', blurb: 'One-on-one against a CPU. Pick a fighter, pick a stage, go.', icon: '⚔' },
    { id: 'versus', name: 'Local Versus', blurb: 'Two players, one keyboard (or two gamepads). Settle it properly.', icon: '👥' },
    { id: 'gauntlet', name: 'Gauntlet', blurb: 'Endless waves of forged opponents. Each wave hits harder.', icon: '🔥' },
    { id: 'training', name: 'Training', blurb: 'Infinite stocks and a patient dummy. Learn your frame data.', icon: '🎯' }
  ];

  function buildModes() {
    const g = $('mode-grid');
    g.innerHTML = '';
    MODES.forEach((m) => {
      const c = el('div', 'card');
      c.innerHTML =
        '<div style="height:120px;display:grid;place-items:center;font-size:52px;background:radial-gradient(60% 70% at 50% 40%,rgba(79,195,247,.18),transparent 70%)">' + m.icon + '</div>' +
        '<div class="cbody"><div class="cname">' + m.name + '</div>' +
        '<div class="muted small" style="margin-top:5px;line-height:1.35">' + m.blurb + '</div></div>';
      c.onclick = () => {
        SB.Audio.play('uiBig');
        G.mode = m.id;
        G.picks = [];
        G.pickIdx = 0;
        G.rosterPurpose = 'select';
        UI.show('sc-roster');
      };
      g.appendChild(c);
    });
  }

  /* ---------------- roster ---------------- */
  function rosterNeeds() {
    if (G.mode === 'versus' || G.mode === 'training') return 2;
    return 1;
  }

  function buildRoster() {
    const g = $('roster-grid');
    g.innerHTML = '';
    const editing = G.rosterPurpose === 'edit';
    $('roster-title').textContent = editing ? 'THE FORGE' : ('SELECT FIGHTER ' + (G.pickIdx + 1) + '/' + rosterNeeds());
    $('roster-go').textContent = editing ? 'Open Forge →' : (G.pickIdx + 1 < rosterNeeds() ? 'Next →' : 'Confirm →');
    $('roster-hint').textContent = editing
      ? 'Choose a fighter to edit, or forge a new one from scratch.'
      : (G.mode === 'training' && G.pickIdx === 1 ? 'Pick the training dummy.'
        : (G.mode === 'versus' ? 'Player ' + (G.pickIdx + 1) + ', choose your fighter.' : 'Choose your fighter.'));

    G.roster.forEach((b, i) => {
      const c = el('div', 'card' + (i === G.selected ? ' sel' : ''));
      const arch = SB.archetype(b.archId);
      const style = SB.STYLES.find((s) => s.id === b.styleId) || SB.STYLES[0];
      const cv = el('canvas');
      c.appendChild(cv);
      const body = el('div', 'cbody');
      const tags = SB.buildTags(b).slice(0, 3).map((t) => '<span class="tag">' + t + '</span>').join('');
      body.innerHTML =
        '<div class="cname">' + escapeHtml(b.name) + '</div>' +
        '<div class="cmeta">' + style.name + ' ' + arch.kind + '</div>' +
        '<div class="tagrow">' + tags + '</div>';
      c.appendChild(body);
      const badge = el('div', 'badge', 'PWR ' + SB.powerRating(b));
      c.appendChild(badge);
      c.onclick = () => { G.selected = i; buildRoster(); SB.Audio.play('ui'); };
      c.ondblclick = () => { G.selected = i; confirmRoster(); };
      g.appendChild(c);
      requestAnimationFrame(() => { try { SB.renderThumb(cv, b, { t: 0.6 + i * 0.3 }); } catch (e) { } });
    });
  }

  function confirmRoster() {
    const b = G.roster[G.selected];
    if (!b) return;
    SB.Audio.play('uiBig');
    if (G.rosterPurpose === 'edit') {
      G.editingIndex = G.selected;
      SB.Designer.open(JSON.parse(JSON.stringify(b)));
      UI.show('sc-designer');
      return;
    }
    G.picks[G.pickIdx] = JSON.parse(JSON.stringify(b));
    G.pickIdx++;
    if (G.pickIdx < rosterNeeds()) { buildRoster(); return; }
    UI.show('sc-stage');
  }

  function wireRoster() {
    $('roster-go').onclick = confirmRoster;
    $('roster-edit').onclick = () => {
      G.editingIndex = G.selected;
      SB.Designer.open(JSON.parse(JSON.stringify(G.roster[G.selected])));
      UI.show('sc-designer');
    };
    $('roster-new').onclick = () => {
      G.editingIndex = -1;
      SB.Designer.open(SB.defaultBuild('New Fighter'));
      UI.show('sc-designer');
    };
    $('roster-random').onclick = () => {
      const b = SB.randomBuild();
      G.roster.push(b);
      G.selected = G.roster.length - 1;
      SB.saveRoster(G.roster);
      buildRoster();
      SB.toast('Forged ' + b.name);
    };
    $('roster-del').onclick = () => {
      if (G.roster.length <= 1) { SB.toast('Keep at least one fighter'); return; }
      const gone = G.roster.splice(G.selected, 1)[0];
      G.selected = Math.max(0, G.selected - 1);
      SB.saveRoster(G.roster);
      buildRoster();
      SB.toast('Deleted ' + gone.name);
    };
  }

  /* ---------------- stage select ---------------- */
  function buildStages() {
    const g = $('stage-grid');
    g.innerHTML = '';
    SB.STAGES.forEach((s) => {
      const c = el('div', 'card' + (s.id === G.stageId ? ' sel' : ''));
      const cv = el('canvas');
      c.appendChild(cv);
      c.appendChild(el('div', 'cbody',
        '<div class="cname">' + s.name + '</div>' +
        '<div class="muted small" style="margin-top:5px;line-height:1.35">' + s.blurb + '</div>'));
      c.onclick = () => { G.stageId = s.id; buildStages(); SB.Audio.play('ui'); };
      c.ondblclick = () => startMatch();
      g.appendChild(c);
      requestAnimationFrame(() => renderStageThumb(cv, s));
    });
    buildStageOpts();
  }

  function renderStageThumb(cv, s) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 200, H = cv.clientHeight || 152;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = { x: 0, y: -160 };
    SB.drawSky(ctx, s, cam, 0.4, W, H);
    ctx.save();
    ctx.translate(W / 2, H * 0.74);
    const sc = Math.min(W / 1080, H / 740);
    ctx.scale(sc, sc);
    SB.drawStage(ctx, s, 0.4);
    ctx.restore();
    SB.drawGrade(ctx, s, W, H, 0.4);
  }

  function buildStageOpts() {
    const o = $('stage-opts');
    o.innerHTML = '';
    if (G.mode === 'quick' || G.mode === 'gauntlet') {
      const lab = el('span', 'muted small', 'CPU&nbsp;');
      o.appendChild(lab);
      SB.AI_LEVELS.forEach((lv) => {
        const b = el('button', 'btn xs' + (G.cpuLevel === lv.id ? ' on' : ''), lv.name);
        b.onclick = () => { G.cpuLevel = lv.id; buildStageOpts(); };
        o.appendChild(b);
      });
    }
    if (G.mode !== 'training' && G.mode !== 'gauntlet') {
      o.appendChild(el('span', 'muted small', '&nbsp;&nbsp;STOCKS&nbsp;'));
      [1, 2, 3, 5].forEach((n) => {
        const b = el('button', 'btn xs' + (G.opts.stocks === n ? ' on' : ''), n + '');
        b.onclick = () => { G.opts.stocks = n; SB.saveOpts(G.opts); buildStageOpts(); };
        o.appendChild(b);
      });
      o.appendChild(el('span', 'muted small', '&nbsp;&nbsp;TIME&nbsp;'));
      [60, 120, 180, 0].forEach((n) => {
        const b = el('button', 'btn xs' + (G.opts.time === n ? ' on' : ''), n ? (n / 60) + 'm' : '∞');
        b.onclick = () => { G.opts.time = n; SB.saveOpts(G.opts); buildStageOpts(); };
        o.appendChild(b);
      });
    }
  }

  /* ---------------- launching ---------------- */
  function startMatch() {
    const fs = [];
    const p1 = G.picks[0] || G.roster[0];
    fs.push({ build: p1, human: true, inputSlot: 'p1', padIndex: SB.Input.padCount() > 0 ? 0 : null, color: SB.PLAYER_COLS[0] });

    if (G.mode === 'versus') {
      fs.push({ build: G.picks[1] || SB.randomBuild(), human: true, inputSlot: 'p2', padIndex: SB.Input.padCount() > 1 ? 1 : null, color: SB.PLAYER_COLS[1] });
    } else if (G.mode === 'training') {
      fs.push({ build: G.picks[1] || SB.randomBuild(), human: false, level: 0, color: SB.PLAYER_COLS[1] });
    } else if (G.mode === 'gauntlet') {
      fs.push({ build: SB.randomBuild('wave1_0'), human: false, level: 0, color: SB.PLAYER_COLS[1] });
    } else {
      fs.push({ build: SB.randomBuild('cpu' + Date.now()), human: false, level: G.cpuLevel, color: SB.PLAYER_COLS[1] });
    }

    const cfg = {
      stageId: G.stageId,
      mode: G.mode,
      fighters: fs,
      stocks: G.mode === 'gauntlet' ? 3 : (G.mode === 'training' ? 99 : G.opts.stocks),
      timeLimit: (G.mode === 'training' || G.mode === 'gauntlet') ? 0 : G.opts.time
    };
    SB.startMatch(cfg);
  }
  SB.startMatchFromMenu = startMatch;

  /* ---------------- results ---------------- */
  SB.showResults = function (m) {
    const r = m.result;
    $('res-title').textContent = m.mode === 'gauntlet'
      ? (r.winner ? 'SURVIVED' : 'WAVE ' + r.wave)
      : (r.winner ? 'GAME' : (r.how === 'draw' ? 'DRAW' : 'TIME'));
    $('res-sub').textContent = m.mode === 'gauntlet'
      ? 'You cleared ' + (r.wave - 1) + ' wave' + (r.wave - 1 === 1 ? '' : 's') + ' on ' + m.stage.name + '.'
      : (r.winner
        ? r.winner.name + (r.how === 'double' ? ' survives the double KO' : ' takes it') + ' on ' + m.stage.name + '.'
        : (r.how === 'draw' ? 'Both fighters went out together on ' + m.stage.name + '.' : 'Time ran out on ' + m.stage.name + '.'));
    const tb = $('res-rows');
    tb.innerHTML = '';
    r.rows.forEach((row) => {
      const tr = el('tr', r.winner && row.fighter === r.winner ? 'win' : '');
      tr.innerHTML =
        '<td><span class="dot" style="background:' + row.col + '"></span>' + escapeHtml(row.name) + '</td>' +
        '<td>' + row.kos + '</td><td>' + row.falls + '</td>' +
        '<td>' + row.dealt + '</td><td>' + row.taken + '</td><td>' + row.biggest + '</td>';
      tb.appendChild(tr);
    });
    UI.show('sc-results');
  };

  /* ---------------- controls ---------------- */
  function buildControls() {
    const b = $('controls-body');
    const keyRow = (binds, title) => {
      const rows = [
        ['Move / Aim', binds.left + ' ' + binds.right + ' ' + binds.up + ' ' + binds.down],
        ['Jump / Double Jump', binds.jump],
        ['Light Attack', binds.light],
        ['Signature (hold to charge)', binds.sig],
        ['Weapon Special', binds.special],
        ['Dodge / Roll / Air Dodge', binds.dodge],
        ['Shield', binds.shield],
        ['Taunt', binds.taunt]
      ];
      return '<div class="panel pad" style="margin-bottom:16px"><h3 style="margin-bottom:12px;letter-spacing:.16em;font-size:14px;color:var(--acc)">' + title + '</h3><div class="keys">' +
        rows.map((r) => '<div class="key"><b>' + pretty(r[1]) + '</b><span>' + r[0] + '</span></div>').join('') +
        '</div></div>';
    };
    b.innerHTML =
      keyRow(SB.DEFAULT_BINDS.p1, 'PLAYER 1 — KEYBOARD') +
      keyRow(SB.DEFAULT_BINDS.p2, 'PLAYER 2 — KEYBOARD') +
      '<div class="panel pad" style="margin-bottom:16px"><h3 style="margin-bottom:12px;letter-spacing:.16em;font-size:14px;color:var(--acc)">GAMEPAD</h3><div class="keys">' +
      [['Move', 'Stick / D-Pad'], ['Jump', 'A'], ['Light', 'X'], ['Signature', 'Y'], ['Special', 'B'],
      ['Dodge', 'RB / RT'], ['Shield', 'LB / LT'], ['Taunt', 'Start']]
        .map((r) => '<div class="key"><b>' + r[1] + '</b><span>' + r[0] + '</span></div>').join('') +
      '</div><div class="muted small" style="margin-top:10px">Pads are picked up automatically — plug one in and press a button.</div></div>' +
      '<div class="panel pad"><h3 style="margin-bottom:10px;letter-spacing:.16em;font-size:14px;color:var(--acc2)">HOW FIGHTS WORK</h3>' +
      '<div class="muted" style="line-height:1.65;font-size:14.5px">' +
      'Health drops as you take hits — and the lower it goes, the further every hit sends you. ' +
      'You lose a stock by running out of health <b>or</b> by flying past the blast zone, so a fresh fighter is hard to launch and a hurt one is one clean signature from the void.<br><br>' +
      '<b>Light attacks</b> chain into each other. <b>Signatures</b> are slow, chargeable and lethal. <b>Dodges</b> have real invincibility frames but leave you open on the way out. ' +
      'Repeating the same move stales it, so mix the kit.<br><br>' +
      'Off the edge, hold toward the stage and use your double jumps, then your <b>Recovery</b> (Signature while airborne). Grab a ledge and you get your jumps back.' +
      '</div></div>';
  }
  function pretty(code) {
    return String(code).replace('Key', '').replace('Arrow', '').replace('Numpad', 'Num ')
      .replace('ShiftLeft', 'Shift').replace('Decimal', '.').replace('Space', 'Space');
  }

  /* ---------------- options ---------------- */
  function buildOptions() {
    const b = $('options-body');
    b.innerHTML = '';
    const p = el('div', 'panel pad');
    const mk = (label, min, max, step, val, fn, fmt) => {
      const row = el('div', 'field');
      row.appendChild(el('label', '', label));
      const g = el('div', 'grow');
      const r = el('input');
      r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = val;
      const out = el('span', 'mono', fmt ? fmt(val) : val);
      out.style.minWidth = '48px';
      r.oninput = () => { fn(parseFloat(r.value)); out.textContent = fmt ? fmt(r.value) : r.value; };
      g.appendChild(r); g.appendChild(out);
      row.appendChild(g);
      p.appendChild(row);
    };
    mk('SFX', 0, 1, 0.05, G.opts.sfx, (v) => { G.opts.sfx = v; SB.Audio.setSfx(v); SB.saveOpts(G.opts); }, (v) => Math.round(v * 100) + '%');
    mk('Music', 0, 1, 0.05, G.opts.mus, (v) => { G.opts.mus = v; SB.Audio.setMus(v); SB.saveOpts(G.opts); }, (v) => Math.round(v * 100) + '%');
    mk('Screen Shake', 0, 1.5, 0.05, G.opts.shake, (v) => { G.opts.shake = v; SB.saveOpts(G.opts); }, (v) => Math.round(v * 100) + '%');

    const tog = (label, key, onChange) => {
      const row = el('div', 'field');
      row.appendChild(el('label', '', label));
      const btn = el('button', 'btn sm' + (G.opts[key] ? ' on' : ''), G.opts[key] ? 'ON' : 'OFF');
      btn.onclick = () => {
        G.opts[key] = !G.opts[key];
        btn.className = 'btn sm' + (G.opts[key] ? ' on' : '');
        btn.textContent = G.opts[key] ? 'ON' : 'OFF';
        SB.saveOpts(G.opts);
        if (onChange) onChange();
      };
      const g = el('div', 'grow'); g.appendChild(btn);
      row.appendChild(g);
      p.appendChild(row);
    };
    tog('Show Hitboxes', 'hitboxes', () => { if (SB.match) SB.match.hitboxDebug = G.opts.hitboxes; });
    b.appendChild(p);

    const p2 = el('div', 'panel pad');
    p2.style.marginTop = '16px';
    p2.innerHTML = '<h3 style="letter-spacing:.16em;font-size:13px;color:var(--acc);margin-bottom:10px">SAVE DATA</h3>' +
      '<div class="muted small" style="margin-bottom:12px">Your roster lives in this browser. ' + G.roster.length + ' fighter(s) saved.</div>';
    const row = el('div', 'row');
    const exp = el('button', 'btn sm', 'Export Roster');
    exp.onclick = () => {
      const data = JSON.stringify(G.roster, null, 2);
      const w = window.open('', '_blank');
      if (w) { w.document.write('<pre style="white-space:pre-wrap;font:12px monospace;background:#0b1020;color:#dfe8f5;padding:16px">' + escapeHtml(data) + '</pre>'); }
      else SB.toast('Popup blocked — allow popups to export');
    };
    const wipe = el('button', 'btn sm warn', 'Reset Roster');
    wipe.onclick = () => {
      if (!confirm('Delete every saved fighter and start fresh?')) return;
      try { localStorage.removeItem('smashforge.roster.v1'); } catch (e) { }
      G.roster = SB.loadRoster();
      G.selected = 0;
      SB.toast('Roster reset');
      buildOptions();
    };
    row.appendChild(exp); row.appendChild(wipe);
    p2.appendChild(row);
    b.appendChild(p2);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  SB.escapeHtml = escapeHtml;

  /* ---------------- wiring ---------------- */
  UI.onShow['sc-title'] = buildTitle;
  UI.onShow['sc-mode'] = buildModes;
  UI.onShow['sc-roster'] = buildRoster;
  UI.onShow['sc-stage'] = buildStages;
  UI.onShow['sc-controls'] = buildControls;
  UI.onShow['sc-options'] = buildOptions;

  SB.initScreens = function () {
    G.roster = SB.loadRoster();
    SB.saveRoster(G.roster);
    SB.Audio.setSfx(G.opts.sfx);
    SB.Audio.setMus(G.opts.mus);

    document.querySelectorAll('[data-back]').forEach((b) => { b.onclick = () => UI.back(); });
    wireRoster();
    $('stage-go').onclick = startMatch;
    $('res-again').onclick = () => { SB.Audio.play('uiBig'); startMatch(); };
    $('res-menu').onclick = () => {
      UI.stack.length = 0;
      UI.show('sc-title', false);
    };
    buildTitle();
  };
})(window.SB);
