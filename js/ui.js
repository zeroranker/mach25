/* ============================================================
   MACH 25 — UI RENDERERS
   Data → DOM for every section.
   ============================================================ */
import {
  $, $$, el, esc, fmtInt, compact, fmtMass, fmtDate, fmtDateTime, relTime, clamp, smooth,
} from './utils.js';

/* ============================================================
   01 — PULSE
   ============================================================ */
/* Live "now" strip: a single telemetry line above the grid. Reuses the
   countdown math and the same stats the grid already renders. */
export function renderPulseLive(stats, next) {
  const box = $('#pulseLive');
  if (!box) return;
  const humans = stats.find((s) => s.id === 'humans-now');
  const ytd = stats.find((s) => s.id === 'launches-ytd');
  const prev = stats.find((s) => s.id === 'launches-2025');

  const parts = [];
  if (next) {
    const t = new Date(next.date);
    const diff = t - Date.now();
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const cd = d > 0 ? `${d}d ${String(h).padStart(2,'0')}h`
      : `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m`;
    parts.push(`<span class="pl__item"><b class="pl__live"><i></i>NEXT LAUNCH</b> <span class="pl__cd">${cd}</span> <span class="pl__sub">${esc(next.rocket.split('(')[0].trim())} · ${esc(next.launchSite.split(',').pop().trim())}</span></span>`);
  }
  if (humans) {
    parts.push(`<span class="pl__item"><b>${humans.value}</b> <span class="pl__sub">HUMANS IN SPACE NOW</span></span>`);
  }
  if (ytd && prev) {
    parts.push(`<span class="pl__item"><b>${ytd.value}</b> <span class="pl__sub">ORBITAL ATTEMPTS 2026</span> <span class="pl__vs">vs <b>${prev.value}</b> all of 2025</span></span>`);
  }
  box.innerHTML = parts.join('<span class="pl__sep" aria-hidden="true"></span>');
}

export function renderPulse(stats, footnote) {
  const grid = $('#pulseGrid');
  if (!grid || !stats) return;
  grid.innerHTML = '';
  stats.forEach((s, i) => {
    const card = el('div', 'stat reveal');
    card.dataset.delay = String(i * 60);
    const unit = s.unit ? `<span class="u">${esc(s.unit)}</span>` : '';
    const display = s.isDate ? esc(s.value) : compact(Number(s.value));
    card.innerHTML = `
      <div class="stat__k">${esc(s.label)}</div>
      <div class="stat__v" data-count="${s.isDate ? '' : esc(s.value)}" data-decimals="${s.decimals || 0}">${display}${unit}</div>
      <div class="stat__d">${esc(s.note || '')}</div>
      <svg class="stat__spark" viewBox="0 0 240 30" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${sparkline(i)}" fill="none" stroke="${i % 2 ? '#5fe3ff' : '#ff7a3d'}" stroke-width="1.6" vector-effect="non-scaling-stroke" opacity=".9"/>
      </svg>`;
    grid.appendChild(card);
  });
  if (footnote && $('#pulseFoot')) $('#pulseFoot').textContent = footnote;
}

function sparkline(seed) {
  const pts = [];
  let y = 20 + (seed % 3) * 3;
  for (let x = 0; x <= 240; x += 12) {
    y = clamp(y + (Math.sin(x * 0.05 + seed) * 4.5 + (seed % 2 ? 2.2 : -2.2)), 4, 26);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

export function initCounters() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const node = en.target;
      const target = parseFloat(node.dataset.count);
      obs.unobserve(node);
      if (isNaN(target)) return;
      const decimals = parseInt(node.dataset.decimals || '0', 10);
      const dur = 1500;
      const t0 = performance.now();
      const unit = node.querySelector('.u')?.outerHTML || '';
      (function step() {
        const t = clamp((performance.now() - t0) / dur, 0, 1);
        const v = target * smooth(t);
        node.innerHTML = (Math.abs(target) >= 1000 ? fmtInt(v, decimals) : v.toFixed(decimals)) + unit;
        if (t < 1) requestAnimationFrame(step);
      })();
    });
  }, { threshold: 0.5 });
  $$('.stat__v[data-count]').forEach((n) => obs.observe(n));
}

