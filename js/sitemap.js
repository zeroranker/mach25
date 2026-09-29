/* ============================================================
   MACH 25 — LAUNCH-SITE MAP
   A self-contained dot map of the launch sites used across the
   lineage. Plots only the coordinates the events already carry
   (no external tiles, no network). Markers cross-highlight with
   the timeline: hovering a site filters the track, and hovering
   an event card raises its site.
   ============================================================ */
import { $ } from './utils.js';

/* Simplified continental outlines in lon/lat. Intentionally low
   resolution — this reads as a schematic "where humanity launches
   from", not a survey map. */
const LAND = [
  // North America
  [[-168,66],[-156,71],[-140,70],[-125,70],[-115,73],[-95,80],[-80,73],[-65,60],[-55,52],[-65,45],[-70,42],[-76,36],[-81,25],[-83,22],[-80,25],[-97,26],[-105,20],[-97,16],[-83,9],[-79,9],[-85,15],[-95,16],[-98,22],[-104,24],[-117,32],[-125,40],[-124,48],[-132,55],[-140,60],[-152,58],[-160,60],[-168,66]],
  // South America
  [[-80,8],[-70,11],[-60,8],[-50,5],[-44,-3],[-37,-9],[-35,-8],[-38,-13],[-42,-23],[-48,-28],[-52,-32],[-58,-38],[-62,-42],[-65,-47],[-68,-54],[-72,-52],[-73,-44],[-73,-32],[-71,-20],[-70,-12],[-75,-3],[-79,2],[-80,8]],
  // Europe + Asia (one landmass)
  [[-9,43],[-2,48],[-5,50],[3,52],[10,54],[18,56],[20,60],[30,62],[35,66],[45,68],[60,70],[70,72],[80,73],[95,75],[110,74],[125,72],[140,72],[155,70],[170,66],[178,65],[178,60],[168,60],[158,58],[140,50],[132,43],[127,40],[122,37],[120,32],[108,22],[105,10],[100,5],[98,10],[93,16],[88,21],[80,10],[77,8],[72,20],[66,25],[57,26],[52,28],[48,30],[44,38],[40,40],[35,38],[31,36],[27,37],[23,38],[18,40],[13,40],[8,42],[3,42],[-2,40],[-9,36],[-9,43]],
  // Africa
  [[-6,35],[1,37],[10,37],[20,32],[30,32],[35,28],[37,22],[40,15],[43,11],[48,11],[51,10],[45,2],[42,-5],[40,-12],[36,-18],[33,-25],[30,-31],[26,-34],[20,-34],[17,-30],[15,-22],[13,-15],[12,-8],[10,0],[8,4],[5,6],[-1,5],[-5,5],[-10,7],[-14,10],[-16,14],[-17,20],[-15,25],[-12,30],[-6,35]],
  // Australia
  [[113,-22],[114,-32],[118,-35],[124,-35],[129,-32],[132,-32],[137,-35],[140,-38],[146,-39],[150,-37],[153,-30],[153,-25],[150,-22],[145,-15],[142,-11],[137,-12],[132,-11],[127,-14],[122,-17],[117,-20],[113,-22]],
  // Japan (schematic)
  [[130,31],[133,34],[136,35],[140,36],[141,39],[142,42],[145,44],[141,45],[140,42],[138,37],[134,33],[130,31]],
  // UK + Ireland (schematic)
  [[-5,50],[-3,53],[-3,56],[-5,58],[-3,58],[-1,57],[0,53],[1,52],[-3,50],[-5,50]],
  // Antarctica band (schematic)
  [[-180,-72],[-150,-74],[-120,-76],[-90,-75],[-60,-73],[-30,-74],[0,-72],[30,-70],[60,-72],[90,-74],[120,-73],[150,-75],[180,-72],[180,-80],[-180,-78],[-180,-72]],
];

/* Sites mentioned more than once get a label; single-use events get a
   plain dot. Derived from the events themselves. */
