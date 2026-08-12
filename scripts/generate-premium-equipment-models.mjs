import fs from 'node:fs/promises';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.({ target: this }); }); }
  };
}

const mat = (color, roughness = .45, metalness = .1, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
const graphite = mat(0x222a30, .3, .55);
const black = mat(0x0d1216, .62, .16);
const rubber = mat(0x14191c, .88, .01);
const silver = mat(0xaeb9c1, .22, .78);
const aluminium = mat(0x77858f, .28, .68);
const navy = mat(0x123f67, .28, .4);
const blue = mat(0x2477a6, .3, .25);
const screen = mat(0x123b58, .1, .12, { emissive: 0x0a3856, emissiveIntensity: .72 });
const glass = mat(0x1b3341, .12, .3, { transparent: true, opacity: .72 });
const greenPcb = mat(0x174f3b, .48, .12);
const copper = mat(0xb66b2c, .24, .78);
const gold = mat(0xd2a948, .2, .82);
const cyan = mat(0x37bfe5, .18, .32, { emissive: 0x08769e, emissiveIntensity: .85 });

const roundedGeometryCache = new Map();
const cylinderGeometryCache = new Map();
const ringGeometryCache = new Map();
const rounded = (x, y, z, radius = .04, segments = 3) => {
  const safeRadius = Math.min(radius, x / 3, y / 3, z / 3);
  const key = [x, y, z, safeRadius, segments].join(':');
  if (!roundedGeometryCache.has(key)) roundedGeometryCache.set(key, new RoundedBoxGeometry(x, y, z, segments, safeRadius));
  return roundedGeometryCache.get(key);
};
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
function box(group, size, material, position, rotation = null, radius = .035, name = '') {
  return add(group, rounded(...size, radius), material, position, rotation, name);
}
function cylinder(group, radius, height, material, position, rotation = null, segments = 28, name = '') {
  const key = [radius, height, segments].join(':');
  if (!cylinderGeometryCache.has(key)) cylinderGeometryCache.set(key, new THREE.CylinderGeometry(radius, radius, height, segments));
  return add(group, cylinderGeometryCache.get(key), material, position, rotation, name);
}
function ring(group, radius, tube, material, position, rotation = null, segments = 32) {
  const key = [radius, tube, segments].join(':');
  if (!ringGeometryCache.has(key)) ringGeometryCache.set(key, new THREE.TorusGeometry(radius, tube, 12, segments));
  return add(group, ringGeometryCache.get(key), material, position, rotation);
}
function rod(group, from, to, radius, material) {
  const start = new THREE.Vector3(...from); const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const mesh = cylinder(group, radius, direction.length(), material, [0, 0, 0], null, 16);
  mesh.position.copy(start.clone().add(end).multiplyScalar(.5));
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function buildChromebook() {
  const g = new THREE.Group(); g.name = 'Premium Chromebook';
  const base = new THREE.Group(); base.rotation.x = -.045;
  box(base, [1.86, .105, 1.17], aluminium, [0, .16, .18], null, .065, 'Aluminium keyboard deck');
  box(base, [1.72, .02, 1.02], graphite, [0, .224, .14], null, .028);
  for (let row = 0; row < 5; row += 1) for (let col = 0; col < 12; col += 1) {
    const wide = row === 4 && col === 5;
    if (row === 4 && col > 5 && col < 9) continue;
    box(base, [wide ? .42 : .105, .025, .095], black, [-.68 + col * .124, .247, -.22 + row * .13], null, .014);
  }
  box(base, [.66, .015, .39], aluminium, [0, .248, .42], null, .035, 'Glass trackpad');
  g.add(base);
  const lid = new THREE.Group(); lid.position.set(0, .22, -.38); lid.rotation.x = -.27;
  box(lid, [1.83, 1.13, .085], graphite, [0, .58, 0], null, .065);
  box(lid, [1.68, .96, .018], screen, [0, .58, .052], null, .035, 'Display glass');
  box(lid, [.48, .62, .009], navy, [-.5, .58, .065], null, .025);
  box(lid, [.84, .17, .009], blue, [.31, .82, .065], null, .02);
  box(lid, [.84, .34, .009], mat(0x0a2d44, .18), [.31, .53, .065], null, .02);
  cylinder(lid, .022, .012, black, [0, 1.115, .052], [Math.PI / 2, 0, 0], 20, 'Webcam');
  g.add(lid);
  for (const x of [-.64, .64]) cylinder(g, .055, .26, graphite, [x, .25, -.38], [0, 0, Math.PI / 2], 20, 'Hinge');
  return g;
}

function buildCoolingFan() {
  const g = new THREE.Group(); g.name = 'Premium CPU cooling fan';
  box(g, [1.56, .16, 1.56], graphite, [0, .43, 0], null, .13, 'Fan frame');
  box(g, [1.34, .18, 1.34], black, [0, .44, 0], null, .28);
  cylinder(g, .67, .19, rubber, [0, .45, 0], null, 48, 'Fan cavity');
  cylinder(g, .19, .24, graphite, [0, .48, 0], null, 32, 'Motor hub');
  cylinder(g, .12, .255, navy, [0, .49, 0], null, 28);
  for (let blade = 0; blade < 9; blade += 1) {
    const angle = blade * Math.PI * 2 / 9;
    const part = box(g, [.48, .055, .18], mat(blade % 2 ? 0x313c43 : 0x263139, .4, .34), [Math.cos(angle) * .34, .55, Math.sin(angle) * .34], [0, -angle + .42, 0], .07, 'Sculpted fan blade');
    part.scale.z = .72;
  }
  for (const [x, z] of [[-.64, -.64], [.64, -.64], [-.64, .64], [.64, .64]]) {
    cylinder(g, .095, .2, black, [x, .47, z], null, 24);
    cylinder(g, .045, .215, silver, [x, .48, z], null, 20);
  }
  for (let fin = 0; fin < 13; fin += 1) box(g, [1.12, .032, .72], aluminium, [0, .12 + fin * .023, 0], null, .006);
  for (const x of [-.38, .38]) ring(g, .37, .035, copper, [x, .17, 0], [Math.PI / 2, 0, 0], 36);
  return g;
}

function buildMotherboard() {
  const g = new THREE.Group(); g.name = 'Detailed ATX motherboard';
  box(g, [1.78, .075, 1.48], greenPcb, [0, .12, 0], null, .035, 'ATX PCB');
  for (const [x, z] of [[-.78, -.62], [.78, -.62], [-.78, .62], [.78, .62], [0, .62], [0, -.62]]) {
    cylinder(g, .035, .1, gold, [x, .17, z], null, 16);
  }
  box(g, [.58, .065, .58], silver, [-.25, .205, -.12], null, .035, 'CPU socket');
  box(g, [.45, .085, .45], graphite, [-.25, .28, -.12], null, .025, 'CPU cover');
  for (let slot = 0; slot < 4; slot += 1) {
    box(g, [.055, .13, .85], slot % 2 ? black : navy, [.25 + slot * .105, .22, -.18], null, .015, 'DIMM slot');
    box(g, [.07, .12, .055], silver, [.25 + slot * .105, .22, -.63], null, .012);
  }
  for (let slot = 0; slot < 3; slot += 1) box(g, [1.02 - slot * .12, .12, .07], slot === 0 ? silver : black, [-.13, .22, .39 + slot * .14], null, .018, 'PCIe slot');
  box(g, [.42, .22, .39], aluminium, [-.65, .25, -.42], null, .035, 'VRM heatsink');
  for (let fin = 0; fin < 6; fin += 1) box(g, [.035, .1, .34], graphite, [-.81 + fin * .064, .39, -.42], null, .006);
  box(g, [.5, .18, .26], aluminium, [.56, .23, .38], null, .035, 'Chipset heatsink');
  for (let cap = 0; cap < 10; cap += 1) cylinder(g, .032, .14, cap % 3 ? black : gold, [-.65 + (cap % 5) * .15, .24, .03 + Math.floor(cap / 5) * .13], null, 16, 'Capacitor');
  for (let port = 0; port < 6; port += 1) box(g, [.13, .25, .16], port % 2 ? silver : graphite, [-.82 + port * .16, .25, -.7], null, .02, 'Rear IO port');
  return g;
}

function buildConferenceBar() {
  const g = new THREE.Group(); g.name = 'Professional video conference bar';
  box(g, [2.12, .48, .42], graphite, [0, .53, 0], null, .18, 'Conference bar enclosure');
  box(g, [1.97, .34, .025], rubber, [0, .53, .224], null, .13, 'Acoustic fabric grille');
  for (let hole = 0; hole < 26; hole += 1) cylinder(g, .012, .012, black, [-.88 + hole * .07, .47 + (hole % 2) * .09, .242], [Math.PI / 2, 0, 0], 10);
  cylinder(g, .2, .14, black, [0, .57, .27], [Math.PI / 2, 0, 0], 32, 'Camera bezel');
  cylinder(g, .135, .15, screen, [0, .57, .31], [Math.PI / 2, 0, 0], 32, 'Camera lens');
  cylinder(g, .055, .155, glass, [-.15, .64, .31], [Math.PI / 2, 0, 0], 24, 'Wide-angle sensor');
  for (const x of [-.72, -.55, .55, .72]) cylinder(g, .026, .03, black, [x, .57, .238], [Math.PI / 2, 0, 0], 16, 'Microphone');
  box(g, [.42, .025, .015], cyan, [0, .33, .24], null, .01, 'Status light');
  box(g, [.58, .12, .38], aluminium, [0, .18, -.04], null, .055, 'Wall mount');
  return g;
}

function buildSpeakerphone() {
  const g = new THREE.Group(); g.name = 'Premium conference speakerphone';
  cylinder(g, .82, .21, graphite, [0, .23, 0], null, 48, 'Speakerphone body');
  cylinder(g, .7, .045, rubber, [0, .355, 0], null, 48, 'Acoustic fabric top');
  for (let hole = 0; hole < 32; hole += 1) {
    const angle = hole * Math.PI * 2 / 32; const radius = .52 + (hole % 2) * .08;
    cylinder(g, .012, .016, black, [Math.cos(angle) * radius, .384, Math.sin(angle) * radius], null, 10);
  }
  cylinder(g, .25, .06, navy, [0, .39, 0], null, 32, 'Touch control');
  cylinder(g, .18, .065, screen, [0, .425, 0], null, 32, 'Control display');
  for (let key = 0; key < 4; key += 1) {
    const angle = key * Math.PI / 2;
    cylinder(g, .045, .02, key === 0 ? mat(0xc24b47, .35) : silver, [Math.cos(angle) * .39, .39, Math.sin(angle) * .39], null, 18);
  }
  ring(g, .77, .018, cyan, [0, .34, 0], [Math.PI / 2, 0, 0], 48);
  box(g, [.62, .05, .16], rubber, [0, .085, 0], null, .02);
  return g;
}

function buildDesktopSpeakers() {
  const g = new THREE.Group(); g.name = 'Premium stereo desktop speakers';
  for (const side of [-1, 1]) {
    const x = side * .68;
    box(g, [.58, 1.32, .55], side < 0 ? graphite : navy, [x, .7, 0], null, .12, 'Speaker cabinet');
    box(g, [.49, 1.2, .025], rubber, [x, .72, .29], null, .1, 'Fabric grille');
    cylinder(g, .215, .055, black, [x, .58, .315], [Math.PI / 2, 0, 0], 36, 'Woofer surround');
    cylinder(g, .145, .062, aluminium, [x, .58, .34], [Math.PI / 2, 0, 0], 36, 'Woofer cone');
    cylinder(g, .055, .068, silver, [x, .58, .365], [Math.PI / 2, 0, 0], 28, 'Dust cap');
    cylinder(g, .095, .055, black, [x, 1.08, .315], [Math.PI / 2, 0, 0], 32, 'Tweeter');
    cylinder(g, .04, .06, silver, [x, 1.08, .345], [Math.PI / 2, 0, 0], 24);
    box(g, [.43, .055, .44], rubber, [x, .045, 0], null, .03, 'Isolation foot');
    box(g, [.23, .018, .012], cyan, [x, .27, .329], null, .005);
  }
  rod(g, [-.4, .18, -.18], [.4, .18, -.18], .018, black);
  return g;
}

function buildDesktopTower() {
  const g = new THREE.Group(); g.name = 'Premium desktop workstation tower';
  box(g, [1.03, 1.88, 1.34], graphite, [0, .98, 0], null, .12, 'Workstation chassis');
  box(g, [.9, 1.72, .035], rubber, [0, 1, .69], null, .085, 'Front mesh');
  for (let row = 0; row < 18; row += 1) for (let col = 0; col < 7; col += 1) cylinder(g, .012, .012, black, [-.3 + col * .1, .32 + row * .08, .715], [Math.PI / 2, 0, 0], 8);
  for (const y of [.62, 1.18]) {
    ring(g, .28, .025, cyan, [0, y, .73], null, 40);
    cylinder(g, .08, .035, graphite, [0, y, .745], [Math.PI / 2, 0, 0], 28);
    for (let blade = 0; blade < 7; blade += 1) box(g, [.22, .018, .07], navy, [0, y, .75], [0, 0, blade * Math.PI / 3.5], .025);
  }
  box(g, [.035, 1.66, 1.14], glass, [.54, 1, -.02], null, .035, 'Tempered glass side panel');
  box(g, [.025, .82, .48], navy, [.565, .82, .22], null, .02, 'Internal motherboard');
  box(g, [.04, .18, .72], silver, [.58, .75, -.25], null, .02, 'Graphics card');
  for (let vent = 0; vent < 8; vent += 1) box(g, [.07, .02, .52], black, [-.32 + vent * .09, 1.945, 0], null, .008);
  cylinder(g, .045, .03, cyan, [.31, 1.93, .38], null, 20, 'Power key');
  for (const x of [-.2, -.06]) box(g, [.08, .025, .045], black, [x, 1.94, .4], null, .008, 'USB port');
  for (const x of [-.39, .39]) for (const z of [-.5, .5]) box(g, [.12, .08, .12], rubber, [x, .02, z], null, .025);
  return g;
}

function buildCamcorder() {
  const g = new THREE.Group(); g.name = 'Premium digital camcorder';
  box(g, [1.18, .82, .72], graphite, [0, .62, 0], null, .16, 'Camcorder body');
  cylinder(g, .34, .52, black, [0, .66, .56], [Math.PI / 2, 0, 0], 40, 'Lens barrel');
  cylinder(g, .25, .56, aluminium, [0, .66, .69], [Math.PI / 2, 0, 0], 40, 'Focus ring');
  cylinder(g, .185, .58, screen, [0, .66, .8], [Math.PI / 2, 0, 0], 40, 'Optical lens');
  cylinder(g, .075, .59, glass, [-.08, .73, .82], [Math.PI / 2, 0, 0], 28, 'Lens highlight');
  box(g, [.92, .18, .29], rubber, [0, 1.15, -.03], null, .075, 'Top carry handle');
  rod(g, [-.37, .88, -.06], [-.37, 1.15, -.03], .045, graphite);
  rod(g, [.37, .88, -.06], [.37, 1.15, -.03], .045, graphite);
  cylinder(g, .095, .62, rubber, [0, 1.32, .08], [Math.PI / 2, 0, 0], 28, 'Shotgun microphone');
  const display = new THREE.Group(); display.position.set(-.7, .69, -.05); display.rotation.y = -.24;
  box(display, [.58, .42, .055], graphite, [0, 0, 0], null, .055, 'Flip-out display');
  box(display, [.48, .32, .012], screen, [-.015, 0, -.035], null, .028);
  g.add(display);
  box(g, [.23, .12, .025], cyan, [.38, .82, .375], null, .02, 'Record status panel');
  cylinder(g, .06, .03, mat(0xc44740, .32), [.4, .57, .38], [Math.PI / 2, 0, 0], 20, 'Record button');
  box(g, [.62, .08, .48], rubber, [0, .14, -.02], null, .035, 'Tripod plate');
  return g;
}

function buildProcessor() {
  const g = new THREE.Group(); g.name = 'Premium desktop processor';
  box(g, [1.18, .09, 1.18], greenPcb, [0, .17, 0], null, .08, 'Processor substrate');
  box(g, [.9, .12, .9], silver, [0, .275, 0], null, .08, 'Integrated heat spreader');
  box(g, [.64, .018, .06], aluminium, [0, .345, -.18], null, .012);
  box(g, [.45, .018, .035], graphite, [0, .347, -.08], null, .008);
  for (let row = 0; row < 10; row += 1) for (let col = 0; col < 10; col += 1) {
    if (row > 2 && row < 7 && col > 2 && col < 7) continue;
    cylinder(g, .015, .025, gold, [-.48 + col * .107, .105, -.48 + row * .107], null, 10, 'Gold contact');
  }
  for (const [x, z] of [[-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) cylinder(g, .035, .12, graphite, [x, .2, z], null, 16);
  return g;
}

function buildBarcodeScanner() {
  const g = new THREE.Group(); g.name = 'Premium handheld barcode scanner';
  const head = new THREE.Group(); head.rotation.x = -.12;
  box(head, [.82, .52, .66], graphite, [0, 1.03, .08], null, .18, 'Scanner head');
  box(head, [.62, .33, .035], black, [0, 1.04, .427], null, .1, 'Scan window bezel');
  box(head, [.49, .22, .018], screen, [0, 1.04, .452], null, .06, 'Optical scan window');
  box(head, [.3, .025, .012], cyan, [0, .91, .466], null, .008, 'Scan illumination');
  for (const x of [-.28, .28]) box(head, [.05, .24, .42], rubber, [x, 1.02, .05], null, .025);
  g.add(head);
  const grip = new THREE.Group(); grip.rotation.z = -.2;
  box(grip, [.38, .95, .4], graphite, [.15, .5, -.04], null, .14, 'Ergonomic grip');
  for (let ridge = 0; ridge < 5; ridge += 1) box(grip, [.33, .025, .28], rubber, [.15, .24 + ridge * .13, -.23], null, .009);
  box(grip, [.17, .25, .05], mat(0x2993af, .28, .25), [.01, .67, .19], null, .04, 'Trigger');
  g.add(grip);
  box(g, [.5, .13, .48], rubber, [.31, .055, -.05], null, .06, 'Battery cap');
  cylinder(g, .035, .018, mat(0x5de0a1, .22, .1, { emissive: 0x168f5b, emissiveIntensity: 1 }), [.24, 1.28, .31], [Math.PI / 2, 0, 0], 18, 'Ready indicator');
  return g;
}

function buildSecurityKey() {
  const g = new THREE.Group(); g.name = 'Premium hardware security key';
  box(g, [1.15, .17, .46], graphite, [-.15, .22, 0], null, .18, 'Security key body');
  box(g, [.52, .13, .39], silver, [.68, .22, 0], null, .035, 'USB connector');
  box(g, [.24, .145, .13], black, [.93, .22, 0], null, .014);
  for (const z of [-.1, .1]) box(g, [.04, .02, .07], gold, [.75, .295, z], null, .005, 'USB contact');
  cylinder(g, .16, .195, gold, [-.22, .25, 0], null, 32, 'Touch sensor');
  cylinder(g, .11, .202, black, [-.22, .255, 0], null, 32);
  cylinder(g, .065, .21, cyan, [-.22, .26, 0], null, 28, 'Touch indicator');
  ring(g, .18, .055, graphite, [-.69, .23, 0], [Math.PI / 2, 0, 0], 32);
  cylinder(g, .07, .19, black, [-.69, .23, 0], null, 24, 'Keyring opening');
  box(g, [.22, .015, .012], silver, [.17, .31, 0], null, .004);
  return g;
}

function buildHdmiCable() {
  const g = new THREE.Group(); g.name = 'Premium braided HDMI cable';
  const cable = mat(0x191f24, .7, .06);
  for (let loop = 0; loop < 3; loop += 1) ring(g, .57 - loop * .055, .035, cable, [0, .28 + loop * .025, 0], [Math.PI / 2, 0, 0], 48);
  rod(g, [-.55, .27, .06], [-.92, .27, .38], .035, cable);
  rod(g, [.55, .31, -.04], [.92, .31, -.38], .035, cable);
  for (const [side, z] of [[-1, .38], [1, -.38]]) {
    const x = side * 1.03;
    box(g, [.3, .18, .34], graphite, [x, .3, z], null, .055, 'Moulded connector grip');
    box(g, [.22, .11, .3], silver, [x + side * .22, .3, z], null, .025, 'HDMI connector shell');
    box(g, [.09, .065, .21], black, [x + side * .34, .3, z], null, .012, 'HDMI port face');
    for (let pin = 0; pin < 5; pin += 1) box(g, [.012, .015, .018], gold, [x + side * .388, .3, z - .07 + pin * .035], null, .003);
    for (let ridge = -1; ridge <= 1; ridge += 1) box(g, [.035, .19, .025], rubber, [x - side * .07 + ridge * side * .06, .3, z + .17], null, .006);
  }
  return g;
}

function buildInteractivePanel() {
  const g = new THREE.Group(); g.name = 'Premium interactive classroom panel';
  box(g, [2.28, 1.35, .14], graphite, [0, .93, 0], null, .065, 'Interactive display chassis');
  box(g, [2.08, 1.13, .025], screen, [0, .96, .085], null, .035, 'Anti-glare touch display');
  box(g, [.48, .74, .012], navy, [-.66, .96, .103], null, .025, 'Touch UI navigation');
  for (let tile = 0; tile < 6; tile += 1) box(g, [.27, .18, .012], tile % 2 ? blue : mat(0x2d607d, .28), [.03 + (tile % 2) * .42, 1.25 - Math.floor(tile / 2) * .28, .104], null, .025, 'Touch UI tile');
  box(g, [1.46, .095, .18], graphite, [0, .205, .04], null, .035, 'Stylus and control tray');
  for (const x of [-.42, -.25]) cylinder(g, .025, .43, x < -.3 ? cyan : silver, [x, .27, .1], [0, 0, Math.PI / 2], 16, 'Digital stylus');
  box(g, [.58, .12, .16], aluminium, [0, .1, -.04], null, .04, 'Wall mounting rail');
  cylinder(g, .035, .02, mat(0x4de19a, .2, .1, { emissive: 0x14784f, emissiveIntensity: 1 }), [.91, .31, .1], [Math.PI / 2, 0, 0], 18, 'Power status');
  cylinder(g, .045, .025, black, [0, 1.575, .085], [Math.PI / 2, 0, 0], 20, 'Integrated camera');
  for (const x of [-.85, .85]) for (let slot = 0; slot < 5; slot += 1) box(g, [.12, .018, .012], black, [x, .48 + slot * .12, .095], null, .004, 'Speaker grille');
  return g;
}

function buildKvmSwitch() {
  const g = new THREE.Group(); g.name = 'Professional KVM switch';
  box(g, [1.78, .38, .96], graphite, [0, .31, 0], null, .09, 'Metal KVM enclosure');
  box(g, [1.64, .27, .035], black, [0, .32, .5], null, .055, 'Front control panel');
  for (let channel = 0; channel < 4; channel += 1) {
    const x = -.59 + channel * .39;
    cylinder(g, .055, .045, channel === 0 ? cyan : silver, [x, .36, .525], [Math.PI / 2, 0, 0], 20, `Channel ${channel + 1}`);
    box(g, [.16, .018, .012], channel === 0 ? cyan : aluminium, [x, .22, .525], null, .005);
  }
  for (const x of [-.33, .33]) {
    box(g, [.24, .12, .05], black, [x, .31, .535], null, .018, 'Front USB port');
    box(g, [.16, .06, .012], silver, [x, .31, .565], null, .008);
  }
  for (let port = 0; port < 4; port += 1) {
    const x = -.6 + port * .4;
    box(g, [.23, .11, .04], black, [x, .37, -.5], null, .018, 'Rear HDMI port');
    box(g, [.14, .055, .02], gold, [x, .37, -.525], null, .006);
  }
  for (let vent = 0; vent < 9; vent += 1) box(g, [.025, .025, .46], black, [-.62 + vent * .155, .515, -.05], null, .006, 'Cooling vent');
  for (const x of [-.95, .95]) box(g, [.16, .08, .35], aluminium, [x, .28, 0], null, .025, 'Rack ear');
  return g;
}

function buildLabelApplicator() {
  const g = new THREE.Group(); g.name = 'Premium handheld label applicator';
  box(g, [1.2, .64, .58], navy, [0, .92, .04], null, .2, 'Applicator housing');
  cylinder(g, .27, .61, graphite, [-.31, 1.06, .02], [Math.PI / 2, 0, 0], 36, 'Label roll housing');
  cylinder(g, .19, .63, mat(0xf2f1eb, .82), [-.31, 1.06, .03], [Math.PI / 2, 0, 0], 36, 'Label roll');
  cylinder(g, .075, .65, black, [-.31, 1.06, .04], [Math.PI / 2, 0, 0], 24);
  box(g, [.68, .18, .5], graphite, [.64, .89, .03], null, .07, 'Dispensing nose');
  cylinder(g, .075, .54, rubber, [.91, .82, .05], [Math.PI / 2, 0, 0], 24, 'Application roller');
  box(g, [.56, .86, .38], graphite, [.04, .42, -.02], [0, 0, -.24], .14, 'Ergonomic handle');
  for (let ridge = 0; ridge < 4; ridge += 1) box(g, [.38, .025, .28], rubber, [.13 + ridge * .03, .18 + ridge * .13, -.22], [0, 0, -.24], .007);
  box(g, [.34, .27, .08], mat(0xd89226, .36, .2), [.35, .66, .19], [0, 0, -.15], .06, 'Trigger');
  box(g, [.42, .028, .31], mat(0xf7f7f3, .88), [.58, 1.2, .16], [0, 0, -.08], .008, 'Loaded label');
  box(g, [.18, .015, .012], cyan, [.58, 1.22, .33], null, .004);
  return g;
}

function buildOfficePhone() {
  const g = new THREE.Group(); g.name = 'Premium IP office phone';
  box(g, [1.58, .3, 1.18], graphite, [0, .28, 0], [-.08, 0, 0], .12, 'Desk phone base');
  box(g, [.74, .43, .08], black, [.24, .58, -.18], [-.22, 0, 0], .055, 'Display bezel');
  box(g, [.62, .32, .018], screen, [.24, .6, -.13], [-.22, 0, 0], .035, 'Colour display');
  for (let row = 0; row < 4; row += 1) for (let col = 0; col < 3; col += 1) cylinder(g, .055, .035, row === 3 ? aluminium : silver, [.2 + col * .2, .27, .05 + row * .17], [Math.PI / 2, 0, 0], 18, 'Keypad key');
  for (let key = 0; key < 4; key += 1) cylinder(g, .042, .035, key === 0 ? mat(0x4bb37c, .3) : key === 1 ? mat(0xc7554d, .3) : silver, [-.02 + key * .14, .26, -.22], [Math.PI / 2, 0, 0], 18, 'Function key');
  const handset = new THREE.Group(); handset.rotation.z = -.04;
  box(handset, [.38, .34, .38], graphite, [-.57, .58, -.34], null, .12, 'Handset earpiece');
  box(handset, [.38, .34, .38], graphite, [-.57, .58, .5], null, .12, 'Handset microphone');
  box(handset, [.29, .24, .78], graphite, [-.57, .58, .08], null, .1, 'Handset grip');
  box(handset, [.2, .16, .56], rubber, [-.57, .61, .08], null, .07);
  g.add(handset);
  ring(g, .22, .025, black, [-.72, .08, .5], [Math.PI / 2, 0, 0], 32);
  return g;
}

function buildLaptopBag() {
  const g = new THREE.Group(); g.name = 'Premium laptop shoulder bag';
  const fabric = mat(0x1d3547, .86, .02);
  box(g, [1.78, 1.15, .38], fabric, [0, .63, 0], null, .14, 'Padded laptop bag');
  box(g, [1.58, .68, .045], navy, [0, .53, .218], null, .1, 'Front organizer pocket');
  box(g, [1.38, .035, .025], silver, [0, .78, .247], null, .009, 'Front zipper');
  box(g, [1.56, .035, .025], black, [0, 1.12, .02], null, .009, 'Main zipper');
  for (const x of [-.47, .47]) rod(g, [x, 1.14, 0], [x, 1.48, 0], .045, graphite);
  rod(g, [-.47, 1.48, 0], [.47, 1.48, 0], .045, graphite);
  box(g, [.55, .12, .11], rubber, [0, 1.48, 0], null, .045, 'Comfort handle');
  for (const x of [-.82, .82]) {
    cylinder(g, .065, .08, silver, [x, 1.02, -.17], [Math.PI / 2, 0, 0], 20, 'Strap ring');
    box(g, [.12, .18, .08], graphite, [x, .98, -.17], null, .035);
  }
  rod(g, [-.82, 1.04, -.18], [.62, 1.62, -.22], .035, black);
  box(g, [.38, .12, .12], rubber, [-.05, 1.36, -.22], [.18, 0, -.38], .045, 'Shoulder pad');
  box(g, [.54, .055, .025], cyan, [-.42, .45, .245], null, .012, 'Brand detail');
  return g;
}

function buildLaptopBattery() {
  const g = new THREE.Group(); g.name = 'Premium removable laptop battery';
  box(g, [1.86, .32, .72], graphite, [0, .28, 0], null, .1, 'Battery enclosure');
  box(g, [1.5, .14, .5], black, [-.08, .47, 0], null, .065, 'Cell housing');
  for (let cell = 0; cell < 5; cell += 1) cylinder(g, .105, .48, mat(cell % 2 ? 0x284c66 : 0x365d76, .48, .18), [-.6 + cell * .3, .49, 0], [Math.PI / 2, 0, 0], 24, 'Battery cell contour');
  box(g, [.48, .22, .22], graphite, [.72, .35, -.38], null, .045, 'Connector block');
  for (let pin = 0; pin < 7; pin += 1) box(g, [.035, .08, .025], gold, [.57 + pin * .05, .37, -.505], null, .006, 'Battery contact');
  for (const x of [-.72, .72]) box(g, [.22, .13, .18], aluminium, [x, .21, .37], null, .035, 'Release latch');
  box(g, [.5, .025, .012], navy, [-.25, .27, .371], null, .006);
  for (let light = 0; light < 4; light += 1) cylinder(g, .022, .018, light < 3 ? mat(0x49d58f, .25, .1, { emissive: 0x176f4c, emissiveIntensity: .8 }) : silver, [.18 + light * .08, .27, .38], [Math.PI / 2, 0, 0], 14, 'Charge indicator');
  return g;
}

function buildMultimeter() {
  const g = new THREE.Group(); g.name = 'Professional digital multimeter';
  const yellow = mat(0xe5a328, .48, .08);
  box(g, [.94, 1.58, .38], yellow, [0, .85, 0], null, .18, 'Protective meter shell');
  box(g, [.76, 1.38, .055], graphite, [0, .86, .22], null, .12, 'Meter face');
  box(g, [.61, .38, .018], screen, [0, 1.28, .258], null, .05, 'Backlit LCD');
  for (let digit = 0; digit < 4; digit += 1) box(g, [.09, .035, .01], cyan, [-.2 + digit * .14, 1.28, .272], null, .008);
  cylinder(g, .235, .055, black, [0, .78, .265], [Math.PI / 2, 0, 0], 40, 'Selector dial');
  cylinder(g, .17, .065, aluminium, [0, .78, .295], [Math.PI / 2, 0, 0], 32);
  box(g, [.045, .15, .018], yellow, [0, .88, .337], [0, 0, -.35], .01, 'Dial pointer');
  for (const [x, color] of [[-.24, 0x15191c], [0, 0x3177a3], [.24, 0xc9463e]]) {
    cylinder(g, .07, .065, mat(color, .45), [x, .39, .27], [Math.PI / 2, 0, 0], 24, 'Probe jack');
  }
  for (let ridge = 0; ridge < 5; ridge += 1) box(g, [.035, .17, .22], rubber, [-.475, .52 + ridge * .19, 0], null, .01);
  rod(g, [-.24, .35, .1], [-.7, -.08, .34], .022, black);
  rod(g, [.24, .35, .1], [.7, -.08, -.34], .022, mat(0xb83732, .52));
  for (const [x, z, color] of [[-.78, .4, black], [.78, -.4, mat(0xb83732, .52)]]) {
    cylinder(g, .045, .5, color, [x, -.16, z], [0, 0, -.65 * Math.sign(x)], 16, 'Test probe');
    cylinder(g, .018, .2, silver, [x + .13 * Math.sign(x), -.34, z], [0, 0, -.65 * Math.sign(x)], 12);
  }
  return g;
}

function buildProjector() {
  const g = new THREE.Group(); g.name = 'Premium digital laser projector';
  const ivory = mat(0xe9eceb, .31, .08);
  box(g, [1.82, .67, 1.27], ivory, [0, .45, 0], null, .16, 'Projector enclosure');
  box(g, [1.65, .1, 1.08], mat(0xf7f8f6, .26), [0, .82, 0], null, .08, 'Top control deck');
  cylinder(g, .34, .34, graphite, [.46, .49, .69], [Math.PI / 2, 0, 0], 40, 'Lens barrel');
  cylinder(g, .245, .38, aluminium, [.46, .49, .82], [Math.PI / 2, 0, 0], 40, 'Focus ring');
  cylinder(g, .175, .4, screen, [.46, .49, .9], [Math.PI / 2, 0, 0], 40, 'Projection lens');
  cylinder(g, .06, .405, glass, [.4, .56, .91], [Math.PI / 2, 0, 0], 24, 'Lens reflection');
  for (let vent = 0; vent < 11; vent += 1) box(g, [.035, .28, .035], graphite, [-.78 + vent * .065, .46, .65], null, .008, 'Cooling vent');
  for (let key = 0; key < 5; key += 1) cylinder(g, .035, .025, key === 0 ? cyan : silver, [-.35 + key * .16, .88, .1], null, 18, 'Projector control');
  box(g, [.55, .12, .08], black, [-.48, .44, -.66], null, .025, 'Rear IO panel');
  for (let port = 0; port < 3; port += 1) box(g, [.12, .06, .025], gold, [-.65 + port * .17, .44, -.71], null, .008, 'Video input');
  for (const [x, z] of [[-.68, -.45], [.68, -.45], [-.68, .45], [.68, .45]]) box(g, [.15, .08, .14], rubber, [x, .055, z], null, .025, 'Projector foot');
  return g;
}

function buildSignagePlayer() {
  const g = new THREE.Group(); g.name = 'Premium digital signage media player';
  box(g, [1.46, .34, 1.02], graphite, [0, .28, 0], null, .11, 'Fanless media player');
  box(g, [1.27, .035, .84], aluminium, [0, .47, 0], null, .07, 'Brushed aluminium top');
  for (let fin = 0; fin < 9; fin += 1) box(g, [.055, .08, .74], black, [-.48 + fin * .12, .52, 0], null, .012, 'Cooling fin');
  box(g, [1.25, .22, .035], black, [0, .28, .53], null, .05, 'Front panel');
  for (const x of [-.38, -.18]) box(g, [.14, .07, .025], silver, [x, .28, .555], null, .01, 'USB port');
  cylinder(g, .045, .025, cyan, [.48, .29, .555], [Math.PI / 2, 0, 0], 18, 'Status indicator');
  box(g, [1.16, .22, .035], black, [0, .3, -.53], null, .045, 'Rear IO panel');
  for (const [x, material] of [[-.38, gold], [-.12, silver], [.16, silver], [.4, black]]) box(g, [.18, .08, .025], material, [x, .3, -.555], null, .012, 'Media connection');
  for (const x of [-.56, .56]) box(g, [.18, .06, .22], aluminium, [x, .055, 0], null, .025, 'VESA mounting tab');
  return g;
}

function buildDisplayPortCable() {
  const g = new THREE.Group(); g.name = 'Premium braided DisplayPort cable';
  const braid = mat(0x20272c, .76, .05);
  for (let loop = 0; loop < 3; loop += 1) ring(g, .58 - loop * .06, .037, braid, [0, .3 + loop * .025, 0], [Math.PI / 2, 0, 0], 48);
  rod(g, [-.55, .29, .07], [-.9, .3, .38], .038, braid);
  rod(g, [.55, .34, -.06], [.9, .34, -.38], .038, braid);
  for (const [side, z] of [[-1, .38], [1, -.38]]) {
    const x = side * 1.03;
    box(g, [.33, .2, .35], graphite, [x, .32, z], null, .055, 'DisplayPort grip');
    for (let ridge = 0; ridge < 3; ridge += 1) box(g, [.035, .18, .28], rubber, [x - side * .08 + ridge * side * .06, .32, z], null, .008);
    box(g, [.24, .13, .29], silver, [x + side * .23, .32, z], null, .028, 'DisplayPort shell');
    box(g, [.1, .07, .2], black, [x + side * .37, .32, z], null, .012, 'DisplayPort face');
    box(g, [.12, .035, .09], aluminium, [x + side * .06, .44, z], null, .012, 'Release latch');
    for (let pin = 0; pin < 5; pin += 1) box(g, [.012, .012, .02], gold, [x + side * .425, .32, z - .07 + pin * .035], null, .002);
  }
  return g;
}

function buildDocumentCamera() {
  const g = new THREE.Group(); g.name = 'Premium document visualizer camera';
  box(g, [1.08, .12, .82], graphite, [0, .1, 0], null, .08, 'Weighted camera base');
  box(g, [.8, .035, .57], navy, [0, .18, 0], null, .055, 'Touch control surface');
  for (let key = 0; key < 5; key += 1) cylinder(g, .04, .025, key === 0 ? cyan : silver, [-.25 + key * .13, .21, .2], null, 18, 'Document camera control');
  cylinder(g, .09, .14, aluminium, [0, .22, -.25], null, 24, 'Arm pivot');
  rod(g, [0, .24, -.25], [0, 1.28, -.25], .075, aluminium);
  cylinder(g, .11, .16, graphite, [0, 1.28, -.25], [0, 0, Math.PI / 2], 24, 'Upper arm joint');
  rod(g, [0, 1.3, -.25], [.43, 1.72, -.1], .07, graphite);
  cylinder(g, .1, .15, aluminium, [.43, 1.72, -.1], [0, 0, Math.PI / 2], 24, 'Camera head pivot');
  box(g, [.72, .22, .42], graphite, [.64, 1.72, -.02], [0, -.18, 0], .09, 'Camera head');
  cylinder(g, .13, .24, black, [.65, 1.62, .2], [Math.PI / 2, 0, 0], 30, 'Document lens');
  cylinder(g, .085, .255, screen, [.65, 1.62, .25], [Math.PI / 2, 0, 0], 28);
  for (const x of [.43, .85]) box(g, [.1, .035, .025], mat(0xf2f4eb, .4, .05, { emissive: 0xdde9dc, emissiveIntensity: .8 }), [x, 1.78, .22], null, .012, 'LED document light');
  return g;
}

function buildDriveDock() {
  const g = new THREE.Group(); g.name = 'Professional dual-bay drive docking station';
  box(g, [1.62, .46, 1.1], graphite, [0, .32, 0], null, .13, 'Drive dock base');
  box(g, [1.42, .08, .9], aluminium, [0, .59, 0], null, .07, 'Dock top');
  for (const x of [-.38, .38]) {
    box(g, [.52, .08, .67], black, [x, .64, -.02], null, .055, 'Drive bay');
    box(g, [.36, .62, .56], mat(0x2b353b, .38, .46), [x, .94, -.03], [0, 0, x < 0 ? -.025 : .025], .045, 'Inserted storage drive');
    box(g, [.24, .035, .025], silver, [x, 1.16, .27], null, .008, 'Drive label');
    box(g, [.3, .03, .025], cyan, [x, .64, .47], null, .008, 'Bay status');
  }
  box(g, [.72, .2, .035], black, [0, .31, .57], null, .04, 'Front controls');
  cylinder(g, .055, .03, cyan, [-.22, .31, .595], [Math.PI / 2, 0, 0], 20, 'Clone button');
  cylinder(g, .055, .03, silver, [.22, .31, .595], [Math.PI / 2, 0, 0], 20, 'Eject control');
  for (const x of [-.58, .58]) box(g, [.2, .07, .2], rubber, [x, .045, .25], null, .025);
  return g;
}

function buildCleaningKit() {
  const g = new THREE.Group(); g.name = 'Professional electronics cleaning kit';
  box(g, [1.75, .36, 1.08], navy, [0, .25, 0], null, .13, 'Cleaning kit case');
  box(g, [1.56, .18, .88], black, [0, .48, 0], null, .09, 'Fitted foam insert');
  cylinder(g, .17, .58, mat(0xe9f1f3, .3, .04), [-.52, .79, -.15], null, 28, 'Screen cleaner bottle');
  cylinder(g, .12, .16, graphite, [-.52, 1.16, -.15], null, 24, 'Spray cap');
  box(g, [.2, .08, .12], cyan, [-.52, .87, .03], null, .02, 'Cleaner label');
  cylinder(g, .09, .58, graphite, [-.05, .79, -.18], null, 24, 'Air blower');
  cylinder(g, .045, .3, silver, [-.05, 1.21, -.18], null, 18, 'Air nozzle');
  box(g, [.46, .08, .18], mat(0x53a9ba, .78), [.48, .67, -.2], [0, 0, -.12], .04, 'Microfiber brush');
  for (let bristle = 0; bristle < 8; bristle += 1) rod(g, [.28 + bristle * .055, .72, -.2], [.25 + bristle * .06, 1.04, -.2], .012, silver);
  box(g, [.67, .035, .5], mat(0x5aa2bc, .9, 0), [.33, .52, .25], [0, .12, .08], .025, 'Microfiber cloth');
  for (const x of [-.55, .55]) box(g, [.22, .14, .06], silver, [x, .27, .57], null, .025, 'Case latch');
  rod(g, [-.3, .18, .58], [-.3, -.05, .63], .04, graphite); rod(g, [.3, .18, .58], [.3, -.05, .63], .04, graphite); rod(g, [-.3, -.05, .63], [.3, -.05, .63], .04, graphite);
  return g;
}

function buildCableLock() {
  const g = new THREE.Group(); g.name = 'Premium equipment security cable lock';
  const braid = mat(0x303a41, .65, .34);
  for (let loop = 0; loop < 3; loop += 1) ring(g, .59 - loop * .06, .045, braid, [0, .4 + loop * .028, 0], [Math.PI / 2, 0, 0], 48);
  rod(g, [-.54, .4, .1], [-.86, .36, .38], .044, braid);
  box(g, [.46, .66, .34], graphite, [-.99, .49, .39], null, .1, 'Combination lock body');
  ring(g, .17, .045, silver, [-.99, .88, .39], null, 32);
  for (let dial = 0; dial < 4; dial += 1) {
    cylinder(g, .09, .085, dial % 2 ? aluminium : black, [-1.15 + dial * .105, .48, .575], [Math.PI / 2, 0, 0], 24, 'Combination dial');
    box(g, [.02, .035, .012], silver, [-1.15 + dial * .105, .48, .628], null, .004);
  }
  rod(g, [.54, .43, -.08], [.91, .43, -.38], .044, braid);
  box(g, [.36, .2, .25], graphite, [1.03, .43, -.39], null, .055, 'Kensington lock head');
  box(g, [.17, .075, .12], silver, [1.28, .43, -.39], null, .018, 'Security slot blade');
  return g;
}

function buildCrimpingTool() {
  const g = new THREE.Group(); g.name = 'Professional ratcheting Ethernet crimper';
  const steel = mat(0x626f78, .26, .76);
  rod(g, [-.16, .48, 0], [-.58, -.38, .18], .12, graphite);
  rod(g, [.16, .48, 0], [.58, -.38, -.18], .12, graphite);
  rod(g, [-.22, .38, .02], [-.59, -.4, .2], .082, mat(0x176090, .5, .1));
  rod(g, [.22, .38, -.02], [.59, -.4, -.2], .082, mat(0x176090, .5, .1));
  cylinder(g, .14, .16, steel, [0, .55, 0], [Math.PI / 2, 0, 0], 28, 'Crimper pivot');
  cylinder(g, .055, .18, black, [0, .55, 0], [Math.PI / 2, 0, 0], 24);
  const leftJaw = box(g, [.32, .62, .24], steel, [-.18, .87, 0], [0, 0, -.18], .055, 'RJ45 crimp jaw');
  const rightJaw = box(g, [.32, .62, .24], steel, [.18, .87, 0], [0, 0, .18], .055, 'RJ45 crimp jaw');
  leftJaw.scale.y = .94; rightJaw.scale.y = .94;
  box(g, [.22, .16, .27], black, [0, 1.13, 0], null, .025, 'RJ45 die');
  for (let tooth = 0; tooth < 8; tooth += 1) box(g, [.018, .1, .28], gold, [-.07 + tooth * .02, 1.15, 0], null, .003, 'Crimp tooth');
  box(g, [.2, .1, .16], silver, [0, .37, 0], [0, 0, .35], .02, 'Ratcheting release');
  return g;
}

function buildExternalDrive() {
  const g = new THREE.Group(); g.name = 'Premium portable external hard drive';
  box(g, [1.34, .24, .92], graphite, [0, .25, 0], null, .13, 'Portable drive enclosure');
  box(g, [1.18, .025, .76], aluminium, [0, .385, 0], null, .09, 'Brushed top panel');
  for (let groove = 0; groove < 8; groove += 1) box(g, [.035, .018, .62], black, [-.42 + groove * .12, .405, 0], null, .008, 'Heat dissipation groove');
  box(g, [.22, .08, .035], black, [.46, .25, -.475], null, .018, 'USB-C port');
  box(g, [.14, .04, .018], silver, [.46, .25, -.5], null, .008);
  cylinder(g, .025, .018, cyan, [-.5, .26, .475], [Math.PI / 2, 0, 0], 16, 'Activity light');
  for (const x of [-.48, .48]) for (const z of [-.28, .28]) box(g, [.13, .045, .13], rubber, [x, .09, z], null, .025, 'Anti-slip foot');
  const cable = mat(0x171c20, .75, .04);
  ring(g, .32, .025, cable, [.87, .23, .42], [Math.PI / 2, 0, 0], 36);
  rod(g, [.46, .24, -.48], [.68, .23, .18], .026, cable);
  box(g, [.22, .12, .18], graphite, [1.15, .23, .42], null, .04, 'USB-C cable end');
  box(g, [.12, .055, .1], silver, [1.32, .23, .42], null, .015);
  return g;
}

function buildLaptopCharger() {
  const g = new THREE.Group(); g.name = 'Premium USB-C laptop charger';
  box(g, [.98, .38, .68], graphite, [0, .32, 0], null, .12, 'Power adapter');
  box(g, [.77, .025, .49], aluminium, [0, .522, 0], null, .07, 'Brushed adapter face');
  box(g, [.31, .018, .012], cyan, [0, .538, -.13], null, .006, 'Power rating detail');
  for (let vent = 0; vent < 5; vent += 1) box(g, [.025, .15, .34], black, [-.42, .25 + vent * .04, 0], null, .006, 'Cooling seam');
  rod(g, [-.5, .32, 0], [-.88, .3, .36], .035, rubber);
  ring(g, .32, .03, rubber, [-1.05, .3, .38], [Math.PI / 2, 0, 0], 36);
  box(g, [.28, .16, .2], graphite, [-1.35, .3, .39], null, .05, 'AC connector');
  for (const z of [.34, .44]) box(g, [.2, .035, .028], silver, [-1.56, .3, z], null, .006, 'AC pin');
  rod(g, [.5, .32, 0], [.9, .31, -.35], .028, rubber);
  ring(g, .29, .026, rubber, [1.02, .31, -.38], [Math.PI / 2, 0, 0], 36);
  box(g, [.25, .13, .16], graphite, [1.3, .31, -.38], null, .045, 'USB-C grip');
  box(g, [.13, .06, .09], silver, [1.48, .31, -.38], null, .018, 'USB-C plug');
  cylinder(g, .024, .018, mat(0x4cdd98, .2, .08, { emissive: 0x16744e, emissiveIntensity: .9 }), [.35, .4, .35], [Math.PI / 2, 0, 0], 16, 'Power indicator');
  return g;
}

function buildLaptopDock() {
  const g = new THREE.Group(); g.name = 'Premium Thunderbolt laptop docking station';
  box(g, [1.82, .4, .72], graphite, [0, .31, 0], null, .11, 'Dock enclosure');
  box(g, [1.6, .035, .56], aluminium, [0, .53, 0], null, .075, 'Dock top');
  box(g, [1.6, .25, .035], black, [0, .31, .38], null, .06, 'Front IO panel');
  for (const x of [-.55, -.33]) box(g, [.14, .075, .025], silver, [x, .31, .405], null, .012, 'USB port');
  box(g, [.12, .06, .025], gold, [-.08, .31, .405], null, .012, 'SD card slot');
  box(g, [.14, .065, .025], cyan, [.22, .31, .405], null, .012, 'USB-C port');
  cylinder(g, .035, .025, cyan, [.61, .31, .405], [Math.PI / 2, 0, 0], 18, 'Dock status');
  box(g, [1.54, .25, .035], black, [0, .31, -.38], null, .055, 'Rear IO panel');
  for (const [x, material] of [[-.53, silver], [-.28, silver], [0, gold], [.29, black], [.53, silver]]) box(g, [.17, .08, .025], material, [x, .31, -.405], null, .014, 'Rear connection');
  rod(g, [.7, .3, -.2], [1.03, .32, -.48], .03, rubber);
  box(g, [.24, .13, .17], graphite, [1.19, .32, -.5], null, .045, 'Host cable grip');
  box(g, [.12, .055, .08], silver, [1.37, .32, -.5], null, .016, 'Thunderbolt connector');
  for (const x of [-.62, .62]) box(g, [.3, .055, .18], rubber, [x, .075, .16], null, .025, 'Anti-slip foot');
  return g;
}

function buildLaptopStand() {
  const g = new THREE.Group(); g.name = 'Premium adjustable aluminium laptop stand';
  const standSilver = mat(0xa6b1b9, .24, .8);
  box(g, [1.5, .1, .92], standSilver, [0, .12, .22], [.18, 0, 0], .06, 'Weighted base');
  box(g, [1.26, .025, .68], rubber, [0, .21, .24], [.18, 0, 0], .035, 'Base grip pad');
  for (const x of [-.5, .5]) rod(g, [x, .18, -.1], [x, 1.16, -.38], .055, standSilver);
  cylinder(g, .09, .18, graphite, [-.5, 1.16, -.38], [0, 0, Math.PI / 2], 24, 'Left hinge');
  cylinder(g, .09, .18, graphite, [.5, 1.16, -.38], [0, 0, Math.PI / 2], 24, 'Right hinge');
  box(g, [1.43, .075, .93], standSilver, [0, 1.27, -.12], [.36, 0, 0], .055, 'Ventilated laptop tray');
  for (let slot = 0; slot < 6; slot += 1) box(g, [.08, .018, .5], black, [-.42 + slot * .17, 1.42, -.05], [.36, 0, 0], .012, 'Cooling slot');
  for (const x of [-.52, .52]) box(g, [.16, .18, .12], graphite, [x, 1.12, .31], [.36, 0, 0], .035, 'Laptop stop');
  for (const x of [-.45, .45]) box(g, [.34, .025, .12], rubber, [x, 1.46, .08], [.36, 0, 0], .02, 'Tray grip');
  return g;
}

function buildPlotter() {
  const g = new THREE.Group(); g.name = 'Premium large-format design plotter';
  const ivory = mat(0xe8e9e5, .35, .05);
  for (const x of [-.69, .69]) box(g, [.18, 1.32, .22], graphite, [x, .72, 0], null, .055, 'Plotter stand leg');
  box(g, [1.75, .13, .72], graphite, [0, .12, 0], null, .06, 'Plotter stand base');
  for (const x of [-.7, .7]) for (const z of [-.25, .25]) cylinder(g, .075, .08, rubber, [x, .045, z], [0, 0, Math.PI / 2], 20, 'Caster');
  box(g, [2.18, .66, 1.02], ivory, [0, 1.43, 0], null, .15, 'Wide-format print engine');
  box(g, [1.98, .24, .055], black, [0, 1.42, .54], null, .06, 'Output aperture');
  box(g, [1.75, .035, .55], mat(0xfafaf6, .78), [0, 1.26, .5], [.08, 0, 0], .012, 'Printed plan');
  for (let line = 0; line < 5; line += 1) box(g, [1.1 - line * .11, .012, .01], line % 2 ? cyan : navy, [0, 1.29 - line * .035, .78], [.08, 0, 0], .003, 'Drawing detail');
  cylinder(g, .28, 1.72, mat(0xf2f1ec, .75), [0, .82, -.16], [0, 0, Math.PI / 2], 36, 'Paper roll');
  cylinder(g, .095, 1.78, graphite, [0, .82, -.16], [0, 0, Math.PI / 2], 24, 'Roll spindle');
  const panel = new THREE.Group(); panel.position.set(.86, 1.72, .54); panel.rotation.x = -.18;
  box(panel, [.52, .3, .09], graphite, [0, 0, 0], null, .055, 'Touch console');
  box(panel, [.34, .19, .015], screen, [-.05, 0, .055], null, .025);
  cylinder(panel, .035, .016, cyan, [.19, -.04, .055], [Math.PI / 2, 0, 0], 18);
  g.add(panel);
  for (let vent = 0; vent < 11; vent += 1) box(g, [.035, .27, .025], graphite, [-.83 + vent * .12, 1.65, -.52], null, .007, 'Rear vent');
  return g;
}

function buildCardReader() {
  const g = new THREE.Group(); g.name = 'Premium multi-format memory card reader';
  box(g, [1.36, .3, .78], graphite, [0, .25, 0], null, .1, 'Card reader enclosure');
  box(g, [1.18, .18, .035], black, [0, .25, .41], null, .05, 'Reader front panel');
  box(g, [.42, .045, .025], silver, [-.32, .31, .435], null, .008, 'SD card slot');
  box(g, [.27, .035, .025], silver, [-.37, .19, .435], null, .007, 'microSD slot');
  box(g, [.28, .08, .025], gold, [.18, .25, .435], null, .012, 'CompactFlash slot');
  box(g, [.14, .065, .025], cyan, [.48, .25, .435], null, .01, 'USB-C port');
  cylinder(g, .025, .02, mat(0x4ada96, .2, .05, { emissive: 0x15784f, emissiveIntensity: .8 }), [.57, .36, .435], [Math.PI / 2, 0, 0], 16, 'Activity light');
  for (let groove = 0; groove < 7; groove += 1) box(g, [.035, .025, .48], black, [-.42 + groove * .14, .415, 0], null, .007, 'Top groove');
  rod(g, [-.68, .25, -.1], [-.98, .25, -.42], .027, rubber);
  box(g, [.22, .13, .17], graphite, [-1.13, .25, -.44], null, .04, 'USB cable grip');
  box(g, [.11, .055, .08], silver, [-1.3, .25, -.44], null, .016);
  return g;
}

function buildMemoryModule() {
  const g = new THREE.Group(); g.name = 'Premium desktop memory module';
  box(g, [1.92, .08, .58], greenPcb, [0, .3, 0], null, .025, 'RAM PCB');
  for (const side of [-1, 1]) for (let chip = 0; chip < 4; chip += 1) box(g, [.27, .11, .21], black, [-.55 + chip * .37, .38, side * .16], null, .018, 'Memory IC');
  box(g, [1.56, .16, .42], aluminium, [0, .43, 0], null, .04, 'Heat spreader');
  box(g, [.46, .018, .012], navy, [0, .525, .22], null, .005, 'Module branding');
  for (let pin = 0; pin < 26; pin += 1) {
    if (pin === 13) continue;
    box(g, [.045, .08, .025], gold, [-.75 + pin * .06, .22, .29], null, .004, 'Gold contact');
    box(g, [.045, .08, .025], gold, [-.75 + pin * .06, .22, -.29], null, .004, 'Gold contact');
  }
  box(g, [.09, .1, .1], greenPcb, [0, .18, 0], null, .01, 'Key notch');
  for (const x of [-.91, .91]) box(g, [.08, .24, .42], graphite, [x, .38, 0], null, .018, 'End cap');
  return g;
}

function buildMicrophoneStand() {
  const g = new THREE.Group(); g.name = 'Professional boom microphone stand';
  cylinder(g, .09, 1.34, graphite, [0, .73, 0], null, 24, 'Telescoping mast');
  cylinder(g, .065, .96, aluminium, [0, 1.75, 0], null, 24, 'Upper mast');
  cylinder(g, .13, .15, graphite, [0, 1.34, 0], [Math.PI / 2, 0, 0], 24, 'Height clutch');
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) {
    rod(g, [0, .11, 0], [Math.cos(angle) * .78, 0, Math.sin(angle) * .78], .045, graphite);
    box(g, [.22, .07, .12], rubber, [Math.cos(angle) * .82, .02, Math.sin(angle) * .82], [0, -angle, 0], .025, 'Tripod foot');
  }
  cylinder(g, .12, .16, graphite, [0, 2.18, 0], [Math.PI / 2, 0, 0], 24, 'Boom pivot');
  rod(g, [0, 2.18, 0], [1.08, 2.5, .04], .055, aluminium);
  box(g, [.42, .13, .16], rubber, [1.16, 2.52, .04], [0, 0, .28], .055, 'Microphone clip');
  ring(g, .18, .035, graphite, [1.2, 2.54, .04], [Math.PI / 2, 0, 0], 28);
  box(g, [.25, .18, .11], graphite, [-.28, 2.09, 0], null, .04, 'Counterweight');
  cylinder(g, .05, .18, cyan, [0, 2.17, .1], [Math.PI / 2, 0, 0], 18, 'Boom lock');
  return g;
}

function buildMicrowave() {
  const g = new THREE.Group(); g.name = 'Premium office microwave oven';
  box(g, [1.82, 1.05, 1.18], aluminium, [0, .58, 0], null, .13, 'Microwave enclosure');
  box(g, [1.22, .8, .045], graphite, [-.2, .6, .615], null, .07, 'Microwave door');
  box(g, [1.02, .62, .018], glass, [-.2, .6, .645], null, .045, 'Tinted viewing window');
  box(g, [.9, .035, .018], black, [-.2, .92, .662], null, .008, 'Door upper trim');
  box(g, [.09, .68, .09], graphite, [.42, .61, .665], null, .03, 'Door handle');
  box(g, [.38, .8, .045], graphite, [.69, .6, .615], null, .065, 'Control panel');
  box(g, [.27, .17, .018], screen, [.69, .86, .648], null, .025, 'Clock display');
  for (let key = 0; key < 9; key += 1) cylinder(g, .035, .02, key === 8 ? cyan : silver, [.61 + (key % 3) * .08, .65 - Math.floor(key / 3) * .1, .65], [Math.PI / 2, 0, 0], 16, 'Keypad button');
  cylinder(g, .11, .045, aluminium, [.69, .28, .65], [Math.PI / 2, 0, 0], 28, 'Control dial');
  for (let vent = 0; vent < 9; vent += 1) box(g, [.025, .31, .28], black, [-.7 + vent * .08, .6, -.61], null, .006, 'Rear cooling vent');
  for (const x of [-.65, .65]) box(g, [.28, .065, .2], rubber, [x, .055, .35], null, .025, 'Microwave foot');
  return g;
}

function buildMiniPc() {
  const g = new THREE.Group(); g.name = 'Premium compact mini PC';
  box(g, [1.3, .48, 1.22], graphite, [0, .34, 0], null, .15, 'Mini PC enclosure');
  box(g, [1.14, .04, 1.05], aluminium, [0, .6, 0], null, .11, 'Machined top');
  ring(g, .29, .015, cyan, [0, .625, 0], [Math.PI / 2, 0, 0], 40);
  box(g, [1.08, .28, .035], black, [0, .35, .63], null, .07, 'Front IO panel');
  for (const x of [-.37, -.18]) box(g, [.13, .07, .025], silver, [x, .35, .655], null, .012, 'USB port');
  box(g, [.11, .06, .025], cyan, [.08, .35, .655], null, .012, 'USB-C port');
  cylinder(g, .05, .025, cyan, [.42, .35, .655], [Math.PI / 2, 0, 0], 18, 'Power control');
  box(g, [1.04, .28, .035], black, [0, .35, -.63], null, .065, 'Rear ports');
  for (const [x, material] of [[-.36, gold], [-.12, silver], [.14, black], [.38, silver]]) box(g, [.16, .08, .025], material, [x, .35, -.655], null, .012, 'Rear connection');
  for (let vent = 0; vent < 10; vent += 1) box(g, [.035, .025, .68], black, [-.43 + vent * .095, .61, 0], null, .007, 'Top ventilation');
  for (const x of [-.45, .45]) for (const z of [-.42, .42]) box(g, [.14, .06, .14], rubber, [x, .065, z], null, .025, 'Rubber foot');
  return g;
}

function buildMonitorArm() {
  const g = new THREE.Group(); g.name = 'Premium gas-spring monitor arm';
  box(g, [.76, .1, .58], graphite, [0, .1, 0], null, .06, 'Desk clamp base');
  box(g, [.42, .28, .5], graphite, [0, -.08, 0], null, .07, 'Desk clamp');
  cylinder(g, .055, .4, silver, [0, -.3, 0], null, 18, 'Clamp screw');
  cylinder(g, .13, .18, graphite, [0, .24, 0], [Math.PI / 2, 0, 0], 24, 'Base pivot');
  rod(g, [0, .25, 0], [-.38, 1.05, 0], .085, aluminium);
  cylinder(g, .14, .19, graphite, [-.38, 1.05, 0], [Math.PI / 2, 0, 0], 24, 'Lower joint');
  rod(g, [-.38, 1.05, 0], [.22, 1.63, 0], .085, aluminium);
  cylinder(g, .14, .2, graphite, [.22, 1.63, 0], [Math.PI / 2, 0, 0], 24, 'Upper joint');
  rod(g, [.22, 1.63, 0], [.47, 1.68, 0], .07, graphite);
  box(g, [.62, .62, .08], graphite, [.75, 1.68, 0], [0, .12, 0], .055, 'VESA mounting plate');
  for (const x of [.55, .95]) for (const y of [1.48, 1.88]) cylinder(g, .035, .095, silver, [x, y, .04], [Math.PI / 2, 0, 0], 16, 'VESA screw');
  for (let clip = 0; clip < 3; clip += 1) box(g, [.18, .08, .12], rubber, [-.2 + clip * .23, .72 + clip * .3, -.08], [0, 0, -.48], .025, 'Cable management clip');
  cylinder(g, .05, .12, cyan, [-.38, 1.05, .11], [Math.PI / 2, 0, 0], 18, 'Tension control');
  return g;
}

function buildNas() {
  const g = new THREE.Group(); g.name = 'Premium four-bay network attached storage';
  box(g, [1.28, 1.28, 1.08], graphite, [0, .69, 0], null, .13, 'NAS enclosure');
  box(g, [1.08, 1.1, .035], black, [0, .7, .56], null, .09, 'NAS front panel');
  for (let bay = 0; bay < 4; bay += 1) {
    const x = -.39 + bay * .26;
    box(g, [.22, .84, .055], aluminium, [x, .67, .59], null, .035, `Drive bay ${bay + 1}`);
    box(g, [.16, .58, .018], graphite, [x, .69, .625], null, .025);
    box(g, [.13, .04, .012], silver, [x, 1.03, .64], null, .008, 'Drive latch');
    cylinder(g, .018, .014, bay < 3 ? cyan : mat(0x4fd494, .2, .05, { emissive: 0x176f4c, emissiveIntensity: .8 }), [x, .28, .64], [Math.PI / 2, 0, 0], 14, 'Drive status');
  }
  box(g, [.35, .16, .035], graphite, [.32, 1.2, .58], null, .03, 'NAS status panel');
  cylinder(g, .045, .025, cyan, [.45, 1.2, .61], [Math.PI / 2, 0, 0], 18, 'Power button');
  for (let vent = 0; vent < 10; vent += 1) box(g, [.025, .42, .3], black, [-.64, .35 + vent * .055, 0], null, .006, 'Side vent');
  cylinder(g, .3, .035, rubber, [0, .72, -.56], [Math.PI / 2, 0, 0], 36, 'Rear fan');
  for (const x of [-.45, .45]) box(g, [.22, .07, .2], rubber, [x, .045, .28], null, .025, 'Isolation foot');
  return g;
}

function buildCableTester() {
  const g = new THREE.Group(); g.name = 'Professional network cable tester kit';
  const yellow = mat(0xe0a12a, .46, .08);
  box(g, [.86, 1.5, .36], yellow, [-.28, .81, 0], null, .16, 'Main cable tester');
  box(g, [.68, 1.29, .04], graphite, [-.28, .82, .2], null, .11, 'Tester face');
  box(g, [.53, .34, .015], screen, [-.28, 1.27, .225], null, .045, 'Tester LCD');
  for (let line = 0; line < 4; line += 1) box(g, [.32 - line * .03, .025, .008], cyan, [-.28, 1.33 - line * .065, .238], null, .006);
  for (let key = 0; key < 4; key += 1) cylinder(g, .06, .025, key === 0 ? cyan : silver, [-.48 + (key % 2) * .4, .79 - Math.floor(key / 2) * .2, .225], [Math.PI / 2, 0, 0], 18, 'Tester control');
  box(g, [.42, .14, .18], black, [-.28, 1.6, 0], null, .04, 'RJ45 main port');
  box(g, [.45, .78, .31], graphite, [.68, .54, 0], null, .11, 'Remote terminator');
  box(g, [.3, .1, .17], black, [.68, .98, 0], null, .035, 'Remote RJ45 port');
  for (let led = 0; led < 8; led += 1) cylinder(g, .015, .014, led < 6 ? mat(0x4ed394, .2, .05, { emissive: 0x17754f, emissiveIntensity: .9 }) : silver, [.68, .78 - led * .075, .17], [Math.PI / 2, 0, 0], 12, 'Wire map LED');
  rod(g, [.25, .15, -.1], [.52, .19, -.25], .025, rubber);
  return g;
}

function buildPatchPanel() {
  const g = new THREE.Group(); g.name = 'Professional 24-port network patch panel';
  box(g, [2.16, .42, .38], graphite, [0, .33, 0], null, .055, 'Rackmount patch panel');
  box(g, [1.92, .29, .035], black, [0, .34, .21], null, .035, 'Patch field');
  for (let port = 0; port < 24; port += 1) {
    const row = Math.floor(port / 12); const col = port % 12;
    const x = -.79 + col * .144; const y = .4 - row * .14;
    box(g, [.105, .085, .035], graphite, [x, y, .235], null, .014, `RJ45 port ${port + 1}`);
    box(g, [.068, .045, .018], gold, [x, y, .26], null, .006);
    box(g, [.075, .018, .01], port % 6 === 0 ? cyan : silver, [x, y + .065, .26], null, .004, 'Port label');
  }
  for (const x of [-1.13, 1.13]) {
    box(g, [.15, .48, .43], aluminium, [x, .33, 0], null, .025, 'Rack ear');
    cylinder(g, .035, .035, black, [x, .42, .23], [Math.PI / 2, 0, 0], 16, 'Rack screw');
    cylinder(g, .035, .035, black, [x, .24, .23], [Math.PI / 2, 0, 0], 16, 'Rack screw');
  }
  for (let guide = 0; guide < 6; guide += 1) box(g, [.22, .06, .13], graphite, [-.72 + guide * .29, .12, .21], null, .018, 'Cable manager');
  return g;
}

function buildNetworkRack() {
  const g = new THREE.Group(); g.name = 'Premium enclosed network equipment rack';
  for (const x of [-.78, .78]) for (const z of [-.52, .52]) rod(g, [x, .1, z], [x, 2.35, z], .055, graphite);
  box(g, [1.7, .12, 1.18], graphite, [0, .12, 0], null, .045, 'Rack plinth');
  box(g, [1.7, .12, 1.18], graphite, [0, 2.35, 0], null, .045, 'Rack roof');
  for (let unit = 0; unit < 6; unit += 1) {
    const y = .42 + unit * .29;
    box(g, [1.45, .22, .86], unit % 2 ? graphite : black, [0, y, 0], null, .035, 'Rack equipment');
    for (let port = 0; port < 8; port += 1) box(g, [.075, .055, .025], port < 6 ? silver : gold, [-.48 + port * .14, y, .455], null, .008, 'Equipment port');
    cylinder(g, .018, .014, unit % 2 ? cyan : mat(0x4ed394, .2, .05, { emissive: 0x17754f, emissiveIntensity: .8 }), [.62, y, .47], [Math.PI / 2, 0, 0], 12, 'Rack status');
  }
  box(g, [1.46, .08, .9], aluminium, [0, 2.14, 0], null, .025, 'Top cable tray');
  for (let vent = 0; vent < 8; vent += 1) box(g, [.06, .025, .7], black, [-.48 + vent * .14, 2.42, 0], null, .008, 'Roof vent');
  const door = new THREE.Group(); door.position.set(-.83, 1.2, .56); door.rotation.y = -.18;
  box(door, [.055, 2.08, 1.52], graphite, [0, 0, 0], null, .035, 'Glass rack door frame');
  box(door, [.025, 1.82, 1.28], glass, [-.035, 0, 0], null, .025, 'Tempered glass door');
  box(door, [.07, .42, .08], aluminium, [-.08, 0, .65], null, .02, 'Rack handle');
  g.add(door);
  for (const x of [-.7, .7]) for (const z of [-.45, .45]) cylinder(g, .08, .08, rubber, [x, .025, z], [0, 0, Math.PI / 2], 20, 'Caster');
  return g;
}

function buildNvr() {
  const g = new THREE.Group(); g.name = 'Professional security network video recorder';
  box(g, [1.95, .48, 1.2], graphite, [0, .34, 0], null, .08, 'NVR chassis');
  box(g, [1.76, .31, .035], black, [0, .34, .62], null, .055, 'NVR front panel');
  box(g, [.55, .2, .018], screen, [-.46, .36, .645], null, .035, 'Status display');
  for (let line = 0; line < 3; line += 1) box(g, [.34 - line * .05, .02, .008], cyan, [-.46, .41 - line * .06, .657], null, .005);
  for (let key = 0; key < 5; key += 1) cylinder(g, .04, .025, key === 0 ? cyan : silver, [.04 + key * .13, .35, .645], [Math.PI / 2, 0, 0], 18, 'NVR control');
  box(g, [.13, .07, .025], silver, [.74, .26, .645], null, .012, 'USB port');
  for (let bay = 0; bay < 4; bay += 1) box(g, [.32, .08, .73], black, [-.57 + bay * .38, .6, 0], null, .025, 'Internal drive bay');
  box(g, [1.68, .28, .035], black, [0, .35, -.62], null, .05, 'Rear IO panel');
  for (let port = 0; port < 8; port += 1) box(g, [.11, .065, .025], port < 6 ? gold : silver, [-.62 + port * .18, .35, -.645], null, .01, 'Camera network port');
  for (const x of [-1.04, 1.04]) box(g, [.17, .58, 1.25], aluminium, [x, .34, 0], null, .025, 'Rack ear');
  return g;
}

function buildOfficeAppliance() {
  const g = new THREE.Group(); g.name = 'Premium office coffee brewer';
  box(g, [1.05, 1.38, .92], graphite, [0, .75, 0], null, .16, 'Coffee brewer body');
  box(g, [.82, .32, .7], black, [0, 1.25, 0], null, .1, 'Water reservoir lid');
  box(g, [.63, .23, .035], screen, [0, 1.05, .48], null, .045, 'Brewer control display');
  for (let key = 0; key < 4; key += 1) cylinder(g, .04, .025, key === 0 ? cyan : silver, [-.22 + key * .15, .9, .48], [Math.PI / 2, 0, 0], 18, 'Brew control');
  box(g, [.74, .68, .06], black, [0, .52, .48], null, .08, 'Brewing bay');
  cylinder(g, .08, .2, aluminium, [0, .83, .51], [Math.PI / 2, 0, 0], 24, 'Coffee nozzle');
  cylinder(g, .27, .43, glass, [0, .43, .38], null, 32, 'Coffee carafe');
  cylinder(g, .23, .035, black, [0, .68, .38], null, 28, 'Carafe lid');
  ring(g, .22, .045, graphite, [.28, .47, .38], [Math.PI / 2, 0, 0], 32);
  box(g, [.75, .1, .62], graphite, [0, .12, .26], null, .055, 'Drip tray');
  for (let slot = 0; slot < 7; slot += 1) box(g, [.04, .025, .4], aluminium, [-.24 + slot * .08, .18, .27], null, .007, 'Drip tray slot');
  return g;
}

function buildOfficeCabinet() {
  const g = new THREE.Group(); g.name = 'Premium lockable office storage cabinet';
  const pearl = mat(0xdfe4e5, .42, .28);
  box(g, [1.42, 2.02, .82], pearl, [0, 1.05, 0], null, .08, 'Steel cabinet enclosure');
  for (const x of [-.35, .35]) box(g, [.66, 1.86, .045], x < 0 ? mat(0x365f7a, .4, .3) : mat(0x4b697b, .4, .3), [x, 1.05, .44], null, .035, 'Cabinet door');
  for (const x of [-.08, .08]) box(g, [.055, .42, .07], graphite, [x, 1.07, .49], null, .018, 'Recessed handle');
  cylinder(g, .045, .035, silver, [.16, 1.05, .49], [Math.PI / 2, 0, 0], 18, 'Cabinet lock');
  for (let vent = 0; vent < 6; vent += 1) box(g, [.25, .018, .012], black, [-.35, 1.72 - vent * .07, .47], null, .004, 'Door vent');
  for (let shelf = 0; shelf < 3; shelf += 1) box(g, [1.22, .055, .64], aluminium, [0, .42 + shelf * .5, 0], null, .015, 'Internal shelf');
  box(g, [1.48, .1, .87], graphite, [0, .08, 0], null, .035, 'Cabinet plinth');
  for (const x of [-.58, .58]) box(g, [.13, .08, .18], rubber, [x, .025, .28], null, .025, 'Levelling foot');
  return g;
}

function buildLaminator() {
  const g = new THREE.Group(); g.name = 'Premium office pouch laminator';
  const ivory = mat(0xe7eae8, .33, .08);
  box(g, [1.76, .45, .88], ivory, [0, .33, 0], null, .14, 'Laminator enclosure');
  box(g, [1.42, .08, .48], graphite, [0, .58, -.08], [.07, 0, 0], .04, 'Input guide');
  box(g, [1.18, .035, .06], black, [0, .59, .29], null, .012, 'Feed slot');
  box(g, [1.32, .07, .5], aluminium, [0, .12, .3], [-.05, 0, 0], .035, 'Output tray');
  box(g, [.86, .025, .38], mat(0xf8f7f0, .8), [0, .18, .38], [-.05, 0, 0], .008, 'Laminated document');
  for (let roller = 0; roller < 2; roller += 1) cylinder(g, .08, 1.35, rubber, [0, .38 + roller * .15, .12], [0, 0, Math.PI / 2], 28, 'Heated roller');
  box(g, [.56, .16, .035], graphite, [.46, .43, .46], null, .04, 'Control panel');
  for (let key = 0; key < 3; key += 1) cylinder(g, .035, .025, key === 0 ? cyan : silver, [.31 + key * .14, .43, .485], [Math.PI / 2, 0, 0], 18, 'Laminator control');
  box(g, [.22, .018, .012], cyan, [-.52, .43, .485], null, .005, 'Ready indicator');
  for (let vent = 0; vent < 8; vent += 1) box(g, [.035, .025, .36], graphite, [-.48 + vent * .14, .565, -.2], null, .007, 'Heat vent');
  return g;
}

function buildMonitor() {
  const g = new THREE.Group(); g.name = 'Premium ergonomic office monitor';
  box(g, [2.04, 1.22, .11], graphite, [0, 1.18, 0], null, .065, 'Thin monitor chassis');
  box(g, [1.88, 1.06, .022], screen, [0, 1.2, .067], null, .03, 'Anti-glare display');
  box(g, [.48, .66, .012], navy, [-.58, 1.2, .082], null, .025, 'Desktop UI sidebar');
  for (let tile = 0; tile < 6; tile += 1) box(g, [.3, .2, .01], tile % 2 ? blue : mat(0x2e617d, .25), [.03 + (tile % 2) * .46, 1.5 - Math.floor(tile / 2) * .28, .083], null, .022, 'Desktop UI tile');
  box(g, [1.88, .055, .13], black, [0, .61, 0], null, .02, 'Lower bezel');
  cylinder(g, .07, .76, aluminium, [0, .43, 0], null, 24, 'Height-adjustable column');
  box(g, [.42, .22, .3], graphite, [0, .66, -.08], null, .065, 'VESA hinge');
  box(g, [1.02, .08, .7], graphite, [0, .08, .08], null, .05, 'Monitor base');
  box(g, [.86, .025, .54], rubber, [0, .025, .08], null, .035, 'Anti-slip base');
  cylinder(g, .025, .018, cyan, [.74, .62, .07], [Math.PI / 2, 0, 0], 16, 'Power indicator');
  box(g, [.24, .035, .025], black, [0, 1.79, -.07], null, .008, 'Webcam cover rail');
  return g;
}

function buildOtherEquipment() {
  const g = new THREE.Group(); g.name = 'Premium universal equipment transit case';
  box(g, [1.58, 1.08, .92], graphite, [0, .61, 0], null, .14, 'Rugged equipment case');
  for (const x of [-.69, .69]) for (const y of [.2, 1.02]) for (const z of [-.38, .38]) box(g, [.18, .18, .18], rubber, [x, y, z], null, .035, 'Reinforced corner');
  box(g, [1.34, .035, .76], navy, [0, .66, .48], null, .08, 'Case front panel');
  box(g, [.66, .36, .025], aluminium, [0, .66, .505], null, .055, 'Asset identification plate');
  box(g, [.42, .025, .012], cyan, [0, .72, .523], null, .006, 'Identification line');
  box(g, [.28, .025, .012], silver, [-.07, .61, .523], null, .006);
  for (const x of [-.47, .47]) box(g, [.22, .18, .07], silver, [x, .42, .51], null, .035, 'Case latch');
  rod(g, [-.32, 1.14, 0], [-.32, 1.4, 0], .045, graphite); rod(g, [.32, 1.14, 0], [.32, 1.4, 0], .045, graphite); rod(g, [-.32, 1.4, 0], [.32, 1.4, 0], .045, rubber);
  for (let rib = 0; rib < 5; rib += 1) box(g, [.035, .74, .78], black, [-.48 + rib * .24, .62, 0], null, .008, 'Case rib');
  return g;
}

function buildHeadphones() {
  const g = new THREE.Group(); g.name = 'Premium ergonomic over-ear headphones';
  const headband = new THREE.CatmullRomCurve3([new THREE.Vector3(-.72, .62, 0), new THREE.Vector3(-.62, 1.52, 0), new THREE.Vector3(0, 1.9, 0), new THREE.Vector3(.62, 1.52, 0), new THREE.Vector3(.72, .62, 0)]);
  add(g, new THREE.TubeGeometry(headband, 48, .085, 14, false), graphite, [0, 0, 0], null, 'Sculpted headband');
  const cushionCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.54, 1.48, .02), new THREE.Vector3(0, 1.72, .02), new THREE.Vector3(.54, 1.48, .02)]);
  add(g, new THREE.TubeGeometry(cushionCurve, 30, .07, 12, false), rubber, [0, 0, 0], null, 'Headband cushion');
  for (const side of [-1, 1]) {
    box(g, [.15, .55, .16], aluminium, [side * .69, .75, 0], null, .055, 'Adjustable yoke');
    cylinder(g, .34, .24, graphite, [side * .74, .48, 0], [0, 0, Math.PI / 2], 40, 'Ear cup');
    cylinder(g, .28, .28, rubber, [side * .74, .48, 0], [0, 0, Math.PI / 2], 40, 'Memory foam cushion');
    cylinder(g, .2, .285, navy, [side * .74, .48, 0], [0, 0, Math.PI / 2], 36, 'Driver cover');
    ring(g, .205, .018, cyan, [side * .74, .48, 0], [0, Math.PI / 2, 0], 36);
  }
  for (let key = 0; key < 3; key += 1) cylinder(g, .026, .02, key === 0 ? cyan : silver, [.87, .34 + key * .1, .16], [Math.PI / 2, 0, 0], 14, 'Headphone control');
  return g;
}

