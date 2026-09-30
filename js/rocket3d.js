/* ============================================================
   MACH 25 — FLEET 3D
   Every vehicle is built procedurally from its real
   dimensions (metres), then framed in a studio rig.
   ============================================================ */
import * as THREE from 'three';
import { clamp, damp, rng } from './utils.js';

/* ------------------------------------------------------------
   geometry helpers
   ------------------------------------------------------------ */
function ogiveProfile(baseR, len, steps = 28) {
  // radius tapers from baseR at the bottom to ~0 at the tip
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = (i / steps) * len;
    const r = baseR * Math.sqrt(Math.max(0, 1 - Math.pow(i / steps, 2.25)));
    pts.push(new THREE.Vector2(Math.max(r, 0.002), y));
  }
  return pts;
}
function latheFrom(pts, segments = 40) {
  return new THREE.LatheGeometry(pts, segments);
}
function bandMat(color, metal = 0.7, rough = 0.4) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
}

/* ------------------------------------------------------------
   engine cluster
   ------------------------------------------------------------ */
function addEngines(group, count, baseY, ringR, size = 1, mat) {
  const m = mat || bandMat('#262c3a', 0.85, 0.35);
  const n = clamp(count, 1, 12);
  if (n === 1) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.9 * size, 1.4 * size, 18, 1, true), m);
    b.rotation.x = Math.PI; b.position.y = baseY - 0.7 * size;
    b.name = 'engine'; group.add(b);
    return;
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.55 * size, 1.1 * size, 14, 1, true), m);
    b.rotation.x = Math.PI;
    b.position.set(Math.cos(a) * ringR, baseY - 0.55 * size, Math.sin(a) * ringR);
    b.name = 'engine';
    group.add(b);
  }
}

/* ------------------------------------------------------------
   generic stage stack
   ------------------------------------------------------------ */
function buildGeneric(r, visual) {
  const g = new THREE.Group();
  const body = bandMat(visual.bodyColor || '#dfe4ec', 0.72, 0.3);
  const accent = bandMat(visual.accent || '#e8b54d', 0.6, 0.35);
  const dark = bandMat('#232a38', 0.8, 0.4);

  const heights = (visual.stageHeights || [r.height * 0.55, r.height * 0.3, r.height * 0.15]).slice();
  const diams = (visual.stageDiameters || Array(heights.length).fill(r.diameter)).slice();
  while (diams.length < heights.length) diams.push(diams[diams.length - 1] * 0.7);

  /* Reserve the nose cone inside the declared height: previously the stack
     was scaled to r.height and the nose was stacked on top, inflating every
     generic-build vehicle by ~13%. The body now fills r.height - noseLen.
     Vehicles whose builder adds its own base detail (falcon landing legs,
     starship fins) pass visual.plumb=true to skip the engine-depth reserve. */
  const lastIdx = heights.length - 1;
  const topR0 = diams[lastIdx] / 2;
  const noseLen0 = clamp(r.height * 0.11, topR0 * 1.2, topR0 * 3.4);
  const isBlunt = (visual.nose === 'blunt' || visual.nose === 'capsule');
  const reserve = isBlunt ? topR0 : noseLen0;
  const engineDepth = visual.plumb ? 0 : 1.1;
  const scale = (r.height - reserve - engineDepth) / heights.reduce((a, b) => a + b, 0);
  let y = engineDepth;
  const stageTops = [];
  heights.forEach((h, i) => {
    const hScaled = h * scale;
    const rad = (diams[i] / 2);
    const radNext = (diams[Math.min(i + 1, diams.length - 1)] / 2);
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.max(radNext * 0.999, 0.05), Math.max(rad, 0.05), hScaled, 44),
      i === 0 ? body : (i === heights.length - 1 ? body : body),
    );
    cyl.position.y = y + hScaled / 2;
    cyl.name = `stage${i}`;
    g.add(cyl);

    // interstage accent ring
    if (i > 0) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(rad * 1.01, rad * 1.01, hScaled * 0.045, 44), accent);
      ring.position.y = y + hScaled * 0.02;
      g.add(ring);
    }
    y += hScaled;
    stageTops.push(y);
  });

  // nose cone on the last stage (length already reserved in `scale`)
  const last = lastIdx;
  const topR = topR0;
  const noseLen = noseLen0;
  const noseShape = visual.nose || 'ogive';
  if (noseShape === 'blunt' || noseShape === 'capsule') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(topR, 30, 16, 0, Math.PI * 2, 0, Math.PI / 2), body);
    dome.position.y = stageTops[last];
    g.add(dome);
    g.userData.noseTop = stageTops[last] + topR;
  } else {
    const cone = new THREE.Mesh(latheFrom(ogiveProfile(topR, noseLen)), body);
    cone.position.y = stageTops[last];
    g.add(cone);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(Math.max(topR * 0.05, 0.04), 10, 10), dark);
    tip.position.y = stageTops[last] + noseLen;
    g.add(tip);
    g.userData.noseTop = stageTops[last] + noseLen;
  }

  // strap-on boosters
  const bc = visual.boosterCount || 0;
  if (bc > 0) {
    const bScale = visual.boosterScale ?? (visual.boosterWide ? 0.5 : visual.boosterSlim ? 0.17 : 0.26);
    const bR = Math.max(r.diameter * bScale, 0.12);
    const bH = visual.boosterHeight ? visual.boosterHeight * scale : heights[0] * scale * 0.92;
    const attachR = r.diameter / 2 + bR * 0.95;
    const bm = bandMat('#c8cedb', 0.7, 0.32);
    for (let i = 0; i < bc; i++) {
      const a = (i / bc) * Math.PI * 2 + Math.PI / bc;
      const bg = new THREE.Group();
      if (visual.boosterShape === 'conical') {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(bR * 0.45, bR, bH, 24), bm);
        m.position.y = bH / 2; bg.add(m);
      } else {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR, bH, 24), bm);
        m.position.y = bH / 2; bg.add(m);
        const cap = new THREE.Mesh(latheFrom(ogiveProfile(bR, bR * 1.8)), bm);
        cap.position.y = bH; bg.add(cap);
      }
      bg.position.set(Math.cos(a) * attachR, engineDepth, Math.sin(a) * attachR);
      bg.name = 'booster';
      g.add(bg);
    }
  }

  // fins on the first stage
  if (visual.finStyle === 'fins') {
    const fR = diams[0] / 2;
    const fH = Math.max(heights[0] * scale * 0.22, fR * 0.9);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(fR * 0.62, fH, 0.16), dark);
      fin.position.set(Math.cos(a) * (fR + fR * 0.24), engineDepth + fH * 0.55, Math.sin(a) * (fR + fR * 0.24));
      fin.rotation.y = a;
      fin.rotation.z = Math.cos(a) > 0 ? -0.32 : 0.32;
      g.add(fin);
    }
  }
  // grid fins near top of first stage
  if (visual.finStyle === 'grid-fins') {
    const pR = diams[0] / 2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const gf = new THREE.Mesh(new THREE.BoxGeometry(pR * 0.55, pR * 0.55, 0.14), dark);
      gf.position.set(Math.cos(a) * (pR + pR * 0.32), engineDepth + heights[0] * scale * 0.9, Math.sin(a) * (pR + pR * 0.32));
      gf.rotation.y = a; gf.rotation.z = Math.PI / 4;
      g.add(gf);
    }
  }

  // engines on first stage
  // engines on first stage — bells sit inside the reserved engineDepth
  addEngines(g, clamp(r.engineCount || 1, 1, 12), engineDepth, diams[0] / 2 * 0.62, 1, dark);

  // paint bands for character
  if (visual.distinct === 'black-bands' || visual.distinct === 'roll-pattern') {
    const bR = diams[0] / 2 * 1.005;
    [0.16, 0.28, 0.4].forEach((f) => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR, heights[0] * scale * 0.035, 44), bandMat('#1a1f2b', 0.5, 0.6));
      band.position.y = engineDepth + heights[0] * scale * f;
      g.add(band);
    });
  }
  if (visual.distinct === 'flag' || visual.distinct === 'logo') {
    const bR = diams[Math.min(1, diams.length - 1)] / 2 * 1.01;
    const badge = new THREE.Mesh(new THREE.CylinderGeometry(bR, bR, heights[Math.min(1, heights.length - 1)] * scale * 0.09, 32), accent);
    badge.position.y = engineDepth + stageTops[0] - heights[Math.min(1, heights.length - 1)] * scale * 0.12;
    g.add(badge);
  }
  if (visual.distinct === 'stainless-silver') {
    // Starship: dark interstage collar between booster and ship
    const pR = diams[0] / 2 * 1.004;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(pR, pR, heights[0] * scale * 0.03, 44), bandMat('#2b2f36', 0.8, 0.4));
    collar.position.y = engineDepth + heights[0] * scale * 0.985;
    g.add(collar);
  }
  // launch-abort tower (capsule vehicles)
  if (visual.escTower) {
    const top = g.userData.noseTop || r.height;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, r.height * 0.024, 8), dark);
    tower.position.y = top + r.height * 0.012;
    g.add(tower);
    const esc = new THREE.Mesh(new THREE.ConeGeometry(0.22, r.height * 0.02, 14), accent);
    esc.position.y = top + r.height * 0.024 + r.height * 0.01;
    g.add(esc);
    g.userData.noseTop = top + r.height * 0.044;
  }
  return g;
}

