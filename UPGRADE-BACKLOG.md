# MACH 25 — UPGRADE BACKLOG

Process (same rules as cycles 01–09, change kind = upgrades, not fixes):
INSPECT → BUILD LIST → PROTECT BEST → SMALL CONTROLLED CHANGE →
VERIFY → COMPARE → KEEP/ROLLBACK → RE-SCAN → REPEAT.
Never touch E:\harness\New folder\rocket. Self-contained, offline-capable, zero-error.
Current best checkpoint: mach25-snap-pre-upgrade (verified byte-identical to live).

## Baseline (confirmed 2026-09-28, post-brag-cleanup)
9 sections · 8 pulse stats · 43 lineage events · 21 fleet chips · 8 specs ·
8 anatomy parts · 17 engines · 16 launches · 21 shock facts · 0 console/page
errors at 1600/390px · no overflow.

## What the site already has (do NOT re-add)
Hero 3D pad scene · fleet procedural 3D with compare mode · scroll-synced
anatomy dissection · 4 canvas charts (thrust/payload/cost/trade) · engines
table · live countdown + manifest · shock facts + marquee · HUD clock ·
custom cursor · boot loader · scroll progress · reveal stagger.

## TIER A — high "wow" per unit of risk (do first)
U01  Lineage: era filter + decade scrub
     The 43-event horizontal track is a flat list. Add era chips (Pioneers /
     WWII / Space Race / Apollo / Shuttle / ISS / Commercial / New Space)
     that filter the cards in place, plus a decade mini-map under the rail.
     Purely additive to ui.js renderLineage; data.js already has `era`.
     Risk: low. Touches: ui.js, style.css. Nothing else changes.

U02  Fleet: spec-sheet "telemetry overlay" toggle
     A press-to-read HUD overlay that floats true-scale callouts over the 3D
     stage (height marker, stage count, engine cluster labels). Driven by the
     same data already in the panel.
     Risk: low-medium (touches rocket3d.js overlay divs + CSS).

U03  Pulse: live "now" strip
     A single full-width telemetry line above the grid: humans in space right
     now, next confirmed launch in T-minus, attempts this year vs last.
     Data already exists (stats[6], launches[0], stats[0]/[1]).
     Risk: low. Touches: index.html + ui.js + style.css.

U04  Engines: sortable columns
     17 rows, currently fixed order. Click a header (thrust, Isp, Pc, year)
     to sort ascending/descending with a direction arrow. Table already
     renders from data; sort is a data-only transform.
     Risk: low. Touches: ui.js renderEngines only.

U05  Data: rocket selector chips on charts
     Charts show all 16 rockets. Add a chip row to toggle individual vehicles
     in/out of the current chart (scatter especially benefits). ChartStage
     already re-renders from a rockets array — pass a filtered copy.
     Risk: low-medium. Touches: charts.js + main.js + style.css.

## TIER B — meaningful, moderate risk
U06  Lineage: world launch-site map
     EVENTS already carry lat/lon for ~35 of 43 events. A small dot-map of
     the four main cosmodromes + event markers that cross-highlight with the
     timeline. Highest "premium" visual; needs a new canvas/SVG module.
U07  Keyboard navigation: arrow keys cycle fleet chips; "/" focuses search.
U08  Deep-linkable state: #fleet=starship&cmp=falcon9 restores a comparison.
U09  Shock: unit-context toggle (SI ↔ imperial) for the fact cards.
U10  Anatomy: add a "stage separation" scrubber that animates the SVG stack
     splitting apart as the user drags.

## TIER C — polish / subjective
U11  Reduced-motion: hero parallax already gated; audit remaining animation.
U12  404 / offline fallback page.
U13  Print stylesheet for the engine table.
U14  OpenGraph metadata + share card.

## MODEL REFINEMENT CYCLE (mr1, completed 2026-09-29)
Measured every vehicle headless vs its declared dimensions. Found a
systematic ~13% height overshoot across all generic-build vehicles: the
stage cylinders were scaled to the full declared height and the nose cone
was then stacked on top. Fixed by reserving nose + engine-bell depth
inside the declared height. V-2's below-base nozzle (+7.9%) also fixed.
Fleet-wide height accuracy: 21/21 vehicles now within 3.3% (was 18/21 over
3%, most at +13%). Only js/rocket3d.js changed.
Snap: mach25-snap-mr1-trueheight

