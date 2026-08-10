// Shared-renderer 3D engine for the inventory UI.
// One offscreen WebGL renderer draws every card into its own 2D canvas,
// so 60+ rotating items cost one GL context instead of sixty.
// Ported from project/inventory-3d.js — same behavior, npm three instead of esm.sh.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const cache = new Map();
const loader = new GLTFLoader();
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function loadModel(url) {
  const id = url;
  if (!cache.has(id)) {
    cache.set(id, loader.loadAsync(url).then(g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
      });
      return g.scene;
    }).catch(e => { console.warn('model failed', id, e); return null; }));
  }
  return cache.get(id);
}

function fitted(src, target) {
  const obj = src.clone(true);
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const max = Math.max(size.x, size.y, size.z) || 1;
  const s = target / max;
  const pivot = new THREE.Group();
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
  return root;
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

let last = 0;
let detailRenderWidth = 900;
let detailRenderHeight = 620;
function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden || (!cards.size && !details.size)) return;
  if (now - last < 50) return;            // 20fps keeps the slow rotation smooth with far less GPU work
  const dt = (now - last) / 1000;
  last = now;

  const cs = cardStage;
  cs.camera.position.set(0, 0.55, 2.6);
  cs.camera.lookAt(0, 0, 0);
  for (const [canvas, e] of cards) {
    if (!canvas.isConnected) { cards.delete(canvas); continue; }
    if (canvas.closest('.workspace-screen[aria-hidden="true"]')) continue;
    if (!e.visible || !e.pivot) continue;
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

  const ds = detailStage;
  for (const [el, e] of details) {
    if (!el.isConnected) { details.delete(el); continue; }
    if (!e.pivot) continue;
    const dmul = typeof window.__inv3dSpeed === 'number' ? window.__inv3dSpeed : 1;
    if (e.spin && !reduced) e.yaw += dt * 0.5 * dmul;
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

function attachDetailControls(el, e) {
  let dragging = false, px = 0, py = 0;
  el.addEventListener('pointerdown', ev => { dragging = true; px = ev.clientX; py = ev.clientY; e.spin = false; el.setPointerCapture(ev.pointerId); });
  el.addEventListener('pointermove', ev => {
    if (!dragging) return;
    e.yaw += (ev.clientX - px) * 0.01;
    e.pitch = Math.max(-1.2, Math.min(1.2, e.pitch + (ev.clientY - py) * 0.008));
    px = ev.clientX; py = ev.clientY;
  });
  const stop = () => { dragging = false; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('wheel', ev => { ev.preventDefault(); e.zoom = Math.max(0.55, Math.min(2.4, e.zoom * (ev.deltaY > 0 ? 0.92 : 1.08))); }, { passive: false });
}

export const Inv3D = {
  preload(urls = []) {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < uniqueUrls.length) {
        const url = uniqueUrls[nextIndex++];
        await loadModel(url);
      }
    };
    // Avoid decoding dozens of GLBs on the UI thread at the same instant.
    return Promise.allSettled(Array.from({ length: Math.min(6, uniqueUrls.length) }, worker));
  },
  sync() {
    document.querySelectorAll('canvas[data-model]').forEach(canvas => {
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
      loadModel(id).then(src => { if (src && cards.get(canvas) === entry) entry.pivot = fitted(src, 1.35); });
    });

    document.querySelectorAll('[data-detail-model]').forEach(el => {
      const id = el.getAttribute('data-detail-model');
      if (!id) return;
      const interactive = el.getAttribute('data-detail-interactive') !== 'false';
      const scale = Number.parseFloat(el.getAttribute('data-detail-scale')) || 1.3;
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
        id, canvas, ctx: canvas.getContext('2d'), yaw: 0.6, pitch: -0.18,
        zoom: 1, spin: true, shown: false, pivot: null, bound: e && e.bound
      };
      details.set(el, e);
      Inv3D.resizeDetail(el);
      if (interactive && !e.bound) { attachDetailControls(el, e); e.bound = true; }
      loadModel(id).then(src => { if (src && details.get(el) === e) e.pivot = fitted(src, scale); });
    });
  },
  resizeDetail(el) {
    const e = details.get(el); if (!e) return;
    const r = el.getBoundingClientRect();
    const w = Math.max(320, Math.round(Math.min(r.width, 900)));
    const h = Math.max(240, Math.round(Math.min(r.height, 620)));
    if (e.canvas.width !== w || e.canvas.height !== h) { e.canvas.width = w; e.canvas.height = h; }
  },
  resetDetail() { for (const e of details.values()) { e.yaw = 0.6; e.pitch = -0.18; e.zoom = 1; e.spin = true; } },
  toggleSpin() { let on = false; for (const e of details.values()) { e.spin = !e.spin; on = e.spin; } return on; }
};

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => details.forEach((_, el) => Inv3D.resizeDetail(el)));
  window.Inv3D = Inv3D;
}