/* ============================================================
   02 — LINEAGE
   ============================================================ */
export function renderLineage(events) {
  const track = $('#lineageTrack');
  if (!track || !events) return;
  const erasEl = $('#lineageEras');

  // reveal stagger + rail sync for horizontally scrolled items
  // (declared before fill() so the initial call below resolves it)
  const rail = $('#lineageProg');
  const hint = $('#lineageHint');
  function onScroll() {
    const max = track.scrollWidth - track.clientWidth;
    if (rail) rail.style.width = (max > 0 ? (track.scrollLeft / max) : 0) * 100 + '%';
    if (hint && track.scrollLeft > 40) {
      hint.classList.add('gone');
    } else if (hint) {
      hint.classList.remove('gone');
    }
  }

  // ---- populate the track with a (possibly filtered) event subset ----
  function fill(list) {
    track.innerHTML = '';
    list.forEach((e, i) => {
      const card = el('article', 'ev reveal');
      card.dataset.kind = e.kind;
      card.dataset.delay = String(Math.min(i * 25, 400));
      card.dataset.era = e.era || '';
      card.innerHTML = `
        <div class="ev__impact">IMPACT ${e.impact ?? '—'}/10</div>
        <div class="ev__date">${esc(e.date)}${e.endDate ? ' → ' + esc(e.endDate) : ''}</div>
        <div class="ev__era">${esc(e.era)}</div>
        <h3 class="ev__title">${esc(e.title)}</h3>
        <p class="ev__desc">${esc(e.description)}</p>
        <div class="ev__meta">
          ${e.vehicle ? `<span>VEHICLE <b>${esc(e.vehicle)}</b></span>` : ''}
          ${e.actor ? `<span>ACTOR <b>${esc(e.actor)}</b></span>` : ''}
          ${e.location ? `<span>SITE <b>${esc(e.location)}</b></span>` : ''}
        </div>`;
      track.appendChild(card);
    });
    // re-arm reveal observers for the freshly created cards via the
    // existing dom:rendered path in main.js (no new coupling introduced)
    document.dispatchEvent(new Event('dom:rendered'));
    track.scrollLeft = 0;
    onScroll();
  }

  // ---- era filter chips ----
  let active = 'ALL';
  const eras = ['ALL', ...new Set(events.map((e) => e.era).filter(Boolean))];
  if (erasEl) {
    erasEl.innerHTML = eras
      .map((era) => {
        const n = era === 'ALL' ? events.length : events.filter((e) => e.era === era).length;
        return `<button class="chip-era" data-era="${esc(era)}" type="button" aria-pressed="${era === active}">${esc(era)}<i>${n}</i></button>`;
      })
      .join('');
    erasEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.chip-era');
      if (!btn) return;
      active = btn.dataset.era;
      erasEl.querySelectorAll('.chip-era').forEach((b) => {
        b.setAttribute('aria-pressed', String(b.dataset.era === active));
      });
      fill(active === 'ALL' ? events : events.filter((e) => e.era === active));
    });
  }

  fill(events);

  track.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // drag-to-scroll: pointer grab + inertia-free follow, so the track is
  // reachable even when the vertical wheel hijacks the page scroll
  let down = false, startX = 0, startLeft = 0;
  track.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'touch') return; // let native touch scrolling work
    down = true;
    startX = ev.clientX;
    startLeft = track.scrollLeft;
    track.setPointerCapture(ev.pointerId);
  });
  track.addEventListener('pointermove', (ev) => {
    if (!down) return;
    track.scrollLeft = startLeft - (ev.clientX - startX);
  });
  const end = () => { down = false; };
  track.addEventListener('pointerup', end);
  track.addEventListener('pointercancel', end);
  track.addEventListener('pointerleave', end);
}

/* ============================================================
   03 — FLEET
   ============================================================ */
