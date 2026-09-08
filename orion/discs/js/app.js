/* ORION DISC PRINTER — the page
 *
 * Three steps, in the order you actually do them: make a track, put it on one
 * of the twelve discs the game has, print the lot as a resource pack. The
 * pieces it leans on:
 *
 *   music.js  generates a track and renders it offline
 *   wav.js    turns samples into a file the client will decode, and checks a
 *             file you bring by decoding it
 *   art.js    draws the 16x16 disc and the pack icon
 *   pack.js   lays the files out the way a resource pack has to be
 *   ORION.Zip / ORION.Packs  build the zip, or write it straight into the game
 *
 * Tracks live in memory only. Audio is megabytes and there is nowhere sensible
 * to keep that between visits, so the page says so rather than quietly losing
 * work: printing is what makes it permanent.
 */
(function () {
  'use strict';

  const NS = window.ORION_DISCS;
  const O = window.ORION;
  const Acc = O.Account;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const MAX_SECONDS = 300;
  const MAX_FILE = 12 * 1024 * 1024;

  /* slot id -> { name, artist, mood, seed, audio, art, seconds, source } */
  const printed = Object.create(null);
  let take = null;              /* the track in hand, not yet on a disc */
  let source = 'file';
  let mood = 'nebula';
  let player = null;            /* the AudioContext currently playing a take */

  function notice(where, kind, html) {
    const box = $(where);
    if (!box) return;
    box.innerHTML = '<div class="note ' + kind + '">' + html + '</div>';
  }
  const clear = (where) => { const b = $(where); if (b) b.innerHTML = ''; };

  function fmtSize(n) {
    if (!n) return '0 KB';
    return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  }
  const fmtTime = (s) => Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0');

  /* ------------------------------------------------------------------ moods */

  function renderMoods() {
    $('#moods').innerHTML = NS.moodList().map((m) =>
      '<button class="mood' + (m.id === mood ? ' on' : '') + '" data-mood="' + esc(m.id) + '">' +
      '<strong>' + esc(m.label) + '</strong><span>' + esc(m.blurb) + '</span></button>').join('');
  }

  $('#moods').addEventListener('click', function (ev) {
    const b = ev.target.closest('button[data-mood]');
    if (!b) return;
    mood = b.dataset.mood;
    renderMoods();
  });

  $('#press-tabs').addEventListener('click', function (ev) {
    const b = ev.target.closest('button[data-src]');
    if (!b) return;
    source = b.dataset.src;
    document.querySelectorAll('#press-tabs .chip').forEach((c) => c.classList.toggle('on', c === b));
    $('#src-gen').style.display = source === 'gen' ? '' : 'none';
    $('#src-file').style.display = source === 'file' ? '' : 'none';
  });

  /* ------------------------------------------------------------- generating */

  const randomSeed = () => Math.random().toString(36).slice(2, 8);

  $('#f-len').addEventListener('input', function () {
    $('#len-out').textContent = this.value + ' seconds';
  });
  $('#btn-shuffle').addEventListener('click', function () {
    $('#f-seed').value = randomSeed();
  });

  $('#btn-render').addEventListener('click', async function () {
    const seedText = $('#f-seed').value.trim() || randomSeed();
    $('#f-seed').value = seedText;
    const seconds = Math.min(MAX_SECONDS, Math.max(20, +$('#f-len').value || 90));

    this.disabled = true;
    notice('#notice', 'ok', '<div class="rendering"><span class="spinner"></span>' +
      'Rendering ' + seconds + ' seconds of ' + esc(NS.MOODS[mood].label) + '…</div>');
    try {
      const seed = NS.seedFromText(mood + ':' + seedText);
      const track = await NS.render({ mood: mood, seed: seed, seconds: seconds });
      const audio = NS.toWav(track.samples, track.sampleRate);
      await setTake({
        title: NS.MOODS[mood].label + ' · ' + seedText,
        name: NS.MOODS[mood].label,
        artist: 'Synth',
        mood: mood,
        seed: seed,
        audio: audio,
        samples: track.samples,
        seconds: track.seconds,
        source: 'generated here, ' + track.bpm + ' BPM'
      });
      clear('#notice');
    } catch (e) {
      notice('#notice', 'bad', esc(e.message || String(e)));
    } finally {
      this.disabled = false;
    }
  });

  /* ---------------------------------------------------------- a file of ours */

  $('#btn-pick').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', function () {
    if (this.files && this.files[0]) takeFile(this.files[0]);
  });

  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((n) => drop.addEventListener(n, (e) => {
    e.preventDefault(); drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((n) => drop.addEventListener(n, (e) => {
    e.preventDefault(); drop.classList.remove('over');
  }));
  drop.addEventListener('drop', function (e) {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) takeFile(f);
  });

  async function takeFile(file) {
    clear('#file-report');
    if (file.size > MAX_FILE) {
      notice('#file-report', 'bad', 'That file is ' + fmtSize(file.size) +
        '. The limit here is ' + fmtSize(MAX_FILE) + ' — a whole resource pack has to stay small enough to load.');
      return;
    }
    notice('#file-report', 'ok', '<div class="rendering"><span class="spinner"></span>Decoding it…</div>');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      /* The real check: if the browser can decode it, so can the game, because
       * this is the same call the game makes. */
      const info = await NS.decodeAudio(bytes.buffer);
      if (info.seconds > MAX_SECONDS) {
        notice('#file-report', 'bad', 'That is ' + fmtTime(info.seconds) + ' long. Discs here are capped at ' +
          fmtTime(MAX_SECONDS) + ' — trim it first and try again.');
        return;
      }
      const samples = NS.downmix(info.buffer, Math.min(info.sampleRate, 22050));
      const guess = file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').slice(0, 40);
      await setTake({
        title: guess || 'My track',
        name: guess || 'My track',
        artist: '',
        mood: 'custom',
        seed: NS.seedFromText(file.name + file.size),
        audio: bytes,
        samples: samples,
        seconds: info.seconds,
        source: file.name + ' · ' + fmtSize(file.size) + ' · copied in as it is'
      });
      notice('#file-report', 'ok', '<strong>' + esc(file.name) + '</strong> decoded: ' +
        fmtTime(info.seconds) + ', ' + info.channels + ' channel' + (info.channels === 1 ? '' : 's') +
        ' at ' + info.sampleRate + ' Hz. It goes into the pack unchanged, so it stays this size.');
    } catch (e) {
      notice('#file-report', 'bad', 'The browser could not decode that file, so the game could not either. ' +
        'Try an mp3, ogg, wav or m4a.');
    }
  }

  /* ----------------------------------------------------------- current take */

  async function setTake(t) {
    stopPlaying();
    take = t;
    const disc = NS.disc({ mood: t.mood, seed: t.seed });
    const ctx = $('#take-disc').getContext('2d');
    ctx.clearRect(0, 0, 16, 16);
    ctx.drawImage(disc, 0, 0);
    t.art = await NS.toPng(disc);

    $('#take-title').textContent = t.title;
    $('#take-meta').textContent = fmtTime(t.seconds) + ' · ' + fmtSize(t.audio.length);
    $('#take').style.display = '';
    drawWave(t.samples);
    $('#take').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function drawWave(samples) {
    const c = $('#wave');
    const g = c.getContext('2d');
    const w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    if (!samples || !samples.length) return;
    const per = Math.max(1, Math.floor(samples.length / w));
    g.fillStyle = 'rgba(156,134,220,0.85)';
    for (let x = 0; x < w; x++) {
      let peak = 0;
      const at = x * per;
      for (let i = 0; i < per; i += Math.max(1, per >> 6)) {
        const v = Math.abs(samples[at + i] || 0);
        if (v > peak) peak = v;
      }
      const bar = Math.max(1, peak * (h - 6));
      g.fillRect(x, (h - bar) / 2, 1, bar);
    }
    g.strokeStyle = 'rgba(214,201,247,0.22)';
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  }

  function stopPlaying() {
    if (player) {
      try { player.stop(); } catch (e) { /* already finished */ }
      try { player.ctx.close(); } catch (e) { /* already closed */ }
      player = null;
    }
    $('#btn-play').textContent = 'Play';
  }

  $('#btn-play').addEventListener('click', async function () {
    if (player) { stopPlaying(); return; }
    if (!take) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    try {
      const buf = await ctx.decodeAudioData(take.audio.slice(0).buffer);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => stopPlaying();
      src.start();
      src.ctx = ctx;
      player = src;
      this.textContent = 'Stop';
    } catch (e) {
      if (ctx.close) ctx.close();
      notice('#notice', 'bad', 'That take would not play back here: ' + esc(e.message || String(e)));
    }
  });

  $('#btn-discard').addEventListener('click', function () {
    stopPlaying();
    take = null;
    $('#take').style.display = 'none';
  });

  /* Pressing "put it on a disc" highlights the slots rather than choosing one
   * for you: which disc you overwrite is a real choice, since it decides which
   * of the vanilla tracks you lose. */
  let assigning = false;
  $('#btn-assign').addEventListener('click', function () {
    if (!take) return;
    assigning = true;
    renderSlots();
    $('#slots').scrollIntoView({ block: 'start', behavior: 'smooth' });
    notice('#notice', 'ok', 'Pick which disc to print it on. Anything you have already printed can be replaced.');
  });

  /* ------------------------------------------------------------------ slots */

  function renderSlots() {
    $('#slots').innerHTML = NS.SLOTS.map(function (s) {
      const p = printed[s.id];
      return '<div class="slot' + (p ? ' filled' : '') + (assigning ? ' target' : '') + '" data-slot="' + esc(s.id) + '">' +
        '<div class="slot-top">' +
          '<canvas width="16" height="16" data-art="' + esc(s.id) + '"></canvas>' +
          '<div>' +
            '<div class="slot-name">' + esc(p ? (p.name || s.id) : s.title) + '</div>' +
            (p
              ? '<div class="slot-was">' + esc(fmtTime(p.seconds)) + ' · ' + esc(fmtSize(p.audio.length)) +
                ' · was ' + esc(s.artist + ' – ' + s.title) + '</div>'
              : '<div class="slot-was">unchanged · ' + esc(s.artist + ' – ' + s.title) + '</div>') +
          '</div>' +
        '</div>' +
        (p
          ? '<div class="slot-fields">' +
              '<input type="text" data-field="name" data-slot="' + esc(s.id) + '" value="' + esc(p.name) + '" maxlength="40" placeholder="Track name">' +
              '<input type="text" data-field="artist" data-slot="' + esc(s.id) + '" value="' + esc(p.artist) + '" maxlength="32" placeholder="Who made it (optional)">' +
            '</div>' +
            '<div class="slot-acts">' +
              '<button class="btn slim" data-act="hear" data-slot="' + esc(s.id) + '">Hear it</button>' +
              '<button class="btn slim ghost danger" data-act="clear" data-slot="' + esc(s.id) + '">Put it back</button>' +
            '</div>'
          : (assigning ? '<div class="slot-acts"><button class="btn slim primary" data-act="use" data-slot="' + esc(s.id) + '">Print here</button></div>' : '')) +
        '</div>';
    }).join('');

    /* Canvases cannot be drawn from a string, so fill them in afterwards. */
    for (const s of NS.SLOTS) {
      const c = $('#slots canvas[data-art="' + s.id + '"]');
      if (!c) continue;
      const p = printed[s.id];
      const disc = NS.disc(p ? { mood: p.mood, seed: p.seed } : { mood: 'custom', seed: NS.seedFromText(s.id), mark: 0, color: '#3b3550', shine: '#6b6296' });
      const g = c.getContext('2d');
      g.clearRect(0, 0, 16, 16);
      g.drawImage(disc, 0, 0);
    }

    if (assigning) {
      document.querySelectorAll('.slot').forEach(function (el) {
        if (el.querySelector('[data-act="use"]')) return;
        /* A filled slot can be replaced too, so give it the same button. */
        const id = el.dataset.slot;
        const acts = el.querySelector('.slot-acts');
        if (acts) acts.insertAdjacentHTML('afterbegin',
          '<button class="btn slim primary" data-act="use" data-slot="' + id + '">Replace</button>');
      });
    }

    const n = Object.keys(printed).length;
    $('#slot-count').textContent = n + ' printed';
    /* The printer block on its own is a pack worth having, so it counts. */
    const nothing = n === 0 && !blockWanted();
    $('#btn-install').disabled = nothing;
    $('#btn-download').disabled = nothing;
    drawBlock();
  }

  $('#slots').addEventListener('click', async function (ev) {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.slot;

    if (btn.dataset.act === 'use') {
      if (!take) return;
      printed[id] = {
        name: take.name, artist: take.artist, mood: take.mood, seed: take.seed,
        audio: take.audio, art: take.art, seconds: take.seconds, samples: take.samples
      };
      assigning = false;
      take = null;
      stopPlaying();
      $('#take').style.display = 'none';
      renderSlots();
      const slotLabel = NS.SLOTS.find((s) => s.id === id);
      notice('#notice', 'ok', 'Printed onto the <strong>' + esc(slotLabel.title) + '</strong> disc. ' +
        'Print more, or go to step 3.');
      return;
    }

    if (btn.dataset.act === 'clear') {
      delete printed[id];
      renderSlots();
      return;
    }

    if (btn.dataset.act === 'hear') {
      const p = printed[id];
      if (!p) return;
      stopPlaying();
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      try {
        const buf = await ctx.decodeAudioData(p.audio.slice(0).buffer);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.connect(ctx.destination);
        src.onended = () => stopPlaying();
        src.start(); src.ctx = ctx; player = src;
      } catch (e) {
        if (ctx.close) ctx.close();
      }
    }
  });

  $('#slots').addEventListener('input', function (ev) {
    const f = ev.target.closest('input[data-field]');
    if (!f) return;
    const p = printed[f.dataset.slot];
    if (!p) return;
    p[f.dataset.field] = f.value;
    /* Only the label text changed, so leave the rest of the grid alone rather
     * than re-rendering and stealing focus mid-word. */
    const card = f.closest('.slot');
    if (f.dataset.field === 'name') card.querySelector('.slot-name').textContent = f.value || f.dataset.slot;
  });

  /* ---------------------------------------------------------- printer block
   * The jukebox, reskinned. Drawn here so the two faces can be previewed
   * before they are in the pack; art.js says why a reskin is the honest answer
   * rather than a new block. */
  let blockArt = null;

  function drawBlock() {
    /* Coloured after whatever is on the first disc, so the machine matches the
     * records that came out of it. */
    const first = printed[Object.keys(printed)[0]];
    const seed = first ? first.seed : 20260908;
    const mood = first ? first.mood : 'nebula';
    blockArt = NS.printerBlock({ mood: mood, seed: seed });
    for (const face of ['top', 'side']) {
      const c = $('#block-' + face);
      if (!c) continue;
      const g = c.getContext('2d');
      g.clearRect(0, 0, 16, 16);
      g.drawImage(blockArt[face], 0, 0);
    }
  }

  function blockWanted() {
    return $('#f-block').checked;
  }

  $('#f-block').addEventListener('change', function () {
    $('#block-row').classList.toggle('off', !this.checked);
    lastBuild = null;
    renderSlots();
  });
  $('#f-block-name').addEventListener('input', function () { lastBuild = null; });

  async function blockFiles() {
    if (!blockWanted()) return null;
    if (!blockArt) drawBlock();
    return {
      side: await NS.toPng(blockArt.side),
      top: await NS.toPng(blockArt.top),
      name: $('#f-block-name').value.trim() || 'Orion Disc Printer'
    };
  }

  /* --------------------------------------------------------------- printing */

  function discList() {
    return Object.keys(printed).map((id) => ({
      slot: id,
      name: printed[id].name,
      artist: printed[id].artist || 'Orion',
      audio: printed[id].audio,
      art: printed[id].art
    }));
  }

  async function buildPack() {
    const discs = discList();
    const block = await blockFiles();
    if (!discs.length && !block) {
      throw new Error('Nothing to print: put a track on a disc, or include the printer block.');
    }
    const title = $('#f-title').value.trim() || 'Orion Records';
    const version = $('#f-version').value;
    const first = printed[Object.keys(printed)[0]] || { mood: 'nebula', seed: 20260908 };
    const icon = await NS.toPng(NS.packIcon({ mood: first.mood, seed: first.seed }));
    const parts = [];
    if (discs.length) parts.push(discs.length + ' disc' + (discs.length === 1 ? '' : 's'));
    if (block) parts.push('the printer block');
    const built = await NS.build({
      version: version,
      discs: discs,
      block: block,
      icon: icon,
      description: title + ' — ' + parts.join(' and ') + ', printed by Orion'
    });
    return { built: built, title: title, version: version, icon: icon, discs: discs, block: block };
  }

  /* Building the pack twice — once to install, once to download — would render
   * nothing new but would cost seconds of zipping, so it is kept. */
  let lastBuild = null;
  async function ensureBuild() {
    const key = JSON.stringify({
      t: $('#f-title').value, v: $('#f-version').value,
      b: blockWanted() ? $('#f-block-name').value : null,
      d: Object.keys(printed).map((id) => id + ':' + printed[id].name + ':' + printed[id].artist + ':' + printed[id].audio.length)
    });
    if (lastBuild && lastBuild.key === key) return lastBuild.value;
    const value = await buildPack();
    lastBuild = { key: key, value: value };
    return value;
  }

  function printError(msg) {
    const box = $('#print-error');
    box.textContent = msg;
    box.classList.remove('hide');
  }
  const clearPrintError = () => $('#print-error').classList.add('hide');

  $('#btn-download').addEventListener('click', async function () {
    clearPrintError();
    this.disabled = true;
    try {
      const r = await ensureBuild();
      O.Zip.download(r.built.bytes, O.Packs.folderName(r.title) + '.zip');
      notice('#print-result', 'ok', 'Downloaded <strong>' + esc(O.Packs.folderName(r.title)) + '.zip</strong> (' +
        fmtSize(r.built.bytes.length) + '). Add it in the game under <em>Options → Resource Packs</em>.');
    } catch (e) {
      printError(e.message || String(e));
    } finally {
      this.disabled = false;
    }
  });

  $('#btn-install').addEventListener('click', async function () {
    clearPrintError();
    if (!O.Packs.supported($('#f-version').value)) {
      printError('Orion can only write straight into the 1.8 client’s storage. ' +
        'For 1.12.2, download the zip and add it in the game.');
      return;
    }
    this.disabled = true;
    try {
      const r = await ensureBuild();
      /* Install from the file list rather than the zip: the client keeps loose
       * files, so handing it the list skips packing and unpacking entirely. */
      const files = await filesFor(r);
      const res = await O.Packs.install({ version: r.version, title: r.title, files: files });
      notice('#print-result', 'ok',
        'Installed as <strong>' + esc(res.folder) + '</strong> — ' + res.files + ' files.');
      await showInstalled();
    } catch (e) {
      printError(e.message || String(e));
    } finally {
      this.disabled = false;
    }
  });

  /* The same layout pack.js builds, but as a list rather than a zip. */
  async function filesFor(r) {
    const target = NS.TARGETS[r.version] || NS.TARGETS['1.8'];
    const files = [
      { name: 'pack.mcmeta', bytes: JSON.stringify({ pack: { pack_format: target.pack_format, description: r.title + ' — printed by Orion' } }, null, 2) },
      { name: 'pack.png', bytes: r.icon }
    ];
    const lang = [];
    if (r.block) {
      files.push({ name: NS.BLOCK.side, bytes: r.block.side });
      files.push({ name: NS.BLOCK.top, bytes: r.block.top });
      lang.push(NS.BLOCK.langKey + '=' + r.block.name);
    }
    for (const d of r.discs) {
      files.push({ name: 'assets/minecraft/sounds/records/' + d.slot + '.ogg', bytes: d.audio });
      if (d.art) files.push({ name: 'assets/minecraft/textures/items/record_' + d.slot + '.png', bytes: d.art });
      lang.push('item.record.' + d.slot + '.desc=' + (d.artist || 'Synth') + ' - ' + (d.name || d.slot));
    }
    lang.sort();
    files.push({ name: target.lang, bytes: lang.join('\n') + '\n' });
    return files;
  }

  async function showInstalled() {
    const box = $('#installed-note');
    if (!O.Packs.supported('1.8')) { box.style.display = 'none'; return; }
    const list = await O.Packs.list('1.8');
    if (!list.length) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = '<strong>In your game already:</strong> ' +
      list.map((e) => '<span class="mono">' + esc(e.folder) + '</span>').join(', ') +
      '. Turn a pack on under <em>Options → Resource Packs</em>. If the client is open right now, ' +
      'it will see a new pack the next time it starts.';
  }

  /* -------------------------------------------------------------- publishing */

  $('#btn-publish').addEventListener('click', async function () {
    clearPrintError();
    this.disabled = true;
    try {
      const r = await ensureBuild();
      const cfg = (O.config && O.config.api) || {};
      const form = new FormData();
      form.set('action', 'publish');
      form.set('token', Acc.token());
      form.set('title', r.title);
      form.set('summary', (r.discs.length
        ? r.discs.length + ' music disc' + (r.discs.length === 1 ? '' : 's')
        : 'The Orion Disc Printer block') + (r.block && r.discs.length ? ' and the printer block' : ''));
      form.set('body', 'Printed with the Orion disc printer.\n\n' +
        r.discs.map((d) => '· ' + d.slot + ' → ' + (d.artist || 'Orion') + ' – ' + d.name).join('\n'));
      form.set('versions', JSON.stringify([r.version]));
      form.set('pack_format', String((NS.TARGETS[r.version] || NS.TARGETS['1.8']).pack_format));
      form.set('compatible', 'true');
      form.set('report', JSON.stringify({ printer: 'orion-discs', discs: r.discs.map((d) => d.slot) }));
      form.set('file', new File([r.built.bytes], O.Packs.folderName(r.title) + '.zip', { type: 'application/zip' }));
      const res = await fetch(cfg.url + '/functions/v1/orion-mods', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'The store refused it.');
      notice('#print-result', 'ok', 'Published. It is in the <a href="../mods/">mod store</a> now.');
    } catch (e) {
      printError(e.message || String(e));
    } finally {
      this.disabled = false;
    }
  });

  /* --------------------------------------------------------------- the shell */

  function renderWho() {
    const me = Acc.me();
    const box = $('#whoami');
    if (!me) {
      box.innerHTML = '<span class="who">Not signed in — <a href="../">sign in</a></span>';
      return;
    }
    box.innerHTML = '<span class="who">Signed in as <strong>' + esc(me.username) + '</strong></span>' +
      (Acc.isOwner() ? ' <span class="pill ok">owner</span>' : '');
    $('#btn-publish').style.display = Acc.isOwner() ? '' : 'none';
  }

  async function boot() {
    renderMoods();
    $('#f-seed').value = randomSeed();
    renderSlots();
    const hero = $('#hero-disc').getContext('2d');
    hero.drawImage(NS.disc({ mood: 'nebula', seed: 20260908 }), 0, 0);
    drawBlock();

    if (Acc.available()) {
      await Acc.resume();
    }
    renderWho();
    await showInstalled();

    if (!window.OfflineAudioContext && !window.webkitOfflineAudioContext) {
      notice('#notice', 'bad', 'This browser cannot render audio offline, so Orion music cannot be ' +
        'generated here. Bringing your own file still works.');
    }
  }

  /* Leaving with unprinted work is easy to do by accident. */
  window.addEventListener('beforeunload', function (e) {
    if (!Object.keys(printed).length && !take) return;
    e.preventDefault();
    e.returnValue = '';
  });

  boot();
})();
