/* ============================================================
   MACH 25 — CHARTS
   Canvas-native, animated data visualisations.
   ============================================================ */
import { clamp, lerp, smooth, fmtInt, compact, $ } from './utils.js';

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

/* ------------------------------------------------------------ */
export class ChartStage {
  constructor(canvas, legendEl, readEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.legend = legendEl;
    this.read = readEl;
    this.progress = 0;
    this.animating = false;
    this.data = null;
    this.mode = 'bar';
    this.hover = -1;
    this.tip = null;
    this._buildTip();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    canvas.addEventListener('mousemove', (e) => this._onMove(e));
    canvas.addEventListener('mouseleave', () => { this.hover = -1; this._hideTip(); });
  }

  _buildTip() {
    this.tip = document.createElement('div');
    this.tip.className = 'chart-tip';
    Object.assign(this.tip.style, {
      position: 'absolute', pointerEvents: 'none', zIndex: 5, display: 'none',
      background: 'rgba(8,11,18,.95)', border: '1px solid rgba(255,255,255,.14)',
      borderRadius: '8px', padding: '8px 11px', fontFamily: 'var(--ff-mono)',
      fontSize: '10.5px', letterSpacing: '.06em', color: 'var(--ink)',
      boxShadow: '0 10px 30px -10px rgba(0,0,0,.8)', whiteSpace: 'nowrap',
    });
    this.canvas.parentElement.appendChild(this.tip);
  }
  _showTip(html, x, y) {
    this.tip.innerHTML = html;
    this.tip.style.display = 'block';
    const w = this.tip.offsetWidth, h = this.tip.offsetHeight;
    this.tip.style.left = clamp(x - w / 2, 6, this.cssW - w - 6) + 'px';
    this.tip.style.top = clamp(y - h - 14, 6, this.cssH - h - 6) + 'px';
  }
  _hideTip() { this.tip.style.display = 'none'; }

  resize() {
    // The canvas's display size is owned by CSS (#chartCanvas height clamp).
    // Only the drawing buffer is sized here — reading the PARENT's height
    // and writing it back onto the canvas creates a feedback loop whenever
    // the stage holds in-flow content (the legend), growing it without end.
    const parent = this.canvas.parentElement;
    const cs = getComputedStyle(parent);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const dpr = DPR();
    const w = Math.max(280, parent.clientWidth - padX);
    const h = Math.max(280, this.canvas.clientHeight || 320);
    if (w === this.cssW && h === this.cssH) { this.render(); return; }
    this.cssW = w;
    this.cssH = h;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.render();
  }

