// Shared-renderer 3D engine for the inventory UI.
// One offscreen WebGL renderer draws every card into its own 2D canvas,
// so 60+ rotating items cost one GL context instead of sixty.
// Ported from project/inventory-3d.js — same behavior, npm three instead of esm.sh.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cache = new Map();
const fittedCache = new Map();
const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
let msbmScreenTexturePromise;
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function makeLoginScreenPanelTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 600;
  const context = canvas.getContext('2d');
  const x = 52; const y = 47; const width = 920; const height = 506; const radius = 58;
  const roundedWindow = () => {
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
  };

  context.save();
  context.shadowColor = 'rgba(0, 14, 28, .38)';
  context.shadowBlur = 34;
  context.shadowOffsetY = 15;
  roundedWindow();
  context.fillStyle = 'rgba(255,255,255,.96)';
  context.fill();
  context.restore();

  const surface = context.createLinearGradient(x, y, x + width, y + height);
  surface.addColorStop(0, 'rgba(255,255,255,.99)');
  surface.addColorStop(.62, 'rgba(250,253,255,.97)');
  surface.addColorStop(1, 'rgba(228,239,246,.9)');
  roundedWindow();
  context.fillStyle = surface;
  context.fill();
  context.strokeStyle = 'rgba(178, 205, 218, .72)';
  context.lineWidth = 3;
  context.stroke();

  // A very light application-window header keeps the presentation intentional
  // without competing with the institutional identity.
  context.save();
  roundedWindow();
  context.clip();
  const header = context.createLinearGradient(0, y, 0, y + 78);
  header.addColorStop(0, 'rgba(238,246,250,.9)');
  header.addColorStop(1, 'rgba(255,255,255,.18)');
  context.fillStyle = header;
  context.fillRect(x, y, width, 78);
  context.strokeStyle = 'rgba(184,207,217,.44)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x + 28, y + 78);
  context.lineTo(x + width - 28, y + 78);
  context.stroke();
  ['#d9e5ea', '#c8dbe4', '#a9c9d7'].forEach((color, index) => {
    context.beginPath();
    context.arc(x + 43 + index * 31, y + 39, 8, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  });
  context.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

const LOGIN_SCREEN_PANEL_TEXTURE = makeLoginScreenPanelTexture();

function addLoginScreenBrand(scene) {
  if (!msbmScreenTexturePromise) {
    msbmScreenTexturePromise = textureLoader.loadAsync('brand/msbm-lockup.png').then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      return texture;
    });
  }
  return msbmScreenTexturePromise.then((texture) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.78, 1.04),
      new THREE.MeshBasicMaterial({ map: LOGIN_SCREEN_PANEL_TEXTURE, transparent: true, depthWrite: false, toneMapped: false })
    );
    panel.name = 'MSBM screen application window';
    panel.position.set(0, 1.52, 0.116);
    panel.renderOrder = 1;
    const logo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.24, 0.667),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.025, depthWrite: false, toneMapped: false })
    );
    logo.name = 'Official MSBM screen logo';
    logo.position.set(0, 1.48, 0.121);
    logo.renderOrder = 2;
    scene.add(panel, logo);
    return scene;
  });
}

function loadModel(url) {
  const id = url;
  if (!cache.has(id)) {
    cache.set(id, loader.loadAsync(url).then(g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
      });
      return String(url).includes('login-workstation.glb') ? addLoginScreenBrand(g.scene) : g.scene;
    }).then(scene => {
      return scene;
    }).catch(e => { console.warn('model failed', id, e); return null; }));
  }
  return cache.get(id);
}

function cloneFitted(template) {
  const root = template.clone(true);
  root.spinner = root.getObjectByName('__inventory_model_spinner__');
  return root;
}