/* ------------------------------------------------------------
   special builds
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   Saturn V — measured against the reference GLB (qa/ref-saturnv.glb,
   125 meshes / 107,059 verts), reoriented upright in
   qa/view-saturnv.json: H = 110.70 u, W = 15.34 u, H/W = 7.22 — the
   width is the four S-IC fins.  Reference feature spans mapped onto
   the real 110.6 m x 10.1 m vehicle:
     S-IC cylinder    0%  .. 38%   10.1 m dia, 5x F-1, four tail fins
     transition skirt 38% .. 42%   conical 10.1 -> 6.6 m interstage
     S-II             42% .. 65%   6.6 m dia
     S-IVB            65% .. 81%   6.6 m dia
     IU + SLA         81% .. 87%   6.6 -> 3.9 m adapter
     Apollo SM + CM   87% .. 91%   3.9 m service module + conical CM
     LES tower        91% .. 100%  lattice mast + escape motor
   ------------------------------------------------------------ */
function buildSaturnV(r, visual) {
  const g = new THREE.Group();
  const H = r.height;                     // 110.6 m
  const R1 = (r.diameter || 10.1) / 2;    // 5.05 m — S-IC
  const R2 = R1 * (6.6 / 10.1);           // 3.30 m — S-II / S-IVB
  const R3 = R1 * (3.9 / 10.1);           // 1.95 m — SLA top / Apollo SM
  const finR = 7.65;                      // fin tip radius: 15.3 m span (ref W)

  const hull = bandMat(visual.bodyColor || '#e8e8e6', 0.62, 0.34);
  const apollo = bandMat('#d7dce6', 0.55, 0.42);
  const dark = bandMat('#1b212d', 0.6, 0.6);
  const steel = bandMat('#8f97a3', 0.9, 0.3);

  // stations as fractions of stack height
  const ySic = H * 0.380;   // S-IC cylinder top     (42.0 m)
  const ySkt = H * 0.420;   // transition skirt top  (46.5 m)
  const yS2 = H * 0.646;    // S-II top              (71.4 m)
  const yS4 = H * 0.807;    // S-IVB top             (89.3 m)
  const ySla = H * 0.867;   // IU + SLA adapter top  (95.9 m)
  const ySm = H * 0.891;    // Apollo service module (98.5 m)
  const yCm = H * 0.914;    // Apollo command module (101.1 m)
  const yTop = H;           // LES motor tip         (110.6 m)

  /* ---------- S-IC: 10.1 m constant-section first stage ---------- */
  const sic = new THREE.Mesh(new THREE.CylinderGeometry(R1, R1, ySic, 56), hull);
  sic.position.y = ySic / 2;
  sic.name = 'stage0';
  g.add(sic);
  // black roll-pattern bands over the lower S-IC (the iconic paint)
  [0.045, 0.115, 0.185, 0.255, 0.325].forEach((f) => {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(R1 * 1.008, R1 * 1.008, ySic * 0.052, 56), dark);
    band.position.y = ySic * f + ySic * 0.026;
    g.add(band);
  });
  // broad dark band on the S-IC forward skirt, under the transition
  const sicTop = new THREE.Mesh(new THREE.CylinderGeometry(R1 * 1.008, R1 * 1.008, ySic * 0.07, 56), dark);
  sicTop.position.y = ySic - ySic * 0.035;
  g.add(sicTop);

  /* ---------- S-IC / S-II transition skirt: the 10.1 -> 6.6 m step ---------- */
  const sktH = ySkt - ySic;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R2 * 1.02, R1 * 1.02, sktH, 56), hull);
  skirt.position.y = ySic + sktH / 2;
  skirt.name = 'interstage';
  g.add(skirt);

  /* ---------- S-II: 6.6 m second stage ---------- */
  const s2H = yS2 - ySkt;
  const s2 = new THREE.Mesh(new THREE.CylinderGeometry(R2, R2, s2H, 48), hull);
  s2.position.y = ySkt + s2H / 2;
  s2.name = 'stage1';
  g.add(s2);
  // dark interstage collar at the S-II / S-IVB joint
  const colH = Math.max(s2H * 0.05, 1.2);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R2 * 1.012, R2 * 1.012, colH, 48), dark);
  collar.position.y = yS2 - colH / 2;
  g.add(collar);

  /* ---------- S-IVB: 6.6 m third stage ---------- */
  const s4H = yS4 - yS2;
  const s4 = new THREE.Mesh(new THREE.CylinderGeometry(R2, R2, s4H, 48), hull);
  s4.position.y = yS2 + s4H / 2;
  s4.name = 'stage2';
  g.add(s4);

  /* ---------- instrument unit + SLA adapter: 6.6 -> 3.9 m ---------- */
  const slaH = ySla - yS4;
  const sla = new THREE.Mesh(new THREE.CylinderGeometry(R3, R2, slaH, 48), hull);
  sla.position.y = yS4 + slaH / 2;
  sla.name = 'adapter';
  g.add(sla);

  /* ---------- Apollo spacecraft: service module + conical command module ---------- */
  const smH = ySm - ySla;
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(R3, R3, smH, 36), apollo);
  sm.position.y = ySla + smH / 2;
  sm.name = 'serviceModule';
  g.add(sm);
  const cmH = yCm - ySm;
  const cm = new THREE.Mesh(new THREE.CylinderGeometry(R3 * 0.26, R3, cmH, 36), apollo);
  cm.position.y = ySm + cmH / 2;
  cm.name = 'commandModule';
  g.add(cm);

  /* ---------- launch escape system: lattice mast + escape motor ---------- */
  const towH = (yTop - yCm) * 0.68;
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.48, towH, 12), apollo);
  tower.position.y = yCm + towH / 2;
  tower.name = 'escapeTower';
  g.add(tower);
  const motH = (yTop - yCm) - towH;
  const motor = new THREE.Mesh(new THREE.ConeGeometry(0.72, motH, 16), apollo);
  motor.position.y = yCm + towH + motH / 2;
  motor.name = 'escapeMotor';
  g.add(motor);

  /* ---------- four fins at the S-IC base: 15.3 m span ---------- */
  const finOut = finR - R1;               // 2.60 m beyond the tank wall
  const finH = H * 0.047;                 // fin chord ~5.2 m
  const finT = R1 * 0.11;                 // fin thickness
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(finOut, H * 0.008);     // tip, just above the pad
  finShape.lineTo(finOut * 0.42, finH);   // leading edge sweeps up and in
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: finT, bevelEnabled: false });
  finGeo.translate(0, 0, -finT / 2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(finGeo, dark);
    fin.position.set(Math.cos(a) * R1, 0, Math.sin(a) * R1);
    fin.rotation.y = -a;
    fin.name = 'fin';
    g.add(fin);
  }

  /* ---------- dark engine-bay rim at the S-IC base ---------- */
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(R1 * 1.012, R1 * 1.012, H * 0.012, 56), dark);
  rim.position.y = H * 0.006;
  g.add(rim);

  /* ---------- five F-1 bells: 1 centre + ring of 4 ---------- */
  const bellH = H * 0.022;                // ~2.4 m of nozzle below the base
  const mkBell = (rBot) => new THREE.Mesh(
    new THREE.CylinderGeometry(rBot * 0.68, rBot, bellH, 20, 1, true), steel);
  const centre = mkBell(R1 * 0.30);
  centre.position.y = -bellH / 2;
  centre.name = 'engine';
  g.add(centre);
  const ringR = R1 * 0.63;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const b = mkBell(R1 * 0.28);
    b.position.set(Math.cos(a) * ringR, -bellH / 2, Math.sin(a) * ringR);
    b.name = 'engine';
    g.add(b);
  }

  g.userData.noseTop = yTop;
  return g;
}

