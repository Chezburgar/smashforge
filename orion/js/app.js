/* ORION CLIENT — launcher UI */
(function () {
  'use strict';

  const O = window.ORION;
  const S = O.Servers;
  const L = O.Launcher;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* Every server name, note and address can arrive from a share link, so
   * nothing user-supplied is ever interpolated into HTML unescaped. */
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  O.warn = (msg) => notice('srv-notice', 'warn', msg);

  function notice(id, kind, html) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!html) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<div class="note ' + kind + '">' + html + '</div>';
  }

  /* ============================== starfield ============================== */
  (function stars() {
    const cv = $('#stars');
    const ctx = cv.getContext('2d');
    let pts = [];

    function build() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.floor(innerWidth * dpr);
      cv.height = Math.floor(innerHeight * dpr);
      cv.style.width = innerWidth + 'px';
      cv.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((innerWidth * innerHeight) / 9000);
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        r: Math.random() * 1.15 + 0.25,
        a: Math.random() * 0.5 + 0.16,
        s: Math.random() * 0.8 + 0.2,
        p: Math.random() * Math.PI * 2
      }));
    }

    let raf = null;
    function frame(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of pts) {
        const tw = 0.62 + 0.38 * Math.sin(t / 1000 * p.s + p.p);
        ctx.globalAlpha = p.a * tw;
        ctx.fillStyle = p.r > 1.05 ? '#cdd6ff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    build();
    raf = requestAnimationFrame(frame);
    addEventListener('resize', build);
    /* Stop burning frames once the game owns the screen. */
    O.stopStars = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      cv.style.display = 'none';
    };
  })();

  /* ============================== navigation ============================== */
  function show(view) {
    $$('.view').forEach((v) => v.classList.toggle('on', v.id === 'v-' + view));
    $$('nav.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    if (location.hash !== '#' + view) {
      try { history.replaceState(null, '', '#' + view); } catch (e) { /* ignore */ }
    }
    if (view === 'setup') refreshSetup();
    if (view === 'friends') { renderRelays(); renderTurn(); }
    if (view === 'players') { renderLobby(); pollLobby(); }
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  $$('nav.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]');
    if (a) {
      e.preventDefault();
      show(a.dataset.goto);
    }
  });

  /* ============================== versions ============================== */
  const Vs = O.Versions;
  let probeCache = null;      // probe of the selected version
  let probeAll = null;        // probe of every version, for the picker

  /* Two buttons launch the client — the hero and the play-together card — so
   * they are enabled and disabled together. */
  function setLaunchEnabled(on) {
    ['#btn-launch', '#btn-launch-2'].forEach((sel) => {
      const b = $(sel);
      if (b) b.disabled = !on;
    });
  }

  const fmtSize = (n) =>
    n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : n + ' B';

  function renderVersionPicker() {
    const box = $('#version-pick');
    if (!box) return;
    const sel = Vs.selected();

    box.innerHTML =
      '<div style="font-size:12.5px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:var(--txt3);margin-bottom:9px">Version</div>' +
      '<div class="ver-row">' +
      Vs.all().map(function (v) {
        const p = probeAll && probeAll[v.id];
        const bad = p && !p.ready;
        return (
          '<button class="ver' + (v.id === sel.id ? ' on' : '') + (bad ? ' bad' : '') + '"' +
          ' data-ver="' + esc(v.id) + '"' +
          (bad ? ' title="Not installed"' : '') + '>' +
          '<span class="ver-num">' + esc(v.label) + '</span>' +
          '<span class="ver-note">' + esc(v.note) + (bad ? ' · not installed' : '') + '</span>' +
          '</button>'
        );
      }).join('') +
      '</div>';
  }

  $('#version-pick').addEventListener('click', async function (ev) {
    const btn = ev.target.closest('button[data-ver]');
    if (!btn) return;
    if (L.hasLaunched()) return;
    Vs.select(btn.dataset.ver);
    renderVersionPicker();
    await refreshBundle();
  });

  async function refreshBundle() {
    const play = $('#bundle-state');
    play.innerHTML = '<div class="note">Looking for the client…</div>';
    setLaunchEnabled(false);

    probeAll = await L.probeAll();
    const v = Vs.selected();
    const p = probeAll[v.id];
    probeCache = p;
    renderVersionPicker();

    if (p.ready) {
      play.innerHTML =
        '<div class="note ok"><strong>' + esc(v.label) + ' ready.</strong> ' +
        esc(fmtSize(p.totalBytes)) + ' to download on first launch, then cached by your browser.' +
        (p.signature && p.signature.ok ? ' Signed build — the signature is passed through.' : '') +
        '</div>';
      setLaunchEnabled(true);
    } else {
      play.innerHTML =
        '<div class="note warn"><strong>' + esc(v.label) + ' is not installed.</strong> ' +
        'Orion could not find ' + p.missing.map((m) => '<code>' + esc(m) + '</code>').join(' or ') +
        ' in <code>' + esc(p.base) + '</code>. ' +
        '<a href="#" data-goto="setup">Set it up →</a></div>';
      setLaunchEnabled(false);
    }
    renderQuickJoin();
    return p;
  }

  async function refreshSetup() {
    $('#f-base').value = L.root();
    const v = Vs.selected();
    $('#opts-preview').textContent = JSON.stringify(L.buildOpts(v, 'game_frame', null), null, 2);

    const box = $('#setup-state');
    box.innerHTML = '<div class="note">Checking…</div>';
    probeAll = probeAll || (await L.probeAll());

    box.innerHTML = Vs.all().map(function (ver) {
      const p = probeAll[ver.id];
      const rows = ver.scripts.map(function (name) {
        const r = p.scripts[name];
        return '<tr><td>' + esc(name) + '</td><td>' +
          (r.ok
            ? '<span class="pill ok">found</span>' + (r.size ? ' <span class="muted">' + fmtSize(r.size) + '</span>' : '')
            : '<span class="pill bad">missing</span>' + (r.status ? ' <span class="muted">HTTP ' + r.status + '</span>' : '')) +
          '</td><td class="mono muted">' + esc(L.scriptURL(ver, name)) + '</td></tr>';
      });
      if (ver.signature) {
        const sr = p.signature || { ok: false };
        rows.push('<tr><td>' + esc(ver.signature) + '</td><td>' +
          (sr.ok ? '<span class="pill ok">found</span>' : '<span class="pill">optional</span>') +
          '</td><td class="mono muted">' + esc(L.signatureURL(ver)) + '</td></tr>');
      }
      return '<h3 style="margin-top:18px">' + esc(ver.label) +
        (ver.isDefault ? ' <span class="pill ok">default</span>' : '') +
        (Vs.selected().id === ver.id ? ' <span class="pill">selected</span>' : '') + '</h3>' +
        '<p class="muted">' + esc(ver.note) + ' · options passed as <code>' +
        (ver.optsMode === 'hints' ? 'eaglercraftXOptsHints' : 'eaglercraftXOpts') + '</code> · ' +
        (ver.autoStart ? 'starts itself' : 'started by Orion calling <code>main()</code>') +
        ' · worlds in <code>' + esc(ver.worldsDB) + '</code></p>' +
        (p.ready
          ? '<div class="note ok">Ready to launch — ' + esc(fmtSize(p.totalBytes)) + ' total.</div>'
          : '<div class="note warn">Not launchable: missing ' + p.missing.map(esc).join(', ') + '.</div>') +
        '<table class="tbl"><thead><tr><th>File</th><th>Status</th><th>URL</th></tr></thead><tbody>' +
        rows.join('') + '</tbody></table>';
    }).join('');
  }

  $('#btn-base-save').addEventListener('click', async () => {
    const res = L.setRoot($('#f-base').value);
    const err = $('#base-error');
    if (!res.ok) {
      err.textContent = res.error;
      err.classList.remove('hide');
      return;
    }
    err.classList.add('hide');
    probeCache = null;
    await refreshBundle();
    await refreshSetup();
  });

  $('#btn-base-reset').addEventListener('click', async () => {
    L.setRoot('');
    $('#base-error').classList.add('hide');
    probeCache = null;
    await refreshBundle();
    await refreshSetup();
  });

  /* ============================== server list ============================== */
  let editing = null;

  function mixedCheck() {
    const el = $('#mixed-warning');
    const bad = S.all().filter((e) => S.isBlockedMixed(e.addr));
    if (!bad.length) {
      el.classList.add('hide');
      return;
    }
    el.classList.remove('hide');
    el.innerHTML =
      '<strong>' + bad.length + ' server' + (bad.length > 1 ? 's' : '') + ' cannot be reached from this page.</strong> ' +
      'Orion is served over HTTPS, and browsers block plain <code>ws://</code> connections from a secure page. ' +
      'Those servers need a <code>wss://</code> address — <a href="#" data-goto="host">how to add TLS →</a>';
  }

  function statusBits(e) {
    if (S.isBlockedMixed(e.addr)) return { cls: 'bad', text: '<span class="bad">Blocked — needs wss://</span>' };
    if (e.lastOk === true) return { cls: 'ok', text: '<span class="ok">Answered in ' + e.lastMs + ' ms</span>' };
    if (e.lastOk === false) return { cls: 'bad', text: '<span class="bad">Did not answer</span>' };
    return { cls: '', text: '<span class="muted">Not tested yet</span>' };
  }

  function renderList() {
    const wrap = $('#srv-list');
    const all = S.all();
    $('#srv-count').textContent = String(all.length);
    mixedCheck();

    if (!all.length) {
      wrap.innerHTML =
        '<div class="empty"><img src="assets/orion-logo.svg" alt="">' +
        '<p>No servers saved yet. Add one below — or see <a href="#" data-goto="host">how to run your own</a>.</p></div>';
      renderQuickJoin();
      return;
    }

    wrap.innerHTML = all
      .map(function (e, i) {
        const st = statusBits(e);
        return (
          '<div class="srv" data-id="' + esc(e.id) + '">' +
          '<div class="dot ' + st.cls + '" data-dot></div>' +
          '<div>' +
          '<div class="srv-name">' + esc(e.name) + '</div>' +
          '<div class="srv-addr">' + esc(e.addr) + '</div>' +
          '<div class="srv-meta" data-meta>' + st.text +
          (e.note ? ' · ' + esc(e.note) : '') + '</div>' +
          '</div>' +
          '<div class="srv-acts">' +
          '<button class="btn slim primary" data-act="join">Join</button>' +
          '<button class="btn slim" data-act="ping">Test</button>' +
          '<button class="btn slim" data-act="share">Share</button>' +
          '<button class="btn slim" data-act="edit">Edit</button>' +
          '<button class="btn slim ghost" data-act="up" ' + (i === 0 ? 'disabled' : '') + ' title="Move up">↑</button>' +
          '<button class="btn slim ghost" data-act="down" ' + (i === all.length - 1 ? 'disabled' : '') + ' title="Move down">↓</button>' +
          '<button class="btn slim ghost danger" data-act="del">Remove</button>' +
          '</div></div>'
        );
      })
      .join('');

    renderQuickJoin();
  }

  function renderQuickJoin() {
    const box = $('#quick-join');
    const all = S.all();
    if (!all.length) {
      box.innerHTML = '<p class="muted">Your server book is empty. <a href="#" data-goto="servers">Add a server →</a></p>';
      return;
    }
    const ready = probeCache && probeCache.ready;
    box.innerHTML =
      '<div class="btn-row">' +
      '<select id="qj-pick" style="max-width:420px">' +
      all
        .map((e) => '<option value="' + esc(e.id) + '">' + esc(e.name) + ' — ' + esc(S.hostLabel(e.addr)) + '</option>')
        .join('') +
      '</select>' +
      '<button class="btn primary" id="qj-go"' + (ready ? '' : ' disabled') + '>Launch &amp; join</button>' +
      '</div>' +
      (ready ? '' : '<p class="muted" style="margin-top:12px">Install a client bundle to enable this. <a href="#" data-goto="setup">Client setup →</a></p>');

    const go = $('#qj-go');
    if (go) go.addEventListener('click', () => launch(S.get($('#qj-pick').value)));
  }

  $('#srv-list').addEventListener('click', async function (ev) {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const card = btn.closest('.srv');
    const id = card.dataset.id;
    const e = S.get(id);
    if (!e) return;

    switch (btn.dataset.act) {
      case 'join':
        launch(e);
        break;

      case 'ping': {
        const dot = card.querySelector('[data-dot]');
        const meta = card.querySelector('[data-meta]');
        dot.className = 'dot busy';
        meta.innerHTML = '<span class="muted">Testing…</span>';
        btn.disabled = true;
        const res = await S.probe(id);
        btn.disabled = false;
        dot.className = 'dot ' + (res.ok ? 'ok' : 'bad');
        meta.innerHTML = res.ok
          ? '<span class="ok">Answered in ' + res.ms + ' ms</span>'
          : '<span class="bad">' + esc(res.detail || 'Did not answer') + '</span>';
        mixedCheck();
        break;
      }

      case 'share': {
        const link = S.shareLink(e);
        let copied = false;
        try {
          await navigator.clipboard.writeText(link);
          copied = true;
        } catch (err) { /* clipboard blocked — show the link instead */ }
        notice(
          'srv-notice',
          'ok',
          copied
            ? '<strong>Share link copied.</strong> Anyone who opens it gets ' + esc(e.name) + ' added to their Orion.'
            : '<strong>Share link for ' + esc(e.name) + ':</strong><br><span class="mono">' + esc(link) + '</span>'
        );
        break;
      }

      case 'edit':
        editing = e;
        $('#form-title').textContent = 'Edit server';
        $('#f-name').value = e.name;
        $('#f-addr').value = e.addr;
        $('#f-note').value = e.note || '';
        $('#btn-save').textContent = 'Save changes';
        $('#btn-cancel').style.display = '';
        $('#f-error').classList.add('hide');
        $('#f-name').focus();
        $('#form-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;

      case 'up':
        S.move(id, -1);
        renderList();
        break;

      case 'down':
        S.move(id, 1);
        renderList();
        break;

      case 'del':
        if (confirm('Remove "' + e.name + '" from your server book?')) {
          S.remove(id);
          if (editing && editing.id === id) resetForm();
          notice('srv-notice', 'ok', 'Removed <strong>' + esc(e.name) + '</strong>.');
          renderList();
        }
        break;
    }
  });

  /* ============================== add / edit form ============================== */
  function resetForm() {
    editing = null;
    $('#form-title').textContent = 'Add a server';
    $('#f-name').value = '';
    $('#f-addr').value = '';
    $('#f-note').value = '';
    $('#btn-save').textContent = 'Add server';
    $('#btn-cancel').style.display = 'none';
    $('#f-error').classList.add('hide');
  }

  function submitForm() {
    const err = $('#f-error');
    const name = $('#f-name').value;
    const addr = $('#f-addr').value;
    const note = $('#f-note').value;

    const res = editing
      ? S.update(editing.id, { name: name, addr: addr, note: note })
      : S.add(name, addr, note);

    if (!res.ok) {
      err.textContent = res.error;
      err.classList.remove('hide');
      return;
    }

    const saved = res.entry;
    const wasEdit = !!editing;
    resetForm();
    renderList();

    let msg = (wasEdit ? 'Saved ' : 'Added ') + '<strong>' + esc(saved.name) + '</strong>.';
    if (S.isBlockedMixed(saved.addr)) {
      notice('srv-notice', 'warn', msg + ' Note that a <code>ws://</code> address cannot be opened from this HTTPS page — it needs TLS. <a href="#" data-goto="host">How to fix →</a>');
    } else {
      notice('srv-notice', 'ok', msg + ' Press <strong>Test</strong> to check it answers.');
    }
  }

  $('#btn-save').addEventListener('click', submitForm);
  $('#btn-cancel').addEventListener('click', resetForm);
  ['#f-name', '#f-addr', '#f-note'].forEach((s) =>
    $(s).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitForm();
    })
  );

  $('#scheme-hint').textContent =
    'A bare host:port becomes ' + S.defaultScheme() + ' automatically. ' +
    (location.protocol === 'https:'
      ? 'This page is HTTPS, so only wss:// addresses can actually connect.'
      : 'This page is not HTTPS, so ws:// works here — but will be blocked once deployed to Pages.');

  /* ============================== test all ============================== */
  $('#btn-ping-all').addEventListener('click', async function () {
    const btn = this;
    const all = S.all();
    if (!all.length) return;
    btn.disabled = true;
    btn.textContent = 'Testing…';
    let ok = 0;
    for (const e of all) {
      const card = $('#srv-list .srv[data-id="' + e.id + '"]');
      if (card) card.querySelector('[data-dot]').className = 'dot busy';
      const res = await S.probe(e.id);
      if (res.ok) ok++;
    }
    btn.disabled = false;
    btn.textContent = 'Test all';
    renderList();
    notice('srv-notice', ok === all.length ? 'ok' : 'warn', '<strong>' + ok + ' of ' + all.length + '</strong> server' + (all.length > 1 ? 's' : '') + ' answered.');
  });

  /* ============================== import / export ============================== */
  $('#btn-export').addEventListener('click', async function () {
    const json = S.exportJSON();
    try {
      await navigator.clipboard.writeText(json);
      notice('srv-notice', 'ok', '<strong>Server book copied to your clipboard</strong> as JSON.');
    } catch (e) {
      $('#import-card').style.display = '';
      $('#f-import').value = json;
      notice('srv-notice', 'ok', 'Clipboard is blocked, so your list is in the box below — copy it from there.');
    }
  });

  $('#btn-import-open').addEventListener('click', () => {
    $('#import-card').style.display = '';
    $('#f-import').focus();
  });
  $('#btn-import-close').addEventListener('click', () => {
    $('#import-card').style.display = 'none';
    notice('import-result', '', '');
  });

  $('#btn-import-run').addEventListener('click', function () {
    const res = S.importJSON($('#f-import').value);
    if (!res.ok) {
      notice('import-result', 'bad', esc(res.error));
      return;
    }
    renderList();
    let html = '<strong>Added ' + res.added + ' server' + (res.added === 1 ? '' : 's') + '.</strong>';
    if (res.skipped.length) {
      html += '<br>Skipped ' + res.skipped.length + ': ' + res.skipped.map(esc).join('; ');
    }
    notice('import-result', res.added ? 'ok' : 'warn', html);
  });

  /* ============================== relays ============================== */
  const R = O.Relays;

  function renderRelays() {
    const wrap = $('#relay-list');
    const all = R.all();
    $('#relay-count').textContent = String(all.length);

    wrap.innerHTML = all
      .map(function (e) {
        const st = e.lastOk === true
          ? { cls: 'ok', text: '<span class="ok">Answered in ' + e.lastMs + ' ms</span>' }
          : e.lastOk === false
            ? { cls: 'bad', text: '<span class="bad">Did not answer</span>' }
            : { cls: '', text: '<span class="muted">Not tested yet</span>' };
        return (
          '<div class="srv" data-id="' + esc(e.id) + '">' +
          '<div class="dot ' + st.cls + '" data-dot></div>' +
          '<div>' +
          '<div class="srv-name">' + esc(e.comment || O.Servers.hostLabel(e.addr)) +
          (e.primary ? ' <span class="pill ok">primary</span>' : '') +
          (e.builtin ? ' <span class="pill">built in</span>' : '') +
          '</div>' +
          '<div class="srv-addr">' + esc(e.addr) + '</div>' +
          '<div class="srv-meta" data-meta>' + st.text + '</div>' +
          '</div>' +
          '<div class="srv-acts">' +
          (e.primary ? '' : '<button class="btn slim primary" data-act="primary">Make primary</button>') +
          '<button class="btn slim" data-act="ping">Test</button>' +
          '<button class="btn slim ghost danger" data-act="del">Remove</button>' +
          '</div></div>'
        );
      })
      .join('');
  }

  $('#relay-list').addEventListener('click', async function (ev) {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const card = btn.closest('.srv');
    const id = card.dataset.id;
    const e = R.get(id);
    if (!e) return;

    switch (btn.dataset.act) {
      case 'primary':
        R.setPrimary(id);
        renderRelays();
        notice('relay-notice', 'ok', '<strong>' + esc(e.comment || e.addr) + '</strong> is now the relay a shared world registers with.');
        break;

      case 'ping': {
        const dot = card.querySelector('[data-dot]');
        const meta = card.querySelector('[data-meta]');
        dot.className = 'dot busy';
        meta.innerHTML = '<span class="muted">Testing…</span>';
        btn.disabled = true;
        const res = await R.probe(id);
        btn.disabled = false;
        dot.className = 'dot ' + (res.ok ? 'ok' : 'bad');
        meta.innerHTML = res.ok
          ? '<span class="ok">Answered in ' + res.ms + ' ms</span>'
          : '<span class="bad">' + esc(res.detail || 'Did not answer') + '</span>';
        break;
      }

      case 'del':
        if (confirm('Remove this relay from your list?')) {
          R.remove(id);
          renderRelays();
        }
        break;
    }
  });

  $('#btn-relay-add').addEventListener('click', function () {
    const err = $('#relay-error');
    const res = R.add($('#f-relay-addr').value, $('#f-relay-comment').value);
    if (!res.ok) {
      err.textContent = res.error;
      err.classList.remove('hide');
      return;
    }
    err.classList.add('hide');
    $('#f-relay-addr').value = '';
    $('#f-relay-comment').value = '';
    renderRelays();
    notice('relay-notice', 'ok', 'Relay added. Press <strong>Test</strong> to check it answers, then make it primary if you want shared worlds to use it.');
  });

  $('#btn-relay-reset').addEventListener('click', function () {
    if (!confirm('Restore the three built-in public relays and drop any you added?')) return;
    R.reset();
    renderRelays();
    notice('relay-notice', 'ok', 'Relay list restored to the built-in defaults.');
  });

  $('#btn-relay-ping-all').addEventListener('click', async function () {
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'Testing…';
    let ok = 0;
    const all = R.all();
    for (const e of all) {
      const card = $('#relay-list .srv[data-id="' + e.id + '"]');
      if (card) card.querySelector('[data-dot]').className = 'dot busy';
      const res = await R.probe(e.id);
      if (res.ok) ok++;
    }
    btn.disabled = false;
    btn.textContent = 'Test all';
    renderRelays();
    notice(
      'relay-notice',
      ok ? 'ok' : 'bad',
      ok
        ? '<strong>' + ok + ' of ' + all.length + '</strong> relays answered. Shared worlds will work through any of the ones that did.'
        : '<strong>No relay answered.</strong> Shared worlds cannot be created until at least one does — a network that blocks WebSockets, such as a school or work network, is the usual reason.'
    );
  });

  /* ============================== TURN ============================== */
  const Tn = O.Turn;

  function renderTurn() {
    const st = Tn.state();
    const pill = $('#turn-pill');
    const box = $('#turn-state');
    if (!box) return;

    if (!st.configured) {
      pill.className = 'pill';
      pill.textContent = 'not set up';
      box.innerHTML =
        '<div class="note warn">No TURN endpoint is configured, so shared worlds rely on a ' +
        'direct connection between the two browsers. That works on most home networks and ' +
        'fails on most restricted ones.</div>';
      return;
    }

    const turns = st.servers.filter((s) => s.kind !== 'stun');
    if (st.count && turns.length) {
      pill.className = 'pill ok';
      pill.textContent = 'active';
      box.innerHTML =
        '<div class="note ok"><strong>' + turns.length + ' TURN server' + (turns.length === 1 ? '' : 's') +
        ' in use</strong>, plus ' + (st.count - turns.length) + ' STUN. ' +
        'Applied to every connection the game opens' +
        (st.mode === 'replace' ? ', in place of the relay\'s list' : ', alongside the relay\'s list') + '.</div>' +
        '<table class="tbl"><thead><tr><th>Server</th><th>Type</th><th>Credentials</th></tr></thead><tbody>' +
        st.servers.map((s) =>
          '<tr><td>' + esc(s.urls.join(', ')) + '</td><td>' +
          (s.kind === 'turns' ? '<span class="pill ok">TURN + TLS</span>'
            : s.kind === 'turn' ? '<span class="pill">TURN</span>'
            : '<span class="pill">STUN</span>') +
          '</td><td>' + (s.hasCredential ? 'yes' : '<span class="muted">none needed</span>') + '</td></tr>'
        ).join('') +
        '</tbody></table>' +
        '<p class="muted">Fetched ' + esc(st.fetchedAt || 'just now') +
        '. Credentials are short-lived and are renewed while Orion stays open.</p>';
    } else if (st.count) {
      pill.className = 'pill warn';
      pill.textContent = 'STUN only';
      box.innerHTML =
        '<div class="note warn"><strong>No TURN server came back</strong> — only STUN. ' +
        'Direct connections will still work; blocked networks will not.</div>';
    } else {
      pill.className = 'pill bad';
      pill.textContent = 'unavailable';
      box.innerHTML =
        '<div class="note bad"><strong>Could not get TURN servers.</strong> ' +
        esc(st.error || 'The endpoint did not answer.') +
        ' Shared worlds fall back to a direct connection, which is what they did before — ' +
        'so this makes nothing worse, it just will not rescue a blocked network.</div>';
    }
  }

  $('#btn-turn-test').addEventListener('click', async function () {
    this.disabled = true;
    this.textContent = 'Testing…';
    await Tn.refresh();
    this.disabled = false;
    this.textContent = 'Test TURN';
    renderTurn();
  });

  /* ============================== lobby ============================== */
  const Lb = O.Lobby;

  /* Hide the tab entirely when no backend is configured, rather than showing a
   * section that cannot work. */
  if (!Lb.available()) {
    const tab = document.querySelector('nav.tabs button[data-view="players"]');
    if (tab) tab.style.display = 'none';
  }

  let pollTimer = null;

  function renderLobby() {
    const on = Lb.isOnline();
    const me = Lb.me();
    $('#lobby-off').style.display = on ? 'none' : '';
    $('#lobby-on').style.display = on ? '' : 'none';
    $('#host-card').style.display = on ? '' : 'none';
    $('#requests-card').style.display = on ? '' : 'none';
    $('#players-card').style.display = on ? '' : 'none';
    if (on) {
      $('#lobby-status').innerHTML =
        'You are listed as <strong>' + esc(me.username) + '</strong>' +
        (me.code
          ? ' — hosting <strong>' + esc(me.world || 'a world') + '</strong>' +
            (me.open ? ' <span class="pill ok">open to anyone</span>' : ' <span class="pill">ask first</span>')
          : ' — not hosting anything right now') + '.';
      $('#f-world-name').value = me.world || '';
      $('#f-world-code').value = me.code || '';
      $('#f-world-open').checked = !!me.open;
    } else {
      $('#f-lobby-name').value = me.username || '';
    }
  }

  function statusPill(p) {
    if (p.status === 'hosting') return '<span class="pill ok">hosting</span>';
    if (p.status === 'playing') return '<span class="pill">playing</span>';
    return '<span class="pill">idle</span>';
  }

  async function refreshPlayers() {
    let rows;
    try {
      rows = await Lb.players();
    } catch (e) {
      notice('players-notice', 'bad', 'Could not reach the lobby: ' + esc(e.message));
      return;
    }
    notice('players-notice', '', '');
    $('#players-count').textContent = String(rows.length);

    const others = rows.filter((r) => !r.isMe);
    if (!others.length) {
      $('#players-list').innerHTML =
        '<div class="empty"><p>Nobody else is online right now. ' +
        'Leave this tab open — you will appear to anyone who joins, and they to you.</p></div>';
      return;
    }

    $('#players-list').innerHTML = others
      .map(function (p) {
        const hosting = p.status === 'hosting' && p.has_code;
        return (
          '<div class="srv" data-session="' + esc(p.session_id) + '">' +
          '<div class="dot ' + (hosting ? 'ok' : '') + '"></div>' +
          '<div>' +
          '<div class="srv-name">' + esc(p.username) + ' ' + statusPill(p) + '</div>' +
          '<div class="srv-meta">' +
          (hosting
            ? 'Hosting ' + (p.world_name ? '<strong>' + esc(p.world_name) + '</strong>' : 'a world') +
              (p.open_join ? ' · <span class="ok">open to anyone</span>' : ' · asks first')
            : '<span class="muted">Not hosting a world</span>') +
          '</div></div>' +
          '<div class="srv-acts">' +
          (hosting && p.open_join && p.join_code
            ? '<button class="btn slim primary" data-act="copy" data-code="' + esc(p.join_code) + '">Copy join code</button>'
            : hosting
              ? '<button class="btn slim primary" data-act="ask">Ask to join</button>'
              : '<button class="btn slim" disabled title="They are not hosting a world">Ask to join</button>') +
          '</div></div>'
        );
      })
      .join('');
  }

  async function refreshRequests() {
    let rows;
    try {
      rows = await Lb.inbox();
    } catch (e) {
      notice('req-notice', 'bad', 'Could not read your requests: ' + esc(e.message));
      return;
    }
    const live = rows.filter((r) => r.state !== 'cancelled');
    $('#req-count').textContent = String(live.filter((r) => r.state === 'pending').length);

    if (!live.length) {
      $('#req-list').innerHTML =
        '<div class="empty"><p>No requests. Ask someone who is hosting, or wait for someone to ask you.</p></div>';
      return;
    }

    $('#req-list').innerHTML = live
      .map(function (r) {
        const incoming = r.direction === 'incoming';
        let meta, acts = '';
        if (r.state === 'pending') {
          meta = incoming
            ? '<strong>' + esc(r.other_name) + '</strong> wants to join your world'
            : 'Waiting for <strong>' + esc(r.other_name) + '</strong> to answer';
          acts = incoming
            ? '<button class="btn slim primary" data-act="accept">Let them in</button>' +
              '<button class="btn slim ghost danger" data-act="decline">No thanks</button>'
            : '<button class="btn slim ghost" data-act="withdraw">Withdraw</button>';
        } else if (r.state === 'accepted') {
          meta = incoming
            ? 'You let <strong>' + esc(r.other_name) + '</strong> in'
            : '<strong>' + esc(r.other_name) + '</strong> let you in';
          acts = r.join_code && !incoming
            ? '<button class="btn slim primary" data-act="copy" data-code="' + esc(r.join_code) + '">Copy join code</button>'
            : '';
        } else {
          meta = incoming
            ? 'You declined <strong>' + esc(r.other_name) + '</strong>'
            : '<strong>' + esc(r.other_name) + '</strong> declined';
        }
        const cls = r.state === 'accepted' ? 'ok' : r.state === 'declined' ? 'bad' : 'busy';
        return (
          '<div class="srv" data-id="' + esc(r.id) + '">' +
          '<div class="dot ' + cls + '"></div>' +
          '<div><div class="srv-name">' + (incoming ? 'Request from ' : 'Your request to ') + esc(r.other_name) + '</div>' +
          '<div class="srv-meta">' + meta + '</div>' +
          (r.state === 'accepted' && r.join_code && !incoming
            ? '<div class="srv-addr">Code: ' + esc(r.join_code) + '</div>'
            : '') +
          '</div><div class="srv-acts">' + acts + '</div></div>'
        );
      })
      .join('');
  }

  async function pollLobby() {
    if (!Lb.available()) return;
    await refreshPlayers();
    if (Lb.isOnline()) await refreshRequests();
    if (pollTimer) clearTimeout(pollTimer);
    /* Only poll while this tab is the one being looked at. */
    if ($('#v-players').classList.contains('on') && !document.hidden) {
      pollTimer = setTimeout(pollLobby, (O.config.lobby.pollMs) || 5000);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && $('#v-players').classList.contains('on')) pollLobby();
  });

  $('#btn-go-online').addEventListener('click', async function () {
    const err = $('#lobby-error');
    this.disabled = true;
    const res = await Lb.goOnline($('#f-lobby-name').value);
    this.disabled = false;
    if (!res.ok) {
      err.textContent = res.error;
      err.classList.remove('hide');
      return;
    }
    err.classList.add('hide');
    renderLobby();
    pollLobby();
  });

  $('#btn-go-offline').addEventListener('click', async function () {
    this.disabled = true;
    await Lb.goOffline();
    this.disabled = false;
    if (pollTimer) clearTimeout(pollTimer);
    renderLobby();
    refreshPlayers();
  });

  $('#btn-refresh-players').addEventListener('click', () => pollLobby());

  $('#btn-save-world').addEventListener('click', async function () {
    const err = $('#world-error');
    const code = $('#f-world-code').value.trim();
    if (!code) {
      err.textContent = 'Paste the join code the game gave you, or press Stop hosting.';
      err.classList.remove('hide');
      return;
    }
    err.classList.add('hide');
    const res = await Lb.setActivity({
      world: $('#f-world-name').value.trim(),
      code: code,
      open: $('#f-world-open').checked,
      status: 'hosting'
    });
    if (!res.ok) {
      err.textContent = res.error;
      err.classList.remove('hide');
      return;
    }
    renderLobby();
    pollLobby();
  });

  $('#btn-clear-world').addEventListener('click', async function () {
    await Lb.setActivity({ world: '', code: '', open: false, status: 'idle' });
    renderLobby();
    pollLobby();
  });

  $('#players-list').addEventListener('click', async function (ev) {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const card = btn.closest('.srv');

    if (btn.dataset.act === 'copy') {
      await copyCode(btn.dataset.code, 'players-notice');
      return;
    }
    if (btn.dataset.act === 'ask') {
      btn.disabled = true;
      const res = await Lb.ask(card.dataset.session);
      btn.disabled = false;
      notice('players-notice', res.ok ? 'ok' : 'bad',
        res.ok
          ? 'Asked to join. Watch the <strong>Requests</strong> section above for their answer.'
          : esc(res.error));
      if (res.ok) refreshRequests();
    }
  });

  $('#req-list').addEventListener('click', async function (ev) {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.srv').dataset.id;
    const act = btn.dataset.act;

    if (act === 'copy') {
      await copyCode(btn.dataset.code, 'req-notice');
      return;
    }
    btn.disabled = true;
    let res;
    if (act === 'accept') res = await Lb.respond(id, true);
    else if (act === 'decline') res = await Lb.respond(id, false);
    else res = await Lb.cancel(id);
    btn.disabled = false;
    if (!res.ok) notice('req-notice', 'bad', esc(res.error));
    else if (act === 'accept') notice('req-notice', 'ok', 'They can see your join code now.');
    else notice('req-notice', '', '');
    refreshRequests();
  });

  async function copyCode(code, where) {
    try {
      await navigator.clipboard.writeText(code);
      notice(where, 'ok',
        '<strong>Join code copied.</strong> In the game: Multiplayer, then paste it into the join-code box. ' +
        'The world may also just appear in the list by itself.');
    } catch (e) {
      notice(where, 'ok', '<strong>Join code:</strong> <span class="mono">' + esc(code) + '</span>');
    }
  }

  /* ============================== launching ============================== */
  async function launch(entry) {
    const p = probeCache || (await L.probe());
    if (!p.ready) {
      show('setup');
      return;
    }
    if (entry && S.isBlockedMixed(entry.addr)) {
      show('servers');
      notice(
        'srv-notice',
        'bad',
        '<strong>Cannot join ' + esc(entry.name) + '.</strong> Its <code>ws://</code> address is blocked on an HTTPS page. ' +
          'The server needs a <code>wss://</code> address — <a href="#" data-goto="host">how to add TLS →</a>'
      );
      return;
    }

    const bootVer = Vs.selected();
    $('#boot-msg').textContent = entry ? 'Joining ' + entry.name : 'Starting Minecraft ' + bootVer.label;
    $('#boot-sub').textContent = entry ? entry.addr : 'Loading Eaglercraft ' + bootVer.label;
    $('#boot').classList.add('on');
    $('#shell').style.display = 'none';

    /* Must happen before the bundle is injected: the wrapper has to be in
     * place on window before the game captures the constructor. A failure here
     * is not fatal — the game falls back to the relay's own ICE list. */
    if (Tn.configured()) {
      $('#boot-sub').textContent = 'Preparing connection servers…';
      try {
        await Tn.prepare();
      } catch (e) { /* shared worlds simply stay as they were */ }
      $('#boot-sub').textContent = entry ? entry.addr : 'Loading Eaglercraft ' + bootVer.label;
    }

    try {
      await L.launch('game_frame', entry ? entry.addr : null, Vs.selected());
      $('#game-shell').classList.add('on');
      $('#game-exit').style.display = '';
      watchPointerLock();
      renderVersionPicker();
      const ts = Tn.state();
      if (ts.installed && ts.count) {
        console.info('[Orion] ' + ts.count + ' ICE server(s) applied to the game (' + ts.mode + ')');
      }
      if (Lb.isOnline()) Lb.setActivity({ status: Lb.me().code ? 'hosting' : 'playing' });
      O.stopStars && O.stopStars();
      /* The client paints over the boot screen itself; drop it once the
       * canvas has had a frame to appear. */
      setTimeout(() => $('#boot').classList.remove('on'), 2500);
    } catch (err) {
      $('#boot').classList.remove('on');
      $('#shell').style.display = '';
      show('setup');
      notice('setup-state', 'bad', '<strong>Launch failed.</strong> ' + esc(err.message));
      probeCache = null;
      refreshSetup();
    }
  }

  /* The exit button should only be reachable from the game's menus, never
   * hovering over the world while you play. Minecraft grabs the mouse pointer
   * while you are in a world and releases it for every menu, including the
   * pause menu that Esc opens — so pointer lock is exactly the signal we
   * want, and it needs no knowledge of the game's internals. */
  function watchPointerLock() {
    const btn = $('#game-exit');
    const sync = () => {
      const inWorld = !!document.pointerLockElement;
      btn.style.display = inWorld ? 'none' : '';
    };
    document.addEventListener('pointerlockchange', sync);
    document.addEventListener('pointerlockerror', sync);
    sync();
  }

  $('#btn-launch').addEventListener('click', () => launch(null));
  $('#btn-launch-2').addEventListener('click', () => launch(null));
  $('#btn-goto-friends').addEventListener('click', () => show('friends'));
  $('#btn-goto-servers').addEventListener('click', () => show('servers'));
  $('#game-exit').addEventListener('click', async () => {
    if (!confirm('Leave the game and go back to the launcher? Anything unsaved in a singleplayer world may be lost.')) return;
    /* Stop advertising a world that is about to stop existing. */
    if (Lb.isOnline()) {
      try { await Lb.setActivity({ status: 'idle', world: '', code: '', open: false }); } catch (e) { /* reloading anyway */ }
    }
    location.reload();
  });

  /* ============================== boot ============================== */
  const shared = S.consumeShareLink();
  renderList();

  if (shared) {
    const added = shared.filter((r) => r.res.ok);
    const failed = shared.filter((r) => !r.res.ok);
    let html = '';
    if (added.length) {
      html += '<strong>Added from a share link:</strong> ' + added.map((r) => esc(r.res.entry.name)).join(', ') + '.';
    }
    if (failed.length) {
      html += (html ? '<br>' : '') + 'Could not add ' + failed.map((r) => esc(r.addr) + ' (' + esc(r.res.error) + ')').join(', ');
    }
    notice('srv-notice', added.length ? 'ok' : 'warn', html);
    show('servers');
  } else {
    const h = (location.hash || '').replace('#', '');
    show(['play', 'servers', 'players', 'friends', 'host', 'setup'].includes(h) ? h : 'play');
  }

  refreshBundle();
})();
