import { GENERATED_MODELS } from './generated-models.js';

// Static catalogue + seed-data helpers for the MSBM IT Inventory console.
// Ported from the Claude Design prototype (project/IT Inventory System.dc.html).

export const PACKS = {
  core: 'uploads/University-IT-Inventory-3D-Model-Pack/',
  office: 'uploads/University-IT-Office-Equipment-GLB-Expansion/',
  generated: 'generated/'
};

// ordered largest -> smallest by real bounding volume (m^3) from each pack's manifest,
// so bulky equipment leads the inventory and peripherals fall to the bottom
export const MODELS = [
  { id: 'projector-screen', name: 'Projector White Screen', cat: 'Classroom AV', cons: 0, cost: 2650, pack: 'core' },
  { id: 'microphone-stand', name: 'Microphone Stand', cat: 'Audio', cons: 0, cost: 380, pack: 'core' },
  { id: 'multifunction-printer', name: 'Multifunction Printer', cat: 'Printing', cons: 0, cost: 12400, pack: 'office' },
  { id: 'laser-printer', name: 'Desktop Laser Printer', cat: 'Printing', cons: 0, cost: 3100, pack: 'office' },
  { id: 'all-in-one-desktop', name: 'All-in-One Desktop', cat: 'Computers', cons: 0, cost: 8400, pack: 'office' },
  { id: 'document-camera', name: 'Document Camera', cat: 'Classroom AV', cons: 0, cost: 3800, pack: 'office' },
  { id: 'monitor', name: 'Office Monitor', cat: 'Displays', cons: 0, cost: 1750, pack: 'office' },
  { id: 'desktop-tower', name: 'Desktop Tower', cat: 'Computers', cons: 0, cost: 6200, pack: 'office' },
  { id: 'laptop', name: 'Laptop', cat: 'Computers', cons: 0, cost: 9800, pack: 'office' },
  { id: 'barcode-scanner', name: 'Handheld Barcode Scanner', cat: 'Inventory tools', cons: 0, cost: 1250, pack: 'office' },
  { id: 'wifi-router', name: 'Wi-Fi Router', cat: 'Networking', cons: 0, cost: 890, pack: 'office' },
  { id: 'flatbed-scanner', name: 'Flatbed Document Scanner', cat: 'Imaging', cons: 0, cost: 1400, pack: 'office' },
  { id: 'desktop-speakers', name: 'Desktop Speakers', cat: 'Audio', cons: 0, cost: 620, pack: 'office' },
  { id: 'projector', name: 'Digital Projector', cat: 'Classroom AV', cons: 0, cost: 7600, pack: 'office' },
  { id: 'ups', name: 'Uninterruptible Power Supply', cat: 'Power', cons: 0, cost: 2100, pack: 'core' },
  { id: 'audio-mixer', name: 'Audio Mixer', cat: 'Audio', cons: 0, cost: 4200, pack: 'core' },
  { id: 'printer-imaging-unit', name: 'Printer Imaging Unit', cat: 'Printer consumables', cons: 1, cost: 1450, pack: 'core' },
  { id: 'laptop-charger', name: 'Laptop Charger', cat: 'Power', cons: 1, cost: 420, pack: 'core' },
  { id: 'wireless-access-point', name: 'Wireless Access Point', cat: 'Networking', cons: 0, cost: 2600, pack: 'office' },
  { id: 'usb-headset', name: 'USB Office Headset', cat: 'Peripherals', cons: 1, cost: 540, pack: 'office' },
  { id: 'office-phone', name: 'Landline Office Phone', cat: 'Communications', cons: 0, cost: 640, pack: 'core' },
  { id: 'wired-mouse', name: 'Wired Optical Mouse', cat: 'Peripherals', cons: 1, cost: 95, pack: 'office' },
  { id: 'network-switch', name: '24-Port Network Switch', cat: 'Networking', cons: 0, cost: 4300, pack: 'office' },
  { id: 'printer-transfer-belt', name: 'Printer Transfer Belt', cat: 'Printer consumables', cons: 1, cost: 1180, pack: 'core' },
  { id: 'printer-toner', name: 'Printer Toner Cartridge', cat: 'Printer consumables', cons: 1, cost: 890, pack: 'core' },
  { id: 'waste-toner', name: 'Waste Toner Container', cat: 'Printer consumables', cons: 1, cost: 310, pack: 'core' },
  { id: 'xlr-cable', name: 'XLR Cable', cat: 'Audio', cons: 1, cost: 130, pack: 'core' },
  { id: 'keyboard', name: 'Full-Size Keyboard', cat: 'Peripherals', cons: 1, cost: 210, pack: 'office' },
  { id: 'blue-ethernet-cable', name: 'Blue Ethernet Cable', cat: 'Networking', cons: 1, cost: 60, pack: 'core' },
  { id: 'webcam', name: 'USB Webcam', cat: 'Communications', cons: 1, cost: 480, pack: 'office' },
  { id: 'hdmi-cable', name: 'HDMI Cable', cat: 'Cables & adapters', cons: 1, cost: 95, pack: 'core' },
  { id: 'surge-protector', name: 'Surge Protector', cat: 'Power', cons: 1, cost: 195, pack: 'core' },
  { id: 'usb-c-cable', name: 'USB-C Cable', cat: 'Cables & adapters', cons: 1, cost: 85, pack: 'core' },
  { id: 'external-hard-drive', name: 'External Hard Drive', cat: 'Storage', cons: 0, cost: 980, pack: 'core' },
  { id: 'docking-station', name: 'Laptop Docking Station', cat: 'Peripherals', cons: 1, cost: 1900, pack: 'office' },
  { id: 'wireless-mouse', name: 'Wireless Mouse', cat: 'Peripherals', cons: 1, cost: 180, pack: 'office' },
  { id: 'professional-microphone', name: 'Professional Microphone', cat: 'Audio', cons: 0, cost: 1750, pack: 'core' },
  { id: 'display-adapter', name: 'USB-C Display Adapter', cat: 'Cables & adapters', cons: 1, cost: 240, pack: 'core' },
  { id: 'presentation-clicker', name: 'Presentation Clicker', cat: 'Classroom AV', cons: 0, cost: 460, pack: 'core' }
];
MODELS.push(...GENERATED_MODELS);
export const SINGLE_USE_CONSUMABLE_IDS = new Set([
  'printer-toner', 'waste-toner', 'printer-imaging-unit', 'printer-transfer-belt',
  'printer-fuser-unit', 'printer-drum-unit', 'barcode-label-roll', 'aa-battery-pack',
  'thermal-paper-roll', 'printer-paper-ream', 'printer-staple-kit'
]);
MODELS.forEach((m, i) => { m.cons = SINGLE_USE_CONSUMABLE_IDS.has(m.id) ? 1 : 0; m.rank = i; });