function buildShuttle(r, visual) {
  // External tank + 2 SRBs + orbiter. Scale: r.height is stack height (~56.1m)
  const g = new THREE.Group();
  const H = r.height;
  const tankR = H * 0.075;
  const tankH = H * 0.85;
  const foam = bandMat('#e2a06b', 0.25, 0.75); // signature orange foam
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(tankR, tankR, tankH, 40), foam);
  tank.position.y = tankH / 2;
  g.add(tank);
  const tankNose = new THREE.Mesh(latheFrom(ogiveProfile(tankR, tankR * 1.9)), foam);
  tankNose.position.y = tankH;
  g.add(tankNose);

  // SRBs
  const srbR = tankR * 0.42;
  const srbH = H * 0.77;
  const srbMat = bandMat('#e6eaf1', 0.6, 0.4);
  [-1, 1].forEach((s) => {
    const srb = new THREE.Mesh(new THREE.CylinderGeometry(srbR, srbR, srbH, 28), srbMat);
    srb.position.set(s * (tankR + srbR * 1.05), srbH / 2, 0);
    g.add(srb);
    const cap = new THREE.Mesh(latheFrom(ogiveProfile(srbR, srbR * 2.1)), srbMat);
    cap.position.set(s * (tankR + srbR * 1.05), srbH, 0);
    g.add(cap);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(srbR * 0.8, srbR * 1.3, 16, 1, true), bandMat('#222834', 0.8, 0.4));
    nozzle.rotation.x = Math.PI;
    nozzle.position.set(s * (tankR + srbR * 1.05), -srbR * 0.6, 0);
    g.add(nozzle);
  });

  // orbiter: delta-wing body mounted on one side of the tank. The wing
  // extends fore-aft along the tank axis (Y); the fuselage sits outboard in -Z.
  const orb = new THREE.Group();
  const bodyMat = bandMat('#dce2ec', 0.6, 0.35);
  const tileMat = bandMat('#1a1f2a', 0.7, 0.4);
  // fuselage: vertical cylinder alongside the tank, nose up
  const fusR = tankR * 0.5;
  const fusH = H * 0.5;
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(fusR, fusR * 0.85, fusH, 24), bodyMat);
  fus.position.set(0, H * 0.42, 0);
  orb.add(fus);
  // nose cone on top of the fuselage
  const noseC = new THREE.Mesh(new THREE.ConeGeometry(fusR, H * 0.075, 24), bodyMat);
  noseC.position.set(0, H * 0.42 + fusH / 2 + H * 0.0375, 0);
  orb.add(noseC);
  // delta wing: a thin slab running along the tank axis, offset outboard in -Z
  const wingSpan = tankR * 2.6;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(H * 0.22, H * 0.045, wingSpan), bodyMat);
  wing.position.set(0, H * 0.32, -tankR * 0.9);
  orb.add(wing);
  // tail fin: vertical stabiliser at the top of the fuselage
  const tail = new THREE.Mesh(new THREE.BoxGeometry(H * 0.13, tankR * 0.85, tankR * 0.14), bodyMat);
  tail.position.set(0, H * 0.42 + fusH * 0.42, -tankR * 0.55);
  tail.rotation.z = 0.12;
  orb.add(tail);
  // engine bells at the base of the fuselage (3 SSMEs)
  [0, 1, 2].forEach((i) => {
    const b = new THREE.Mesh(new THREE.ConeGeometry(tankR * 0.14, tankR * 0.42, 12, 1, true), tileMat);
    b.rotation.x = Math.PI;
    b.position.set(0, H * 0.42 - fusH / 2 - tankR * 0.18, (i - 1) * tankR * 0.34);
    orb.add(b);
  });
  // position the whole orbiter outboard of the tank, on the +Z side that the
  // default fleet camera (yaw pi/4) looks towards
  orb.position.set(0, 0, tankR + fusR * 1.05);
  g.add(orb);
  g.userData.noseTop = H * 0.9;
  return g;
}

/* ------------------------------------------------------------
   V-2 (A-4) — measured against the reference GLB (qa/ref-v2.glb,
   2 meshes / 321 verts, Y-up): H = 2.67 u, W = 0.48 u, H/W = 5.53.
   The reference profile holds a constant body radius up to ~28% of
   height and the fin/strake assembly broadens the base footprint,
   so the widest section is the tail.  Mapped onto the real
   14.03 m x 1.65 m vehicle (H/D = 8.5): constant-section body of
   12.5 m, a 1.5 m tapered ogive nose, four cruciform fins with
   strakes spanning 3.56 m at the tail, and the single A-4 motor
   nozzle at the base.
   ------------------------------------------------------------ */
function buildV2(r, visual) {
  const g = new THREE.Group();
  const H = r.height;                     // 14.0 m
  const R = (r.diameter || 1.65) / 2;     // 0.825 m
  const finR = R * 2.158;                 // fin tip radius: 1.78 m (3.56 m span)

  const hull = bandMat(visual.bodyColor || '#c9ccd1', 0.72, 0.3);
  const dark = bandMat('#222834', 0.8, 0.4);
  const steel = bandMat('#8f97a3', 0.9, 0.3);

  const nozH = H * 0.075;                   // A-4 nozzle, counted in the 14.0 m
  const bodyH = H * 0.893 - nozH;           // cylindrical section sits above the nozzle
  const noseH = H - bodyH - nozH;           // tapered nose completes the stack

  /* ---- A-4 motor nozzle, flush with the base ----
     The real 14.0 m height includes the nozzle; hanging it below y=0
     inflated the built height by 7.5%. */
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.27, R * 0.46, nozH, 24), steel);
  nozzle.position.y = nozH / 2;
  nozzle.name = 'engine';
  g.add(nozzle);

  /* ---- constant-section cylindrical body, stacked on the nozzle ---- */
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, bodyH, 40), hull);
  cyl.position.y = nozH + bodyH / 2;
  cyl.name = 'stage0';
  g.add(cyl);

  /* ---- tapered ogive nose ---- */
  const nose = new THREE.Mesh(latheFrom(ogiveProfile(R, noseH), 40), hull);
  nose.position.y = nozH + bodyH;
  nose.name = 'nose';
  g.add(nose);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(Math.max(R * 0.07, 0.045), 12, 12), dark);
  tip.position.y = nozH + bodyH + noseH;
  g.add(tip);

  /* ---- dark tail band and mid-body marking ---- */
  const tailBand = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.014, R * 1.014, H * 0.05, 40), dark);
  tailBand.position.y = nozH + H * 0.025;
  g.add(tailBand);
  const midBand = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.008, R * 1.008, H * 0.03, 40), dark);
  midBand.position.y = nozH + bodyH * 0.55;
  g.add(midBand);

  /* ---- four cruciform fins with strakes: 3.56 m span ----
     fin y-coordinates are heights above the nozzle top. */
  const finOut = finR - R;                // 0.955 m beyond the body wall
  const finT = 0.11;
  const finShape = new THREE.Shape();
  finShape.moveTo(0, H * 0.018);          // root, just above the tail band
  finShape.lineTo(finOut, H * 0.055);     // fin tip, near the base
  finShape.lineTo(finOut * 0.22, H * 0.145);  // strake tip — real V-2 fins reach ~14% of height
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: finT, bevelEnabled: false });
  finGeo.translate(0, 0, -finT / 2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(finGeo, dark);
    fin.position.set(Math.cos(a) * R, nozH, Math.sin(a) * R);
    fin.rotation.y = -a;
    fin.name = 'fin';
    g.add(fin);
  }

  g.userData.noseTop = nozH + bodyH + noseH;
  return g;
}

/* ------------------------------------------------------------
   R-7 family (Soyuz / Soyuz-2 / Sputnik 8K71PS) — based on the
   measured reference GLB "Soyuz TMA" by TwilightSparkleX (CC-BY-4.0).
   Real proportions: 46-49 m tall, core 2.95 m dia, four conical
   strap-on boosters ~19 m tall with rounded ogive tops, a narrow
   third stage, and a launch escape tower above the spacecraft.
   ------------------------------------------------------------ */
/* ------------------------------------------------------------
   Falcon 9 / Falcon Heavy — based on the measured reference GLB
   (Sketchfab "Falcon 9 - SpaceX" by Stanley Creative, CC-BY-4.0).
   Real proportions: 69.8 m tall, 3.7 m diameter, H/D ≈ 18.9.
   ------------------------------------------------------------ */
function buildFalcon9(r, visual) {
  const isHeavy = (r.id === 'falcon-heavy');
  const g = buildGeneric(r, {
    ...visual,
    finStyle: 'none',
    boosterCount: isHeavy ? 2 : 0,
    escTower: false,
    plumb: true,   // this builder places its own octaweb + legs from y=0
  });
  const H = r.height;
  const R = (r.diameter || 3.7) / 2;
  const dark = bandMat('#151a22', 0.45, 0.65);   // F9_Black
  const gridMat = bandMat('#1c1813', 0.25, 0.4); // F9_Grid_Fin (dark bronze-black)
  const legMat = bandMat('#2a2d33', 0.15, 0.9);  // Landing_Leg_Gray, very rough
  const steel = bandMat('#9aa1ac', 0.85, 0.3);   // Metal_White_Gold

  const s1 = (visual.stageHeights?.[0] ?? H * 0.68) / (visual.stageHeights?.reduce((a, b) => a + b, 0) ?? 1) * H;

  // Octaweb: black engine-ring plate at the base, 9 bells
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.004, R * 1.02, H * 0.012, 48), dark);
  plate.position.y = H * 0.006;
  g.add(plate);
  const bellR = R * 0.2;
  for (let ring = 0; ring < 2; ring++) {
    const rr = ring === 0 ? 0 : R * 0.58;
    const n = ring === 0 ? 1 : 8;
    for (let i = 0; i < n; i++) {
      const a = ring === 0 ? 0 : (i / n) * Math.PI * 2 + Math.PI / 8;
      const bell = new THREE.Mesh(new THREE.ConeGeometry(bellR, H * 0.022, 20, 1, true), steel);
      bell.rotation.x = Math.PI;
      bell.position.set(Math.cos(a) * rr, -H * 0.004, Math.sin(a) * rr);
      g.add(bell);
    }
  }

  // four landing legs, folded against the side of stage 1
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const grp = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(R * 0.5, H * 0.07, R * 0.09), legMat);
    arm.position.y = H * 0.035;
    grp.add(arm);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(R * 0.11, H * 0.11, R * 0.07), legMat);
    shin.position.set(R * 0.26, H * 0.035, 0);
    grp.add(shin);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.2, R * 0.2, R * 0.05, 12), dark);
    foot.position.set(R * 0.45, H * 0.035, 0);
    grp.add(foot);
    grp.position.set(Math.cos(a) * (R * 0.95), 0, Math.sin(a) * (R * 0.95));
    grp.rotation.y = -a;
    g.add(grp);
  }

  // four grid fins at the top of stage 1 (the F9 signature)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const grp = new THREE.Group();
    const fin = new THREE.Mesh(new THREE.BoxGeometry(R * 0.62, H * 0.055, R * 0.5), gridMat);
    fin.rotation.y = Math.PI / 4;
    grp.add(fin);
    // grille cells: two thin crossed plates read as a grid at this scale
    const cell = new THREE.Mesh(new THREE.BoxGeometry(R * 0.5, H * 0.06, R * 0.03), dark);
    cell.rotation.y = Math.PI / 4;
    grp.add(cell);
    const cell2 = new THREE.Mesh(new THREE.BoxGeometry(R * 0.5, H * 0.06, R * 0.03), dark);
    cell2.rotation.y = Math.PI / 4;
    cell2.position.x = R * 0.12;
    grp.add(cell2);
    grp.position.set(Math.cos(a) * (R * 1.02), s1 - H * 0.045, Math.sin(a) * (R * 1.02));
    grp.rotation.y = -a;
    g.add(grp);
  }

  // raceway: thin vertical conduit running the length of stage 1
  const race = new THREE.Mesh(new THREE.BoxGeometry(R * 0.035, s1 * 0.92, R * 0.09), dark);
  race.position.set(R * 0.99, s1 * 0.5, 0);
  g.add(race);

  // cold-gas thruster pods near the top of stage 1
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const pod = new THREE.Mesh(new THREE.BoxGeometry(R * 0.06, H * 0.035, R * 0.14), dark);
    pod.position.set(Math.cos(a) * R * 1.01, s1 - H * 0.11, Math.sin(a) * R * 1.01);
    pod.rotation.y = a;
    g.add(pod);
  }

  // dark interstage collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.004, R * 1.004, H * 0.02, 48), dark);
  collar.position.y = s1;
  g.add(collar);

  g.userData.noseTop = g.userData.noseTop || H;
  return g;
}

