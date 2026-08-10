import fs from 'node:fs/promises';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.({ target: this }); }); }
    readAsDataURL(blob) { blob.arrayBuffer().then((result) => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend?.({ target: this }); }); }
  };
}

const black = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: .38, metalness: .08 });
const graphite = new THREE.MeshStandardMaterial({ color: 0x343a3e, roughness: .42, metalness: .12 });
const slate = new THREE.MeshStandardMaterial({ color: 0x626b70, roughness: .32, metalness: .22 });
const clickBlack = new THREE.MeshStandardMaterial({ color: 0x202428, roughness: .3, metalness: .1 });
const clickSlate = new THREE.MeshStandardMaterial({ color: 0x747d82, roughness: .28, metalness: .2 });
const seam = new THREE.MeshStandardMaterial({ color: 0x080a0c, roughness: .5 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x202327, roughness: .78 });
const softRubber = new THREE.MeshStandardMaterial({ color: 0x292e31, roughness: .9 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xabb2b6, roughness: .2, metalness: .78 });
const led = new THREE.MeshStandardMaterial({ color: 0x2a80d4, emissive: 0x0a3d7c, emissiveIntensity: .8 });

function add(group, geometry, material, position = [0, 0, 0], rotation = null, scale = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  if (scale) mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
}

const PROFILE = [
  [-.9, .31, .205, 0], [-.68, .49, .34, .005], [-.34, .585, .49, .025],
  [.05, .635, .59, .065], [.42, .59, .555, .075], [.7, .46, .405, .05], [.88, .27, .22, .018]
];

function profileAt(z) {
  let index = 0;
  while (index < PROFILE.length - 2 && z > PROFILE[index + 1][0]) index += 1;
  const from = PROFILE[index];
  const to = PROFILE[index + 1];
  const t = THREE.MathUtils.clamp((z - from[0]) / (to[0] - from[0]), 0, 1);
  const smooth = t * t * (3 - 2 * t);
  return {
    width: THREE.MathUtils.lerp(from[1], to[1], smooth),
    height: THREE.MathUtils.lerp(from[2], to[2], smooth),
    center: THREE.MathUtils.lerp(from[3], to[3], smooth)
  };
}

function shellPoint(z, theta, lift = 0) {
  const { width, height, center } = profileAt(z);
  const arc = Math.max(0, Math.cos(theta));
  const x = center + width * Math.sin(theta);
  const asymmetry = Math.sin(theta) * .025 * Math.sin(Math.PI * ((z + .9) / 1.8));
  const y = .075 + (height - .075) * Math.pow(arc, .7) + asymmetry + lift;
  return new THREE.Vector3(x, y, z);
}

