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

  /* ============================== bundle state ============================== */
  let probeCache = null;

  async function refreshBundle() {
    const play = $('#bundle-state');
    play.innerHTML = '<div class="note">Looking for the client bundle…</div>';
    $('#btn-launch').disabled = true;

    const p = await L.probe();
    probeCache = p;

    if (p.ready) {
      play.innerHTML =
        '<div class="note ok"><strong>Client bundle found.</strong> Loading from <code>' + esc(p.base) + '</code>.</div>';
      $('#btn-launch').disabled = false;
    } else {
      const missing = [];
      if (!p.classes.ok) missing.push('classes.js');
      if (!p.assets.ok) missing.push('assets.epk');
      play.innerHTML =
        '<div class="note warn"><strong>No client bundle installed yet.</strong> ' +
        'Orion could not find ' + missing.map((m) => '<code>' + m + '</code>').join(' or ') +
        ' in <code>' + esc(p.base) + '</code>. ' +
        'Everything else works — you can build your server list now. ' +
        '<a href="#" data-goto="setup">Set up the client →</a></div>';
      $('#btn-launch').disabled = true;
    }
    renderQuickJoin();
    return p;
  }

  async function refreshSetup() {
    $('#f-base').value = L.base();
    $('#opts-preview').textContent = JSON.stringify(L.buildOpts('game_frame', null), null, 2);

    const box = $('#setup-state');
    box.innerHTML = '<div class="note">Checking…</div>';
    const p = probeCache || (await L.probe());
    const row = (label, r, url) =>
      '<tr><td>' + esc(label) + '</td><td>' +
      (r.ok
        ? '<span class="pill ok">found</span>' + (r.size ? ' <span class="muted">' + (r.size / 1048576).toFixed(1) + ' MB</span>' : '')
        : '<span class="pill bad">missing</span>' + (r.status ? ' <span class="muted">HTTP ' + r.status + '</span>' : '')) +
      '</td><td class="mono muted">' + esc(url) + '</td></tr>';

    box.innerHTML =
      (p.ready
        ? '<div class="note ok"><strong>Ready to launch.</strong></div>'
        : '<div class="note warn"><strong>Not launchable yet.</strong> Install a bundle below.</div>') +
      '<table class="tbl"><thead><tr><th>File</th><th>Status</th><th>URL</th></tr></thead><tbody>' +
      row('classes.js', p.classes, L.classesURL()) +
      row('assets.epk', p.assets, L.assetsURL()) +
      '</tbody></table>';
  }

  $('#btn-base-save').addEventListener('click', async () => {
    const res = L.setBase($('#f-base').value);
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
    L.setBase('');
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

    $('#boot-msg').textContent = entry ? 'Joining ' + entry.name : 'Starting Orion';
    $('#boot-sub').textContent = entry ? entry.addr : 'Loading EaglercraftX 1.8';
    $('#boot').classList.add('on');
    $('#shell').style.display = 'none';

    try {
      await L.launch('game_frame', entry ? entry.addr : null);
      $('#game-shell').classList.add('on');
      $('#game-exit').style.display = '';
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

  $('#btn-launch').addEventListener('click', () => launch(null));
  $('#btn-goto-servers').addEventListener('click', () => show('servers'));
  $('#game-exit').addEventListener('click', () => {
    if (confirm('Leave the game and go back to the launcher? Anything unsaved in a singleplayer world may be lost.')) {
      location.reload();
    }
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
    show(['play', 'servers', 'host', 'setup'].includes(h) ? h : 'play');
  }

  refreshBundle();
})();