function fitted(src, target, cacheKey = '') {
  const fittedKey = cacheKey ? `${cacheKey}::${target}` : '';
  if (fittedKey && fittedCache.has(fittedKey)) return cloneFitted(fittedCache.get(fittedKey));
  const obj = src.clone(true);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z) || 1;
  const s = target / max;
  const pivot = new THREE.Group();
  pivot.name = '__inventory_model_spinner__';
  const inner = new THREE.Group();
  obj.position.set(-center.x, -center.y, -center.z);
  inner.add(obj);
  inner.scale.setScalar(s);
  pivot.add(inner);

  // the object spins, the ground does not — shadow catcher + painted contact blob live outside the pivot
  const floorY = -size.y * s / 2;
  const spread = Math.max(size.x, size.z) * s;
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.ShadowMaterial({ opacity: 0.26 })
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = floorY - 0.002;
  catcher.receiveShadow = true;
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(spread * 2.1, spread * 2.1),
    new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false, opacity: 0.85 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = floorY;
  const root = new THREE.Group();
  root.add(catcher, blob, pivot);
  root.spinner = pivot;
  if (!fittedKey) return root;
  fittedCache.set(fittedKey, root);
  return cloneFitted(root);
}

function shadowTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const rad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  rad.addColorStop(0, 'rgba(20,24,29,.55)');
  rad.addColorStop(0.45, 'rgba(20,24,29,.26)');
  rad.addColorStop(1, 'rgba(20,24,29,0)');
  g.fillStyle = rad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}
const SHADOW_TEX = shadowTexture();

function makeStage(w, h, shadows = true) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(w, h, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x93a3b5, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(3, 5, 4);
  key.castShadow = shadows;
  key.shadow.mapSize.set(512, 512);
  key.shadow.camera.left = -1.6; key.shadow.camera.right = 1.6;
  key.shadow.camera.top = 1.6; key.shadow.camera.bottom = -1.6;
  key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
  key.shadow.bias = -0.0012;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xbfd4ee, 0.9); fill.position.set(-4, 2, -3); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.7); rim.position.set(0, -3, -5); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
  return { renderer, scene, camera };
}

const cardStage = makeStage(360, 260, false);
const detailStage = makeStage(900, 620, true);

const cards = new Map();   // canvas -> entry
const details = new Map(); // container -> entry
const detailPixelRatio = Math.min(2, Math.max(1, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));
const detailResizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
  for (const entry of entries) Inv3D.resizeDetail(entry.target);
});

let lastCardFrame = 0;
const CARD_FRAME_INTERVAL = 1000 / 60;
const DETAIL_DEFAULT_YAW = 0.6;
const DETAIL_DEFAULT_PITCH = -0.18;
const DETAIL_RETURN_DURATION = 420;
let detailRenderWidth = 900;
let detailRenderHeight = 620;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden || (!cards.size && !details.size)) return;

  const cs = cardStage;
  cs.camera.position.set(0, 0.55, 2.6);
  cs.camera.lookAt(0, 0, 0);
  if (now - lastCardFrame >= CARD_FRAME_INTERVAL) {
    lastCardFrame = now;
    for (const [canvas, e] of cards) {
      if (!canvas.isConnected) { cards.delete(canvas); continue; }
      if (!e.visible || !e.pivot) continue;
      if (canvas.closest('.workspace-screen[aria-hidden="true"]')) continue;
      const mul = typeof window.__inv3dSpeed === 'number' ? window.__inv3dSpeed : 1;
      if (!reduced && mul > 0) e.spun = (e.spun || 0) + (now - e.lastT || 0) / 1000 * e.speed * mul;
      e.lastT = now;
      e.pivot.spinner.rotation.y = e.offset + (e.spun || 0);
      e.pivot.spinner.rotation.x = -0.16;
      cs.scene.add(e.pivot);
      cs.renderer.render(cs.scene, cs.camera);
      cs.scene.remove(e.pivot);
      const ctx = e.ctx;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(cs.renderer.domElement, 0, 0, canvas.width, canvas.height);
      if (!e.shown) { e.shown = true; canvas.style.opacity = '1'; canvas.classList.add('model-rendered'); canvas.parentElement?.classList.add('model-rendered'); }
    }
  }

  const ds = detailStage;
  for (const [el, e] of details) {
    if (!el.isConnected) { details.delete(el); detailResizeObserver?.unobserve(el); continue; }
    if (el.closest('.workspace-screen[aria-hidden="true"]')) continue;
    if (!e.pivot) continue;
    const frameInterval = 1000 / e.fps;
    if (e.lastFrame && now - e.lastFrame < frameInterval) continue;
    const dt = e.lastFrame ? Math.min((now - e.lastFrame) / 1000, .1) : 0;
    e.lastFrame = now;
    const dmul = typeof window.__inv3dSpeed === 'number' ? window.__inv3dSpeed : 1;
    if (e.returning) {
      const progress = Math.min(1, (now - e.returning.startedAt) / DETAIL_RETURN_DURATION);
      const eased = 1 - Math.pow(1 - progress, 3);
      e.yaw = THREE.MathUtils.lerp(e.returning.yaw, e.returning.targetYaw, eased);
      e.pitch = THREE.MathUtils.lerp(e.returning.pitch, DETAIL_DEFAULT_PITCH, eased);
      e.zoom = THREE.MathUtils.lerp(e.returning.zoom, 1, eased);
      if (progress >= 1) {
        const resumeSpin = e.returning.resumeSpin;
        e.returning = null;
        e.spin = resumeSpin;
      }
    } else if (e.spin && !reduced) e.yaw += dt * 0.5 * dmul;
    e.pivot.spinner.rotation.y = e.yaw;
    e.pivot.spinner.rotation.x = e.pitch;
    ds.camera.aspect = e.canvas.width / e.canvas.height;
    ds.camera.updateProjectionMatrix();
    const asp = ds.camera.aspect;
    let d = 2.7 / e.zoom;
    if (asp < 1.5) d *= Math.min(1.22, 1.5 / asp);
    ds.camera.position.set(0, d * 0.2, d);
    ds.camera.lookAt(0, 0, 0);
    if (detailRenderWidth !== e.canvas.width || detailRenderHeight !== e.canvas.height) {
      detailRenderWidth = e.canvas.width;
      detailRenderHeight = e.canvas.height;
      ds.renderer.setSize(detailRenderWidth, detailRenderHeight, false);
    }
    ds.scene.add(e.pivot);
    ds.renderer.render(ds.scene, ds.camera);
    ds.scene.remove(e.pivot);
    const ctx = e.ctx;
    ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
    ctx.drawImage(ds.renderer.domElement, 0, 0, e.canvas.width, e.canvas.height);
    if (!e.shown) { e.shown = true; e.canvas.style.opacity = '1'; e.canvas.classList.add('model-rendered'); e.canvas.parentElement?.classList.add('model-rendered'); }
  }
}
requestAnimationFrame(frame);