export const MODEL_BY = {};
MODELS.forEach(m => { MODEL_BY[m.id] = m; });

const MODEL_ASSET_VERSION = { 'usb-headset': 2, 'multifunction-printer': 2, 'laser-printer': 2, 'wired-mouse': 2, 'wireless-mouse': 2 };
const modelAssetVersion = id => MODEL_ASSET_VERSION[id] ? `?v=${MODEL_ASSET_VERSION[id]}` : '';
export const glbUrl = id => PACKS[MODEL_BY[id].pack] + 'models/' + id + '.glb' + modelAssetVersion(id);
export const pngUrl = id => PACKS[MODEL_BY[id].pack] + 'previews/' + id + (MODEL_BY[id].pack === 'generated' ? '.svg?v=2' : '.png' + modelAssetVersion(id));

export const BUILDINGS = ['Building A', 'Building B', 'Building D', 'Doc Center', 'Bloomberg', 'Building H', 'Building I', 'South', 'Storage room'];
export const ROOM_PREFIX = { 'Storage room': 'ST', 'Building A': 'A', 'Building B': 'B', 'Building D': 'D', 'Doc Center': 'DC', 'Bloomberg': 'BB', 'Building H': 'H', 'Building I': 'I', 'South': 'S' };
export const CONDITIONS = ['New', 'Good', 'Fair', 'Needs repair'];
export const SUPPLIERS = ['Illuminat Ltd', 'Massy Technologies', 'Caribbean Office Systems', 'Southern IT Supply', 'Datec Trinidad'];
export const APPROVED_VENDORS = SUPPLIERS.map((name, index) => ({
  id: `vendor-${index + 1}`,
  name,
  vendorNumber: `MSBM-V${String(index + 1).padStart(3, '0')}`,
  email: `orders@${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`,
  phone: '',
  contact: '',
  approved: true,
  notes: 'Starter record — replace the sample contact details with the approved institutional vendor record.'
}));
export const APPROVAL_CONTACTS = [
  { id: 'approver-1', name: 'Anisa Hosein', email: 'a.hosein@uwi.edu', title: 'IT Services Manager', active: true }
];
export const BORROWERS = ['Dr. Jamal Mohammed', 'Prof. Aliyah Sankar', 'Reshma Baksh', 'Kevon Alleyne', 'Dr. Nadia Persad', 'Marlon Griffith', 'Shivani Dass'];

