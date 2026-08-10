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

const COLORS = {
  cyan: 0x00a7c8,
  magenta: 0xd51b6b,
  yellow: 0xf2c500,
  black: 0x17191c
};

const shell = new THREE.MeshStandardMaterial({ color: 0x292d31, roughness: 0.42, metalness: 0.18 });
const dark = new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.62, metalness: 0.08 });
const metal = new THREE.MeshStandardMaterial({ color: 0xaeb5bb, roughness: 0.26, metalness: 0.72 });

function add(group, geometry, material, position = [0, 0, 0], rotation = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function cartridge(colorName, colorValue) {
  const group = new THREE.Group();
  group.name = `${colorName} toner cartridge`;
  const color = new THREE.MeshStandardMaterial({ color: colorValue, roughness: 0.36, metalness: 0.08 });

  add(group, new RoundedBoxGeometry(2.3, 0.72, 0.82, 5, 0.11), shell, [0, 0, 0]);
  add(group, new RoundedBoxGeometry(1.68, 0.18, 0.86, 4, 0.06), color, [-0.08, 0.36, 0]);
  add(group, new RoundedBoxGeometry(0.48, 0.56, 0.72, 4, 0.08), dark, [1.04, -0.02, 0]);
  add(group, new THREE.CylinderGeometry(0.31, 0.31, 2.02, 32), metal, [-0.13, -0.34, 0], [0, 0, Math.PI / 2]);
  add(group, new THREE.CylinderGeometry(0.34, 0.34, 0.15, 28), dark, [-1.15, -0.34, 0], [0, 0, Math.PI / 2]);
  add(group, new THREE.CylinderGeometry(0.34, 0.34, 0.15, 28), dark, [0.89, -0.34, 0], [0, 0, Math.PI / 2]);
  add(group, new RoundedBoxGeometry(0.84, 0.1, 0.33, 3, 0.04), color, [-0.22, 0.5, 0]);
  add(group, new RoundedBoxGeometry(0.42, 0.08, 0.3, 3, 0.035), dark, [0.58, 0.43, 0]);

  return group;
}

async function writeModel(colorName, colorValue) {
  const scene = new THREE.Scene();
  scene.add(cartridge(colorName, colorValue));
  scene.updateMatrixWorld(true);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: true });
  const output = `public/generated/models/toner-${colorName}.glb`;
  await fs.writeFile(output, Buffer.from(result));
  console.log(`Generated ${output}`);
}

for (const [name, value] of Object.entries(COLORS)) {
  await writeModel(name, value);
}
