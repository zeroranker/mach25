/* ============================================================
   MACH 25 — shared utilities
   ============================================================ */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const map = (v, a, b, c, d) => lerp(c, d, inv(a, b, v));
export const smooth = (t) => t * t * (3 - 2 * t);
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

// seeded pseudo-random (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- number formatting ---------- */
export function fmtInt(n, digits = 0) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(n);
}
export function compact(n, digits = 1) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(digits) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(digits) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(digits) + 'k';
  return String(Math.round(n));
}
export function fmtMass(kg) {
  if (kg === null || kg === undefined || isNaN(kg)) return '—';
  if (kg >= 1000) return fmtInt(kg / 1000, kg >= 1e5 ? 0 : 1) + '<small>t</small>';
  return fmtInt(kg) + '<small>kg</small>';
}
export function fmtDate(iso, opts) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', opts || { month: 'short', day: 'numeric', year: 'numeric' });
}
export function fmtDateTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return fmtDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + 'Z';
}
export function relTime(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86400000);
  const hrs = Math.floor((abs % 86400000) / 3600000);
  const sign = diff >= 0 ? '+' : '−';
  if (days >= 1) return `${sign}${days}d ${hrs}h`;
  return `${sign}${hrs}h ${Math.floor((abs % 3600000) / 60000)}m`;
}

/* ---------- DOM helpers ---------- */
export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}
export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* ---------- animation ---------- */
export function raf(callback) {
  let running = true;
  const loop = (t) => {
    if (!running) return;
    callback(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => { running = false; };
}

/* ---------- viewport sizes ---------- */
export const sizes = {
  get w() { return window.innerWidth; },
  get h() { return window.innerHeight; },
  get dpr() { return Math.min(window.devicePixelRatio || 1, 2); },
};