const io = new IntersectionObserver(entries => {
  for (const en of entries) {
    const e = cards.get(en.target);
    if (e) e.visible = en.isIntersecting;
  }
}, { rootMargin: '160px' });

function attachDetailControls(el) {
  let dragging = false, px = 0, py = 0, pointerId = null, resumeSpin = true;
  const activeEntry = () => details.get(el);
  const setCursor = (cursor) => {
    el.style.cursor = cursor;
    const entry = activeEntry();
    if (entry?.canvas) entry.canvas.style.cursor = cursor;
  };
  el.addEventListener('pointerdown', ev => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const e = activeEntry();
    if (!e) return;
    ev.preventDefault();
    dragging = true; pointerId = ev.pointerId; px = ev.clientX; py = ev.clientY;
    resumeSpin = e.returning?.resumeSpin ?? e.spin;
    e.returning = null;
    e.spin = false;
    setCursor('grabbing');
    el.setPointerCapture(ev.pointerId);
  });
  el.addEventListener('pointermove', ev => {
    const e = activeEntry();
    if (!dragging || !e) return;
    e.yaw += (ev.clientX - px) * 0.01;
    e.pitch = Math.max(-1.2, Math.min(1.2, e.pitch + (ev.clientY - py) * 0.008));
    px = ev.clientX; py = ev.clientY;
  });
  const stop = () => {
    if (!dragging) return;
    const e = activeEntry();
    dragging = false;
    if (pointerId !== null && el.hasPointerCapture?.(pointerId)) el.releasePointerCapture(pointerId);
    pointerId = null;
    setCursor('grab');
    if (!e) return;
    const targetYaw = DETAIL_DEFAULT_YAW + Math.round((e.yaw - DETAIL_DEFAULT_YAW) / (Math.PI * 2)) * Math.PI * 2;
    if (reduced) {
      e.yaw = targetYaw;
      e.pitch = DETAIL_DEFAULT_PITCH;
      e.zoom = 1;
      e.spin = resumeSpin;
      return;
    }
    e.returning = { yaw: e.yaw, pitch: e.pitch, zoom: e.zoom, targetYaw, startedAt: performance.now(), resumeSpin };
  };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('wheel', ev => {
    const e = activeEntry();
    if (!e) return;
    ev.preventDefault();
    e.returning = null;
    e.zoom = Math.max(0.55, Math.min(2.4, e.zoom * (ev.deltaY > 0 ? 0.92 : 1.08)));
  }, { passive: false });
}

