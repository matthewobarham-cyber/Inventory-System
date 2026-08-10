import { MODELS } from './data.js';

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(field.trim()); field = ''; }
    else if (character === '\n') {
      row.push(field.trim());
      while (row.length && !row[row.length - 1]) row.pop();
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
    } else if (character !== '\r') field += character;
  }
  row.push(field.trim());
  while (row.length && !row[row.length - 1]) row.pop();
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

const clean = (value) => String(value || '').replace(/^\uFEFF/, '').trim();
const keyOf = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
const numberOf = (value) => {
  const parsed = Number(clean(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

function dateOf(value) {
  const source = clean(value);
  if (!source) return '';
  const numeric = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/.exec(source);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return source;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

export function classifyEquipment(description) {
  const source = clean(description).toLowerCase();
  const aliases = [
    [/fuser(?: assembly| kit| unit)?/, 'printer-fuser-unit'],
    [/(?:printer )?drum(?: cartridge| kit| unit)?|photoconductor/, 'printer-drum-unit'],
    [/imaging(?: assembly| kit| unit)/, 'printer-imaging-unit'],
    [/transfer belt|image transfer belt/, 'printer-transfer-belt'],
    [/staple kit|staple finisher/, 'printer-staple-kit'],
    [/laptop bag|carrying bag|notebook bag/, 'laptop-bag'], [/kensington|security cable lock|defcon.*lock|noble lock/, 'security-cable-lock'],
    [/air.?condition|\ba\/?c\b|\bac unit|mini split|btu.*(?:wall|split)|condenser/, 'air-conditioner'], [/standing fan|ceiling fan/, 'standing-fan'],
    [/refrigerator|fridge/, 'refrigerator'], [/microwave/, 'microwave-oven'], [/water.*(?:cooler|dispenser)|hot.*cold.*dispenser|oasis hot.*cold/, 'water-dispenser'],
    [/kettle|coffee percolator|hand dryer|gas blower|water pump/, 'office-appliance'], [/cabinet|hamper|furniture/, 'office-furniture'], [/drone|autel robotics/, 'drone'],
    [/ssd|solid.?state|kingston nv2|sata iii/, 'solid-state-drive'], [/flash.?drive|thumb.?drive|sandisk ultra shift|sandisk.*\d+gb/, 'usb-flash-drive'],
    [/external.*(?:hard )?drive|seagate.*(?:4tb|expansion)|portable.*hard drive/, 'external-hard-drive'],
    [/battery backup/, 'ups'], [/aa batteries|aaa batteries|energizer max/, 'aa-battery-pack'],
    [/laptop charger|usb.?c laptop charge|65 ?w.*charger/, 'laptop-charger'], [/surge|extension (?:cord|chord)/, 'surge-protector'],
    [/projector.*(?:screen|cage)|electric screen/, 'projector-screen'], [/projector|infocus/, 'projector'],
    [/barcode scanner|barcode reader|inateck barcode/, 'barcode-scanner'], [/printer.*label|label.*printer/, 'label-printer'],
    [/toner|\b(?:49a|64a|125a)\b/, 'printer-toner'], [/laserjet|laser jet|bizhub|copier|printer/, 'multifunction-printer'], [/scanner/, 'flatbed-scanner'],
    [/brio|c920|webcam/, 'webcam'], [/wireless microphone|share wireless microphone/, 'wireless-microphone-kit'], [/microphone/, 'professional-microphone'],
    [/headset/, 'usb-headset'], [/headphone/, 'headphones'], [/speaker/, 'desktop-speakers'],
    [/display.?port.*(?:dvi|adapter)|vga.*hdmi|usb.?c.*adapter|multifunction adapter|dell.?da310/, 'display-adapter'],
    [/hdmi/, 'hdmi-cable'], [/displayport/, 'displayport-cable'], [/vga/, 'vga-cable'], [/usb.?c hub/, 'usb-hub'],
    [/usb.?to ethernet|usb.*ethernet/, 'usb-ethernet-adapter'], [/usb.?a.*usb.?b|usb.?a.*usb.?a|usb extender/, 'usb-c-cable'],
    [/ethernet|cat5|cat6/, 'blue-ethernet-cable'],
    [/thunderbolt.*dock|performance dock|\bdock(?:ing)?\b|wd22tb|wd19|usb.*enclosure/, 'docking-station'],
    [/monitor|dell[- ]*e24|dell[- ]*p2[47]|hp p24|1704fpt|1708fp|p2212|p2214|p2317|l1900/, 'monitor'],
    [/chromebook/, 'chromebook'], [/galaxy tab|tablet|ipad|kindle/, 'tablet'],
    [/latitude|lattitude|macbook|notebook|precision (?:m4700|7550|7560)|dell p(?:06g|19f)|\bg1k\b|\blaptop\b/, 'laptop'],
    [/optiplex.*(?:micro|mff)|mini pc|\bnuc\b/, 'mini-pc'], [/optiplex|desktop|desk top computer|workstation/, 'desktop-tower'],
    [/server/, 'rack-server'], [/telephone|nortel|handset|cell phone|smart ?phone|samsung galaxy (?:a0|a24|aos)|nokia.*phone/, 'office-phone'],
    [/network switch|catalyst|c2960/, 'network-switch'], [/gateway|network installation/, 'network-switch'], [/router/, 'wifi-router'], [/access point/, 'wireless-access-point'],
    [/ups|uninterrupt|powerware|liebert gxt/, 'ups'], [/presenter|presentation remote|r400|kpp-003|kps-010|\bclicker\b/, 'presentation-clicker'],
    [/camera lens|lumix|camera/, 'camcorder'], [/tripod/, 'camera-tripod'], [/mouse|xtech xtm/, 'wireless-mouse'], [/keyboard/, 'keyboard']
    ,[/hx-m101|srd0nf1/, 'external-hard-drive'], [/xscroll|m-uvdel/, 'wireless-mouse'], [/dell l30u|sk-8115/, 'keyboard']
    ,[/wireless adapter/, 'wireless-access-point'], [/door release|rf transmitter/, 'access-control-panel']
    ,[/precision tool set/, 'technician-toolkit'], [/dymo label refill/, 'barcode-label-roll'], [/commercial shredder/, 'paper-shredder']
    ,[/voltage protector|zion-2k30/, 'surge-protector'], [/versa mount|mount bracket/, 'monitor-arm'], [/case(?:s)?(?:\s+-|$)|hard case/, 'laptop-bag']
    ,[/\badapter\b/, 'display-adapter'], [/\bcable\b/, 'usb-c-cable'], [/\btool\b|stapler/, 'technician-toolkit']
  ];
  const alias = aliases.find(([pattern]) => pattern.test(source));
  if (alias && MODELS.some((model) => model.id === alias[1])) return MODELS.find((model) => model.id === alias[1]);
  const tokens = new Set(source.split(/[^a-z0-9]+/).filter((token) => token.length > 2));
  let winner = MODELS[0];
  let winningScore = 0;
  MODELS.forEach((model) => {
    const score = model.name.toLowerCase().split(/[^a-z0-9]+/).reduce((total, token) => total + (tokens.has(token) ? 1 : 0), 0);
    if (score > winningScore) { winningScore = score; winner = model; }
  });
  return winningScore >= 2 ? winner : MODELS.find((model) => model.id === 'other-equipment') || MODELS[0];
}

function locationOf(raw) {
  const source = clean(raw);
  const lower = source.toLowerCase();
  const buildings = [
    ['building a', 'Building A'], ['building b', 'Building B'], ['building c', 'Building D'], ['building d', 'Building D'],
    ['doc center', 'Doc Center'], ['document centre', 'Doc Center'], ['bloomberg', 'Bloomberg'], ['building h', 'Building H'],
    ['building i', 'Building I'], ['south', 'South']
  ];
  const match = buildings.find(([needle]) => lower.includes(needle));
  const storage = /storage|store room|storeroom|stock/.test(lower);
  return {
    location: storage ? 'Storage room' : (match?.[1] || 'Building A'),
    room: source || (storage ? 'Main storage' : 'Imported location'),
    assignedTo: source && !match && !storage ? source : ''
  };
}

function assetRecord(fields, source, rowNumber, copy = 1) {
  const model = classifyEquipment(`${fields.item} ${fields.importedType || ''} ${fields.description || ''} ${fields.modelNumber || ''}`);
  const placement = locationOf(fields.location);
  const sourceTag = clean(fields.tag || fields.assetId);
  const sourceSerial = clean(fields.serial);
  const tag = copy === 1 ? sourceTag : '';
  const serial = copy === 1 ? sourceSerial : '';
  const fingerprint = [source, 'asset', sourceTag, sourceSerial, fields.item, fields.location, fields.purchased, rowNumber, copy].map(keyOf).join(':');
  return {
    kind: 'asset', importKey: fingerprint, sourceFile: source, sourceRow: rowNumber, classificationVersion: 4,
    model: model.id, name: clean(fields.item || fields.description || model.name), category: model.cat,
    consumable: model.cons === 1, rank: model.rank, tag, serial,
    ...placement, qty: 1, min: 0, status: 'In stock', condition: 'Good', cost: numberOf(fields.cost),
    supplier: clean(fields.supplier) || 'Not recorded', purchased: dateOf(fields.purchased), warranty: dateOf(fields.warranty),
    loanCount: 0, borrower: null, due: null, since: null,
    notes: clean(fields.notes), importedType: clean(fields.importedType), originalAssetId: clean(fields.assetId), modelNumber: clean(fields.modelNumber), reference: clean(fields.reference)
  };
}

function procurementRecord(fields, source, rowNumber) {
  const fingerprint = [source, 'procurement', fields.requisition, fields.purchaseOrder, fields.link, fields.description, fields.vendor, rowNumber].map(keyOf).join(':');
  return {
    id: '', importKey: fingerprint, sourceFile: source, sourceRow: rowNumber,
    status: clean(fields.status) || 'Planned', quantity: Math.max(1, Math.round(numberOf(fields.quantity) || 1)),
    description: clean(fields.description), category: clean(fields.category) || 'Uncategorized', vendor: clean(fields.vendor) || 'Not recorded',
    costJmd: numberOf(fields.costJmd), costUsd: numberOf(fields.costUsd), requisition: clean(fields.requisition), requisitionDate: dateOf(fields.requisitionDate),
    purchaseOrder: clean(fields.purchaseOrder), purchaseOrderDate: dateOf(fields.purchaseOrderDate), receivalNumber: clean(fields.receivalNumber),
    invoiceDate: dateOf(fields.invoiceDate), comment: clean(fields.comment), link: clean(fields.link)
  };
}

function objectRows(rows, headerIndex) {
  const headers = rows[headerIndex].map(keyOf);
  return rows.slice(headerIndex + 1).map((row, offset) => ({
    rowNumber: headerIndex + offset + 2,
    values: Object.fromEntries(headers.map((header, index) => [header || `column${index}`, clean(row[index])]))
  }));
}

export function interpretCsv(text, fileName) {
  const rows = parseCsv(text);
  const firstLines = rows.slice(0, 12).flat().map(keyOf);
  const assets = [];
  const procurement = [];
  const warnings = [];
  let type = 'Unknown CSV';

  if (firstLines.includes('entrydate') && firstLines.includes('msbmtags')) {
    type = 'Inventory list';
    objectRows(rows, 0).forEach(({ rowNumber, values }) => {
      if (!values.items) return;
      const quantity = Math.max(1, Math.min(1000, Math.round(numberOf(values.quantity) || 1)));
      for (let copy = 1; copy <= quantity; copy += 1) assets.push(assetRecord({
        item: values.items, importedType: values.telephone, serial: values.serialnumberservicetag, tag: values.msbmtags,
        location: values.location, warranty: values.warrantydate, purchased: values.entrydate, notes: values.notes
      }, fileName, rowNumber, copy));
    });
  } else if (firstLines.includes('quotationdescription') && firstLines.includes('requisitionnumber')) {
    type = 'Procurement tracker';
    objectRows(rows, 0).forEach(({ rowNumber, values }) => {
      if (!values.quotationdescription) return;
      procurement.push(procurementRecord({ status: values.status, quantity: values.quantity, description: values.quotationdescription,
        category: values.categories, vendor: values.vendor, costJmd: values.costjmd, costUsd: values.costusd,
        requisition: values.requisitionnumber, requisitionDate: values.dateenteredrequisition, purchaseOrder: values.purchaseorder,
        purchaseOrderDate: values.datereceivedpurchaseorder, receivalNumber: values.receivalnumber,
        invoiceDate: values.datereceivedinvoice, comment: values.comment }, fileName, rowNumber));
    });
  } else if (firstLines.includes('amazonitems') && firstLines.includes('quantityrequired')) {
    type = 'Amazon procurement list';
    let section = 'Amazon purchase plan';
    rows.slice(2).forEach((row, index) => {
      const description = clean(row[1]);
      const quantity = numberOf(row[0]);
      if (row.length === 1 && row[0]) { section = clean(row[0]); return; }
      if (!description) return;
      procurement.push(procurementRecord({ status: 'Planned', quantity, description, category: section, vendor: 'Amazon', costUsd: row[2], link: row[3] }, fileName, index + 3));
    });
  } else if (firstLines.includes('fixedassetscheduleequipment') || rows.some((row) => row.map(keyOf).includes('assetid') && row.map(keyOf).includes('serial'))) {
    type = 'Fixed asset schedule';
    rows.forEach((row, index) => {
      const assetId = clean(row[1]);
      const item = clean(row[2]);
      if (!assetId || !item || keyOf(assetId) === 'assetid' || /assets bought|equipment/i.test(item)) return;
      if (!/\d/.test(assetId) && !clean(row[5])) return;
      assets.push(assetRecord({ assetId, item, description: row[3], modelNumber: row[4], serial: row[5], supplier: row[6],
        reference: row[7], cost: row[10], purchased: row[11], location: row[12], notes: row[13] }, fileName, index + 1));
    });
  } else {
    warnings.push('The columns do not match a supported MSBM inventory or procurement format.');
  }

  return { fileName, type, rowCount: rows.length, assets, procurement, warnings };
}
