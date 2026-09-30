/* ============================================================
   MACH 25 — PRERENDER
   Bakes the real archive data into index.html so a crawler that
   never executes JavaScript still sees the rockets, engines,
   launches and countdown instead of em-dash placeholders.

   The browser still hydrates on top of this markup: every render
   function below replaces innerHTML, so the prebaked content is
   swapped for the live version the moment main.js boots. Nothing
   about the interactive experience changes.

   Run:  node tools/prerender.mjs
   ============================================================ */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "index.html");

/* Same formatters the client uses, duplicated here rather than imported:
   utils.js touches window/document at module scope, so it cannot load in
   Node. Kept byte-identical to the client versions. */
const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const fmtInt = (n, digits = 0) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
};
const compact = (n, digits = 1) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(digits) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(digits) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(digits) + "k";
  return String(Math.round(n));
};
const fmtMass = (kg) => {
  if (kg === null || kg === undefined || isNaN(kg)) return "—";
  if (kg >= 1000) return fmtInt(kg / 1000, kg >= 1e5 ? 0 : 1) + "<small>t</small>";
  return fmtInt(kg) + "<small>kg</small>";
};
const fmtDate = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtDateTime = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return fmtDate(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + "Z";
};
const relTime = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86400000);
  const hrs = Math.floor((abs % 86400000) / 3600000);
  const sign = diff >= 0 ? "+" : "−";
  if (days >= 1) return `${sign}${days}d ${hrs}h`;
  return `${sign}${hrs}h ${Math.floor((abs % 3600000) / 60000)}m`;
};

const STATUS_LABEL = { active: "Active", retired: "Retired", planned: "Planned", "in-development": "In development" };

/* data.js is a plain ES module with no DOM access, so it loads directly. */
const dataUrl = pathToFileURL(path.join(ROOT, "js", "data.js")).href;
const DATA = (await import(dataUrl)).DATA || (await import(dataUrl)).default;
const rockets = DATA.rockets || [];
const engines = DATA.engines || [];
const launches = DATA.launches || [];
const stats = DATA.stats || [];
const facts = DATA.facts || [];
const events = DATA.events || [];
const maxThrust = Math.max(...rockets.map((r) => r.thrustKN || 0));

/* --- the same "next confirmed launch" selection the countdown uses --- */
const now = Date.now();
const future = launches.filter((l) => new Date(l.date).getTime() > now);
const next = future.find((l) => l.windowConfirmed) || future[0] || null;

