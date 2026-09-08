/* ORION THEME — the page
 *
 * Pick a palette, look at what the menu will become, and put it in the game.
 * The preview is not a mockup of the menu: it is built out of the exact
 * textures the pack will contain, blitted the way the client blits them — the
 * title from its two halves, buttons stretched from their strip, the backdrop
 * tiled — so if the preview looks wrong, the pack is wrong.
 */
(function () {
  'use strict';

  const T = window.ORION_THEME;
  const O = window.ORION;
  const Acc = O.Account;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let paletteId = 'orion';
  let word = 'ORION';
  let seed = 20260908;
  let doWidgets = true;
  let built = null;               /* the drawn canvases, cached until inputs change */

  function notice(where, kind, html) {
    const b = $(where);
    if (b) b.innerHTML = '<div class="note ' + kind + '">' + html + '</div>';
  }
  const clear = (w) => { const b = $(w); if (b) b.innerHTML = ''; };

  /* ---------------------------------------------------------------- drawing */

  function draw() {
    const pal = T.PALETTES[paletteId];
    built = {
      pal: pal,
      title: T.title(pal, word),
      mojang: T.mojang(pal, word),
      background: T.background(pal, seed),
      panorama: T.panorama(pal, seed, 256),
      widgets: doWidgets ? T.widgets(pal) : null
    };
    return built;
  }

  /* ---------------------------------------------------------------- preview
   * 1.8 draws the main menu on a 240-ish tall virtual screen scaled up. The
   * preview uses the same proportions so the title and buttons sit where they
   * really will. */
  function preview() {
    const b = built || draw();
    const c = $('#preview');
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);

    /* The panorama is a turning skybox; face 0 is what you mostly see.
     *
     * The client then blends it heavily toward white — measured by installing a
     * pack of flat colours and looking: a #ff00aa face comes out pale pink — so
     * the preview blends the same way. Without this the preview would show a
     * deep violet sky the game will never actually draw. The figure is
     * approximate; everything else on this page is exact. */
    g.drawImage(b.panorama[0], 0, 0, 256, 256, 0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(0, 0, W, H);
    /* And the menu's own darkening behind the buttons. */
    g.fillStyle = 'rgba(0,0,0,0.1)';
    g.fillRect(0, 0, W, H);

    /* The title, from the two halves the client blits side by side. */
    const scale = W / 427;                       /* 427 ~ a 1280-wide window at GUI scale 3 */
    const tw = 310 * scale, th = 44 * scale;
    const tx = (W - tw) / 2, ty = H * 0.09;
    g.drawImage(b.title, 0, 0, 155, 44, tx, ty, tw / 2, th);
    g.drawImage(b.title, 0, 45, 155, 44, tx + tw / 2, ty, tw / 2, th);

    /* Buttons, stretched from the middle of their strip exactly as the game
     * does: left half, right half. */
    const src = b.widgets || null;
        const labels = ['Singleplayer', 'Multiplayer', 'Download Offline'];
    const bw = 200 * scale, bh = 20 * scale;
    labels.forEach(function (label, i) {
      const x = (W - bw) / 2;
      const y = H * 0.42 + i * (bh + 8 * scale);
      if (src) {
        const sy = i === 1 ? 86 : 66;            /* the middle one shown hovered */
        g.drawImage(src, 0, sy, 100, 20, x, y, bw / 2, bh);
        g.drawImage(src, 100, sy, 100, 20, x + bw / 2, y, bw / 2, bh);
      } else {
        g.fillStyle = 'rgba(160,160,160,0.85)';
        g.fillRect(x, y, bw, bh);
      }
      g.fillStyle = b.pal.text;
      g.font = Math.round(9 * scale) + 'px "Rajdhani", system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(label, W / 2, y + bh / 2 + 1);
    });

    g.textAlign = 'left';
    g.fillStyle = b.pal.dim;
    g.font = Math.round(7 * scale) + 'px "JetBrains Mono", monospace';
    g.fillText('Minecraft 1.8.8 · Orion Client', 6 * scale, H - 10 * scale);
  }

  function previewMenus() {
    const b = built || draw();
    const c = $('#preview-menu');
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.imageSmoothingEnabled = false;

    /* The backdrop is a 16x16 tile drawn at 2x by the game, darkened. */
    const tile = 32;
    for (let y = 0; y < H; y += tile) {
      for (let x = 0; x < W; x += tile) g.drawImage(b.background, x, y, tile, tile);
    }
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(0, 0, W, H);

    const scale = W / 427;
    g.fillStyle = b.pal.text;
    g.font = Math.round(10 * scale) + 'px "Rajdhani", system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('Options', W / 2, 22 * scale);

    const bw = 150 * scale, bh = 20 * scale;
    [['Skin Customization…', 0], ['Music & Sounds…', 1], ['Video Settings…', 2]].forEach(function (row) {
      const y = 44 * scale + row[1] * (bh + 6 * scale);
      const x = (W - bw) / 2;
      if (b.widgets) {
        g.drawImage(b.widgets, 0, 66, 100, 20, x, y, bw / 2, bh);
        g.drawImage(b.widgets, 100, 66, 100, 20, x + bw / 2, y, bw / 2, bh);
      } else {
        g.fillStyle = 'rgba(160,160,160,0.85)';
        g.fillRect(x, y, bw, bh);
      }
      g.fillStyle = b.pal.text;
      g.font = Math.round(8.5 * scale) + 'px "Rajdhani", system-ui, sans-serif';
      g.fillText(row[0], W / 2, y + bh / 2 + 1);
    });
    g.textAlign = 'left';
  }

  function previewLoading() {
    const b = built || draw();
    const c = $('#preview-load');
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = b.pal.void;
    g.fillRect(0, 0, c.width, c.height);
    const s = Math.min(c.width, c.height) * 0.92;
    g.drawImage(b.mojang, (c.width - s) / 2, (c.height - s) / 2, s, s);
  }

  function previewAll() {
    draw();
    preview();
    previewMenus();
    previewLoading();
    renderSwatches();
  }

  function renderSwatches() {
    const b = built;
    $('#swatches').innerHTML = ['void', 'bg', 'panel', 'line', 'accent', 'accent2', 'text']
      .map((k) => '<span class="sw" title="' + k + '" style="background:' + b.pal[k] + '"></span>').join('');
  }

  /* ----------------------------------------------------------------- inputs */

  function renderPalettes() {
    $('#palettes').innerHTML = T.paletteList().map((p) =>
      '<button class="mood' + (p.id === paletteId ? ' on' : '') + '" data-pal="' + esc(p.id) + '">' +
      '<strong>' + esc(p.label) + '</strong><span>' + esc(p.blurb) + '</span></button>').join('');
  }

  $('#palettes').addEventListener('click', function (ev) {
    const b = ev.target.closest('button[data-pal]');
    if (!b) return;
    paletteId = b.dataset.pal;
    renderPalettes();
    previewAll();
  });

  $('#f-word').addEventListener('input', function () {
    word = this.value.toUpperCase().replace(/[^A-Z0-9 .]/g, '').slice(0, 12) || 'ORION';
    previewAll();
  });

  $('#btn-sky').addEventListener('click', function () {
    seed = (Math.random() * 0xffffffff) >>> 0;
    previewAll();
  });

  $('#f-widgets').addEventListener('change', function () {
    doWidgets = this.checked;
    previewAll();
  });

  /* ---------------------------------------------------------------- the pack */

  async function files(version) {
    const b = built || draw();
    const fmt = version === '1.12.2' ? 3 : 1;
    const A = 'assets/minecraft/textures/gui/';
    const out = [
      { name: 'pack.mcmeta', bytes: JSON.stringify({
          pack: { pack_format: fmt, description: word + ' theme — menus and loading screens, by Orion' }
        }, null, 2) },
      { name: 'pack.png', bytes: await T.toPng(b.mojang) },
      { name: A + 'title/minecraft.png', bytes: await T.toPng(b.title) },
      { name: A + 'title/mojang.png', bytes: await T.toPng(b.mojang) },
      { name: A + 'options_background.png', bytes: await T.toPng(b.background) }
    ];
    for (let i = 0; i < 6; i++) {
      out.push({ name: A + 'title/background/panorama_' + i + '.png', bytes: await T.toPng(b.panorama[i]) });
    }
    if (b.widgets) out.push({ name: A + 'widgets.png', bytes: await T.toPng(b.widgets) });
    return out;
  }

  function packError(msg) {
    const box = $('#pack-error');
    box.textContent = msg;
    box.classList.remove('hide');
  }
  const clearPackError = () => $('#pack-error').classList.add('hide');

  $('#btn-install').addEventListener('click', async function () {
    clearPackError();
    const version = $('#f-version').value;
    if (!O.Packs.supported(version)) {
      packError('Orion can only write straight into the 1.8 client’s storage. For 1.12.2, download the zip and add it in the game.');
      return;
    }
    this.disabled = true;
    try {
      const list = await files(version);
      const res = await O.Packs.install({ version: version, title: word + ' Theme', files: list });
      notice('#pack-result', 'ok', 'Installed as <strong>' + esc(res.folder) + '</strong> — ' + res.files +
        ' files. Turn it on in the game under <em>Options → Resource Packs</em>; if the client is open, ' +
        'it will see the pack next time it starts.');
    } catch (e) {
      packError(e.message || String(e));
    } finally {
      this.disabled = false;
    }
  });

  $('#btn-download').addEventListener('click', async function () {
    clearPackError();
    this.disabled = true;
    try {
      const version = $('#f-version').value;
      const bytes = await O.Zip.build(await files(version));
      const name = O.Packs.folderName(word + '-theme') + '.zip';
      O.Zip.download(bytes, name);
      notice('#pack-result', 'ok', 'Downloaded <strong>' + esc(name) + '</strong>. Add it in the game under ' +
        '<em>Options → Resource Packs</em>.');
    } catch (e) {
      packError(e.message || String(e));
    } finally {
      this.disabled = false;
    }
  });

  $('#btn-publish').addEventListener('click', async function () {
    clearPackError();
    this.disabled = true;
    try {
      const version = $('#f-version').value;
      const bytes = await O.Zip.build(await files(version));
      const cfg = (O.config && O.config.api) || {};
      const form = new FormData();
      form.set('action', 'publish');
      form.set('token', Acc.token());
      form.set('title', word + ' Theme');
      form.set('summary', 'Menus, buttons and loading screens in the ' + T.PALETTES[paletteId].label + ' palette');
      form.set('body', 'Built with the Orion theme builder.');
      form.set('versions', JSON.stringify([version]));
      form.set('pack_format', version === '1.12.2' ? '3' : '1');
      form.set('compatible', 'true');
      form.set('report', JSON.stringify({ builder: 'orion-theme', palette: paletteId, seed: seed }));
      form.set('file', new File([bytes], O.Packs.folderName(word + '-theme') + '.zip', { type: 'application/zip' }));
      const res = await fetch(cfg.url + '/functions/v1/orion-mods', { method: 'POST', body: form });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'The store refused it.');
      notice('#pack-result', 'ok', 'Published to the <a href="../mods/">mod store</a>.');
    } catch (e) {
      packError(e.message || String(e));
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
    renderPalettes();
    previewAll();
    if (Acc.available()) await Acc.resume();
    renderWho();
  }

  boot();
})();
