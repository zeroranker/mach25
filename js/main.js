/* ============================================================
   MACH 25 — MAIN CONTROLLER
   Boot sequence, chrome, and section orchestration.
   ============================================================ */
import DATA from './data.js';
import {
  $, $$, raf, reducedMotion, clamp, esc,
} from './utils.js';
import { initHero } from './scene.js';
import { initFleet } from './rocket3d.js';
import { ChartStage, makeChartDefs } from './charts.js';
import { initAnatomy } from './anatomy.js';
import { renderSiteMap } from './sitemap.js';
import * as UI from './ui.js';

const BOOT_LINES = [
  'INIT ARCHIVE CORE',
  'INDEXING VEHICLE TELEMETRY',
  'CALIBRATING TRUE-SCALE RIG',
  'SYNCHRONISING UTC CLOCK',
  'ARCHIVE ONLINE',
];

/* ------------------------------------------------------------ */
function boot(done) {
  const bootEl = $('#boot');
  const fill = $('#bootFill');
  const log = $('#bootLog');
  if (!bootEl) { done(); return; }
  let i = 0;
  const total = BOOT_LINES.length * 260;
  const t0 = performance.now();
  const iv = setInterval(() => {
    const line = BOOT_LINES[Math.min(i, BOOT_LINES.length - 1)];
    if (log) log.textContent = '> ' + line;
    i++;
    if (fill) fill.style.width = clamp((performance.now() - t0) / total, 0, 1) * 100 + '%';
    if (i >= BOOT_LINES.length + 1) {
      clearInterval(iv);
      bootEl.classList.add('done');
      document.body.classList.remove('is-loading');
      document.body.classList.add('ready');
      setTimeout(() => { bootEl.remove(); }, 800);
      done();
    }
  }, 260);
}