const STATUS_LABEL = { active: 'Active', retired: 'Retired', planned: 'Planned', 'in-development': 'In development' };

export function renderFleetPanel(r, maxThrust) {
  const set = (id, html) => { const n = $('#' + id); if (n) n.innerHTML = html; };
  set('fpEyebrow', `VEHICLE / ${STATUS_LABEL[r.status] || r.status}`.toUpperCase());
  set('fpName', esc(r.name));
  set('fpMeta', [esc(r.operator), esc(r.country), 'First flight ' + fmtDate(r.firstFlight)].filter(Boolean).join(' &nbsp;·&nbsp; '));
  const tag = $('#fpTag');
  if (tag) {
    tag.textContent = STATUS_LABEL[r.status] || r.status;
    tag.className = 'fp__tag ' + (r.status === 'active' ? 'active' : r.status === 'retired' ? 'retired' : 'planned');
  }
  set('fpNotes', esc(r.notes || ''));

  const specs = [
    ['Height', r.height ? r.height.toFixed(1) + '<small>m</small>' : '—'],
    ['Diameter', r.diameter ? r.diameter.toFixed(1) + '<small>m</small>' : '—'],
    ['Liftoff mass', r.mass ? fmtMass(r.mass) : '—'],
    ['Stages', String(r.stages ?? '—')],
    ['Payload · LEO', r.payloadLEO ? fmtMass(r.payloadLEO) : '—'],
    ['Payload · GTO', r.payloadGTO ? fmtMass(r.payloadGTO) : '—'],
    ['To the Moon', r.payloadMoon ? fmtMass(r.payloadMoon) : '—'],
    ['First stage engines', esc(r.engines || '—')],
  ];
  set('fpSpecs', specs.map((s) =>
    `<div class="spec"><div class="spec__k">${s[0]}</div><div class="spec__v">${s[1]}</div></div>`).join(''));

  const tf = r.thrustKN ? (r.thrustKN / 9.80665) : 0;
  set('fpThrust', `
    <div class="spec__k">LIFTOFF THRUST · ${fmtInt(tf)} tf (${fmtInt(r.thrustKN)} kN)</div>
    <div class="fp__bar-track"><div class="fp__bar-fill" id="fpBarFill"></div></div>
    <div class="fp__bar-note">${maxThrust ? ((tf / maxThrust) * 100).toFixed(1) + '% of the most powerful machine ever flown' : ''}</div>`);
  requestAnimationFrame(() => {
    const fill = $('#fpBarFill');
    if (fill && maxThrust) fill.style.width = clamp((tf / maxThrust) * 100, 2, 100) + '%';
  });
}

export function renderChips(rockets, onPick) {
  const wrap = $('#fleetChips');
  if (!wrap) return;
  wrap.innerHTML = '';
  rockets.forEach((r) => {
    const c = el('button', 'chip', esc(r.short || r.name));
    c.type = 'button';
    c.dataset.id = r.id;
    c.addEventListener('click', () => onPick(r));
    wrap.appendChild(c);
  });
}

export function setActiveChip(id, compareMode) {
  $$('#fleetChips .chip').forEach((c) => {
    const on = c.dataset.id === id;
    c.classList.toggle('on', on && !compareMode);
    c.classList.toggle('cmp', on && compareMode);
  });
}

/* On-stage telemetry overlay: true-scale callouts floating over the 3D rig.
   Mirrors the panel data so the vehicle can be read without looking away. */
export function renderTelem(r) {
  const box = $('#fleetTelem');
  if (!box || !r) return;
  const tf = r.thrustKN ? r.thrustKN / 9.80665 : 0;
  const row = (k, v) => `<div class="telem__row"><span>${k}</span><b>${v}</b></div>`;
  box.innerHTML = `
    <div class="telem__head">
      <span class="telem__name">${esc(r.short || r.name)}</span>
      <span class="telem__live"><i></i>LIVE RIG</span>
    </div>
    ${row('HEIGHT', r.height ? r.height.toFixed(1) + ' m' : '—')}
    ${row('DIAMETER', r.diameter ? r.diameter.toFixed(1) + ' m' : '—')}
    ${row('MASS ON PAD', r.mass ? fmtMass(r.mass) : '—')}
    ${row('STAGES', String(r.stages ?? '—'))}
    ${row('THRUST', tf ? fmtInt(tf) + ' tf' : '—')}
    ${row('PAYLOAD · LEO', r.payloadLEO ? fmtMass(r.payloadLEO) : '—')}
    <div class="telem__foot">${esc(r.tagline || '')}</div>`;
}