/* ------------------------------------------------------------
   Starship + Super Heavy — based on the measured reference GLB
   (Sketchfab "Starship+super heavy+falcon" by phongrit, CC-BY-4.0).
   121 m tall, 9 m dia. Reference measurements (1:1.21 scale):
   stage split at 50.9% of height, grid fins 49–54% extending to
   11 units wide against a 9-unit body, payload fairing top half,
   aft body flaps 82–93%.
   ------------------------------------------------------------ */
function buildStarship(r, visual) {
  const g = buildGeneric(r, {
    ...visual,
    finStyle: 'none',       // bespoke fins below — much larger than generic
    boosterCount: 0,
    escTower: false,
    engineBellStyle: 'raptor',
    plumb: true,            // bespoke base detail placed from y=0
  });
  const H = r.height;
  const R = (r.diameter || 9) / 2;
  const ship = bandMat(visual.bodyColor || '#b8bcc2', 0.72, 0.3);
  const dark = bandMat('#2b2f36', 0.8, 0.4);
  const steel = bandMat('#9aa1ac', 0.85, 0.3);

  // stage split: reference puts it at 50.9% of total height
  const s1 = H * 0.509;

  // ---- Super Heavy grid fins: 4 huge fins at the booster top,
  //      wider than the body (ref: 11 vs 9 units)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const grp = new THREE.Group();
    const finW = R * 0.85;
    const finH = R * 0.7;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(finW, finH, H * 0.02), dark);
    fin.rotation.y = Math.PI / 4;
    grp.add(fin);
    // grille cells
    for (let c = -1; c <= 1; c++) {
      const cell = new THREE.Mesh(new THREE.BoxGeometry(finW * 0.85, H * 0.014, H * 0.024), steel);
      cell.position.y = c * finH * 0.28;
      cell.rotation.y = Math.PI / 4;
      grp.add(cell);
    }
    grp.position.set(Math.cos(a) * (R * 1.06), s1 - H * 0.03, Math.sin(a) * (R * 1.06));
    grp.rotation.y = -a;
    g.add(grp);
  }

  // ---- Super Heavy aft fins: 4 smaller fixed fins near the base
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(new THREE.BoxGeometry(R * 0.42, H * 0.045, H * 0.02), dark);
    fin.position.set(Math.cos(a) * (R * 1.05), H * 0.055, Math.sin(a) * (R * 1.05));
    fin.rotation.y = -a;
    g.add(fin);
  }

  // ---- Ship body flaps: 4 actuated surfaces mid-ship (ref 82-93%)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const grp = new THREE.Group();
    const flap = new THREE.Mesh(new THREE.BoxGeometry(R * 0.5, H * 0.065, H * 0.022), dark);
    flap.rotation.y = Math.PI / 4;
    grp.add(flap);
    grp.position.set(Math.cos(a) * (R * 1.05), s1 + H * 0.30, Math.sin(a) * (R * 1.05));
    grp.rotation.y = -a;
    g.add(grp);
  }

  // ---- Ship forward flaps (ref 63-67%)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const flap = new THREE.Mesh(new THREE.BoxGeometry(R * 0.34, H * 0.05, H * 0.02), dark);
    flap.position.set(Math.cos(a) * (R * 1.04), s1 + H * 0.16, Math.sin(a) * (R * 1.04));
    flap.rotation.y = -a;
    g.add(flap);
  }

  // ---- 33 Raptor 3 bells: 3 rings (centre 1, ring 10, ring 22)
  const bellR = R * 0.085;
  const mkBell = (rr) => new THREE.Mesh(new THREE.ConeGeometry(bellR, H * 0.02, 16, 1, true), steel);
  const c = mkBell(0);
  c.rotation.x = Math.PI;
  c.position.y = -H * 0.002;
  g.add(c);
  for (const [ringR, n] of [[R * 0.34, 10], [R * 0.66, 22]]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const b = mkBell();
      b.rotation.x = Math.PI;
      b.position.set(Math.cos(a) * ringR, -H * 0.002, Math.sin(a) * ringR);
      g.add(b);
    }
  }

  // ---- Ship Raptors (vacuum-optimised, 6) on the top stage
  const bellR2 = R * 0.05;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 12;
    const b = new THREE.Mesh(new THREE.ConeGeometry(bellR2, H * 0.014, 14, 1, true), steel);
    b.rotation.x = Math.PI;
    b.position.set(Math.cos(a) * R * 0.28, s1 - H * 0.004, Math.sin(a) * R * 0.28);
    g.add(b);
  }

  // ---- dark interstage collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.004, R * 1.004, H * 0.014, 44), dark);
  collar.position.y = s1;
  g.add(collar);

  // ---- hot-staging ring: perforated interstage (real feature)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const port = new THREE.Mesh(new THREE.CircleGeometry(R * 0.045, 12), dark);
    port.position.set(Math.cos(a) * R * 0.94, s1 + H * 0.004, Math.sin(a) * R * 0.94);
    port.lookAt(port.position.x * 2, s1 + H * 0.004, port.position.z * 2);
    g.add(port);
  }

  return g;
}

/* ------------------------------------------------------------
   New Glenn — based on the measured reference GLB
   (qa/ref-newglenn.glb: 116 meshes / 114,721 verts, Y-up; body
   H = 17.93 u, W = 2.18 u, H/W = 10.25 — bare and very slender).
   Reference body profile: 7 m-diameter booster up to ~58% of
   height, a clean interstage step to a 5 m stage 2 (66–84% of
   the full model height), and a long ogive fairing 82→100%.
   Real stack: 98 m tall, 7 m booster + 5 m upper stage, 7× BE-4
   methalox on stage 1, 2× BE-3U hydrolox on stage 2, four wedge
   fins at the booster base, no strap-ons, no grid fins.
   ------------------------------------------------------------ */
