/* ORION MODS — store wiring */
(function () {
  'use strict';

  const O = window.ORION;
  const NS = window.ORION_MODS;
  const Acc = O.Account;
  const cfg = O.config.api;
  const $ = (s) => document.querySelector(s);

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let mods = [];
  let filter = 'all';
  let pending = null;      // the inspected pack waiting to be published

  function notice(id, kind, html) {
    const el = $('#' + id);
    if (!el) return;
    el.innerHTML = html ? '<div class="note ' + kind + '">' + html + '</div>' : '';
  }

  const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB';

  /* ------------------------------------------------------------- listing */

  async function load() {
    try {
      const res = await fetch(cfg.url + '/rest/v1/orion_mods_public?select=*&order=created_at.desc', {
        headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key }
      });
      if (!res.ok) throw new Error('The store did not answer (' + res.status + ')');
      mods = await res.json();
      render();
    } catch (e) {
      $('#mod-grid').innerHTML =
        '<div class="empty" style="grid-column:1/-1"><p>Could not reach the store: ' + esc(e.message) + '</p></div>';
    }
  }

  function render() {
    const list = filter === 'all' ? mods : mods.filter((m) => (m.versions || []).includes(filter));
    if (!list.length) {
      $('#mod-grid').innerHTML =
        '<div class="empty" style="grid-column:1/-1"><p>' +
        (mods.length ? 'Nothing here for that version yet.' : 'No packs published yet.') +
        '</p></div>';
      return;
    }

    $('#mod-grid').innerHTML = list.map(function (m) {
      const url = cfg.url + '/storage/v1/object/public/orion-mods/' + m.storage_path;
      return '<div class="mod">' +
        '<div class="mod-art">' +
          (m.icon
            ? '<img src="' + esc(m.icon) + '" alt="">'
            : '<span class="initial">' + esc((m.title || '?').slice(0, 2).toUpperCase()) + '</span>') +
        '</div>' +
        '<div class="mod-body">' +
          '<h3>' + esc(m.title) + '</h3>' +
          '<div class="mod-sum">' + esc(m.summary || 'No description.') + '</div>' +
          '<div class="mod-meta">' +
            (m.versions || []).map((v) => '<span class="pill ok">' + esc(v) + '</span>').join('') +
            '<span>' + esc(fmtSize(m.size_bytes)) + '</span>' +
            (m.author ? '<span>· by ' + esc(m.author) + '</span>' : '') +
          '</div>' +
          '<div class="mod-acts">' +
            '<a class="btn slim primary" href="' + esc(url) + '" download="' + esc(m.file_name) +
              '" data-id="' + esc(m.id) + '" data-act="dl">Download</a>' +
            (Acc.isOwner()
              ? '<button class="btn slim ghost danger" data-act="del" data-id="' + esc(m.id) +
                '" data-path="' + esc(m.storage_path) + '">Remove</button>'
              : '') +
          '</div>' +
        '</div></div>';
    }).join('');
  }

  /* --------------------------------------------------------- built-in mods
   * Rendered from ORION_MODS.BUILTIN rather than from the database, because
   * they ship with the launcher. They honour the version filter like anything
   * else, so filtering to 1.12.2 does not leave a shelf of things that do not
   * apply. */
  function renderBuiltin() {
    const list = filter === 'all'
      ? NS.BUILTIN
      : NS.BUILTIN.filter((m) => m.versions.indexOf(filter) >= 0);

    $('#builtin-grid').innerHTML = list.map(function (m) {
      const kind = NS.KINDS[m.kind] || { label: m.kind, note: '' };
      return '<div class="mod built" data-built="' + esc(m.id) + '">' +
        '<div class="mod-art"><canvas data-art="' + esc(m.art) + '" width="96" height="96"></canvas></div>' +
        '<div class="mod-body">' +
          '<h3>' + esc(m.title) + '</h3>' +
          '<div class="mod-sum">' + esc(m.summary) + '</div>' +
          '<div class="mod-meta">' +
            m.versions.map((v) => '<span class="pill ok">' + esc(v) + '</span>').join('') +
            '<span class="kind">' + esc(kind.label) + '</span>' +
          '</div>' +
          '<div class="mod-why">' + esc(kind.note) + '</div>' +
          '<div class="mod-acts">' +
            '<a class="btn slim primary" href="' + esc(m.href) + '">' + esc(m.action) + '</a>' +
            '<button class="btn slim ghost" data-act="about" data-built="' + esc(m.id) + '">What it does</button>' +
          '</div>' +
        '</div></div>';
    }).join('');

    /* Canvas art has to be painted after the markup exists. */
    document.querySelectorAll('#builtin-grid canvas[data-art]').forEach(function (c) {
      c.getContext('2d').drawImage(NS.builtinArt(c.dataset.art, 96), 0, 0);
    });
  }

  $('#builtin-grid').addEventListener('click', function (ev) {
    const btn = ev.target.closest('button[data-act="about"]');
    if (!btn) return;
    const m = NS.BUILTIN.find((x) => x.id === btn.dataset.built);
    if (!m) return;
    const card = btn.closest('.mod');
    const existing = card.querySelector('.mod-about');
    if (existing) { existing.remove(); btn.textContent = 'What it does'; return; }
    const box = document.createElement('div');
    box.className = 'note mod-about';
    box.style.margin = '12px 0 0';
    box.innerHTML = esc(m.body);
    card.querySelector('.mod-body').appendChild(box);
    btn.textContent = 'Hide';
  });

  $('#filters').addEventListener('click', function (ev) {
    const b = ev.target.closest('button[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    document.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('on', c === b));
    renderBuiltin();
    render();
  });

  $('#mod-grid').addEventListener('click', async function (ev) {
    const dl = ev.target.closest('[data-act="dl"]');
    if (dl) {
      /* Let the download proceed; just record it. */
      fetch(cfg.url + '/rest/v1/rpc/orion_mods_downloaded', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: cfg.key, Authorization: 'Bearer ' + cfg.key },
        body: JSON.stringify({ p_id: dl.dataset.id })
      }).catch(() => {});
      return;
    }
    const del = ev.target.closest('[data-act="del"]');
    if (del) {
      if (!confirm('Remove this pack from the store for everyone?')) return;
      del.disabled = true;
      const form = new FormData();
      form.set('action', 'delete');
      form.set('token', Acc.token());
      form.set('id', del.dataset.id);
      form.set('path', del.dataset.path);
      try {
        const res = await fetch(cfg.url + '/functions/v1/orion-mods', { method: 'POST', body: form });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Removal failed.');
        notice('store-notice', 'ok', 'Removed.');
        load();
      } catch (e) {
        del.disabled = false;
        notice('store-notice', 'bad', esc(e.message));
      }
    }
  });

  /* ---------------------------------------------------------- who am I */

  function renderWho() {
    const m = Acc.me();
    $('#whoami').innerHTML = m
      ? '<span class="who">Signed in as <strong>' + esc(m.username) + '</strong>' +
        (m.role === 'owner' ? ' <span class="pill ok">owner</span>' : '') + '</span>'
      : '<a class="btn slim ghost" href="../">Sign in</a>';
    $('#upload-card').style.display = Acc.isOwner() ? '' : 'none';
  }

  /* ------------------------------------------------------------- upload */

  const drop = $('#drop');
  $('#btn-pick').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', function () {
    if (this.files && this.files[0]) inspect(this.files[0]);
    this.value = '';
  });

  ['dragenter', 'dragover'].forEach((t) =>
    drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) =>
    drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', function (e) {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) inspect(f);
  });
  drop.addEventListener('click', function (e) {
    if (!e.target.closest('button')) $('#file').click();
  });

  async function inspect(file) {
    $('#report').innerHTML = '<div class="note">Reading <strong>' + esc(file.name) + '</strong>…</div>';
    $('#publish-form').style.display = 'none';
    pending = null;

    let r;
    try {
      r = await NS.inspect(file);
    } catch (e) {
      $('#report').innerHTML = '<div class="note bad"><strong>Could not read that file.</strong> ' + esc(e.message) + '</div>';
      return;
    }

    const rows = []
      .concat(r.errors.map((t) => ({ k: 'bad', mark: '✕', t: t })))
      .concat(r.warnings.map((t) => ({ k: 'warn', mark: '!', t: t })))
      .concat(r.notes.map((t) => ({ k: 'ok', mark: '✓', t: t })));

    if (r.compatible && !r.warnings.length) {
      rows.unshift({ k: 'ok', mark: '✓', t: 'Everything checks out. This will load on ' + r.versions.join(' and ') + '.' });
    }

    $('#report').innerHTML =
      '<div class="note ' + (r.compatible ? 'ok' : 'bad') + '">' +
        '<strong>' + esc(file.name) + ' — ' +
        (r.compatible
          ? 'ready to publish' + (r.warnings.length ? ', with things to note' : '')
          : 'cannot be published yet') +
        '</strong>' +
        (r.versions.length ? '<br>Works on: ' + r.versions.map(esc).join(', ') : '') +
      '</div>' +
      '<div class="tallies">' +
        tally(r.counts.textures, 'textures') +
        tally(r.counts.sounds, 'sounds') +
        tally(r.counts.lang, 'language') +
        tally(r.counts.models, 'models') +
        tally(r.size, 'size', fmtSize(r.size)) +
      '</div>' +
      '<ul class="check-list">' + rows.map((x) =>
        '<li class="' + x.k + '"><span class="mark">' + x.mark + '</span><span class="txt">' + esc(x.t) + '</span></li>'
      ).join('') + '</ul>';

    if (!r.compatible) return;

    pending = { file: file, report: r };
    $('#publish-form').style.display = '';
    if (!$('#m-title').value) {
      $('#m-title').value = file.name.replace(/\.zip$/i, '').replace(/[_-]+/g, ' ').slice(0, 60);
    }
    if (!$('#m-summary').value && r.description) {
      $('#m-summary').value = r.description.replace(/§./g, '').slice(0, 240);
    }
  }

  function tally(n, label, override) {
    return '<div class="tally"><b>' + esc(override || String(n)) + '</b><span>' + esc(label) + '</span></div>';
  }

  $('#btn-cancel-upload').addEventListener('click', function () {
    pending = null;
    $('#report').innerHTML = '';
    $('#publish-form').style.display = 'none';
  });

  $('#btn-publish').addEventListener('click', async function () {
    if (!pending) return;
    const err = $('#publish-error');
    const title = $('#m-title').value.trim();
    if (title.length < 2) {
      err.textContent = 'Give it a name.';
      err.classList.remove('hide');
      return;
    }
    err.classList.add('hide');
    this.disabled = true;
    const was = this.textContent;
    this.textContent = 'Uploading…';

    const form = new FormData();
    form.set('token', Acc.token());
    form.set('title', title);
    form.set('summary', $('#m-summary').value.trim());
    form.set('body', $('#m-body').value.trim());
    form.set('versions', JSON.stringify(pending.report.versions));
    form.set('pack_format', String(pending.report.pack_format || ''));
    form.set('report', JSON.stringify({
      errors: pending.report.errors, warnings: pending.report.warnings,
      notes: pending.report.notes, counts: pending.report.counts
    }));
    form.set('compatible', String(!!pending.report.compatible));
    if (pending.report.icon) form.set('icon', pending.report.icon);
    form.set('file', pending.file, pending.file.name);

    try {
      const res = await fetch(cfg.url + '/functions/v1/orion-mods', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Upload failed (' + res.status + ').');
      notice('store-notice', 'ok', '<strong>Published.</strong> ' + esc(title) + ' is in the store.');
      pending = null;
      $('#report').innerHTML = '';
      $('#publish-form').style.display = 'none';
      ['#m-title', '#m-summary', '#m-body'].forEach((s) => { $(s).value = ''; });
      load();
    } catch (e) {
      err.textContent = e.message;
      err.classList.remove('hide');
    } finally {
      this.disabled = false;
      this.textContent = was;
    }
  });

  /* --------------------------------------------------------------- boot */

  (function stars() {
    const cv = $('#stars');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    function build() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
      cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      const n = Math.round(innerWidth * innerHeight / 11000);
      for (let i = 0; i < n; i++) {
        ctx.globalAlpha = Math.random() * 0.45 + 0.12;
        ctx.fillStyle = Math.random() > 0.8 ? '#cdd6ff' : '#ffffff';
        ctx.beginPath();
        ctx.arc(Math.random() * innerWidth, Math.random() * innerHeight, Math.random() * 1.1 + 0.25, 0, 6.284);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    build();
    addEventListener('resize', build);
  })();

  (async function boot() {
    renderWho();
    renderBuiltin();
    load();
    if (Acc.available()) {
      await Acc.resume();
      renderWho();
      render();
    }
  })();
})();
