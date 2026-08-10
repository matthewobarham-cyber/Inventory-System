import fs from 'node:fs/promises';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const mat = (color, roughness = 0.45, metalness = 0.08, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extras });
const ivory = mat(0xe7e5df, 0.32, 0.04);
const pearl = mat(0xf6f5f1, 0.27, 0.02);
const graphite = mat(0x252a2e, 0.34, 0.22);
const dark = mat(0x101417, 0.55, 0.12);
const rubber = mat(0x15191c, 0.82, 0.02);
const silver = mat(0x9ba5ac, 0.24, 0.68);
const navy = mat(0x123f67, 0.28, 0.32);
const blue = mat(0x1d74a8, 0.25, 0.24);
const glass = mat(0x142b39, 0.12, 0.25, { emissive: 0x0a405e, emissiveIntensity: 0.42 });
const screen = mat(0x54c5df, 0.18, 0.12, { emissive: 0x176e91, emissiveIntensity: 1.25 });
const paper = mat(0xfdfdfb, 0.7, 0);
const green = mat(0x4fd4a1, 0.28, 0.04, { emissive: 0x167a57, emissiveIntensity: 0.7 });

function add(group, geometry, material, position = [0, 0, 0], rotation = null, name = '') {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

const rounded = (x, y, z, radius = 0.05, segments = 2) => new RoundedBoxGeometry(x, y, z, segments, Math.min(radius, x / 3, y / 3, z / 3));

function addVent(group, x, y, z, count, vertical = false) {
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 0.075;
    add(group, rounded(vertical ? 0.026 : 0.46, vertical ? 0.36 : 0.026, 0.018, 0.008, 2), dark, [x + (vertical ? offset : 0), y + (vertical ? 0 : offset), z]);
  }
}

function addTrayFace(group, y, width, labelBars = 2) {
  add(group, rounded(width, 0.31, 0.075, 0.035), ivory, [0, y, 0.676]);
  add(group, rounded(width * 0.28, 0.045, 0.018, 0.012), graphite, [0, y + 0.075, 0.718]);
  for (let i = 0; i < labelBars; i += 1) add(group, rounded(0.12 + i * 0.04, 0.018, 0.012, 0.005), silver, [-width * 0.31, y - 0.06 - i * 0.035, 0.722]);
}

