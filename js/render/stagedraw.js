/* SMASHFORGE — stage backdrops, parallax layers, platforms and weather. */
(function (SB) {
  'use strict';
  const U = SB.U, D = SB.D;

  const cache = Object.create(null);

  function buildLayers(st) {
    if (cache[st.id]) return cache[st.id];
    const rng = U.rngFor('layers|' + st.id);
    const layers = [];
    const kinds = st.layers;

    for (let L = 0; L < 4; L++) {
      const pts = [];
      const n = 26 + L * 6;
      const amp = (kinds === 'void' ? 90 : 200) * (1 - L * 0.16);
      const baseY = -70 - L * 66;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        let y = baseY;
        if (kinds === 'peaks') y -= Math.pow(Math.abs(Math.sin(u * 9 + L * 2 + rng() * 0.02)), 0.7) * amp * (0.7 + rng() * 0.6);
        else if (kinds === 'forge') y -= (Math.sin(u * 5 + L) * 0.4 + 0.6) * amp * (0.4 + (i % 3) * 0.28);
        else if (kinds === 'void') y -= (rng() < 0.35 ? amp * (0.3 + rng()) : 0);
        else y -= (Math.sin(u * 4.2 + L * 1.7) * 0.5 + 0.5) * amp * (0.55 + rng() * 0.5);
        pts.push([u, y]);
      }
      /* match the seam so the layer can tile without a visible join */
      pts[pts.length - 1][1] = pts[0][1];
      layers.push({ pts: pts, par: 0.10 + L * 0.09, kind: kinds });
    }

    /* floating debris for the void stage / distant structures elsewhere */
    const props = [];
    for (let i = 0; i < 22; i++) {
      props.push({ x: (rng() - 0.5) * 3600, y: -rng() * 780 - 60, s: 18 + rng() * 70, r: rng() * 6.28, par: 0.22 + rng() * 0.4, spin: (rng() - 0.5) * 0.004 });
    }
    const stars = [];
    for (let i = 0; i < 140; i++) stars.push({ x: rng(), y: rng(), s: rng() * 1.7 + 0.4, tw: rng() * 6.28 });

    cache[st.id] = { layers: layers, props: props, stars: stars };
    return cache[st.id];
  }
  SB.stageLayers = buildLayers;

  /* Weather particles live in world space so they scroll with the camera. */
  const weather = [];
  SB.initWeather = function (st) {
    weather.length = 0;
    const w = st.weather, rng = U.rngFor('w|' + st.id);
    for (let i = 0; i < w.n; i++) {
      weather.push({
        x: (rng() - 0.5) * 2800, y: (rng() - 0.5) * 1700 - 200,
        s: 0.6 + rng() * 2.2, ph: rng() * 6.28, sp: 0.5 + rng()
      });
    }
  };

  SB.drawWeather = function (ctx, st, cam, t) {
    const w = st.weather;
    ctx.save();
    ctx.globalCompositeOperation = w.kind === 'ember' || w.kind === 'mote' ? 'lighter' : 'source-over';
    for (const p of weather) {
      p.y += w.spd * p.sp * (w.kind === 'ember' || w.kind === 'mote' ? 1 : 1.6);
      p.x += Math.sin(t * 0.7 + p.ph) * 0.5;
      if (p.y > 900) { p.y = -900; p.x = cam.x + (Math.random() - 0.5) * 2600; }
      if (p.y < -960) { p.y = 880; p.x = cam.x + (Math.random() - 0.5) * 2600; }
      const dx = p.x - cam.x;
      if (Math.abs(dx) > 1900) p.x = cam.x - Math.sign(dx) * 1800;
      ctx.globalAlpha = w.kind === 'snow' ? 0.65 : 0.55 + Math.sin(t * 2 + p.ph) * 0.25;
      ctx.fillStyle = w.col;
      if (w.kind === 'leaf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(t * 1.5 + p.ph);
        ctx.beginPath(); ctx.ellipse(0, 0, p.s * 2.2, p.s * 0.9, 0, 0, U.TAU); ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (w.kind === 'ember' ? 1.1 : 1), 0, U.TAU); ctx.fill();
      }
    }
    ctx.restore();
  };

  /* -------- sky + parallax -------- */
  SB.drawSky = function (ctx, st, cam, t, W, H) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    for (let i = 0; i < st.sky.length; i++) g.addColorStop(i / (st.sky.length - 1), st.sky[i]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const L = buildLayers(st);

    /* stars for dark stages */
    if (st.id === 'nullstead' || st.id === 'frostwatch') {
      ctx.save();
      for (const s of L.stars) {
        ctx.globalAlpha = 0.20 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.tw)) * (st.id === 'nullstead' ? 1 : 0.55);
        ctx.fillStyle = '#ffffff';
        const x = (s.x * W - cam.x * 0.04) % W;
        ctx.fillRect((x + W) % W, s.y * H * 0.62, s.s, s.s);
      }
      ctx.restore();
    }

    /* sun / core glow */
    const sx = st.sun.x * W - cam.x * 0.05, sy = st.sun.y * H - cam.y * 0.05;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, st.sun.r * (1 + Math.sin(t * 0.5) * 0.03));
    sg.addColorStop(0, U.rgba(st.sun.col, 0.95));
    sg.addColorStop(0.28, U.rgba(st.sun.col, 0.42));
    sg.addColorStop(1, U.rgba(st.sun.col, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(sx - st.sun.r * 1.6, sy - st.sun.r * 1.6, st.sun.r * 3.2, st.sun.r * 3.2);

    /* parallax silhouettes */
    ctx.save();
    for (let i = L.layers.length - 1; i >= 0; i--) {
      const ly = L.layers[i];
      const depth = i / (L.layers.length - 1);
      const col = U.mixHex(st.fog, st.rock.b, 0.25 + (1 - depth) * 0.55);
      ctx.fillStyle = U.rgba(col, 0.35 + (1 - depth) * 0.5);
      const ox = -cam.x * ly.par, oy = -cam.y * ly.par * 0.4;
      const span = W * 1.7;
      let base = ox % span;
      if (base > 0) base -= span;
      for (let tile = 0; tile < 3; tile++) {
        const off = base + tile * span;
        if (off > W || off + span < 0) continue;
        ctx.beginPath();
        ctx.moveTo(off, H + 12);
        for (let k = 0; k < ly.pts.length; k++) {
          const p = ly.pts[k];
          ctx.lineTo(off + p[0] * span, H * 0.62 + p[1] + oy);
        }
        ctx.lineTo(off + span, H + 12);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    /* floating props */
    ctx.save();
    for (const p of L.props) {
      const x = W / 2 + (p.x - cam.x * p.par);
      const y = H / 2 + (p.y - cam.y * p.par);
      if (x < -200 || x > W + 200) continue;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(p.r + t * p.spin * 40);
      ctx.globalAlpha = 0.30 + p.par * 0.4;
      ctx.fillStyle = U.mixHex(st.rock.b, st.fog, 0.3);
      ctx.beginPath();
      ctx.moveTo(-p.s, 0); ctx.lineTo(-p.s * 0.4, -p.s * 0.5);
      ctx.lineTo(p.s * 0.7, -p.s * 0.3); ctx.lineTo(p.s, p.s * 0.2);
      ctx.lineTo(0, p.s * 0.55); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    /* atmospheric haze band */
    const hz = ctx.createLinearGradient(0, H * 0.45, 0, H);
    hz.addColorStop(0, U.rgba(st.fog, 0));
    hz.addColorStop(1, U.rgba(st.fog, 0.34));
    ctx.fillStyle = hz;
    ctx.fillRect(0, H * 0.45, W, H * 0.55);
  };

  /* -------- platforms -------- */
  function slab(ctx, st, x, y, w, h, soft, t) {
    const R = st.rock;
    const lift = soft ? 0.16 : 0;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, U.shade(R.c, 0.22 + lift));
    g.addColorStop(0.12, U.shade(R.a, lift));
    g.addColorStop(0.58, U.shade(R.b, lift * 0.5));
    g.addColorStop(1, U.shade(R.b, -0.45));
    ctx.fillStyle = g;
    U.roundRect(ctx, x, y, w, h, soft ? h * 0.42 : Math.min(14, h * 0.16));
    ctx.fill();

    /* top light strip */
    ctx.save();
    U.roundRect(ctx, x, y, w, h, soft ? h * 0.42 : 14);
    ctx.clip();
    ctx.fillStyle = U.rgba(st.ambient, soft ? 0.34 : 0.22);
    ctx.fillRect(x, y, w, Math.max(3, h * (soft ? 0.26 : 0.055)));
    ctx.fillStyle = U.rgba(st.rim, 0.6);
    ctx.fillRect(x, y, w, 2);

    if (!soft) {
      /* rock striations */
      ctx.globalAlpha = 0.16;
      ctx.strokeStyle = U.shade(R.b, -0.5);
      ctx.lineWidth = 2;
      const rng = U.rngFor('rock|' + st.id);
      for (let i = 0; i < 16; i++) {
        const rx = x + rng() * w, ry = y + h * (0.25 + rng() * 0.7);
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + (rng() - 0.5) * 70, ry + rng() * 26);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      /* moss / heat line under the lip */
      ctx.fillStyle = U.rgba(R.moss, 0.30);
      const rng2 = U.rngFor('moss|' + st.id);
      for (let i = 0; i < 16; i++) {
        const rx = x + rng2() * w;
        ctx.beginPath();
        ctx.ellipse(rx, y + 3 + rng2() * 5, 10 + rng2() * 20, 3 + rng2() * 4, 0, 0, U.TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    ctx.strokeStyle = U.rgba('#05070c', 0.5);
    ctx.lineWidth = 1.5;
    U.roundRect(ctx, x, y, w, h, soft ? h * 0.42 : 14);
    ctx.stroke();
  }

  SB.drawStage = function (ctx, st, t) {
    const gr = st.ground, R = st.rock;
    const bodyH = 760;

    /* the cliff hanging below the fighting surface — tapered, dark, hazing out */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(gr.x - 6, gr.y + gr.h * 0.5);
    ctx.lineTo(gr.x + gr.w + 6, gr.y + gr.h * 0.5);
    ctx.lineTo(gr.x + gr.w - 92, gr.y + bodyH * 0.62);
    ctx.lineTo(gr.x + gr.w - 150, gr.y + bodyH);
    ctx.lineTo(gr.x + 150, gr.y + bodyH);
    ctx.lineTo(gr.x + 78, gr.y + bodyH * 0.58);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, gr.y, 0, gr.y + bodyH);
    cg.addColorStop(0, U.shade(R.b, -0.10));
    cg.addColorStop(0.42, U.shade(R.b, -0.42));
    cg.addColorStop(1, U.mixHex(U.shade(R.b, -0.62), st.fog, 0.5));
    ctx.fillStyle = cg;
    ctx.fill();

    /* rock facets so the cliff isn't a flat shape */
    ctx.save();
    ctx.clip();
    const rng = U.rngFor('cliff|' + st.id);
    for (let i = 0; i < 26; i++) {
      const rx = gr.x + rng() * gr.w, ry = gr.y + rng() * bodyH;
      ctx.globalAlpha = 0.10 + rng() * 0.12;
      ctx.fillStyle = rng() < 0.5 ? '#000000' : R.c;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + 30 + rng() * 90, ry + 14 + rng() * 40);
      ctx.lineTo(rx + 8 + rng() * 40, ry + 60 + rng() * 90);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    /* haze swallowing the base of the cliff */
    const fg = ctx.createLinearGradient(0, gr.y + bodyH * 0.30, 0, gr.y + bodyH * 0.92);
    fg.addColorStop(0, U.rgba(st.fog, 0));
    fg.addColorStop(0.72, U.rgba(st.fog, 0.55));
    fg.addColorStop(1, U.rgba(st.fog, 0.92));
    ctx.fillStyle = fg;
    ctx.fillRect(gr.x - 10, gr.y + bodyH * 0.30, gr.w + 20, bodyH * 0.70);
    ctx.restore();
    ctx.restore();

    /* the fighting surface itself */
    slab(ctx, st, gr.x, gr.y, gr.w, gr.h, false, t);

    for (const p of st.plats) {
      /* soft-platform glow so drop-through reads clearly */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.18 + Math.sin(t * 1.6) * 0.04;
      const g2 = ctx.createLinearGradient(0, p.y - 12, 0, p.y + p.h);
      g2.addColorStop(0, U.rgba(st.rim, 0));
      g2.addColorStop(1, U.rgba(st.rim, 0.8));
      ctx.fillStyle = g2;
      ctx.fillRect(p.x - 6, p.y - 12, p.w + 12, p.h + 12);
      ctx.restore();
      slab(ctx, st, p.x, p.y, p.w, p.h, true, t);
    }
  };

  /* Ledge grab points, used by fighters and the AI. */
  SB.ledges = function (st) {
    const g = st.ground;
    return [{ x: g.x, y: g.y, dir: 1 }, { x: g.x + g.w, y: g.y, dir: -1 }];
  };

  /* -------- foreground grade -------- */
  SB.drawGrade = function (ctx, st, W, H, t) {
    /* vignette */
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.34, W / 2, H / 2, Math.max(W, H) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.52)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
    /* warm/cool grade */
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.14;
    const gg = ctx.createLinearGradient(0, 0, 0, H);
    gg.addColorStop(0, st.ambient);
    gg.addColorStop(1, st.fog);
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };
})(window.SB);