function buildNewGlenn(r, visual) {
  const g = new THREE.Group();
  const H = r.height;
  const diams = (visual.stageDiameters || [r.diameter || 7, 5, 5]).slice();
  const R1 = diams[0] / 2;                          // booster radius (3.50 m)
  const R2 = ((diams[1] || diams[0] * 5 / 7)) / 2;  // upper-stage radius (2.50 m)

  const navy   = bandMat(visual.bodyColor || '#3f618d', 0.45, 0.42);
  const white  = bandMat('#e6e9ee', 0.5, 0.34);
  const dark   = bandMat('#1a212d', 0.7, 0.42);
  const steel  = bandMat('#9aa1ac', 0.9, 0.28);
  const accent = bandMat(visual.accent || '#f0f0ee', 0.45, 0.42);

  // heights normalise to the real stack height; the interstage transition
  // skirt is carved from the bottom of the stage-2 band
  const heights = (visual.stageHeights || [57, 20, 21]).slice();
  const scale = H / heights.reduce((a, b) => a + b, 0);
  const s1 = heights[0] * scale;              // booster cylinder
  const skirtH = clamp(heights[1] * scale * 0.14, 0.8, R1 * 1.2);  // 7 m -> 5 m step
  const s2 = heights[1] * scale - skirtH;     // stage 2 cylinder
  const fairH = heights[2] * scale;           // ogive fairing

  /* ---- stage 1: 7 m reusable booster ---- */
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(R1, R1, s1, 48), navy);
  b1.position.y = s1 / 2;
  b1.name = 'stage0';
  g.add(b1);

  // subtle boat-tail flare at the base
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(R1, R1 * 1.035, H * 0.02, 48), dark);
  tail.position.y = H * 0.01;
  g.add(tail);

  // white logo band high on S1 (Blue Origin livery)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R1 * 1.006, R1 * 1.006, s1 * 0.05, 48), accent);
  band.position.y = s1 * 0.86;
  g.add(band);

  // raceway conduit running down the booster side
  const race = new THREE.Mesh(new THREE.BoxGeometry(R1 * 0.05, s1 * 0.88, R1 * 0.1), dark);
  race.position.set(R1, s1 * 0.46, 0);
  g.add(race);

  /* ---- interstage transition skirt: the 7 m -> 5 m diameter step ---- */
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R2 * 1.015, R1 * 1.015, skirtH, 48), dark);
  skirt.position.y = s1 + skirtH / 2;
  skirt.name = 'interstage';
  g.add(skirt);

  /* ---- stage 2: 5 m cylinder ---- */
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(R2, R2, s2, 44), white);
  b2.position.y = s1 + skirtH + s2 / 2;
  b2.name = 'stage1';
  g.add(b2);

  // fairing separation ring
  const sep = new THREE.Mesh(new THREE.CylinderGeometry(R2 * 1.012, R2 * 1.012, Math.max(s2 * 0.03, 0.2), 44), dark);
  sep.position.y = s1 + skirtH + s2;
  g.add(sep);

  /* ---- long ogive payload fairing ---- */
  const fair = new THREE.Mesh(latheFrom(ogiveProfile(R2, fairH), 44), white);
  fair.position.y = s1 + skirtH + s2;
  fair.name = 'fairing';
  g.add(fair);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(Math.max(R2 * 0.06, 0.05), 12, 12), dark);
  tip.position.y = s1 + skirtH + s2 + fairH;
  g.add(tip);

  /* ---- 7 x BE-4 bells at the booster base: 1 centre + ring of 6 ---- */
  const bellR = R1 * 0.17;
  const bellH = H * 0.026;
  const bellY = H * 0.004 - bellH / 2;
  const mkBell = () => new THREE.Mesh(new THREE.ConeGeometry(bellR, bellH, 18, 1, true), steel);
  const centre = mkBell();
  centre.rotation.x = Math.PI;
  centre.position.y = bellY;
  centre.name = 'engine';
  g.add(centre);
  const ringR = R1 * 0.56;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 12;
    const b = mkBell();
    b.rotation.x = Math.PI;
    b.position.set(Math.cos(a) * ringR, bellY, Math.sin(a) * ringR);
    b.name = 'engine';
    g.add(b);
  }

  /* ---- 4 wedge fins at the booster base ---- */
  const finH = H * 0.095;
  const finOut = R1 * 0.5;
  const finT = R1 * 0.075;
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0, finH);
  finShape.lineTo(finOut, finH * 0.34);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: finT, bevelEnabled: false });
  finGeo.translate(0, 0, -finT / 2);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const fin = new THREE.Mesh(finGeo, dark);
    fin.position.set(Math.cos(a) * R1, 0, Math.sin(a) * R1);
    fin.rotation.y = -a;
    fin.name = 'fin';
    g.add(fin);
  }

  g.userData.noseTop = s1 + skirtH + s2 + fairH;
  return g;
}

/* ------------------------------------------------------------
   SLS Block 1 — based on the measured reference GLB (ref-sls.glb).
   The reference's meshes are internally rotated, so per-mesh world
   bounds are unreliable; only its *feature spans* (as a fraction of
   the 12.72-unit stack) are used, mapped onto the real 111.25 m
   vehicle. Reference spans and real dimensions:
     engine bay   0%   .. 8.7%    (4× RS-25 + 2× SRB nozzles)
     SRBs (pair)  6.1% .. 58.3%   two 3.7 m 5-segment solids, opposite sides
     core stage   8.7% .. 68.1%   8.4 m Shuttle-derived core (59.4% of H)
     ICPS         68.2% .. 73.9%  5 m Interim Cryogenic Propulsion Stage
     Orion        72.0% .. 81.9%  conical capsule + service module
     LAS tower    84.9% .. 100%   launch-abort spire on top
   ------------------------------------------------------------ */
function buildSLS(r, visual) {
  const g = new THREE.Group();
  const H = r.height;
  const coreR = (r.diameter || 8.4) / 2;
  const srbR = coreR * (3.7 / 8.4);    // two 5-segment SRBs, 3.7 m dia
  const icpsR = coreR * (5.0 / 8.4);   // ICPS upper stage, 5 m dia

  const hull = bandMat(visual.bodyColor || '#e8e6e0', 0.62, 0.38); // white core
  const srbMat = bandMat('#dfe4ec', 0.6, 0.4);                     // white solids
  const orange = bandMat(visual.accent || '#d4571f', 0.45, 0.5);   // ICPS / worm band
  const dark = bandMat('#232a38', 0.8, 0.4);
  const steel = bandMat('#9aa1ac', 0.85, 0.35);
  const towerMat = bandMat('#c8cedb', 0.7, 0.42);

  // feature spans as fractions of total stack height (ref-sls.glb profile)
  const Y = (k) => H * k;
  const coreBot = Y(0.087), coreTop = Y(0.681);   // 8.4 m core, 59.4% of H
  const srbBot = Y(0.061), srbTop = Y(0.583);     // 52.2% of H, both sides
  const icpsBot = Y(0.703), icpsTop = Y(0.739);   // 5 m ICPS
  const smBot = Y(0.739), smTop = Y(0.770);       // Orion service module
  const cmBot = Y(0.770), cmTop = Y(0.819);       // Orion capsule (conical)
  const bpcBot = Y(0.819), bpcTop = Y(0.849);     // boost protective cover
  const lasBot = Y(0.849), lasTop = Y(1.0);       // launch-abort tower

  /* ---------- two SRBs, attached on opposite sides of the core ---------- */
  const srbH = srbTop - srbBot;
  const srbX = coreR + srbR * 1.12;               // solids hug the core, leaving a visible seam
  [-1, 1].forEach((s) => {
    const sg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(srbR, srbR, srbH, 32), srbMat);
    body.position.y = srbBot + srbH / 2;
    sg.add(body);
    // forward closure: ogive cap above the cylinder
    const cap = new THREE.Mesh(latheFrom(ogiveProfile(srbR, srbR * 2.0), 32), srbMat);
    cap.position.y = srbTop;
    sg.add(cap);
    // aft nozzle reaching the pad
    const nz = new THREE.Mesh(new THREE.ConeGeometry(srbR * 0.85, srbBot, 20, 1, true), dark);
    nz.rotation.x = Math.PI;
    nz.position.y = srbBot / 2;
    sg.add(nz);
    // dark attach bands where the solid bolts to the core
    [0.07, 0.93].forEach((t) => {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(srbR * 1.02, srbR * 1.02, srbH * 0.05, 32), dark);
      band.position.y = srbBot + srbH * t;
      sg.add(band);
    });
    sg.position.x = s * srbX;
    sg.name = 'booster';
    g.add(sg);
  });

  /* ---------- core stage (8.4 m Shuttle tooling) ---------- */
  const coreH = coreTop - coreBot;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(coreR, coreR, coreH, 48), hull);
  core.position.y = coreBot + coreH / 2;
  core.name = 'stage0';
  g.add(core);
  // orange "NASA worm" band on the upper core
  const worm = new THREE.Mesh(new THREE.CylinderGeometry(coreR * 1.006, coreR * 1.006, coreH * 0.055, 48), orange);
  worm.position.y = coreBot + coreH * 0.78;
  g.add(worm);
  // dark SRB attach rings on the core (match the solids' band levels)
  [0.08, 0.93].forEach((t) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(coreR * 1.004, coreR * 1.004, coreH * 0.035, 48), dark);
    ring.position.y = coreBot + coreH * t;
    g.add(ring);
  });
  // 4× RS-25 bells in the engine bay under the core
  const bellR = coreR * 0.21;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bell = new THREE.Mesh(new THREE.ConeGeometry(bellR, coreBot * 0.9, 16, 1, true), steel);
    bell.rotation.x = Math.PI;
    bell.position.set(Math.cos(a) * coreR * 0.52, coreBot * 0.55, Math.sin(a) * coreR * 0.52);
    bell.name = 'engine';
    g.add(bell);
  }

  /* ---------- launch vehicle stage adapter: 8.4 m -> 5 m transition ---------- */
  const lvaH = icpsBot - coreTop;
  const lva = new THREE.Mesh(new THREE.CylinderGeometry(icpsR, coreR, lvaH, 44), dark);
  lva.position.y = coreTop + lvaH / 2;
  g.add(lva);

  /* ---------- ICPS upper stage (5 m, signature orange) ---------- */
  const icpsH = icpsTop - icpsBot;
  const icps = new THREE.Mesh(new THREE.CylinderGeometry(icpsR, icpsR, icpsH, 40), orange);
  icps.position.y = icpsBot + icpsH / 2;
  icps.name = 'stage1';
  g.add(icps);

  /* ---------- Orion spacecraft ---------- */
  const smH = smTop - smBot;
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(icpsR * 0.95, icpsR, smH, 36), steel);
  sm.position.y = smBot + smH / 2;
  g.add(sm);
  // conical capsule
  const cmH = cmTop - cmBot;
  const cm = new THREE.Mesh(new THREE.CylinderGeometry(icpsR * 0.36, icpsR * 0.98, cmH, 36), hull);
  cm.position.y = cmBot + cmH / 2;
  g.add(cm);
  // boost protective cover (shroud over the capsule)
  const bpcH = bpcTop - bpcBot;
  const bpc = new THREE.Mesh(new THREE.CylinderGeometry(icpsR * 0.4, icpsR * 0.46, bpcH, 28), dark);
  bpc.position.y = bpcBot + bpcH / 2;
  g.add(bpc);

  /* ---------- launch-abort tower: thin spire to the very top ---------- */
  const lasH = lasTop - lasBot;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, lasH * 0.82, 10), towerMat);
  mast.position.y = lasBot + lasH * 0.41;
  g.add(mast);
  // four lattice legs give the tower a truss silhouette
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, lasH * 0.76, 0.09), towerMat);
    leg.position.set(Math.cos(a) * 0.62, lasBot + lasH * 0.38, Math.sin(a) * 0.62);
    leg.rotation.y = a;
    g.add(leg);
    // cross braces
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.05, lasH * 0.3, 0.05), towerMat);
    brace.position.set(Math.cos(a) * 0.34, lasBot + lasH * 0.6, Math.sin(a) * 0.34);
    brace.rotation.y = a;
    g.add(brace);
  }
  // escape motor at the tip
  const esc = new THREE.Mesh(new THREE.ConeGeometry(0.34, H * 0.022, 16), orange);
  esc.position.y = lasTop - H * 0.011;
  g.add(esc);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), dark);
  tip.position.y = lasTop;
  g.add(tip);
  g.userData.noseTop = lasTop;
  return g;
}