function buildPaSpeaker() {
  const g = new THREE.Group(); g.name = 'Premium active PA loudspeaker';
  box(g, [1.18, 1.88, .92], graphite, [0, 1, 0], null, .18, 'PA speaker cabinet');
  box(g, [1.02, 1.68, .035], rubber, [0, 1.02, .48], null, .15, 'Acoustic grille');
  cylinder(g, .39, .06, black, [0, .78, .52], [Math.PI / 2, 0, 0], 42, 'Woofer surround');
  cylinder(g, .29, .07, aluminium, [0, .78, .55], [Math.PI / 2, 0, 0], 42, 'Woofer cone');
  cylinder(g, .1, .075, graphite, [0, .78, .585], [Math.PI / 2, 0, 0], 28, 'Dust cap');
  box(g, [.5, .3, .07], black, [0, 1.55, .52], null, .06, 'High-frequency horn');
  box(g, [.31, .16, .08], aluminium, [0, 1.55, .57], null, .035);
  box(g, [.62, .18, .42], black, [0, 1.98, 0], null, .08, 'Carry handle');
  box(g, [.4, .1, .28], rubber, [0, 2.02, 0], null, .04);
  box(g, [.65, .62, .04], black, [0, .72, -.48], null, .07, 'Amplifier panel');
  for (const x of [-.18, 0, .18]) cylinder(g, .045, .025, x === 0 ? cyan : silver, [x, .82, -.51], [Math.PI / 2, 0, 0], 18, 'Level control');
  cylinder(g, .11, .16, graphite, [0, .08, 0], null, 28, 'Pole mount');
  return g;
}

