import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GENERATED_MODELS } from '../src/generated-models.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.({ target: this }); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const root = path.resolve('public/generated');
const modelsDir = path.join(root, 'models');
const previewsDir = path.join(root, 'previews');
await fs.mkdir(modelsDir, { recursive: true });
await fs.mkdir(previewsDir, { recursive: true });

const palette = [0x174f86, 0x355f7c, 0x475a68, 0x24496b, 0x496c5d, 0x6a536f, 0x8a5d34, 0x405779];
const dark = new THREE.MeshStandardMaterial({ color: 0x202a33, roughness: .58, metalness: .28 });
const black = new THREE.MeshStandardMaterial({ color: 0x10161c, roughness: .5, metalness: .35 });
const silver = new THREE.MeshStandardMaterial({ color: 0xaab4bd, roughness: .34, metalness: .72 });
const screen = new THREE.MeshStandardMaterial({ color: 0x173b59, emissive: 0x071c2c, roughness: .2, metalness: .12 });
const green = new THREE.MeshStandardMaterial({ color: 0x276b4a, roughness: .62, metalness: .15 });
const paper = new THREE.MeshStandardMaterial({ color: 0xf1f0e9, roughness: .9 });
const blueGlass = new THREE.MeshStandardMaterial({ color: 0x7fb4d2, transparent: true, opacity: .72, roughness: .18, metalness: .08 });
const tabletFrame = new THREE.MeshStandardMaterial({ color: 0x202a34, roughness: .22, metalness: .76 });
const tabletGlass = new THREE.MeshPhysicalMaterial({ color: 0x102d47, emissive: 0x061828, emissiveIntensity: .48, roughness: .12, metalness: .08, clearcoat: 1, clearcoatRoughness: .08 });
const toolCase = new THREE.MeshStandardMaterial({ color: 0x173c5a, roughness: .38, metalness: .42 });
const toolFoam = new THREE.MeshStandardMaterial({ color: 0x111820, roughness: .92, metalness: 0 });
const toolAccent = new THREE.MeshStandardMaterial({ color: 0xd28b24, roughness: .38, metalness: .22 });

function material(index, offset = 0) {
  return new THREE.MeshStandardMaterial({ color: palette[(index + offset) % palette.length], roughness: .52, metalness: .25 });
}
function box(group, size, position, mat = dark, rotation = null) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}
function roundedBox(group, width, height, depth, radius, position, mat, rotation = null) {
  const shape = new THREE.Shape();
  const left = -width / 2; const right = width / 2; const bottom = -height / 2; const top = height / 2;
  shape.moveTo(left + radius, bottom);
  shape.lineTo(right - radius, bottom); shape.quadraticCurveTo(right, bottom, right, bottom + radius);
  shape.lineTo(right, top - radius); shape.quadraticCurveTo(right, top, right - radius, top);
  shape.lineTo(left + radius, top); shape.quadraticCurveTo(left, top, left, top - radius);
  shape.lineTo(left, bottom + radius); shape.quadraticCurveTo(left, bottom, left + radius, bottom);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: Math.min(radius * .28, depth * .18), bevelThickness: Math.min(radius * .22, depth * .14), curveSegments: 8 });
  geometry.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}
function cylinder(group, radius, height, position, mat = dark, rotation = null, radial = 18) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radial), mat);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}
function sphere(group, radius, position, mat = dark, scale = null) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), mat);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
}
function torus(group, radius, tube, position, mat = dark, rotation = null, arc = Math.PI * 2) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 12, 32, arc), mat);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}
function rod(group, from, to, radius, mat = dark) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 12), mat);
  mesh.position.copy(start.add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  group.add(mesh);
  return mesh;
}

function addPorts(group, count, y, z, spread = 1.2) {
  for (let port = 0; port < count; port += 1) {
    const x = count === 1 ? 0 : -spread / 2 + (spread * port) / (count - 1);
    box(group, [.12, .1, .025], [x, y, z], black);
  }
}