export const ACCOUNTS = [
  { email: 'a.hosein@uwi.edu', name: 'Anisa Hosein', role: 'Admin', tsr: true, lastSeen: 'Just now', campusId: 'MSBM-IT-001', title: 'IT Services Manager', department: 'MSBM IT Services', phone: 'Ext. 8201', office: 'Building A · IT Office', joined: '16 Aug 2021', manager: 'Director, Administration' }
];

export const NAV = {
  Admin: ['dashboard', 'inventory', 'consumables', 'stocktakes', 'maintenance', 'lifecycle', 'disposal', 'loans', 'history', 'requests', 'alerts', 'orders', 'placements', 'scan', 'reports', 'settings'],
  'Student assistant': ['dashboard', 'inventory', 'consumables', 'stocktakes', 'maintenance', 'lifecycle', 'disposal', 'loans', 'history', 'alerts', 'orders', 'placements', 'scan'],
  Auditor: ['dashboard', 'inventory', 'consumables', 'stocktakes', 'maintenance', 'lifecycle', 'disposal', 'history', 'orders', 'placements', 'reports', 'settings'],
  Staff: ['inventory', 'consumables', 'requests', 'history']
};

export const LABELS = {
  dashboard: ['Dashboard', 'Campus-wide position at a glance'],
  inventory: ['Inventory', 'Every asset with a live 3D reference'],
  consumables: ['Consumables', 'Quantity-based supplies, usage history, and stock control'],
  stocktakes: ['Stocktakes', 'Physical verification by building or room'],
  maintenance: ['Maintenance', 'Repair tickets and preventive service schedules'],
  lifecycle: ['Asset lifecycle', 'Depreciation, replacement and disposition approvals'],
  disposal: ['Disposal', 'Controlled decommissioning, approvals, custody and permanent disposal records'],
  loans: ['Loans', 'Equipment currently out and due dates'],
  history: ['Loan history', 'Every check-out and check-in on record'],
  requests: ['Requests', 'Borrow requests awaiting a decision'],
  alerts: ['Low stock', 'Consumables at or below minimum level'],
  orders: ['Pending orders', 'Reorders awaiting delivery and receipt'],
  placements: ['Assignment', 'Received items awaiting inventory setup'],
  scan: ['Scanner console', 'Run barcode-driven lookup, checkout, check-in and stocktake workflows'],
  imports: ['CSV data', 'Interpret, validate, and store company records'],
  reports: ['Reports', 'Value, distribution and turnover'],
  users: ['Users & roles', 'Manage accounts, role permissions, page access, and system activity'],
  settings: ['Settings', 'Data imports, users, permissions, and system activity']
};