function buildShredder() {
  const g = new THREE.Group(); g.name = 'Premium cross-cut office shredder';
  box(g, [1.22, 1.52, .94], graphite, [0, .79, 0], null, .15, 'Shredder bin');
  box(g, [1.1, .92, .035], glass, [0, .65, .49], null, .1, 'Bin level window');
  box(g, [1.36, .38, 1.02], black, [0, 1.62, 0], null, .13, 'Shredder head');
  box(g, [.88, .055, .3], graphite, [0, 1.84, 0], null, .025, 'Paper feed slot');
  cylinder(g, .07, .8, rubber, [0, 1.73, 0], [0, 0, Math.PI / 2], 28, 'Cutting roller');
  box(g, [.58, .18, .035], graphite, [.32, 1.63, .53], null, .045, 'Control panel');
  for (let key = 0; key < 3; key += 1) cylinder(g, .035, .025, key === 0 ? cyan : key === 2 ? mat(0xc45249, .3) : silver, [.17 + key * .15, 1.63, .555], [Math.PI / 2, 0, 0], 16, 'Shredder control');
  box(g, [.75, .08, .12], aluminium, [0, 1.07, .51], null, .025, 'Bin handle');
  for (let vent = 0; vent < 8; vent += 1) box(g, [.035, .24, .34], black, [-.58, .45 + vent * .08, 0], null, .007, 'Cooling vent');
  for (const x of [-.45, .45]) for (const z of [-.33, .33]) cylinder(g, .055, .07, rubber, [x, .035, z], [0, 0, Math.PI / 2], 18, 'Caster');
  return g;
}

