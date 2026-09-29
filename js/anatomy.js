/* ============================================================
   MACH 25 — ANATOMY
   Scroll-linked SVG dissection of an orbital launch vehicle.
   ============================================================ */
import { $, $$ } from './utils.js';

const PARTS = [
  {
    n: '01', t: 'Payload fairing', y: 0.055,
    d: 'The aerodynamic nose that shields the payload through max-Q. Once the air thins to near-nothing it becomes dead weight — so pyrotechnics split it in two and it falls away, typically around 3 minutes into flight.',
    s: [['Jettison altitude', '~110 km'], ['Mass saved', 'up to 4 t']],
  },
  {
    n: '02', t: 'Second stage', y: 0.30,
    d: 'A smaller, vacuum-optimised rocket in its own right. Its engine bell is wider than the first stage\'s because in vacuum a larger nozzle extracts more velocity from the same propellant — the exhaust has room to expand.',
    s: [['Burn duration', '~6–9 min'], ['Typ. propellant', 'LOX + LH2 or RP-1']],
  },
  {
    n: '03', t: 'Interstage', y: 0.535,
    d: 'A cylindrical spacer that carries the upper stage\'s weight through launch vibration. In some vehicles the interstage stays with the booster; in others a pneumatic pusher shoves the stages apart a few centimetres before the next engine ignites.',
    s: [['Separation', 'pneumatic / spring'], ['Tolerance', 'millimetres']],
  },
  {
    n: '04', t: 'First stage', y: 0.72,
    d: 'The fuel truck. Roughly 85% of liftoff mass is propellant, and most of it lives here. Nine minutes of fire converts hundreds of tonnes of chemistry into the kinetic energy needed to buy the second stage its vacuum.',
    s: [['Propellant fraction', '~85% of liftoff mass'], ['Burn', '~2.5–4 min']],
  },
  {
    n: '05', t: 'Grid fins', y: 0.78,
    d: 'Retractable titanium lattices that deploy on descent. A solid fin would melt; a grid fin sheds heat, folds flat, and steers a returning booster with hydraulic twitch-precision to a landing pad — the trick that made rockets reusable.',
    s: [['Deployed at', 'supersonic descent'], ['Drag', 'aerodynamic authority']],
  },
  {
    n: '06', t: 'Turbo-pumps', y: 0.88,
    d: 'The engine\'s heart: a turbine spinning at tens of thousands of RPM, feeding the combustion chamber with thousands of litres per second. Fail here and the rocket fails. Each pump delivers power comparable to a small power station.',
    s: [['RPM', 'up to ~100,000'], ['Power density', 'extreme']],
  },
  {
    n: '07', t: 'Combustion chamber', y: 0.945,
    d: 'Where propellants meet at thousands of degrees and hundreds of bars. Chamber pressure is the single number that separates a good engine from a great one — it is why staged-combustion cycles run hotter and harder.',
    s: [['Chamber pressure', '60–300+ bar'], ['Throat temp', '>3,300 °C']],
  },
  {
    n: '08', t: 'Engine nozzle', y: 1.0,
    d: 'The bell that turns pressure into speed. Its expansion ratio is a compromise: too narrow and it wastes energy at sea level; too wide and the exhaust separates and shakes the engine apart on the pad.',
    s: [['Exhaust velocity', '2,500–4,500 m/s'], ['Regenerative cooling', 'propellant-jacketed']],
  },
];