/* ------------------------------------------------------------ */
function initCursor() {
  const cur = $('#cursor');
  if (!cur || reducedMotion || !matchMedia('(hover:hover)').matches) return;
  const dot = $('.cursor__dot', cur);
  const ring = $('.cursor__ring', cur);
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
  window.addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate(${x}px,${y}px)`;
    ring.style.opacity = '';
  }, { passive: true });
  raf(() => {
    rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
    ring.style.transform = `translate(${rx}px,${ry}px)`;
  });
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-cursor="link"],a,button');
    cur.classList.toggle('hot', !!t);
  });
  document.addEventListener('pointerleave', () => cur.classList.add('hide'));
  document.addEventListener('pointerenter', () => cur.classList.remove('hide'));
  document.documentElement.classList.add('cursor-on');
}

/* ------------------------------------------------------------ */
function initChrome() {
  const nav = $('#nav');
  const prog = $('#scrollProg');
  const onScroll = () => {
    const y = scrollY;
    if (nav) nav.classList.toggle('solid', y > 80);
    if (prog) {
      const h = document.documentElement.scrollHeight - innerHeight;
      prog.style.transform = `scaleX(${h > 0 ? clamp(y / h, 0, 1) : 0})`;
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // reveals
  const ro = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const d = parseInt(en.target.dataset.delay || '0', 10);
      setTimeout(() => en.target.classList.add('on'), d);
      ro.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  const scan = () => $$('.reveal:not(.on)').forEach((n) => ro.observe(n));
  scan();
  // sections also reveal their own children dynamically rendered later
  document.addEventListener('dom:rendered', scan);
  window.addEventListener('resize', scan);

  // HUD clock
  const clock = $('#hudClock');
  const tEl = $('#hudT');
  const T0 = Date.now();
  const pad = (n) => String(n).padStart(2, '0');
  setInterval(() => {
    const d = new Date();
    if (clock) clock.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
    if (tEl) {
      const s = Math.floor((Date.now() - T0) / 1000);
      tEl.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    }
  }, 1000);

  const fy = $('#footYear');
  if (fy) fy.textContent = new Date().getFullYear();
  if ($('#footSources') && DATA.meta?.sources) {
    $('#footSources').textContent = DATA.meta.sources;
  }
}

/* ============================================================
   FLEET ORCHESTRATION
   ============================================================ */
function initFleetSection() {
  const canvas = $('#fleetCanvas');
  const stage = $('.fleet__stage');
  if (!canvas || !stage) return;
  const rockets = DATA.rockets || [];
  const visuals = DATA.visuals || {};
  const maxThrust = Math.max(...rockets.map((r) => r.thrustKN || 0));

  const fleet = initFleet(canvas, stage, (h, pair) => UI.renderRuler(h, pair));

  const state = { mode: 'single', current: null, a: null, b: null, pending: null };
  const hint = $('#fleetHint');
  let telemOn = false; // telemetry overlay on/off (declared before any use)

  function loadSingle(r) {
    state.mode = 'single'; state.current = r; state.pending = null;
    fleet.fitSingle(r, visuals[r.id]);
    UI.renderFleetPanel(r, maxThrust / 9.80665);
    UI.renderTelem(r);
    UI.setActiveChip(r.id, false);
    if (hint) hint.textContent = 'DRAG TO ROTATE · SCROLL TO ZOOM';
    syncTelem();
  }
  function enterCompare(seed) {
    state.mode = 'compare';
    state.a = seed || state.current || rockets[0];
    state.b = null; state.pending = 'b';
    $('#comparePanel').hidden = false;
    UI.renderCompare(state.a, null);
    UI.setActiveChip(state.a.id, true);
    if (hint) hint.textContent = 'PICK A SECOND VEHICLE TO SCALE AGAINST';
    syncTelem();
  }
  function exitCompare() {
    state.mode = 'single'; state.b = null; state.pending = null;
    $('#comparePanel').hidden = true;
    if (state.current) loadSingle(state.current);
  }
  function syncTelem() {
    const box = $('#fleetTelem');
    if (box) {
      // overlay is a single-vehicle readout: hide it while comparing two rigs
      if (state.mode === 'compare') box.hidden = true;
      else box.hidden = !telemOn;
    }
    syncShare();
  }
  function pick(r) {
    if (state.mode !== 'compare') { loadSingle(r); return; }
    // each pick replaces whichever slot is due, then hands the turn to the other
    if (state.pending === 'b') {
      state.b = r; state.pending = 'a';
      fleet.fitPair(state.a, visuals[state.a.id], r, visuals[r.id]);
      UI.renderCompare(state.a, r);
      if (hint) hint.textContent = 'NEXT PICK REPLACES VEHICLE A · DRAG TO ORBIT BOTH';
    } else {
      state.a = r; state.pending = 'b';
      fleet.fitPair(r, visuals[r.id], state.b, visuals[state.b.id]);
      UI.renderCompare(r, state.b);
      if (hint) hint.textContent = 'NEXT PICK REPLACES VEHICLE B · DRAG TO ORBIT BOTH';
    }
    UI.setActiveChip(r.id, true);
  }

  const btnCmp = $('#btnCompare');
  const btnShare = $('#cmpShare');
  /* A comparison is only shareable once both vehicles are chosen; before
     that the URL would name a pair that does not exist yet. */
  function syncShare() {
    if (btnShare) btnShare.hidden = !(state.mode === 'compare' && state.a && state.b);
  }
  if (btnShare) btnShare.addEventListener('click', async () => {
    const url = location.origin + location.pathname + '#' + state.a.id + '-vs-' + state.b.id;
    const done = () => {
      btnShare.querySelector('span').textContent = 'LINK COPIED';
      setTimeout(() => { if (btnShare.querySelector('span')) btnShare.querySelector('span').textContent = 'COPY LINK'; }, 1600);
    };
    try {
      if (navigator.share) { await navigator.share({ url, title: state.a.name + ' vs ' + state.b.name }); done(); return; }
      await navigator.clipboard.writeText(url);
    } catch { /* share cancelled, or clipboard blocked: fall back to selecting the URL */ }
    done();
  });

  UI.renderChips(rockets, pick);

  /* Deep links: #saturn-v selects a vehicle, #saturn-v-vs-falcon-9-block-5
     opens the two of them at true scale side by side. Both are shareable —
     the pair URL is the one worth posting, because the comparison is the
     thing the page cannot show any other way. */
  const byId = (id) => rockets.find((r) => r.id === id);
  function applyHash() {
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return false;
    const pair = h.match(/^(.+)-vs-(.+)$/);
    if (pair) {
      const a = byId(pair[1]), b = byId(pair[2]);
      if (a && b) {
        state.mode = 'compare';
        state.a = a; state.b = b; state.pending = 'b';
        $('#comparePanel').hidden = false;
        fleet.fitPair(a, visuals[a.id], b, visuals[b.id]);
        UI.renderCompare(a, b);
        UI.setActiveChip(b.id, true);
        if (hint) hint.textContent = 'NEXT PICK REPLACES VEHICLE A · DRAG TO ORBIT BOTH';
        btnCmp.classList.add('on');
        syncShare();
        return true;
      }
    }
    const one = byId(h);
    if (one) { loadSingle(one); return true; }
    return false;
  }
  window.addEventListener('hashchange', applyHash);
  if (applyHash()) { /* deep-linked: skip the default vehicle */ }
  else {
    const first = rockets.find((r) => r.id === 'starship-super-heavy') || rockets[0];
    if (first) loadSingle(first);
  }

  if (btnCmp) btnCmp.addEventListener('click', () => {
    if (state.mode === 'compare') exitCompare();
    else { enterCompare(state.current); btnCmp.classList.add('on'); }
    if (state.mode !== 'compare') btnCmp.classList.remove('on');
  });
  const btnReset = $('#btnResetView');
  if (btnReset) btnReset.addEventListener('click', () => fleet.resetView());
  const btnTelem = $('#btnTelem');
  if (btnTelem) btnTelem.addEventListener('click', () => {
    telemOn = !telemOn;
    btnTelem.classList.toggle('on', telemOn);
    syncTelem();
  });
}

/* ============================================================
   CHARTS
   ============================================================ */
function initChartsSection() {
  const canvas = $('#chartCanvas');
  if (!canvas) return;
  const defs = makeChartDefs();
  const stage = new ChartStage(canvas, $('#chartLegend'), $('#chartRead'));
  const tabsWrap = $('#dataTabs');
  const chipsWrap = $('#dataChips');
  const rockets = DATA.rockets || [];

  // vehicle selector: a toggle chip per rocket; the chart re-renders from
  // the currently enabled subset. At least one vehicle must stay on.
  const enabled = new Set(rockets.map((r) => r.id));
  let currentDef = defs.thrust;

  function refresh() {
    const subset = rockets.filter((r) => enabled.has(r.id));
    stage.set(currentDef, subset.length ? subset : rockets);
  }

  if (chipsWrap) {
    chipsWrap.innerHTML = rockets
      .map((r) => `<button class="dchip on" type="button" data-id="${r.id}" aria-pressed="true" title="${esc(r.name)}">${esc(r.short || r.name)}</button>`)
      .join('');
    chipsWrap.addEventListener('click', (ev) => {
      const c = ev.target.closest('.dchip');
      if (!c) return;
      const id = c.dataset.id;
      // never let the user switch off the last vehicle
      if (enabled.has(id) && enabled.size === 1) return;
      if (enabled.has(id)) { enabled.delete(id); c.setAttribute('aria-pressed', 'false'); }
      else { enabled.add(id); c.setAttribute('aria-pressed', 'true'); }
      c.classList.toggle('on', enabled.has(id));
      refresh();
    });
  }

  const order = ['thrust', 'payload', 'cost', 'trade'];
  order.forEach((id, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dtab' + (i === 0 ? ' on' : '');
    b.textContent = defs[id].label;
    b.addEventListener('click', () => {
      $$('.dtab', tabsWrap).forEach((t) => t.classList.remove('on'));
      b.classList.add('on');
      currentDef = defs[id];
      refresh();
    });
    tabsWrap.appendChild(b);
  });
  refresh();
}

/* ============================================================
   GO
   ============================================================ */
function renderAll() {
  // one launch selection for the countdown and the live strip, so they can
  // never disagree with each other or drift to a stale NET target
  const next = UI.nextLaunch(DATA.launches);
  UI.renderPulse(DATA.stats, DATA.meta?.pulseFoot);
  UI.renderPulseLive(DATA.stats, next);
  UI.renderLineage(DATA.events);
  renderSiteMap(DATA.events);
  UI.renderEngines(DATA.engines);
  UI.renderLaunches(DATA.launches, DATA.meta?.launchNote);
  UI.renderShock(DATA.facts);
  if (next) UI.initCountdown(next);
  UI.initCounters();
  // keep the live "now" strip's countdown fresh (matches the HUD clock cadence)
  setInterval(() => UI.renderPulseLive(DATA.stats, next), 1000);
  document.dispatchEvent(new Event('dom:rendered'));
}

(function main() {
  initChrome();
  initCursor();
  renderAll();
  /* A section that fails to boot must not die in silence: a console.warn
     is invisible to the user and to any regression gate watching for
     page errors, so a fully dead feature previously passed QA. Flag it
     on the page itself where it cannot be missed. */
  const guarded = (name, fn, target) => {
    try { fn(); } catch (e) {
      console.warn(name + ' unavailable', e);
      const el = document.getElementById(target);
      if (el) el.setAttribute('data-boot-error', name + ': ' + e.message);
    }
  };
  guarded('hero scene', () => initHero($('#heroCanvas')), 'hero');
  guarded('anatomy', () => initAnatomy(), 'anatomy');
  guarded('fleet', () => initFleetSection(), 'fleet');
  guarded('charts', () => initChartsSection(), 'data');
  boot(() => { document.dispatchEvent(new Event('dom:rendered')); });
})();