/* ---------------- pulse strip ---------------- */
function pulseLive() {
  const humans = stats.find((s) => s.id === "humans-now");
  const ytd = stats.find((s) => s.id === "launches-ytd");
  const prev = stats.find((s) => s.id === "launches-2025");
  const parts = [];
  if (next) {
    const diff = new Date(next.date) - now;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const cd = d > 0 ? `${d}d ${String(h).padStart(2, "0")}h`
      : `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
    parts.push(`<span class="pl__item"><b class="pl__live"><i></i>NEXT LAUNCH</b> <span class="pl__cd">${cd}</span> <span class="pl__sub">${esc(next.rocket.split("(")[0].trim())} · ${esc(next.launchSite.split(",").pop().trim())}</span></span>`);
  }
  if (humans) parts.push(`<span class="pl__item"><b>${humans.value}</b> <span class="pl__sub">HUMANS IN SPACE NOW</span></span>`);
  if (ytd && prev) parts.push(`<span class="pl__item"><b>${ytd.value}</b> <span class="pl__sub">ORBITAL ATTEMPTS 2026</span> <span class="pl__vs">vs <b>${prev.value}</b> all of 2025</span></span>`);
  return parts.join('<span class="pl__sep" aria-hidden="true"></span>');
}

function pulseGrid() {
  return stats.map((s) => {
    const unit = s.unit ? `<span class="u">${esc(s.unit)}</span>` : "";
    const display = s.isDate ? esc(s.value) : compact(Number(s.value));
    return `<div class="stat"><div class="stat__k">${esc(s.label)}</div>
      <div class="stat__v">${display}${unit}</div>
      <div class="stat__d">${esc(s.note || "")}</div></div>`;
  }).join("");
}

/* ---------------- lineage ---------------- */
function lineage() {
  const eras = ["ALL", ...new Set(events.map((e) => e.era).filter(Boolean))];
  const eraChips = eras.map((era) => {
    const n = era === "ALL" ? events.length : events.filter((e) => e.era === era).length;
    return `<button class="chip-era" data-era="${esc(era)}" type="button" aria-pressed="${era === "ALL"}">${esc(era)}<i>${n}</i></button>`;
  }).join("");
  const cards = events.map((e) => `<article class="ev" data-kind="${esc(e.kind)}" data-era="${esc(e.era || "")}">
      <div class="ev__impact">IMPACT ${e.impact ?? "—"}/10</div>
      <div class="ev__date">${esc(e.date)}${e.endDate ? " → " + esc(e.endDate) : ""}</div>
      <div class="ev__era">${esc(e.era)}</div>
      <h3 class="ev__title">${esc(e.title)}</h3>
      <p class="ev__desc">${esc(e.description)}</p>
      <div class="ev__meta">
        ${e.vehicle ? `<span>VEHICLE <b>${esc(e.vehicle)}</b></span>` : ""}
        ${e.actor ? `<span>ACTOR <b>${esc(e.actor)}</b></span>` : ""}
        ${e.location ? `<span>SITE <b>${esc(e.location)}</b></span>` : ""}
      </div></article>`).join("");
  return { eras: eraChips, cards };
}

/* ---------------- fleet ---------------- */
function fleet() {
  const chips = rockets.map((r) =>
    `<button class="chip" type="button" data-id="${esc(r.id)}">${esc(r.short || r.name)}</button>`).join("");
  const first = rockets.find((r) => r.id === "starship-super-heavy") || rockets[0];
  const specs = [
    ["Height", first.height ? first.height.toFixed(1) + "<small>m</small>" : "—"],
    ["Diameter", first.diameter ? first.diameter.toFixed(1) + "<small>m</small>" : "—"],
    ["Liftoff mass", first.mass ? fmtMass(first.mass) : "—"],
    ["Stages", String(first.stages ?? "—")],
    ["Payload · LEO", first.payloadLEO ? fmtMass(first.payloadLEO) : "—"],
    ["Payload · GTO", first.payloadGTO ? fmtMass(first.payloadGTO) : "—"],
    ["To the Moon", first.payloadMoon ? fmtMass(first.payloadMoon) : "—"],
    ["First stage engines", esc(first.engines || "—")],
  ].map((s) => `<div class="spec"><div class="spec__k">${s[0]}</div><div class="spec__v">${s[1]}</div></div>`).join("");
  const tf = first.thrustKN ? first.thrustKN / 9.80665 : 0;
  return {
    chips,
    eyebrow: `VEHICLE / ${(STATUS_LABEL[first.status] || first.status).toUpperCase()}`,
    name: esc(first.name),
    meta: [esc(first.operator), esc(first.country), "First flight " + fmtDate(first.firstFlight)]
      .filter(Boolean).join(" &nbsp;·&nbsp; "),
    tag: STATUS_LABEL[first.status] || first.status,
    tagCls: first.status === "active" ? "active" : first.status === "retired" ? "retired" : "planned",
    notes: esc(first.notes || ""),
    specs,
    thrust: `<div class="spec__k">LIFTOFF THRUST · ${fmtInt(tf)} tf (${fmtInt(first.thrustKN)} kN)</div>
      <div class="fp__bar-track"><div class="fp__bar-fill" style="width:${maxThrust ? Math.min(Math.max((tf / maxThrust) * 100, 2), 100) : 0}%"></div></div>
      <div class="fp__bar-note">${maxThrust ? ((tf / maxThrust) * 100).toFixed(1) + "% of the most powerful machine ever flown" : ""}</div>`,
  };
}

/* ---------------- engines ---------------- */
function engineTable() {
  const COLS = [
    { k: "name", label: "Engine" },
    { k: "thrustSL", label: "Thrust SL", unit: "kN" },
    { k: "thrustVac", label: "Thrust vac", unit: "kN" },
    { k: "ispVac", label: "Isp vac", unit: "s" },
    { k: "ispSL", label: "Isp SL", unit: "s" },
    { k: "chamberPressure", label: "Pc", unit: "bar" },
    { k: "propellant", label: "Propellant" },
    { k: "firstRun", label: "First run" },
  ];
  const rows = engines.map((e) => `<tr>
      <td>${esc(e.name)}<div style="font-family:var(--ff-mono);font-size:9.5px;color:var(--ink-3);letter-spacing:.08em;margin-top:3px">${esc(e.rocket || "")} · ${esc(e.country || "")}</div></td>
      <td class="num">${e.thrustSL != null ? fmtInt(e.thrustSL) + ' <span class="hot">kN</span>' : "—"}</td>
      <td class="num">${e.thrustVac != null ? fmtInt(e.thrustVac) + ' <span class="hot">kN</span>' : "—"}</td>
      <td class="num ice">${e.ispVac != null ? e.ispVac + " s" : "—"}</td>
      <td class="num ice">${e.ispSL != null ? e.ispSL + " s" : "—"}</td>
      <td class="num">${e.chamberPressure != null ? e.chamberPressure + " bar" : "—"}</td>
      <td>${esc(e.propellant || "—")}</td>
      <td class="num">${esc(e.firstRun || "—")}</td>
    </tr>`).join("");
  return `<div class="engines__scroll"><table>
    <thead><tr>${COLS.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

/* ---------------- schedule ---------------- */
function launchesHtml() {
  const head = `<div class="lrow head">
    <div>Window (UTC)</div><div>Mission</div><div>Vehicle</div><div>Destination</div><div>Confidence</div></div>`;
  return head + launches.map((l) => {
    const crew = l.crew && l.crewNames?.length ? ` · ${esc(l.crewNames.length)} crew` : "";
    return `<div class="lrow">
      <div class="lrow__date">${esc(fmtDateTime(l.date))}<br/><span style="color:var(--ink-3)">${esc(relTime(l.date))}</span></div>
      <div class="lrow__m">${esc(l.mission)}${crew}<small>${esc(l.payload || "")}${l.windowConfirmed ? " · CONFIRMED WINDOW" : " · TARGET (NET)"}</small></div>
      <div class="lrow__r">${esc(l.rocket)}</div>
      <div class="lrow__s">${esc(l.destination)}</div>
      <div class="lrow__t ${esc(l.likelihood)}">${esc(l.likelihood)}</div>
    </div>`;
  }).join("");
}

/* ---------------- shock ---------------- */
function shock() {
  return facts.map((f) => {
    const num = f.numberText || compact(f.number);
    return `<article class="fact">
      <div class="fact__n">${esc(num)}${f.unit ? `<span class="u">${esc(f.unit)}</span>` : ""}</div>
      <div class="fact__t">${esc(f.text)}</div>
      <div class="fact__e">${esc(f.era || "")}${f.source ? " · " + esc(new URL(f.source).hostname.replace("www.", "")) : ""}</div></article>`;
  }).join("");
}

/* ---------------- countdown ---------------- */
function countdown() {
  if (!next) return { mission: "WINDOW PENDING", clock: '<div class="cdunit"><div class="cdunit__v">TBD</div><div class="cdunit__k">WINDOW PENDING</div></div>' };
  const t = new Date(next.date).getTime();
  const diff = Math.max(0, t - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const clock = [[d, "Days"], [h, "Hours"], [m, "Min"], [s, "Sec"]]
    .map(([v, k]) => `<div class="cdunit"><div class="cdunit__v">${String(v).padStart(2, "0")}</div><div class="cdunit__k">${k}</div></div>`).join("");
  return { mission: `${next.mission} · ${next.rocket} · ${next.launchSite}`, clock };
}

/* ---------------- inject ---------------- */
/* Fill a slot by element id. Done with explicit index arithmetic rather
   than a regex replacement: String.replace treats $1/$& in the replacement
   as backreferences, and the lineage event text contains "$1 billion" and
   "$10 billion", which a replacement string silently rewrote into the
   slot's own opening tag. Finding the tag boundaries and slicing instead
   keeps arbitrary content safe. */
function tagBounds(html, id) {
  const re = new RegExp(`<([a-zA-Z][a-zA-Z0-9]*)[^>]*\\sid="${id}"[^>]*>`, "");
  const open = re.exec(html);
  if (!open) return null;
  const tag = open[1];
  const start = open.index + open[0].length;
  const close = html.indexOf(`</${tag}>`, start);
  if (close === -1) return null;
  return { start, end: close, openTag: open[0] };
}
function fill(html, id, content) {
  const b = tagBounds(html, id);
  if (!b) { console.warn("  !! slot not found:", id); return html; }
  return html.slice(0, b.start) + content + html.slice(b.end);
}
function setAttr(html, id, attr, value) {
  const b = tagBounds(html, id);
  if (!b) { console.warn("  !! slot not found:", id); return html; }
  const re = new RegExp(`\\b${attr}="[^"]*"`, "");
  const tag = re.test(b.openTag)
    ? b.openTag.replace(re, `${attr}="${value}"`)
    : b.openTag.replace(/>$/, ` ${attr}="${value}">`);
  return html.slice(0, b.start - b.openTag.length) + tag + html.slice(b.start);
}

let html = fs.readFileSync(HTML_PATH, "utf8");

const lin = lineage();
const fl = fleet();
const cd = countdown();

html = fill(html, "pulseLive", pulseLive());
html = fill(html, "pulseGrid", pulseGrid());
html = fill(html, "lineageEras", lin.eras);
html = fill(html, "lineageTrack", lin.cards);
html = fill(html, "fleetChips", fl.chips);
html = fill(html, "fpEyebrow", fl.eyebrow);
html = fill(html, "fpName", fl.name);
html = fill(html, "fpMeta", fl.meta);
html = setAttr(html, "fpTag", "class", "fp__tag " + fl.tagCls);
html = fill(html, "fpTag", fl.tag);
html = fill(html, "fpNotes", fl.notes);
html = fill(html, "fpSpecs", fl.specs);
html = fill(html, "fpThrust", fl.thrust);
html = fill(html, "engineTable", engineTable());
html = fill(html, "launchList", launchesHtml());
html = fill(html, "shockGrid", shock());
html = fill(html, "cdMission", esc(cd.mission));
html = fill(html, "cdClock", cd.clock);
if (DATA.meta?.launchNote) html = fill(html, "launchNote", esc(DATA.meta.launchNote));
if (DATA.meta?.pulseFoot) html = fill(html, "pulseFoot", esc(DATA.meta.pulseFoot));
if (DATA.meta?.sources) html = fill(html, "footSources", esc(DATA.meta.sources));

/* JSON-LD structured data so the archive is machine-readable without JS */
const namedRockets = rockets.filter((r) => r.height).slice(0, 12);
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "MACH 25 — The Rocket Archive",
  description: "True-scale interactive archive of launch vehicles, built from real flight data.",
  itemListElement: namedRockets.map((r, i) => ({
    "@type": "ListItem", position: i + 1, name: r.name,
    additionalProperty: [
      { "@type": "PropertyValue", name: "heightMeters", value: r.height },
      ...(r.mass ? [{ "@type": "PropertyValue", name: "liftoffMassKg", value: r.mass }] : []),
      ...(r.thrustKN ? [{ "@type": "PropertyValue", name: "liftoffThrustKN", value: r.thrustKN }] : []),
      ...(r.firstFlight ? [{ "@type": "PropertyValue", name: "firstFlight", value: r.firstFlight }] : []),
    ],
  })),
};
const blob = `<script type="application/ld+json" id="ldJson">${JSON.stringify(jsonLd)}</script>`;
if (!html.includes('id="ldJson"')) {
  const at = html.indexOf("</head>");
  if (at !== -1) html = html.slice(0, at) + "  " + blob + "\n" + html.slice(at);
}

fs.writeFileSync(HTML_PATH, html);
console.log("prerendered:");
console.log("  rockets:", rockets.length, "| engines:", engines.length,
  "| launches:", launches.length, "| events:", events.length, "| facts:", facts.length);
console.log("  next launch:", next ? `${next.mission} (${next.date})` : "none");
console.log("  html bytes:", html.length);
console.log("  contains 'Saturn V':", html.includes("Saturn V"));

/* sitemap.xml: the landing page plus one shareable URL per vehicle and per
   comparison pair. Generated here rather than hand-maintained so it can
   never drift from data.js. */
const ORIGIN = "https://mach25-n64r.vercel.app";
const today = new Date().toISOString().slice(0, 10);
const loc = (p, changefreq, priority) =>
  `  <url>\n    <loc>${ORIGIN}/${p}</loc>\n    <lastmod>${today}</lastmod>\n` +
  `    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
const ids = rockets.map((r) => r.id);
const singles = ids.map((id) => loc("#" + id, "monthly", "0.6")).join("\n");
// every unordered pair: the comparison is the shareable unit
const pairs = [];
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++)
    pairs.push(loc(`#${ids[i]}-vs-${ids[j]}`, "monthly", "0.5"));
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${loc("", "daily", "1.0")}
${singles}
${pairs.join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap);
console.log("  sitemap.xml urls:", 1 + ids.length + pairs.length);

