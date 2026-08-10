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

const aluminum = new THREE.MeshStandardMaterial({ color: 0xc9cdd0, metalness: .72, roughness: .27 });
const aluminumDark = new THREE.MeshStandardMaterial({ color: 0x8d9296, metalness: .76, roughness: .25 });
const keyMaterial = new THREE.MeshStandardMaterial({ color: 0x17191b, metalness: .08, roughness: .46 });
const bezel = new THREE.MeshStandardMaterial({ color: 0x080a0c, metalness: .12, roughness: .28 });
const screenMaterial = new THREE.MeshStandardMaterial({ color: 0x172c3d, emissive: 0x06131d, emissiveIntensity: .55, metalness: .05, roughness: .18 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x34383b, roughness: .72 });
const logoMaterial = new THREE.MeshStandardMaterial({ color: 0xa2a7aa, metalness: .85, roughness: .2, side: THREE.DoubleSide });
const geometryCache = new Map();

function cachedGeometry(key, create) {
  if (!geometryCache.has(key)) geometryCache.set(key, create());
  return geometryCache.get(key);
}

function rounded(group, size, position, material, radius = .04, segments = 3) {
  const geometry = cachedGeometry(`rounded:${size.join(',')}:${radius}:${segments}`, () => new RoundedBoxGeometry(size[0], size[1], size[2], segments, radius));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  group.add(mesh);
  return mesh;
}
function box(group, size, position, material, rotation = null) {
  const geometry = cachedGeometry(`box:${size.join(',')}`, () => new THREE.BoxGeometry(...size));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}
function cylinder(group, radius, height, position, material, rotation = null, segments = 16) {
  const geometry = cachedGeometry(`cylinder:${radius}:${height}:${segments}`, () => new THREE.CylinderGeometry(radius, radius, height, segments));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

const macbook = new THREE.Group();
macbook.name = 'Laptop';

// Thin tapered aluminum lower chassis.
rounded(macbook, [2.82, .105, 1.91], [0, .105, 0], aluminum, .075, 5);
rounded(macbook, [2.72, .035, 1.81], [0, .166, -.015], aluminum, .055, 4);

// Full-width hinge and black hinge gap.
cylinder(macbook, .055, 2.48, [0, .19, -.885], aluminumDark, [0, 0, Math.PI / 2], 24);
box(macbook, [2.4, .022, .055], [0, .185, -.86], bezel);

// Keyboard with individually modeled low-profile keys.
const rowLayouts = [
  { count: 13, width: .145, z: -.61 },
  { count: 13, width: .145, z: -.43 },
  { count: 12, width: .153, z: -.25 },
  { count: 11, width: .16, z: -.07 },
  { count: 10, width: .17, z: .11 }
];
for (const [rowIndex, row] of rowLayouts.entries()) {
  const gap = .025;
  const total = row.count * row.width + (row.count - 1) * gap;
  for (let column = 0; column < row.count; column += 1) {
    const key = rounded(macbook, [row.width, .025, .125], [-total / 2 + row.width / 2 + column * (row.width + gap), .198, row.z], keyMaterial, .018, 2);
    if (rowIndex === 0 && column === row.count - 1) key.material = bezel;
  }
}
// Bottom modifier row and wide spacebar.
for (const x of [-.98, -.78, -.58, .58, .78, .98]) rounded(macbook, [.16, .025, .125], [x, .198, .29], keyMaterial, .018, 2);
rounded(macbook, [.87, .025, .125], [0, .198, .29], keyMaterial, .018, 2);

// Large Force Touch-style trackpad, inset fully within the palm rest.
rounded(macbook, [1.24, .009, .56], [0, .188, .59], aluminumDark, .035, 4);
rounded(macbook, [1.205, .006, .525], [0, .194, .59], aluminum, .03, 4);

// Twin speaker grilles beside the keyboard.
for (const side of [-1, 1]) {
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      cylinder(macbook, .012, .012, [side * (1.17 + column * .06), .2, -.57 + row * .075], rubber, null, 10);
    }
  }
}

// Underside feet and side ports.
for (const x of [-1.19, 1.19]) for (const z of [-.72, .72]) cylinder(macbook, .045, .018, [x, .043, z], rubber);
box(macbook, [.018, .035, .28], [-1.413, .118, -.35], bezel);
box(macbook, [.018, .035, .16], [-1.413, .118, .02], bezel);
box(macbook, [.018, .035, .2], [1.413, .118, -.24], bezel);
box(macbook, [.018, .035, .07], [1.413, .118, .12], bezel);

// Display assembly, opened at the characteristic laptop viewing angle.
const lid = new THREE.Group();
lid.name = 'Display assembly';
lid.position.set(0, .19, -.89);
lid.rotation.x = -.12;
macbook.add(lid);
rounded(lid, [2.8, 1.77, .075], [0, .885, 0], aluminum, .085, 6);
rounded(lid, [2.69, 1.66, .035], [0, .885, .052], bezel, .07, 5);
rounded(lid, [2.56, 1.5, .012], [0, .85, .074], screenMaterial, .045, 4);

// Thin camera notch and camera lens.
rounded(lid, [.38, .105, .022], [0, 1.64, .086], bezel, .025, 3);
cylinder(lid, .018, .012, [0, 1.635, .102], new THREE.MeshStandardMaterial({ color: 0x132a3e, emissive: 0x06131e }), [Math.PI / 2, 0, 0], 16);

// Rear lid mark, built as a subtle inset apple-like silhouette and leaf.
const appleShape = new THREE.Shape();
appleShape.moveTo(0, .18);
appleShape.bezierCurveTo(-.11, .28, -.3, .21, -.31, .02);
appleShape.bezierCurveTo(-.32, -.17, -.18, -.34, 0, -.35);
appleShape.bezierCurveTo(.11, -.34, .17, -.27, .23, -.18);
appleShape.bezierCurveTo(.17, -.09, .18, -.01, .29, .06);
appleShape.bezierCurveTo(.22, .22, .07, .27, 0, .18);
const apple = new THREE.Mesh(new THREE.ShapeGeometry(appleShape, 18), logoMaterial);
apple.scale.set(.52, .52, .52);
apple.position.set(0, .9, -.041);
apple.rotation.y = Math.PI;
lid.add(apple);
const leaf = new THREE.Mesh(new THREE.SphereGeometry(.055, 16, 10), logoMaterial);
leaf.scale.set(1.45, .55, .16);
leaf.position.set(.055, 1.055, -.043);
leaf.rotation.z = -.55;
lid.add(leaf);

macbook.traverse((object) => {
  if (!object.isMesh) return;
  object.castShadow = true;
  object.receiveShadow = true;
});

const scene = new THREE.Scene();
scene.name = 'Laptop asset model';
scene.add(macbook);
scene.updateMatrixWorld(true);

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: true, truncateDrawRange: true });
const output = 'public/uploads/University-IT-Office-Equipment-GLB-Expansion/models/laptop.glb';
await fs.writeFile(output, Buffer.from(result));
console.log(`Generated ${output} (${Buffer.byteLength(result).toLocaleString()} bytes)`);
