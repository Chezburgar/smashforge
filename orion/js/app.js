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
    if (view === 'together') { renderRelays(); renderTurn(); renderVoiceStatic(); }
    if (view === 'friends') pollFriends();
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
          '<button class="btn slim" data-act="diag" title="Work out why it will not connect">Diagnose</button>' +
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

      case 'diag': {
        btn.disabled = true;
        const label = btn.textContent;
        notice('srv-notice', 'warn', '<strong>Diagnosing ' + esc(e.name) + '…</strong> This runs a few connection attempts, so give it a moment.');
        const res = await S.diagnose(e.addr, (t) => {
          btn.textContent = '…';
          notice('srv-notice', 'warn', '<strong>Diagnosing ' + esc(e.name) + '</strong><br>' + esc(t));
        });
        btn.disabled = false;
        btn.textContent = label;

        const rows = res.findings.map(function (f) {
          const tone = f.level === 'ok' ? 'ok' : f.level === 'bad' ? 'bad' : 'warn';
          return '<div class="note ' + tone + '" style="margin:0 0 10px">' +
            '<strong>' + esc(f.title) + '</strong>' +
            (f.text ? '<br>' + esc(f.text) : '') +
            (f.list ? '<ol style="margin:8px 0 0;padding-left:20px">' +
              f.list.map((li) => '<li style="margin:4px 0">' + esc(li) + '</li>').join('') + '</ol>' : '') +
            '</div>';
        }).join('');

        notice('srv-notice', res.ok ? 'ok' : 'warn',
          '<strong>' + esc(e.name) + '</strong> <span class="mono">' + esc(e.addr) + '</span>' +
          '<div style="margin-top:12px">' + rows + '</div>' +
          (res.suggestion
            ? '<button class="btn slim primary" id="btn-use-suggestion" data-addr="' + esc(res.suggestion) +
              '" data-id="' + esc(e.id) + '">Use ' + esc(res.suggestion) + '</button>'
            : ''));
        break;
      }

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

  /* A diagnosis that found a working address offers to apply it. */
  $('#srv-notice').addEventListener('click', function (ev) {
    const btn = ev.target.closest('#btn-use-suggestion');
    if (!btn) return;
    const res = S.update(btn.dataset.id, { addr: btn.dataset.addr });
    if (!res.ok) {
      notice('srv-notice', 'bad', esc(res.error));
      return;
    }
    renderList();
    notice('srv-notice', 'ok', 'Address updated to <span class="mono">' + esc(btn.dataset.addr) + '</span>. Press <strong>Test</strong> to confirm.');
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

  /* ============================ the wss helper ============================
   * A server that will not connect is nearly always a server without TLS, and
   * the fix is two files and a config block. This writes both out with the
   * user's own hostname in them, because the generic instructions are what
   * people get stuck on. js/wss.js holds the facts, read out of
   * EaglerXServer's CONFIG.md rather than guessed. */
  const Ws = O.Wss;

  function block(title, body, lang) {
    return '<h4 class="wss-h">' + title + '</h4>' +
      '<pre class="code' + (lang ? ' ' + lang : '') + '">' + esc(body) + '</pre>' +
      '<div class="btn-row" style="margin:-4px 0 18px">' +
      '<button class="btn slim ghost" data-copy="' + esc(body) + '">Copy</button></div>';
  }

  $('#btn-wss-go').addEventListener('click', function () {
    const raw = $('#f-wss-addr').value.trim();
    const wanted = $('#f-wss-host').value.trim();
    const out = $('#wss-out');

    const parsed = Ws.parse(raw) || Ws.parse('ws://' + raw);
    if (!parsed) {
      out.innerHTML = '<div class="note bad">That does not look like a server address. ' +
        'Something like <code>ws://mc.example.net:25565</code>, or just <code>mc.example.net:25565</code>.</div>';
      return;
    }

    let html = '';

    if (parsed.scheme === 'wss') {
      html += '<div class="note ok"><strong>That is already a wss:// address.</strong> If it still will not ' +
        'connect, the certificate or the proxy in front of it is the problem rather than the scheme — run ' +
        '<strong>Diagnose</strong> on it from the Servers tab and it will say which.</div>';
    }

    /* Whether the host they were given can ever have a certificate is the
     * thing that decides which route they take, so it comes first. */
    const cert = Ws.certifiable(parsed.host);
    if (!cert.ok) {
      html += '<div class="note warn"><strong>' + esc(parsed.host) + ' cannot be given TLS by you.</strong> ' +
        esc(cert.why) + '</div>';
    }

    const target = wanted || '';
    if (!target) {
      html += '<div class="note">Fill in a hostname you control and this will write the commands with it in. ' +
        'A free <a href="https://duckdns.org" target="_blank" rel="noopener">DuckDNS</a> name is enough — ' +
        'what matters is being able to edit its DNS.</div>';
    }

    html += '<div class="steps-tight" style="margin-top:18px">' +
      Ws.dnsSteps(parsed, target).map((st, i) =>
        '<div class="req ok"><span class="dot ok"></span><div><strong>' + (i + 1) + '. ' + esc(st.title) +
        '</strong><span>' + esc(st.text) + '</span></div></div>').join('') +
      '</div>';

    html += block('Paste into plugins/EaglerXServer/listener.cfg', Ws.listenerConfig());
    html += block('Issue the certificate (on your computer, not the server)',
      Ws.certCommands(target || 'mc.yourname.duckdns.org'));

    const final = Ws.finalAddress(parsed, target);
    if (final) {
      html += '<div class="note ok"><strong>Then join at</strong> <span class="mono">' + esc(final) + '</span>' +
        ' — same port as before. <button class="btn slim" id="btn-wss-add">Add it to my servers</button></div>';
    }

    html += '<h4 class="wss-h">If you cannot get a certificate at all</h4>' +
      '<p class="muted" style="margin:0 0 10px">A page served over plain <code>http://</code> is allowed to ' +
      'open a plain <code>ws://</code> socket, so running the launcher locally makes an untouched server work. ' +
      'Only for whoever is at that computer, but it is a real answer.</p>' +
      block('Run Orion locally over http://', Ws.localFallback());

    out.innerHTML = html;
    out.dataset.addr = final || '';
  });

  /* Copy buttons on every generated block. */
  $('#wss-out').addEventListener('click', async function (ev) {
    const copy = ev.target.closest('button[data-copy]');
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy.dataset.copy);
        const was = copy.textContent;
        copy.textContent = 'Copied';
        setTimeout(() => { copy.textContent = was; }, 1400);
      } catch (e) {
        copy.textContent = 'Select it and copy by hand';
      }
      return;
    }
    if (ev.target.id === 'btn-wss-add') {
      const addr = $('#wss-out').dataset.addr;
      if (!addr) return;
      const res = S.add('My server', addr);
      if (res.ok) {
        renderList();
        show('servers');
        notice('srv-notice', 'ok', 'Added <strong>' + esc(addr) + '</strong>. Press <strong>Test</strong> ' +
          'once the certificate is in place — until then it will not answer.');
      } else {
        notice('srv-notice', 'warn', esc(res.error));
      }
    }
  });

  /* ========================== proximity voice ==========================
   * Four things have to be true at once (see js/voice.js), so the panel checks
   * them one at a time and says which one is missing. Two of them can only be
   * answered by actually trying: asking for the microphone, and gathering ICE
   * candidates to see whether a relayed call is possible from this network. */
  const Vo = O.Voice;

  function req(id, kind, detail) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('ok', 'bad', 'warn');
    el.classList.add(kind);
    const dot = el.querySelector('.dot');
    if (dot) {
      dot.classList.remove('ok', 'bad', 'warn');
      dot.classList.add(kind);
    }
    if (detail) {
      const span = el.querySelector('span:not(.dot)');
      if (span) span.textContent = detail;
    }
  }

  function voicePill(kind, text) {
    const pill = $('#voice-pill');
    pill.className = 'pill' + (kind ? ' ' + kind : '');
    pill.textContent = text;
  }

  /* The server side cannot be tested from here — it depends on the server you
   * happen to join — so it is described rather than claimed. */
  function renderVoiceStatic() {
    req('#req-secure', Vo.secure() ? 'ok' : 'bad',
      Vo.secure()
        ? 'This page is secure, so the microphone can be asked for.'
        : 'This page is not on HTTPS. A browser will refuse the microphone outright.');
    req('#req-server', 'warn',
      'Not something Orion can check from here: it depends on the server you join, or on a world being shared.');
  }

  $('#btn-voice-check').addEventListener('click', async function () {
    this.disabled = true;
    this.textContent = 'Checking…';
    notice('voice-state', 'ok', 'Asking for the microphone…');
    try {
      await Vo.startMeter(function (level) {
        $('#mic-bar').style.width = Math.round(level * 100) + '%';
      });
      $('#mic-row').style.display = '';
      $('#mic-label').textContent = Vo.deviceLabel() || 'Microphone';
      $('#btn-voice-stop').style.display = '';
      req('#req-mic', 'ok', 'Granted. Say something — the bar should move.');
    } catch (e) {
      req('#req-mic', 'bad', e.message);
      notice('voice-state', 'bad', esc(e.message));
      voicePill('bad', 'no microphone');
      this.disabled = false;
      this.textContent = 'Check my microphone and network';
      return;
    }

    notice('voice-state', 'ok', 'Testing whether a call can get through this network…');
    let ice;
    try {
      ice = await Vo.checkIce(7000);
    } catch (e) {
      ice = { ok: false, error: e.message, kinds: {} };
    }

    if (ice.ok) {
      req('#req-ice', 'ok', 'A relayed connection is available, so voice will get through even if a direct one is blocked.');
      voicePill('ok', 'ready');
      notice('voice-state', 'ok',
        'Your side is ready. Whether you can actually hear anyone now depends on the server or ' +
        'the world you join carrying voice — turn it on in the game with <kbd>V</kbd>.');
    } else if (ice.direct) {
      req('#req-ice', 'warn',
        'No relayed connection, but a direct one looks possible. Voice will work with people your ' +
        'network lets you reach directly, and fail with the rest.');
      voicePill('warn', 'partly');
      notice('voice-state', 'warn',
        'TURN did not answer' + (ice.error ? ' (' + esc(ice.error) + ')' : '') +
        ', so calls will only work where a direct connection is allowed. Press <strong>Test TURN</strong> ' +
        'above; if that fails too, it is the TURN endpoint and not your network.');
    } else {
      req('#req-ice', 'bad', 'No usable connection of any kind was found from this network.');
      voicePill('bad', 'blocked');
      notice('voice-state', 'bad',
        'Nothing got through' + (ice.error ? ' (' + esc(ice.error) + ')' : '') +
        '. On a network this restrictive, voice and shared worlds will both fail — a phone hotspot ' +
        'is the usual way to prove that is what it is.');
    }

    this.disabled = false;
    this.textContent = 'Check again';
  });

  $('#btn-voice-stop').addEventListener('click', function () {
    Vo.closeMic();
    $('#mic-row').style.display = 'none';
    $('#btn-voice-stop').style.display = 'none';
    req('#req-mic', 'warn', 'Released. The game will ask for it again when you turn voice on.');
  });

  /* Holding a microphone open while nobody is looking at the panel is not on. */
  window.addEventListener('pagehide', () => Vo.closeMic());

  /* ============================== accounts ============================== */
  const Acc = O.Account;

  function gateOn(show) {
    $('#gate').classList.toggle('on', show);
    $('#shell').style.display = show ? 'none' : '';
  }

  let gateMode = 'in';

  function renderGate(msg, kind) {
    const up = gateMode === 'up';
    $('#g-pass2-wrap').style.display = up ? '' : 'none';
    $('#g-go').textContent = up ? 'Create account' : 'Sign in';
    $('#g-pass').setAttribute('autocomplete', up ? 'new-password' : 'current-password');
    $('#gate-sub').textContent = up ? 'Pick a name and a password.' : 'Sign in to play.';
    document.querySelectorAll('.gate-tab').forEach((b) => b.classList.toggle('on', (b.dataset.mode === 'up') === up));
    const err = $('#gate-error');
    if (msg) {
      err.className = 'note ' + (kind || 'bad');
      err.textContent = msg;
    } else {
      err.className = 'note bad hide';
      err.textContent = '';
    }
  }

  document.querySelectorAll('.gate-tab').forEach(function (b) {
    b.addEventListener('click', function () {
      gateMode = b.dataset.mode;
      renderGate(null);
    });
  });

  async function submitGate() {
    const btn = $('#g-go');
    const user = $('#g-user').value.trim();
    const pass = $('#g-pass').value;

    if (gateMode === 'up' && pass !== $('#g-pass2').value) {
      renderGate('Those two passwords are not the same.');
      return;
    }
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = 'Just a moment…';
    const res = gateMode === 'up' ? await Acc.register(user, pass) : await Acc.login(user, pass);
    btn.disabled = false;
    btn.textContent = was;

    if (!res.ok) {
      renderGate(res.error);
      return;
    }
    $('#g-pass').value = '';
    $('#g-pass2').value = '';
    renderGate(null);
    afterSignIn();
  }

  $('#g-go').addEventListener('click', submitGate);
  ['#g-user', '#g-pass', '#g-pass2'].forEach((sel) =>
    $(sel).addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGate(); })
  );

  function renderWho() {
    const m = Acc.me();
    const box = $('#whoami');
    if (!m) {
      box.innerHTML = '';
      return;
    }
    box.innerHTML =
      '<span class="who">Signed in as <strong>' + esc(m.username) + '</strong>' +
      (m.role === 'owner' ? ' <span class="pill ok">owner</span>' : '') + '</span>' +
      '<button class="code" id="btn-copy-code" title="Your friend code — click to copy">' + esc(m.friend_code) + '</button>' +
      '<button class="btn slim ghost" id="btn-signout">Sign out</button>';
  }

  $('#whoami').addEventListener('click', async function (ev) {
    if (ev.target.closest('#btn-signout')) {
      await Acc.logout();
      renderWho();
      gateOn(true);
      renderGate('Signed out.', 'ok');
      return;
    }
    const code = ev.target.closest('#btn-copy-code');
    if (code) {
      try {
        await navigator.clipboard.writeText(code.textContent.trim());
        code.textContent = 'copied!';
        setTimeout(renderWho, 1200);
      } catch (e) { /* leave it showing */ }
    }
  });

  function afterSignIn() {
    gateOn(false);
    renderWho();
    Acc.setActivity({ version: Vs.selected().id });
    renderFriends();
    pollFriends();
  }

  /* ============================== friends ============================== */

  let friendTimer = null;

  function meCard() {
    const m = Acc.me();
    if (!m) return;
    $('#me-card').innerHTML =
      '<div class="note"><strong>Your friend code is ' + esc(m.friend_code) + '.</strong> ' +
      'Give it to someone and they can add you with it — it is easier to get right than a name.</div>';
  }

  async function renderFriends() {
    if (!Acc.signedIn()) return;
    meCard();
    let rows;
    try {
      rows = await Acc.friends();
    } catch (e) {
      notice('friend-notice', 'bad', 'Could not read your friends list: ' + esc(e.message));
      return;
    }

    const accepted = rows.filter((r) => r.state === 'accepted');
    const incoming = rows.filter((r) => r.state === 'pending' && r.direction === 'incoming');
    const outgoing = rows.filter((r) => r.state === 'pending' && r.direction === 'outgoing');
    $('#friends-count').textContent = String(accepted.length);

    const act = Acc.activity();
    $('#f-world-name').value = act.world || '';
    $('#f-world-code').value = act.code || '';

    const card = function (r, body, acts) {
      const dot = r.state !== 'accepted' ? 'busy' : r.online ? 'ok' : '';
      return '<div class="srv" data-id="' + esc(r.friendship_id) + '">' +
        '<div class="dot ' + dot + '"></div>' +
        '<div><div class="srv-name">' + esc(r.username) +
        (r.state === 'accepted' && r.online ? ' <span class="pill ok">online</span>' : '') +
        '</div><div class="srv-meta">' + body + '</div></div>' +
        '<div class="srv-acts">' + acts + '</div></div>';
    };

    let html = '';

    if (incoming.length) {
      html += '<h3 style="margin:4px 0 10px">Waiting for you</h3>' + incoming.map((r) =>
        card(r, '<strong>' + esc(r.username) + '</strong> wants to be friends',
          '<button class="btn slim primary" data-act="accept">Accept</button>' +
          '<button class="btn slim ghost danger" data-act="decline">No thanks</button>')
      ).join('');
    }

    if (accepted.length) {
      html += '<h3 style="margin:16px 0 10px">Friends</h3>' + accepted.map(function (r) {
        let body, acts = '';
        if (!r.online) {
          body = '<span class="muted">Offline · last seen ' + esc(when(r.last_seen)) + '</span>';
        } else if (r.status === 'hosting' && r.join_code) {
          body = 'Hosting <strong>' + esc(r.world_name || 'a world') + '</strong>' +
                 (r.version ? ' on ' + esc(r.version) : '');
          acts = '<button class="btn slim primary" data-act="code" data-code="' + esc(r.join_code) + '">Copy join code</button>';
        } else if (r.server_addr) {
          body = 'Playing on <span class="mono">' + esc(r.server_addr) + '</span>';
          acts = '<button class="btn slim primary" data-act="joinserver" data-addr="' + esc(r.server_addr) + '">Join them</button>';
        } else {
          body = '<span class="muted">Online' + (r.version ? ' on ' + esc(r.version) : '') +
                 ' · not in a world you can join</span>';
        }
        return card(r, body, acts + '<button class="btn slim ghost danger" data-act="remove">Remove</button>');
      }).join('');
    }

    if (outgoing.length) {
      html += '<h3 style="margin:16px 0 10px">Asked, not answered</h3>' + outgoing.map((r) =>
        card(r, 'Waiting for <strong>' + esc(r.username) + '</strong>',
          '<button class="btn slim ghost" data-act="remove">Withdraw</button>')
      ).join('');
    }

    if (!html) {
      html = '<div class="empty"><p>No friends yet. Add someone by their name or friend code above.</p></div>';
    }
    $('#friend-list').innerHTML = html;
  }

  function when(ts) {
    const d = Date.now() - new Date(ts).getTime();
    const m = Math.round(d / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const dd = Math.round(h / 24);
    return dd + (dd === 1 ? ' day ago' : ' days ago');
  }

  async function pollFriends() {
    if (!Acc.signedIn()) return;
    await renderFriends();
    if (friendTimer) clearTimeout(friendTimer);
    if ($('#v-friends').classList.contains('on') && !document.hidden) {
      friendTimer = setTimeout(pollFriends, (O.config.api.pollMs) || 5000);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && $('#v-friends').classList.contains('on')) pollFriends();
  });

  $('#btn-friend-add').addEventListener('click', async function () {
    const who = $('#f-friend').value.trim();
    if (!who) return;
    this.disabled = true;
    const res = await Acc.addFriend(who);
    this.disabled = false;
    if (!res.ok) {
      notice('friend-notice', 'bad', esc(res.error));
      return;
    }
    $('#f-friend').value = '';
    notice('friend-notice', 'ok', res.result === 'accepted'
      ? 'You and <strong>' + esc(res.username) + '</strong> are now friends — they had already asked you.'
      : 'Asked <strong>' + esc(res.username) + '</strong>. They will see it next time they look.');
    renderFriends();
  });

  $('#f-friend').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-friend-add').click(); });

  $('#friend-list').addEventListener('click', async function (ev) {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('.srv').dataset.id;
    const act = btn.dataset.act;

    if (act === 'code') {
      try {
        await navigator.clipboard.writeText(btn.dataset.code);
        notice('friend-notice', 'ok',
          '<strong>Join code copied.</strong> In the game: Multiplayer, then paste it in — or wait for their world to appear in the list.');
      } catch (e) {
        notice('friend-notice', 'ok', '<strong>Join code:</strong> <span class="mono">' + esc(btn.dataset.code) + '</span>');
      }
      return;
    }
    if (act === 'joinserver') {
      const addr = btn.dataset.addr;
      const known = S.all().find((e) => e.addr === addr);
      if (!known) S.add('Friend’s server', addr);
      renderList();
      launch(S.all().find((e) => e.addr === addr) || null);
      return;
    }

    btn.disabled = true;
    let res;
    if (act === 'accept') res = await Acc.respondFriend(id, true);
    else if (act === 'decline') res = await Acc.respondFriend(id, false);
    else res = await Acc.removeFriend(id);
    btn.disabled = false;
    if (!res.ok) notice('friend-notice', 'bad', esc(res.error));
    else notice('friend-notice', '', '');
    renderFriends();
  });

  $('#btn-save-world').addEventListener('click', async function () {
    const err = $('#world-error');
    const code = $('#f-world-code').value.trim();
    if (!code) {
      err.textContent = 'Paste the join code the game gave you, or press Stop sharing.';
      err.classList.remove('hide');
      return;
    }
    err.classList.add('hide');
    const res = await Acc.setActivity({
      world: $('#f-world-name').value.trim(), code: code, status: 'hosting', version: Vs.selected().id
    });
    if (!res.ok) {
      err.textContent = res.error;
      err.classList.remove('hide');
      return;
    }
    notice('friend-notice', 'ok', 'Your friends can see it now.');
    renderFriends();
  });

  $('#btn-clear-world').addEventListener('click', async function () {
    await Acc.setActivity({ world: '', code: '', status: 'idle' });
    notice('friend-notice', '', '');
    renderFriends();
  });

  /* ============================== launching ==============================
   * The boot screen is the only loading screen Orion owns outright, and it has
   * to cover a big download, so it says which stage it is on and how long it
   * has been going. There is deliberately no crawling percentage: the client is
   * injected as a <script>, and between "asked the browser for it" and "the
   * browser has it" there is nothing to count. The bar advances a real step per
   * finished stage and shimmers in between, which is the honest shape of it. */
  const BOOT_STAGES = ['prep', 'turn', 'load', 'start'];
  let bootAt = 0;
  let bootTimer = null;
  let bootStars = null;

  function bootStage(name, done) {
    const items = document.querySelectorAll('#boot-stages li');
    const at = BOOT_STAGES.indexOf(name);
    items.forEach(function (li, i) {
      li.classList.toggle('done', i < at || (done && i === at));
      li.classList.toggle('now', !done && i === at);
    });
    const steps = (done ? at + 1 : at) / BOOT_STAGES.length;
    $('#boot-bar-fill').style.width = Math.round(steps * 100) + '%';
    $('.boot-bar').classList.toggle('working', !done);
  }

  /* A starfield of its own, because #stars belongs to the launcher shell and
   * the shell is hidden while this is up. */
  function startBootStars() {
    const c = $('#boot-stars');
    if (!c) return;
    const g = c.getContext('2d');
    let live = true;
    let stars = [];
    function size() {
      c.width = Math.floor(window.innerWidth * Math.min(2, window.devicePixelRatio || 1));
      c.height = Math.floor(window.innerHeight * Math.min(2, window.devicePixelRatio || 1));
      stars = [];
      const n = Math.round((c.width * c.height) / 26000);
      for (let i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * c.width, y: Math.random() * c.height,
          r: Math.random() * 1.5 + 0.3, a: Math.random(), s: 0.2 + Math.random() * 0.8
        });
      }
    }
    size();
    window.addEventListener('resize', size);
    (function frame(t) {
      if (!live) return;
      g.clearRect(0, 0, c.width, c.height);
      for (const st of stars) {
        const tw = 0.45 + 0.55 * Math.sin(t / 900 * st.s + st.a * 7);
        g.globalAlpha = 0.15 + tw * 0.5;
        g.fillStyle = '#d6c9f7';
        g.fillRect(st.x, st.y, st.r, st.r);
      }
      g.globalAlpha = 1;
      requestAnimationFrame(frame);
    })(0);
    bootStars = { stop: function () { live = false; window.removeEventListener('resize', size); } };
  }

  function bootOn(title, sub) {
    $('#boot-msg').textContent = title;
    $('#boot-sub').textContent = sub || '';
    $('#boot').classList.add('on');
    bootStage('prep');
    bootAt = Date.now();
    if (bootTimer) clearInterval(bootTimer);
    bootTimer = setInterval(function () {
      const s = Math.round((Date.now() - bootAt) / 1000);
      $('#boot-elapsed').textContent = s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's';
      /* A launch that is taking a very long time is usually a slow line, not a
       * hang, and saying so stops people reloading halfway through a 34 MB
       * download and starting it again. */
      if (s === 25) $('#boot-hint').textContent = 'Still going. A slow connection can take a few minutes the first time.';
      if (s === 90) $('#boot-hint').textContent = 'Do not reload — that starts the download over. It will finish.';
    }, 1000);
    if (!bootStars) startBootStars();
  }

  function bootOff() {
    $('#boot').classList.remove('on');
    if (bootTimer) { clearInterval(bootTimer); bootTimer = null; }
    if (bootStars) { bootStars.stop(); bootStars = null; }
  }

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
    bootOn(entry ? 'Joining ' + entry.name : 'Starting Minecraft ' + bootVer.label,
           entry ? entry.addr : 'EaglercraftX ' + bootVer.label);
    $('#shell').style.display = 'none';

    /* Must happen before the bundle is injected: the wrapper has to be in
     * place on window before the game captures the constructor. A failure here
     * is not fatal — the game falls back to the relay's own ICE list. */
    if (Tn.configured()) {
      bootStage('turn');
      try {
        await Tn.prepare();
      } catch (e) { /* shared worlds simply stay as they were */ }
    }
    bootStage('load');

    try {
      await L.launch('game_frame', entry ? entry.addr : null, Vs.selected());
      $('#game-shell').classList.add('on');
      watchPointerLock();
      renderVersionPicker();
      const ts = Tn.state();
      if (ts.installed && ts.count) {
        console.info('[Orion] ' + ts.count + ' ICE server(s) applied to the game (' + ts.mode + ')');
      }
      Acc.setActivity({ status: Acc.activity().code ? 'hosting' : 'playing', version: Vs.selected().id, server: entry ? entry.addr : null });
      O.stopStars && O.stopStars();
      /* The bundle is in and main() has been called; the game is now bringing
       * up its own screen, which is the last stage and the only one whose end
       * we cannot observe — so it ticks as the boot screen gets out of the way. */
      bootStage('start');
      /* The client paints over the boot screen itself; drop it once the
       * canvas has had a frame to appear. */
      setTimeout(function () {
        bootStage('start', true);
        bootOff();
        /* Held back until the boot screen is gone: the bundle finishes loading
         * before its first frame is painted, so showing it any earlier puts an
         * exit button on top of the loading screen. */
        $('#game-exit').style.display = '';
      }, 2500);
    } catch (err) {
      bootOff();
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
  $('#btn-goto-together').addEventListener('click', () => show('together'));
  $('#btn-goto-servers').addEventListener('click', () => show('servers'));
  $('#game-exit').addEventListener('click', async () => {
    if (!confirm('Leave the game and go back to the launcher? Anything unsaved in a singleplayer world may be lost.')) return;
    /* Stop advertising a world that is about to stop existing. */
    try { await Acc.setActivity({ status: 'idle', world: '', code: '', server: '' }); } catch (e) { /* reloading anyway */ }
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
    show(['play', 'servers', 'friends', 'together', 'host', 'setup'].includes(h) ? h : 'play');
  }

  refreshBundle();

  /* The launcher is behind an account, so decide that before anything else is
   * worth looking at. A stored token is only a claim until the server agrees,
   * so resume() is what actually settles it. */
  (async function boot() {
    if (!Acc.available()) {
      /* No backend configured: run without accounts rather than locking
       * everyone out of a launcher that would otherwise work. */
      gateOn(false);
      ['friends'].forEach(function (v) {
        const tab = document.querySelector('nav.tabs button[data-view="' + v + '"]');
        if (tab) tab.style.display = 'none';
      });
      const mods = document.querySelector('nav.tabs a[href="mods/"]');
      if (mods) mods.style.display = 'none';
      return;
    }

    gateOn(true);
    renderGate('Checking your session…', 'ok');
    const res = await Acc.resume();
    if (res.ok) {
      renderGate(null);
      afterSignIn();
    } else {
      renderGate(null);
      $('#g-user').focus();
    }
  })();
})();