export function renderSiteMap(events, opts = {}) {
  const box = $('#siteMap');
  if (!box || !events) return;

  const sites = new Map();
  events.forEach((e) => {
    if (e.lat == null || e.lon == null) return;
    const key = `${e.lat.toFixed(1)},${e.lon.toFixed(1)}`;
    if (!sites.has(key)) {
      sites.set(key, { lat: e.lat, lon: e.lon, label: e.location || null, events: [] });
    }
    sites.get(key).events.push(e);
  });
  const list = [...sites.values()];
  box.innerHTML = '';

  /* Focus the projection on the band the sites actually occupy: launch
     sites cluster between roughly -55° and +80°. A full -90..+90 map
     would be mostly empty ocean. */
  const lats = list.map((s) => s.lat);
  const latMin = Math.floor(Math.min(...lats, -58) - 6);
  const latMax = Math.ceil(Math.max(...lats, 78) + 6);
  const lonMin = -180, lonMax = 180;

  const W = 1000, H = 500;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'smap__svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Map of the launch sites used across the lineage timeline');

  const proj = (lon, lat) => [
    (lon - lonMin) / (lonMax - lonMin) * W,
    (latMax - lat) / (latMax - latMin) * H,
  ];

  // dot-grid landmasses: step the outline with a regular dot pitch so the
  // continents read as a schematic dotted texture
  const dots = new Set();
  const inside = (x, y, poly) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi)) hit = !hit;
    }
    return hit;
  };
  const step = 5;
  for (let py = step / 2; py < H; py += step) {
    for (let px = step / 2; px < W; px += step) {
      // back-project the pixel to lon/lat, then test against the polygons
      const lon = px / W * (lonMax - lonMin) + lonMin;
      const lat = latMax - py / H * (latMax - latMin);
      if (LAND.some((poly) => inside(lon, lat, poly))) dots.add(`${px}|${py}`);
    }
  }
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('fill', 'currentColor');
  [...dots].forEach((key) => {
    const [px, py] = key.split('|').map(Number);
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', px); c.setAttribute('cy', py); c.setAttribute('r', 1.05);
    g.appendChild(c);
  });
  svg.appendChild(g);

  // graticule meridians/parallels for the schematic chart feel
  const grid = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  grid.setAttribute('class', 'smap__grid');
  for (let lon = -150; lon <= 150; lon += 30) {
    const [x] = proj(lon, 0);
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', x); l.setAttribute('x2', x);
    l.setAttribute('y1', 0); l.setAttribute('y2', H);
    grid.appendChild(l);
  }
  // parallels every 15° within the focused band
  for (let lat = Math.ceil(latMin / 15) * 15; lat <= latMax; lat += 15) {
    const [, y] = proj(0, lat);
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', 0); l.setAttribute('x2', W);
    l.setAttribute('y1', y); l.setAttribute('y2', y);
    grid.appendChild(l);
  }
  svg.appendChild(grid);

  // launch-site markers
  const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  layer.setAttribute('class', 'smap__sites');
  const markers = [];

  /* Labels for the busy sites (Florida alone hosts three) would stack on
     each other. Collect every big site's label box, then push each one
     vertically out of the way of any box already placed — a simple greedy
     deconfliction that keeps the leader near its dot. */
  const placed = [];
  const labelSlot = (x, y, text) => {
    const w = text.length * 6.1 + 6;   // mono-ish advance estimate
    const h = 11;
    let top = y - h + 3.5;
    // nudge down until it no longer overlaps a previously placed label
    const overlaps = (a) => a.x < x + 12 + w && x + 12 < a.x + a.w &&
                             a.y < top + h && top < a.y + a.h;
    while (placed.some(overlaps) && top < y + 70) top += 13;
    placed.push({ x: x + 12, y: top, w, h });
    return top;
  };

  list.forEach((s) => {
    const [x, y] = proj(s.lon, s.lat);
    const big = s.events.length >= 2;
    const grp = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grp.setAttribute('class', 'smap__site' + (big ? ' smap__site--hot' : ''));
    grp.dataset.key = `${s.lat.toFixed(1)},${s.lon.toFixed(1)}`;
    grp.style.cursor = 'pointer';

    if (big) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', x); ring.setAttribute('cy', y);
      ring.setAttribute('r', 9);
      ring.setAttribute('class', 'smap__ring');
      grp.appendChild(ring);
    }
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y);
    dot.setAttribute('r', big ? 4 : 2.6);
    grp.appendChild(dot);

    // an invisible hit target: at the rendered scale the dots are only
    // ~2px, which is impossible to land a pointer on. This makes the whole
    // group reliably hoverable/clickable without drawing anything new.
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hit.setAttribute('cx', x); hit.setAttribute('cy', y);
    hit.setAttribute('r', 12);
    hit.setAttribute('fill', 'transparent');
    hit.setAttribute('class', 'smap__hit');
    grp.appendChild(hit);

    if (big && s.label) {
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const name = s.label.replace(/,.*$/, '').toUpperCase();
      const ly = labelSlot(x, y, name);
      t.setAttribute('x', x + 12);
      t.setAttribute('y', ly + 10);
      t.textContent = name;
      grp.appendChild(t);
    }
    layer.appendChild(grp);
    markers.push({ grp, site: s });
  });
  svg.appendChild(layer);
  box.appendChild(svg);

  /* ---- cross-highlight with the timeline ----
     One apply() combines both dim sources so they never fight over the
     opacity property: era-filter dimming + hover raise. */
  const cards = () => [...document.querySelectorAll('#lineageTrack .ev')];
  const dimmed = new Set();   // site keys hidden by the era filter
  let hovered = null;         // the site currently hovered (wins over dim)

  function apply() {
    markers.forEach(({ grp, site }) => {
      const isHover = hovered && site === hovered;
      // a dimmed site has no events in the current filter: lighting it up
      // with nothing to show would be misleading, so leave it dimmed
      const canRaise = isHover && !dimmed.has(site);
      if (canRaise) {
        grp.style.opacity = '1';
        grp.classList.add('is-up');
      } else {
        grp.style.opacity = dimmed.has(site) ? '0.12' : '';
        grp.classList.remove('is-up');
      }
    });
  }

  function raiseCard(site, on) {
    // never dim the track for a site that has no visible cards under the
    // current filter — there would be nothing to raise
    if (on && dimmed.has(site)) return;
    cards().forEach((c) => {
      const ev = events.find((e) => e.title === c.querySelector('.ev__title')?.textContent);
      const match = ev && ev.lat === site.lat && ev.lon === site.lon;
      c.classList.toggle('is-up', on && match);
      c.style.opacity = on ? (match ? 1 : 0.22) : '';
    });
  }

  markers.forEach(({ grp, site }) => {
    grp.addEventListener('mouseenter', () => { hovered = site; raiseCard(site, true); apply(); });
    grp.addEventListener('mouseleave', () => { hovered = null; raiseCard(site, false); apply(); });
    grp.addEventListener('click', () => {      // scroll the timeline to the first event at this site
      const ev = site.events[0];
      const card = cards().find((c) => c.querySelector('.ev__title')?.textContent === ev.title);
      if (card) {
        const track = document.querySelector('#lineageTrack');
        track.scrollTo({ left: card.offsetLeft - track.clientWidth * 0.35, behavior: 'smooth' });
        card.classList.add('is-flash');
        setTimeout(() => card.classList.remove('is-flash'), 1600);
      }
    });
  });

  // when the lineage re-fills (era filter), keep the map in sync by
  // re-deriving which sites still have a visible card
  document.addEventListener('dom:rendered', () => {
    const visible = new Set(cards().map((c) => c.querySelector('.ev__title')?.textContent));
    dimmed.clear();
    markers.forEach(({ site }) => {
      const n = site.events.filter((e) => visible.has(e.title)).length;
      if (!n) dimmed.add(site);
    });
    apply();
  });

  return { markers, sites: list };
}
