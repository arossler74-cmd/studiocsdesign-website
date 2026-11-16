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

  /* ─── Hero: the opening drifts up and fades as the page leaves it; the header's logo takes
     over from the hero's mark once the mark has scrolled away, and hands back on the way up ─── */
  const hdr = $('#hdr'), hero = $('#top'), heroCopy = $('#heroCopy'), mark = $('.hero-mark'), cue = $('.cue-line');
  let ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY, h = hero.offsetHeight;
      const r = mark.getBoundingClientRect();
      hdr.classList.toggle('has-brand', r.top + r.height * 0.6 < hdr.offsetHeight || y > h * 0.5);
      if (!reduce && y < h * 1.2) {
        const t = clamp(y / (h * 0.75), 0, 1), e = t * t * (3 - 2 * t);
        heroCopy.style.transform = 'translate3d(0,' + (y * -0.18).toFixed(1) + 'px,0) scale(' + (1 - 0.1 * e).toFixed(4) + ')';
        heroCopy.style.opacity = (1 - clamp(y / (h * 0.6), 0, 1)).toFixed(3);
        cue.style.opacity = (1 - clamp(y / (h * 0.2), 0, 1)).toFixed(3);
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ─── Word-by-word headlines + scroll reveals ─── */
  document.querySelectorAll('[data-words], [data-scrub]').forEach(el => {
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
  /* The menu marks the section in view (a quiet underline). */
  const navLinks = [...document.querySelectorAll('.hdr-nav a[href^="#"]')];
  const navTargets = navLinks.map(l => document.querySelector(l.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && navTargets.length) {
    const seen = new Map();
    const navIo = new IntersectionObserver(entries => {
      entries.forEach(e => seen.set(e.target, e.isIntersecting));
      const cur = navTargets.find(t => seen.get(t));
      navLinks.forEach(l => l.classList.toggle('is-current', !!cur && l.getAttribute('href') === '#' + cur.id));
    }, { rootMargin: '-45% 0px -50% 0px' });
    navTargets.forEach(t => navIo.observe(t));
  }

  /* Scroll reveals. Elements inside a [data-group] play together, as one choreographed entrance,
     once a good part of the group is on screen (so a tall photo is not done before it is seen);
     a delay written on the element itself (--d) is kept. */
  const revealEls = document.querySelectorAll('[data-reveal], [data-words]');
  const showAll = () => revealEls.forEach(el => el.classList.add('is-in'));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      let i = 0;
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        if (e.target.hasAttribute('data-reveal') && !e.target.style.getPropertyValue('--d')) e.target.style.setProperty('--d', (Math.min(i++, 4) * 0.1) + 's');
        e.target.classList.add('is-in'); io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });
    const groupIo = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll('[data-reveal], [data-words]').forEach(el => el.classList.add('is-in'));
        groupIo.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    document.querySelectorAll('[data-group]').forEach(g => groupIo.observe(g));
    revealEls.forEach(el => { if (!el.closest('[data-group]')) io.observe(el); });
  } else showAll();
  window.addEventListener('beforeprint', showAll);

  /* ─── Reel: selected interiors ───
     Each slide is a layer. A transition T fades a candidate layer in over a base layer while both
     drift a little in the direction of travel. Progress p is driven by a spring (autoplay, buttons)
     or 1:1 by the finger (drag) — the same value either way, so either can take over mid-flight. */
  /* One entry per photo, in order (assets/img/slides/01...07). title is the room's name, shown small over the photo; text is an
     optional line under it ('' hides it). alt describes the photo for screen readers. */
  const SLIDES = [
    { alt: 'Family room with oak joinery and a low sculptural sofa', title: 'Family Room', text: '' },
    { alt: 'Dining room with linen drapery and cane-back chairs', title: 'Dining Room', text: '' },
    { alt: 'Primary bedroom in warm walnut and cream', title: 'Primary Bedroom', text: '' },
    { alt: 'Covered terrace beside the pool', title: 'Terrace', text: '' },
    { alt: 'Banquette dining nook opening onto the garden', title: 'Breakfast', text: '' },
    { alt: 'Bedroom with grasscloth wall and walnut console', title: 'Primary Bedroom', text: '' },
    { alt: 'Open dining and living room under sculptural brass chandeliers', title: 'Dining & Living Room', text: '' }
  ];
  const N = SLIDES.length, SECS = 3.8;
  const reel = $('#reel'), slidesEl = $('#reelSlides'), fillEl = $('#reelFill');
  const capEl = $('#reelCap'), capTitle = $('#reelTitle'), capText = $('#reelText');
  const layers = SLIDES.map(({ alt }, i) => {
    const n = pad(i + 1), el = document.createElement('div');
    el.className = 'slide'; el.style.backgroundImage = 'url(assets/img/slides/' + n + '-lqip.jpg?v=3)';
    el.setAttribute('role', 'group'); el.setAttribute('aria-roledescription', 'slide'); el.setAttribute('aria-label', (i + 1) + ' of ' + N);
    const img = document.createElement('img');
    img.alt = alt; img.draggable = false; img.decoding = 'async'; img.sizes = '100vw';
    el.appendChild(img); slidesEl.appendChild(el);
    return { i, n, el, img, p: null, kb: null };
  });
  function load(i) {
    const L = layers[i];
    if (!L.p) {
      L.img.srcset = 'assets/img/slides/' + L.n + '-1280.webp?v=3 1280w, assets/img/slides/' + L.n + '-2400.webp?v=3 2400w';
      L.img.src = 'assets/img/slides/' + L.n + '-1280.webp?v=3';
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
  /* the caption leaves fast and the next one rises in after it (exit quicker than enter) */
  let capShown = -1, capAnim = null;
  function setCap(i) {
    capTitle.textContent = SLIDES[i].title || ''; capText.textContent = SLIDES[i].text || '';
    capEl.classList.toggle('is-blank', !SLIDES[i].title && !SLIDES[i].text);
  }
  function caption(i) {
    if (i === capShown) return;
    const first = capShown < 0; capShown = i;
    if (first || reduce || !capEl.animate) { setCap(i); return; }
    capAnim && capAnim.cancel();
    capAnim = capEl.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0,-6px,0)' }], { duration: 160, easing: 'ease-in', fill: 'forwards' });
    capAnim.onfinish = () => {
      setCap(capShown);
      capAnim = capEl.animate([{ opacity: 0, transform: 'translate3d(0,12px,0)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 620, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' });
    };
  }
  function ui(i) { caption(i); fillEl.style.transform = 'scaleX(' + ((i + 1) / N).toFixed(4) + ')'; }
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
    if (reduce || !inView || hovering || drag || document.hidden || reel.dataset.closed) return;
    timer = setTimeout(() => {
      const n = (idx + 1) % N;
      load(n).then(() => {
        if (!inView || hovering || drag || T || document.hidden || reel.dataset.closed) return;
        go(n, 1, 0.85);
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
  window.__reelSchedule = schedule;

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

  /* ─── Process: concept → design, looping ───
     Each pair: its concept arrives (each by its own shape), then the finished design develops out
     of it while the concept stays as a small card. CSS does
     the motion; this only advances the classes. It runs only while on screen and the tab is visible.
     To add a pair, add p<N>-concept|design.webp in assets/process and a line here. */
  const PAIRS = [
    { word: 'Texture', alt: 'Smoke over linen, then a linen lounge chair on curved bronze legs' },
    { word: 'Movement', alt: 'A curving plaster staircase, then a serpentine sofa' },
    { word: 'Timeless', alt: 'Folded silver, then a brushed steel side table' },
    { word: 'Warmth', alt: 'Walnut grain in raking light, then a walnut lounge chair' },
    { word: 'Architectural', alt: 'Branch shadows on stone, then a round stone table' },
    { word: '', v: 2, alt: 'Light through a glass bowl, then a glass-topped table on a sculpted walnut base' },
  ];
  const cdStage = $('#cdStage');
  if (cdStage) {
    const src = (n, k) => 'assets/process/p' + n + '-' + k + '.webp';
    const img = (cls, s, alt) => { const i = new Image(); i.className = cls; i.decoding = 'async'; i.alt = alt || ''; i.dataset.src = s; return i; };
    const pairs = PAIRS.map((p, k) => {
      const n = k + 1, el = document.createElement('div');
      el.className = 'cd-pair'; el.dataset.v = String(p.v != null ? p.v : k % 5);
      const thumb = document.createElement('div'); thumb.className = 'cd-thumb';
      thumb.appendChild(img('', src(n, 'concept')));
      el.append(img('cd-l cd-concept', src(n, 'concept'), p.alt), img('cd-l cd-design', src(n, 'design')), thumb);
      if (p.word) {                                             // the concept's one word, hand-written over it
        const w = document.createElement('span'); w.className = 'cd-word'; w.setAttribute('aria-hidden', 'true');
        w.textContent = p.word; el.appendChild(w);
      }
      cdStage.appendChild(el);
      return el;
    });
    const load = el => Promise.all([...el.querySelectorAll('img')].map(i => {
      if (!i.src) i.src = i.dataset.src;
      return i.decode ? i.decode().catch(() => {}) : Promise.resolve();
    }));
    const T = reduce ? { design: 4000, next: 9000 } : { design: 3400, next: 7600 };
    let cur = -1, timers = [], running = false, visible = false;
    const clear = () => { timers.forEach(clearTimeout); timers = []; };
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    function show(k) {
      const el = pairs[k], prev = pairs[cur];
      load(pairs[(k + 1) % pairs.length]);                       // the next pair loads while this one plays
      load(el).then(() => {
        if (!running) return;
        pairs.forEach(p => { if (p !== el && p !== prev) p.className = 'cd-pair'; });
        if (prev && prev !== el) { prev.classList.remove('is-on'); prev.classList.add('is-out'); }
        el.className = 'cd-pair'; void el.offsetWidth;          // restart its transitions from the start state
        el.classList.add('is-on'); cur = k;
        at(1600, () => { if (prev && prev !== el) prev.className = 'cd-pair'; });
        at(T.design, () => el.classList.add('is-design'));
        at(T.next, () => show((k + 1) % pairs.length));
      });
    }
    function sync() {
      const go = visible && !document.hidden;
      if (go && !running) { running = true; show(cur < 0 ? 0 : (cur + 1) % pairs.length); }
      else if (!go && running) { running = false; clear(); }
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(es => { visible = es[0].isIntersecting; sync(); }, { threshold: 0.25 }).observe(cdStage);
      new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { load(pairs[0]); o.disconnect(); } }, { rootMargin: '120% 0px' }).observe(cdStage);
    } else { visible = true; sync(); }
    document.addEventListener('visibilitychange', sync);
  }

  /* ─── Scroll scenes ───
     Motion tied to the scrollbar, the way apple.com pages move: each scene reads its own progress
     from the scroll position on every frame (no smoothing, so it never lags the finger) and writes
     only transform, opacity and clip-path. Positions are measured once and again on resize.
     Reduced motion: none of this runs; everything sits in its finished state. */
  if (!reduce) {
    const smooth = t => t * t * (3 - 2 * t);
    const root = document.documentElement;
    const scenes = [];
    const topOf = el => { let y = 0; for (let n = el; n; n = n.offsetParent) y += n.offsetTop; return y; };

    // 1. The portrait drifts slowly inside its rounded frame (images only; text never parallaxes)
    const pic = $('.about-photo picture');
    if (pic) scenes.push({ el: $('.about-photo'), run(p) {
      pic.style.transform = 'translate3d(0,' + ((0.5 - p) * 10).toFixed(2) + '%,0) scale(1.12)';
    } });

    // 2. The concept/design card rises a little faster than the words beside it: quiet depth
    // (the individual `translate` property, so it never fights the entrance's transform)
    const cdFig = $('#cd');
    if (cdFig) scenes.push({ el: cdFig, run(p) { cdFig.style.translate = '0 ' + ((0.5 - p) * 70).toFixed(1) + 'px'; } });

    // 3. Projects: the carousel pins, and opens from an inset rounded card to the full screen
    const stage = $('#reelStage'), reelEl = $('#reel'), reelSlides = $('#reelSlides'), reelUi = $('.reel-ui');
    if (stage) {
      stage.classList.add('is-pinned');
      let wasOpen = null;
      scenes.push({ el: stage, raw: true, run(_, y, vh, top) {
        const s0 = top - vh * 0.75, s1 = top + vh * 0.6;          // from 3/4 up the screen to well into the pin
        const e = smooth(clamp((y - s0) / (s1 - s0), 0, 1)), k = 1 - e;
        const side = innerWidth < 720 ? 5 : 11;
        reelEl.style.clipPath = 'inset(' + (k * 12).toFixed(2) + '% ' + (k * side).toFixed(2) + '% ' + (k * 12).toFixed(2) + '% ' + (k * side).toFixed(2) + '% round ' + (k * 24).toFixed(1) + 'px)';
        reelSlides.style.transform = 'scale(' + (1 + 0.16 * k).toFixed(4) + ')';
        const u = clamp((e - 0.7) / 0.3, 0, 1);
        reelUi.style.opacity = u.toFixed(3);
        reelUi.style.transform = 'translate3d(0,' + ((1 - u) * 18).toFixed(1) + 'px,0)';
        reelUi.style.pointerEvents = u > 0.5 ? '' : 'none';
        const open = e > 0.97;
        if (open !== wasOpen) {
          wasOpen = open;
          if (open) { delete reelEl.dataset.closed; window.__reelSchedule && window.__reelSchedule(); }
          else reelEl.dataset.closed = '1';
        }
      } });
    }

    // 4. Contact: the headline lights up word by word as it rises through the screen
    const scrub = $('[data-scrub]');
    if (scrub) {
      const words = [...scrub.querySelectorAll('.w')];
      scenes.push({ el: scrub, raw: true, run(_, y, vh, top) {
        const s0 = top - vh * 0.88, s1 = top - vh * 0.42;
        const p = clamp((y - s0) / (s1 - s0), 0, 1) * (words.length + 1);
        words.forEach((w, i) => { w.style.opacity = (0.14 + 0.86 * clamp(p - i, 0, 1)).toFixed(3); });
      } });
    }

    function measure() {
      root.style.setProperty('--hdr-h', $('#hdr').offsetHeight + 'px');
      scenes.forEach(sc => { sc.top = topOf(sc.el); sc.h = sc.el.offsetHeight; });
      frame();
    }
    let queued = false;
    function frame() {
      queued = false;
      const y = window.scrollY, vh = window.innerHeight;
      scenes.forEach(sc => {
        if (y + vh < sc.top - vh * 0.5 || y > sc.top + sc.h + vh * 0.5) return;   // far off screen: skip
        sc.run(clamp((y + vh - sc.top) / (vh + sc.h), 0, 1), y, vh, sc.top, sc.h);
      });
    }
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(frame); } }, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
    measure();
  }
})();