export function initAnatomy() {
  const svg = $('#anatomySvg');
  const labels = $('#anatomyLabels');
  const text = $('#anatomyText');
  if (!svg) return;

  /* ---------- build the SVG vehicle ---------- */
  const W = 420, H = 760;
  const cx = 150;
  const bodyTop = 60, bodyBot = 640;
  const bodyW = 84;
  const noseH = 150;
  const ns = 'http://www.w3.org/2000/svg';

  const mk = (tag, attrs) => {
    const n = document.createElementNS(ns, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  const defs = mk('defs', {});
  defs.innerHTML = `
    <linearGradient id="bodyG" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5c6679"/><stop offset="0.35" stop-color="#e4e9f1"/>
      <stop offset="0.62" stop-color="#aab3c4"/><stop offset="1" stop-color="#454e60"/>
    </linearGradient>
    <linearGradient id="engG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3344"/><stop offset="1" stop-color="#10151f"/>
    </linearGradient>
    <radialGradient id="glowG" cx="0.5" cy="0" r="1">
      <stop offset="0" stop-color="#ff8a3d" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#ff5a1f" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="3.2"/></filter>
  `;
  svg.appendChild(defs);

  const g = mk('g', {});

  // engine glow under the vehicle
  g.appendChild(mk('ellipse', { cx, cy: bodyBot + 34, rx: 70, ry: 30, fill: 'url(#glowG)' }));

  // interstage lines
  [bodyTop + noseH + (bodyBot - bodyTop - noseH) * 0.32, bodyTop + noseH + (bodyBot - bodyTop - noseH) * 0.72].forEach((y) => {
    g.appendChild(mk('line', { x1: cx - bodyW / 2, y1: y, x2: cx + bodyW / 2, y2: y, stroke: '#3a4356', 'stroke-width': 1.5 }));
  });

  // body
  const bodyY1 = bodyTop + noseH, bodyY2 = bodyBot;
  g.appendChild(mk('rect', { x: cx - bodyW / 2, y: bodyY1, width: bodyW, height: bodyY2 - bodyY1, fill: 'url(#bodyG)' }));
  // nose
  const nose = mk('path', {
    d: `M ${cx - bodyW / 2} ${bodyY1} C ${cx - bodyW / 2} ${bodyY1 - noseH * 0.72} ${cx - 12} ${bodyTop} ${cx} ${bodyTop}
        C ${cx + 12} ${bodyTop} ${cx + bodyW / 2} ${bodyY1 - noseH * 0.72} ${cx + bodyW / 2} ${bodyY1} Z`,
    fill: 'url(#bodyG)',
  });
  g.appendChild(nose);
  g.appendChild(mk('circle', { cx, cy: bodyTop + 2, r: 3.4, fill: '#2b3344' }));

  // engine section
  const engY = bodyBot, engH = 26;
  g.appendChild(mk('rect', { x: cx - bodyW / 2 - 6, y: engY, width: bodyW + 12, height: engH, rx: 4, fill: 'url(#engG)' }));
  [0, 1, 2].forEach((i) => {
    const bx = cx - 26 + i * 26;
    g.appendChild(mk('path', {
      d: `M ${bx - 9} ${engY + engH} L ${bx - 5} ${engY + engH + 22} L ${bx + 5} ${engY + engH + 22} L ${bx + 9} ${engY + engH} Z`,
      fill: '#161b26',
    }));
  });

  // grid fins
  [-1, 1].forEach((s) => {
    g.appendChild(mk('rect', {
      x: cx + s * (bodyW / 2 + 4), y: bodyY1 + (bodyY2 - bodyY1) * 0.16, width: 22, height: 22,
      transform: `rotate(${s * 45} ${cx + s * (bodyW / 2 + 15)} ${bodyY1 + (bodyY2 - bodyY1) * 0.16 + 11})`,
      fill: '#3a4356',
    }));
  });
  // legs
  [-1, 1].forEach((s) => {
    g.appendChild(mk('line', { x1: cx + s * bodyW * 0.28, y1: engY + engH + 4, x2: cx + s * (bodyW * 0.28 + 30), y2: engY + engH + 40, stroke: '#454e60', 'stroke-width': 4, 'stroke-linecap': 'round' }));
  });

  // panelling detail lines
  for (let i = 1; i <= 5; i++) {
    const y = bodyY1 + (bodyY2 - bodyY1) * (i / 6);
    g.appendChild(mk('line', { x1: cx - bodyW / 2 + 2, y1: y, x2: cx + bodyW / 2 - 2, y2: y, stroke: 'rgba(0,0,0,.25)', 'stroke-width': 1 }));
  }

  svg.appendChild(g);

  /* ---------- leader lines + labels ---------- */
  PARTS.forEach((p, i) => {
    const y = bodyTop + (bodyBot + 40 - bodyTop) * p.y;
    const lx = cx + bodyW / 2 + 26;
    const l = mk('line', { x1: cx + bodyW / 2 + 2, y1: y, x2: lx + 70, y2: y, stroke: '#5fe3ff', 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.35 });
    l.dataset.part = i;
    svg.appendChild(l);
    const c = mk('circle', { cx: cx + bodyW / 2 + 2, cy: y, r: 3, fill: '#5fe3ff', opacity: 0.35 });
    c.dataset.part = i;
    svg.appendChild(c);
  });

  /* ---------- text column ---------- */
  PARTS.forEach((p, i) => {
    const a = document.createElement('article');
    a.className = 'apart';
    a.dataset.part = i;
    a.innerHTML = `
      <div class="apart__n">${p.n}</div>
      <h3 class="apart__t">${p.t}</h3>
      <p class="apart__d">${p.d}</p>
      <div class="apart__s">${p.s.map((s) => `<div>${s[0]}<b>${s[1]}</b></div>`).join('')}</div>
    `;
    text.appendChild(a);
  });

  /* ---------- scroll sync ---------- */
  const aparts = $$('.apart', text);
  const lines = $$('[data-part]', svg);
  function sync() {
    let active = 0;
    aparts.forEach((a, i) => {
      const r = a.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.55) active = i;
    });
    aparts.forEach((a, i) => a.classList.toggle('on', i === active));
    lines.forEach((l) => {
      const i = +l.dataset.part;
      l.setAttribute('opacity', i === active ? 1 : 0.22);
      if (i === active && l.tagName === 'line') l.setAttribute('stroke', '#ff8a3d');
      else if (l.tagName === 'line') l.setAttribute('stroke', '#5fe3ff');
    });
  }
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);
  sync();
}