function buildPoeInjector() {
  const g = new THREE.Group(); g.name = 'Premium managed PoE injector';
  box(g, [1.48, .38, .78], graphite, [0, .31, 0], null, .11, 'PoE injector enclosure');
  box(g, [1.28, .24, .035], black, [0, .31, .41], null, .055, 'Front connection panel');
  for (const [x, label] of [[-.35, 'LAN'], [.35, 'POE']]) {
    box(g, [.27, .15, .045], graphite, [x, .31, .445], null, .025, `${label} Ethernet port`);
    box(g, [.17, .09, .018], gold, [x, .31, .478], null, .012);
    for (const ledX of [-.06, .06]) cylinder(g, .014, .012, ledX < 0 ? cyan : mat(0x4fd494, .2, .05, { emissive: 0x176f4c, emissiveIntensity: .9 }), [x + ledX, .42, .472], [Math.PI / 2, 0, 0], 12, 'Port status');
  }
  box(g, [1.25, .24, .035], black, [0, .31, -.41], null, .05, 'Power panel');
  cylinder(g, .09, .06, black, [-.42, .31, -.445], [Math.PI / 2, 0, 0], 24, 'DC power input');
  box(g, [.33, .09, .025], silver, [.25, .31, -.445], null, .018, 'Power rating');
  for (let fin = 0; fin < 9; fin += 1) box(g, [.04, .05, .48], black, [-.48 + fin * .12, .525, 0], null, .009, 'Cooling rib');
  for (const x of [-.52, .52]) box(g, [.23, .055, .18], rubber, [x, .075, .2], null, .025, 'Isolation foot');
  return g;
}