function buildModel(entry, index) {
  const group = new THREE.Group();
  const accent = material(index);
  const accent2 = material(index, 2);
  const variant = (index % 5) * .04;

  switch (entry.shape) {
    case 'tablet': {
      // A slim, handheld landscape tablet with a machined frame, glass display,
      // camera system and hardware controls. It intentionally has no monitor stand.
      roundedBox(group, 1.82, 1.12, .105, .105, [0, .65, 0], tabletFrame);
      roundedBox(group, 1.68, .97, .018, .065, [0, .65, .064], tabletGlass);
      // A restrained dashboard composition gives the display depth without relying on textures.
      roundedBox(group, .52, .64, .009, .035, [-.5, .65, .078], new THREE.MeshBasicMaterial({ color: 0x16557b }));
      roundedBox(group, .88, .17, .009, .025, [.31, .88, .078], new THREE.MeshBasicMaterial({ color: 0x2a6689 }));
      roundedBox(group, .88, .36, .009, .025, [.31, .57, .078], new THREE.MeshBasicMaterial({ color: 0x0d3a59 }));
      for (let column = 0; column < 3; column += 1) roundedBox(group, .2, .07, .01, .018, [.08 + column * .28, .37, .081], new THREE.MeshBasicMaterial({ color: column === 1 ? 0x69b4d9 : 0x8fc7df }));
      cylinder(group, .028, .012, [0, 1.158, .067], black, [Math.PI / 2, 0, 0], 24);
      cylinder(group, .012, .014, [0, 1.158, .075], new THREE.MeshBasicMaterial({ color: 0x5b91ac }), [Math.PI / 2, 0, 0], 20);
      roundedBox(group, .24, .018, .008, .009, [0, .19, .079], silver);
      // Rear camera island and side controls remain visible as the model rotates.
      roundedBox(group, .25, .13, .025, .04, [-.72, 1.04, -.065], black);
      cylinder(group, .046, .018, [-.77, 1.04, -.084], tabletGlass, [Math.PI / 2, 0, 0], 24);
      cylinder(group, .022, .018, [-.67, 1.04, -.084], new THREE.MeshBasicMaterial({ color: 0xd9e3e8 }), [Math.PI / 2, 0, 0], 20);
      roundedBox(group, .28, .025, .022, .01, [.48, 1.22, 0], silver);
      roundedBox(group, .14, .025, .022, .01, [.76, 1.22, 0], silver);
      break;
    }
    case 'display':
      box(group, [1.75 + variant, 1.05, .12], [0, 1.15, 0], dark);
      box(group, [1.56 + variant, .85, .035], [0, 1.15, .078], screen);
      cylinder(group, .07, .55, [0, .43, 0], silver);
      box(group, [.72, .08, .42], [0, .12, .02], dark);
      break;
    case 'laptop':
      box(group, [1.55, .09, 1.05], [0, .13, .15], silver, [-.08, 0, 0]);
      box(group, [1.48, .86, .08], [0, .72, -.33], dark, [-.28, 0, 0]);
      box(group, [1.34, .7, .025], [0, .72, -.278], screen, [-.28, 0, 0]);
      for (let row = 0; row < 4; row += 1) for (let col = 0; col < 9; col += 1) box(group, [.1, .018, .075], [-.46 + col * .115, .19, -.12 + row * .095], black);
      break;
    case 'computer':
      box(group, [1.2, .38 + variant, .95], [0, .24, 0], accent);
      box(group, [.82, .03, .55], [0, .445 + variant / 2, 0], dark);
      addPorts(group, 4, .28, .49);
      cylinder(group, .035, .02, [.46, .29, .49], new THREE.MeshStandardMaterial({ color: 0x43c477, emissive: 0x0b381d }), [Math.PI / 2, 0, 0]);
      break;
    case 'rackunit':
      box(group, [1.9, .42 + variant, 1.05], [0, .25, 0], dark);
      box(group, [1.74, .29, .025], [0, .25, .538], accent);
      addPorts(group, 10, .25, .56, 1.45);
      box(group, [.12, .12, .03], [.68, .25, .56], black);
      break;
    case 'rack':
      for (const x of [-.72, .72]) for (const z of [-.45, .45]) rod(group, [x, 0, z], [x, 2.2, z], .045, dark);
      for (let shelf = 0; shelf < 5; shelf += 1) box(group, [1.5, .08, .95], [0, .18 + shelf * .46, 0], shelf % 2 ? accent : black);
      break;
    case 'network':
      box(group, [1.45, .35, .85], [0, .22, 0], accent);
      addPorts(group, 6, .23, .438, 1.05);
      for (const x of [-.5, .5]) rod(group, [x, .38, -.15], [x, 1.15, -.35], .025, dark);
      break;
    case 'camera':
      box(group, [1.05, .72, .72], [0, .74, 0], accent);
      cylinder(group, .31, .42, [0, .74, .53], black, [Math.PI / 2, 0, 0]);
      cylinder(group, .2, .44, [0, .74, .7], screen, [Math.PI / 2, 0, 0]);
      box(group, [.42, .18, .5], [.68, .86, 0], dark);
      cylinder(group, .36, .12, [0, .24, 0], dark);
      break;
    case 'tripod':
      cylinder(group, .12, .9, [0, 1.3, 0], silver);
      box(group, [.62, .18, .38], [0, 1.8, 0], accent);
      rod(group, [0, .95, 0], [-.72, 0, .45], .04, dark);
      rod(group, [0, .95, 0], [.72, 0, .45], .04, dark);
      rod(group, [0, .95, 0], [0, 0, -.72], .04, dark);
      break;
    case 'microphone':
      cylinder(group, .09, 1.25, [0, .75, 0], dark, [0, 0, -.15]);
      sphere(group, .19, [.1, 1.42, 0], silver, [1, 1.25, 1]);
      box(group, [1.25, .32, .75], [0, .22, 0], accent);
      addPorts(group, 3, .22, .39, .7);
      break;
    case 'speaker':
      box(group, [1.05, 1.65, .72], [0, .85, 0], accent);
      cylinder(group, .36, .035, [0, .68, .378], black, [Math.PI / 2, 0, 0], 24);
      cylinder(group, .17, .04, [0, 1.34, .38], black, [Math.PI / 2, 0, 0]);
      sphere(group, .1, [0, .68, .41], silver);
      break;
    case 'conference':
      box(group, [1.9, .38, .42], [0, .32, 0], accent);
      for (let x = -.65; x <= .65; x += .26) cylinder(group, .055, .03, [x, .32, .225], black, [Math.PI / 2, 0, 0]);
      cylinder(group, .16, .15, [0, .33, .29], black, [Math.PI / 2, 0, 0]);
      break;
    case 'teleprompter':
      box(group, [1.45, .85, .045], [0, 1.23, 0], screen, [-.32, 0, 0]);
      box(group, [1.5, .06, .72], [0, .62, .3], dark, [.3, 0, 0]);
      rod(group, [-.58, .45, .2], [-.58, 1.5, 0], .035, silver);
      rod(group, [.58, .45, .2], [.58, 1.5, 0], .035, silver);
      box(group, [.8, .08, .55], [0, .12, .2], dark);
      break;
    case 'printer':
      box(group, [1.5 + variant, .7, 1.0], [0, .42, 0], accent);
      box(group, [1.15, .08, .68], [0, .82, -.05], dark);
      box(group, [.9, .035, .45], [0, .47, .515], paper);
      box(group, [.34, .12, .025], [.43, .72, .51], screen);
      break;
    case 'printer3d':
      for (const x of [-.65, .65]) for (const z of [-.48, .48]) rod(group, [x, .05, z], [x, 1.75, z], .035, dark);
      box(group, [1.42, .1, 1.05], [0, .08, 0], accent);
      box(group, [1.0, .06, .72], [0, .35, 0], silver);
      rod(group, [-.62, 1.55, 0], [.62, 1.55, 0], .035, dark);
      box(group, [.22, .25, .2], [0, 1.38, 0], accent2);
      break;
    case 'storage':
      box(group, [1.05, 1.25, .9], [0, .65, 0], accent);
      for (let bay = 0; bay < 4; bay += 1) box(group, [.72, .2, .035], [0, .3 + bay * .25, .47], black);
      for (let bay = 0; bay < 4; bay += 1) cylinder(group, .025, .02, [.3, .3 + bay * .25, .495], silver, [Math.PI / 2, 0, 0]);
      break;
    case 'power':
      box(group, [1.18, .72, .72], [0, .4, 0], accent);
      box(group, [.46, .19, .025], [0, .5, .373], screen);
      for (const x of [-.35, .35]) cylinder(group, .05, .03, [x, .26, .38], black, [Math.PI / 2, 0, 0]);
      box(group, [.55, .09, .14], [0, .82, 0], dark);
      break;
    case 'generator':
      box(group, [1.35, .9, .82], [0, .62, 0], accent);
      torus(group, .24, .08, [-.52, .25, .44], black, [Math.PI / 2, 0, 0]);
      torus(group, .24, .08, [.52, .25, .44], black, [Math.PI / 2, 0, 0]);
      rod(group, [-.7, .2, -.48], [-.7, 1.35, -.48], .04, dark);
      rod(group, [.7, .2, -.48], [.7, 1.35, -.48], .04, dark);
      rod(group, [-.7, 1.35, -.48], [.7, 1.35, -.48], .04, dark);
      break;
    case 'adapter':
      box(group, [1.12, .36, .62], [0, .23, 0], accent);
      addPorts(group, 4, .24, .325, .72);
      rod(group, [.55, .22, 0], [1.0, .22, .15], .035, black);
      box(group, [.25, .13, .18], [1.12, .22, .19], silver);
      break;
    case 'cable':
      torus(group, .63, .055, [0, .65, 0], accent, [Math.PI / 2, 0, 0]);
      rod(group, [-.6, .58, 0], [-.95, .25, .25], .045, accent);
      rod(group, [.6, .58, 0], [.95, .25, -.25], .045, accent);
      box(group, [.28, .16, .22], [-1.05, .18, .3], silver);
      box(group, [.28, .16, .22], [1.05, .18, -.3], silver);
      break;
    case 'security':
      box(group, [.86, 1.4, .32], [0, .72, 0], accent);
      box(group, [.58, .5, .025], [0, .88, .174], screen);
      cylinder(group, .15, .025, [0, .42, .18], silver, [Math.PI / 2, 0, 0]);
      break;
    case 'component':
      box(group, [1.35, .14, .68], [0, .15, 0], green);
      for (let chip = 0; chip < 4; chip += 1) box(group, [.2, .1, .2], [-.42 + chip * .28, .27, 0], black);
      for (let pin = 0; pin < 8; pin += 1) box(group, [.055, .08, .12], [-.5 + pin * .145, .08, .38], silver);
      break;
    case 'keyboard':
      box(group, [1.75, .12, .7], [0, .12, 0], dark, [-.06, 0, 0]);
      for (let row = 0; row < 4; row += 1) for (let col = 0; col < 11; col += 1) box(group, [.105, .035, .09], [-.59 + col * .12, .2, -.2 + row * .13], silver);
      break;
    case 'fan':
      torus(group, .65, .08, [0, .7, 0], dark, [Math.PI / 2, 0, 0]);
      cylinder(group, .16, .16, [0, .7, 0], accent, [Math.PI / 2, 0, 0]);
      for (let blade = 0; blade < 7; blade += 1) box(group, [.47, .045, .16], [0, .7, .02], accent2, [0, 0, blade * Math.PI / 3.5]);
      break;
    case 'board':
      box(group, [1.7, .1, 1.25], [0, .14, 0], green);
      box(group, [.62, .12, .62], [0, .25, 0], black);
      for (let chip = 0; chip < 7; chip += 1) box(group, [.18, .1, .16], [-.65 + (chip % 4) * .4, .24, -.45 + Math.floor(chip / 4) * .85], dark);
      for (let slot = 0; slot < 3; slot += 1) box(group, [.08, .12, .75], [.5 + slot * .18, .24, .12], silver);
      break;
    case 'tool':
      box(group, [.72, 1.25, .3], [0, .68, 0], accent);
      box(group, [.48, .38, .025], [0, .82, .165], screen);
      for (const x of [-.17, 0, .17]) cylinder(group, .055, .03, [x, .43, .17], black, [Math.PI / 2, 0, 0]);
      rod(group, [-.18, .1, 0], [-.45, -.35, .12], .025, black);
      rod(group, [.18, .1, 0], [.45, -.35, -.12], .025, black);
      break;
    case 'toolkit': {
      // Open professional technician case: reinforced shell, fitted foam,
      // precision drivers, bits, pliers, latches and a proper carry handle.
      roundedBox(group, 1.86, .48, .96, .09, [0, .32, .12], toolCase);
      roundedBox(group, 1.68, .30, .77, .055, [0, .54, .11], toolFoam);
      const lid = new THREE.Group();
      roundedBox(lid, 1.86, .78, .13, .09, [0, .37, 0], toolCase);
      roundedBox(lid, 1.62, .57, .025, .055, [0, .37, .074], toolFoam);
      lid.position.set(0, .58, -.37);
      lid.rotation.x = -.28;
      group.add(lid);
      // Organized precision screwdriver row.
      const handleColors = [0xd28b24, 0x2e79a0, 0xd28b24, 0x2e79a0, 0xd28b24];
      for (let tool = 0; tool < 5; tool += 1) {
        const x = -.61 + tool * .305;
        cylinder(group, .07, .28, [x, .79, .15], new THREE.MeshStandardMaterial({ color: handleColors[tool], roughness: .38, metalness: .16 }), [Math.PI / 2, 0, 0], 18);
        cylinder(group, .018, .31, [x, .79, .43], silver, [Math.PI / 2, 0, 0], 12);
        for (let grip = -1; grip <= 1; grip += 1) torus(group, .071, .008, [x, .79, .12 + grip * .055], dark, [Math.PI / 2, 0, 0]);
      }
      // Bit rail and compact pliers make the contents readable at card scale.
      roundedBox(group, .86, .12, .16, .035, [-.39, .73, -.18], dark);
      for (let bit = 0; bit < 6; bit += 1) cylinder(group, .026, .12, [-.71 + bit * .13, .83, -.18], silver, null, 10);
      rod(group, [.28, .72, -.17], [.62, .92, -.08], .04, toolAccent);
      rod(group, [.34, .72, -.23], [.66, .91, -.35], .04, toolAccent);
      rod(group, [.62, .92, -.08], [.76, 1.08, -.05], .025, silver);
      rod(group, [.66, .91, -.35], [.81, 1.05, -.40], .025, silver);
      cylinder(group, .055, .05, [.63, .92, -.21], silver, [Math.PI / 2, 0, 0], 16);
      // Front hardware, shell ribs and a stable U-shaped handle.
      for (const x of [-.52, .52]) {
        roundedBox(group, .22, .15, .07, .025, [x, .38, .625], silver);
        box(group, [.06, .42, .03], [x, .32, -.375], dark);
      }
      rod(group, [-.35, .28, .64], [-.35, -.02, .68], .045, dark);
      rod(group, [.35, .28, .64], [.35, -.02, .68], .045, dark);
      rod(group, [-.35, -.02, .68], [.35, -.02, .68], .045, dark);
      roundedBox(group, .36, .12, .025, .025, [0, .38, .637], toolAccent);
      break;
    }
    case 'office':
      box(group, [1.5, .55, .86], [0, .32, 0], accent);
      box(group, [1.22, .07, .6], [0, .63, -.02], dark);
      box(group, [.82, .035, .52], [0, .48, .45], paper);
      for (const x of [-.45, .45]) cylinder(group, .07, .08, [x, .22, .46], black, [Math.PI / 2, 0, 0]);
      break;
    case 'stand':
      box(group, [1.3, .08, .8], [0, .12, 0], silver, [0, 0, -.15]);
      rod(group, [-.52, .12, -.28], [-.52, .95, -.45], .04, dark);
      rod(group, [.52, .12, -.28], [.52, .95, -.45], .04, dark);
      rod(group, [-.52, .95, -.45], [.52, .95, -.45], .04, dark);
      break;
    case 'roll':
      cylinder(group, .58, .72, [0, .62, 0], paper, [0, 0, Math.PI / 2], 28);
      cylinder(group, .2, .76, [0, .62, 0], dark, [0, 0, Math.PI / 2]);
      box(group, [.7, .035, .55], [.58, .18, 0], paper, [0, 0, -.2]);
      break;
    case 'consumable':
      box(group, [1.15, .82, .65], [0, .45, 0], paper);
      box(group, [.75, .34, .025], [0, .5, .338], accent);
      for (let unit = 0; unit < 4; unit += 1) cylinder(group, .085, .62, [-.34 + unit * .23, .46, 0], silver);
      break;
    case 'headphones':
      torus(group, .72, .09, [0, .85, 0], dark, [0, 0, 0], Math.PI);
      box(group, [.25, .62, .34], [-.72, .52, 0], accent, [0, 0, -.08]);
      box(group, [.25, .62, .34], [.72, .52, 0], accent, [0, 0, .08]);
      box(group, [.12, .46, .4], [-.56, .55, 0], black);
      box(group, [.12, .46, .4], [.56, .55, 0], black);
      break;
    case 'laptopbag':
      box(group, [1.65, 1.05, .34], [0, .58, 0], accent);
      box(group, [1.48, .025, .24], [0, .63, .183], dark);
      torus(group, .42, .055, [0, 1.15, 0], dark, [Math.PI / 2, 0, 0], Math.PI);
      box(group, [.62, .38, .025], [0, .47, .185], accent2);
      break;
    case 'cablelock':
      torus(group, .62, .045, [-.18, .72, 0], dark);
      box(group, [.38, .48, .28], [.72, .3, .08], accent);
      torus(group, .16, .035, [.72, .57, .08], silver, [0, 0, 0], Math.PI);
      cylinder(group, .055, .04, [.72, .3, .24], black, [Math.PI / 2, 0, 0]);
      break;
    case 'airconditioner':
      box(group, [2.0, .65, .55], [0, .72, 0], paper);
      box(group, [1.82, .18, .035], [0, .49, .293], dark);
      for (let vent = 0; vent < 9; vent += 1) box(group, [.12, .025, .04], [-.7 + vent * .175, .49, .32], silver);
      box(group, [.3, .1, .025], [.7, .83, .29], screen);
      break;
    case 'standingfan':
      torus(group, .57, .055, [0, 1.45, 0], dark);
      cylinder(group, .13, .12, [0, 1.45, 0], accent, [Math.PI / 2, 0, 0]);
      for (let blade = 0; blade < 5; blade += 1) box(group, [.42, .035, .15], [0, 1.45, .02], accent2, [0, 0, blade * Math.PI / 2.5]);
      cylinder(group, .055, 1.1, [0, .66, 0], silver);
      cylinder(group, .52, .08, [0, .08, 0], dark);
      break;
    case 'refrigerator':
      box(group, [1.05, 1.95, .78], [0, .99, 0], paper);
      box(group, [.92, .025, .68], [0, 1.34, .405], silver);
      box(group, [.92, .025, .68], [0, .48, .405], silver);
      rod(group, [.36, 1.08, .43], [.36, 1.72, .43], .025, dark);
      rod(group, [.36, .24, .43], [.36, .72, .43], .025, dark);
      break;
    case 'microwave':
      box(group, [1.65, .9, .85], [0, .48, 0], silver);
      box(group, [1.05, .62, .025], [-.22, .5, .44], black);
      box(group, [.3, .2, .025], [.58, .65, .44], screen);
      for (let button = 0; button < 3; button += 1) cylinder(group, .04, .025, [.5 + button * .1, .42, .45], dark, [Math.PI / 2, 0, 0]);
      break;
    case 'waterdispenser':
      box(group, [.82, 1.35, .72], [0, .69, 0], paper);
      cylinder(group, .28, .72, [0, 1.65, 0], blueGlass);
      sphere(group, .28, [0, 1.98, 0], blueGlass, [1, .45, 1]);
      for (const x of [-.18, .18]) cylinder(group, .055, .12, [x, .9, .39], x < 0 ? accent : dark, [Math.PI / 2, 0, 0]);
      box(group, [.5, .38, .025], [0, .51, .37], dark);
      break;
    case 'appliance':
      cylinder(group, .52, .9, [0, .53, 0], silver);
      torus(group, .48, .07, [.42, .65, 0], dark, [Math.PI / 2, 0, 0], Math.PI);
      cylinder(group, .16, .22, [0, 1.06, 0], accent);
      box(group, [.9, .08, .72], [0, .06, 0], dark);
      break;
    case 'furniture':
      box(group, [1.35, 1.9, .72], [0, .96, 0], accent);
      box(group, [.62, 1.72, .025], [-.33, .98, .375], paper);
      box(group, [.62, 1.72, .025], [.33, .98, .375], paper);
      for (const x of [-.1, .1]) cylinder(group, .025, .14, [x, .98, .42], dark, [0, 0, 0]);
      break;
    case 'drone':
      box(group, [.72, .24, .48], [0, .55, 0], accent);
      for (const [x, z] of [[-.72, -.55], [.72, -.55], [-.72, .55], [.72, .55]]) {
        rod(group, [0, .55, 0], [x, .55, z], .035, dark);
        cylinder(group, .08, .12, [x, .55, z], silver);
        torus(group, .32, .018, [x, .65, z], black, [Math.PI / 2, 0, 0]);
      }
      sphere(group, .16, [0, .3, .24], screen);
      break;
    case 'staplekit':
      box(group, [1.45, .42, .9], [0, .25, 0], accent);
      for (let strip = 0; strip < 5; strip += 1) box(group, [.18, .16, .65], [-.45 + strip * .23, .52, 0], silver);
      box(group, [1.18, .035, .74], [0, .48, 0], paper);
      break;
    case 'otherequipment':
      box(group, [1.35, 1.15, 1.0], [0, .6, 0], accent);
      box(group, [.68, .68, .025], [0, .66, .515], paper);
      torus(group, .19, .055, [0, .73, .54], dark, [0, 0, 0], Math.PI * 1.35);
      cylinder(group, .055, .07, [.08, .43, .54], dark, [Math.PI / 2, 0, 0]);
      break;
    default:
      box(group, [1.3, .8, .9], [0, .45, 0], accent);
  }

  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = 2.4 / Math.max(size.x, size.y, size.z, 1);
  group.scale.setScalar(scale);
  group.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(group);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  group.position.set(-center.x, -scaledBounds.min.y, -center.z);
  group.name = entry.name;
  return group;
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function previewArtwork(entry) {
  const common = 'fill="url(#g)" stroke="#17222c" stroke-width="5" stroke-linejoin="round"';
  const screenFill = 'fill="#163a55" stroke="#0c1d29" stroke-width="4"';
  switch (entry.shape) {
    case 'tablet': return `<rect x="69" y="73" width="282" height="174" rx="22" fill="#202b34" stroke="#111a21" stroke-width="7"/><rect x="83" y="87" width="254" height="146" rx="13" fill="#102f49" stroke="#31546d" stroke-width="3"/><rect x="101" y="105" width="77" height="108" rx="8" fill="#176086"/><rect x="194" y="105" width="121" height="33" rx="7" fill="#2f7195"/><rect x="194" y="151" width="121" height="62" rx="7" fill="#0b3b59"/><circle cx="210" cy="81" r="4" fill="#70a8c2"/><rect x="191" y="222" width="38" height="4" rx="2" fill="#aab8c0"/>`;
    case 'display': {
      if (entry.id === 'portable-monitor') return `<rect x="94" y="82" width="232" height="144" rx="10" ${common}/><rect x="108" y="96" width="204" height="112" rx="3" ${screenFill}/><path d="M146 229h128l22 23H124z" fill="#596875" stroke="#17222c" stroke-width="4"/>`;
      if (entry.id === 'smart-board' || entry.id === 'interactive-panel') return `<rect x="69" y="54" width="282" height="184" rx="8" ${common}/><rect x="84" y="70" width="252" height="146" rx="3" fill="#eaf0f4" stroke="#17222c" stroke-width="4"/><path d="M115 178l48-46 42 31 57-69 44 42" fill="none" stroke="#2a79b8" stroke-width="8"/><circle cx="324" cy="226" r="5" fill="#58bd82"/>`;
      return `<rect x="72" y="68" width="276" height="166" rx="9" ${common}/><rect x="88" y="84" width="244" height="130" rx="3" ${screenFill}/><path d="M176 236h68l12 20h-92z" fill="#66727c" stroke="#17222c" stroke-width="4"/>`;
    }
    case 'laptop': return `<path d="M118 68h184q13 0 13 13v117H105V81q0-13 13-13z" ${common}/><rect x="121" y="84" width="178" height="99" rx="3" ${screenFill}/><path d="M78 201h264l25 31q4 10-13 12H66q-17-2-13-12z" fill="#aeb8c0" stroke="#17222c" stroke-width="5"/><rect x="172" y="207" width="76" height="22" rx="5" fill="#818e98"/>`;
    case 'computer': {
      if (entry.id === 'graphics-workstation') return `<path d="M148 48h124q13 0 13 13v185H135V61q0-13 13-13z" ${common}/><rect x="153" y="68" width="114" height="33" rx="4" fill="#101820"/><circle cx="210" cy="166" r="43" fill="#101820" stroke="#667986" stroke-width="7"/><circle cx="210" cy="166" r="12" fill="#2d7db5"/><rect x="161" y="225" width="58" height="8" rx="4" fill="#5f7280"/>`;
      if (entry.id === 'mini-pc' || entry.id === 'digital-signage-player') return `<rect x="102" y="91" width="216" height="142" rx="20" ${common}/><rect x="122" y="112" width="176" height="86" rx="10" fill="#1b2934"/><circle cx="278" cy="215" r="7" fill="#59c486"/><rect x="133" y="211" width="68" height="9" rx="4" fill="#82929e"/>`;
      return `<rect x="151" y="48" width="118" height="198" rx="10" ${common}/><rect x="168" y="66" width="84" height="68" rx="5" fill="#111b23"/><circle cx="210" cy="181" r="32" fill="#111b23" stroke="#657784" stroke-width="6"/><circle cx="210" cy="181" r="7" fill="#3486bd"/><circle cx="244" cy="228" r="6" fill="#59c486"/>`;
    }
    case 'rackunit': return `<rect x="58" y="104" width="304" height="116" rx="9" ${common}/><rect x="76" y="125" width="268" height="72" rx="4" fill="#111a21"/>${Array.from({ length: 10 }, (_, i) => `<rect x="${91 + i * 22}" y="143" width="14" height="22" rx="2" fill="#607889"/>`).join('')}<circle cx="317" cy="181" r="6" fill="#58c487"/><path d="M46 119h12v87H46M362 119h12v87h-12" fill="none" stroke="#17222c" stroke-width="7"/>`;
    case 'rack': return `<rect x="104" y="38" width="212" height="218" rx="4" fill="none" stroke="#273844" stroke-width="11"/>${[70,105,140,175,210].map((y, i) => `<rect x="121" y="${y}" width="178" height="25" rx="3" fill="${i % 2 ? '#365f7a' : '#17222c'}"/><circle cx="281" cy="${y + 12}" r="4" fill="#5ed08c"/>`).join('')}`;
    case 'network': return `<rect x="87" y="96" width="246" height="128" rx="16" ${common}/><path d="M120 96l-12-45M300 96l12-45" stroke="#263945" stroke-width="9" stroke-linecap="round"/>${Array.from({ length: 6 }, (_, i) => `<rect x="${119 + i * 31}" y="155" width="22" height="17" rx="2" fill="#101820"/><circle cx="${130 + i * 31}" cy="187" r="4" fill="#59c486"/>`).join('')}`;
    case 'camera': return `<rect x="119" y="92" width="182" height="126" rx="17" ${common}/><circle cx="210" cy="155" r="52" fill="#111a22" stroke="#687b89" stroke-width="9"/><circle cx="210" cy="155" r="31" fill="#183e5b" stroke="#0b151c" stroke-width="7"/><circle cx="198" cy="143" r="8" fill="#6bb0dc" opacity=".75"/><rect x="144" y="67" width="58" height="29" rx="7" fill="#293c48"/>`;
    case 'tripod': return `<rect x="158" y="48" width="104" height="68" rx="10" ${common}/><circle cx="210" cy="126" r="13" fill="#71818c"/><path d="M210 138v29M210 165L126 250M210 165l84 85M210 165v88" fill="none" stroke="#293a46" stroke-width="11" stroke-linecap="round"/>`;
    case 'microphone': return `<rect x="92" y="156" width="236" height="76" rx="14" ${common}/><path d="M180 155l22-91q5-18 21-14l19 5q16 5 11 23l-25 92" fill="#202b33" stroke="#17222c" stroke-width="6"/><ellipse cx="228" cy="67" rx="31" ry="39" fill="#9aa7b0" stroke="#17222c" stroke-width="6"/>${[120,154,188,222,256,290].map((x) => `<rect x="${x}" y="184" width="18" height="17" rx="3" fill="#101820"/>`).join('')}`;
    case 'speaker': return `<rect x="126" y="42" width="168" height="210" rx="15" ${common}/><circle cx="210" cy="172" r="58" fill="#101820" stroke="#5f7180" stroke-width="8"/><circle cx="210" cy="172" r="19" fill="#536b7c"/><circle cx="210" cy="82" r="25" fill="#101820" stroke="#667a88" stroke-width="6"/>`;
    case 'conference': return `<rect x="63" y="122" width="294" height="91" rx="34" ${common}/><circle cx="210" cy="167" r="29" fill="#101820"/><circle cx="210" cy="167" r="12" fill="#3b789f"/>${[104,132,288,316].map((x) => `<circle cx="${x}" cy="167" r="7" fill="#738591"/>`).join('')}`;
    case 'teleprompter': return `<path d="M105 64h210l-24 142H129z" fill="#173b58" fill-opacity=".82" stroke="#17222c" stroke-width="7"/><path d="M145 213h130l-19 34h-92z" ${common}/><path d="M138 202L118 252M282 202l20 50" stroke="#394c59" stroke-width="8"/>`;
    case 'printer': return `<path d="M130 58h160v69H130z" fill="#eef1f3" stroke="#17222c" stroke-width="5"/><rect x="84" y="116" width="252" height="119" rx="16" ${common}/><rect x="119" y="153" width="182" height="61" rx="5" fill="#17222c"/><path d="M143 174h134v80H143z" fill="#f8f8f4" stroke="#9ba5ac" stroke-width="4"/><rect x="273" y="132" width="40" height="19" rx="4" fill="#397da5"/>`;
    case 'printer3d': return `<rect x="91" y="47" width="238" height="205" rx="5" fill="none" stroke="#263945" stroke-width="10"/><path d="M114 220h192v22H114zM117 70h186" fill="#315b77" stroke="#17222c" stroke-width="6"/><path d="M210 70v64" stroke="#607b8c" stroke-width="8"/><path d="M180 213l30-76 30 76z" fill="#4b86a9" stroke="#17222c" stroke-width="5"/>`;
    case 'storage': return `<rect x="126" y="47" width="168" height="203" rx="15" ${common}/>${[75,113,151,189].map((y) => `<rect x="149" y="${y}" width="122" height="27" rx="4" fill="#111b23"/><circle cx="252" cy="${y + 13}" r="5" fill="#56c184"/>`).join('')}`;
    case 'power': return `<rect x="119" y="80" width="182" height="154" rx="18" ${common}/><rect x="147" y="104" width="126" height="49" rx="6" ${screenFill}/><path d="M178 181h64M193 166v30M227 166v30" stroke="#9eadb7" stroke-width="8" stroke-linecap="round"/><rect x="167" y="59" width="86" height="25" rx="6" fill="#293c48"/>`;
    case 'generator': return `<rect x="106" y="82" width="208" height="140" rx="16" ${common}/><circle cx="146" cy="220" r="34" fill="#17222c" stroke="#657681" stroke-width="8"/><circle cx="276" cy="220" r="34" fill="#17222c" stroke="#657681" stroke-width="8"/><path d="M87 79V49h246v30" fill="none" stroke="#293a45" stroke-width="11"/><rect x="140" y="110" width="140" height="62" rx="7" fill="#18242c"/><circle cx="252" cy="141" r="11" fill="#58c487"/>`;
    case 'adapter': return `<rect x="101" y="108" width="218" height="105" rx="18" ${common}/>${[132,166,200,234].map((x) => `<rect x="${x}" y="143" width="22" height="21" rx="3" fill="#111a21"/>`).join('')}<path d="M319 160c38 0 37 43 70 43" fill="none" stroke="#17222c" stroke-width="10"/><rect x="372" y="187" width="31" height="29" rx="4" fill="#aab4bb" stroke="#17222c" stroke-width="4"/>`;
    case 'cable': return `<path d="M124 196c-70-93 72-159 145-87 68 68-26 145-86 83-43-44 12-91 53-59" fill="none" stroke="url(#g)" stroke-width="15" stroke-linecap="round"/><path d="M123 196l-43 37M237 133l64-46" stroke="#1d2b35" stroke-width="14"/><rect x="48" y="218" width="45" height="28" rx="5" fill="#aab5bc" stroke="#17222c" stroke-width="4"/><rect x="294" y="66" width="53" height="32" rx="5" fill="#aab5bc" stroke="#17222c" stroke-width="4"/>`;
    case 'security': return `<rect x="139" y="45" width="142" height="205" rx="18" ${common}/><rect x="158" y="70" width="104" height="79" rx="8" ${screenFill}/><path d="M182 191c0-39 56-39 56 0 0 27-14 40-28 47-14-7-28-20-28-47z" fill="#9aa8b1" stroke="#17222c" stroke-width="5"/><path d="M197 190c0-18 26-18 26 0" fill="none" stroke="#456c86" stroke-width="5"/>`;
    case 'component': {
      if (entry.id.includes('usb') || entry.id.includes('security-key')) return `<rect x="104" y="113" width="206" height="95" rx="17" ${common}/><rect x="297" y="132" width="69" height="57" rx="4" fill="#aeb8bf" stroke="#17222c" stroke-width="5"/><circle cx="137" cy="160" r="15" fill="#17222c"/>`;
      if (entry.id.includes('sd-memory')) return `<path d="M151 55h92l47 47v143H130V76z" ${common}/>${[159,181,203,225].map((x) => `<rect x="${x}" y="68" width="13" height="40" fill="#d9b65e"/>`).join('')}<rect x="157" y="137" width="106" height="68" rx="7" fill="#17222c"/>`;
      if (entry.id.includes('solid-state')) return `<rect x="105" y="75" width="210" height="166" rx="13" ${common}/><rect x="131" y="105" width="158" height="95" rx="7" fill="#17222c"/><circle cx="128" cy="98" r="7" fill="#aab5bd"/><circle cx="292" cy="218" r="7" fill="#aab5bd"/>`;
      return `<rect x="82" y="111" width="256" height="94" rx="7" fill="#31704d" stroke="#17222c" stroke-width="5"/>${[112,157,202,247].map((x) => `<rect x="${x}" y="132" width="33" height="35" rx="4" fill="#17222c"/>`).join('')}${Array.from({ length: 11 }, (_, i) => `<rect x="${103 + i * 21}" y="202" width="11" height="20" fill="#d1ac50"/>`).join('')}`;
    }
    case 'keyboard': return `<path d="M69 93h282l24 136H45z" ${common}/>${Array.from({ length: 4 }, (_, row) => Array.from({ length: 10 }, (_, col) => `<rect x="${73 + col * 27}" y="${115 + row * 25}" width="20" height="17" rx="3" fill="#aab5bc"/>`).join('')).join('')}<rect x="154" y="211" width="112" height="14" rx="4" fill="#aab5bc"/>`;
    case 'fan': return `<circle cx="210" cy="154" r="111" fill="#202c35" stroke="#17222c" stroke-width="7"/><circle cx="210" cy="154" r="25" fill="url(#g)"/>${Array.from({ length: 7 }, (_, i) => `<ellipse cx="210" cy="93" rx="24" ry="57" fill="url(#g)" transform="rotate(${i * 51.43} 210 154)" opacity=".9"/>`).join('')}<circle cx="210" cy="154" r="17" fill="#17222c"/>`;
    case 'board': return `<rect x="73" y="55" width="274" height="190" rx="8" fill="#35724f" stroke="#17222c" stroke-width="6"/><rect x="157" y="96" width="104" height="82" rx="7" fill="#17222c"/><path d="M92 91h48v24H92zM282 81h43v74h-43zM97 191h78v34H97z" fill="#aab5bc"/>${[181,198,215,232].map((x) => `<rect x="${x}" y="190" width="11" height="40" fill="#d0ad52"/>`).join('')}`;
    case 'tool': return `<rect x="153" y="48" width="114" height="174" rx="18" ${common}/><rect x="171" y="75" width="78" height="59" rx="7" ${screenFill}/><circle cx="210" cy="177" r="29" fill="#17222c" stroke="#83919a" stroke-width="5"/><path d="M176 220l-52 38M244 220l52 38" stroke="#17222c" stroke-width="10" stroke-linecap="round"/>`;
    case 'toolkit': return `<path d="M84 116h252l-21-72H105z" fill="#173c5a" stroke="#17222c" stroke-width="6"/><path d="M111 101h198l-12-41H123z" fill="#111820" stroke="#47687c" stroke-width="4"/>${[143,176,209,242,275].map((x,i) => `<rect x="${x}" y="66" width="13" height="32" rx="6" fill="${i % 2 ? '#2e79a0' : '#d28b24'}"/><path d="M${x + 6} 66V55" stroke="#aab5bc" stroke-width="4"/>`).join('')}<rect x="72" y="112" width="276" height="120" rx="16" fill="#173c5a" stroke="#17222c" stroke-width="7"/><rect x="90" y="126" width="240" height="77" rx="10" fill="#111820"/>${[123,157,191,225,259].map((x,i) => `<rect x="${x}" y="140" width="15" height="46" rx="7" fill="${i % 2 ? '#2e79a0' : '#d28b24'}"/><path d="M${x + 7} 140V127" stroke="#aab5bc" stroke-width="4"/>`).join('')}<rect x="111" y="215" width="38" height="19" rx="4" fill="#aab5bc"/><rect x="271" y="215" width="38" height="19" rx="4" fill="#aab5bc"/><path d="M164 232v18h92v-18" fill="none" stroke="#263843" stroke-width="11" stroke-linecap="round"/>`;
    case 'office': return `<rect x="84" y="104" width="252" height="130" rx="18" ${common}/><path d="M118 91h184v79H118z" fill="#f6f5ef" stroke="#17222c" stroke-width="5"/><rect x="126" y="144" width="168" height="59" rx="7" fill="#17222c"/><path d="M155 179h110v76H155z" fill="#f8f7f2" stroke="#929ea6" stroke-width="4"/>`;
    case 'stand': return `<path d="M104 205h212l-34 39H138z" fill="#aeb7bd" stroke="#17222c" stroke-width="6"/><path d="M143 205l20-133M277 205L257 72M163 72h94" fill="none" stroke="#263945" stroke-width="12" stroke-linecap="round"/>`;
    case 'roll': return `<ellipse cx="210" cy="99" rx="83" ry="51" fill="#f8f7f1" stroke="#17222c" stroke-width="6"/><path d="M127 99v106c0 28 166 28 166 0V99" fill="#eeede7" stroke="#17222c" stroke-width="6"/><ellipse cx="210" cy="99" rx="30" ry="19" fill="#293a44"/><path d="M253 214h86v37h-122" fill="#faf9f4" stroke="#9aa4aa" stroke-width="4"/>`;
    case 'consumable': return `<rect x="109" y="70" width="202" height="174" rx="13" fill="#f5f3ec" stroke="#17222c" stroke-width="6"/><rect x="136" y="103" width="148" height="70" rx="8" fill="url(#g)"/>${[151,185,219,253].map((x) => `<rect x="${x}" y="188" width="18" height="39" rx="9" fill="#aab5bc" stroke="#17222c" stroke-width="3"/>`).join('')}`;
    case 'headphones': return `<path d="M113 160V128c0-69 44-101 97-101s97 32 97 101v32" fill="none" stroke="#263945" stroke-width="18"/><rect x="88" y="143" width="59" height="94" rx="24" ${common}/><rect x="273" y="143" width="59" height="94" rx="24" ${common}/><rect x="132" y="160" width="24" height="62" rx="10" fill="#17222c"/><rect x="264" y="160" width="24" height="62" rx="10" fill="#17222c"/>`;
    case 'laptopbag': return `<rect x="85" y="92" width="250" height="145" rx="18" ${common}/><path d="M158 93V72q0-23 23-23h58q23 0 23 23v21" fill="none" stroke="#263945" stroke-width="12"/><rect x="142" y="136" width="136" height="65" rx="9" fill="#24496b" stroke="#17222c" stroke-width="5"/><path d="M96 116h228" stroke="#aab5bc" stroke-width="5"/>`;
    case 'cablelock': return `<path d="M86 188c-35-112 133-156 195-63 44 67-30 129-94 84-49-34-8-92 37-68" fill="none" stroke="#263945" stroke-width="13" stroke-linecap="round"/><rect x="277" y="151" width="77" height="83" rx="12" ${common}/><path d="M296 151v-20q0-28 20-28t20 28v20" fill="none" stroke="#aab5bc" stroke-width="10"/><circle cx="316" cy="190" r="7" fill="#17222c"/>`;
    case 'airconditioner': return `<rect x="60" y="83" width="300" height="124" rx="22" fill="#f2f4f5" stroke="#17222c" stroke-width="6"/><path d="M73 166h274v29H73z" fill="#263945"/><path d="M92 177h236" stroke="#9eabb5" stroke-width="4" stroke-dasharray="17 9"/><rect x="289" y="108" width="43" height="18" rx="4" ${screenFill}/><path d="M92 137h236" stroke="#c4ccd2" stroke-width="5"/>`;
    case 'standingfan': return `<circle cx="210" cy="108" r="76" fill="#eef1f3" stroke="#263945" stroke-width="8"/><circle cx="210" cy="108" r="15" fill="#17222c"/>${Array.from({ length: 5 }, (_, i) => `<ellipse cx="210" cy="71" rx="15" ry="41" fill="url(#g)" transform="rotate(${i * 72} 210 108)"/>`).join('')}<path d="M210 184v66" stroke="#596a76" stroke-width="12"/><ellipse cx="210" cy="253" rx="67" ry="13" fill="#263945"/>`;
    case 'refrigerator': return `<rect x="139" y="38" width="142" height="216" rx="10" fill="#eef1f3" stroke="#17222c" stroke-width="7"/><path d="M139 119h142" stroke="#7f8d97" stroke-width="5"/><path d="M251 64v35M251 147v66" stroke="#263945" stroke-width="9" stroke-linecap="round"/><circle cx="159" cy="237" r="5" fill="#58bd82"/>`;
    case 'microwave': return `<rect x="72" y="94" width="276" height="145" rx="14" fill="#aeb8c0" stroke="#17222c" stroke-width="7"/><rect x="94" y="116" width="173" height="99" rx="7" fill="#182630" stroke="#0b151c" stroke-width="5"/><rect x="286" y="120" width="40" height="25" rx="4" ${screenFill}/>${[164,184,204].map(y => `<circle cx="306" cy="${y}" r="7" fill="#263945"/>`).join('')}`;
    case 'waterdispenser': return `<path d="M179 49q31-18 62 0l-7 74h-48z" fill="#8ec4df" fill-opacity=".75" stroke="#315b77" stroke-width="5"/><rect x="151" y="109" width="118" height="145" rx="12" fill="#eef1f3" stroke="#17222c" stroke-width="6"/><circle cx="184" cy="159" r="9" fill="#2a79b8"/><circle cx="236" cy="159" r="9" fill="#b75b4b"/><rect x="176" y="185" width="68" height="50" rx="6" fill="#263945"/>`;
    case 'appliance': return `<path d="M137 105q8-47 73-47t73 47l-14 126H151z" fill="#aeb8c0" stroke="#17222c" stroke-width="7"/><path d="M280 118q66 17 34 86-11 23-40 25" fill="none" stroke="#263945" stroke-width="14"/><rect x="166" y="86" width="88" height="24" rx="8" ${common}/><ellipse cx="210" cy="235" rx="70" ry="12" fill="#263945"/>`;
    case 'furniture': return `<rect x="124" y="43" width="172" height="211" rx="7" ${common}/><rect x="137" y="57" width="73" height="181" fill="#edf0f2" stroke="#17222c" stroke-width="4"/><rect x="210" y="57" width="73" height="181" fill="#edf0f2" stroke="#17222c" stroke-width="4"/><circle cx="199" cy="149" r="5" fill="#263945"/><circle cx="221" cy="149" r="5" fill="#263945"/>`;
    case 'drone': return `<rect x="165" y="130" width="90" height="48" rx="16" ${common}/><path d="M172 140L104 90M248 140l68-50M172 168l-68 50M248 168l68 50" stroke="#263945" stroke-width="10"/>${[[91,82],[329,82],[91,226],[329,226]].map(([x,y]) => `<ellipse cx="${x}" cy="${y}" rx="51" ry="13" fill="none" stroke="#17222c" stroke-width="6"/><circle cx="${x}" cy="${y}" r="9" fill="#738591"/>`).join('')}<circle cx="210" cy="181" r="15" ${screenFill}/>`;
    case 'staplekit': return `<rect x="91" y="109" width="238" height="123" rx="14" ${common}/><path d="M111 137h198v72H111z" fill="#f4f3ed" stroke="#17222c" stroke-width="5"/>${[136,171,206,241,276].map(x => `<rect x="${x}" y="148" width="18" height="50" rx="3" fill="#aeb8c0" stroke="#596875" stroke-width="3"/>`).join('')}`;
    case 'otherequipment': return `<rect x="116" y="66" width="188" height="181" rx="17" ${common}/><circle cx="210" cy="145" r="53" fill="#f1f2f4" stroke="#17222c" stroke-width="6"/><path d="M184 127q2-30 29-30 28 0 30 24 1 20-21 32-12 7-12 22" fill="none" stroke="#263945" stroke-width="12" stroke-linecap="round"/><circle cx="210" cy="198" r="8" fill="#263945"/>`;
    default: return `<rect x="104" y="75" width="212" height="166" rx="18" ${common}/>`;
  }
}

function previewSvg(entry, index) {
  const color = `#${palette[index % palette.length].toString(16).padStart(6, '0')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="320" viewBox="0 0 420 320">
  <defs><radialGradient id="b"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#edf1f5"/></radialGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#1c2731"/></linearGradient></defs>
  <rect width="420" height="320" fill="url(#b)"/>
  <ellipse cx="210" cy="256" rx="112" ry="18" fill="#bcc5ce" opacity=".32"/>
  ${previewArtwork(entry)}
  <text x="210" y="286" text-anchor="middle" font-family="Arial,sans-serif" font-weight="600" font-size="15" fill="#3d4954">${escapeXml(entry.name)}</text>
  </svg>`;
}

const requestedModels = new Set(process.argv.slice(2));
const exporter = new GLTFExporter();
let generatedCount = 0;
for (let index = 0; index < GENERATED_MODELS.length; index += 1) {
  const entry = GENERATED_MODELS[index];
  if (requestedModels.size && !requestedModels.has(entry.id)) continue;
  const scene = new THREE.Scene();
  scene.name = `${entry.name} asset model`;
  scene.add(buildModel(entry, index));
  scene.updateMatrixWorld(true);
  const data = await exporter.parseAsync(scene, { binary: true, onlyVisible: true, truncateDrawRange: true });
  await fs.writeFile(path.join(modelsDir, `${entry.id}.glb`), Buffer.from(data));
  await fs.writeFile(path.join(previewsDir, `${entry.id}.svg`), previewSvg(entry, index), 'utf8');
  generatedCount += 1;
}

console.log(`Generated ${generatedCount} GLB models and ${generatedCount} SVG previews in ${root}`);