// Fixed app defaults (the design prototype exposed these as a "tweak panel" for the
// designer inside Claude Design's authoring tool — not an end-user feature of the app).
export const ROTATION_SPEED = 1;
export const SHOW_WATERMARK = true;
export const CARD_MIN_WIDTH = 228;
export const DEFAULT_VIEW = 'grid';
export const LOAN_TERM_DAYS = 14;

export const STATUS_COLORS = {
  'In stock': ['#e7f4ec', '#155e3f', '#1c7c54'],
  'On loan': ['#e9effa', '#0a3d7c', '#0a3d7c'],
  Maintenance: ['#fdf0e0', '#8a5209', '#b8710f'],
  Retired: ['#f1f2f4', '#5b6672', '#8d99a6'],
  'Low stock': ['#fdeceb', '#a01a12', '#b3261e']
};

export function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function pad(n) { return n < 10 ? '0' + n : '' + n; }
export function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
export function shortDate(s) { if (!s) return 'Not recorded'; const d = new Date(s + 'T00:00:00'); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }
export function longDate(s) { if (!s) return 'Not recorded'; const d = new Date(s + 'T00:00:00'); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
export function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5); }
export function money(n) { return 'JMD$' + Math.round(n).toLocaleString('en-US'); }

// "Today" in the running app is the real current date, unlike the frozen preview date
// used by the design prototype.
export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function statusTagStyle(status) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.Retired;
  return { display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, letterSpacing: '.02em', whiteSpace: 'nowrap', background: c[0], color: c[1] };
}

const ROLE_TAG_COLORS = {
  Admin: ['#e9effa', '#0a3d7c'],
  'Student assistant': ['#eaf3ee', '#155e3f'],
  Auditor: ['#f1f2f4', '#4b5661'],
  Staff: ['#fdf3e4', '#8a5209']
};
export function roleTagStyle(role) {
  const c = ROLE_TAG_COLORS[role] || ROLE_TAG_COLORS.Staff;
  return { display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, whiteSpace: 'nowrap', background: c[0], color: c[1] };
}