function buildGenerator() {
  const g = new THREE.Group(); g.name = 'Premium portable inverter generator';
  const red = mat(0xb63e34, .38, .22);
  box(g, [1.55, 1.08, .98], red, [0, .71, 0], null, .2, 'Generator enclosure');
  for (const x of [-.73, .73]) rod(g, [x, .16, -.5], [x, 1.44, -.5], .055, graphite);
  rod(g, [-.73, 1.44, -.5], [.73, 1.44, -.5], .055, graphite);
  box(g, [1.3, .58, .045], black, [0, .78, .52], null, .08, 'Generator control panel');
  box(g, [.42, .18, .018], screen, [-.36, .91, .55], null, .035, 'Power display');
  for (const x of [-.36, -.12, .14]) cylinder(g, .09, .045, x === .14 ? cyan : silver, [x, .67, .55], [Math.PI / 2, 0, 0], 24, 'Power outlet');
  cylinder(g, .075, .045, mat(0xc94840, .3), [.48, .86, .55], [Math.PI / 2, 0, 0], 20, 'Engine stop');
  for (let vent = 0; vent < 9; vent += 1) box(g, [.035, .38, .025], black, [-.48 + vent * .12, .75, -.51], null, .007, 'Engine cooling vent');
  cylinder(g, .24, .16, rubber, [-.55, .22, .5], [Math.PI / 2, 0, 0], 32, 'Wheel');
  cylinder(g, .24, .16, rubber, [.55, .22, .5], [Math.PI / 2, 0, 0], 32, 'Wheel');
  cylinder(g, .08, .18, silver, [-.55, .22, .5], [Math.PI / 2, 0, 0], 22); cylinder(g, .08, .18, silver, [.55, .22, .5], [Math.PI / 2, 0, 0], 22);
  box(g, [.38, .2, .33], graphite, [.55, 1.19, .22], null, .07, 'Fuel cap surround');
  cylinder(g, .13, .08, black, [.55, 1.34, .22], null, 28, 'Fuel cap');
  return g;
}

function buildPresentationClicker() {
  const g = new THREE.Group(); g.name = 'Premium wireless presentation clicker';
  box(g, [.55, .22, 1.65], graphite, [0, .2, 0], null, .18, 'Soft-touch clicker body');
  box(g, [.42, .035, 1.35], black, [0, .33, 0], null, .14, 'Control face');
  cylinder(g, .13, .045, silver, [0, .36, -.42], null, 28, 'Next slide key');
  cylinder(g, .1, .048, aluminium, [-.15, .36, -.08], null, 24, 'Previous key');
  cylinder(g, .1, .048, aluminium, [.15, .36, -.08], null, 24, 'Black screen key');
  cylinder(g, .065, .05, mat(0xc7423d, .3), [0, .36, .25], null, 20, 'Laser key');
  box(g, [.26, .045, .1], screen, [0, .355, .52], null, .02, 'Battery indicator');
  cylinder(g, .02, .035, cyan, [-.075, .38, .52], null, 12);
  box(g, [.2, .12, .12], aluminium, [0, .18, -.86], null, .025, 'USB receiver dock');
  return g;
}

function buildFiberPatchCable() {
  const g=new THREE.Group(); g.name='Premium duplex LC fiber optic patch cable';
  const aqua=mat(0x25a9b7,.38,.08);
  for(const offset of [-.045,.045]) {
    const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.08,.25,offset),new THREE.Vector3(-.55,.18,.38+offset),new THREE.Vector3(.05,.2,-.34+offset),new THREE.Vector3(.62,.18,.31+offset),new THREE.Vector3(1.08,.25,offset)]);
    add(g,new THREE.TubeGeometry(curve,60,.028,10,false),aqua,[0,0,0],null,'Optical fiber strand');
  }
  for(const side of [-1,1]) {
    box(g,[.38,.2,.34],aqua,[side*1.24,.25,0],null,.045,'Duplex LC connector');
    for(const z of [-.09,.09]) {
      cylinder(g,.045,.24,silver,[side*1.48,.25,z],[0,0,Math.PI/2],18,'Ceramic ferrule');
      cylinder(g,.018,.08,glass,[side*1.63,.25,z],[0,0,Math.PI/2],14,'Fiber core');
    }
    box(g,[.22,.055,.3],aluminium,[side*1.23,.4,0],null,.018,'Connector latch');
    cylinder(g,.07,.16,rubber,[side*1.04,.25,0],[0,0,Math.PI/2],18,'Strain relief');
  }
  return g;
}

function buildFirewall() {
  const g=new THREE.Group(); g.name='Premium next-generation firewall appliance';
  box(g,[2.25,.48,1.18],graphite,[0,.35,0],null,.055,'1U firewall chassis');
  box(g,[2.12,.38,.035],black,[0,.35,.62],null,.035,'Firewall front panel');
  box(g,[.52,.22,.025],screen,[-.73,.4,.65],null,.035,'Security status display');
  for(let line=0;line<3;line++) box(g,[.34-line*.04,.022,.008],cyan,[-.73,.45-line*.065,.667],null,.004);
  for(let port=0;port<8;port++) {
    const x=-.25+port*.21;
    box(g,[.17,.13,.045],port<2?navy:aluminium,[x,.35,.65],null,.012,`Firewall network port ${port+1}`);
    box(g,[.11,.045,.012],black,[x,.34,.68],null,.004);
    cylinder(g,.012,.01,port<6?cyan:silver,[x+.055,.43,.68],[Math.PI/2,0,0],8);
  }
  for(const x of [-1.18,1.18]) box(g,[.15,.62,.34],aluminium,[x,.35,.45],null,.022,'Rack ear');
  for(let vent=0;vent<13;vent++) box(g,[.055,.018,.62],black,[-.48+vent*.08,.6,-.18],null,.006,'Firewall cooling vent');
  return g;
}

function buildFlatbedScanner() {
  const g=new THREE.Group(); g.name='Premium flatbed document scanner';
  box(g,[2.05,.38,1.5],graphite,[0,.25,0],null,.12,'Scanner base');
  box(g,[1.78,.035,1.22],glass,[0,.47,0],null,.035,'Scanning glass');
  box(g,[1.62,.012,1.06],mat(0xdce7eb,.24),[0,.49,0],null,.025,'Document on platen');
  const lid=new THREE.Group(); lid.position.set(0,.46,-.68); lid.rotation.x=-.25;
  box(lid,[2.02,.15,1.42],aluminium,[0,.68,0],null,.11,'Scanner lid');
  box(lid,[1.78,.035,1.16],mat(0xe7e9e8,.72),[0,.58,.02],null,.05,'White document backing'); g.add(lid);
  box(g,[.58,.18,.035],black,[.57,.25,.78],null,.035,'Scanner control panel');
  cylinder(g,.06,.035,cyan,[.7,.28,.81],[Math.PI/2,0,0],18,'Scan button');
  for(const x of [.4,.52]) cylinder(g,.025,.03,silver,[x,.28,.81],[Math.PI/2,0,0],12,'Scanner function key');
  for(const x of [-.72,.72]) box(g,[.25,.07,.3],rubber,[x,.05,.38],null,.025,'Scanner foot');
  return g;
}

function buildFullKeyboard() {
  const g=new THREE.Group(); g.name='Premium full-size office keyboard';
  box(g,[2.45,.12,.92],graphite,[0,.16,0],[-.045,0,0],.07,'Keyboard chassis');
  box(g,[2.3,.025,.77],black,[0,.24,0],[-.045,0,0],.045,'Keyboard key deck');
  const rows=[15,15,14,13,12];
  rows.forEach((count,row)=>{for(let col=0;col<count;col++){
    const x=-1.03+col*.14; const z=-.28+row*.14;
    box(g,[row===4&&col===5?.48:.115,.045,.105],row===0?aluminium:graphite,[x,.29,z],null,.015,'Sculpted keycap');
  }});
  for(let row=0;row<5;row++) for(let col=0;col<4;col++) box(g,[.105,.045,.105],graphite,[.76+col*.14,.29,-.28+row*.14],null,.015,'Numeric keypad key');
  for(const [x,color] of [[.85,0x36b785],[.97,0x2477a6],[1.09,0xc9a23e]]) cylinder(g,.012,.01,mat(color,.2),[x,.31,-.39],null,9,'Keyboard indicator');
  box(g,[.22,.055,.07],black,[0,.14,-.48],null,.012,'USB-C port');
  for(const x of [-.82,.82]) box(g,[.28,.14,.12],rubber,[x,.08,-.32],[-.25,0,0],.025,'Keyboard tilt foot');
  return g;
}

function buildGraphicsWorkstation() {
  const g=new THREE.Group(); g.name='Premium professional graphics workstation';
  box(g,[1.15,1.9,1.55],graphite,[0,1,0],null,.11,'Workstation tower');
  box(g,[.98,1.68,.035],black,[0,1,.8],null,.07,'Workstation front fascia');
  for(let vent=0;vent<9;vent++) box(g,[.65,.035,.025],aluminium,[0,1.52-vent*.11,.825],null,.006,'Precision airflow vent');
  cylinder(g,.085,.045,cyan,[0,1.68,.83],[Math.PI/2,0,0],22,'Power control');
  for(const x of [-.2,0,.2]) box(g,[.13,.075,.04],silver,[x,.52,.83],null,.012,'Front USB port');
  cylinder(g,.035,.035,graphite,[.37,.52,.83],[Math.PI/2,0,0],14,'Audio port');
  box(g,[1.02,1.42,.04],glass,[.6,1,-.02],[0,Math.PI/2,0],.04,'Tempered glass side panel');
  cylinder(g,.34,.12,graphite,[.55,1.25,.28],[0,0,Math.PI/2],36,'Liquid cooling radiator fan');
  cylinder(g,.23,.13,cyan,[.56,1.25,.28],[0,0,Math.PI/2],32,'Cooling fan lighting');
  box(g,[.5,.28,.62],navy,[.55,.68,.05],[0,Math.PI/2,0],.045,'Professional graphics card');
  for(let fin=0;fin<8;fin++) box(g,[.04,.18,.46],aluminium,[.59,.82,-.18+fin*.065],[0,Math.PI/2,0],.005,'GPU cooling fin');
  box(g,[.95,.38,1.2],black,[0,.3,0],null,.055,'Power supply shroud');
  for(const x of [-.42,.42]) box(g,[.22,.09,.44],rubber,[x,.05,.35],null,.03,'Workstation foot');
  return g;
}

function buildSfpModule() {
  const g=new THREE.Group(); g.name='Premium optical SFP transceiver';
  box(g,[1.3,.32,.52],silver,[0,.27,0],null,.035,'Metal SFP enclosure');
  box(g,[.92,.025,.4],aluminium,[.05,.445,0],null,.025,'Laser-etched specification plate');
  for(let line=0;line<4;line++) box(g,[.55-line*.06,.012,.01],graphite,[.05,.462,-.12+line*.07],null,.002);
  box(g,[.36,.22,.46],graphite,[.82,.27,0],null,.035,'Duplex LC optical receptacle');
  for(const z of [-.12,.12]) cylinder(g,.07,.12,black,[1.03,.27,z],[0,0,Math.PI/2],20,'LC optical port');
  box(g,[.42,.08,.32],navy,[.65,.49,0],null,.025,'Extraction latch');
  rod(g,[.48,.49,-.18],[.95,.62,-.18],.025,aluminium); rod(g,[.48,.49,.18],[.95,.62,.18],.025,aluminium); rod(g,[.95,.62,-.18],[.95,.62,.18],.025,aluminium);
  box(g,[.3,.055,.44],greenPcb,[-.79,.27,0],null,.012,'Edge connector PCB');
  for(let pin=0;pin<10;pin++) box(g,[.12,.02,.018],gold,[-.91,.27,-.18+pin*.04],null,.002,'SFP contact');
  return g;
}

function buildSmartBoard() {
  const g=new THREE.Group(); g.name='Premium interactive smart board';
  box(g,[2.65,1.52,.15],graphite,[0,1.08,0],null,.065,'Interactive display chassis');
  box(g,[2.48,1.35,.022],screen,[0,1.1,.095],null,.028,'4K touch display');
  box(g,[.58,1.05,.012],navy,[-.86,1.1,.112],null,.025,'Lesson toolbar');
  for(let tile=0;tile<6;tile++) box(g,[.48,.22,.01],tile%2?blue:mat(0x3a8ab0,.25),[-.18+(tile%2)*.65,1.39-Math.floor(tile/2)*.35,.114],null,.02,'Interactive lesson tile');
  box(g,[2.2,.11,.32],aluminium,[0,.28,.12],null,.035,'Pen and accessory tray');
  for(const [x,color] of [[-.5,0x2875a5],[-.3,0xc84642],[-.1,0xe1a533]]) cylinder(g,.035,.42,mat(color,.3),[x,.38,.18],[0,0,Math.PI/2],14,'Digital pen');
  cylinder(g,.032,.022,black,[0,1.79,.1],[Math.PI/2,0,0],18,'Conference camera');
  for(const x of [-.65,.65]) box(g,[.13,.78,.2],silver,[x,.45,-.05],null,.04,'Height mount');
  box(g,[1.45,.1,.62],graphite,[0,.07,.06],null,.06,'Mobile base');
  return g;
}

function buildSmartTv() {
  const g=new THREE.Group(); g.name='Premium bezel-less smart television';
  box(g,[2.55,1.43,.12],graphite,[0,1.12,0],null,.045,'Smart TV chassis');
  box(g,[2.43,1.31,.02],screen,[0,1.15,.075],null,.018,'OLED display');
  box(g,[.6,.74,.009],navy,[-.83,1.15,.09],null,.02,'Smart TV navigation');
  for(let tile=0;tile<6;tile++) box(g,[.42,.22,.008],tile%3===0?cyan:tile%2?blue:mat(0x315d78,.3),[-.25+(tile%3)*.52,1.37-Math.floor(tile/3)*.34,.092],null,.018,'Streaming app tile');
  box(g,[.65,.28,.15],graphite,[0,.35,-.02],null,.045,'Central TV stand neck');
  box(g,[1.28,.08,.7],graphite,[0,.09,.12],null,.05,'TV stand base');
  cylinder(g,.016,.012,cyan,[.96,.41,.07],[Math.PI/2,0,0],10,'Standby light');
  return g;
}

function buildSsd() {
  const g=new THREE.Group(); g.name='Premium 2.5-inch solid-state drive';
  box(g,[1.55,.18,1.1],graphite,[0,.2,0],null,.07,'SSD aluminium enclosure');
  box(g,[1.32,.025,.84],aluminium,[0,.305,0],null,.05,'SSD product label');
  box(g,[.86,.035,.22],navy,[0,.322,-.18],null,.025,'Solid-state drive badge');
  for(let line=0;line<4;line++) box(g,[.72-line*.08,.012,.012],graphite,[0,.325,.05+line*.08],null,.002);
  box(g,[.48,.06,.3],greenPcb,[.55,.18,-.68],null,.012,'SATA connector PCB');
  for(let pin=0;pin<14;pin++) box(g,[.022,.018,.13],gold,[.36+pin*.032,.18,-.81],null,.002,'SATA contact');
  for(const [x,z] of [[-.65,-.43],[.65,-.43],[-.65,.43],[.65,.43]]) cylinder(g,.035,.025,silver,[x,.32,z],null,14,'Mounting screw');
  return g;
}

function buildStandingFan() {
  const g=new THREE.Group(); g.name='Premium oscillating pedestal fan';
  cylinder(g,.7,.12,graphite,[0,.08,0],null,36,'Weighted fan base');
  cylinder(g,.13,.95,aluminium,[0,.6,0],null,24,'Telescopic pedestal');
  cylinder(g,.09,.78,silver,[0,1.42,0],null,22,'Height adjustment pole');
  box(g,[.35,.25,.35],graphite,[0,1.82,-.14],null,.08,'Oscillation motor');
  cylinder(g,.22,.32,graphite,[0,1.84,0],[Math.PI/2,0,0],32,'Fan motor hub');
  for(let blade=0;blade<5;blade++) {
    const angle=blade*Math.PI*2/5; const part=box(g,[.7,.045,.24],mat(0x547c90,.28,.25),[Math.cos(angle)*.36,1.84+Math.sin(angle)*.36,.14],[0,0,angle+.35],.11,'Aerodynamic fan blade'); part.scale.x=1.15;
  }
  ring(g,.72,.035,graphite,[0,1.84,.15],[0,0,0],48,'Safety grille rim');
  for(let spoke=0;spoke<12;spoke++){const a=spoke*Math.PI*2/12; rod(g,[0,1.84,.15],[Math.cos(a)*.7,1.84+Math.sin(a)*.7,.15],.012,aluminium);}
  cylinder(g,.05,.045,cyan,[0,.65,.14],[Math.PI/2,0,0],16,'Power control');
  return g;
}

function buildSurgeProtector() {
  const g=new THREE.Group(); g.name='Premium six-outlet surge protector';
  box(g,[2.15,.22,.55],mat(0xe2e5e6,.52,.08),[0,.22,0],null,.12,'Surge protector housing');
  for(let outlet=0;outlet<6;outlet++) {
    const x=-.68+outlet*.28; cylinder(g,.11,.035,aluminium,[x,.35,0],null,22,`Protected outlet ${outlet+1}`);
    for(const z of [-.04,.04]) box(g,[.025,.025,.06],black,[x,.37,z],null,.004);
  }
  box(g,[.22,.1,.18],mat(0xc94740,.25),[.88,.35,0],null,.035,'Illuminated power switch');
  cylinder(g,.018,.012,cyan,[.69,.36,.14],null,10,'Protection status');
  cylinder(g,.055,.14,rubber,[-1.16,.22,0],[0,0,Math.PI/2],16,'Cable strain relief');
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.2,.22,0),new THREE.Vector3(-1.5,.16,.18),new THREE.Vector3(-1.76,.18,0)]);
  add(g,new THREE.TubeGeometry(cable,24,.04,10,false),rubber,[0,0,0],null,'Power cord');
  return g;
}

function buildPremiumTablet() {
  const g=new THREE.Group(); g.name='Premium enterprise tablet';
  box(g,[1.6,.09,2.15],graphite,[0,.18,0],[-.08,0,0],.09,'Tablet aluminium chassis');
  box(g,[1.45,.018,1.98],screen,[0,.235,0],[-.08,0,0],.045,'Tablet display');
  box(g,[.42,.012,1.66],navy,[-.46,.25,0],[-.08,0,0],.025,'Productivity sidebar');
  for(let tile=0;tile<6;tile++) box(g,[.34,.01,.42],tile%2?blue:cyan,[.14+(tile%2)*.42,.252,-.52+Math.floor(tile/2)*.52],[-.08,0,0],.025,'Application tile');
  cylinder(g,.025,.016,black,[0,.28,-.98],[Math.PI/2,0,0],18,'Front camera');
  box(g,[.035,.05,.32],silver,[.82,.16,.25],null,.01,'Volume rocker');
  cylinder(g,.055,.04,graphite,[-.6,.12,-.83],null,18,'Rear camera');
  cylinder(g,.03,.042,glass,[-.6,.15,-.83],null,16,'Camera lens');
  return g;
}

