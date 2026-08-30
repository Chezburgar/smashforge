/* SMASHFORGE — the Forge: full character designer.
   Identity, stats, body, 1220 cosmetics, 585 moves, live animated preview. */
(function (SB) {
  'use strict';
  const U = SB.U, el = SB.el, $ = SB.$;

  const TABS = [
    { id: 'identity', name: 'Identity', icon: '◆' },
    { id: 'stats', name: 'Stats', icon: '▮' },
    { id: 'body', name: 'Body', icon: '☗' },
    { id: 'cosmetics', name: 'Cosmetics', icon: '✦' },
    { id: 'moves', name: 'Moveset', icon: '⚔' }
  ];

  const Dz = {
    b: null, tab: 'identity', rig: null,
    cosSlot: 'head', mvSlot: 'nlight',
    cosQuery: '', cosTheme: '', cosRar: '',
    mvQuery: '', mvArch: '', mvStyle: '', mvSort: 'name',
    dirty: false
  };
  SB.Designer = Dz;

  Dz.open = function (build) {
    Dz.b = SB.normalizeBuild(build);
    Dz.tab = 'identity';
    Dz.dirty = false;
    if (!Dz.rig) Dz.rig = new SB.Rig($('dz-prev'));
    Dz.rig.setBuild(Dz.b);
    Dz.rig.autoCycle = false;
    buildNav();
    Dz.render();
  };

  Dz.refreshRig = function (playSlot) {
    if (!Dz.rig) return;
    Dz.rig.setBuild(Dz.b);
    if (playSlot) Dz.rig.play(playSlot);
    Dz.side();
  };

  function buildNav() {
    const n = $('dz-nav');
    n.innerHTML = '';
    TABS.forEach((t, i) => {
      const b = el('div', 'navbtn' + (t.id === Dz.tab ? ' on' : ''),
        '<i>' + t.icon + '</i>' + t.name + '<span class="k">' + (i + 1) + '</span>');
      b.onclick = () => { Dz.tab = t.id; buildNav(); Dz.render(); SB.Audio.play('ui'); };
      n.appendChild(b);
    });
    const spacer = el('div');
    spacer.style.flex = '1';
    n.appendChild(spacer);
    const tip = el('div', 'muted small');
    tip.style.lineHeight = '1.5';
    tip.innerHTML = 'Click any move to preview it live. Everything here is saved to this browser.';
    n.appendChild(tip);
  }

  Dz.render = function () {
    const m = $('dz-main');
    m.innerHTML = '';
    ({ identity: tabIdentity, stats: tabStats, body: tabBody, cosmetics: tabCos, moves: tabMoves })[Dz.tab](m);
    Dz.side();
  };

  /* ============================ IDENTITY ============================ */
  function tabIdentity(m) {
    const b = Dz.b;
    const s1 = sec(m, 'Name');
    const f = el('div', 'field');
    f.appendChild(el('label', '', 'Fighter'));
    const inp = el('input');
    inp.type = 'text'; inp.value = b.name; inp.maxLength = 22;
    inp.oninput = () => { b.name = inp.value || 'Fighter'; Dz.dirty = true; Dz.side(); };
    inp.onfocus = () => { SB.Input.capturing = true; };
    inp.onblur = () => { SB.Input.capturing = false; };
    const g = el('div', 'grow'); g.appendChild(inp);
    f.appendChild(g);
    s1.appendChild(f);

    const s2 = sec(m, 'Weapon — defines the shape of your whole kit');
    const grid = el('div', 'grid');
    grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(232px,1fr))';
    SB.ARCHETYPES.forEach((a) => {
      const c = el('div', 'card' + (a.id === b.archId ? ' sel' : ''));
      c.style.cursor = 'pointer';
      const cv = el('canvas');
      cv.style.height = '92px';
      c.appendChild(cv);
      c.appendChild(el('div', 'cbody',
        '<div class="cname" style="font-size:15px">' + a.name + '</div>' +
        '<div class="cmeta">' + a.kind + '</div>' +
        '<div class="muted small" style="margin-top:5px;line-height:1.3">' + a.blurb + '</div>' +
        '<div class="tagrow">' + statChips(a) + '</div>'));
      c.onclick = () => { setArchetype(a.id); };
      grid.appendChild(c);
      requestAnimationFrame(() => weaponThumb(cv, a, b));
    });
    s2.appendChild(grid);

    const s3 = sec(m, 'Fighting Style — re-tunes every move in the kit');
    const sg = el('div', 'grid');
    sg.style.gridTemplateColumns = 'repeat(auto-fit,minmax(240px,1fr))';
    SB.STYLES.forEach((st) => {
      const c = el('div', 'card' + (st.id === b.styleId ? ' sel' : ''));
      c.appendChild(el('div', 'cbody',
        '<div class="cname">' + st.name + '</div>' +
        '<div class="muted small" style="margin-top:6px;line-height:1.4">' + st.blurb + '</div>' +
        '<div class="tagrow"><span class="tag acc">' + st.trait + '</span></div>'));
      c.onclick = () => { setStyle(st.id); };
      sg.appendChild(c);
    });
    s3.appendChild(sg);
  }

  function statChips(a) {
    const chip = (n, v) => '<span class="tag' + (v > 1.08 ? ' hot' : (v < 0.94 ? '' : ' acc')) + '">' + n + ' ' + (v >= 1 ? '+' : '') + Math.round((v - 1) * 100) + '%</span>';
    return chip('PWR', a.pow) + chip('SPD', a.spd) + chip('REACH', a.reach) + chip('KB', a.kb);
  }

  function weaponThumb(cv, a, b) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth || 200, H = cv.clientHeight || 92;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, H);
    g.addColorStop(0, U.rgba(a.col, 0.22)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W * 0.20, H * 0.72);
    ctx.rotate(-0.62);
    SB.drawWeapon(ctx, a.shape, SB.weaponPalette(a, SB.cos(b.loadout.weapon)), Math.min(W, H) * 1.15, SB.cos(b.loadout.weapon), 0.6, 1);
    ctx.restore();
  }

  function setArchetype(id) {
    const b = Dz.b;
    if (b.archId === id) return;
    const oldKit = SB.kitFor(b.archId, b.styleId);
    b.archId = id;
    const newKit = SB.kitFor(b.archId, b.styleId);
    SB.SLOT_ORDER.forEach((s) => { if (b.moves[s] === oldKit[s].id) b.moves[s] = newKit[s].id; });
    Dz.dirty = true;
    SB.Audio.play('uiBig');
    Dz.refreshRig();
    Dz.render();
  }
  function setStyle(id) {
    const b = Dz.b;
    if (b.styleId === id) return;
    const oldKit = SB.kitFor(b.archId, b.styleId);
    b.styleId = id;
    const newKit = SB.kitFor(b.archId, b.styleId);
    SB.SLOT_ORDER.forEach((s) => { if (b.moves[s] === oldKit[s].id) b.moves[s] = newKit[s].id; });
    Dz.dirty = true;
    SB.Audio.play('uiBig');
    Dz.refreshRig();
    Dz.render();
  }

  /* ============================ STATS ============================ */
  function tabStats(m) {
    const b = Dz.b;
    const s = sec(m, 'Attributes — ' + SB.STAT_BUDGET + ' points to spend, ' + SB.STAT_MIN + '–' + SB.STAT_MAX + ' each');
    const bud = el('div', 'budget');
    s.appendChild(bud);

    const redraw = () => {
      const total = SB.statTotal(b);
      const legal = total <= SB.STAT_BUDGET;
      bud.className = 'budget' + (legal ? '' : ' bad');
      bud.innerHTML = '<span class="muted small">SPENT</span><div class="bar"><i style="width:' +
        Math.min(100, (total / SB.STAT_BUDGET) * 100) + '%"></i></div>' +
        '<span class="mono" style="color:' + (legal ? 'var(--ok)' : '#ff8fa3') + '">' + total + ' / ' + SB.STAT_BUDGET + '</span>';
      rows.forEach((r) => r.upd());
      Dz.side();
    };

    const rows = SB.STAT_INFO.map((info) => {
      const line = el('div', 'statline');
      const nm = el('div', 'nm', info.name);
      const pips = el('div', 'pips');
      const val = el('div', 'val');
      const btns = el('div', 'row');
      btns.style.gap = '4px';
      const minus = el('button', 'btn xs', '−');
      const plus = el('button', 'btn xs', '+');
      btns.appendChild(minus); btns.appendChild(plus);

      for (let i = 0; i < SB.STAT_MAX; i++) pips.appendChild(el('div', 'pip'));

      minus.onclick = () => {
        if (b.stats[info.id] > SB.STAT_MIN) { b.stats[info.id]--; Dz.dirty = true; SB.Audio.play('ui'); redraw(); Dz.refreshRig(); }
      };
      plus.onclick = () => {
        if (b.stats[info.id] >= SB.STAT_MAX) return;
        if (SB.statTotal(b) >= SB.STAT_BUDGET) { SB.toast('No points left — lower another attribute first'); return; }
        b.stats[info.id]++; Dz.dirty = true; SB.Audio.play('ui'); redraw(); Dz.refreshRig();
      };

      line.appendChild(nm); line.appendChild(pips); line.appendChild(val); line.appendChild(btns);
      s.appendChild(line);
      const blurb = el('div', 'muted small');
      blurb.style.margin = '-4px 0 12px 118px';
      blurb.textContent = info.blurb;
      s.appendChild(blurb);

      return {
        upd() {
          const v = b.stats[info.id];
          val.textContent = v;
          [...pips.children].forEach((p, i) => {
            p.className = 'pip' + (i < v ? ' on' : '');
          });
        }
      };
    });
    redraw();

    const s2 = sec(m, 'Resulting Numbers');
    const d = SB.derive(b);
    const grid = el('div', 'grid');
    grid.style.gridTemplateColumns = 'repeat(auto-fit,minmax(210px,1fr))';
    [
      ['Max Health', Math.round(d.maxHP)],
      ['Weight', d.weight.toFixed(2) + '×'],
      ['Run Speed', d.runSpeed.toFixed(2)],
      ['Jump Height', Math.round(-d.jumpV * 10) / 10],
      ['Air Control', d.airMax.toFixed(2)],
      ['Damage Output', Math.round(d.dmgMul * 100) + '%'],
      ['Attack Speed', Math.round(d.atkSpeed * 100) + '%'],
      ['Knockback Taken', Math.round(d.kbTaken * 100) + '%'],
      ['Shield', Math.round(d.shieldMax)]
    ].forEach(([k, v]) => {
      const p = el('div', 'panel pad');
      p.style.padding = '11px 14px';
      p.innerHTML = '<div class="muted small" style="letter-spacing:.14em;text-transform:uppercase">' + k + '</div>' +
        '<div style="font-size:23px;font-weight:800;color:var(--acc);font-family:var(--mono)">' + v + '</div>';
      grid.appendChild(p);
    });
    s2.appendChild(grid);
  }

  /* ============================ BODY ============================ */
  function tabBody(m) {
    const b = Dz.b;
    const s = sec(m, 'Frame');
    slider(s, 'Height', b.body.height, (v) => { b.body.height = v; Dz.dirty = true; Dz.refreshRig(); },
      (v) => Math.round(74 + v * 26) + 'px');
    slider(s, 'Build', b.body.build, (v) => { b.body.build = v; Dz.dirty = true; Dz.refreshRig(); },
      (v) => (v < 0.33 ? 'Lean' : v < 0.66 ? 'Athletic' : 'Heavy'));

    const s2 = sec(m, 'Skin');
    const sw = el('div', 'swatches');
    SB.SKIN_TONES.forEach((c) => {
      const d = el('div', 'sw' + (c === b.body.skin ? ' on' : ''));
      d.style.background = c;
      d.onclick = () => { b.body.skin = c; Dz.dirty = true; Dz.refreshRig(); Dz.render(); };
      sw.appendChild(d);
    });
    s2.appendChild(sw);

    const s3 = sec(m, 'Hair');
    const hf = el('div', 'field');
    hf.appendChild(el('label', '', 'Style'));
    const sel = el('select');
    SB.HAIR_STYLES.forEach((h, i) => {
      const o = el('option', '', h); o.value = i;
      if (i === b.body.hairStyle) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { b.body.hairStyle = +sel.value; Dz.dirty = true; Dz.refreshRig(); };
    const hg = el('div', 'grow'); hg.appendChild(sel);
    hf.appendChild(hg);
    s3.appendChild(hf);
    const hsw = el('div', 'swatches');
    SB.HAIR_COLORS.forEach((c) => {
      const d = el('div', 'sw' + (c === b.body.hairColor ? ' on' : ''));
      d.style.background = c;
      d.onclick = () => { b.body.hairColor = c; Dz.dirty = true; Dz.refreshRig(); Dz.render(); };
      hsw.appendChild(d);
    });
    s3.appendChild(hsw);

    const s4 = sec(m, 'Colourway');
    const cg = el('div', 'grid');
    cg.style.gridTemplateColumns = 'repeat(auto-fill,minmax(150px,1fr))';
    SB.COLORWAYS.forEach((cw) => {
      const on = cw.primary === b.col.primary && cw.secondary === b.col.secondary;
      const c = el('div', 'card' + (on ? ' sel' : ''));
      c.innerHTML = '<div style="height:44px;display:flex">' +
        '<div style="flex:2;background:' + cw.primary + '"></div>' +
        '<div style="flex:1;background:' + cw.secondary + '"></div>' +
        '<div style="flex:1;background:' + cw.accent + '"></div>' +
        '<div style="flex:1;background:' + cw.glow + '"></div></div>' +
        '<div class="cbody" style="padding:7px 10px"><div class="cname" style="font-size:13.5px">' + cw.name + '</div></div>';
      c.onclick = () => {
        b.col = { primary: cw.primary, secondary: cw.secondary, accent: cw.accent, glow: cw.glow };
        Dz.dirty = true; Dz.refreshRig(); Dz.render();
      };
      cg.appendChild(c);
    });
    s4.appendChild(cg);

    const s5 = sec(m, 'Custom Colours');
    ['primary', 'secondary', 'accent', 'glow'].forEach((k) => {
      const f = el('div', 'field');
      f.appendChild(el('label', '', k));
      const inp = document.createElement('input');
      inp.type = 'color'; inp.value = b.col[k];
      inp.style.cssText = 'width:56px;height:34px;border:1px solid var(--line2);border-radius:8px;background:transparent;cursor:pointer;padding:2px';
      inp.oninput = () => { b.col[k] = inp.value; Dz.dirty = true; Dz.refreshRig(); };
      const g = el('div', 'grow'); g.appendChild(inp);
      f.appendChild(g);
      s5.appendChild(f);
    });
  }

  function slider(parent, label, val, fn, fmt) {
    const f = el('div', 'field');
    f.appendChild(el('label', '', label));
    const g = el('div', 'grow');
    const r = el('input');
    r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.02; r.value = val;
    const out = el('span', 'mono', fmt ? fmt(val) : val);
    out.style.minWidth = '68px';
    r.oninput = () => { const v = parseFloat(r.value); fn(v); out.textContent = fmt ? fmt(v) : v; };
    g.appendChild(r); g.appendChild(out);
    f.appendChild(g);
    parent.appendChild(f);
  }

  /* ============================ COSMETICS ============================ */
  function tabCos(m) {
    const b = Dz.b;
    const s = sec(m, 'Cosmetics — ' + SB.COS_COUNT.toLocaleString() + ' items across ' + SB.COS_SLOTS.length + ' slots');
    const br = el('div', 'browser');

    const left = el('div', 'slotlist');
    SB.COS_SLOTS.forEach((sl) => {
      const cur = SB.cos(b.loadout[sl.id]);
      const btn = el('div', 'slotbtn' + (sl.id === Dz.cosSlot ? ' on' : ''),
        sl.name + '<em>' + (cur && !cur.none ? cur.shapeName : '—') + '</em>');
      btn.onclick = () => { Dz.cosSlot = sl.id; Dz.cosQuery = ''; Dz.render(); SB.Audio.play('ui'); };
      left.appendChild(btn);
    });
    br.appendChild(left);

    const right = el('div');
    const filters = el('div', 'filters');
    const q = el('input'); q.type = 'text'; q.placeholder = 'Search…'; q.value = Dz.cosQuery;
    q.oninput = () => { Dz.cosQuery = q.value; fill(); };
    q.onfocus = () => { SB.Input.capturing = true; };
    q.onblur = () => { SB.Input.capturing = false; };
    filters.appendChild(q);

    const th = el('select');
    th.appendChild(optEl('', 'All themes'));
    SB.COS_THEMES.forEach((t) => th.appendChild(optEl(t.id, t.name)));
    th.value = Dz.cosTheme;
    th.onchange = () => { Dz.cosTheme = th.value; fill(); };
    filters.appendChild(th);

    const rr = el('select');
    rr.appendChild(optEl('', 'All rarities'));
    SB.COS_RARITY.forEach((t, i) => rr.appendChild(optEl(String(i), t.name)));
    rr.value = Dz.cosRar;
    rr.onchange = () => { Dz.cosRar = rr.value; fill(); };
    filters.appendChild(rr);

    const rnd = el('button', 'btn sm', 'Randomize slot');
    rnd.onclick = () => {
      const list = SB.cosBySlot(Dz.cosSlot);
      b.loadout[Dz.cosSlot] = list[1 + Math.floor(Math.random() * (list.length - 1))].id;
      Dz.dirty = true; Dz.refreshRig(); Dz.render();
    };
    filters.appendChild(rnd);

    const rndAll = el('button', 'btn sm', 'Randomize all');
    rndAll.onclick = () => { b.loadout = SB.randomLoadout(Math.random, false); Dz.dirty = true; Dz.refreshRig(); Dz.render(); };
    filters.appendChild(rndAll);

    const clr = el('button', 'btn sm ghost', 'Clear all');
    clr.onclick = () => { b.loadout = SB.emptyLoadout(); Dz.dirty = true; Dz.refreshRig(); Dz.render(); };
    filters.appendChild(clr);

    right.appendChild(filters);
    const count = el('div', 'muted small');
    count.style.marginBottom = '8px';
    right.appendChild(count);
    const items = el('div', 'items');
    right.appendChild(items);
    br.appendChild(right);
    s.appendChild(br);

    function fill() {
      items.innerHTML = '';
      const qq = Dz.cosQuery.trim().toLowerCase();
      const list = SB.cosBySlot(Dz.cosSlot).filter((it) => {
        if (it.none) return !qq;
        if (Dz.cosTheme && it.theme !== Dz.cosTheme) return false;
        if (Dz.cosRar !== '' && it.rarity !== +Dz.cosRar) return false;
        if (qq && it.name.toLowerCase().indexOf(qq) < 0 && it.shapeName.toLowerCase().indexOf(qq) < 0) return false;
        return true;
      });
      count.textContent = list.length + ' item' + (list.length === 1 ? '' : 's');
      list.forEach((it) => {
        const d = el('div', 'item' + (b.loadout[Dz.cosSlot] === it.id ? ' on' : ''));
        const cv = el('canvas');
        d.appendChild(cv);
        d.appendChild(el('div', 'inm', it.none ? 'None' : it.name));
        if (!it.none) {
          const r = el('div', 'irar', it.rarityName);
          r.style.color = it.rarityCol;
          d.appendChild(r);
        }
        d.onclick = () => {
          b.loadout[Dz.cosSlot] = it.id;
          Dz.dirty = true;
          SB.Audio.play('ui');
          Dz.refreshRig();
          Dz.render();
        };
        items.appendChild(d);
        requestAnimationFrame(() => { try { SB.drawCosThumb(cv, it); } catch (e) { } });
      });
    }
    fill();
  }

  function optEl(v, t) { const o = el('option', '', t); o.value = v; return o; }

  /* ============================ MOVES ============================ */
  function tabMoves(m) {
    const b = Dz.b;
    const s = sec(m, 'Moveset — pick any of the ' + SB.MOVES.length + ' moves for any of the ' + SB.SLOT_ORDER.length + ' slots');
    const br = el('div', 'browser');

    const left = el('div', 'slotlist');
    SB.SLOT_ORDER.forEach((slot) => {
      const mv = SB.MOVE(b.moves[slot]);
      const btn = el('div', 'slotbtn' + (slot === Dz.mvSlot ? ' on' : ''),
        SB.SLOT_BASE[slot].name + '<em>' + (mv ? mv.name : '—') + '</em>');
      btn.onclick = () => { Dz.mvSlot = slot; Dz.render(); if (mv) Dz.rig.play(mv); SB.Audio.play('ui'); };
      left.appendChild(btn);
    });
    br.appendChild(left);

    const right = el('div');
    const filters = el('div', 'filters');
    const q = el('input'); q.type = 'text'; q.placeholder = 'Search moves…'; q.value = Dz.mvQuery;
    q.oninput = () => { Dz.mvQuery = q.value; fill(); };
    q.onfocus = () => { SB.Input.capturing = true; };
    q.onblur = () => { SB.Input.capturing = false; };
    filters.appendChild(q);

    const ar = el('select');
    ar.appendChild(optEl('', 'All weapons'));
    SB.ARCHETYPES.forEach((a) => ar.appendChild(optEl(a.id, a.name + ' · ' + a.kind)));
    ar.value = Dz.mvArch;
    ar.onchange = () => { Dz.mvArch = ar.value; fill(); };
    filters.appendChild(ar);

    const st = el('select');
    st.appendChild(optEl('', 'All styles'));
    SB.STYLES.forEach((x) => st.appendChild(optEl(x.id, x.name)));
    st.value = Dz.mvStyle;
    st.onchange = () => { Dz.mvStyle = st.value; fill(); };
    filters.appendChild(st);

    const so = el('select');
    [['name', 'Sort: Name'], ['dmg', 'Sort: Damage'], ['fast', 'Sort: Startup'], ['kb', 'Sort: Knockback'], ['range', 'Sort: Range']]
      .forEach(([v, t]) => so.appendChild(optEl(v, t)));
    so.value = Dz.mvSort;
    so.onchange = () => { Dz.mvSort = so.value; fill(); };
    filters.appendChild(so);

    const nat = el('button', 'btn sm', 'Native move');
    nat.onclick = () => {
      const kit = SB.kitFor(b.archId, b.styleId);
      b.moves[Dz.mvSlot] = kit[Dz.mvSlot].id;
      Dz.dirty = true; Dz.refreshRig(); Dz.render(); Dz.rig.play(kit[Dz.mvSlot]);
    };
    filters.appendChild(nat);
    right.appendChild(filters);

    const count = el('div', 'muted small');
    count.style.marginBottom = '8px';
    right.appendChild(count);
    const list = el('div', 'mvlist');
    right.appendChild(list);
    br.appendChild(right);
    s.appendChild(br);

    function fill() {
      list.innerHTML = '';
      const qq = Dz.mvQuery.trim().toLowerCase();
      let pool = SB.movesForSlot(Dz.mvSlot).filter((mv) => {
        if (Dz.mvArch && mv.arch !== Dz.mvArch) return false;
        if (Dz.mvStyle && mv.style !== Dz.mvStyle) return false;
        if (qq && mv.name.toLowerCase().indexOf(qq) < 0 && mv.archName.toLowerCase().indexOf(qq) < 0 &&
          mv.tags.join(' ').toLowerCase().indexOf(qq) < 0) return false;
        return true;
      });
      const cmp = {
        name: (a, c) => a.name.localeCompare(c.name),
        dmg: (a, c) => c.dmg * c.hits - a.dmg * a.hits,
        fast: (a, c) => a.startup - c.startup,
        kb: (a, c) => (c.bkb + c.kbs * 40) - (a.bkb + a.kbs * 40),
        range: (a, c) => SB.moveRange(c) - SB.moveRange(a)
      }[Dz.mvSort];
      pool = pool.slice().sort(cmp);
      count.textContent = pool.length + ' move' + (pool.length === 1 ? '' : 's') + ' for this slot';

      pool.forEach((mv) => {
        const row = el('div', 'mv' + (b.moves[Dz.mvSlot] === mv.id ? ' on' : ''));
        const isNative = SB.kitFor(b.archId, b.styleId)[Dz.mvSlot].id === mv.id;
        const info = el('div');
        info.innerHTML =
          '<div class="mvn">' + mv.name + (isNative ? ' <span class="tag acc" style="vertical-align:2px">NATIVE</span>' : '') + '</div>' +
          '<div class="mvs">' + mv.styleName + ' ' + mv.archKind + '</div>' +
          '<div class="tagrow">' + mv.tags.slice(0, 4).map((t) => '<span class="tag">' + t + '</span>').join('') + '</div>';
        const fd = el('div');
        fd.innerHTML =
          '<div class="fd"><span>DMG <b>' + (mv.hits > 1 ? (mv.dmg + '×' + mv.hits) : mv.dmg) + '</b></span></div>' +
          '<div class="fd"><span>' + mv.startup + '<b>/</b>' + mv.active + '<b>/</b>' + mv.recovery + '</span></div>' +
          '<div class="fd"><span>KB <b>' + Math.round(mv.bkb) + '</b></span></div>';
        fd.style.textAlign = 'right';
        row.appendChild(info); row.appendChild(fd);
        row.onclick = () => {
          b.moves[Dz.mvSlot] = mv.id;
          Dz.dirty = true;
          SB.Audio.play('ui');
          Dz.refreshRig();
          Dz.render();
          Dz.rig.play(mv);
        };
        row.onmouseenter = () => { if (Dz.rig && !Dz.rig.f.move) Dz.rig.play(mv); };
        list.appendChild(row);
      });
    }
    fill();
  }

  /* ============================ SIDE PANEL ============================ */
  Dz.side = function () {
    const b = Dz.b;
    if (!b) return;
    const info = $('dz-info');
    const d = SB.derive(b);
    const arch = SB.archetype(b.archId);
    const style = SB.STYLES.find((s) => s.id === b.styleId) || SB.STYLES[0];
    const pwr = SB.powerRating(b);
    const legal = SB.statsLegal(b);

    info.innerHTML = '';
    const head = el('div');
    head.innerHTML = '<div style="font-size:21px;font-weight:800;letter-spacing:.03em">' + SB.escapeHtml(b.name) + '</div>' +
      '<div class="muted small" style="letter-spacing:.12em;text-transform:uppercase;margin-top:2px">' + style.name + ' ' + arch.kind + '</div>';
    info.appendChild(head);

    const rating = el('div', 'rating');
    const dial = el('div', 'dial');
    const cv = el('canvas'); cv.width = 132; cv.height = 132;
    dial.appendChild(cv);
    dial.appendChild(el('b', '', pwr + ''));
    rating.appendChild(dial);
    rating.appendChild(el('div', '',
      '<div class="muted small" style="letter-spacing:.14em;text-transform:uppercase">Power Rating</div>' +
      '<div class="small" style="color:' + ratingCol(pwr) + ';font-weight:700">' + ratingWord(pwr) + '</div>' +
      '<div class="dim small" style="margin-top:3px">50 is tournament-neutral.</div>'));
    info.appendChild(rating);
    drawDial(cv, pwr);

    if (!legal) {
      const warn = el('div', 'panel pad');
      warn.style.cssText = 'border-color:#d05a78;background:rgba(125,39,64,.25);padding:10px 12px;margin-bottom:12px';
      warn.innerHTML = '<div class="small" style="color:#ffb3c4">Over budget by ' + (SB.statTotal(b) - SB.STAT_BUDGET) +
        ' point(s). Lower an attribute before saving.</div>';
      info.appendChild(warn);
    }

    const tags = el('div', 'tagrow');
    tags.innerHTML = SB.buildTags(b).map((t) => '<span class="tag acc">' + t + '</span>').join('');
    tags.style.margin = '4px 0 12px';
    info.appendChild(tags);

    const kv = el('div');
    [['Health', Math.round(d.maxHP)], ['Weight', d.weight.toFixed(2)], ['Run', d.runSpeed.toFixed(1)],
    ['Jump', (-d.jumpV).toFixed(1)], ['Damage', Math.round(d.dmgMul * 100) + '%'],
    ['Atk Speed', Math.round(d.atkSpeed * 100) + '%'], ['KB Taken', Math.round(d.kbTaken * 100) + '%']]
      .forEach(([k, v]) => {
        const r = el('div', 'kv');
        r.innerHTML = '<span>' + k + '</span><span>' + v + '</span>';
        kv.appendChild(r);
      });
    info.appendChild(kv);

    const t2 = el('div', 'muted small');
    t2.style.cssText = 'letter-spacing:.14em;text-transform:uppercase;margin:14px 0 6px';
    t2.textContent = 'Preview a move';
    info.appendChild(t2);
    const pick = el('div', 'movepick');
    SB.SLOT_ORDER.forEach((slot) => {
      const mv = SB.MOVE(b.moves[slot]);
      const btn = el('button', 'btn xs', SB.SLOT_BASE[slot].name.replace(' Signature', ' Sig').replace('Neutral ', 'N').replace('Side ', 'S').replace('Down ', 'D'));
      btn.title = mv ? mv.name : '';
      btn.onclick = () => { Dz.rig.play(mv || slot); };
      pick.appendChild(btn);
    });
    info.appendChild(pick);

    const cur = SB.MOVE(b.moves[Dz.mvSlot]);
    if (cur) {
      const p = el('div', 'panel pad');
      p.style.cssText = 'margin-top:14px;padding:11px 13px';
      p.innerHTML = '<div style="font-weight:800;font-size:15px">' + cur.name + '</div>' +
        '<div class="muted small" style="margin:3px 0 7px">' + cur.slotName + ' · ' + cur.styleName + ' ' + cur.archKind + '</div>' +
        '<div class="small" style="line-height:1.45;color:var(--txt2)">' + cur.desc + '</div>' +
        '<div class="fd" style="margin-top:8px;gap:12px"><span>START <b>' + cur.startup + '</b></span>' +
        '<span>ACTIVE <b>' + cur.active + '</b></span><span>REC <b>' + cur.recovery + '</b></span></div>';
      info.appendChild(p);
    }
  };

  function ratingWord(p) {
    return p < 34 ? 'Underpowered' : p < 46 ? 'Modest' : p < 58 ? 'Balanced' : p < 70 ? 'Strong' : p < 82 ? 'Fearsome' : 'Overtuned';
  }
  function ratingCol(p) {
    return p < 34 ? '#7fb3ff' : p < 58 ? '#6ee7a0' : p < 74 ? '#ffd24a' : '#ff6b7a';
  }
  function drawDial(cv, pwr) {
    const ctx = cv.getContext('2d');
    const S = 132, cx = S / 2, cy = S / 2, r = 50;
    ctx.clearRect(0, 0, S, S);
    ctx.lineWidth = 11; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
    const a1 = Math.PI * 0.75 + Math.PI * 1.5 * U.sat(pwr / 100);
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#4fc3f7'); g.addColorStop(0.55, '#6ee7a0'); g.addColorStop(1, '#ff6b7a');
    ctx.strokeStyle = g;
    ctx.shadowColor = ratingCol(pwr); ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI * 0.75, a1); ctx.stroke();
  }

  function sec(parent, title) {
    const s = el('div', 'sec');
    s.appendChild(el('h3', '', title));
    parent.appendChild(s);
    return s;
  }

  /* ============================ actions ============================ */
  Dz.wire = function () {
    $('dz-save').onclick = () => {
      const b = Dz.b;
      if (!SB.statsLegal(b)) { SB.toast('Attributes are over budget'); return; }
      const G = SB.G;
      if (G.editingIndex >= 0 && G.roster[G.editingIndex]) G.roster[G.editingIndex] = SB.normalizeBuild(b);
      else { G.roster.push(SB.normalizeBuild(b)); G.selected = G.roster.length - 1; }
      SB.saveRoster(G.roster);
      SB.Audio.play('uiBig');
      SB.toast('Saved ' + b.name);
      Dz.dirty = false;
      SB.UI.back();
    };
    $('dz-cancel').onclick = () => {
      if (Dz.dirty && !confirm('Discard unsaved changes?')) return;
      SB.UI.back();
    };
    $('dz-randomize').onclick = () => {
      const name = Dz.b.name;
      Dz.b = SB.randomBuild();
      Dz.b.name = name === 'New Fighter' ? Dz.b.name : name;
      Dz.dirty = true;
      Dz.refreshRig();
      Dz.render();
      SB.Audio.play('uiBig');
    };
    $('dz-reset-kit').onclick = () => {
      const kit = SB.kitFor(Dz.b.archId, Dz.b.styleId);
      SB.SLOT_ORDER.forEach((s) => { Dz.b.moves[s] = kit[s].id; });
      Dz.dirty = true;
      Dz.refreshRig();
      Dz.render();
      SB.toast('Kit reset to native moves');
    };

    window.addEventListener('keydown', (e) => {
      if (SB.UI.cur !== 'sc-designer' || SB.Input.capturing) return;
      const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
      if (i >= 0) { Dz.tab = TABS[i].id; buildNav(); Dz.render(); }
    });
  };

  Dz.step = function () {
    if (!Dz.rig) return;
    Dz.rig.step();
    Dz.rig.draw();
  };
})(window.SB);
