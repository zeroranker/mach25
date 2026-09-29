# MACH 25

**A cinematic archive of the machines that escaped Earth.**

> Every liquid engine, every stage, every machine that crossed the Kármán line —
> rebuilt in true scale from real flight data. This is not a gallery.
> It is an archive of escape velocity.

A single-page, zero-build, offline-capable WebGL archive of launch vehicles,
built with vanilla JavaScript and three.js. No framework, no bundler, no
tracking, no analytics, no cookies.

---

## Live

**[zeroranker.github.io/mach25](https://zeroranker.github.io/mach25/)**

## What's in it

| Section | Contents |
|---|---|
| **01 Pulse** | Live launch telemetry strip + 8 state-of-launch statistics |
| **02 Lineage** | 43 historical firsts on a drag-scrolled timeline, 11 era filters |
| **03 Fleet** | 21 launch vehicles as true-scale procedural 3D models, with side-by-side compare mode and a telemetry overlay |
| **04 Anatomy** | A full orbital rocket dissected in scroll-synced SVG |
| **05 Data** | 4 canvas charts on thrust, payload, cost-per-kg and the trade space — each with per-vehicle toggles |
| **06 Engines** | 17 rocket engines with real thrust, Isp, chamber pressure and year, fully sortable |
| **07 Schedule** | Countdown to the next confirmed launch + a 17-mission manifest |
| **08 Shock** | 21 numbers that don't compute |

## Sourcing

Every figure is cross-checked against Wikipedia, NASA, ESA, JAXA, Roscosmos,
CNSA, ISRO, manufacturer documentation, Spaceflight Now, and Jonathan
McDowell's launch statistics. Raw research notes live in `data/`.

Vehicles modelled include the V-2, R-7/Sputnik, Saturn V, Soyuz, Titan IIIE,
Space Shuttle, Proton, Delta IV Heavy, Falcon 9, Electron, Starship, SLS,
Ariane 5, Long March 5 and more — from Peenemünde 1942 to the present.

## Stack

- **three.js r181** (vendored, MIT)
- Vanilla ES modules — no React, no Vue, no build step
- Canvas 2D for all data charts
- SVG for the anatomy dissection
- Google Fonts (Space Grotesk / Inter / JetBrains Mono / Anton), degrading
  cleanly to system fonts when blocked

## Running it

Any static server works:

```bash
npx serve .
# or
python -m http.server 8000
```

The repository includes `server.mjs`, a dependency-free Node static server
with correct ES-module MIME types, if you'd rather not install anything:

```bash
node server.mjs   # → http://127.0.0.1:4111/
```

> **Note:** `three` is resolved through an import map to
> `vendor/three/three.module.js`, so the site runs fully offline and has no
> CDN dependency.

## Performance notes

Built and tuned to run at 60 FPS on integrated/entry-level 2015-era graphics
hardware (verified on an AMD Radeon R7 200 series, WebGL 2.0 via ANGLE/D3D11).
Strategies used:

- Geometry is generated procedurally at runtime, not shipped as assets
- Instanced and merged geometry where repetition allows
- Pixel ratio capped and canvases resized on a debounce
- Scroll work is transform-only, and gated behind `IntersectionObserver`
- `prefers-reduced-motion` respected throughout

## Licence

MIT — see `LICENSE`.

## Contact

Built by **zeroranker**. Issues and contributions welcome.