function buildMultifunctionPrinter() {
  const printer = new THREE.Group();
  printer.name = 'MSBM professional multifunction printer';

  // Stable wheeled pedestal and four visibly separate paper drawers.
  add(printer, rounded(1.56, 0.13, 1.12, 0.055), graphite, [0, 0.14, 0]);
  for (const x of [-0.58, 0.58]) for (const z of [-0.41, 0.41]) {
    add(printer, new THREE.CylinderGeometry(0.085, 0.085, 0.12, 20), rubber, [x, 0.035, z], [0, 0, Math.PI / 2]);
    add(printer, rounded(0.07, 0.12, 0.055, 0.018), silver, [x, 0.11, z]);
  }
  add(printer, rounded(1.45, 1.12, 1.05, 0.09), pearl, [0, 0.76, 0]);
  [0.42, 0.73, 1.04].forEach((y) => addTrayFace(printer, y, 1.29));
  add(printer, rounded(0.055, 0.9, 0.07, 0.018), navy, [-0.68, 0.78, 0.57]);

  // Main print engine with a deep output bay and paper path.
  add(printer, rounded(1.66, 0.72, 1.22, 0.12), ivory, [0, 1.48, 0]);
  add(printer, rounded(1.06, 0.34, 0.12, 0.045), dark, [-0.12, 1.52, 0.62]);
  add(printer, rounded(0.96, 0.08, 0.49, 0.025), graphite, [-0.12, 1.38, 0.42], [-0.12, 0, 0]);
  add(printer, rounded(0.76, 0.018, 0.41, 0.006), paper, [-0.12, 1.43, 0.48], [-0.12, 0, 0]);
  add(printer, rounded(0.55, 0.024, 0.025, 0.007), navy, [-0.12, 1.445, 0.697]);
  add(printer, rounded(1.2, 0.075, 0.055, 0.02), navy, [0, 1.82, 0.595]);
  addVent(printer, 0, 1.57, -0.624, 7);

  // Scanner tower, glass bed, lid and a detailed automatic document feeder.
  add(printer, rounded(1.55, 0.48, 1.16, 0.11), pearl, [0, 1.98, -0.02]);
  add(printer, rounded(1.61, 0.105, 1.22, 0.045), graphite, [0, 2.245, -0.02]);
  add(printer, rounded(1.36, 0.025, 0.95, 0.018), glass, [0, 2.305, -0.01]);
  add(printer, rounded(1.58, 0.15, 1.15, 0.055), ivory, [0, 2.385, -0.04]);
  add(printer, rounded(1.08, 0.22, 0.62, 0.07), graphite, [-0.12, 2.555, -0.17]);
  add(printer, rounded(0.76, 0.055, 0.48, 0.025), dark, [-0.17, 2.67, -0.11], [0.08, 0, 0]);
  add(printer, rounded(0.64, 0.018, 0.43, 0.006), paper, [-0.17, 2.708, -0.1], [0.08, 0, 0]);
  add(printer, rounded(0.52, 0.065, 0.12, 0.025), silver, [-0.17, 2.55, 0.2]);

  // Angled touch console, screen UI, home key and status beacon.
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(0.64, 2.05, 0.67);
  consoleGroup.rotation.x = -0.22;
  add(consoleGroup, rounded(0.62, 0.33, 0.11, 0.055), graphite);
  add(consoleGroup, rounded(0.43, 0.22, 0.018, 0.022), screen, [-0.055, 0, 0.065]);
  add(consoleGroup, rounded(0.25, 0.018, 0.01, 0.004), pearl, [-0.055, 0.035, 0.078]);
  add(consoleGroup, rounded(0.17, 0.014, 0.01, 0.004), navy, [-0.095, -0.015, 0.078]);
  add(consoleGroup, new THREE.CylinderGeometry(0.035, 0.035, 0.018, 20), green, [0.24, -0.06, 0.07], [Math.PI / 2, 0, 0]);
  printer.add(consoleGroup);
  add(printer, rounded(0.08, 0.2, 0.08, 0.025), graphite, [0.63, 1.88, 0.55]);

  // Side service doors, handles, fasteners and restrained branding accents.
  add(printer, rounded(0.03, 0.55, 0.73, 0.012), ivory, [-0.842, 1.48, -0.05]);
  add(printer, rounded(0.018, 0.26, 0.35, 0.008), navy, [-0.861, 1.57, -0.05]);
  add(printer, rounded(0.025, 0.16, 0.34, 0.01), silver, [0.842, 1.52, -0.04]);
  for (const x of [-0.61, 0.61]) add(printer, new THREE.CylinderGeometry(0.018, 0.018, 0.014, 14), silver, [x, 1.7, 0.626], [Math.PI / 2, 0, 0]);
  add(printer, rounded(0.4, 0.075, 0.025, 0.016), navy, [-0.38, 1.68, 0.69]);
  add(printer, rounded(0.16, 0.023, 0.012, 0.005), pearl, [-0.38, 1.68, 0.708]);
  return printer;
}

