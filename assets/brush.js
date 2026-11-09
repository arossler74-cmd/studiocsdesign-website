/* The palette leaves the mood board: in the process section's first chapter the six colour chips on
   the inspiration board lift off as dots, gather in a column at the stage's left edge and each sweeps
   right as a brush stroke, so the palette is visibly drawn from the pictures. The next chapter's
   photograph then wipes up over the paint. Scroll-driven (it runs back on the way up), page CSS and
   one SVG on the photo-chapters stage, laid between the first photograph and the next. Nothing runs
   with reduced motion or when the moment is at rest. */
const COLOURS = ['#e3a079', '#d8b08c', '#b49ab8', '#c65a5c', '#6a2f43', '#8c7652'];
/* chip centres and radius on each board, in the board's own pixels */
const BOARDS = {
  desk: { w: 2400, h: 1500, r: 44, pts: [1180, 1290, 1400, 1510, 1620, 1730].map(x => [x, 1130]) },
  phone: { w: 720, h: 1043, r: 20, pts: [76, 129, 182, 234, 286, 337].map(x => [x, 640]) },
};
/* [delay, width share of the dot, opacity, offset across the stroke as a share of the dot, length] */
const BRISTLES = [[0, 1, .88, 0, 1], [.05, .08, .7, -.42, .92], [.12, .14, .55, -.29, .97], [.02, .07, .5, -.17, .88],
  [.08, .11, .6, .25, .95], [.15, .07, .65, .38, .86], [.1, .12, .45, .44, .9]];
const NS = 'http://www.w3.org/2000/svg';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const span = (t, a, b) => clamp((t - a) / (b - a));
const out = t => 1 - Math.pow(1 - t, 3);
const inOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const section = document.getElementById('process');
const rq = matchMedia('(prefers-reduced-motion: reduce)');
const pq = matchMedia('(max-width: 639px)');
if (section && !rq.matches) {
  let svg = null, dots = [], strokes = [], geo = null, raf = 0;

  const build = stage => {
    svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'brush');
    svg.setAttribute('aria-hidden', 'true');
    COLOURS.forEach(c => {
      const g = document.createElementNS(NS, 'g');
      strokes.push(BRISTLES.map(() => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('pathLength', '1'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', c);
        p.setAttribute('stroke-linecap', 'round'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '1'; p.style.opacity = '0';
        g.append(p); return p;
      }));
      svg.append(g);
    });
    COLOURS.forEach(c => {
      const d = document.createElementNS(NS, 'circle');
      d.setAttribute('fill', c); d.setAttribute('r', '1'); d.style.opacity = '0';
      svg.append(d); dots.push(d);
    });
    // between the first photograph and the second, so the next chapter wipes up over the paint
    const first = stage.querySelector('.mo-ph__pic');
    first.after(svg);
    layout();
  };

  // the stage's size and where the board's chips land on it (the board fills it as object-fit: cover)
  const layout = () => {
    if (!svg) return;
    const stage = svg.parentElement, w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const b = pq.matches ? BOARDS.phone : BOARDS.desk;
    const s = Math.max(w / b.w, h / b.h), ox = (w - b.w * s) / 2, oy = (h - b.h * s) / 2;
    const r0 = b.r * s * 0.86;                         // the coloured disc inside the chip's white ring
    const from = b.pts.map(([x, y]) => [ox + x * s, oy + y * s]);
    const phone = pq.matches;
    const d = Math.min(phone ? h * 0.04 : h * 0.085, phone ? 22 : 64);   // the stroke's width
    const x0 = phone ? Math.max(28, w * 0.09) : Math.max(56, w * 0.06);
    const top = h * (phone ? 0.07 : 0.1), bottom = h * (phone ? 0.36 : 0.5);
    const to = COLOURS.map((_, i) => [x0 + (i % 2) * d * 0.25, top + (bottom - top) * (i / (COLOURS.length - 1))]);
    const reach = w - x0 - (phone ? 20 : 48);
    to.forEach(([x, y], i) => {
      const wob = i % 2 ? 1 : -1, rise = h * 0.07;
      const path = `M${x} ${y} C${x + reach * .3} ${y - rise * .3 + wob * d * .3} ${x + reach * .63} ${y - rise * .6 - wob * d * .3} ${x + reach} ${y - rise}`;
      strokes[i].forEach((p, j) => {
        const [, sw, , dy] = BRISTLES[j];
        p.setAttribute('d', path);
        p.setAttribute('stroke-width', (sw * d).toFixed(1));
        p.setAttribute('transform', `translate(0 ${(dy * d).toFixed(1)})`);
      });
    });
    geo = { from, to, r0, r1: d / 2 };
    draw();
  };

  // t 0-1: from the stage settling into view to just after the second chapter starts to wipe in
  const progress = () => {
    const r = section.getBoundingClientRect(), vh = innerHeight;
    return clamp((vh * 0.3 - r.top) / (vh * 0.6));
  };

  const draw = () => {
    if (!geo) return;
    const t = progress();
    geo.from.forEach(([fx, fy], i) => {
      const [tx, ty] = geo.to[i];
      const lift = out(span(t, 0.02 + i * 0.025, 0.18 + i * 0.025));          // the dot appears on its chip
      const mv = inOut(span(t, 0.16 + i * 0.03, 0.46 + i * 0.03));            // and travels to the column
      const x = fx + (tx - fx) * mv, y = fy + (ty - fy) * mv - Math.sin(mv * Math.PI) * 24;
      const r = (geo.r0 + (geo.r1 - geo.r0) * mv) * (1 + 0.12 * lift * (1 - mv));
      const sweep = span(t, 0.44 + i * 0.05, 0.86 + i * 0.02);
      const d = dots[i];
      d.setAttribute('cx', x.toFixed(1)); d.setAttribute('cy', y.toFixed(1)); d.setAttribute('r', r.toFixed(1));
      d.style.opacity = (lift * (1 - span(sweep, 0.05, 0.35))).toFixed(3);
      strokes[i].forEach((p, j) => {
        const [dl, , op, , len] = BRISTLES[j];
        const q = inOut(span(sweep, dl, Math.min(1, dl + 0.85))) * len;
        p.style.strokeDashoffset = (1 - q).toFixed(4);
        p.style.opacity = (q > 0 ? op : 0).toFixed(3);
      });
    });
  };

  const tick = () => { raf = 0; draw(); };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };

  const sync = () => {
    const stage = section.querySelector('.mo-ph__stage');
    const live = section.classList.contains('is-live') && stage && !rq.matches;
    if (live && !svg) build(stage);
    else if (!live && svg) { svg.remove(); svg = null; dots = []; strokes = []; geo = null; }
  };
  new MutationObserver(sync).observe(section, { attributes: true, attributeFilter: ['class'] });
  sync();
  addEventListener('scroll', onScroll, { passive: true });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { sync(); layout(); }, 160); });
  rq.addEventListener('change', sync);
}