/* ------------------------------------------------------------
   Vega-C — built from the measured reference GLB (qa/ref-vegac.glb):
   H = 172.21 units, W = 18.32 units, H/W = 9.40 at ~1:4.9 scale
   (1 unit ≈ 0.2 m, so 172 u ≈ 35 m — matches the real 34.8 m stack).
   Real vehicle: 34.8 m tall, 3.0 m diameter, H/D ≈ 11.6. Four stages
   — P120C, Zefiro-40, Zefiro-9 and the AVUM kick stage — all ~3 m
   diameter, capped by a long ogive payload fairing; no fins and no
   strap-on boosters.
   Stage boundaries from the reference part list (fractions of total
   height): S1 0–39.8 · S2 39.8–62.5 · S3 62.5–72.4 · AVUM 72.4–77.1 ·
   fairing 77.1–100. (The printed "max radius" profile in
   qa/prof-vegac.txt is offset — the model's axis sits at x ≈ −47 —
   so the part list, not the radius profile, drives the proportions.)
   ------------------------------------------------------------ */
function buildVegaC(r, visual) {
  const g = new THREE.Group();
  const H = r.height;
  const R = (r.diameter || 3.0) / 2;

  const body = bandMat(visual.bodyColor || '#e8e8e6', 0.6, 0.32);
  const dark = bandMat('#1c1c1c', 0.45, 0.65);
  const gold = bandMat(visual.accent || '#c9a15e', 0.55, 0.45);
  const steel = bandMat('#b8bdc6', 0.7, 0.35);

  // reference stage fractions + diametres, both scaled to the spec
  const hs = (visual.stageHeights || [0.398, 0.227, 0.099, 0.047, 0.229]).slice();
  const ds = (visual.stageDiameters || [3.0, 2.98, 2.94, 2.6, 2.8]).slice();
  const k = H / hs.reduce((a, b) => a + b, 0);
  const hts = hs.map((h) => h * k);
  const dScale = (R * 2) / ds[0];
  const rads = ds.map((d) => (d * dScale) / 2);

  const bandH = H * 0.016;   // interstage adapter ring height
  const nozH = H * 0.028;    // upper-stage nozzle, tip peeks below the ring

  // ---- S1..S3: constant-diameter solids; each stage boundary carries a
  //      dark interstage ring with the upper-stage nozzle hanging below it.
  //      The stage body stops short of the ring so the nozzle tip reads.
  let y = 0;
  for (let i = 0; i < 3; i++) {
    const h = hts[i];
    const rad = rads[i];
    const radNext = rads[i + 1];
    const ringR = Math.max(rad, radNext) * 1.025;

    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, h - nozH, 48), body);
    cyl.position.y = y + (h - nozH) / 2;
    cyl.name = `stage${i}`;
    g.add(cyl);

    const ring = new THREE.Mesh(new THREE.CylinderGeometry(ringR, ringR, bandH, 48), dark);
    ring.position.y = y + h - bandH / 2;
    g.add(ring);

    const noz = new THREE.Mesh(new THREE.ConeGeometry(radNext * 0.5, nozH, 24, 1, true), dark);
    noz.rotation.x = Math.PI;
    noz.position.y = y + h - nozH / 2;
    g.add(noz);

    y += h;
  }

  // ---- AVUM kick stage: short section with its gold thermal band ----
  const hA = hts[3];
  const rA = rads[3];
  const avum = new THREE.Mesh(new THREE.CylinderGeometry(rA, rA, hA, 40), body);
  avum.position.y = y + hA / 2;
  avum.name = 'stage3';
  g.add(avum);
  const avumGold = new THREE.Mesh(new THREE.CylinderGeometry(rA * 1.018, rA * 1.018, hA * 0.6, 40), gold);
  avumGold.position.y = y + hA / 2;
  g.add(avumGold);
  y += hA;

  // ---- long ogive payload fairing (ref: 77.1%–100% of height) ----
  const fH = hts[4];
  const fR = rads[4];
  const fRing = new THREE.Mesh(new THREE.CylinderGeometry(fR * 1.03, fR * 1.03, H * 0.012, 48), dark);
  fRing.position.y = y - H * 0.006;
  g.add(fRing);
  const fair = new THREE.Mesh(latheFrom(ogiveProfile(fR, fH), 48), body);
  fair.position.y = y;
  fair.name = 'fairing';
  g.add(fair);
  const fTip = new THREE.Mesh(new THREE.SphereGeometry(Math.max(fR * 0.07, 0.05), 14, 14), steel);
  fTip.position.y = y + fH;
  g.add(fTip);
  g.userData.noseTop = y + fH;

  // ---- P120C base: flared aft skirt + big diverging nozzle ----
  const bR = rads[0];
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(bR * 0.98, bR * 1.07, H * 0.035, 40), dark);
  skirt.position.y = H * 0.0175;
  g.add(skirt);
  const pNoz = new THREE.Mesh(new THREE.CylinderGeometry(bR * 0.5, bR * 0.82, H * 0.04, 32, 1, true), dark);
  pNoz.position.y = -H * 0.01;
  g.add(pNoz);

  // ---- livery: P120C roll-pattern bands + a gold ring at the logo line ----
  [0.13, 0.3].forEach((f) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(bR * 1.008, bR * 1.008, H * 0.007, 48), dark);
    b.position.y = hts[0] * f;
    g.add(b);
  });
  const logo = new THREE.Mesh(new THREE.CylinderGeometry(bR * 1.012, bR * 1.012, H * 0.011, 48), gold);
  logo.position.y = hts[0] * 0.82;
  g.add(logo);

  return g;
}

/* ------------------------------------------------------------
   R-7 family (Soyuz / Soyuz-2 / Sputnik 8K71PS) — based on the
   measured reference GLB "Soyuz TMA" by TwilightSparkleX (CC-BY-4.0).
   Real proportions: 46-49 m tall, core 2.95 m dia, four conical
   strap-on boosters ~19 m tall with rounded ogive tops, a narrow
   third stage, and a launch escape tower above the spacecraft.
   ------------------------------------------------------------ */
