import fs from 'node:fs/promises';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.({ target: this }); }); }
  };
}

const material = (color, roughness = .42, metalness = .1, extras = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extras });
const midnight = material(0x111920, .3, .3);
const graphite = material(0x2d3740, .28, .48);
const edge = material(0x65717a, .2, .72);
const silver = material(0xaeb8be, .18, .82);
const dark = material(0x090d11, .48, .18);
const rubber = material(0x161b1f, .82, .02);
const key = material(0x303a42, .55, .12);
const screen = material(0x071a29, .16, .18, { emissive: 0x062b46, emissiveIntensity: .75 });
const blue = material(0x2b9bd2, .2, .18, { emissive: 0x126b9f, emissiveIntensity: 1.6 });
const mint = material(0x54d5a1, .22, .08, { emissive: 0x168660, emissiveIntensity: 1.15 });

const rounded = (x, y, z, radius = .04, segments = 3) => new RoundedBoxGeometry(x, y, z, segments, Math.min(radius, x / 3, y / 3, z / 3));
function add(group, geometry, mat, position = [0, 0, 0], rotation = null, name = '') {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function buildWorkstation() {
  const workstation = new THREE.Group();
  workstation.name = 'MSBM premium all-in-one workstation';

  // Display chassis: slim aluminum silhouette with a layered sculpted rear shell.
  add(workstation, rounded(2.42, 1.46, .16, .095, 5), midnight, [0, 1.52, 0], null, 'display enclosure');
  add(workstation, rounded(2.3, 1.34, .025, .07, 4), screen, [0, 1.52, .096], null, 'edge-to-edge display');
  add(workstation, rounded(2.12, .055, .012, .018), blue, [0, 2.035, .115], null, 'MSBM screen accent');

  // The official MSBM lockup is applied to this screen at runtime by the shared
  // renderer. Keeping it on the 3D object makes the identity rotate with the PC.
  add(workstation, new THREE.CylinderGeometry(.026, .026, .018, 24), dark, [0, 2.205, .092], [Math.PI / 2, 0, 0], 'camera');
  add(workstation, new THREE.TorusGeometry(.033, .008, 8, 24), edge, [0, 2.205, .103]);
  add(workstation, rounded(2.05, 1.14, .09, .16, 5), graphite, [0, 1.52, -.105], null, 'rear aluminum shell');
  add(workstation, rounded(.7, .07, .022, .018), dark, [0, 1.05, -.161], null, 'rear ventilation');
  for (let slot = -5; slot <= 5; slot += 1) add(workstation, rounded(.032, .012, .018, .005), edge, [slot * .052, 1.05, -.176]);

  // Articulated neck and weight-balanced metal base.
  add(workstation, rounded(.26, .91, .16, .07, 4), graphite, [0, .62, -.035], [-.08, 0, 0], 'stand neck');
  add(workstation, rounded(.15, .7, .09, .045, 4), silver, [0, .61, .055], [-.08, 0, 0], 'stand highlight');
  add(workstation, rounded(1.23, .105, .68, .09, 5), graphite, [0, .14, .08], null, 'stand base');
  add(workstation, rounded(1.05, .035, .54, .065, 4), silver, [0, .2, .08]);
  add(workstation, rounded(.92, .025, .45, .055, 4), rubber, [0, .075, .08]);

  // Low-profile wireless keyboard with individually modeled keys.
  const keyboard = new THREE.Group();
  keyboard.position.set(-.15, .12, .98);
  keyboard.rotation.x = -.05;
  add(keyboard, rounded(1.72, .085, .62, .075, 4), graphite);
  add(keyboard, rounded(1.59, .018, .5, .045, 3), dark, [0, .053, 0]);
  const rows = [13, 13, 12, 11];
  rows.forEach((count, row) => {
    const spacing = 1.43 / 13;
    const offset = row * .035;
    for (let column = 0; column < count; column += 1) {
      const x = (column - (count - 1) / 2) * spacing + offset;
      add(keyboard, rounded(.086, .026, .085, .014, 2), key, [x, .072, -.17 + row * .11]);
    }
  });
  add(keyboard, rounded(.61, .026, .085, .018, 2), key, [.04, .072, .27]);
  workstation.add(keyboard);

  // Restrained MSBM-blue accent around the lower chin.
  add(workstation, rounded(.72, .045, .018, .014), blue, [0, .87, .1]);
  add(workstation, new THREE.CylinderGeometry(.027, .027, .018, 20), mint, [1.04, .88, .096], [Math.PI / 2, 0, 0]);
  return workstation;
}

const scene = new THREE.Scene();
scene.name = 'MSBM login workstation presentation asset';
scene.add(buildWorkstation());
scene.updateMatrixWorld(true);
const result = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, truncateDrawRange: true });
const output = 'public/generated/models/login-workstation.glb';
await fs.mkdir('public/generated/models', { recursive: true });
await fs.writeFile(output, Buffer.from(result));
console.log(`Generated ${output} (${Buffer.byteLength(result).toLocaleString()} bytes)`);