function buildLaserPrinter() {
  const printer = new THREE.Group();
  printer.name = 'MSBM premium desktop laser printer';

  // Layered compact body with a tapered upper print engine.
  add(printer, rounded(1.72, 0.16, 1.31, 0.07), graphite, [0, 0.12, 0]);
  add(printer, rounded(1.62, 0.64, 1.21, 0.13), ivory, [0, 0.49, 0]);
  add(printer, rounded(1.48, 0.31, 0.075, 0.04), pearl, [0, 0.41, 0.626]);
  add(printer, rounded(0.48, 0.045, 0.018, 0.012), graphite, [0, 0.47, 0.67]);
  add(printer, rounded(0.22, 0.018, 0.012, 0.005), silver, [-0.47, 0.35, 0.672]);
  add(printer, rounded(1.46, 0.58, 1.05, 0.15), pearl, [0, 0.94, -0.05], [-0.08, 0, 0]);
  add(printer, rounded(1.5, 0.075, 0.09, 0.025), navy, [0, 0.72, 0.54]);

  // Sculpted top output well, rollers and printed page.
  add(printer, rounded(1.02, 0.12, 0.73, 0.06), dark, [-0.1, 1.25, -0.02], [-0.08, 0, 0]);
  add(printer, rounded(0.86, 0.025, 0.61, 0.012), graphite, [-0.1, 1.32, -0.01], [-0.08, 0, 0]);
  add(printer, rounded(0.72, 0.018, 0.56, 0.006), paper, [-0.1, 1.355, -0.015], [-0.08, 0, 0]);
  add(printer, rounded(0.42, 0.012, 0.018, 0.004), blue, [-0.1, 1.372, 0.16], [-0.08, 0, 0]);
  for (const x of [-0.34, 0.14]) add(printer, new THREE.CylinderGeometry(0.055, 0.055, 0.18, 20), rubber, [x, 1.29, -0.35], [0, 0, Math.PI / 2]);

  // Folding rear input support gives the silhouette an unmistakable printer profile.
  add(printer, rounded(1.03, 0.08, 0.75, 0.045), graphite, [0, 1.27, -0.53], [-0.42, 0, 0]);
  add(printer, rounded(0.86, 0.025, 0.61, 0.015), dark, [0, 1.38, -0.69], [-0.42, 0, 0]);
  add(printer, rounded(0.065, 0.18, 0.08, 0.018), silver, [-0.42, 1.2, -0.45], [-0.42, 0, 0]);
  add(printer, rounded(0.065, 0.18, 0.08, 0.018), silver, [0.42, 1.2, -0.45], [-0.42, 0, 0]);

  // Modern front control strip with screen, navigation keys and status lamp.
  const panel = new THREE.Group();
  panel.position.set(0.44, 1.02, 0.545);
  panel.rotation.x = -0.14;
  add(panel, rounded(0.6, 0.24, 0.09, 0.045), graphite);
  add(panel, rounded(0.27, 0.14, 0.016, 0.018), screen, [-0.105, 0, 0.055]);
  for (const [x, y] of [[0.12, 0.045], [0.2, 0.045], [0.12, -0.045], [0.2, -0.045]]) add(panel, new THREE.CylinderGeometry(0.025, 0.025, 0.015, 18), silver, [x, y, 0.055], [Math.PI / 2, 0, 0]);
  add(panel, new THREE.CylinderGeometry(0.028, 0.028, 0.015, 18), green, [0.275, 0, 0.055], [Math.PI / 2, 0, 0]);
  printer.add(panel);

  // Cooling vents, side grip, access seam and branded detail.
  addVent(printer, -0.87, 0.84, 0, 7, true);
  add(printer, rounded(0.025, 0.13, 0.38, 0.012), graphite, [0.82, 0.76, -0.16]);
  add(printer, rounded(0.46, 0.075, 0.025, 0.018), navy, [-0.42, 0.92, 0.578]);
  add(printer, rounded(0.19, 0.022, 0.012, 0.005), pearl, [-0.42, 0.92, 0.596]);
  for (const x of [-0.66, 0.66]) add(printer, rounded(0.12, 0.035, 0.1, 0.015), rubber, [x, 0.025, 0.42]);
  return printer;
}

async function exportPrinter(name, object) {
  const scene = new THREE.Scene();
  scene.name = `${name} presentation asset`;
  scene.add(object);
  scene.updateMatrixWorld(true);
  const result = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, truncateDrawRange: true });
  const output = `public/uploads/University-IT-Office-Equipment-GLB-Expansion/models/${name}.glb`;
  await fs.writeFile(output, Buffer.from(result));
  console.log(`Generated ${output} (${Buffer.byteLength(result).toLocaleString()} bytes)`);
}

await exportPrinter('multifunction-printer', buildMultifunctionPrinter());
await exportPrinter('laser-printer', buildLaserPrinter());