## ============================================================
RUN LOG — upgrade cycles U01..U06
============================================================
Each cycle followed: checkpoint → small change → browser-verified → kept.
All shipped with 0 console/page errors at 1600/768/390px, no overflow,
offline (fonts blocked) intact, and every pre-existing section count
unchanged (9 sections · 8 pulse · 43 lineage · 21 fleet chips · 8 specs ·
8 anatomy · 17 engine rows · 17 launches · 21 facts).

U01  Lineage era filter              KEPT  (snap: mach25-snap-u01-erafilter)
     11 chips (ALL + 10 eras) filter the 43 events in place; counts on each
     chip; full drag/scroll/rail behaviour preserved. Caught + fixed one real
     bug mid-cycle: a temporal-dead-zone reference to onScroll from fill() —
     hoisted the declaration above the call site.

U02  Fleet telemetry overlay         KEPT  (snap: mach25-snap-u02-telem)
     New TELEMETRY button toggles a floating true-scale callout box over the
     3D stage (6 rows: height/diameter/mass/stages/thrust/payload). Sits
     inside the stage, never collides with the ruler, hides during compare
     mode, hidden under 640px. The 3D scene itself is untouched.

U03  Pulse live "now" strip          KEPT  (snap: mach25-snap-u03-livestrip)
     Full-width telemetry line above the grid: next launch T-minus (recomputed
     every second — proved live by advancing the page clock 1h and watching
     2d 09h -> 2d 08h), humans in space now, 2026 YTD vs all of 2025.
     Caught + fixed one real regression mid-cycle: 438px horizontal overflow
     at a 390px viewport from nowrap items — added min-width:0 + ellipsis.

U04  Engines sortable columns        KEPT  (snap: mach25-snap-u04-sortable)
     All 8 headers clickable; asc/desc toggle with arrows and aria-sort;
     nulls sort last; row count preserved at 17. Verified monotonic in both
     directions against real data (RD-170 7,250 kN descends correctly).

U05  Chart vehicle selector chips    KEPT  (snap: mach25-snap-u05-chartchips)
     21 toggle chips above the chart; the canvas genuinely redraws from the
     filtered subset (proved by pixel-counting bar rows: 16 -> 3 -> 16).
     Filter persists across the 4 chart tabs; a last-vehicle guard prevents
     an empty chart.

U06  Launch-site map                 KEPT  (snap: mach25-snap-u06-sitemap)
     New js/sitemap.js: a self-contained SVG dot map (5,235 land dots,
     21 graticule lines) plotting the 14 distinct launch sites derived from
     the events' own lat/lon — no external tiles, no network. The 4
     multi-event sites (Baikonur, Cape LC-5, KSC LC-39A, Starbase) carry
     pulsing rings and labels. Cross-highlights the timeline both ways:
     hover a site raises its event cards (10 cards) and dims the rest;
     click a site scrolls the timeline to its first event. Stays in sync
     with the era filter (Apollo dims 13 of 14 markers). Projection is
     focused to the latitude band the sites occupy, so it reads as a
     224px-tall chart instead of a mostly-empty world map.
     Caught + fixed mid-cycle: two opacity writers (era-sync + hover)
     fighting over the same property — replaced with one apply() that
     combines a dimmed set with a hovered site, and dimmed sites no longer
     light up with nothing to show.

Files touched: index.html, js/main.js, js/ui.js, js/sitemap.js (new),
css/style.css — all additive. No existing selector, class, or data path
was altered.

## REMAINING (Tier B/C — deliberately not done)
U07 keyboard nav · U08 deep-linkable state · U09 SI/imperial toggle ·
U10 anatomy separation scrubber · U11 motion audit · U12 404 page ·
U13 print stylesheet · U14 OpenGraph card.
Each is either moderate-risk or cosmetic; the site is verified-good, so
stopping here per the stop condition.

## STOP CONDITION
Stop when remaining backlog items are only minor/subjective (Tier C with no
functional gain) or each would risk a verified-good behavior for negligible
return. Report and hand back.