function buildTapeDrive() {
  const g=new THREE.Group(); g.name='Premium LTO tape backup drive';
  box(g,[1.75,.68,1.42],graphite,[0,.43,0],null,.075,'LTO drive chassis');
  box(g,[1.55,.54,.04],black,[0,.43,.75],null,.055,'Tape drive front panel');
  box(g,[.9,.28,.055],graphite,[-.18,.45,.79],null,.025,'Tape cartridge slot');
  box(g,[.7,.2,.035],navy,[-.18,.45,.825],null,.018,'Inserted LTO cartridge');
  box(g,[.34,.18,.025],screen,[.53,.49,.79],null,.03,'Drive status display');
  cylinder(g,.055,.035,cyan,[.52,.29,.79],[Math.PI/2,0,0],18,'Eject key');
  for(let vent=0;vent<11;vent++) box(g,[.055,.018,.72],black,[-.45+vent*.09,.785,-.2],null,.006,'Cooling vent');
  for(const x of [-.72,.72]) box(g,[.26,.07,.3],rubber,[x,.06,.3],null,.025,'Drive foot');
  return g;
}

function buildPremiumToolkit() {
  const g=new THREE.Group(); g.name='Premium open technician toolkit';
  box(g,[2.0,.28,1.15],graphite,[0,.23,0],null,.12,'Rugged tool case base');
  const lid=new THREE.Group(); lid.position.set(0,.36,-.52); lid.rotation.x=-.72;
  box(lid,[2,.12,1.02],graphite,[0,.43,0],null,.11,'Open case lid');
  box(lid,[1.75,.06,.78],mat(0x33434d,.75),[0,.48,.02],null,.07,'Foam tool organizer'); g.add(lid);
  for(const [x,color] of [[-.65,0xd5a135],[-.32,0xc74942],[.02,0x2477a6]]) {
    cylinder(g,.065,.72,mat(color,.32),[x,.52,.05],[0,0,Math.PI/2],18,'Insulated screwdriver');
    cylinder(g,.1,.22,rubber,[x-.38,.52,.05],[0,0,Math.PI/2],18,'Tool handle');
  }
  const pliers=new THREE.Group(); pliers.position.set(.48,.48,.1); pliers.rotation.y=-.25;
  for(const x of [-.1,.1]) rod(pliers,[x,0,0],[x*.5,.65,0],.055,x<0?mat(0xd5a135,.4):mat(0xc74942,.4));
  rod(pliers,[-.05,.65,0],[-.2,.9,0],.035,silver); rod(pliers,[.05,.65,0],[.2,.9,0],.035,silver); g.add(pliers);
  box(g,[.48,.34,.18],graphite,[.68,.47,-.3],null,.05,'Digital tester');
  box(g,[.3,.16,.012],screen,[.68,.57,-.21],null,.025);
  box(g,[.48,.12,.3],graphite,[0,.06,.66],null,.045,'Carry handle');
  return g;
}

function buildTeleprompter() {
  const g=new THREE.Group(); g.name='Premium studio teleprompter';
  box(g,[1.85,1.1,.045],glass,[0,1.2,.18],[-.18,0,0],.025,'Beam-splitter glass');
  for(const x of [-.98,.98]) rod(g,[x,.55,-.25],[x,1.82,.08],.035,graphite);
  rod(g,[-.98,.55,-.25],[.98,.55,-.25],.04,graphite); rod(g,[-.98,1.82,.08],[.98,1.82,.08],.04,graphite);
  box(g,[1.72,.09,.92],graphite,[0,.36,.22],[.08,0,0],.045,'Prompt monitor tray');
  box(g,[1.55,.018,.74],screen,[0,.43,.24],[.08,0,0],.025,'Prompt display');
  for(let line=0;line<5;line++) box(g,[1.12-line%2*.18,.01,.035],mat(0xe7eef1,.65),[0,.45,-.02+line*.13],[.08,0,0],.004,'Prompt text line');
  box(g,[.88,.64,.8],black,[0,1.16,-.48],null,.12,'Camera blackout hood');
  cylinder(g,.17,.32,graphite,[0,1.18,-.85],[Math.PI/2,0,0],30,'Camera lens opening');
  box(g,[1.25,.1,.65],graphite,[0,.07,.06],null,.055,'Teleprompter base');
  return g;
}

function buildVgaCable() {
  const g=new THREE.Group(); g.name='Premium shielded VGA cable';
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.05,.25,0),new THREE.Vector3(-.5,.2,.38),new THREE.Vector3(.12,.22,-.32),new THREE.Vector3(.72,.2,.28),new THREE.Vector3(1.05,.25,0)]);
  add(g,new THREE.TubeGeometry(curve,64,.05,12,false),mat(0x23314a,.7,.2),[0,0,0],null,'Shielded VGA cable');
  for(const side of [-1,1]) {
    box(g,[.42,.22,.34],navy,[side*1.2,.25,0],null,.045,'VGA connector hood');
    box(g,[.16,.17,.29],silver,[side*1.48,.25,0],null,.018,'DE-15 shell');
    for(let pin=0;pin<15;pin++) cylinder(g,.009,.035,gold,[side*1.575,.2+(pin%3)*.05,-.11+Math.floor(pin/3)*.055],[0,0,Math.PI/2],8,'VGA pin');
    for(const z of [-.22,.22]) cylinder(g,.035,.12,silver,[side*1.35,.25,z],[0,0,Math.PI/2],14,'Thumb screw');
  }
  return g;
}

function buildCaptureCard() {
  const g=new THREE.Group(); g.name='Premium HDMI video capture card';
  box(g,[1.45,.24,.78],graphite,[0,.24,0],null,.11,'Capture card enclosure');
  box(g,[1.25,.025,.6],aluminium,[0,.38,0],null,.08,'Brushed aluminium top');
  box(g,[.5,.12,.045],black,[-.35,.24,.42],null,.02,'HDMI input');
  box(g,[.3,.1,.045],black,[.38,.24,.42],null,.02,'USB output');
  for(let pin=0;pin<10;pin++) box(g,[.025,.014,.01],gold,[-.52+pin*.038,.24,.45],null,.002);
  cylinder(g,.018,.012,cyan,[.45,.39,.18],null,10,'Capture status');
  box(g,[.66,.14,.018],navy,[0,.395,-.08],null,.025,'4K capture badge');
  for(let vent=0;vent<7;vent++) box(g,[.045,.025,.42],black,[-.3+vent*.1,.395,-.12],null,.006,'Cooling groove');
  return g;
}

function buildVideoEncoder() {
  const g=new THREE.Group(); g.name='Premium streaming video encoder';
  box(g,[1.75,.54,1.12],graphite,[0,.36,0],null,.09,'Encoder chassis');
  box(g,[1.55,.42,.035],black,[0,.36,.59],null,.055,'Encoder front panel');
  box(g,[.64,.24,.025],screen,[-.36,.4,.62],null,.035,'Stream status display');
  for(let line=0;line<3;line++) box(g,[.4-line*.05,.025,.008],cyan,[-.36,.46-line*.07,.638],null,.004);
  cylinder(g,.07,.035,cyan,[.26,.42,.62],[Math.PI/2,0,0],20,'Stream control');
  for(const x of [.48,.68]) cylinder(g,.045,.03,silver,[x,.34,.62],[Math.PI/2,0,0],16,'Menu key');
  for(let vent=0;vent<10;vent++) box(g,[.06,.02,.62],black,[-.45+vent*.1,.64,-.1],null,.006,'Encoder vent');
  for(const x of [-.82,.82]) box(g,[.2,.07,.28],rubber,[x,.06,.2],null,.025,'Isolation foot');
  return g;
}

function buildWaterDispenser() {
  const g=new THREE.Group(); g.name='Premium bottled water dispenser';
  const white=mat(0xdfe4e5,.38,.15);
  box(g,[1.05,1.55,.82],white,[0,.8,0],null,.13,'Water dispenser cabinet');
  box(g,[.78,.62,.12],graphite,[0,1.02,.47],null,.07,'Dispensing alcove');
  for(const [x,color] of [[-.2,0x2b8ac2],[.2,0xc94b42]]) {
    cylinder(g,.065,.16,mat(color,.25),[x,1.26,.52],[Math.PI/2,0,0],18,'Water tap');
    cylinder(g,.035,.2,silver,[x,1.13,.56],null,14,'Tap spout');
  }
  box(g,[.56,.06,.32],aluminium,[0,.72,.43],null,.025,'Drip tray');
  for(let slot=0;slot<6;slot++) box(g,[.045,.02,.22],black,[-.15+slot*.06,.76,.44],null,.004);
  cylinder(g,.34,.9,mat(0x8bc8dd,.18,.05,{transparent:true,opacity:.72}),[0,2.03,0],null,40,'Water bottle');
  cylinder(g,.22,.16,blue,[0,2.52,0],null,32,'Bottle cap');
  box(g,[.62,.38,.025],graphite,[0,.35,.43],null,.045,'Storage door');
  return g;
}

function buildWifiRouter() {
  const g=new THREE.Group(); g.name='Premium Wi-Fi 6 router';
  box(g,[1.75,.28,1.02],graphite,[0,.27,0],null,.13,'Router chassis');
  box(g,[1.52,.025,.78],navy,[0,.42,0],null,.1,'Router top panel');
  for(const x of [-.65,.65]) rod(g,[x,.39,-.35],[x*1.2,1.48,-.45],.035,graphite);
  for(let led=0;led<6;led++) cylinder(g,.016,.012,led<5?cyan:silver,[-.28+led*.12,.43,.38],null,10,'Router status LED');
  box(g,[1.35,.18,.035],black,[0,.27,-.53],null,.035,'Router rear panel');
  for(let port=0;port<5;port++) box(g,[.18,.1,.04],port===0?navy:aluminium,[-.48+port*.24,.27,-.56],null,.012,'Ethernet port');
  for(let vent=0;vent<10;vent++) box(g,[.055,.018,.52],black,[-.4+vent*.09,.435,-.08],null,.006,'Router vent');
  return g;
}

function buildMouse(wireless=false) {
  const g=new THREE.Group(); g.name=`Premium ergonomic ${wireless?'wireless':'wired'} optical mouse`;
  const shell=add(g,new THREE.SphereGeometry(.72,40,24),graphite,[0,.34,0],null,'Ergonomic mouse shell'); shell.scale.set(.8,.5,1.15);
  box(g,[.035,.18,1.02],black,[0,.52,-.08],null,.012,'Primary button split');
  cylinder(g,.09,.12,rubber,[0,.58,-.24],[0,0,Math.PI/2],24,'Scroll wheel');
  box(g,[.17,.035,.42],black,[-.58,.36,.05],[0,.18,0],.04,'Thumb rest');
  for(const z of [-.06,.14]) box(g,[.035,.08,.12],silver,[-.65,.39,z],null,.012,'Side navigation key');
  cylinder(g,.018,.012,cyan,[0,.55,.35],null,10,'DPI indicator');
  if(!wireless) {
    const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(0,.28,-.72),new THREE.Vector3(.3,.18,-1.0),new THREE.Vector3(.72,.18,-1.2)]);
    add(g,new THREE.TubeGeometry(cable,28,.028,9,false),rubber,[0,0,0],null,'Braided USB cable');
    box(g,[.3,.12,.16],aluminium,[.88,.18,-1.28],null,.035,'USB plug');
  }
  return g;
}

function buildWirelessAccessPoint() {
  const g=new THREE.Group(); g.name='Premium ceiling Wi-Fi access point';
  cylinder(g,.92,.24,mat(0xe3e8e8,.42,.15),[0,.22,0],null,48,'Access point enclosure');
  cylinder(g,.78,.025,aluminium,[0,.355,0],null,48,'Sculpted top panel');
  ring(g,.58,.018,cyan,[0,.375,0],[Math.PI/2,0,0],48,'Status light ring');
  cylinder(g,.12,.035,mat(0xd8dfe1,.45),[0,.38,0],null,28,'Central status cap');
  for(let vent=0;vent<16;vent++) {
    const a=vent*Math.PI*2/16; box(g,[.08,.025,.24],graphite,[Math.cos(a)*.72,.24,Math.sin(a)*.72],[0,-a,0],.012,'Perimeter vent');
  }
  box(g,[.34,.08,.22],black,[0,.08,-.58],null,.025,'PoE Ethernet port');
  return g;
}

function buildWirelessMicKit() {
  const g=new THREE.Group(); g.name='Premium dual wireless microphone kit';
  box(g,[1.85,.48,1.0],graphite,[0,.33,0],null,.08,'Wireless receiver');
  box(g,[1.65,.34,.035],black,[0,.34,.53],null,.045,'Receiver front panel');
  for(const x of [-.43,.43]) {
    box(g,[.48,.2,.022],screen,[x,.38,.56],null,.03,'Channel display');
    cylinder(g,.065,.032,silver,[x,.2,.56],[Math.PI/2,0,0],20,'Channel control');
    rod(g,[x,.56,-.48],[x*1.45,1.22,-.55],.025,graphite);
  }
  for(const x of [-.42,.42]) {
    const mic=new THREE.Group(); mic.rotation.z=x<0?.18:-.18; mic.position.set(x,1.0,.08);
    cylinder(mic,.1,.82,graphite,[0,.35,0],null,28,'Wireless microphone handle');
    cylinder(mic,.2,.32,black,[0,.92,0],null,36,'Microphone grille');
    ring(mic,.17,.012,silver,[0,.78,0],[Math.PI/2,0,0],30); g.add(mic);
  }
  return g;
}

function buildXlrCable() {
  const g=new THREE.Group(); g.name='Premium balanced XLR microphone cable';
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.08,.24,0),new THREE.Vector3(-.48,.18,.4),new THREE.Vector3(.08,.2,-.35),new THREE.Vector3(.65,.18,.32),new THREE.Vector3(1.08,.24,0)]);
  add(g,new THREE.TubeGeometry(curve,64,.05,12,false),rubber,[0,0,0],null,'Balanced audio cable');
  for(const side of [-1,1]) {
    cylinder(g,.12,.34,graphite,[side*1.25,.24,0],[0,0,Math.PI/2],28,'XLR connector barrel');
    cylinder(g,.1,.12,silver,[side*1.48,.24,0],[0,0,Math.PI/2],28,'XLR shell');
    if(side<0) for(let pin=0;pin<3;pin++) cylinder(g,.012,.07,gold,[side*1.57,.2+pin*.045,-.04+pin*.04],[0,0,Math.PI/2],8,'XLR pin');
    else for(let pin=0;pin<3;pin++) cylinder(g,.018,.045,black,[side*1.55,.2+pin*.045,-.04+pin*.04],[0,0,Math.PI/2],10,'XLR socket');
  }
  return g;
}

function buildThinClient() {
  const g = new THREE.Group(); g.name = 'Premium enterprise thin client';
  box(g, [1.18, .34, 1.05], graphite, [0, .3, 0], null, .13, 'Thin client enclosure');
  box(g, [1.02, .035, .86], aluminium, [0, .49, 0], null, .1, 'Ventilated top plate');
  for (let vent = 0; vent < 9; vent += 1) box(g, [.045, .018, .58], black, [-.38 + vent * .095, .515, 0], null, .007, 'Cooling slot');
  box(g, [1.02, .2, .035], black, [0, .3, .55], null, .04, 'Front IO panel');
  cylinder(g, .055, .035, cyan, [-.42, .31, .58], [Math.PI/2,0,0], 18, 'Power key');
  for (const x of [-.2, .02]) box(g, [.13, .075, .04], silver, [x, .31, .58], null, .012, 'USB port');
  cylinder(g, .04, .035, graphite, [.27, .31, .58], [Math.PI/2,0,0], 16, 'Audio port');
  box(g, [.12, .56, .44], graphite, [0, .17, -.16], null, .04, 'Vertical stand');
  return g;
}

function buildUps() {
  const g = new THREE.Group(); g.name = 'Premium line-interactive UPS';
  box(g, [1.05, 1.72, 1.18], graphite, [0, .9, 0], null, .16, 'UPS tower chassis');
  box(g, [.78, 1.42, .035], black, [0, .94, .62], null, .1, 'UPS front fascia');
  box(g, [.5, .32, .025], screen, [0, 1.36, .65], null, .05, 'UPS LCD');
  for (let bar=0;bar<4;bar++) box(g,[.055,.12,.01],bar<3?cyan:silver,[-.14+bar*.09,1.36,.67],null,.008,'Load bar');
  cylinder(g, .09, .045, cyan, [0, 1.04, .65], [Math.PI/2,0,0], 24, 'Power control');
  for (let vent=0;vent<8;vent++) box(g,[.42,.025,.035],aluminium,[0,.72-vent*.075,.65],null,.006,'Front vent');
  for (const x of [-.36,.36]) box(g,[.24,.08,.38],rubber,[x,.05,.12],null,.03,'Anti-slip foot');
  return g;
}

function buildUpsBattery() {
  const g = new THREE.Group(); g.name = 'Premium sealed UPS replacement battery';
  box(g, [1.5, .88, 1.02], graphite, [0, .5, 0], null, .12, 'Sealed lead-acid battery');
  box(g, [1.28, .035, .82], black, [0, .96, 0], null, .08, 'Battery top');
  for (const [x,color] of [[-.42,0xc94741],[.42,0x252b30]]) {
    cylinder(g,.13,.1,mat(color,.35,.35),[x,1.04,-.22],null,24,'Battery terminal');
    box(g,[.16,.06,.28],copper,[x,1.12,-.22],null,.02,'Terminal blade');
  }
  box(g, [.72, .36, .025], mat(0xe2e5e6,.6), [0, .57, .525], null, .035, 'Battery specification label');
  for(let line=0;line<4;line++) box(g,[.5-line*.05,.018,.008],graphite,[0,.68-line*.07,.542],null,.003);
  for(let rib=0;rib<5;rib++) box(g,[.035,.48,.025],black,[-.48+rib*.24,.48,-.522],null,.006,'Case reinforcement rib');
  return g;
}

function buildUsbEthernet() {
  const g = new THREE.Group(); g.name = 'Premium USB 3 Ethernet adapter';
  box(g, [.9, .25, .58], graphite, [0, .23, 0], null, .1, 'Ethernet adapter housing');
  box(g,[.56,.15,.04],black,[0,.23,.32],null,.025,'RJ45 socket');
  for(let pin=0;pin<8;pin++) box(g,[.035,.025,.12],gold,[-.14+pin*.04,.28,.35],null,.004,'RJ45 contact');
  cylinder(g,.05,.14,rubber,[-.52,.23,0],[0,0,Math.PI/2],16,'Cable strain relief');
  const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(-.58,.23,0),new THREE.Vector3(-.9,.2,.08),new THREE.Vector3(-1.15,.2,-.08)]);
  add(g,new THREE.TubeGeometry(cable,24,.032,10,false),rubber,[0,0,0],null,'USB cable');
  box(g,[.34,.13,.16],aluminium,[-1.3,.2,-.08],null,.035,'USB-A plug');
  box(g,[.15,.08,.08],black,[-1.51,.2,-.08],null,.008);
  for(const x of [-.28,-.18]) cylinder(g,.015,.012,cyan,[x,.37,.18],null,10,'Network status light');
  return g;
}

function buildFlashDrive() {
  const g = new THREE.Group(); g.name = 'Premium metal USB flash drive';
  box(g,[1.02,.22,.4],graphite,[0,.23,0],null,.12,'Flash drive body');
  box(g,[.68,.035,.3],aluminium,[.02,.36,0],null,.08,'Brushed metal accent');
  box(g,[.42,.16,.28],silver,[-.7,.23,0],null,.025,'USB-A connector');
  box(g,[.2,.085,.18],black,[-1.01,.23,0],null,.008,'USB insert');
  for(const z of [-.055,.055]) box(g,[.12,.015,.035],gold,[-1.08,.23,z],null,.003,'USB contact');
  ring(g,.14,.035,aluminium,[.6,.23,0],[Math.PI/2,0,0],28,'Keyring eye');
  cylinder(g,.018,.012,cyan,[.38,.37,.13],null,10,'Activity light');
  return g;
}

