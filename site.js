/* Cybelle Sampaio Studio — public site behaviour. Vanilla JS, no dependencies.
   Motion rules (skills/apple-design): springs for anything a hand can touch, animate from the
   on-screen value so every transition can be grabbed mid-flight, hand the finger's velocity to the
   spring on release, and only ever animate transform and opacity. */
(() => {
  'use strict';

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad = n => String(n).padStart(2, '0');

  /* Critically-damped-by-default spring, parameterised the Apple way (damping ratio + response). */
  function spring({ from, to, velocity = 0, response = 0.4, damping = 1, onUpdate, onDone }) {
    const k = Math.pow((2 * Math.PI) / response, 2);
    const c = (4 * Math.PI * damping) / response;
    let x = from, v = velocity, last = performance.now(), raf = 0, live = true;
    const step = now => {
      if (!live) return;
      const dt = Math.min(0.064, (now - last) / 1000); last = now;
      const n = Math.max(1, Math.ceil(dt / 0.004)), h = dt / n;
      for (let i = 0; i < n; i++) { v += (-k * (x - to) - c * v) * h; x += v * h; }
      if (Math.abs(x - to) < 5e-4 && Math.abs(v) < 5e-3) { live = false; onUpdate(to); onDone && onDone(); return; }
      onUpdate(x); raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return { stop() { live = false; cancelAnimationFrame(raf); } };
  }
  /* Where a flick would come to rest (Apple's exponential-decay projection). */
  const project = (v, d = 0.998) => (v / 1000) * d / (1 - d);

  /* ─── Header + hero parallax ─── */
  const hdr = $('#hdr'), hero = $('#top'), heroMedia = $('#heroMedia'), heroCopy = $('#heroCopy');
  let lastY = window.scrollY, ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY, h = hero.offsetHeight;
      hdr.classList.toggle('is-solid', y > h - 90);
      const dy = y - lastY; lastY = y;
      if (y > h && dy > 6 && !hdr.contains(document.activeElement)) hdr.classList.add('is-tucked');
      else if (dy < -6 || y <= h) hdr.classList.remove('is-tucked');
      if (!reduce && y < h * 1.2) {
        heroMedia.style.transform = 'translate3d(0,' + (y * 0.32).toFixed(1) + 'px,0)';
        heroCopy.style.transform = 'translate3d(0,' + (y * 0.12).toFixed(1) + 'px,0)';
        heroCopy.style.opacity = (1 - clamp(y / (h * 0.65), 0, 1)).toFixed(3);
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─── Word-by-word headlines + scroll reveals ─── */
  document.querySelectorAll('[data-words]').forEach(el => {
    let i = 0;
    const walk = node => {
      Array.from(node.childNodes).forEach(ch => {
        if (ch.nodeType === 3) {
          const frag = document.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            const s = document.createElement('span');
            s.className = 'w'; s.style.setProperty('--i', i++); s.textContent = part;
            frag.appendChild(s);
          });
          ch.replaceWith(frag);
        } else if (ch.nodeType === 1) walk(ch);
      });
    };
    walk(el);
  });
  const revealEls = document.querySelectorAll('[data-reveal], [data-words]');
  const showAll = () => revealEls.forEach(el => el.classList.add('is-in'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      let i = 0;
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        if (e.target.hasAttribute('data-reveal')) e.target.style.setProperty('--d', (Math.min(i++, 4) * 0.1) + 's');
        e.target.classList.add('is-in'); io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    revealEls.forEach(el => io.observe(el));
  } else showAll();
  window.addEventListener('beforeprint', showAll);

  /* ─── Reel: selected interiors ───
     Each slide is a layer. A transition T fades a candidate layer in over a base layer while both
     drift a little in the direction of travel. Progress p is driven by a spring (autoplay, buttons)
     or 1:1 by the finger (drag) — the same value either way, so either can take over mid-flight. */
  const SLIDES = [
    'Family room with oak joinery and a low sculptural sofa',
    'Dining room with linen drapery and cane-back chairs',
    'Primary bedroom in warm walnut and cream',
    'Covered terrace beside the pool',
    'Oak media wall with lit display shelving',
    'Banquette dining nook opening onto the garden',
    'Bedroom with grasscloth wall and walnut console',
    'Family room seen from the garden doors',
    'Dining room under timber beams',
    'Breakfast nook with tulips and garden light'
  ];
  const N = SLIDES.length, SECS = 6;
  const reel = $('#reel'), slidesEl = $('#reelSlides'), nowEl = $('#reelNow'), fillEl = $('#reelFill');
  $('#reelAll').textContent = pad(N);
  const layers = SLIDES.map((alt, i) => {
    const n = pad(i + 1), el = document.createElement('div');
    el.className = 'slide'; el.style.backgroundImage = 'url(assets/img/slides/' + n + '-lqip.jpg)';
    el.setAttribute('role', 'group'); el.setAttribute('aria-roledescription', 'slide'); el.setAttribute('aria-label', (i + 1) + ' of ' + N);
    const img = document.createElement('img');
    img.alt = alt; img.draggable = false; img.decoding = 'async'; img.sizes = '100vw';
    el.appendChild(img); slidesEl.appendChild(el);
    return { i, n, el, img, p: null, kb: null };
  });
  function load(i) {
    const L = layers[i];
    if (!L.p) {
      L.img.srcset = 'assets/img/slides/' + L.n + '-1280.webp 1280w, assets/img/slides/' + L.n + '-2400.webp 2400w';
      L.img.src = 'assets/img/slides/' + L.n + '-1280.webp';
      const done = () => L.img.classList.add('is-ready');
      L.p = (L.img.decode ? L.img.decode() : new Promise((res, rej) => { L.img.onload = res; L.img.onerror = rej; })).then(done, done);
    }
    return L.p;
  }
  function kenBurns(L, dir) {
    if (reduce || !L.img.animate) return;
    L.kb && L.kb.cancel();
    L.kb = L.img.animate(
      [{ transform: 'translate3d(' + (dir * 1.2) + '%,0,0) scale(1.08)' }, { transform: 'translate3d(0,0,0) scale(1)' }],
      { duration: (SECS + 2.5) * 1000, easing: 'cubic-bezier(.25,.6,.3,1)', fill: 'forwards' });
  }
  let idx = 0, z = 1, T = null, sp = null, drag = null, timer = 0, inView = false, hovering = false;
  const dirty = new Set();
  layers[0].el.style.opacity = '1'; layers[0].el.style.zIndex = '1';
  function ui(i) { nowEl.textContent = pad(i + 1); fillEl.style.transform = 'scaleX(' + ((i + 1) / N).toFixed(4) + ')'; }
  function setP(p) {
    T.p = p;
    T.cand.el.style.opacity = p.toFixed(4);
    if (reduce) return;
    // Slides overhang the frame by 5% a side, so these drifts never expose an edge.
    T.cand.el.style.transform = 'translate3d(' + (T.dir * (1 - p) * 4).toFixed(3) + '%,0,0)';
    T.base.el.style.transform = 'translate3d(' + (-T.dir * p * 2).toFixed(3) + '%,0,0)';
  }
  function hide(L) { L.el.style.opacity = '0'; L.el.style.transform = ''; L.kb && L.kb.cancel(); L.kb = null; }
  function startT(base, cand, dir, p0) {
    cand.el.style.zIndex = String(++z);
    T = { base, cand, dir, p: p0 };
    dirty.add(base); dirty.add(cand);
    kenBurns(cand, dir); load(cand.i);
    setP(p0);
  }
  function settle() {
    const t = T; T = null; sp = null;
    if (t.p >= 1) {
      idx = t.cand.i;
      dirty.forEach(L => { if (L !== t.cand) hide(L); });
      t.cand.el.style.transform = '';
    } else {
      idx = t.base.i;
      dirty.forEach(L => { if (L !== t.base) hide(L); });
      t.base.el.style.opacity = '1'; t.base.el.style.transform = '';
    }
    dirty.clear(); ui(idx); schedule();
  }
  function animateTo(target, velocity, response) {
    sp && sp.stop();
    sp = spring({ from: T.p, to: target, velocity, response, damping: 1, onUpdate: setP, onDone: settle });
  }
  /* Interrupt-safe: a running transition is frozen where it is and the new one fades in over it. */
  function go(to, dir, response) {
    let base = layers[idx];
    if (T) { sp && sp.stop(); base = T.p >= 0.5 ? T.cand : T.base; if (T.cand !== base && T.p < 0.02) hide(T.cand); T = null; }
    const cand = layers[to];
    if (cand === base) return;
    ui(to); startT(base, cand, dir, 0); animateTo(1, 0, response);
  }
  const logical = () => (T ? T.cand.i : idx);
  function schedule() {
    clearTimeout(timer);
    if (reduce || !inView || hovering || drag || document.hidden) return;
    timer = setTimeout(() => {
      const n = (idx + 1) % N;
      load(n).then(() => {
        if (!inView || hovering || drag || T || document.hidden) return;
        go(n, 1, 1.15);
        load((n + 1) % N);
      });
    }, SECS * 1000);
  }
  $('#reelNext').addEventListener('click', () => { const n = (logical() + 1) % N; load(n); go(n, 1, 0.6); load((n + 1) % N); });
  $('#reelPrev').addEventListener('click', () => { const n = (logical() - 1 + N) % N; load(n); go(n, -1, 0.6); });
  reel.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { hovering = true; clearTimeout(timer); } });
  reel.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { hovering = false; schedule(); } });
  document.addEventListener('visibilitychange', schedule);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => {
      inView = es[0].isIntersecting;
      if (inView) { load(idx); load((idx + 1) % N); load((idx - 1 + N) % N); }
      schedule();
    }, { rootMargin: '50% 0px 0px 0px' }).observe(reel);
  } else { inView = true; load(0); schedule(); }
  load(0);
  ui(0);

  /* Drag: 10px hysteresis, then the crossfade tracks the finger 1:1. Release projects momentum. */
  reel.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, hist: [[e.timeStamp, e.clientX]], active: false, w: Math.max(320, reel.clientWidth * 0.7) };
    clearTimeout(timer);
  });
  reel.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
    if (!drag.active) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; schedule(); return; }
      if (Math.abs(dx) < 10) return;
      drag.active = true;
      try { reel.setPointerCapture(e.pointerId); } catch (_) {}
      reel.classList.add('is-dragging');
      if (T) { sp && sp.stop(); sp = null; drag.base = T.base; drag.s0 = T.dir * T.p; }
      else { drag.base = layers[idx]; drag.s0 = 0; }
      drag.x0 = e.clientX;
    }
    const s = clamp(drag.s0 - (e.clientX - drag.x0) / drag.w, -1, 1);
    const dir = s >= 0 ? 1 : -1, cand = layers[(drag.base.i + dir + N) % N];
    if (!T || T.cand !== cand) {
      if (T && T.cand !== drag.base) hide(T.cand);
      startT(drag.base, cand, dir, Math.abs(s)); ui(cand.i);
    } else setP(Math.abs(s));
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    reel.classList.remove('is-dragging');
    if (!d.active || !T) { schedule(); return; }
    const h = d.hist, a = h[0], b = h[h.length - 1];
    let v = b[0] > a[0] ? (b[1] - a[1]) / ((b[0] - a[0]) / 1000) : 0;
    if (e.timeStamp - b[0] > 90) v = 0;                    // finger came to rest before lifting
    const sProj = T.dir * T.p - project(v) / d.w;
    const commit = Math.sign(sProj) === T.dir && Math.abs(sProj) > 0.5;
    ui(commit ? T.cand.i : T.base.i);
    animateTo(commit ? 1 : 0, (-v / d.w) * T.dir, 0.45);  // hand the release velocity to the spring
  }
  reel.addEventListener('pointerup', endDrag);
  reel.addEventListener('pointercancel', endDrag);
  reel.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') $('#reelNext').click();
    if (e.key === 'ArrowLeft') $('#reelPrev').click();
  });

  /* ─── Process film: inspiration → colour → material → line → form → home ───
     A 36-second timeline drawn straight to the DOM (no framework re-render), only while on screen. */
  const film = $('#film'), stage = $('#filmStage'), textEl = $('#filmText'), tabsEl = $('#filmTabs');
  const L36 = 36;
  const cl = v => Math.max(0, Math.min(1, v));
  const io_ = (t, a, b) => cl((t - a) / (b - a));
  const eo = x => 1 - Math.pow(1 - x, 3);
  const eio = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const win = (t, a, b, fi, fo) => eo(io_(t, a, a + fi)) * (1 - eio(io_(t, b - fo, b)));
  const C = 'assets/concept/';
  /* [file, alt, x, y, w, h, delay, drift, cutout] */
  const PHOTOS = [
    ['dusk', 'A violet sky at dusk over trees', 130, 130, 620, 447, 0.3, 1],
    ['meadow', 'Dried wildflowers in late light', 690, 410, 480, 386, 1.0, -0.6],
    ['fig', 'Ripe figs, one cut open', 1200, 110, 320, 440, 1.7, 0.8],
    ['bouquet', 'A bouquet of dried statice wrapped in paper', 470, 470, 186, 452, 2.6, 0.5, 1]
  ];
  /* Colours picked from the photos above; x/y is where each one is "found". */
  const PALETTE = [['#e3a079', 260, 545], ['#d8b08c', 560, 800], ['#b49ab8', 420, 230], ['#c65a5c', 1330, 330], ['#6a2f43', 1420, 200], ['#8c7652', 900, 640]];
  const SWATCHES = [
    ['oak-joinery', 'Oak joinery', 360, 470, 230, -8], ['white-oak', 'White oak floor', 520, 220, 300, -5],
    ['bronze', 'Brushed bronze', 780, 180, 280, 4], ['linen', 'Linen', 1040, 260, 260, -3],
    ['rattan', 'Rattan cane', 600, 500, 270, 5], ['plaster', 'Limewash plaster', 860, 460, 300, -4],
    ['glazed-brick', 'Glazed brick', 1220, 250, 200, 3], ['walnut', 'Walnut', 1100, 540, 240, 7]
  ];
  const LINES = [
    ['M360 180 H1240 V820 H360 Z', 6, 20.8, 2.2],
    ['M820 180 V450', 4, 22.4, .7], ['M820 590 V820', 4, 22.7, .6], ['M360 520 H700', 4, 22.9, .6],
    ['M820 450 A140 140 0 0 1 960 590', 1.5, 23.3, .7], ['M820 590 H960', 1.5, 23.3, .5],
    ['M480 172 H720 M480 188 H720', 1.6, 23.5, .8], ['M1232 300 V600 M1248 300 V600', 1.6, 23.7, .8],
    ['M900 640 H1170 V730 H900 Z M900 640 V610 H1170 V640', 2, 24.0, 1],
    ['M1030 360 m-80 0 a80 80 0 1 0 160 0 a80 80 0 1 0 -160 0', 2, 24.2, .9],
    ['M420 230 H660 V470 H420 Z M440 250 H530 V300 H440 Z M550 250 H640 V300 H550 Z', 2, 24.4, 1.1],
    ['M360 890 H1240 M360 876 V904 M1240 876 V904', 1, 24.8, .9],
    ['M1310 180 V820 M1296 180 H1324 M1296 820 H1324', 1, 25.0, .9],
    ['M400 600 C460 560 560 590 640 620 C700 640 720 700 680 740 C620 790 470 790 410 740 C370 700 360 640 400 600 Z', 1.2, 25.2, 1.2]
  ];
  const DIMS = [['8.80', 800, 912, 25.4], ['6.40', 1350, 500, 25.6], ['Living', 1035, 520, 25.6], ['Suite', 540, 495, 25.8]];
  const CHAPTERS = [
    [0, 8.4, 'Inspiration', 'It begins with what you love. A ripe fig, a violet dusk, flowers in late light.'],
    [8.4, 14.4, 'Colour', 'The palette is drawn from what we found.'],
    [14.4, 20.6, 'Material', 'Oak, walnut, linen and cane, chosen by hand.'],
    [20.6, 26.6, 'Line', 'Pencil on paper, every wall to scale.'],
    [26.6, 30.2, 'Form', 'The room takes shape, in three dimensions.'],
    [30.2, 36, 'Home', 'And then, it is yours.']
  ];
  /* Where each colour dot comes to rest — the brush stroke starts exactly here. */
  const DOT_END = PALETTE.map((_, i) => [180 + (i % 2) * 20, 200 + i * 110]);
  /* Each stroke leaves its dot and sweeps right with a slight rise and a hand-drawn wobble. */
  const STROKE_PATHS = DOT_END.map(([x, y], i) => {
    const w = i % 2 ? 1 : -1;
    return 'M' + x + ' ' + y + ' C' + (x + 360) + ' ' + (y - 34 + w * 22) + ' ' + (x + 760) + ' ' + (y - 62 - w * 22) + ' ' + (x + 1200) + ' ' + (y - 104);
  });
  /* [delay, width, opacity, offset across the stroke, length] — the bristles stay inside the dot's width. */
  const STROKE_SET = [[0, 72, .85, 0, 1], [.05, 6, .7, -30, .92], [.12, 10, .55, -21, .97], [.02, 5, .5, -12, .88], [.08, 8, .6, 18, .95], [.15, 5, .65, 27, .86], [.1, 9, .45, 32, .9]];
  const SVGNS = 'http://www.w3.org/2000/svg';

  const mk = (tag, cls, css) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; stage.appendChild(e); return e; };
  const pics = [];
  const pic = (box, file, alt) => { const im = document.createElement('img'); im.dataset.src = C + file + '.webp'; im.alt = alt; im.decoding = 'async'; im.draggable = false; box.appendChild(im); pics.push(im); return im; };
  const box = (x, y, w, h) => 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px';

  const light = mk('div', 'f-abs f-light');
  const grid = mk('div', 'f-abs', 'inset:0;background-image:linear-gradient(rgba(59,55,52,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(59,55,52,.09) 1px,transparent 1px);background-size:40px 40px;opacity:0');
  const photoEls = PHOTOS.map(([f, alt, x, y, w, h, , , cut]) => { const e = mk('div', cut ? 'f-photo is-cut' : 'f-photo', box(x, y, w, h) + ';opacity:0'); pic(e, f, alt); return e; });
  const dotEls = PALETTE.map(([c]) => mk('div', 'f-dot', 'left:0;top:0;width:100px;height:100px;background:' + c + ';opacity:0'));
  const strokeSvg = document.createElementNS(SVGNS, 'svg');
  strokeSvg.setAttribute('viewBox', '0 0 1600 1000'); strokeSvg.setAttribute('class', 'f-svg');
  stage.appendChild(strokeSvg);
  const strokeEls = [];
  PALETTE.forEach(([c], i) => STROKE_SET.forEach(([, sw, , dy]) => {
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', STROKE_PATHS[i]); p.setAttribute('pathLength', '1'); p.setAttribute('fill', 'none');
    p.setAttribute('stroke', c); p.setAttribute('stroke-width', sw); p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('transform', 'translate(0 ' + dy + ')'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; p.style.opacity = '0';
    strokeSvg.appendChild(p); strokeEls.push(p);
  }));
  const swatchEls = SWATCHES.map(([f, alt, x, y, sz]) => { const e = mk('div', 'f-swatch', box(x, y, sz, sz) + ';opacity:0'); pic(e, f, alt); return e; });
  const plan = mk('div', 'f-plan', 'left:1270px;top:596px;width:280px;opacity:0'); pic(plan, 'plan', '');
  const model = mk('div', 'f-model', box(280, 112, 1040, 776) + ';opacity:0'); pic(model, 'model', 'A white study model of the family room');
  const lineSvg = document.createElementNS(SVGNS, 'svg');
  lineSvg.setAttribute('viewBox', '0 0 1600 1000'); lineSvg.setAttribute('class', 'f-svg');
  stage.appendChild(lineSvg);
  const lineEls = LINES.map(([d, w]) => {
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', d); p.setAttribute('pathLength', '1'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#3b3734');
    p.setAttribute('stroke-width', w); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; p.style.opacity = '0';
    lineSvg.appendChild(p); return p;
  });
  const dimEls = DIMS.map(([text, x, y]) => {
    const long = text.length > 4;
    const e = mk('span', 'f-dim', 'left:' + x + 'px;top:' + y + 'px;opacity:0;font-size:' + (long ? 22 : 18) + 'px;font-family:' + (long ? "var(--serif);font-style:italic" : 'var(--sans)'));
    e.textContent = text; return e;
  });
  const render = mk('div', 'f-render', 'opacity:0'); pic(render, '../img/slides/01-2400', 'The finished family room');
  const veil = mk('div', 'f-veil');

  const chapEls = CHAPTERS.map(([, , name, line]) => {
    const d = document.createElement('div'); d.className = 'chap'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<h2></h2><p></p>'; d.firstChild.textContent = name; d.lastChild.textContent = line;
    textEl.appendChild(d); return d;
  });
  const tabEls = CHAPTERS.map(([a, , name]) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'film-tab';
    b.setAttribute('role', 'tab'); b.setAttribute('aria-label', name); b.setAttribute('aria-selected', 'false');
    b.innerHTML = '<span><b></b></span>';
    b.addEventListener('click', () => seek(a + 0.01));
    tabsEl.appendChild(b); return b;
  });

  /* Write a style only when it actually changed — keeps per-frame work to what moves. */
  const put = (el, prop, val) => { const c = el.__c || (el.__c = {}); if (c[prop] !== val) { c[prop] = val; el.style[prop] = val; } };
  let ft = 0, chapOn = -1;
  function draw(t) {
    PHOTOS.forEach(([, , , , , , d, dr], i) => {
      const o = win(t, 0.3 + d, 8.6, 1.6, 1.4), rise = (1 - eo(io_(t, 0.3 + d, 2.3 + d))) * 50;
      const drift = (t - d) * dr * 5, sc = 1.06 - 0.06 * eo(io_(t, d, 8));
      put(photoEls[i], 'opacity', o.toFixed(3));
      put(photoEls[i], 'transform', o > 0 ? 'translate3d(' + drift.toFixed(1) + 'px,' + rise.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')' : 'none');
    });
    PALETTE.forEach(([, x, y], i) => {
      const a = 5.0 + i * 0.28, grow = eo(io_(t, a, a + .7));
      const mv = eio(io_(t, 7.4 + i * 0.12, 8.9 + i * 0.12));
      const [tx, ty] = DOT_END[i];
      const cx = x + (tx - x) * mv, cy = y + (ty - y) * mv;
      const o = grow * (1 - io_(t, 9.2 + i * .45, 10 + i * .45)), r = 22 + mv * 14;
      put(dotEls[i], 'opacity', o.toFixed(3));
      put(dotEls[i], 'transform', 'translate3d(' + (cx - 50).toFixed(1) + 'px,' + (cy - 50).toFixed(1) + 'px,0) scale(' + (grow * r / 50).toFixed(4) + ')');
    });
    let k = 0;
    PALETTE.forEach((_, i) => {
      const o = 1 - eio(io_(t, 14.0 + i * .08, 15.2 + i * .08));
      STROKE_SET.forEach(([dl, , op, , len]) => {
        const a = 8.9 + i * 0.45 + dl, p = eio(io_(t, a, a + 1.6)) * len, el = strokeEls[k++];
        put(el, 'strokeDashoffset', (1 - p).toFixed(4));
        put(el, 'opacity', (p > 0 ? o * op : 0).toFixed(3));
      });
    });
    SWATCHES.forEach(([, , , , , rot], i) => {
      const a = 14.6 + i * 0.3, p = eo(io_(t, a, a + 1.2));
      const o = p * (1 - eio(io_(t, 19.8, 21))), spread = eio(io_(t, 19.8, 21)) * 40;
      const el = swatchEls[i];
      put(el, 'opacity', o.toFixed(3));
      put(el, 'transform', o > 0 ? 'translate3d(0,' + ((1 - p) * -60 - spread).toFixed(1) + 'px,0) rotate(' + (rot + (1 - p) * rot * 2).toFixed(2) + 'deg) scale(' + (1.12 - .12 * p).toFixed(3) + ')' : 'none');
      put(el, 'boxShadow', '0 ' + (40 - 22 * p).toFixed(0) + 'px ' + (70 - 30 * p).toFixed(0) + 'px -28px rgba(60,40,20,.45)');
    });
    const lineFade = 1 - eio(io_(t, 28.2, 29.6));
    LINES.forEach(([, , a, dur], i) => {
      const p = eio(io_(t, a, a + dur));
      put(lineEls[i], 'strokeDashoffset', (1 - p).toFixed(4));
      put(lineEls[i], 'opacity', (p > 0 ? lineFade * (t < 26.6 ? 1 : 0.9) : 0).toFixed(3));
    });
    DIMS.forEach(([, , , a], i) => {
      put(dimEls[i], 'opacity', (eo(io_(t, a, a + .8)) * lineFade).toFixed(3));
      put(dimEls[i], 'transform', 'translate(-50%,-50%)');
    });
    const paper = win(t, 20.2, 30.6, 1.2, 1.4);
    put(grid, 'opacity', (paper * .55).toFixed(3));
    put(light, 'opacity', (0.6 + 0.2 * Math.sin(t / 3)).toFixed(3));
    put(light, 'transform', 'translate3d(' + (Math.sin(t / 5) * 30).toFixed(1) + 'px,' + (Math.cos(t / 6) * 18).toFixed(1) + 'px,0)');
    const sk = win(t, 23.6, 28.4, 1.4, 1.2);
    put(plan, 'opacity', (sk * .85).toFixed(3));
    put(plan, 'transform', 'rotate(-3deg) translate3d(0,' + ((1 - sk) * 20).toFixed(1) + 'px,0)');
    const wipe = eio(io_(t, 26.4, 28.6)), mo = 1 - eio(io_(t, 30.4, 31.8));
    put(model, 'opacity', (wipe > 0 ? mo : 0).toFixed(3));
    put(model, 'clipPath', 'inset(0 ' + ((1 - wipe) * 100).toFixed(2) + '% 0 0 round 14px)');
    put(model, 'transform', 'scale(' + (1 + io_(t, 26.4, 31.8) * .04).toFixed(4) + ')');
    const ro = eo(io_(t, 30.0, 32.0));
    put(render, 'opacity', ro.toFixed(3));
    put(render, 'transform', 'scale(' + (1.14 - .14 * eo(io_(t, 30, 36))).toFixed(4) + ')');
    put(veil, 'opacity', Math.max(1 - eo(io_(t, 0, 0.6)), eio(io_(t, 35.1, 36))).toFixed(3));

    let on = CHAPTERS.findIndex(([a, b]) => t >= a && t < b); if (on < 0) on = CHAPTERS.length - 1;
    if (on !== chapOn) {
      chapEls.forEach((c, i) => { c.classList.toggle('is-on', i === on); c.setAttribute('aria-hidden', i === on ? 'false' : 'true'); });
      tabEls.forEach((b, i) => b.setAttribute('aria-selected', i === on ? 'true' : 'false'));
      chapOn = on;
    }
    CHAPTERS.forEach(([a, b], i) => put(tabEls[i].firstChild.firstChild, 'transform', 'scaleX(' + (t >= b ? 1 : io_(t, a, b)).toFixed(4) + ')'));
  }
  function fit() {
    const w = film.clientWidth, h = film.clientHeight;
    stage.style.transform = 'translate(-50%,-50%) scale(' + Math.max(w / 1600, h / 1000).toFixed(4) + ')';
  }
  fit();
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(film); else window.addEventListener('resize', fit);
  draw(0);

  let filmVisible = false, filmReady = false, raf = 0, last = 0, holdTimer = 0, holdK = 0;
  const HOLDS = [5.5, 13.2, 19, 25.8, 29.4, 34];
  function seek(v) { ft = v; last = performance.now(); draw(ft); if (reduce) { holdK = HOLDS.findIndex(h => h >= v); if (holdK < 0) holdK = 0; } }
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    ft = (ft + dt) % L36; draw(ft);
    raf = requestAnimationFrame(frame);
  }
  function runFilm() {
    cancelAnimationFrame(raf); clearInterval(holdTimer);
    if (!filmVisible || !filmReady || document.hidden) return;
    if (reduce) {
      draw(ft = HOLDS[holdK]);
      holdTimer = setInterval(() => { holdK = (holdK + 1) % HOLDS.length; draw(ft = HOLDS[holdK]); }, 5000);
      return;
    }
    last = performance.now(); raf = requestAnimationFrame(frame);
  }
  /* Start the clock only once every image is decoded, so nothing pops in half-drawn. */
  let preloading = false;
  function preloadFilm() {
    if (preloading) return; preloading = true;
    const all = pics.map(im => { im.src = im.dataset.src; return (im.decode ? im.decode() : Promise.resolve()).catch(() => {}); });
    Promise.race([Promise.all(all), new Promise(r => setTimeout(r, 6000))]).then(() => { filmReady = true; runFilm(); });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => { filmVisible = es[0].isIntersecting; runFilm(); }, { threshold: 0.05 }).observe(film);
    new IntersectionObserver(es => { if (es[0].isIntersecting) preloadFilm(); }, { rootMargin: '150% 0px' }).observe(film);
  } else { filmVisible = true; preloadFilm(); }
  document.addEventListener('visibilitychange', runFilm);
})();