export function renderRuler(height, pair) {
  const ruler = $('#fleetRuler');
  if (!ruler) return;
  ruler.innerHTML = '';
  const step = height > 80 ? 20 : height > 30 ? 10 : 5;
  for (let h = 0; h <= Math.ceil(height / step) * step; h += step) {
    const t = el('div', 'tick');
    t.style.top = (100 - (h / height) * 100) + '%';
    t.innerHTML = `<span>${h} m</span>`;
    ruler.appendChild(t);
  }
}

export function renderCompare(ra, rb) {
  const metrics = [
    ['Liftoff thrust', 'thrustKN', (v) => fmtInt(v) + ' kN', true],
    ['Liftoff mass', 'mass', (v) => fmtMass(v), true],
    ['Payload · LEO', 'payloadLEO', (v) => fmtMass(v), true],
    ['Payload · GTO', 'payloadGTO', (v) => fmtMass(v), true],
    ['Height', 'height', (v) => v.toFixed(1) + ' m', true],
    ['Cost / kg LEO', 'costPerKgLEO', (v) => '$' + fmtInt(v), false],
  ];
  function col(elId, r, other, cls) {
    const c = $('#' + elId);
    if (!c) return;
    if (!r || !other) { c.innerHTML = ''; return; }
    const bars = metrics
      .filter((m) => r[m[1]] != null && other[m[1]] != null)
      .map((m) => {
        const [label, key, fmt, higherBetter] = m;
        const a = r[key], b = other[key];
        const max = Math.max(a, b) || 1;
        const wins = higherBetter ? a >= b : a <= b;
        return `<div class="cmpbar ${cls}">
          <div class="cmpbar__k"><span>${label}</span><span>${fmt(a)}</span></div>
          <div class="cmpbar__t"><div class="cmpbar__f" style="width:${(a / max) * 100}%"></div></div>
        </div>`;
      }).join('');
    const winsCount = metrics.filter((m) => {
      const a = r[m[1]], b = other[m[1]];
      if (a == null || b == null) return false;
      // match the bar-highlight rule (>= / <=) so a tie counts as a held
      // category for both, never as a loss that makes the totals disagree
      return m[3] ? a >= b : a <= b;
    }).length;
    c.innerHTML = `
      <div class="cmp__name">${esc(r.name)}</div>
      <div class="cmp__bars">${bars}</div>
      <div class="cmp__win ${cls === 'b' ? 'b' : ''}">WINS ${winsCount} / ${metrics.filter((m) => r[m[1]] != null && other[m[1]] != null).length} METRICS</div>`;
  }
  col('cmpA', ra, rb, 'a');
  col('cmpB', rb, ra, 'b');
}

/* ============================================================
   06 — ENGINES
   ============================================================ */