function buildUsbHub() {
  const g = new THREE.Group(); g.name = 'Premium powered USB-C hub';
  box(g,[1.45,.25,.72],graphite,[0,.24,0],null,.12,'USB hub enclosure');
  box(g,[1.28,.025,.56],aluminium,[0,.38,0],null,.09,'Anodized top');
  for(let port=0;port<4;port++) {
    const x=-.46+port*.31;
    box(g,[.22,.085,.04],black,[x,.24,.39],null,.012,`USB port ${port+1}`);
    box(g,[.14,.025,.012],port===3?cyan:silver,[x,.24,.415],null,.004);
  }
  box(g,[.18,.07,.035],black,[.63,.24,-.18],null,.012,'USB-C PD port');
  cylinder(g,.045,.13,rubber,[-.82,.24,0],[0,0,Math.PI/2],16,'Host cable strain relief');
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(-.87,.24,0),new THREE.Vector3(-1.13,.2,.08),new THREE.Vector3(-1.35,.2,-.04)]);
  add(g,new THREE.TubeGeometry(cable,20,.03,10,false),rubber,[0,0,0],null,'USB-C host cable');
  box(g,[.25,.11,.14],aluminium,[-1.49,.2,-.04],null,.035,'USB-C host plug');
  return g;
}

function buildOfficeHeadset() {
  const g = new THREE.Group(); g.name = 'Premium ergonomic USB office headset';
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-.62,.72,0),new THREE.Vector3(-.5,1.45,0),new THREE.Vector3(0,1.78,0),new THREE.Vector3(.5,1.45,0),new THREE.Vector3(.62,.72,0)]);
  add(g,new THREE.TubeGeometry(curve,44,.075,14,false),graphite,[0,0,0],null,'Padded headband');
  const inner=new THREE.CatmullRomCurve3([new THREE.Vector3(-.53,.85,0),new THREE.Vector3(-.4,1.36,0),new THREE.Vector3(0,1.62,0),new THREE.Vector3(.4,1.36,0),new THREE.Vector3(.53,.85,0)]);
  add(g,new THREE.TubeGeometry(inner,40,.045,12,false),rubber,[0,0,0],null,'Headband cushion');
  for(const x of [-.62,.62]) {
    cylinder(g,.26,.18,graphite,[x,.69,0],[0,0,Math.PI/2],32,'Ear cup');
    cylinder(g,.21,.2,rubber,[x,.69,0],[0,0,Math.PI/2],32,'Memory foam cushion');
    box(g,[.12,.36,.16],silver,[x,.99,0],null,.04,'Headset slider');
  }
  const boom=new THREE.CatmullRomCurve3([new THREE.Vector3(-.7,.68,.04),new THREE.Vector3(-.98,.48,.12),new THREE.Vector3(-1.08,.28,.25)]);
  add(g,new THREE.TubeGeometry(boom,24,.025,10,false),graphite,[0,0,0],null,'Flexible microphone boom');
  cylinder(g,.075,.2,black,[-1.08,.28,.25],[Math.PI/2,0,.35],22,'Noise-cancelling microphone');
  return g;
}

function buildWebcam() {
  const g = new THREE.Group(); g.name = 'Premium USB 4K webcam';
  box(g,[1.35,.52,.45],graphite,[0,.8,0],null,.19,'Webcam body');
  cylinder(g,.22,.15,black,[0,.82,.27],[Math.PI/2,0,0],36,'Camera bezel');
  cylinder(g,.14,.17,glass,[0,.82,.32],[Math.PI/2,0,0],36,'4K lens');
  cylinder(g,.055,.18,screen,[0,.82,.34],[Math.PI/2,0,0],28,'Lens element');
  for(const x of [-.43,.43]) cylinder(g,.025,.16,black,[x,.72,.25],[Math.PI/2,0,0],14,'Stereo microphone');
  cylinder(g,.018,.012,cyan,[.48,.92,.25],[Math.PI/2,0,0],10,'Privacy status');
  box(g,[.42,.42,.18],aluminium,[0,.45,-.05],null,.055,'Tilt hinge');
  box(g,[1.05,.12,.56],graphite,[0,.16,.08],null,.06,'Monitor clip');
  box(g,[.72,.12,.48],rubber,[.12,.05,-.12],[-.25,0,0],.045,'Adjustable lower jaw');
  return g;
}

function buildUsbCCable() {
  const g = new THREE.Group(); g.name = 'Premium braided USB-C cable';
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-1.1,.25,0),new THREE.Vector3(-.5,.18,.35),new THREE.Vector3(.05,.22,-.3),new THREE.Vector3(.65,.18,.28),new THREE.Vector3(1.05,.24,0)]);
  add(g,new THREE.TubeGeometry(curve,64,.045,12,false),mat(0x242b30,.75,.15),[0,0,0],null,'Braided cable');
  for(const x of [-1.22,1.22]) {
    cylinder(g,.065,.16,rubber,[x>.0?1.12:-1.12,.25,0],[0,0,Math.PI/2],18,'Strain relief');
    box(g,[.3,.15,.22],aluminium,[x,.25,0],null,.055,'USB-C connector');
    box(g,[.12,.065,.12],black,[x+(x>0?.2:-.2),.25,0],null,.018,'USB-C tongue');
  }
  return g;
}

function buildDisplayAdapter() {
  const g = new THREE.Group(); g.name = 'Premium USB-C display adapter';
  box(g,[1.15,.27,.68],aluminium,[0,.24,0],null,.11,'Display adapter enclosure');
  box(g,[.55,.12,.045],black,[0,.24,.37],null,.018,'HDMI output');
  for(let pin=0;pin<10;pin++) box(g,[.025,.015,.012],gold,[-.19+pin*.042,.24,.398],null,.002,'HDMI contact');
  box(g,[.18,.075,.04],black,[.48,.24,-.18],null,.012,'USB-C power input');
  cylinder(g,.05,.14,rubber,[-.65,.24,0],[0,0,Math.PI/2],16,'Cable relief');
  const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(-.7,.24,0),new THREE.Vector3(-.98,.19,.1),new THREE.Vector3(-1.24,.21,-.04)]);
  add(g,new THREE.TubeGeometry(cable,24,.032,10,false),rubber,[0,0,0],null,'USB-C lead');
  box(g,[.3,.13,.18],aluminium,[-1.4,.21,-.04],null,.04,'USB-C plug');
  cylinder(g,.018,.012,cyan,[.4,.39,.15],null,10,'Signal status');
  return g;
}

function buildNetworkSwitch() {
  const g = new THREE.Group(); g.name = 'Premium managed 24-port network switch';
  box(g, [2.3, .36, 1.05], graphite, [0, .3, 0], null, .045, 'Managed switch chassis');
  box(g, [2.18, .27, .035], black, [0, .3, .55], null, .025, 'Switch front panel');
  for (let port = 0; port < 24; port += 1) {
    const row = Math.floor(port / 12); const col = port % 12;
    const x = -.88 + col * .16; const y = .36 - row * .13;
    box(g, [.13, .095, .045], graphite, [x, y, .585], null, .012, `Gigabit Ethernet port ${port + 1}`);
    box(g, [.085, .045, .012], black, [x, y, .613], null, .004);
    cylinder(g, .01, .01, port < 18 ? cyan : silver, [x + .05, y + .05, .615], [Math.PI / 2, 0, 0], 8);
  }
  for (const x of [.72, .9]) box(g, [.14, .1, .045], aluminium, [x, .3, .585], null, .012, 'SFP uplink port');
  for (let vent = 0; vent < 12; vent += 1) box(g, [.09, .018, .38], black, [-.65 + vent * .12, .49, -.2], null, .008, 'Cooling vent');
  for (const x of [-1.22, 1.22]) box(g, [.16, .48, .35], aluminium, [x, .3, .34], null, .02, 'Rack mounting ear');
  return g;
}

function build3dPrinter() {
  const g = new THREE.Group(); g.name = 'Premium enclosed FDM 3D printer';
  for (const x of [-.72, .72]) for (const z of [-.62, .62]) rod(g, [x, .12, z], [x, 1.75, z], .045, graphite);
  for (const y of [.12, 1.75]) {
    rod(g, [-.72, y, -.62], [.72, y, -.62], .045, graphite); rod(g, [-.72, y, .62], [.72, y, .62], .045, graphite);
    rod(g, [-.72, y, -.62], [-.72, y, .62], .045, graphite); rod(g, [.72, y, -.62], [.72, y, .62], .045, graphite);
  }
  box(g, [1.3, .1, 1.05], aluminium, [0, .35, 0], null, .035, 'Heated print bed');
  box(g, [1.16, .025, .92], mat(0x24343b, .5), [0, .415, 0], null, .02, 'Textured build plate');
  rod(g, [-.62, 1.45, 0], [.62, 1.45, 0], .04, silver);
  box(g, [.32, .25, .28], graphite, [0, 1.36, 0], null, .06, 'Direct-drive print head');
  cylinder(g, .055, .16, copper, [0, 1.17, 0], null, 18, 'Brass nozzle');
  ring(g, .34, .055, mat(0x2b79b3, .4), [.82, 1.36, 0], [Math.PI / 2, 0, 0], 36, 'Filament spool');
  box(g, [.46, .28, .04], screen, [.48, .25, .66], null, .04, 'Touch display');
  return g;
}

function buildAcAdapter() {
  const g = new THREE.Group(); g.name = 'Premium USB-C AC power adapter';
  box(g, [.78, .58, .92], mat(0x303840, .36, .45), [0, .36, 0], null, .16, 'Power adapter body');
  box(g, [.62, .025, .68], graphite, [0, .665, 0], null, .1, 'Rating panel');
  for (const x of [-.14, .14]) box(g, [.085, .36, .075], silver, [x, .96, -.1], null, .012, 'AC mains blade');
  cylinder(g, .075, .12, rubber, [0, .32, .51], [Math.PI / 2, 0, 0], 20, 'Cable strain relief');
  const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(0,.32,.55),new THREE.Vector3(.35,.23,.8),new THREE.Vector3(.72,.16,.63),new THREE.Vector3(.9,.2,.28)]);
  add(g, new THREE.TubeGeometry(cable, 32, .035, 10, false), rubber, [0,0,0], null, 'USB-C charging cable');
  box(g, [.3, .12, .14], aluminium, [.98, .2, .23], null, .045, 'USB-C plug');
  box(g, [.12, .055, .035], black, [1.14, .2, .23], null, .008);
  return g;
}

function buildAccessPanel() {
  const g = new THREE.Group(); g.name = 'Premium network access control panel';
  box(g, [1.45, 1.85, .38], graphite, [0, 1, 0], null, .11, 'Access controller enclosure');
  box(g, [1.26, 1.62, .035], aluminium, [0, 1, .22], null, .075, 'Locking front door');
  box(g, [.62, .28, .025], screen, [0, 1.48, .25], null, .04, 'Controller status display');
  for (let row = 0; row < 4; row += 1) {
    cylinder(g, .025, .018, row < 3 ? cyan : mat(0xe3a13b,.3), [-.46, 1.18 - row * .18, .25], [Math.PI/2,0,0], 12);
    box(g, [.55, .035, .012], graphite, [.08, 1.18 - row * .18, .25], null, .006, 'System status label');
  }
  cylinder(g, .075, .04, silver, [.48, .52, .25], [Math.PI / 2,0,0], 20, 'Cabinet lock');
  box(g, [.42, .08, .04], black, [0, .2, .22], null, .018, 'Cable entry');
  return g;
}

function buildAirConditioner() {
  const g = new THREE.Group(); g.name = 'Premium wall-mounted split air conditioner';
  const white = mat(0xe4e8e8, .35, .12);
  box(g, [2.45, .72, .65], white, [0, .65, 0], null, .24, 'Split AC indoor unit');
  box(g, [2.12, .12, .1], black, [0, .32, .32], null, .035, 'Air outlet');
  for (let vane = 0; vane < 11; vane += 1) box(g, [.025, .08, .46], aluminium, [-.95 + vane * .19, .31, .1], [0,0,.12], .005, 'Air direction vane');
  box(g, [.42, .15, .025], screen, [.72, .72, .34], null, .03, 'Temperature display');
  cylinder(g, .018, .012, cyan, [.95, .56, .34], [Math.PI/2,0,0], 10, 'Operation light');
  for (let vent = 0; vent < 16; vent += 1) box(g, [.1, .018, .18], aluminium, [-.9 + vent * .12, 1.01, -.08], null, .006, 'Intake grille');
  return g;
}

function buildAllInOne() {
  const g = new THREE.Group(); g.name = 'Premium all-in-one desktop computer';
  box(g, [2.18, 1.28, .14], graphite, [0, 1.18, 0], null, .075, 'All-in-one display chassis');
  box(g, [2.02, 1.12, .025], screen, [0, 1.2, .09], null, .035, 'Edge-to-edge display');
  box(g, [.55, .76, .014], navy, [-.68, 1.2, .11], null, .025, 'Desktop sidebar');
  for (let tile = 0; tile < 4; tile += 1) box(g, [.48, .24, .012], tile % 2 ? blue : cyan, [.08 + (tile%2)*.58, 1.44-Math.floor(tile/2)*.34, .112], null, .022, 'Desktop tile');
  cylinder(g, .025, .02, black, [0, 1.77, .09], [Math.PI/2,0,0], 16, 'Webcam');
  box(g, [.28, .78, .24], silver, [0, .48, -.08], null, .055, 'Adjustable stand');
  box(g, [1.08, .1, .72], graphite, [0, .09, .08], null, .07, 'Weighted base');
  for (const x of [-.72,.72]) box(g, [.18,.055,.025], black, [x,.63,-.09], null,.01,'Rear port');
  return g;
}

function buildAudioMixer() {
  const g = new THREE.Group(); g.name = 'Premium compact digital audio mixer';
  const body = new THREE.Group(); body.rotation.x = -.16;
  box(body, [2.25, .28, 1.35], graphite, [0, .38, 0], null, .08, 'Mixer console');
  box(body, [2.08, .035, 1.17], aluminium, [0, .54, 0], null, .045, 'Control surface');
  for (let channel = 0; channel < 8; channel += 1) {
    const x = -.82 + channel * .235;
    cylinder(body, .055, .05, channel % 3 === 0 ? mat(0xd5a83d,.25) : channel % 3 === 1 ? blue : silver, [x,.59,-.38], null, 20, `Channel ${channel+1} gain`);
    for (let eq=0; eq<3; eq+=1) cylinder(body,.035,.045,eq===0?navy:graphite,[x,.58,-.14+eq*.16],null,16,'EQ control');
    box(body,[.055,.025,.35],black,[x,.58,.48],null,.012,'Fader track');
    box(body,[.12,.06,.1],silver,[x,.62,.51],null,.018,'Channel fader');
  }
  box(body,[.46,.035,.27],screen,[.72,.58,-.23],null,.035,'Level display');
  for(let meter=0;meter<5;meter++) box(body,[.035,.018,.04],meter<4?cyan:mat(0xe0a23e,.2),[.58+meter*.07,.61,-.23],null,.005);
  g.add(body); return g;
}

function buildLabelPrinter() {
  const g = new THREE.Group(); g.name = 'Premium industrial barcode label printer';
  box(g, [1.45, 1.02, 1.25], graphite, [0,.58,0], null,.16,'Label printer enclosure');
  box(g,[1.18,.18,.82],aluminium,[0,1.02,-.08],[-.08,0,0],.07,'Media access lid');
  box(g,[.92,.055,.16],black,[0,.78,.65],null,.025,'Label output slot');
  box(g,[.74,.018,.48],mat(0xf4f2e8,.85),[0,.53,.82],[-.12,0,0],.018,'Printed barcode label');
  for(let bar=0;bar<18;bar++) box(g,[bar%4===0?.04:.018,.008,.25],black,[-.3+bar*.035,.58,.85],[-.12,0,0],.002,'Barcode stripe');
  box(g,[.38,.27,.025],screen,[.42,.89,.62],null,.04,'Printer display');
  for(const x of [-.38,-.18,.02]) cylinder(g,.045,.028,x===.02?cyan:silver,[x,.93,.64],[Math.PI/2,0,0],16,'Printer control');
  return g;
}

function buildBindingMachine() {
  const g = new THREE.Group(); g.name = 'Premium office comb binding machine';
  box(g,[2.05,.38,1.02],graphite,[0,.28,0],null,.09,'Binding machine base');
  box(g,[1.8,.07,.62],aluminium,[0,.5,.08],[-.08,0,0],.035,'Paper guide deck');
  box(g,[1.58,.09,.12],black,[0,.57,-.32],null,.018,'Punch entry');
  for(let tooth=0;tooth<16;tooth++) box(g,[.055,.08,.18],silver,[-.68+tooth*.09,.61,.27],null,.008,'Comb opener tooth');
  rod(g,[-.72,.62,-.32],[.72,.62,-.32],.04,graphite);
  rod(g,[.66,.62,-.32],[.98,1.42,-.22],.055,graphite);
  rod(g,[.98,1.42,-.22],[-.48,1.42,-.22],.055,graphite);
  box(g,[.28,.12,.16],rubber,[-.58,1.42,-.22],null,.045,'Punch handle grip');
  cylinder(g,.055,.04,cyan,[.72,.43,.53],[Math.PI/2,0,0],18,'Margin control');
  return g;
}

function buildBiometricReader() {
  const g = new THREE.Group(); g.name = 'Premium biometric access reader';
  box(g,[.9,1.65,.28],graphite,[0,.88,0],null,.18,'Biometric reader body');
  box(g,[.68,.5,.025],screen,[0,1.25,.17],null,.06,'Access status display');
  box(g,[.52,.5,.035],black,[0,.76,.18],null,.1,'Fingerprint scanner surround');
  box(g,[.34,.34,.025],glass,[0,.76,.21],null,.08,'Illuminated fingerprint platen');
  for(let ridge=0;ridge<5;ridge++) ring(g,.055+ridge*.025,.008,cyan,[0,.76,.228],[Math.PI/2,0,0],24);
  for(let key=0;key<6;key++) cylinder(g,.045,.025,silver,[-.16+(key%3)*.16,.34-Math.floor(key/3)*.14,.17],[Math.PI/2,0,0],16,'Keypad key');
  cylinder(g,.025,.018,cyan,[.31,1.5,.17],[Math.PI/2,0,0],12,'Status LED');
  return g;
}

function buildProfessionalMicrophone() {
  const g = new THREE.Group(); g.name = 'Premium professional handheld microphone';
  cylinder(g, .16, 1.2, graphite, [0, .72, 0], null, 36, 'Microphone handle');
  cylinder(g, .2, .18, aluminium, [0, 1.35, 0], null, 36, 'Head collar');
  cylinder(g, .29, .48, black, [0, 1.65, 0], null, 48, 'Metal grille');
  for (let band = 0; band < 5; band += 1) ring(g, .245 - band * .012, .012, silver, [0, 1.48 + band * .085, 0], [Math.PI / 2, 0, 0], 36);
  box(g, [.13, .22, .025], screen, [0, .84, .165], null, .025, 'Status screen');
  cylinder(g, .055, .025, cyan, [0, .62, .165], [Math.PI / 2, 0, 0], 18, 'Mute key');
  cylinder(g, .105, .08, silver, [0, .08, 0], null, 28, 'XLR connector');
  for (let pin = 0; pin < 3; pin += 1) cylinder(g, .012, .035, gold, [-.035 + pin * .035, .025, 0], null, 10);
  return g;
}

function buildProjectorScreen() {
  const g = new THREE.Group(); g.name = 'Premium tripod projection screen';
  box(g, [2.35, 1.35, .055], mat(0xf2f4f2, .8), [0, 1.25, 0], null, .025, 'Projection fabric');
  box(g, [2.55, .12, .14], graphite, [0, 1.96, 0], null, .04, 'Screen cassette');
  box(g, [2.48, .08, .1], graphite, [0, .55, 0], null, .025, 'Weighted screen bar');
  cylinder(g, .055, 1.55, aluminium, [0, .57, -.08], null, 20, 'Height-adjustable mast');
  cylinder(g, .08, .16, graphite, [0, .36, -.08], null, 20, 'Tripod collar');
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) rod(g, [0, .35, -.08], [Math.cos(angle) * .72, .04, -.08 + Math.sin(angle) * .72], .035, graphite);
  return g;
}

function buildPtzCamera() {
  const g = new THREE.Group(); g.name = 'Premium motorized PTZ conference camera';
  cylinder(g, .58, .18, graphite, [0, .13, 0], null, 40, 'PTZ base');
  cylinder(g, .46, .34, aluminium, [0, .34, 0], null, 40, 'Pan motor');
  const head = new THREE.Group(); head.position.set(0, .72, 0); head.rotation.y = -.28;
  box(head, [1.05, .7, .72], graphite, [0, 0, 0], null, .2, 'Camera head');
  cylinder(head, .3, .26, black, [0, .02, .43], [Math.PI / 2, 0, 0], 40, 'Lens barrel');
  cylinder(head, .21, .28, glass, [0, .02, .51], [Math.PI / 2, 0, 0], 40, 'Optical zoom lens');
  cylinder(head, .09, .292, screen, [0, .02, .535], [Math.PI / 2, 0, 0], 32, 'Lens element');
  for (const x of [-.38, .38]) cylinder(head, .035, .2, cyan, [x, -.18, .39], [Math.PI / 2, 0, 0], 16, 'Camera status');
  g.add(head);
  for (const x of [-.57, .57]) box(g, [.14, .6, .5], aluminium, [x, .64, 0], null, .08, 'Tilt yoke');
  return g;
}