export const Inv3D = {
  preload(urls = []) {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < uniqueUrls.length) {
        const url = uniqueUrls[nextIndex++];
        const source = await loadModel(url);
        if (source) fitted(source, 1.35, url);
      }
    };
    // Avoid decoding dozens of GLBs on the UI thread at the same instant.
    return Promise.allSettled(Array.from({ length: Math.min(6, uniqueUrls.length) }, worker));
  },
  sync(root = document) {
    const pending = [];
    root.querySelectorAll('canvas[data-model]').forEach(canvas => {
      const id = canvas.getAttribute('data-model');
      if (!id) return;
      const e = cards.get(canvas);
      if (e && e.id === id) return;
      if (e) { cards.delete(canvas); io.unobserve(canvas); }
      canvas.width = 360; canvas.height = 260;
      canvas.style.opacity = '0';
      canvas.style.transition = 'opacity .5s ease';
      const entry = {
        id, ctx: canvas.getContext('2d'), visible: true, shown: false,
        offset: Math.random() * Math.PI * 2,
        speed: 0.34 + Math.random() * 0.16, pivot: null
      };
      cards.set(canvas, entry);
      io.observe(canvas);
      const task = loadModel(id).then(src => { if (src && cards.get(canvas) === entry) entry.pivot = fitted(src, 1.35, id); });
      pending.push(task);
    });

    root.querySelectorAll('[data-detail-model]').forEach(el => {
      const id = el.getAttribute('data-detail-model');
      if (!id) return;
      const interactive = el.getAttribute('data-detail-interactive') !== 'false';
      const spinning = el.getAttribute('data-detail-spin') !== 'false';
      const scale = Number.parseFloat(el.getAttribute('data-detail-scale')) || 1.3;
      const fps = Math.max(20, Math.min(60, Number.parseFloat(el.getAttribute('data-detail-fps')) || 60));
      let e = details.get(el);
      if (e && e.id === id) { Inv3D.resizeDetail(el); return; }
      let canvas = el.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.style.cssText = `width:100%;height:100%;display:block;opacity:0;transition:opacity .5s ease;cursor:${interactive ? 'grab' : 'default'}`;
        el.appendChild(canvas);
        if (interactive) el.style.touchAction = 'none';
      }
      e = {
        id, canvas, ctx: canvas.getContext('2d'), yaw: DETAIL_DEFAULT_YAW, pitch: DETAIL_DEFAULT_PITCH,
        zoom: 1, spin: spinning, returning: null, fps, lastFrame: 0, shown: false, pivot: null, bound: e && e.bound
      };
      details.set(el, e);
      Inv3D.resizeDetail(el);
      detailResizeObserver?.observe(el);
      if (interactive && !e.bound) { attachDetailControls(el); e.bound = true; }
      const task = loadModel(id).then(src => { if (src && details.get(el) === e) e.pivot = fitted(src, scale, id); });
      pending.push(task);
    });
    return Promise.allSettled(pending);
  },
  resizeDetail(el) {
    const e = details.get(el); if (!e) return;
    const r = el.getBoundingClientRect();
    const cssWidth = Math.max(320, r.width);
    const cssHeight = Math.max(240, r.height);
    const scale = Math.min(detailPixelRatio, 1800 / cssWidth, 1240 / cssHeight);
    const w = Math.round(cssWidth * scale);
    const h = Math.round(cssHeight * scale);
    if (e.canvas.width !== w || e.canvas.height !== h) { e.canvas.width = w; e.canvas.height = h; }
  },
  resetDetail() { for (const e of details.values()) { e.yaw = DETAIL_DEFAULT_YAW; e.pitch = DETAIL_DEFAULT_PITCH; e.zoom = 1; e.returning = null; e.spin = true; } },
  toggleSpin() { let on = false; for (const e of details.values()) { e.returning = null; e.spin = !e.spin; on = e.spin; } return on; }
};

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => details.forEach((_, el) => Inv3D.resizeDetail(el)));
  window.Inv3D = Inv3D;
}
