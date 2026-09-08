/* ORION SKIN — wiring: the grid, the preview, the tools */
(function () {
  'use strict';

  const NS = window.ORION_SKIN;
  const E = NS.Editor;
  const $ = (s) => document.querySelector(s);

  const KEY_RECENT = 'orion.skin.recent.v1';
  const KEY_SHEET = 'orion.skin.draft.v1';

  const sheetCanvas = $('#sheet');
  const sctx = sheetCanvas.getContext('2d');
  const preview = $('#preview');
  const pctx = preview.getContext('2d');

  let zoom = 8;
  let tool = 'pencil';
  let colour = '#c98d6b';
  let focusPart = null;
  let recent = [];

  E.init();

  /* ------------------------------------------------------- restore a draft */
  (function restore() {
    try {
      recent = JSON.parse(localStorage.getItem(KEY_RECENT) || '[]');
      if (!Array.isArray(recent)) recent = [];
    } catch (e) { recent = []; }

    let saved = null;
    try { saved = localStorage.getItem(KEY_SHEET); } catch (e) { /* none */ }
    if (!saved) return;
    const img = new Image();
    img.onload = function () {
      E.loadImage(img);
      /* A restored draft is the starting point, not an undo step. */
      drawAll();
    };
    img.src = saved;
  })();

  /* Keep the work across reloads — losing a half-drawn skin to a stray
   * refresh would be the single most annoying thing this could do. */
  let saveTimer = null;
  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY_SHEET, E.toDataURL()); } catch (e) { /* full or blocked */ }
    }, 600);
  }

  /* ============================== the sheet ============================== */

  function sizeSheet() {
    sheetCanvas.width = E.size * zoom;
    sheetCanvas.height = E.size * zoom;
    sheetCanvas.style.width = (E.size * zoom) + 'px';
    sheetCanvas.style.height = (E.size * zoom) + 'px';
    $('#zoom-label').textContent = zoom + '×';
  }

  function drawSheet() {
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(E.canvas(), 0, 0, sheetCanvas.width, sheetCanvas.height);

    if (zoom >= 6) {
      /* Pixel grid, faint enough to draw over. */
      sctx.strokeStyle = 'rgba(255,255,255,0.055)';
      sctx.lineWidth = 1;
      sctx.beginPath();
      for (let i = 1; i < E.size; i++) {
        sctx.moveTo(i * zoom + 0.5, 0); sctx.lineTo(i * zoom + 0.5, sheetCanvas.height);
        sctx.moveTo(0, i * zoom + 0.5); sctx.lineTo(sheetCanvas.width, i * zoom + 0.5);
      }
      sctx.stroke();
    }

    if ($('#guides').checked) {
      NS.rects().forEach(function (r) {
        const dim = focusPart && r.part !== focusPart;
        sctx.strokeStyle = r.overlay
          ? (dim ? 'rgba(111,127,221,0.20)' : 'rgba(111,127,221,0.55)')
          : (dim ? 'rgba(214,201,247,0.16)' : 'rgba(214,201,247,0.42)');
        sctx.lineWidth = 1;
        sctx.strokeRect(r.x * zoom + 0.5, r.y * zoom + 0.5, r.w * zoom - 1, r.h * zoom - 1);
      });
      /* Unused corners of the sheet, so nobody paints into the void. */
      sctx.fillStyle = 'rgba(0,0,0,0.34)';
      for (let y = 0; y < E.size; y++) {
        for (let x = 0; x < E.size; x++) {
          if (!NS.at(x, y)) sctx.fillRect(x * zoom, y * zoom, zoom, zoom);
        }
      }
    }
  }

  function drawPreview() {
    const box = $('#preview-wrap').getBoundingClientRect();
    const w = Math.max(220, Math.floor(box.width - 26));
    const h = 340;
    if (preview.width !== w || preview.height !== h) {
      preview.width = w; preview.height = h;
      preview.style.width = w + 'px'; preview.style.height = h + 'px';
    }
    NS.Preview.draw(pctx, E.canvas(), {
      yaw: yaw, pitch: pitch,
      showOverlays: $('#overlays').checked,
      version: E.version()
    });
  }

  function drawAll() {
    drawSheet();
    drawPreview();
    $('#btn-undo').disabled = !E.canUndo();
    $('#btn-redo').disabled = !E.canRedo();
    saveDraft();
  }

  /* --------------------------------------------------------- interaction */

  const cellFrom = (ev) => {
    const r = sheetCanvas.getBoundingClientRect();
    return {
      x: Math.floor((ev.clientX - r.left) / (r.width / E.size)),
      y: Math.floor((ev.clientY - r.top) / (r.height / E.size))
    };
  };

  /* The sheet pixel that mirrors a given one: the same spot on the opposite
   * limb, or the horizontal mirror within a single face for the head and body.
   * Without this, painting a symmetric character means doing everything twice
   * and getting it slightly wrong. */
  const MIRROR_PART = {
    armR: 'armL', armL: 'armR', legR: 'legL', legL: 'legR',
    sleeveR: 'sleeveL', sleeveL: 'sleeveR', trouserR: 'trouserL', trouserL: 'trouserR'
  };
  const MIRROR_FACE = { left: 'right', right: 'left', front: 'front', back: 'back', top: 'top', bottom: 'bottom' };

  function mirrorOf(x, y) {
    const f = NS.at(x, y);
    if (!f) return null;
    const otherPart = MIRROR_PART[f.part];
    const dx = x - f.x, dy = y - f.y;

    if (otherPart) {
      const p = NS.part(otherPart);
      const dst = p && p.uv[MIRROR_FACE[f.face]];
      if (!dst) return null;
      return { x: dst.x + (dst.w - 1 - dx), y: dst.y + dy };
    }
    /* Head, hat, body, jacket: mirror inside the same face, except the side
     * faces, which mirror to each other. */
    if (f.face === 'left' || f.face === 'right') {
      const p = NS.part(f.part);
      const dst = p.uv[MIRROR_FACE[f.face]];
      return { x: dst.x + (dst.w - 1 - dx), y: dst.y + dy };
    }
    return { x: f.x + (f.w - 1 - dx), y: f.y + dy };
  }

  function apply(x, y) {
    if (x < 0 || y < 0 || x >= E.size || y >= E.size) return;
    const targets = [{ x: x, y: y }];
    if ($('#mirror').checked) {
      const m = mirrorOf(x, y);
      if (m && (m.x !== x || m.y !== y)) targets.push(m);
    }
    targets.forEach(function (t) {
      if (tool === 'pencil') E.set(t.x, t.y, colour);
      else if (tool === 'eraser') E.erase(t.x, t.y);
      else if (tool === 'fill') E.fill(t.x, t.y, colour);
    });
  }

  let painting = false;
  let last = null;

  sheetCanvas.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    const c = cellFrom(ev);
    if (tool === 'pick') {
      const hex = E.hexAt(c.x, c.y);
      if (hex) setColour(hex);
      return;
    }
    E.mark();
    painting = true;
    last = c;
    sheetCanvas.setPointerCapture(ev.pointerId);
    apply(c.x, c.y);
    drawAll();
  });

  sheetCanvas.addEventListener('pointermove', function (ev) {
    const c = cellFrom(ev);
    const f = NS.at(c.x, c.y);
    $('#cursor-hint').textContent = (c.x >= 0 && c.y >= 0 && c.x < E.size && c.y < E.size)
      ? c.x + ', ' + c.y + (f ? '  —  ' + f.label + ' · ' + f.face + (f.overlay ? ' (overlay)' : '') : '  —  not part of the body')
      : '—';

    if (!painting) return;
    /* Join up fast drags, or a quick stroke leaves gaps. */
    if (last && (Math.abs(c.x - last.x) > 1 || Math.abs(c.y - last.y) > 1)) {
      const steps = Math.max(Math.abs(c.x - last.x), Math.abs(c.y - last.y));
      for (let i = 1; i <= steps; i++) {
        apply(Math.round(last.x + (c.x - last.x) * i / steps),
              Math.round(last.y + (c.y - last.y) * i / steps));
      }
    } else {
      apply(c.x, c.y);
    }
    last = c;
    drawAll();
  });

  const stop = function () { painting = false; last = null; };
  sheetCanvas.addEventListener('pointerup', stop);
  sheetCanvas.addEventListener('pointercancel', stop);
  sheetCanvas.addEventListener('pointerleave', function () {
    if (!painting) $('#cursor-hint').textContent = '—';
  });

  /* ------------------------------------------------------------- preview */

  let yaw = -0.6, pitch = 0.18;
  let spinning = true;
  let dragging = false, dragFrom = null;

  preview.addEventListener('pointerdown', function (ev) {
    dragging = true;
    dragFrom = { x: ev.clientX, y: ev.clientY, yaw: yaw, pitch: pitch };
    preview.classList.add('dragging');
    preview.setPointerCapture(ev.pointerId);
    spinning = false;
    $('#spin').textContent = '▶';
  });
  preview.addEventListener('pointermove', function (ev) {
    if (!dragging) return;
    yaw = dragFrom.yaw + (ev.clientX - dragFrom.x) * 0.012;
    pitch = Math.max(-0.7, Math.min(0.7, dragFrom.pitch - (ev.clientY - dragFrom.y) * 0.008));
    drawPreview();
  });
  const endDrag = function () { dragging = false; preview.classList.remove('dragging'); };
  preview.addEventListener('pointerup', endDrag);
  preview.addEventListener('pointercancel', endDrag);

  $('#spin').addEventListener('click', function () {
    spinning = !spinning;
    this.textContent = spinning ? '⏸' : '▶';
  });

  let lastT = 0;
  function frame(t) {
    if (spinning && !dragging) {
      const dt = lastT ? (t - lastT) / 1000 : 0;
      yaw += dt * 0.6;
      drawPreview();
    }
    lastT = t;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* --------------------------------------------------------------- tools */

  document.querySelectorAll('.tool[data-tool]').forEach(function (b) {
    b.addEventListener('click', function () {
      tool = b.dataset.tool;
      document.querySelectorAll('.tool[data-tool]').forEach((o) => o.classList.toggle('on', o === b));
    });
  });

  function setColour(hex) {
    colour = hex;
    $('#colour').value = hex;
    $('#colour-hex').textContent = hex;
    if (recent[0] !== hex) {
      recent = [hex].concat(recent.filter((c) => c !== hex)).slice(0, 14);
      try { localStorage.setItem(KEY_RECENT, JSON.stringify(recent)); } catch (e) { /* ignore */ }
      drawPalette('#recent', recent);
    }
    document.querySelectorAll('#palette button, #recent button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.hex === hex);
    });
  }

  $('#colour').addEventListener('input', function () { setColour(this.value); });

  const BASE_PALETTE = [
    '#ffffff', '#d8d8e0', '#a0a0ad', '#6b6b78', '#3a3a45', '#141419',
    '#f0c9a8', '#c98d6b', '#a06a4c', '#6b4632', '#4b3621', '#2a1d12',
    '#ff6b6b', '#d63b3b', '#ffb347', '#f0e14a', '#7ed957', '#3aa655',
    '#5b6ee1', '#3b4a9e', '#7a5fc4', '#4a2f7a', '#4fc3f7', '#1b6f9c'
  ];

  function drawPalette(sel, list) {
    const el = $(sel);
    if (!list.length) {
      el.innerHTML = '<span class="empty-note">Colours you use will collect here.</span>';
      return;
    }
    el.innerHTML = list.map((c) =>
      '<button data-hex="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="' + c + '"></button>'
    ).join('');
  }

  document.addEventListener('click', function (ev) {
    const b = ev.target.closest('#palette button, #recent button');
    if (b) setColour(b.dataset.hex);
  });

  drawPalette('#palette', BASE_PALETTE);
  drawPalette('#recent', recent);

  /* ---------------------------------------------------------- part jump */

  $('#part-jump').innerHTML =
    '<button data-part="" class="on">Whole sheet</button>' +
    NS.bases().map((p) => '<button data-part="' + p.id + '">' + p.label + '</button>').join('');

  $('#part-jump').addEventListener('click', function (ev) {
    const b = ev.target.closest('button[data-part]');
    if (!b) return;
    focusPart = b.dataset.part || null;
    document.querySelectorAll('#part-jump button').forEach((o) => o.classList.toggle('on', o === b));
    drawSheet();
    if (focusPart) {
      const bounds = NS.bounds(focusPart);
      const wrap = $('#sheet-wrap');
      wrap.scrollTo({
        left: bounds.x * zoom - 20,
        top: bounds.y * zoom - 20,
        behavior: 'smooth'
      });
    }
  });

  /* ------------------------------------------------------------- buttons */

  $('#zoom-in').addEventListener('click', function () {
    zoom = Math.min(16, zoom + 2); sizeSheet(); drawSheet();
  });
  $('#zoom-out').addEventListener('click', function () {
    zoom = Math.max(4, zoom - 2); sizeSheet(); drawSheet();
  });
  $('#guides').addEventListener('change', drawSheet);
  $('#overlays').addEventListener('change', drawPreview);
  $('#btn-undo').addEventListener('click', function () { E.undo(); drawAll(); });
  $('#btn-redo').addEventListener('click', function () { E.redo(); drawAll(); });

  $('#btn-reset').addEventListener('click', function () {
    if (!confirm('Throw away this skin and start from the default body?')) return;
    E.reset();
    drawAll();
  });

  $('#btn-import').addEventListener('click', () => $('#file').click());
  $('#file').addEventListener('change', function () {
    const f = this.files && this.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = function () {
      const res = E.loadImage(img);
      if (!res.ok) { alert(res.error); return; }
      drawAll();
      if (res.legacy) {
        alert('That is an old 64×32 skin. It has been converted to 64×64, and the left arm and leg were mirrored from the right — edit them separately now if you like.');
      }
    };
    img.onerror = () => alert('That file could not be read as an image.');
    img.src = URL.createObjectURL(f);
    this.value = '';
  });

  $('#btn-export').addEventListener('click', function () {
    E.toBlob(function (blob) {
      if (!blob) { alert('The skin could not be encoded.'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'orion-skin.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    });
  });

  addEventListener('keydown', function (ev) {
    if (ev.target.matches('input, textarea')) return;
    const k = ev.key.toLowerCase();
    if ((ev.ctrlKey || ev.metaKey) && k === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) E.redo(); else E.undo();
      drawAll();
      return;
    }
    const pick = { b: 'pencil', e: 'eraser', f: 'fill', i: 'pick' }[k];
    if (pick) {
      const btn = document.querySelector('.tool[data-tool="' + pick + '"]');
      if (btn) btn.click();
    }
  });

  addEventListener('resize', drawPreview);

  sizeSheet();
  setColour(colour);
  drawAll();
})();
