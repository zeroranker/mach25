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

  // body bounds — declared before stageY, which is called immediately below
  const bodyY1 = bodyTop + noseH, bodyY2 = bodyBot;

  /* Separation — modelled on the real sequence:
       fairing jettison: the two fairing halves split along the vertical
         seam and hinge outward + fall away, exposing the payload inside.
       stage separation: the upper stage lifts off the booster at the
         interstage plane.
     Both are what the vehicle actually does in flight. */
  const SEPS = [
    { yFrac: 0.32, label: 'PAYLOAD FAIRING JETTISON' },
    { yFrac: 0.72, label: 'STAGE SEPARATION' },
  ];
  const stageY = (f) => bodyY1 + (bodyY2 - bodyY1) * f;
  const fairingSeam = stageY(SEPS[0].yFrac);
  const interstage = stageY(SEPS[1].yFrac);

  // engine glow under the vehicle
  g.appendChild(mk('ellipse', { cx, cy: bodyBot + 34, rx: 70, ry: 30, fill: 'url(#glowG)' }));

  // body — the booster, from the interstage down
  g.appendChild(mk('rect', { x: cx - bodyW / 2, y: interstage, width: bodyW, height: bodyY2 - interstage, fill: 'url(#bodyG)' }));

  /* ---- the upper stage: a real stage from the interstage up to the
       fairing seam. It carries the fairing and payload, so separating it
       lifts the whole upper assembly off the booster. ---- */
  const stackA = mk('g', { class: 'stack' });

  // stage skin
  stackA.appendChild(mk('rect', { x: cx - bodyW / 2, y: fairingSeam, width: bodyW, height: interstage - fairingSeam, fill: 'url(#bodyG)' }));
  // interstage seam, sitting on top of the booster
  stackA.appendChild(mk('line', { x1: cx - bodyW / 2, y1: interstage, x2: cx + bodyW / 2, y2: interstage, stroke: '#3a4356', 'stroke-width': 1.5 }));

  /* ---- the payload: hidden inside the fairing, revealed only once the
       halves fall open. A small satellite — bus, solar wings, dish. ---- */
  const payload = mk('g', { class: 'payload', opacity: 0 });
  const plY = fairingSeam - 6;
  payload.appendChild(mk('rect', { x: cx - 13, y: plY - 40, width: 26, height: 40, rx: 3, fill: '#2b3344', stroke: '#5fe3ff', 'stroke-width': 0.8 }));
  payload.appendChild(mk('rect', { x: cx - 46, y: plY - 31, width: 33, height: 17, rx: 2, fill: '#232a3a', stroke: '#5fe3ff', 'stroke-width': 0.6 }));
  payload.appendChild(mk('rect', { x: cx + 13, y: plY - 31, width: 33, height: 17, rx: 2, fill: '#232a3a', stroke: '#5fe3ff', 'stroke-width': 0.6 }));
  for (let i = 1; i < 4; i++) {
    payload.appendChild(mk('line', { x1: cx - 46 + i * 8, y1: plY - 31, x2: cx - 46 + i * 8, y2: plY - 14, stroke: 'rgba(95,227,255,.3)', 'stroke-width': 0.6 }));
    payload.appendChild(mk('line', { x1: cx + 13 + i * 8, y1: plY - 31, x2: cx + 13 + i * 8, y2: plY - 14, stroke: 'rgba(95,227,255,.3)', 'stroke-width': 0.6 }));
  }
  payload.appendChild(mk('circle', { cx, cy: plY - 34, r: 4.5, fill: 'none', stroke: '#5fe3ff', 'stroke-width': 0.9 }));
  stackA.appendChild(payload);

  /* ---- the fairing: two halves split along the vertical centre seam,
       hinged at the base so they swing open and fall away. ---- */
  const makeFairingHalf = (side) => {
    const half = mk('g', { class: 'fairing-half' });
    const hingeX = cx + side * (bodyW / 2);
    const halfW = bodyW / 2;
    const x0 = side < 0 ? cx - halfW : cx;
    const d = `M ${x0} ${fairingSeam}
               C ${x0} ${fairingSeam - noseH * 0.78} ${cx + side * 12} ${bodyTop} ${cx} ${bodyTop}
               L ${cx} ${fairingSeam} Z`;
    half.appendChild(mk('path', { d, fill: 'url(#bodyG)' }));
    // a subtle panel split so the two halves read as separate shells
    half.appendChild(mk('line', {
      x1: cx + side * (halfW * 0.42), y1: fairingSeam - 4,
      x2: cx + side * (halfW * 0.16), y2: bodyTop + noseH * 0.34,
      stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1,
    }));
    half.dataset.hingeX = String(hingeX);
    half.dataset.side = String(side);
    return half;
  };
  const fairL = makeFairingHalf(-1);
  const fairR = makeFairingHalf(1);
  stackA.appendChild(fairL);
  stackA.appendChild(fairR);

  g.appendChild(stackA);

  // engine section — stays with the booster
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

  /* ---------- stage-separation scrubber ----------
     One value 0..1, driven as the real flight sequence:
       first half  → fairing jettison: the two halves hinge outward and
                     fall away, revealing the payload inside
       second half → stage separation: the upper stage lifts off the
                     booster at the interstage
     A smoothstep keeps the motion weighty instead of linear. */
  const sepEl = $('#anatomySep');
  const sepFill = $('#anatomySepFill');
  const sepHandle = $('#anatomySepHandle');
  const sepHint = $('#anatomySepHint');
  if (!sepEl) return;

  const MAX_LIFT = 84;  // svg units the upper stage rises
  const HALF_SWING = 34; // degrees each fairing half opens
  const HALF_DROP = 46;  // how far the spent halves fall before fading
  let split = 0;

  const smooth = (t) => t * t * (3 - 2 * t);

  function applySplit() {
    const t1 = smooth(Math.min(split * 2, 1));   // fairing jettison
    const t2 = smooth(Math.max(split * 2 - 1, 0)); // stage separation

    // the upper stage lifts off the booster
    stackA.setAttribute('transform', `translate(0 ${-MAX_LIFT * t2})`);

    // fairing halves hinge outward at the seam, then drop away and fade
    [fairL, fairR].forEach((half) => {
      const side = +half.dataset.side;
      const hx = +half.dataset.hingeX;
      const swing = side * HALF_SWING * t1;
      const drop = HALF_DROP * t1;
      half.setAttribute('transform',
        `translate(${side * HALF_DROP * 0.55 * t1} ${drop}) rotate(${swing} ${hx} ${fairingSeam})`);
      half.setAttribute('opacity', String(Math.max(1 - t1 * 1.25, 0)));
    });

    // the payload is hidden until the fairing opens
    payload.setAttribute('opacity', String(t1));

    sepFill.style.width = (split * 100) + '%';
    sepHandle.style.left = (split * 100) + '%';
    sepEl.setAttribute('aria-valuenow', String(Math.round(split * 100)));
    if (split > 0.04) sepHint.classList.add('gone');
    else sepHint.classList.remove('gone');
  }

  function setFromEvent(ev) {
    const r = sepEl.getBoundingClientRect();
    split = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1);
    applySplit();
  }

  let dragging = false;
  sepEl.addEventListener('pointerdown', (ev) => {
    dragging = true;
    // capture can legitimately be unavailable (re-entered pointer, or the
    // browser already released it) — the drag still works off move events
    try { sepEl.setPointerCapture(ev.pointerId); } catch (e) { /* no-op */ }
    setFromEvent(ev);
  });
  sepEl.addEventListener('pointermove', (ev) => { if (dragging) setFromEvent(ev); });
  const stop = () => { dragging = false; };
  sepEl.addEventListener('pointerup', stop);
  sepEl.addEventListener('pointercancel', stop);

  // keyboard: arrows / home / end, since it is a real slider
  sepEl.setAttribute('tabindex', '0');
  sepEl.addEventListener('keydown', (ev) => {
    const step = ev.shiftKey ? 0.1 : 0.02;
    let next = split;
    if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') next = split - step;
    else if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') next = split + step;
    else if (ev.key === 'Home') next = 0;
    else if (ev.key === 'End') next = 1;
    else return;
    ev.preventDefault();
    split = Math.min(Math.max(next, 0), 1);
    applySplit();
  });

  applySplit();
}