function buildSoyuz(r, visual) {
  const g = new THREE.Group();
  const H = r.height;
  const R = r.diameter / 2;
  const body = bandMat('#e4e8ee', 0.62, 0.32);
  const green = bandMat(visual.accent || '#4c7a3f', 0.45, 0.55);
  const dark = bandMat('#1d2330', 0.6, 0.5);
  const steel = bandMat('#9aa1ac', 0.9, 0.28);
  const grey = bandMat('#b8bdc6', 0.5, 0.55);

  // core stage: the long central cylinder (~72% of height)
  const coreH = H * 0.72;
  const core = new THREE.Mesh(new THREE.CylinderGeometry(R, R, coreH, 40), body);
  core.position.y = coreH / 2;
  core.name = 'stage0';
  g.add(core);
  // hammerhead: the core widens slightly below the third stage joint
  const joint = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.06, R * 1.0, H * 0.018, 40), dark);
  joint.position.y = coreH;
  g.add(joint);

  // third stage: narrower cylinder above the core
  const s3H = H * 0.13;
  const s3R = R * 0.72;
  const s3 = new THREE.Mesh(new THREE.CylinderGeometry(s3R, s3R, s3H, 36), body);
  s3.position.y = coreH + s3H / 2;
  s3.name = 'stage1';
  g.add(s3);
  // third-stage engine bell hanging below the joint, into the core
  const nz = new THREE.Mesh(new THREE.ConeGeometry(s3R * 0.42, H * 0.03, 24, 1, true), dark);
  nz.rotation.x = Math.PI;
  nz.position.y = coreH + H * 0.006;
  g.add(nz);

  // spacecraft shroud + escape tower
  const scH = H * 0.08;
  const scR = R * 0.55;
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(scR, scR * 0.9, scH, 32), grey);
  shroud.position.y = coreH + s3H + scH / 2;
  g.add(shroud);
  // escape tower: only the crewed Soyuz carries the launch-abort mast.
  // Sputnik 8K71PS and R-7 topped their stack with a bare nose cone instead.
  const towered = r.id !== 'sputnik-8k71ps' && r.id !== 'r-7';
  if (towered) {
    const towerH = H * 0.07;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.035, R * 0.045, towerH, 12), dark);
    tower.position.y = coreH + s3H + scH + towerH / 2;
    g.add(tower);
    const wt = new THREE.Mesh(new THREE.SphereGeometry(R * 0.06, 14, 14), dark);
    wt.position.y = coreH + s3H + scH + towerH;
    g.add(wt);
    g.userData.noseTop = coreH + s3H + scH + towerH;
  } else {
    // bare ogive nose cone over the spacecraft shroud
    const coneH = H * 0.055;
    const cone = new THREE.Mesh(latheFrom(ogiveProfile(scR * 1.02, coneH), 32), grey);
    cone.position.y = coreH + s3H + scH;
    g.add(cone);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(Math.max(R * 0.05, 0.05), 12, 12), dark);
    tip.position.y = coreH + s3H + scH + coneH;
    g.add(tip);
    g.userData.noseTop = coreH + s3H + scH + coneH;
  }

  // four conical strap-on boosters with the R-7 family's signature rounded
  // ogive tops. Real geometry: each booster is ~1.5 m dia, bolted outboard of
  // the 2.95 m core, giving a ~10 m overall span; they reach the top of core.
  const bR = R * 0.5;
  const bH = coreH * 0.94;
  const bTop = bH + bR * 1.05; // ogive cap sits above the booster
  const bRing = R + bR;        // booster centres on this circle: outer edge at R + 2*bR
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = Math.cos(a) * bRing;
    const z = Math.sin(a) * bRing;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(bR * 0.52, bR, bH, 26), grey);
    b.position.set(x, bH / 2, z);
    b.name = 'booster' + i;
    g.add(b);
    const cap = new THREE.Mesh(latheFrom(ogiveProfile(bR * 0.52, bR * 1.05), 26), grey);
    cap.position.set(x, bH, z);
    g.add(cap);
    // booster engine bell
    const bnz = new THREE.Mesh(new THREE.ConeGeometry(bR * 0.42, H * 0.022, 18, 1, true), dark);
    bnz.rotation.x = Math.PI;
    bnz.position.set(x, -H * 0.008, z);
    g.add(bnz);
  }
  const boostTop = bTop;

  // core engine cluster: 5 bells (RD-108 style centre + 4 verniers)
  addEngines(g, 5, 0, R * 0.52, 0.75, dark);

  // green accent band low on the core (Soyuz livery)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.008, R * 1.008, coreH * 0.028, 40), green);
  band.position.y = coreH * 0.16;
  g.add(band);

  // raceway conduits down the core
  for (let i = 0; i < 2; i++) {
    const a = (i / 2) * Math.PI * 2 + Math.PI / 2;
    const race = new THREE.Mesh(new THREE.BoxGeometry(R * 0.05, coreH * 0.7, R * 0.09), dark);
    race.position.set(Math.cos(a) * R * 0.99, coreH * 0.45, Math.sin(a) * R * 0.99);
    g.add(race);
  }

  // R-7 signature: four wide aerodynamic stabiliser fins at the base, spanning
  // the full vehicle width (~10.3 m on the real rocket) between boosters
  const finR = R * 3.5;                // tip radius ~5.2 m -> 10.4 m span
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;   // aligned with the boosters' diagonals
    const finShape = new THREE.Shape();
    finShape.moveTo(0, H * 0.015);
    finShape.lineTo(finR, H * 0.035);
    finShape.lineTo(finR * 0.55, H * 0.17);
    finShape.closePath();
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: R * 0.09, bevelEnabled: false });
    finGeo.translate(0, 0, -R * 0.045);
    const fin = new THREE.Mesh(finGeo, dark);
    fin.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
    fin.rotation.y = -a;
    fin.name = 'fin';
    g.add(fin);
  }

  g.userData.noseTop = Math.max(g.userData.noseTop || 0, boostTop);
  return g;
}

const BUILDERS = {
  'saturn-v': buildSaturnV,
  'space-shuttle': buildShuttle,
  'sts': buildShuttle,
  'v-2': buildV2,
  'sputnik-8k71ps': buildSoyuz,
  'soyuz-2-1b': buildSoyuz,
  'r-7': buildSoyuz,
  'soyuz': buildSoyuz,
  'falcon-9-block-5': buildFalcon9,
  'falcon-heavy': buildFalcon9,
  'starship-super-heavy': buildStarship,
  'new-glenn': buildNewGlenn,
  'sls-block-1': buildSLS,
  'vega-c': buildVegaC,
};

export function buildRocket(r, visual) {
  const v = visual || r.visual || {};
  const builder = BUILDERS[r.id];
  const g = builder ? builder(r, v) : buildGeneric(r, v);
  g.userData.height = r.height;
  g.userData.spec = r;
  g.userData.radius = (r.diameter || 4) / 2;
  // real swept extent incl. boosters / wings / towers, for framing
  const box = new THREE.Box3().setFromObject(g);
  g.userData.sweep = Math.max(
    (box.max.x - box.min.x) / 2,
    (box.max.z - box.min.z) / 2,
    g.userData.radius * 0.5,
  );
  g.userData.height2 = Math.max(box.max.y - box.min.y, 1);
  // shadow-catcher disc
  return g;
}

/* ============================================================
   FLEET STAGE CONTROLLER
   ============================================================ */