function buildRackServer() {
  const g = new THREE.Group(); g.name = 'Premium 2U rack server';
  box(g, [2.2, .55, 1.45], graphite, [0, .39, 0], null, .055, '2U server chassis');
  box(g, [2.08, .46, .04], black, [0, .39, .75], null, .035, 'Server front panel');
  for (let bay = 0; bay < 8; bay += 1) {
    const x = -.75 + bay * .215;
    box(g, [.18, .28, .055], aluminium, [x, .36, .78], null, .02, `Hot-swap bay ${bay + 1}`);
    box(g, [.12, .035, .012], black, [x, .28, .815], null, .006);
    cylinder(g, .014, .012, bay < 6 ? cyan : silver, [x, .45, .815], [Math.PI / 2, 0, 0], 10);
  }
  box(g, [.28, .23, .055], screen, [.78, .4, .78], null, .035, 'Server status display');
  cylinder(g, .045, .04, cyan, [1, .48, .78], [Math.PI / 2, 0, 0], 18, 'Power key');
  for (const x of [-1.18, 1.18]) box(g, [.16, .68, .26], aluminium, [x, .39, .59], null, .025, 'Rack ear');
  for (let vent = 0; vent < 12; vent += 1) box(g, [.075, .018, .48], black, [-.75 + vent * .135, .675, -.25], null, .008, 'Cooling vent');
  return g;
}

function buildReceiptPrinter() {
  const g = new THREE.Group(); g.name = 'Premium thermal receipt printer';
  box(g, [1.25, .82, 1.08], graphite, [0, .47, 0], null, .16, 'Thermal printer enclosure');
  box(g, [1.1, .13, .76], aluminium, [0, .91, -.08], [-.08, 0, 0], .07, 'Hinged paper lid');
  box(g, [.88, .045, .12], black, [0, .99, .28], null, .018, 'Receipt exit');
  box(g, [.62, .018, .62], mat(0xf2f1e8, .9), [0, 1.18, .25], [-.22, 0, 0], .012, 'Printed receipt');
  for (let line = 0; line < 7; line += 1) box(g, [.42 - (line % 3) * .07, .007, .018], graphite, [0, 1.2 + line * .045, .31 + line * .01], [-.22, 0, 0], .003);
  cylinder(g, .045, .03, cyan, [.42, .84, .48], [Math.PI / 2, 0, 0], 16, 'Status light');
  cylinder(g, .07, .03, silver, [.25, .84, .48], [Math.PI / 2, 0, 0], 18, 'Feed button');
  return g;
}

function buildRefrigerator() {
  const g = new THREE.Group(); g.name = 'Premium office refrigerator';
  box(g, [1.38, 2.2, 1.18], mat(0xc5cbd0, .24, .7), [0, 1.13, 0], null, .09, 'Brushed steel refrigerator');
  box(g, [1.27, .72, .045], silver, [0, 1.83, .61], null, .045, 'Freezer door');
  box(g, [1.27, 1.26, .045], silver, [0, .74, .61], null, .045, 'Refrigerator door');
  box(g, [.065, .48, .08], graphite, [.48, 1.74, .68], null, .025, 'Freezer handle');
  box(g, [.065, .63, .08], graphite, [.48, 1.04, .68], null, .025, 'Refrigerator handle');
  box(g, [.34, .28, .025], screen, [-.35, 1.82, .65], null, .04, 'Temperature display');
  for (const x of [-.5, .5]) box(g, [.24, .08, .34], rubber, [x, .04, .18], null, .025, 'Leveling foot');
  return g;
}

function buildReplacementKeyboard() {
  const g = new THREE.Group(); g.name = 'Premium replacement laptop keyboard';
  box(g, [2.15, .09, .86], graphite, [0, .12, 0], null, .045, 'Keyboard backplate');
  for (let row = 0; row < 5; row += 1) for (let col = 0; col < 14; col += 1) {
    if (row === 4 && col > 3 && col < 10) continue;
    box(g, [.115, .045, .105], black, [-.84 + col * .13, .19, -.28 + row * .14], null, .016, 'Chiclet key');
  }
  box(g, [.66, .045, .105], black, [0, .19, .28], null, .018, 'Space bar');
  box(g, [.28, .025, .32], copper, [0, .055, -.58], null, .025, 'Keyboard ribbon cable');
  for (let trace = 0; trace < 5; trace += 1) box(g, [.02, .008, .25], gold, [-.08 + trace * .04, .071, -.6], null, .003);
  return g;
}

function buildRoomPanel() {
  const g = new THREE.Group(); g.name = 'Premium room scheduling touch panel';
  box(g, [1.85, 1.08, .13], graphite, [0, .65, 0], null, .07, 'Scheduling panel chassis');
  box(g, [1.68, .91, .025], screen, [0, .65, .08], null, .035, 'Touchscreen');
  box(g, [.48, .66, .012], navy, [-.53, .65, .098], null, .025, 'Room status rail');
  box(g, [.76, .16, .012], cyan, [.3, .87, .099], null, .018, 'Available status');
  for (let row = 0; row < 3; row += 1) box(g, [.72, .075, .01], row === 0 ? silver : blue, [.28, .64 - row * .17, .1], null, .012, 'Booking detail');
  cylinder(g, .025, .018, cyan, [.79, .2, .08], [Math.PI / 2, 0, 0], 14, 'Presence sensor');
  box(g, [.42, .52, .16], aluminium, [0, .56, -.13], null, .04, 'Wall mount');
  return g;
}

function buildSdCard() {
  const g = new THREE.Group(); g.name = 'Premium SDXC memory card';
  const card = new THREE.Shape();
  card.moveTo(-.65, -.82); card.lineTo(.65, -.82); card.lineTo(.65, .82); card.lineTo(.25, .82); card.lineTo(.08, .64); card.lineTo(-.65, .64); card.closePath();
  const body = add(g, new THREE.ExtrudeGeometry(card, { depth: .12, bevelEnabled: true, bevelSize: .025, bevelThickness: .018, bevelSegments: 2 }), black, [0, .85, 0], [Math.PI / 2, 0, 0], 'SD card shell');
  body.scale.set(.9, .9, .9);
  box(g, [.9, .018, .68], navy, [0, .93, .05], null, .035, 'SDXC label');
  box(g, [.5, .02, .16], mat(0xf2f3f5, .75), [0, .945, -.12], null, .018, 'Capacity label');
  for (let pin = 0; pin < 9; pin += 1) box(g, [.065, .025, .34], gold, [-.39 + pin * .098, .95, .42], null, .008, 'Gold contact');
  box(g, [.06, .1, .24], graphite, [-.61, .88, .1], null, .012, 'Write-protect switch');
  return g;
}

function buildPortableMonitor() {
  const g = new THREE.Group(); g.name = 'Premium portable USB-C monitor';
  box(g, [2.04, 1.2, .075], graphite, [0, .87, 0], null, .055, 'Portable monitor chassis');
  box(g, [1.9, 1.06, .018], screen, [0, .89, .05], null, .028, 'Portable display');
  box(g, [.42, .66, .009], navy, [-.62, .89, .064], null, .022, 'Display UI sidebar');
  for (let tile = 0; tile < 4; tile += 1) box(g, [.34, .22, .008], tile % 2 ? blue : mat(0x2e617d, .25), [.02 + (tile % 2) * .45, 1.14 - Math.floor(tile / 2) * .32, .065], null, .02, 'Display UI tile');
  const cover = new THREE.Group(); cover.position.set(0, .28, -.16); cover.rotation.x = -.38;
  box(cover, [1.86, .06, .82], mat(0x27343d, .75, .08), [0, 0, 0], null, .035, 'Folding magnetic cover stand');
  box(cover, [1.7, .018, .66], rubber, [0, .04, 0], null, .025);
  g.add(cover);
  for (const y of [.58, .72]) box(g, [.025, .08, .16], y < .65 ? cyan : silver, [1.035, y, 0], null, .008, 'USB-C port');
  cylinder(g, .022, .018, cyan, [.76, .31, .05], [Math.PI / 2, 0, 0], 14, 'Power indicator');
  return g;
}

function buildPowerBank() {
  const g = new THREE.Group(); g.name = 'Premium high-capacity USB-C power bank';
  box(g, [1.36, .34, .82], graphite, [0, .3, 0], null, .14, 'Power bank enclosure');
  box(g, [1.18, .035, .66], aluminium, [0, .49, 0], null, .1, 'Anodized top surface');
  box(g, [.42, .17, .025], screen, [-.29, .3, .43], null, .035, 'Charge display');
  for (let bar = 0; bar < 4; bar += 1) box(g, [.055, .08, .01], bar < 3 ? cyan : silver, [-.4 + bar * .08, .3, .447], null, .008, 'Charge bar');
  for (const [x, width, material] of [[.08, .15, silver], [.31, .13, cyan], [.5, .12, silver]]) box(g, [width, .07, .025], material, [x, .3, .43], null, .012, 'Charging port');
  cylinder(g, .045, .025, graphite, [.61, .37, .2], null, 18, 'Power key');
  ring(g, .18, .025, graphite, [-.7, .31, -.24], [Math.PI / 2, 0, 0], 28, 'Carry loop');
  for (let groove = 0; groove < 7; groove += 1) box(g, [.035, .025, .5], black, [-.42 + groove * .14, .505, 0], null, .007, 'Surface groove');
  return g;
}

function buildPdu() {
  const g = new THREE.Group(); g.name = 'Premium rack power distribution unit';
  box(g, [2.2, .38, .42], graphite, [0, .31, 0], null, .055, 'Rack PDU enclosure');
  box(g, [1.94, .25, .035], black, [0, .31, .23], null, .04, 'PDU front panel');
  for (let outlet = 0; outlet < 8; outlet += 1) {
    const x = -.72 + outlet * .205;
    box(g, [.15, .16, .04], graphite, [x, .31, .255], null, .025, `Outlet ${outlet + 1}`);
    for (const pinX of [-.035, .035]) box(g, [.022, .065, .018], silver, [x + pinX, .33, .283], null, .004);
    cylinder(g, .014, .012, outlet < 7 ? mat(0x4fd494, .2, .05, { emissive: 0x176f4c, emissiveIntensity: .8 }) : cyan, [x, .2, .282], [Math.PI / 2, 0, 0], 12, 'Outlet status');
  }
  box(g, [.28, .18, .025], screen, [.82, .31, .255], null, .035, 'Load meter');
  box(g, [.16, .025, .008], cyan, [.82, .31, .273], null, .005);
  for (const x of [-1.17, 1.17]) box(g, [.16, .46, .48], aluminium, [x, .31, 0], null, .025, 'Rack ear');
  rod(g, [-1.04, .31, -.1], [-1.38, .31, -.42], .04, rubber);
  box(g, [.28, .18, .22], graphite, [-1.55, .31, -.44], null, .05, 'Power lead plug');
  return g;
}

function buildInverter() {
  const g = new THREE.Group(); g.name = 'Premium pure-sine power inverter';
  box(g, [1.72, .68, 1.08], graphite, [0, .43, 0], null, .11, 'Inverter chassis');
  for (let fin = 0; fin < 11; fin += 1) box(g, [.06, .18, .92], aluminium, [-.66 + fin * .132, .81, 0], null, .012, 'Cooling fin');
  box(g, [1.48, .48, .04], black, [0, .43, .56], null, .07, 'Inverter control face');
  box(g, [.52, .23, .018], screen, [-.38, .52, .585], null, .04, 'Power display');
  for (let line = 0; line < 3; line += 1) box(g, [.31 - line * .05, .025, .008], cyan, [-.38, .57 - line * .07, .598], null, .005);
  for (const x of [.12, .37]) cylinder(g, .095, .04, silver, [x, .43, .585], [Math.PI / 2, 0, 0], 24, 'AC outlet');
  cylinder(g, .06, .04, cyan, [.63, .54, .585], [Math.PI / 2, 0, 0], 20, 'Power button');
  box(g, [1.35, .42, .04], black, [0, .43, -.56], null, .065, 'DC terminal panel');
  for (const [x, color] of [[-.38, 0xc84740], [.38, 0x171c20]]) {
    cylinder(g, .1, .14, mat(color, .4, .2), [x, .47, -.62], [Math.PI / 2, 0, 0], 24, 'Battery terminal');
    cylinder(g, .045, .16, copper, [x, .47, -.66], [Math.PI / 2, 0, 0], 18);
  }
  for (const x of [-.75, .75]) box(g, [.32, .08, .3], aluminium, [x, .065, 0], null, .025, 'Mounting flange');
  return g;
}

const generatedPath = 'public/generated/models';
const officePath = 'public/uploads/University-IT-Office-Equipment-GLB-Expansion/models';
const corePath = 'public/uploads/University-IT-Inventory-3D-Model-Pack/models';
const definitions = [
  ['chromebook', generatedPath, buildChromebook],
  ['cooling-fan', generatedPath, buildCoolingFan],
  ['motherboard', generatedPath, buildMotherboard],
  ['conference-bar', generatedPath, buildConferenceBar],
  ['conference-speakerphone', generatedPath, buildSpeakerphone],
  ['desktop-speakers', officePath, buildDesktopSpeakers],
  ['desktop-tower', officePath, buildDesktopTower],
  ['camcorder', generatedPath, buildCamcorder],
  ['desktop-processor', generatedPath, buildProcessor],
  ['barcode-scanner', officePath, buildBarcodeScanner],
  ['hardware-security-key', generatedPath, buildSecurityKey],
  ['hdmi-cable', corePath, buildHdmiCable],
  ['interactive-panel', generatedPath, buildInteractivePanel],
  ['kvm-switch', generatedPath, buildKvmSwitch],
  ['label-applicator', generatedPath, buildLabelApplicator],
  ['office-phone', corePath, buildOfficePhone],
  ['laptop-bag', generatedPath, buildLaptopBag],
  ['laptop-battery', generatedPath, buildLaptopBattery],
  ['digital-multimeter', generatedPath, buildMultimeter],
  ['projector', officePath, buildProjector],
  ['digital-signage-player', generatedPath, buildSignagePlayer],
  ['displayport-cable', generatedPath, buildDisplayPortCable],
  ['document-camera', officePath, buildDocumentCamera],
  ['drive-docking-station', generatedPath, buildDriveDock],
  ['electronics-cleaning-kit', generatedPath, buildCleaningKit],
  ['security-cable-lock', generatedPath, buildCableLock],
  ['ethernet-crimping-tool', generatedPath, buildCrimpingTool],
  ['external-hard-drive', corePath, buildExternalDrive],
  ['laptop-charger', corePath, buildLaptopCharger],
  ['docking-station', officePath, buildLaptopDock],
  ['laptop-stand', generatedPath, buildLaptopStand],
  ['large-format-plotter', generatedPath, buildPlotter],
  ['memory-card-reader', generatedPath, buildCardReader],
  ['memory-module', generatedPath, buildMemoryModule],
  ['microphone-stand', corePath, buildMicrophoneStand],
  ['microwave-oven', generatedPath, buildMicrowave],
  ['mini-pc', generatedPath, buildMiniPc],
  ['monitor-arm', generatedPath, buildMonitorArm],
  ['nas-device', generatedPath, buildNas],
  ['network-cable-tester', generatedPath, buildCableTester],
  ['patch-panel', generatedPath, buildPatchPanel],
  ['network-rack', generatedPath, buildNetworkRack],
  ['network-video-recorder', generatedPath, buildNvr],
  ['office-appliance', generatedPath, buildOfficeAppliance],
  ['office-furniture', generatedPath, buildOfficeCabinet],
  ['laminator', generatedPath, buildLaminator],
  ['monitor', officePath, buildMonitor],
  ['other-equipment', generatedPath, buildOtherEquipment],
  ['headphones', generatedPath, buildHeadphones],
  ['pa-speaker', generatedPath, buildPaSpeaker],
  ['paper-shredder', generatedPath, buildShredder],
  ['poe-injector', generatedPath, buildPoeInjector],
  ['portable-generator', generatedPath, buildGenerator],
  ['portable-monitor', generatedPath, buildPortableMonitor],
  ['power-bank', generatedPath, buildPowerBank],
  ['power-distribution-unit', generatedPath, buildPdu],
  ['power-inverter', generatedPath, buildInverter],
  ['presentation-clicker', corePath, buildPresentationClicker],
  ['professional-microphone', corePath, buildProfessionalMicrophone],
  ['projector-screen', corePath, buildProjectorScreen],
  ['ptz-camera', generatedPath, buildPtzCamera],
  ['rack-server', generatedPath, buildRackServer],
  ['receipt-printer', generatedPath, buildReceiptPrinter],
  ['refrigerator', generatedPath, buildRefrigerator],
  ['replacement-laptop-keyboard', generatedPath, buildReplacementKeyboard],
  ['room-scheduling-panel', generatedPath, buildRoomPanel],
  ['sd-memory-card', generatedPath, buildSdCard],
  ['network-switch', officePath, buildNetworkSwitch],
  ['3d-printer', generatedPath, build3dPrinter],
  ['ac-power-adapter', generatedPath, buildAcAdapter],
  ['access-control-panel', generatedPath, buildAccessPanel],
  ['air-conditioner', generatedPath, buildAirConditioner],
  ['all-in-one-desktop', officePath, buildAllInOne],
  ['audio-mixer', corePath, buildAudioMixer],
  ['label-printer', generatedPath, buildLabelPrinter],
  ['binding-machine', generatedPath, buildBindingMachine],
  ['biometric-reader', generatedPath, buildBiometricReader],
  ['thin-client', generatedPath, buildThinClient],
  ['ups', corePath, buildUps],
  ['ups-replacement-battery', generatedPath, buildUpsBattery],
  ['usb-ethernet-adapter', generatedPath, buildUsbEthernet],
  ['usb-flash-drive', generatedPath, buildFlashDrive],
  ['usb-hub', generatedPath, buildUsbHub],
  ['usb-headset', officePath, buildOfficeHeadset],
  ['webcam', officePath, buildWebcam],
  ['usb-c-cable', corePath, buildUsbCCable],
  ['display-adapter', corePath, buildDisplayAdapter],
  ['vga-cable', generatedPath, buildVgaCable],
  ['video-capture-card', generatedPath, buildCaptureCard],
  ['video-encoder', generatedPath, buildVideoEncoder],
  ['water-dispenser', generatedPath, buildWaterDispenser],
  ['wifi-router', officePath, buildWifiRouter],
  ['wired-mouse', officePath, () => buildMouse(false)],
  ['wireless-access-point', officePath, buildWirelessAccessPoint],
  ['wireless-microphone-kit', generatedPath, buildWirelessMicKit],
  ['wireless-mouse', officePath, () => buildMouse(true)],
  ['xlr-cable', corePath, buildXlrCable],
  ['sfp-module', generatedPath, buildSfpModule],
  ['smart-board', generatedPath, buildSmartBoard],
  ['smart-television', generatedPath, buildSmartTv],
  ['solid-state-drive', generatedPath, buildSsd],
  ['standing-fan', generatedPath, buildStandingFan],
  ['surge-protector', corePath, buildSurgeProtector],
  ['tablet', generatedPath, buildPremiumTablet],
  ['tape-drive', generatedPath, buildTapeDrive],
  ['technician-toolkit', generatedPath, buildPremiumToolkit],
  ['teleprompter', generatedPath, buildTeleprompter],
  ['fiber-optic-patch-cable', generatedPath, buildFiberPatchCable],
  ['firewall-appliance', generatedPath, buildFirewall],
  ['flatbed-scanner', officePath, buildFlatbedScanner],
  ['keyboard', officePath, buildFullKeyboard],
  ['graphics-workstation', generatedPath, buildGraphicsWorkstation]
];
const requested = new Set(process.argv.slice(2));
const exporter = new GLTFExporter();
let count = 0;
for (const [id, outputDirectory, build] of definitions) {
  if (requested.size && !requested.has(id)) continue;
  const scene = new THREE.Scene();
  scene.name = `${id} premium presentation asset`;
  scene.add(build());
  scene.updateMatrixWorld(true);
  const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: true, truncateDrawRange: true });
  await fs.mkdir(outputDirectory, { recursive: true });
  const output = `${outputDirectory}/${id}.glb`;
  await fs.writeFile(output, Buffer.from(result));
  console.log(`Generated ${output} (${Buffer.byteLength(result).toLocaleString()} bytes)`);
  count += 1;
}
console.log(`Generated ${count} premium equipment models.`);
