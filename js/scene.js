/* ============================================================
   MACH 25 — HERO SCENE
   A launch stack on the pad, seen from low angle against
   a starfield with Earth's limb below. Built in Three.js.
   ============================================================ */
import * as THREE from 'three';
import { sizes, reducedMotion, rng, damp } from './utils.js';

const R = rng(20260927);

export function initHero(canvas) {
  /* ---------------- renderer ---------------- */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(sizes.dpr);
  renderer.setSize(sizes.w, sizes.h, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04060c');
  scene.fog = new THREE.FogExp2('#04060c', 0.022);

  const camera = new THREE.PerspectiveCamera(42, sizes.w / sizes.h, 0.1, 1200);
  const camBase = new THREE.Vector3(13, 7.5, 15);
  camera.position.copy(camBase);
  camera.lookAt(0, 9, 0);

  /* ---------------- starfield ---------------- */
  function makeStars(count, radius, size, opacity) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const v = new THREE.Vector3()
        .randomDirection()
        .multiplyScalar(radius * (0.35 + R() * 0.65));
      if (v.y < 2) v.y = 2 + R() * 4; // keep stars above horizon
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
      const t = R();
      col[i * 3] = 0.75 + t * 0.25;
      col[i * 3 + 1] = 0.8 + t * 0.2;
      col[i * 3 + 2] = 0.95 - t * 0.2;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      size, sizeAttenuation: true, vertexColors: true,
      transparent: true, opacity, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return new THREE.Points(g, m);
  }
  const starsFar = makeStars(3200, 420, 1.5, 0.85);
  const starsNear = makeStars(1200, 180, 2.6, 0.5);
  scene.add(starsFar, starsNear);

  /* ---------------- Earth limb + atmosphere ---------------- */
  const limbGeom = new THREE.PlaneGeometry(900, 500);
  const limbMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uHorizon: { value: new THREE.Color('#7fd3ff') },
      uGlow: { value: new THREE.Color('#2b6ea8') },
      uGround: { value: new THREE.Color('#05070d') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uGround;
      // pseudo-noise for cloud-ish banding along the horizon
      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      void main(){
        float y = vUv.y;
        float h = smoothstep(0.44, 0.5, y);               // horizon line
        float glow = smoothstep(0.35, 0.5, y) * (1.0 - smoothstep(0.5, 0.72, y));
        float ground = 1.0 - smoothstep(0.42, 0.52, y);
        float band = 0.85 + 0.15 * hash(vec2(floor(vUv.x*220.0), 1.0));
        vec3 col = uGround * ground;
        col += uHorizon * h * 1.5 * band;
        col += uGlow * glow * 0.9;
        // soft terminator shimmer
        float alpha = max(h*band, glow*0.55) + ground*0.35;
        gl_FragColor = vec4(col, clamp(alpha,0.0,1.0));
      }
    `,
  });
  const limb = new THREE.Mesh(limbGeom, limbMat);
  limb.position.set(0, -95, -160);
  limb.rotation.x = -Math.PI * 0.42;
  scene.add(limb);

  /* ---------------- launch pad ---------------- */
  const padMat = new THREE.MeshStandardMaterial({ color: '#151a26', metalness: 0.85, roughness: 0.45 });
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(9, 10.5, 1.4, 48), padMat);
  pad.position.y = -0.7;
  scene.add(pad);

  const padRing = new THREE.Mesh(
    new THREE.RingGeometry(7.4, 8.1, 64),
    new THREE.MeshBasicMaterial({ color: '#ff7a3d', transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = 0.02;
  scene.add(padRing);

  // pad towers
  const towerMat = new THREE.MeshStandardMaterial({ color: '#202736', metalness: 0.9, roughness: 0.35 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.7, 22, 0.7), towerMat);
    t.position.set(Math.cos(a) * 8.5, 11, Math.sin(a) * 8.5);
    scene.add(t);
    // aviation lights
    const lt = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff4d4d' : '#5fe3ff' }),
    );
    lt.position.set(Math.cos(a) * 8.5, 22.2, Math.sin(a) * 8.5);
    lt.userData.blink = i * 0.7;
    scene.add(lt);
  }

  /* ---------------- rocket stack (stylized) ---------------- */
  const metal = new THREE.MeshStandardMaterial({
    color: '#dfe4ec', metalness: 0.72, roughness: 0.28,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: '#aeb6c4', metalness: 0.85, roughness: 0.42,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: '#2a3140', metalness: 0.8, roughness: 0.4,
  });

  const rocket = new THREE.Group();

  // --- Super Heavy booster ---
  const booster = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 9.2, 48), metal);
  booster.position.y = 4.6;
  rocket.add(booster);

  // booster base engine section (slightly flared)
  const bBase = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.45, 1.1, 48), steel);
  bBase.position.y = 0.55;
  rocket.add(bBase);

  // grid fins
  for (let i = 0; i < 4; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 0.22), dark);
    fin.position.set(Math.cos(i * Math.PI / 2) * 2.05, 8.6, Math.sin(i * Math.PI / 2) * 2.05);
    fin.rotation.y = i * Math.PI / 2;
    fin.rotation.z = Math.PI / 4;
    rocket.add(fin);
  }

  // hot-stage ring
  const hsRing = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.55, 0.55, 48), dark);
  hsRing.position.y = 9.55;
  rocket.add(hsRing);

  // --- Starship upper stage ---
  const shipBody = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 4.2, 48), metal);
  shipBody.position.y = 11.9;
  rocket.add(shipBody);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 2.6, 48), metal);
  nose.position.y = 15.3;
  rocket.add(nose);
  // nose tip
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), dark);
  tip.position.y = 16.6;
  rocket.add(tip);

  // flaps (front + rear pairs)
  const flapMat = new THREE.MeshStandardMaterial({ color: '#c6ccd8', metalness: 0.7, roughness: 0.35 });
  const flaps = [
    { y: 14.9, z: 1.55, w: 0.5, d: 1.9, rx: 0.28 },
    { y: 14.9, z: -1.55, w: 0.5, d: 1.9, rx: -0.28 },
    { y: 10.3, z: 1.55, w: 0.5, d: 1.6, rx: -0.5 },
    { y: 10.3, z: -1.55, w: 0.5, d: 1.6, rx: 0.5 },
  ];
  flaps.forEach((f) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(f.w, 0.16, f.d), flapMat);
    m.position.set(0, f.y, f.z);
    m.rotation.x = f.rx;
    rocket.add(m);
  });

  // engine bells — booster ring
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 16, 1, true), dark);
    bell.position.set(Math.cos(a) * 0.95, -0.1, Math.sin(a) * 0.95);
    bell.rotation.x = Math.PI;
    rocket.add(bell);
  }
  const centerBell = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.85, 16, 1, true), dark);
  centerBell.position.set(0, -0.15, 0);
  centerBell.rotation.x = Math.PI;
  rocket.add(centerBell);

  // ship engines
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 16, 1, true), dark);
    bell.position.set(Math.cos(a) * 0.75, 9.75, Math.sin(a) * 0.75);
    bell.rotation.x = Math.PI;
    rocket.add(bell);
  }

  rocket.position.y = 1.1;
  scene.add(rocket);

  /* ---------------- exhaust ---------------- */
  // bright core flame (additive, flickering)
  const flameMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        float y = 1.0 - vUv.y;
        float core = smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.55, y);
        float flick = 0.82 + 0.18 * sin(uTime*38.0 + y*22.0) * sin(uTime*13.0);
        vec3 hot = mix(vec3(1.0,0.92,0.66), vec3(1.0,0.42,0.08), smoothstep(0.0,0.75,y));
        float a = core * flick;
        gl_FragColor = vec4(hot * (0.9 + 0.6*flick), a);
      }
    `,
  });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(1.15, 6.5, 24, 1, true), flameMat);
  flame.position.set(0, -2.6, 0);
  flame.rotation.x = Math.PI;
  rocket.add(flame);

  // ground light from engines
  const engineLight = new THREE.PointLight('#ff7a2e', 60, 60, 1.6);
  engineLight.position.set(0, 0.4, 0);
  scene.add(engineLight);

  // exhaust particles falling outward
  const PCOUNT = 260;
  const pGeom = new THREE.BufferGeometry();
  const pPos = new Float32Array(PCOUNT * 3);
  const pVel = new Float32Array(PCOUNT * 3);
  const pLife = new Float32Array(PCOUNT);
  for (let i = 0; i < PCOUNT; i++) {
    pPos[i * 3] = 0; pPos[i * 3 + 1] = 0; pPos[i * 3 + 2] = 0;
    const a = R() * Math.PI * 2;
    const sp = 2.5 + R() * 6;
    pVel[i * 3] = Math.cos(a) * sp;
    pVel[i * 3 + 1] = -(1 + R() * 3);
    pVel[i * 3 + 2] = Math.sin(a) * sp;
    pLife[i] = R();
  }
  pGeom.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: '#ffb066', size: 0.34, sizeAttenuation: true,
    transparent: true, opacity: 0.85, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const particles = new THREE.Points(pGeom, pMat);
  scene.add(particles);

  /* ---------------- ground dust haze ---------------- */
  const hazeMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime;
      void main(){
        vec2 c = vUv - 0.5;
        float d = length(c);
        float n = 0.6 + 0.4*sin(uTime*2.0 + c.x*9.0) * sin(uTime*1.3 + c.y*7.0);
        float a = smoothstep(0.5, 0.08, d) * 0.5 * n;
        gl_FragColor = vec4(1.0, 0.55, 0.24, a);
      }
    `,
  });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), hazeMat);
  haze.rotation.x = -Math.PI / 2;
  haze.position.y = 0.35;
  scene.add(haze);

  /* ---------------- lights ---------------- */
  scene.add(new THREE.AmbientLight('#3a4358', 1.1));
  const moon = new THREE.DirectionalLight('#cfe0ff', 1.5);
  moon.position.set(-14, 26, 10);
  scene.add(moon);
  const rim = new THREE.DirectionalLight('#5fa8ff', 0.9);
  rim.position.set(16, 6, -12);
  scene.add(rim);
  const hot = new THREE.PointLight('#ff5a1f', 18, 40, 2);
  hot.position.set(6, 1.5, 5);
  scene.add(hot);

  /* ---------------- interaction ---------------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / sizes.w) * 2 - 1;
    pointer.ty = (e.clientY / sizes.h) * 2 - 1;
  }, { passive: true });

  let scrollY = 0;
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

  /* ---------------- visibility ----------------
     The scene is a full-viewport hero at the top of the page. Rendering it
     while scrolled far away burns GPU frames for nothing — gate the loop on
     the canvas being onscreen. */
  let visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(canvas);
  }

  /* ---------------- resize ---------------- */
  function resize() {
    camera.aspect = sizes.w / sizes.h;
    camera.updateProjectionMatrix();
    renderer.setSize(sizes.w, sizes.h, false);
    renderer.setPixelRatio(sizes.dpr);
  }
  window.addEventListener('resize', resize);

  /* ---------------- animate ---------------- */
  const clock = new THREE.Clock();
  let t0 = 0;
  const blinkers = scene.children.filter((c) => c.userData.blink !== undefined);

  function tick() {
    if (!visible) { requestAnimationFrame(tick); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    t0 += dt;

    // camera: slow orbit + pointer parallax + scroll push-away
    const orbit = Math.sin(t0 * 0.06) * 2.4;
    pointer.x = damp(pointer.x, pointer.tx, 2.4, dt);
    pointer.y = damp(pointer.y, pointer.ty, 2.4, dt);
    const sFactor = Math.min(scrollY / sizes.h, 1.4);
    camera.position.x = damp(camera.position.x, camBase.x + orbit + pointer.x * 3.2, 1.6, dt);
    camera.position.y = damp(camera.position.y, camBase.y - pointer.y * 1.8, 1.6, dt);
    camera.position.z = damp(camera.position.z, camBase.z + sFactor * 22, 1.2, dt);
    camera.lookAt(0, 9 - sFactor * 1.5, 0);

    // stars drift
    if (!reducedMotion) {
      starsFar.rotation.y += dt * 0.006;
      starsNear.rotation.y -= dt * 0.012;
    }

    // flame flicker
    flameMat.uniforms.uTime.value = t0;
    hazeMat.uniforms.uTime.value = t0;
    limbMat.uniforms.uTime.value = t0;
    const f = 0.86 + Math.sin(t0 * 27) * 0.09 + Math.sin(t0 * 7.3) * 0.05;
    flame.scale.set(f, 1 + Math.sin(t0 * 19) * 0.1, f);
    engineLight.intensity = 46 + Math.sin(t0 * 23) * 14 + Math.sin(t0 * 6) * 8;

    // particles
    const arr = pGeom.attributes.position.array;
    for (let i = 0; i < PCOUNT; i++) {
      pLife[i] -= dt * (0.35 + (i % 5) * 0.06);
      if (pLife[i] <= 0) {
        pLife[i] = 1;
        arr[i * 3] = 0; arr[i * 3 + 1] = 0.1; arr[i * 3 + 2] = 0;
      }
      arr[i * 3] += pVel[i * 3] * dt * 1.6;
      arr[i * 3 + 1] += pVel[i * 3 + 1] * dt * 1.9;
      arr[i * 3 + 2] += pVel[i * 3 + 2] * dt * 1.6;
      if (arr[i * 3 + 1] < 0.4) {
        arr[i * 3] *= 0.94; arr[i * 3 + 2] *= 0.94;
        arr[i * 3 + 1] = 0.4 + Math.abs(arr[i * 3 + 1]) * 0.05;
      }
    }
    pGeom.attributes.position.needsUpdate = true;

    // blink lights
    blinkers.forEach((b) => {
      b.visible = (Math.sin(t0 * 2 + b.userData.blink * 6.28) > 0.3);
    });

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  return { renderer, scene, camera };
}