export function initFleet(canvas, stageEl, onRuler) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 4000);

  // soft studio environment
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const grad = new THREE.Mesh(
    new THREE.SphereGeometry(120, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vP;
        void main(){
          float y = normalize(vP).y * 0.5 + 0.5;
          vec3 top = vec3(0.05,0.08,0.14);
          vec3 mid = vec3(0.12,0.15,0.22);
          vec3 bot = vec3(0.30,0.16,0.09);
          vec3 c = y > 0.5 ? mix(mid, top, smoothstep(0.5,1.0,y)) : mix(bot, mid, smoothstep(0.0,0.5,y));
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    }),
  );
  envScene.add(grad);
  const envTex = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envTex;

  // lights
  scene.add(new THREE.AmbientLight('#55607a', 0.9));
  const key = new THREE.DirectionalLight('#fff4e8', 2.1);
  key.position.set(-16, 22, 14);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#6fb8ff', 1.6);
  rim.position.set(18, 8, -16);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#ff8a45', 0.9);
  fill.position.set(6, -8, 12);
  scene.add(fill);
  const top = new THREE.PointLight('#ffffff', 24, 120, 1.6);
  top.position.set(0, 40, 8);
  scene.add(top);

  // ground glow disc
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(60, 64),
    new THREE.MeshBasicMaterial({
      color: '#ff6a2a', transparent: true, opacity: 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.05;
  scene.add(disc);
  const grid = new THREE.GridHelper(120, 24, '#1b2334', '#111827');
  grid.position.y = -0.06;
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  /* ---------- rig ---------- */
  const rig = { yaw: Math.PI * 0.25, pitch: 0.12, dist: 60, targetYaw: Math.PI * 0.25, targetPitch: 0.12, targetDist: 60 };
  const look = new THREE.Vector3(0, 30, 0);
  let autoRotate = true;
  let idleTimer = 0;

  function applyCamera() {
    const p = new THREE.Vector3(
      Math.cos(rig.yaw) * Math.cos(rig.pitch) * rig.dist,
      Math.sin(rig.pitch) * rig.dist + look.y * 0.0,
      Math.sin(rig.yaw) * Math.cos(rig.pitch) * rig.dist,
    );
    camera.position.copy(p).add(new THREE.Vector3(0, look.y, 0));
    camera.lookAt(0, look.y, 0);
  }

  /* ---------- content ---------- */
  const content = new THREE.Group();
  scene.add(content);
  const shadows = [];
  let current = null;
  let lastFrame = null; // {H, sweep} of the most recent framing, for reset

  function clearContent() {
    while (content.children.length) {
      const c = content.children.pop();
      c.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); }
      });
    }
  }

  function shadowFor(g, height, radius) {
    // simple soft shadow: flattened dark ellipse scaled to rocket footprint
    const s = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(radius * 2.4, 3), 48),
      new THREE.MeshBasicMaterial({ color: '#000309', transparent: true, opacity: 0.55, depthWrite: false }),
    );
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.02;
    s.renderOrder = 1;
    return s;
  }

  /* billboard aura: camera-facing halo that fills the stage with atmosphere
     and keeps the vehicle reading as the subject from every orbit angle */
  let _auraTex = null;
  function auraTexture() {
    if (_auraTex) return _auraTex;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 512;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0.0, 'rgba(95,227,255,0.00)');
    g.addColorStop(0.30, 'rgba(95,227,255,0.14)');
    g.addColorStop(0.62, 'rgba(255,150,70,0.20)');
    g.addColorStop(0.86, 'rgba(255,90,31,0.38)');
    g.addColorStop(1.0, 'rgba(255,90,31,0.10)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 512);
    // soft horizontal falloff so the edges never harden
    x.globalCompositeOperation = 'destination-in';
    const h = x.createLinearGradient(0, 0, 128, 0);
    h.addColorStop(0, 'rgba(0,0,0,0)');
    h.addColorStop(0.5, 'rgba(0,0,0,1)');
    h.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = h;
    x.fillRect(0, 0, 128, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _auraTex = tex;
    return tex;
  }

  function auraFor(height, sweep) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: auraTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.68,
    }));
    sp.scale.set(Math.max(sweep * 5.6, height * 0.2), height * 1.16, 1);
    sp.position.set(0, height * 0.52, 0);
    sp.renderOrder = -1;
    sp.name = 'aura';
    return sp;
  }

  /* slow rising embers around the pad */
  let _dustTex = null;
  function dustFor(height, sweep) {
    if (!_dustTex) {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 32;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,190,130,1)');
      g.addColorStop(0.4, 'rgba(255,120,60,0.5)');
      g.addColorStop(1, 'rgba(255,90,31,0)');
      x.fillStyle = g; x.fillRect(0, 0, 32, 32);
      _dustTex = new THREE.CanvasTexture(c);
    }
    const n = 90;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    const rand = rng(0x9e3779b9);
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const rr = sweep * (0.6 + rand() * 2.6);
      pos[i * 3] = Math.cos(a) * rr;
      pos[i * 3 + 1] = rand() * height * 0.9;
      pos[i * 3 + 2] = Math.sin(a) * rr;
      seed[i] = rand();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.PointsMaterial({
      map: _dustTex,
      size: Math.max(height * 0.011, 0.6),
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.name = 'dust';
    pts.userData.height = height;
    return pts;
  }

  /* ---------- framing: fit both the height AND the width ---------- */
  function frameDist(cam, H, radius) {
    const fovRad = (cam.fov * Math.PI) / 180;
    const aspect = Math.max(cam.aspect || 1, 0.45);
    const vFov = fovRad / (aspect > 1 ? 1 : 1.35);
    const hFov = 2 * Math.atan(Math.tan(fovRad / 2) * aspect);
    // vertical: rocket occupies ~86% of the frame height
    const fitH = (H * 0.58) / Math.tan(vFov / 2);
    // horizontal: full swept width incl. boosters, with 30% air
    const fitW = ((radius || 2) * 2 * 1.3) / Math.tan(hFov / 2);
    return Math.max(fitH, fitW, 9);
  }
  /* project the loaded vehicle's base and tip to stage-relative pixels so the
     HTML ruler can be drawn at exactly the model's scale */
  function pairInfo(g) {
    if (!g) return null;
    const sh = canvas.clientHeight || 1;
    const bb = new THREE.Box3().setFromObject(g);
    const projectY = (worldY) => {
      const v = new THREE.Vector3(0, worldY, 0).project(camera);
      return sh * (1 - v.y) / 2;
    };
    return { noseY: projectY(bb.max.y), baseY: projectY(bb.min.y) };
  }

  function fitSingle(r, visual) {    clearContent();
    const g = buildRocket(r, visual);
    /* Some builders add engine bells or skirts that reach below the base
       (Saturn V F-1s, Shuttle SRB nozzles). Rescale the whole stack so its
       REAL base-to-tip span equals the declared height, then sit it on the
       pad. Without this the vehicle is taller than spec and the bells punch
       through the ground; the ruler then lies about both ends. */
    const target = r.height > 0 ? r.height : (g.userData.height2 || r.height);
    const bb = new THREE.Box3().setFromObject(g);
    const realH = bb.max.y - bb.min.y;
    if (realH > target * 1.001) g.scale.setScalar(target / realH);
    // offset AFTER scaling so the base lands exactly on y = 0
    const bb2 = new THREE.Box3().setFromObject(g);
    if (bb2.min.y < 0) g.position.y = -bb2.min.y;
    content.add(g);
    const sh = shadowFor(g, r.height, g.userData.radius);
    content.add(sh);
    current = g;
    // frame and rule against the DECLARED height, matching the rescale above,
    // so the ruler and the model always agree
    const H = target;
    const sweep = g.userData.sweep || g.userData.radius;
    content.add(auraFor(H, sweep));
    content.add(dustFor(H, sweep));
    look.set(0, H * 0.5, 0);
    const dist = frameDist(camera, H, sweep);
    lastFrame = { H, sweep };
    rig.targetDist = dist;
    rig.dist = rig.targetDist;
    rig.targetYaw = Math.PI * 0.22;
    rig.yaw = rig.targetYaw;
    rig.targetPitch = 0.1;
    applyCamera();
    // ruler ticks are positioned from the model's own projection, so the
    // ruler and the vehicle can never disagree about scale
    const proj = pairInfo(g);
    if (onRuler) onRuler(H, proj);
    // entrance pop — multiplies the fit scale rather than replacing it, so
    // the base-to-tip rescale above survives the animation
    const baseScale = g.scale.x;
    g.scale.setScalar(baseScale * 0.92);
    const t0 = performance.now();
    (function pop() {
      const t = Math.min((performance.now() - t0) / 520, 1);
      const e = 1 - Math.pow(1 - t, 3);
      g.scale.setScalar(baseScale * (0.92 + 0.08 * e));
      if (t < 1) requestAnimationFrame(pop);
    })();
  }

  function fitPair(ra, va, rb, vb) {
    clearContent();
    const ga = buildRocket(ra, va);
    const gb = buildRocket(rb, vb);
    // sit both on the pad, rescaled to their declared heights (see fitSingle)
    for (const g of [ga, gb]) {
      const spec = g === ga ? ra.height : rb.height;
      const target = spec > 0 ? spec : (g.userData.height2 || spec);
      const bb = new THREE.Box3().setFromObject(g);
      const realH = bb.max.y - bb.min.y;
      if (realH > target * 1.001) g.scale.setScalar(target / realH);
      const bb2 = new THREE.Box3().setFromObject(g);
      if (bb2.min.y < 0) g.position.y = -bb2.min.y;
    }
    const maxR = Math.max(ra.diameter || 4, rb.diameter || 4) / 2;
    const H = Math.max(ra.height, rb.height);
    // separate by a fraction of the taller rocket so both are clearly readable
    const sep = Math.max(maxR * 3.1, H * 0.34);
    ga.position.x = -sep / 2;
    gb.position.x = sep / 2;
    content.add(ga, gb);
    content.add(shadowFor(ga, ra.height, ga.userData.radius));
    content.add(shadowFor(gb, rb.height, gb.userData.radius));
    current = null;
    content.add(auraFor(H, Math.max(ga.userData.sweep || 2, gb.userData.sweep || 2)));
    look.set(0, H * 0.5, 0);
    rig.targetDist = frameDist(camera, H, sep * 0.72) * 1.06;
    lastFrame = { H, sweep: sep * 0.72 };
    rig.dist = rig.targetDist;
    rig.targetYaw = Math.PI * 0.5;
    rig.yaw = rig.targetYaw;
    rig.targetPitch = 0.12;
    applyCamera();
    lastFrame = { H, sweep: sep * 0.72, pairProj: pairInfo(ga) };
    if (onRuler) onRuler(H, { a: ra, b: rb, proj: pairInfo(ga) });
  }

  /* ---------- interaction ---------- */
  let dragging = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    autoRotate = false; idleTimer = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    rig.targetYaw -= dx * 0.006;
    rig.targetPitch = clamp(rig.targetPitch + dy * 0.004, -0.35, 0.85);
  });
  const endDrag = () => { dragging = false; idleTimer = 0; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    rig.targetDist = clamp(rig.targetDist * (1 + e.deltaY * 0.0012), 8, 900);
    autoRotate = false; idleTimer = 0;
  }, { passive: false });

  function resetView() {
    if (current) {
      const r = current.userData.spec;
      const H = r.height > 0 ? r.height : (current.userData.height2 || r.height);
      const sweep = current.userData.sweep || current.userData.radius;
      look.set(0, H * 0.5, 0);
      rig.targetDist = frameDist(camera, H, sweep);
      lastFrame = { H, sweep };
    } else if (lastFrame) {
      look.set(0, lastFrame.H * 0.5, 0);
      rig.targetDist = frameDist(camera, lastFrame.H, lastFrame.sweep) * 1.06;
    }
    rig.targetYaw = current ? Math.PI * 0.22 : Math.PI * 0.5;
    rig.targetPitch = current ? 0.1 : 0.12;
    rig.dist = rig.targetDist;
    autoRotate = true;
    applyCamera();
  }

  /* ---------- resize ---------- */
  function resize() {
    const w = stageEl.clientWidth || 800;
    const h = stageEl.clientHeight || 600;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stageEl);
  resize();

  /* ---------- visibility ----------
     Gate the render loop on the stage being onscreen. Two heavy WebGL
     scenes run on this page; rendering either one while it is scrolled
     out of view is pure wasted GPU work. dt is clamped below, so
     returning after a long absence never produces a visual jump. */
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(stageEl);
  }

  /* keep the HTML ruler locked to the model: the camera orbits continuously,
     so a ruler drawn once at load drifts out of sync within a second */
  let lastRulerAt = 0;
  function refreshRuler() {
    if (!onRuler || !lastFrame) return;
    if (performance.now() - lastRulerAt < 90) return; // throttle to ~11 Hz
    lastRulerAt = performance.now();
    const g = current;
    if (g) onRuler(lastFrame.H, pairInfo(g));
    else if (lastFrame.pairProj) onRuler(lastFrame.H, { proj: lastFrame.pairProj });
  }

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  function tick() {
    if (!visible) { requestAnimationFrame(tick); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!dragging) {
      idleTimer += dt;
      if (idleTimer > 3.5) autoRotate = true;
    }
    if (autoRotate) rig.targetYaw += dt * 0.12;
    const yawed = Math.abs(rig.targetYaw - rig.yaw) > 1e-4;
    rig.yaw = damp(rig.yaw, rig.targetYaw, 4, dt);
    rig.pitch = damp(rig.pitch, rig.targetPitch, 4, dt);
    rig.dist = damp(rig.dist, rig.targetDist, 4, dt);
    applyCamera();
    if (autoRotate || yawed || dragging) refreshRuler();
    // drift the embers upward, looping at the vehicle's height
    content.traverse((o) => {
      if (o.name !== 'dust') return;
      const arr = o.geometry.attributes.position.array;
      const h = o.userData.height;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += dt * (0.6 + ((i * 0.37) % 1) * 0.9);
        if (arr[i + 1] > h) arr[i + 1] = 0;
      }
      o.geometry.attributes.position.needsUpdate = true;
    });
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  return { fitSingle, fitPair, resetView, resize, get current() { return current; } };
}