function makeErgonomicShell() {
  const zSegments = 34;
  const arcSegments = 28;
  const vertices = [];
  const indices = [];
  for (let zi = 0; zi <= zSegments; zi += 1) {
    const z = THREE.MathUtils.lerp(-.9, .88, zi / zSegments);
    for (let ai = 0; ai <= arcSegments; ai += 1) {
      vertices.push(...shellPoint(z, THREE.MathUtils.lerp(-Math.PI / 2, Math.PI / 2, ai / arcSegments)));
    }
  }
  const stride = arcSegments + 1;
  for (let zi = 0; zi < zSegments; zi += 1) {
    for (let ai = 0; ai < arcSegments; ai += 1) {
      const a = zi * stride + ai;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const left = zi * stride;
    const right = left + arcSegments;
    const nextLeft = left + stride;
    const nextRight = right + stride;
    indices.push(left, right, nextLeft, right, nextRight, nextLeft);
  }
  for (const zi of [0, zSegments]) {
    const centerIndex = vertices.length / 3;
    const z = zi ? .88 : -.9;
    vertices.push(profileAt(z).center, .075, z);
    for (let ai = 0; ai < arcSegments; ai += 1) {
      const a = zi * stride + ai;
      const b = a + 1;
      indices.push(centerIndex, zi ? a : b, zi ? b : a);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeClickPlate(side) {
  const zSegments = 13;
  const arcSegments = 10;
  const vertices = [];
  const indices = [];
  const thetaStart = side < 0 ? -1.38 : .055;
  const thetaEnd = side < 0 ? -.055 : 1.38;
  for (let zi = 0; zi <= zSegments; zi += 1) {
    const z = THREE.MathUtils.lerp(-.82, -.09, zi / zSegments);
    for (let ai = 0; ai <= arcSegments; ai += 1) {
      vertices.push(...shellPoint(z, THREE.MathUtils.lerp(thetaStart, thetaEnd, ai / arcSegments), .011));
    }
  }
  const stride = arcSegments + 1;
  for (let zi = 0; zi < zSegments; zi += 1) for (let ai = 0; ai < arcSegments; ai += 1) {
    const a = zi * stride + ai;
    const b = a + stride;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function addShellSeam(group) {
  const points = [];
  for (let i = 0; i <= 18; i += 1) {
    const z = THREE.MathUtils.lerp(-.79, -.08, i / 18);
    const profile = profileAt(z);
    points.push(new THREE.Vector3(profile.center, profile.height + .014, z));
  }
  add(group, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 36, .009, 6, false), seam);
}

function buildMouse({ wired = false } = {}) {
  const mouse = new THREE.Group();
  mouse.name = wired ? 'Wired ergonomic optical mouse' : 'Wireless ergonomic mouse';

  add(mouse, makeErgonomicShell(), wired ? black : graphite);
  add(mouse, makeClickPlate(-1), wired ? clickBlack : clickSlate);
  add(mouse, makeClickPlate(1), wired ? clickBlack : clickSlate);
  addShellSeam(mouse);

  add(mouse, new RoundedBoxGeometry(.19, .025, .4, 5, .012), seam, [.025, .505, -.31], [-.11, 0, 0]);
  add(mouse, new THREE.CylinderGeometry(.087, .087, .13, 28), rubber, [.025, .548, -.37], [0, 0, Math.PI / 2]);
  add(mouse, new THREE.CylinderGeometry(.031, .031, .17, 18), chrome, [.025, .548, -.37], [0, 0, Math.PI / 2]);
  for (let i = -3; i <= 3; i += 1) add(mouse, new THREE.TorusGeometry(.087, .006, 6, 24), seam, [-.02 + i * .015, .548, -.37], [0, Math.PI / 2, 0]);
  add(mouse, new RoundedBoxGeometry(.105, .025, .13, 4, .018), wired ? graphite : slate, [.045, .578, -.055], [-.05, 0, 0]);
  if (!wired) add(mouse, new RoundedBoxGeometry(.055, .012, .018, 3, .006), led, [.05, .6, .06]);

  add(mouse, new THREE.CapsuleGeometry(.13, .52, 7, 20), softRubber, [-.56, .135, .16], [Math.PI / 2, 0, 0], [.72, .42, 1]);
  add(mouse, new THREE.CapsuleGeometry(.1, .52, 7, 18), softRubber, [.62, .17, .17], [Math.PI / 2, 0, 0], [.35, .5, 1]);
  add(mouse, new RoundedBoxGeometry(.035, .09, .22, 4, .018), slate, [-.598, .31, -.2], [0, 0, -.08]);
  add(mouse, new RoundedBoxGeometry(.035, .09, .19, 4, .018), slate, [-.61, .295, .055], [0, 0, -.08]);
  for (let groove = -3; groove <= 3; groove += 1) {
    add(mouse, new THREE.BoxGeometry(.012, .035, .055), seam, [-.626, .175, .12 + groove * .075], [0, 0, -.08]);
    add(mouse, new THREE.BoxGeometry(.012, .032, .052), seam, [.645, .18, .12 + groove * .075], [0, 0, .06]);
  }
  add(mouse, new RoundedBoxGeometry(1.03, .07, 1.54, 8, .035), rubber, [.01, .06, 0]);
  for (const [x, z, width] of [[-.25, -.7, .38], [.25, -.7, .38], [-.23, .67, .34], [.23, .67, .34]]) {
    add(mouse, new RoundedBoxGeometry(width, .014, .11, 4, .03), chrome, [x, .012, z]);
  }

  if (wired) {
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.015, .16, -.9), new THREE.Vector3(.02, .12, -1.17),
      new THREE.Vector3(-.18, .08, -1.5), new THREE.Vector3(.08, .07, -1.92),
      new THREE.Vector3(.32, .07, -2.18)
    ]);
    add(mouse, new THREE.TubeGeometry(cableCurve, 52, .025, 10, false), rubber);
    add(mouse, new THREE.CylinderGeometry(.055, .04, .18, 16), rubber, [.015, .155, -.95], [Math.PI / 2, 0, 0]);
    add(mouse, new RoundedBoxGeometry(.19, .085, .31, 4, .022), graphite, [.32, .075, -2.32]);
    add(mouse, new THREE.BoxGeometry(.125, .038, .16), chrome, [.32, .075, -2.55]);
  } else {
    add(mouse, new RoundedBoxGeometry(.17, .016, .075, 3, .014), rubber, [.06, .014, .16]);
  }

  mouse.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  return mouse;
}

async function exportModel(name, object) {
  const scene = new THREE.Scene();
  scene.name = `${name} asset model`;
  scene.add(object);
  scene.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: true, truncateDrawRange: true });
  const output = `public/uploads/University-IT-Office-Equipment-GLB-Expansion/models/${name}.glb`;
  await fs.writeFile(output, Buffer.from(result));
  console.log(`Generated ${output} (${Buffer.byteLength(result).toLocaleString()} bytes)`);
}

await exportModel('wired-mouse', buildMouse({ wired: true }));
await exportModel('wireless-mouse', buildMouse());