  set(def, rockets) {
    this.def = def;
    this.rockets = rockets;
    this.mode = def.mode || 'bar';
    this.progress = 0;
    this._startAnim();
    if (this.legend) this.legend.innerHTML = (def.legend || []).map((l) =>
      `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('');
    if (this.read) {
      this.read.innerHTML = (def.readouts || []).map((ro) =>
        `<div class="dread"><div class="dread__k">${ro.k}</div><div class="dread__v">${ro.v}</div></div>`).join('');
    }
  }

  _startAnim() {
    if (this.animating) return;
    this.animating = true;
    const t0 = performance.now();
    const step = () => {
      this.progress = clamp((performance.now() - t0) / 1100, 0, 1);
      this.render();
      if (this.progress < 1) requestAnimationFrame(step);
      else this.animating = false;
    };
    requestAnimationFrame(step);
  }

  render() {
    const ctx = this.ctx, W = this.cssW, H = this.cssH;
    if (!this.def) return;
    ctx.clearRect(0, 0, W, H);
    if (this.mode === 'scatter') this._renderScatter();
    else this._renderBars();
  }

  /* ---------------- horizontal bars ---------------- */
  _renderBars() {
    const ctx = this.ctx, W = this.cssW, H = this.cssH;
    const items = this.def.items(this.rockets);
    const max = Math.max(...items.map((i) => i.v)) * 1.06;
    const labelW = Math.min(150, W * 0.26);
    const valueW = 78;
    const trackW = W - labelW - valueW - 24;
    const rowH = Math.min((H - 20) / items.length, 34);
    const startY = (H - rowH * items.length) / 2 + rowH / 2;

    ctx.font = "500 10.5px 'JetBrains Mono', monospace";
    ctx.textBaseline = 'middle';

    items.forEach((it, i) => {
      const y = startY + i * rowH;
      const target = (it.v / max) * trackW;
      const w = Math.max(target * smooth(this.progress), 1.5);
      const hovered = this.hover === i;

      // label
      ctx.fillStyle = hovered ? '#e9edf6' : '#aab3c4';
      ctx.textAlign = 'left';
      ctx.fillText(it.name, 4, y);

      // track
      ctx.fillStyle = 'rgba(255,255,255,.055)';
      ctx.fillRect(labelW, y - rowH * 0.28, trackW, rowH * 0.56);

      // bar
      const grad = ctx.createLinearGradient(labelW, 0, labelW + trackW, 0);
      grad.addColorStop(0, it.color);
      grad.addColorStop(1, it.colorEnd || it.color);
      ctx.fillStyle = grad;
      ctx.fillRect(labelW, y - rowH * 0.28, w, rowH * 0.56);
      if (hovered) {
        ctx.fillStyle = 'rgba(255,255,255,.14)';
        ctx.fillRect(labelW, y - rowH * 0.28, w, rowH * 0.56);
      }
      // end cap glow
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.fillRect(labelW + w - 1.5, y - rowH * 0.28, 1.5, rowH * 0.56);

      // value
      ctx.fillStyle = hovered ? '#ffb347' : '#e9edf6';
      ctx.textAlign = 'right';
      ctx.fillText(it.display, labelW + trackW + valueW, y);
    });

    // zero axis line
    ctx.strokeStyle = 'rgba(255,255,255,.1)';
    ctx.beginPath(); ctx.moveTo(labelW, 8); ctx.lineTo(labelW, H - 8); ctx.stroke();
  }

  /* ---------------- scatter ---------------- */
  _renderScatter() {
    const ctx = this.ctx, W = this.cssW, H = this.cssH;
    const items = this.def.items(this.rockets);
    const padL = 62, padR = 18, padT = 18, padB = 46;
    const iw = W - padL - padR, ih = H - padT - padB;

    const xs = items.map((i) => i.x), ys = items.map((i) => i.y);
    const xMax = Math.max(...xs) * 1.08, xMin = 0;
    const yMax = Math.max(...ys) * 1.12, yMin = 0;
    const X = (v) => padL + ((v - xMin) / (xMax - xMin)) * iw;
    const Y = (v) => padT + ih - ((v - yMin) / (yMax - yMin)) * ih;

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.fillStyle = 'rgba(110,119,137,.9)';
    ctx.font = "400 9.5px 'JetBrains Mono', monospace";
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    const yTicks = 5;
    for (let g = 0; g <= yTicks; g++) {
      const v = yMin + (yMax - yMin) * (g / yTicks);
      ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(W - padR, Y(v)); ctx.stroke();
      ctx.fillText(compact(v), padL - 8, Y(v));
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const xTicks = 6;
    for (let g = 0; g <= xTicks; g++) {
      const v = xMin + (xMax - xMin) * (g / xTicks);
      const x = X(v);
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ih); ctx.stroke();
      ctx.fillText(compact(v), x, padT + ih + 10);
    }

    // axis labels
    ctx.fillStyle = 'rgba(110,119,137,.95)';
    ctx.font = "400 9.5px 'JetBrains Mono', monospace";
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(this.def.xLabel.toUpperCase(), padL, H - 8);
    ctx.save();
    ctx.translate(12, padT + ih / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.def.yLabel.toUpperCase(), 0, 0);
    ctx.restore();

    // points
    const p = smooth(this.progress);
    this._scatterPts = [];
    items.forEach((it, i) => {
      const x = X(it.x), y = Y(it.y);
      const r = clamp(it.r || 4, 3, 16) * (0.4 + 0.6 * p);
      this._scatterPts.push({ x, y, r, it, i });
      const hovered = this.hover === i;
      ctx.beginPath();
      ctx.arc(x, y * p + (padT + ih) * (1 - p), r, 0, Math.PI * 2);
      ctx.fillStyle = it.color + (hovered ? 'ff' : 'aa');
      ctx.fill();
      if (hovered) {
        ctx.beginPath();
        ctx.arc(x, y, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
    // hover crosshair
    if (this.hover >= 0) {
      const pt = this._scatterPts[this.hover];
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(pt.x, padT); ctx.lineTo(pt.x, padT + ih);
      ctx.moveTo(padL, pt.y); ctx.lineTo(W - padR, pt.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _onMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    let nh = -1;
    if (this.mode === 'scatter' && this._scatterPts) {
      let best = 1e9;
      this._scatterPts.forEach((pt) => {
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d < best && d < 30) { best = d; nh = pt.i; }
      });
      if (nh >= 0) {
        const it = this._scatterPts[nh].it;
        this._showTip(
          `<b style="color:${it.color}">${it.name}</b><br/>` +
          `${this.def.xLabel}: ${fmtInt(it.x)} · ${this.def.yLabel}: ${fmtInt(it.y)}` +
          (it.note ? `<br/><span style="color:#6e7789">${it.note}</span>` : ''),
          x, y,
        );
      } else this._hideTip();
    } else if (this.def) {
      const items = this.def.items(this.rockets);
      const labelW = Math.min(150, this.cssW * 0.26);
      const valueW = 78;
      const trackW = this.cssW - labelW - valueW - 24;
      const rowH = Math.min((this.cssH - 20) / items.length, 34);
      const startY = (this.cssH - rowH * items.length) / 2 + rowH / 2;
      items.forEach((it, i) => {
        const cy = startY + i * rowH;
        if (Math.abs(y - cy) < rowH / 2 && x > labelW && x < labelW + trackW + valueW) nh = i;
      });
      if (nh >= 0) {
        const it = items[nh];
        this._showTip(
          `<b style="color:${it.color}">${it.name}</b><br/>` +
          `${this.def.tipLabel || 'Value'}: ${it.display}` +
          (it.note ? `<br/><span style="color:#6e7789">${it.note}</span>` : ''),
          clamp(x, 120, this.cssW - 120), y,
        );
      } else this._hideTip();
    }
    if (nh !== this.hover) { this.hover = nh; this.render(); }
  }
}

/* ------------------------------------------------------------ */
/* chart definitions (bound to data in main.js)                  */
export function makeChartDefs(get) {
  const statusColor = (r) => r.status === 'active' ? '#ff7a3d'
    : r.status === 'planned' || r.status === 'in-development' ? '#5fe3ff' : '#5a6478';

  const byThrust = {
    id: 'thrust',
    label: 'LIFTOFF THRUST',
    mode: 'bar',
    tipLabel: 'Thrust',
    legend: [
      { color: '#ff7a3d', label: 'Active' },
      { color: '#5fe3ff', label: 'Planned' },
      { color: '#5a6478', label: 'Retired' },
    ],
    items: (rockets) => rockets
      .filter((r) => r.thrustKN)
      .slice()
      .sort((a, b) => b.thrustKN - a.thrustKN)
      .slice(0, 16)
      .map((r) => ({
        name: r.short || r.name,
        v: r.thrustKN,
        display: fmtInt(r.thrustKN) + ' kN',
        color: statusColor(r), colorEnd: r.status === 'active' ? '#ffb347' : statusColor(r),
        note: `${fmtInt(r.thrustKN / 9.81)} tf · ${r.country}`,
      })),
    readouts: [
      { k: 'Most powerful ever flown', v: 'Starship Super Heavy' },
      { k: 'Thrust record', v: '~7,590 tf' },
      { k: 'Saturn V, for comparison', v: '~3,470 tf' },
    ],
  };

  const byPayload = {
    id: 'payload',
    label: 'PAYLOAD TO LEO',
    mode: 'bar',
    tipLabel: 'Payload to LEO',
    legend: byThrust.legend,
    items: (rockets) => rockets
      .filter((r) => r.payloadLEO)
      .slice()
      .sort((a, b) => b.payloadLEO - a.payloadLEO)
      .slice(0, 16)
      .map((r) => ({
        name: r.short || r.name,
        v: r.payloadLEO,
        display: fmtInt(r.payloadLEO / 1000, 1) + ' t',
        color: statusColor(r), colorEnd: r.status === 'active' ? '#ffb347' : statusColor(r),
        note: `${r.stages} stages · ${r.country}`,
      })),
    readouts: [
      { k: 'Heaviest payload to orbit', v: 'Starship (target)' },
      { k: 'Record flown', v: 'Saturn V — 140 t' },
      { k: 'Falcon 9 (reusable)', v: '≈ 22.8 t' },
    ],
  };

  const byCost = {
    id: 'cost',
    label: 'COST PER KG TO LEO',
    mode: 'bar',
    tipLabel: 'Cost per kg',
    legend: [
      { color: '#ff7a3d', label: 'Operational' },
      { color: '#5fe3ff', label: 'Target' },
      { color: '#5a6478', label: 'Retired' },
    ],
    items: (rockets) => rockets
      .filter((r) => r.costPerKgLEO)
      .slice()
      .sort((a, b) => a.costPerKgLEO - b.costPerKgLEO)
      .slice(0, 16)
      .map((r) => ({
        name: r.short || r.name,
        v: r.costPerKgLEO,
        display: '$' + fmtInt(r.costPerKgLEO),
        color: r.costIsTarget ? '#5fe3ff' : statusColor(r),
        colorEnd: r.costIsTarget ? '#8ff0ff' : (r.status === 'active' ? '#ffb347' : statusColor(r)),
        note: r.costNote || (r.status === 'active' ? 'Operational estimate' : 'Historical, inflation-adjusted'),
      })),
    readouts: [
      { k: 'Space Shuttle (actual)', v: '$54,500 /kg' },
      { k: 'Falcon 9 (reuse era)', v: '≈ $2,700 /kg' },
      { k: 'Starship target', v: '≈ $10–100 /kg' },
    ],
  };

  const scatter = {
    id: 'trade',
    label: 'THRUST vs PAYLOAD',
    mode: 'scatter',
    xLabel: 'Liftoff thrust (kN)',
    yLabel: 'Payload to LEO (kg)',
    legend: byThrust.legend,
    items: (rockets) => rockets
      .filter((r) => r.thrustKN && r.payloadLEO)
      .map((r) => ({
        name: r.short || r.name,
        x: r.thrustKN, y: r.payloadLEO,
        r: clamp(Math.sqrt((r.mass || 1) / 1000) * 0.9, 3.5, 15),
        color: statusColor(r),
        note: r.mass ? `${fmtInt(r.mass / 1000, 0)} t on the pad` : 'liftoff mass TBD',
      })),
    readouts: [
      { k: 'Reading the chart', v: 'Up & right = more capability per unit of thrust' },
      { k: 'Bubble size', v: 'Gross liftoff mass' },
      { k: 'Point colour', v: 'Vehicle status' },
    ],
  };

  return { thrust: byThrust, payload: byPayload, cost: byCost, trade: scatter };
}