export function renderEngines(engines) {
  const wrap = $('#engineTable');
  if (!wrap || !engines) return;

  // sortable column definitions; numeric keys sort numerically, nulls last
  const COLS = [
    { k: 'name', label: 'Engine', sort: 'text' },
    { k: 'thrustSL', label: 'Thrust SL', sort: 'num', unit: 'kN' },
    { k: 'thrustVac', label: 'Thrust vac', sort: 'num', unit: 'kN' },
    { k: 'ispVac', label: 'Isp vac', sort: 'num', unit: 's' },
    { k: 'ispSL', label: 'Isp SL', sort: 'num', unit: 's' },
    { k: 'chamberPressure', label: 'Pc', sort: 'num', unit: 'bar' },
    { k: 'propellant', label: 'Propellant', sort: 'text' },
    { k: 'firstRun', label: 'First run', sort: 'num' },
  ];
  let sortKey = null;
  let sortDir = 1;

  function sorted() {
    if (!sortKey) return engines;
    const col = COLS.find((c) => c.k === sortKey);
    const out = engines.slice();
    out.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const an = av == null, bn = bv == null;
      if (an && bn) return 0;
      if (an) return 1;   // nulls always last
      if (bn) return -1;
      if (col.sort === 'num') return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
    return out;
  }

  function build() {
    const arrow = (c) => c.k === sortKey
      ? `<span class="sort-arrow">${sortDir > 0 ? '▲' : '▼'}</span>`
      : '<span class="sort-arrow" aria-hidden="true"></span>';
    const th = (c) => `<th${c.sort ? ' class="sortable" data-k="' + c.k + '"' : ''}${
      c.sort ? ' role="columnheader" aria-sort="' + (c.k === sortKey ? (sortDir > 0 ? 'ascending' : 'descending') : 'none') + '"' : ''
    }>${c.label}${c.sort ? arrow(c) : ''}</th>`;
    const rows = sorted().map((e) => `<tr>
        <td>${esc(e.name)}<div style="font-family:var(--ff-mono);font-size:9.5px;color:var(--ink-3);letter-spacing:.08em;margin-top:3px">${esc(e.rocket || '')} · ${esc(e.country || '')}</div></td>
        <td class="num">${e.thrustSL != null ? fmtInt(e.thrustSL) + ' <span class="hot">kN</span>' : '—'}</td>
        <td class="num">${e.thrustVac != null ? fmtInt(e.thrustVac) + ' <span class="hot">kN</span>' : '—'}</td>
        <td class="num ice">${e.ispVac != null ? e.ispVac + ' s' : '—'}</td>
        <td class="num ice">${e.ispSL != null ? e.ispSL + ' s' : '—'}</td>
        <td class="num">${e.chamberPressure != null ? e.chamberPressure + ' bar' : '—'}</td>
        <td>${esc(e.propellant || '—')}</td>
        <td class="num">${esc(e.firstRun || '—')}</td>
      </tr>`).join('');
    wrap.innerHTML = `<div class="engines__scroll"><table>
      <thead><tr>${COLS.map(th).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
    wireHint();
  }

  /* On narrow screens the table scrolls horizontally and more than half its
     width is out of reach. Surface a hint only when that is actually true,
     and dismiss it the moment the user scrolls it.
     NOTE: the scroller is this #engineTable element itself (overflow-x:auto);
     the inner .engines__scroll wrapper is a plain div and cannot fire scrolls. */
  function wireHint() {
    const hint = document.getElementById('engineHint');
    if (!hint) return;
    const check = () => {
      const overflows = wrap.scrollWidth > wrap.clientWidth + 2;
      hint.classList.toggle('show', overflows && wrap.scrollLeft < 8);
    };
    wrap.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
  }

  // header click sorting (delegated so it survives re-renders)
  wrap.addEventListener('click', (ev) => {
    const cell = ev.target.closest('th.sortable');
    if (!cell) return;
    const k = cell.dataset.k;
    if (sortKey === k) sortDir *= -1;
    else { sortKey = k; sortDir = 1; }
    build();
  });

  build();
}

/* ============================================================
   07 — SCHEDULE
   ============================================================ */
export function renderLaunches(launches, note) {
  const wrap = $('#launchList');
  if (!wrap || !launches) return;
  const head = `<div class="lrow head">
    <div>Window (UTC)</div><div>Mission</div><div>Vehicle</div><div>Destination</div><div>Confidence</div></div>`;
  wrap.innerHTML = head + launches.map((l) => {
    const crew = l.crew && l.crewNames?.length ? ` · ${esc(l.crewNames.length)} crew` : '';
    return `<div class="lrow">
      <div class="lrow__date">${esc(fmtDateTime(l.date))}<br/><span style="color:var(--ink-3)">${esc(relTime(l.date))}</span></div>
      <div class="lrow__m">${esc(l.mission)}${crew}<small>${esc(l.payload || '')}${l.windowConfirmed ? ' · CONFIRMED WINDOW' : ' · TARGET (NET)'}</small></div>
      <div class="lrow__r">${esc(l.rocket)}</div>
      <div class="lrow__s">${esc(l.destination)}</div>
      <div class="lrow__t ${esc(l.likelihood)}">${esc(l.likelihood)}</div>
    </div>`;
  }).join('');
  if (note && $('#launchNote')) $('#launchNote').textContent = note;
}

/* The next launch shown to the user: prefer the first launch in the future
   with a CONFIRMED window, falling back to the first future launch of any
   kind. Picking launches[0] blindly showed a NET target that had already
   slipped past, freezing the clock at zero under a "window open" banner. */
export function nextLaunch(launches) {
  if (!launches?.length) return null;
  const now = Date.now();
  const future = launches.filter((l) => new Date(l.date).getTime() > now);
  if (!future.length) return null;
  return future.find((l) => l.windowConfirmed) || future[0];
}

export function initCountdown(launch) {
  const mission = $('#cdMission');
  const clock = $('#cdClock');
  const bar = $('#cdBar');
  if (!launch || !clock) return;
  if (mission) mission.textContent = `${launch.mission} · ${launch.rocket} · ${launch.launchSite}`;
  const t = new Date(launch.date).getTime();
  if (isNaN(t)) {
    if (clock) clock.innerHTML = '<div class="cdunit"><div class="cdunit__v">TBD</div><div class="cdunit__k">WINDOW PENDING</div></div>';
    return;
  }
  const span = t - Date.now();
  const startedAt = span > 0 ? Date.now() - 14 * 86400000 : t; // visual cadence for the bar
  const total = Math.max(span, 14 * 86400000);
  function tick() {
    const diff = t - Date.now();
    const d = Math.max(0, Math.floor(diff / 86400000));
    const h = Math.max(0, Math.floor((diff % 86400000) / 3600000));
    const m = Math.max(0, Math.floor((diff % 3600000) / 60000));
    const s = Math.max(0, Math.floor((diff % 60000) / 1000));
    if (clock) clock.innerHTML = [
      [d, 'Days'], [h, 'Hours'], [m, 'Min'], [s, 'Sec'],
    ].map(([v, k]) => `<div class="cdunit"><div class="cdunit__v">${String(v).padStart(2, '0')}</div><div class="cdunit__k">${k}</div></div>`).join('');
    if (bar) {
      const el2 = Math.min(1, Math.max(0, (Date.now() - startedAt) / total));
      bar.style.width = (el2 * 100) + '%';
    }
    if (diff <= 0) {
      if (mission) mission.textContent = `${launch.mission} — LIFTOFF WINDOW OPEN`;
      return;
    }
    requestAnimationFrame(tick);
  }
  tick();
}

/* ============================================================
   08 — SHOCK
   ============================================================ */
export function renderShock(facts) {
  const grid = $('#shockGrid');
  const marq = $('#marquee');
  if (!grid || !facts) return;
  grid.innerHTML = '';
  facts.forEach((f, i) => {
    const card = el('article', 'fact reveal');
    card.dataset.delay = String((i % 6) * 70);
    const num = f.numberText || compact(f.number);
    card.innerHTML = `
      <div class="fact__n">${esc(num)}${f.unit ? `<span class="u">${esc(f.unit)}</span>` : ''}</div>
      <div class="fact__t">${esc(f.text)}</div>
      <div class="fact__e">${esc(f.era || '')}${f.source ? ' · ' + esc(new URL(f.source).hostname.replace('www.', '')) : ''}</div>`;
    grid.appendChild(card);
  });
  if (marq && facts.length) {
    const items = facts.slice(0, 12).map((f) => `<span>${esc(f.text)}</span>`);
    marq.innerHTML = `<div class="marquee__in">${items.join('')}${items.join('')}</div>`;
  }
}