export function avatarStyle(size) {
  const s = size || 30;
  return { width: s + 'px', height: s + 'px', flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#0a3d7c', color: '#fff', fontSize: Math.round(s * 0.37) + 'px', fontWeight: 600, letterSpacing: '.02em' };
}

export function initialsOf(name) {
  return name.replace(/^(Dr|Prof)\.\s*/, '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function isLowStock(it) {
  return it.consumable && it.qty <= it.min && it.status !== 'Retired';
}

export function effStatus(it) {
  if (it.status === 'On loan' || it.status === 'Maintenance' || it.status === 'Retired') return it.status;
  if (isLowStock(it)) return 'Low stock';
  return 'In stock';
}

export function thumbStyle(id, size, radius) {
  return {
    width: size + 'px', height: size + 'px', flex: 'none', overflow: 'hidden',
    borderRadius: radius + 'px', border: '1px solid rgba(158,178,198,.55)',
    backgroundColor: '#edf5fb',
    backgroundImage: `url("${pngUrl(id)}"), radial-gradient(circle at 50% 34%,#ffffff 0%,#edf5fb 58%,#d9e7f2 100%)`,
    backgroundPosition: 'center 36%,center', backgroundSize: '118% auto,100% 100%', backgroundRepeat: 'no-repeat',
    backgroundBlendMode: 'multiply,normal', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9),0 2px 5px rgba(26,61,91,.08)'
  };
}

// ---- seed data builders --------------------------------------------------

export function buildItems() {
  const r = rng(20260730);
  const items = [];
  for (let i = 0; i < Math.max(96, MODELS.length); i++) {
    const m = MODELS[i % MODELS.length];
    const consumable = m.cons === 1;
    const building = BUILDINGS[Math.floor(r() * BUILDINGS.length)];
    const qty = consumable ? Math.floor(r() * 34) : 1;
    const min = consumable ? 6 + Math.floor(r() * 5) : 0;
    let status = 'In stock';
    if (!consumable) {
      const roll = r();
      status = roll < 0.26 ? 'On loan' : roll < 0.36 ? 'Maintenance' : roll < 0.4 ? 'Retired' : 'In stock';
    }
    const pd = new Date(2022 + Math.floor(r() * 4), Math.floor(r() * 12), 1 + Math.floor(r() * 27));
    items.push({
      id: 'itm' + i,
      model: m.id, name: m.name, category: m.cat, consumable, rank: m.rank,
      tag: 'UWI-IT-' + (10000 + i * 7 + 3),
      serial: m.id.slice(0, 3).toUpperCase() + '-' + Math.floor(100000 + r() * 899999),
      location: building, room: ROOM_PREFIX[building] + '-' + (100 + Math.floor(r() * 320)),
      qty, min, status,
      condition: CONDITIONS[Math.floor(r() * (consumable ? 2 : 4))],
      cost: Math.round(m.cost * (0.9 + r() * 0.25)),
      supplier: SUPPLIERS[Math.floor(r() * SUPPLIERS.length)],
      purchased: iso(pd),
      warranty: iso(new Date(pd.getFullYear() + 3, pd.getMonth(), pd.getDate())),
      loanCount: Math.floor(r() * 24),
      borrower: null, due: null, since: null
    });
  }
  // seed active loans from the on-loan items, dated relative to today
  const TODAY = today();
  const r2 = rng(77);
  items.filter(it => it.status === 'On loan').forEach(it => {
    const out = new Date(TODAY.getTime() - Math.floor(r2() * 26 + 1) * 864e5);
    it.borrower = BORROWERS[Math.floor(r2() * BORROWERS.length)];
    it.since = iso(out);
    it.due = iso(new Date(out.getTime() + (7 + Math.floor(r2() * 21)) * 864e5));
  });
  return items;
}

export function buildHistory(items) {
  const TODAY = today();
  const loanable = items.filter(i => !i.consumable);
  const r = rng(4242);
  const out = [];
  for (let n = 0; n < 46; n++) {
    const it = loanable[Math.floor(r() * loanable.length)];
    const start = new Date(TODAY.getTime() - Math.floor(48 + r() * 300) * 864e5);
    const term = 5 + Math.floor(r() * 24);
    const due = new Date(start.getTime() + term * 864e5);
    const slip = r();
    let back = new Date(due.getTime() + (slip < 0.62 ? -Math.floor(r() * term * 0.7) : Math.floor(1 + r() * 12)) * 864e5);
    if (back > TODAY) back = new Date(TODAY.getTime());
    if (back < start) back = new Date(start.getTime());
    out.push({
      id: 'h' + n,
      itemId: it.id, model: it.model, name: it.name, tag: it.tag,
      borrower: BORROWERS[Math.floor(r() * BORROWERS.length)],
      issuedBy: r() < 0.55 ? 'Kiran Ramnarine' : 'Anisa Hosein',
      out: iso(start), due: iso(due), back: iso(back),
      room: it.location + ' · ' + it.room,
      condition: r() < 0.86 ? 'Returned complete' : 'Returned with damage'
    });
  }
  return out.sort((a, b) => b.back.localeCompare(a.back));
}

export function buildRequests() {
  return [
    { id: 'rq1', itemName: 'Audio Mixer', model: 'audio-mixer', by: 'Dr. Jamal Mohammed', when: 'Requested 2 h ago', need: 'Convocation rehearsal, Building D', state: 'Pending' },
    { id: 'rq2', itemName: 'Projector White Screen', model: 'projector-screen', by: 'Prof. Aliyah Sankar', when: 'Requested yesterday', need: 'Guest lecture, Bloomberg 210', state: 'Pending' },
    { id: 'rq3', itemName: 'Professional Microphone', model: 'professional-microphone', by: 'Reshma Baksh', when: 'Requested 2 d ago', need: 'Faculty podcast recording', state: 'Pending' },
    { id: 'rq4', itemName: 'Presentation Clicker', model: 'presentation-clicker', by: 'Kevon Alleyne', when: 'Requested 4 d ago', need: 'Semester teaching, South', state: 'Approved' }
  ];
}
