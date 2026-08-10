import { memo, useEffect, useMemo, useState } from 'react';
import { BUILDINGS, glbUrl, isLowStock, money } from '../data.js';
import { IconX } from '../icons.jsx';
import { Inv3D } from '../three-engine.js';

const field = { height: 38, padding: '0 10px', border: '1px solid #d9e1e9', borderRadius: 8, background: '#fff', fontSize: 12.5 };
const COLORS = [
  { key: 'cyan', label: 'Cyan', short: 'C', hex: '#00a7c8', soft: '#e4f8fb' },
  { key: 'magenta', label: 'Magenta', short: 'M', hex: '#d51b6b', soft: '#fdebf3' },
  { key: 'yellow', label: 'Yellow', short: 'Y', hex: '#d5a900', soft: '#fff8d8' },
  { key: 'black', label: 'Black', short: 'K', hex: '#25282b', soft: '#eceeef' }
];

const PRINTER_SUPPLY_PATTERN = /toner|ink|cartridge|imaging unit|transfer belt|fuser|drum unit|staple kit|waste toner/i;

function isPrinterSupply(item) {
  return item.category === 'Printer consumables' || PRINTER_SUPPLY_PATTERN.test(`${item.name || ''} ${item.model || ''}`);
}

function isPrinterDevice(item) {
  if (item.archived || item.status === 'Retired' || item.consumable || isPrinterSupply(item)) return false;
  return item.category === 'Printing' || /printer|copier|plotter/i.test(`${item.name || ''} ${item.model || ''}`);
}

function supplyFamily(item) {
  if (isPrinterSupply(item)) return 'Printer supplies';
  if (/paper|print media/i.test(`${item.name} ${item.model}`)) return 'Paper & media';
  if (/label|roll/i.test(`${item.name} ${item.model}`)) return 'Labels & rolls';
  if (/battery/i.test(`${item.name} ${item.model}`)) return 'Batteries';
  return 'Other supplies';
}

function inkColor(item) {
  const text = `${item.color || ''} ${item.name || ''} ${item.stockCode || ''}`.toLowerCase();
  if (/cyan|\bc\b/.test(text)) return 'cyan';
  if (/magenta|\bm\b/.test(text)) return 'magenta';
  if (/yellow|\by\b/.test(text)) return 'yellow';
  if (/black|\bbk\b|\bk\b/.test(text)) return 'black';
  return item.model === 'printer-toner' ? 'black' : null;
}

function isInk(item) {
  return Boolean(inkColor(item)) || /ink|toner cartridge/i.test(`${item.name} ${item.model}`);
}

function compatibleItems(printer, supplies) {
  return supplies.filter((item) => Array.isArray(item.compatiblePrinterIds) && item.compatiblePrinterIds.includes(printer.id));
}

function ModelStage({ url, label, className = '' }) {
  return <div className={`consumable-model-stage ${className}`} aria-label={label}>
    <span className="dashboard-model-loader" aria-hidden="true" />
    <canvas data-model={url} />
  </div>;
}

function StockState({ item }) {
  if (!item) return <span className="consumable-stock-state missing">Not linked</span>;
  const quantity = Number(item.qty || 0);
  if (quantity === 0) return <span className="consumable-stock-state empty">Depleted</span>;
  if (isLowStock(item)) return <span className="consumable-stock-state low">Low stock</span>;
  return <span className="consumable-stock-state healthy">Available</span>;
}

function Consumables({ items, usage, query, canManage, scannerAction, onScannerActionHandled, onUse, onAddStock, onCreateTonerMovement, onBulkUse, onSetCompatibility, onCreateInk, onReorder, onOpenItem }) {
  const [family, setFamily] = useState('All supplies');
  const [building, setBuilding] = useState('Building A');
  const [using, setUsing] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [slotSetup, setSlotSetup] = useState(null);
  const [scannerHighlight, setScannerHighlight] = useState(null);
  const [mappedIds, setMappedIds] = useState([]);
  const [useForm, setUseForm] = useState({ qty: 1, issuedTo: '', department: '', purpose: '', notes: '' });
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkQuantities, setBulkQuantities] = useState({});
  const [bulkForm, setBulkForm] = useState({ issuedTo: '', department: '', purpose: '', notes: '' });
  const [tonerAction, setTonerAction] = useState(null);
  const [tonerMode, setTonerMode] = useState('take');
  const [tonerRecordId, setTonerRecordId] = useState('');
  const [tonerForm, setTonerForm] = useState({ qty: 1, issuedTo: '', department: '', purpose: '', notes: '', batchNumber: '', stockCode: '', storageLocation: '', storageRoom: '' });
  const [error, setError] = useState('');

  const allConsumables = useMemo(() => items.filter((item) => item.consumable && !item.archived && item.status !== 'Retired'), [items]);
  const allPrinters = useMemo(() => items.filter(isPrinterDevice).sort((a, b) => a.name.localeCompare(b.name) || a.tag.localeCompare(b.tag)), [items]);
  const availableBuildings = useMemo(() => {
    const present = new Set([...allConsumables, ...allPrinters].map((item) => item.location || 'Unassigned'));
    const ordered = BUILDINGS.filter((name) => present.has(name));
    const extras = [...present].filter((name) => !BUILDINGS.includes(name)).sort();
    return Array.from(new Set(['Building A', ...ordered, ...extras]));
  }, [allConsumables, allPrinters]);
  const consumables = useMemo(() => allConsumables.filter((item) => (item.location || 'Unassigned') === building), [allConsumables, building]);
  const printers = useMemo(() => allPrinters.filter((item) => (item.location || 'Unassigned') === building), [allPrinters, building]);
  const visibleUsage = useMemo(() => { const ids = new Set(consumables.map((item) => item.id)); return usage.filter((entry) => ids.has(entry.itemId)); }, [consumables, usage]);
  const families = ['All supplies', 'Printer supplies', 'Paper & media', 'Labels & rolls', 'Batteries', 'Other supplies'];
  const needle = String(query || '').trim().toLowerCase();
  const visibleSupplies = useMemo(() => consumables.filter((item) => (family === 'All supplies' || supplyFamily(item) === family) && (!needle || `${item.name} ${item.tag} ${item.stockCode || ''} ${item.color || ''} ${item.location} ${item.room}`.toLowerCase().includes(needle))), [consumables, family, needle]);
  const printerSupplies = useMemo(() => consumables.filter((item) => supplyFamily(item) === 'Printer supplies'), [consumables]);
  const showPrinters = family === 'All supplies' || family === 'Printer supplies';
  const visiblePrinters = useMemo(() => printers.filter((printer) => {
    if (!needle) return true;
    const linked = compatibleItems(printer, printerSupplies);
    return `${printer.name} ${printer.tag} ${printer.modelNumber || ''} ${printer.location} ${printer.room} ${linked.map((item) => `${item.name} ${item.stockCode || ''}`).join(' ')}`.toLowerCase().includes(needle);
  }), [needle, printers, printerSupplies]);
  const unmappedPrinterSupplies = useMemo(() => printerSupplies.filter((item) => !Array.isArray(item.compatiblePrinterIds) || item.compatiblePrinterIds.length === 0).filter((item) => !needle || `${item.name} ${item.stockCode || ''} ${item.color || ''}`.toLowerCase().includes(needle)), [needle, printerSupplies]);
  const otherGroups = useMemo(() => families.slice(2).map((name) => ({ name, items: visibleSupplies.filter((item) => supplyFamily(item) === name) })).filter((group) => group.items.length), [visibleSupplies]);

  const totalUnits = consumables.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const lowCount = consumables.filter(isLowStock).length;
  const stockValue = consumables.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.cost || 0), 0);
  const usedThisMonth = visibleUsage.filter((entry) => String(entry.usedAt || '').slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((sum, entry) => sum + Number(entry.qty || 0), 0);
  const activeTonerRecord = tonerAction?.records.find((item) => item.id === tonerRecordId) || null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => Inv3D.sync());
    return () => cancelAnimationFrame(frame);
  }, [family, needle, building, items]);

  const confirmUse = () => { const issue = onUse(using.id, useForm); if (issue) { setError(issue); return; } setUsing(null); };
  const openBulkUse = () => { setBulkSelected([]); setBulkQuantities({}); setBulkForm({ issuedTo: '', department: '', purpose: '', notes: '' }); setError(''); setBulkOpen(true); };
  const toggleBulkItem = (item) => { setBulkSelected((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]); setBulkQuantities((current) => ({ ...current, [item.id]: current[item.id] || 1 })); setError(''); };
  const confirmBulkUse = () => { const issue = onBulkUse(bulkSelected.map((itemId) => ({ itemId, qty: bulkQuantities[itemId] || 1 })), bulkForm); if (issue) { setError(issue); return; } setBulkOpen(false); };
  const openTonerWorkflow = (printer, color, records) => {
    if (!records.length && !canManage) return;
    if (records.length && !canManage) { onOpenItem(records[0].id); return; }
    setTonerAction({ printer, color, records });
    setTonerRecordId(records[0]?.id || '');
    setTonerMode(records.length ? 'take' : 'add');
    setTonerForm({ qty: 1, issuedTo: '', department: `${printer.location || ''}${printer.room ? ` · ${printer.room}` : ''}`, purpose: `Installed in ${printer.name} (${printer.tag})`, notes: '', batchNumber: '', stockCode: '', storageLocation: printer.location || 'Storage room', storageRoom: printer.room || 'Main storage' });
    setError('');
  };
  const confirmTonerAction = () => {
    const record = tonerAction?.records.find((item) => item.id === tonerRecordId);
    const issue = record
      ? tonerMode === 'take' ? onUse(record.id, tonerForm) : onAddStock(record.id, { ...tonerForm, printerId: tonerAction.printer.id, printerName: tonerAction.printer.name })
      : onCreateTonerMovement(tonerAction.printer.id, tonerAction.color.label, tonerMode, tonerForm);
    if (issue) { setError(issue); return; }
    setTonerAction(null);
  };
  const quickTonerChange = (printer, color, records, direction) => {
    const record = direction < 0 ? records.find((item) => Number(item.qty || 0) > 0) || records[0] : records[0];
    const context = `${printer.location || ''}${printer.room ? ` · ${printer.room}` : ''}`;
    const issue = record
      ? direction > 0
        ? onAddStock(record.id, { qty: 1, notes: `Quick stock addition for ${printer.name} (${printer.tag})`, printerId: printer.id, printerName: printer.name })
        : onUse(record.id, { qty: 1, issuedTo: printer.name, department: context, purpose: `Installed in ${printer.name} (${printer.tag})`, notes: 'Quick toner issue from printer tile' })
      : onCreateTonerMovement(printer.id, color.label, direction > 0 ? 'add' : 'take', { qty: 1, issuedTo: printer.name, department: context, purpose: `Installed in ${printer.name} (${printer.tag})`, notes: direction > 0 ? `First toner stock added for ${printer.name} (${printer.tag})` : 'Untracked toner installation recorded from printer tile', storageLocation: printer.location || 'Storage room', storageRoom: printer.room || 'Main storage' });
    if (issue) window.alert(issue);
  };
  const openMapping = (item) => { setMapping(item); setMappedIds(Array.isArray(item.compatiblePrinterIds) ? item.compatiblePrinterIds : []); };
  const saveMapping = () => { if (onSetCompatibility(mapping.id, mappedIds)) setMapping(null); };
  const beginUse = (item) => { setUsing(item); setUseForm({ qty: 1, issuedTo: '', department: '', purpose: '', notes: '' }); setError(''); };

  useEffect(() => {
    if (!scannerAction?.itemId) return undefined;
    const item = allConsumables.find((entry) => entry.id === scannerAction.itemId);
    if (!item) { onScannerActionHandled?.(); return undefined; }
    setBuilding(item.location || 'Unassigned');
    setFamily(supplyFamily(item) === 'Printer supplies' ? 'Printer supplies' : supplyFamily(item));
    setScannerHighlight(item.id);
    if (scannerAction.action === 'issue' && canManage && Number(item.qty || 0) > 0) beginUse(item);
    setTimeout(() => document.querySelector(`[data-consumable-id="${CSS.escape(String(item.id))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 180);
    setTimeout(() => setScannerHighlight(null), 4200);
    onScannerActionHandled?.();
    return undefined;
  }, [scannerAction?.requestedAt]);

  return <div className="consumables-workspace">
    <section className="consumables-hero">
      <div>
        <small>Single-use supply control</small>
        <h2>Consumables inventory</h2>
        <p>Printer-first stock visibility with clear CMYK cartridge tracking, compatibility, locations, and usage.</p>
      </div>
      <div className="consumables-metrics">
        {[['Supply records', consumables.length], ['Units available', totalUnits], ['Low or depleted', lowCount], ['Issued this month', usedThisMonth]].map(([label, value]) => <span key={label}><strong>{value}</strong><small>{label}</small></span>)}
      </div>
    </section>

    <nav className="consumables-filters" aria-label="Consumable categories">
      <label className="consumables-building-filter"><span>Building</span><select value={building} onChange={(event) => setBuilding(event.target.value)}>{availableBuildings.map((name) => <option key={name}>{name}</option>)}</select></label>
      <div>{families.map((name) => <button key={name} type="button" data-active={family === name} onClick={() => setFamily(name)}>{name}{name === 'All supplies' && <span>{consumables.length}</span>}</button>)}</div>
      <span><b>{building}</b> on-hand value <strong>{money(stockValue)}</strong></span>
      {canManage && <button type="button" className="btn-primary" onClick={openBulkUse} style={{ height: 36, padding: '0 14px', borderRadius: 9, whiteSpace: 'nowrap' }}>Issue multiple items</button>}
    </nav>

    <div className="consumables-scanner-ready">
      <span aria-hidden="true">▥</span>
      <div><strong>Barcode scanner ready</strong><small>Scan any consumable label from this screen to identify it and immediately issue stock, open its CMYK slot, or review its record.</small></div>
      <b>Listening</b>
    </div>

    {showPrinters && <section className="printer-families">
      <header className="consumables-section-title">
        <span><small>Printer compatibility</small><strong>Ink and toner by printer</strong><p>Click any CMYK toner tile to take toner from stock or add newly received stock without leaving the printer.</p></span>
        <b>{visiblePrinters.length} printer{visiblePrinters.length === 1 ? '' : 's'}</b>
      </header>

      <div className="printer-family-list">
        {visiblePrinters.map((printer) => {
          const linked = compatibleItems(printer, printerSupplies);
          const linkedInk = linked.filter(isInk);
          const additional = linked.filter((item) => !isInk(item));
          return <article className="printer-family-card" key={printer.id}>
            <header>
              <ModelStage url={glbUrl(printer.model)} label={`${printer.name} 3D model`} className="printer-model-stage" />
              <div className="printer-identity">
                <small>{printer.modelNumber || 'Printer asset'}</small>
                <button type="button" onClick={() => onOpenItem(printer.id)}>{printer.name}</button>
                <code>{printer.tag}</code>
              </div>
              <div className="printer-location">
                <small>Printer location</small>
                <strong>{printer.location || 'Unassigned'}</strong>
                <span>{printer.room || 'No room recorded'}</span>
              </div>
            </header>

            <div className="cmyk-grid">
              {COLORS.map((color) => {
                const records = linkedInk.filter((item) => inkColor(item) === color.key);
                const item = records[0] || null;
                const quantity = records.reduce((sum, record) => sum + Number(record.qty || 0), 0);
                const activateTile = () => item && onOpenItem(item.id);
                return <div className="ink-color-card" data-color={color.key} data-consumable-id={item?.id} data-scanned={item && scannerHighlight === item.id ? 'true' : undefined} data-clickable={item ? 'true' : undefined} key={color.key} role={item ? 'button' : undefined} tabIndex={item ? 0 : undefined} onClick={activateTile} onKeyDown={(event) => { if ((event.key === 'Enter' || event.key === ' ') && item) { event.preventDefault(); activateTile(); } }} style={{ '--ink': color.hex, '--ink-soft': color.soft }}>
                  <div className="ink-model-wrap">
                    <ModelStage url={`generated/models/toner-${color.key}.glb`} label={`${color.label} cartridge 3D model`} />
                    <span className="ink-color-key">{color.short}</span>
                  </div>
                  <div className="ink-card-copy">
                    <span><strong>{color.label}</strong><StockState item={item} /></span>
                    {item ? <>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onOpenItem(item.id); }}>{item.name}</button>
                      <code>{item.stockCode || item.tag}</code>
                      <div className="ink-stock-line"><strong>{quantity}</strong><span>{item.unitOfMeasure || 'units'} on hand<small>Minimum {item.min || 0}</small></span></div>
                      <p><b>Stored:</b> {item.location || 'Unassigned'} · {item.room || 'No room'}</p>
                      {records.length > 1 && <small>{records.length} linked stock records combined</small>}
                    </> : <>
                      <p className="ink-missing-copy">No {color.label.toLowerCase()} stock record is linked to this printer.</p>
                      <small>{canManage ? 'Click anywhere on this tile to link or create this ink.' : 'A manager must link a compatible stock record.'}</small>
                    </>}
                  </div>
                  {canManage && <footer className="ink-inline-controls" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><button type="button" className="ink-quantity-button remove" disabled={!!item && quantity < 1} onClick={() => quickTonerChange(printer, color, records, -1)} aria-label={`Take one ${color.label} toner for ${printer.name}`} title="Take or install one toner"><b>−</b><span>Take one</span></button><button type="button" className="ink-quantity-button add" onClick={() => quickTonerChange(printer, color, records, 1)} aria-label={`Add one ${color.label} toner for ${printer.name}`} title="Add one toner to stock"><b>+</b><span>Add one</span></button></footer>}
                </div>;
              })}
            </div>

            {!!additional.length && <div className="printer-additional-supplies">
              <strong>Other supplies for this printer</strong>
              <div>{additional.map((item) => <SupplyTile key={item.id} item={item} highlighted={scannerHighlight === item.id} canManage={canManage} onOpenItem={onOpenItem} onMap={openMapping} onUse={beginUse} onReorder={onReorder} />)}</div>
            </div>}
          </article>;
        })}
        {!visiblePrinters.length && <div className="consumables-empty">No printer assets match this view. Add printers to Inventory before assigning their supplies.</div>}
      </div>
    </section>}

    {showPrinters && !!unmappedPrinterSupplies.length && <section className="unmapped-supplies">
      <header className="consumables-section-title"><span><small>Needs setup</small><strong>Printer supplies not yet assigned</strong><p>Assign each stock record to the printers that use it so it appears in the correct printer section.</p></span><b>{unmappedPrinterSupplies.length}</b></header>
      <div className="supply-tile-grid">{unmappedPrinterSupplies.map((item) => <SupplyTile key={item.id} item={item} highlighted={scannerHighlight === item.id} canManage={canManage} onOpenItem={onOpenItem} onMap={openMapping} onUse={beginUse} onReorder={onReorder} />)}</div>
    </section>}

    {otherGroups.map((group) => <section className="general-supply-group" key={group.name}>
      <header className="consumables-section-title"><span><small>Single-use inventory</small><strong>{group.name}</strong><p>{group.items.length} stock record{group.items.length === 1 ? '' : 's'} in this category.</p></span></header>
      <div className="supply-tile-grid">{group.items.map((item) => <SupplyTile key={item.id} item={item} highlighted={scannerHighlight === item.id} canManage={canManage} onOpenItem={onOpenItem} onMap={openMapping} onUse={beginUse} onReorder={onReorder} />)}</div>
    </section>)}

    {!showPrinters && !otherGroups.length && <div className="consumables-empty">No single-use supplies match this view.</div>}

    <section className="consumables-usage">
      <header><span><strong>Recent usage</strong><small>Who received each supply and why it left stock</small></span><b>{visibleUsage.length} records</b></header>
      <div className="consumables-usage-head"><span>Supply</span><span>Qty</span><span>Issued to</span><span>Department</span><span>Purpose</span><span>Date</span></div>
      {visibleUsage.slice(0, 30).map((entry) => <div className="consumables-usage-row" key={entry.id}><strong>{entry.itemName}</strong><b>{entry.qty}</b><span>{entry.issuedTo}</span><span>{entry.department || '—'}</span><span>{entry.purpose}</span><span>{String(entry.usedAt).slice(0, 10)}</span></div>)}
      {!visibleUsage.length && <div className="consumables-empty compact">No single-use stock has been issued yet.</div>}
    </section>

    {tonerAction && <Modal title={`${tonerAction.color.label} toner · ${tonerAction.printer.name}`} subtitle={`${tonerAction.printer.tag} · ${tonerAction.printer.location || 'Unassigned'} · ${tonerAction.printer.room || 'No room'}`} onClose={() => setTonerAction(null)}>
      <div className="toner-quick-workflow">
        <div className="toner-workflow-summary" data-empty={!activeTonerRecord ? 'true' : undefined} style={{ '--ink': tonerAction.color.hex, '--ink-soft': tonerAction.color.soft }}><ModelStage url={`generated/models/toner-${tonerAction.color.key}.glb`} label={`${tonerAction.color.label} toner`} />{activeTonerRecord ? <><span><small>Selected supply</small><strong>{activeTonerRecord.name}</strong><code>{activeTonerRecord.stockCode || activeTonerRecord.tag}</code><p><b>{activeTonerRecord.qty || 0}</b> {activeTonerRecord.unitOfMeasure || 'units'} on hand · stored in {activeTonerRecord.location || 'Unassigned'} {activeTonerRecord.room || ''}</p></span><button type="button" className="btn-ghost" onClick={() => { const id = activeTonerRecord.id; setTonerAction(null); onOpenItem(id); }}>View record</button></> : <span><small>First toner record</small><strong>No {tonerAction.color.label.toLowerCase()} toner is linked yet</strong><p>Add the first delivery or record toner that was already installed. A printer-linked inventory record and barcode will be created automatically.</p></span>}</div>
        {tonerAction.records.length > 1 && <label className="toner-workflow-field"><span>Stock record</span><select value={tonerRecordId} onChange={(event) => { setTonerRecordId(event.target.value); setError(''); }} style={field}>{tonerAction.records.map((record) => <option key={record.id} value={record.id}>{record.name} · {record.stockCode || record.tag} · {record.qty || 0} available</option>)}</select></label>}
        <div className="toner-workflow-mode"><button type="button" data-active={tonerMode === 'take'} onClick={() => { setTonerMode('take'); setError(''); setTonerForm((current) => ({ ...current, qty: 1, purpose: `Installed in ${tonerAction.printer.name} (${tonerAction.printer.tag})` })); }}><b>−</b><span><strong>Take toner</strong><small>{activeTonerRecord ? 'Install or issue from stock' : 'Record toner already installed'}</small></span></button><button type="button" data-active={tonerMode === 'add'} onClick={() => { setTonerMode('add'); setError(''); setTonerForm((current) => ({ ...current, qty: 1, notes: '', batchNumber: '' })); }}><b>+</b><span><strong>Add toner</strong><small>{activeTonerRecord ? 'Receive units into stock' : 'Create the first stock record'}</small></span></button></div>
        {!activeTonerRecord && tonerMode === 'take' && <div className="toner-workflow-info"><b>Untracked installation</b><span>The toner installation will be recorded and a zero-on-hand inventory record will be created for this printer and color, ready for future restocking and barcode generation.</span></div>}
        <div className="toner-workflow-form"><label><span>Quantity</span><input autoFocus type="number" min="1" max={tonerMode === 'take' && activeTonerRecord ? activeTonerRecord.qty : undefined} value={tonerForm.qty} onChange={(event) => setTonerForm((current) => ({ ...current, qty: event.target.value }))} style={field} /></label>{tonerMode === 'take' ? <><label><span>Issued to / installed by</span><input value={tonerForm.issuedTo} onChange={(event) => setTonerForm((current) => ({ ...current, issuedTo: event.target.value }))} style={field} /></label><label><span>Printer location</span><input value={tonerForm.department} onChange={(event) => setTonerForm((current) => ({ ...current, department: event.target.value }))} style={field} /></label><label><span>Purpose</span><input value={tonerForm.purpose} onChange={(event) => setTonerForm((current) => ({ ...current, purpose: event.target.value }))} style={field} /></label></> : <><label><span>Batch / delivery reference</span><input value={tonerForm.batchNumber} onChange={(event) => setTonerForm((current) => ({ ...current, batchNumber: event.target.value }))} placeholder="Optional" style={field} /></label>{!activeTonerRecord && <><label><span>Stock code</span><input value={tonerForm.stockCode} onChange={(event) => setTonerForm((current) => ({ ...current, stockCode: event.target.value }))} placeholder="Optional manufacturer code" style={field} /></label><label><span>Storage building</span><input value={tonerForm.storageLocation} onChange={(event) => setTonerForm((current) => ({ ...current, storageLocation: event.target.value }))} style={field} /></label><label><span>Storage room</span><input value={tonerForm.storageRoom} onChange={(event) => setTonerForm((current) => ({ ...current, storageRoom: event.target.value }))} style={field} /></label></>}</>}<label className="wide"><span>{tonerMode === 'take' ? 'Usage note' : 'Receiving note / reference'}</span><textarea rows="3" value={tonerForm.notes} onChange={(event) => setTonerForm((current) => ({ ...current, notes: event.target.value }))} placeholder={tonerMode === 'take' ? 'Optional installation or issue details' : 'Required: delivery, invoice, or receiving details'} /></label></div>
        {error && <div className="toner-workflow-error">{error}</div>}
        <div className="toner-workflow-footer"><button type="button" className="btn-ghost" onClick={() => activeTonerRecord ? (() => { const color = tonerAction.color.label; const printerId = tonerAction.printer.id; setTonerAction(null); onCreateInk(color, printerId); })() : (() => { setTonerAction(null); setSlotSetup({ printer: tonerAction.printer, color: tonerAction.color }); })()}>{activeTonerRecord ? 'Create another toner record' : 'Link existing toner instead'}</button><span><button type="button" className="btn-ghost" onClick={() => setTonerAction(null)}>Cancel</button><button type="button" className="btn-primary" disabled={tonerMode === 'take' && activeTonerRecord && Number(activeTonerRecord.qty || 0) < 1} onClick={confirmTonerAction}>{tonerMode === 'take' ? activeTonerRecord ? 'Record toner taken' : 'Record installed toner' : activeTonerRecord ? 'Add toner to stock' : 'Create and add toner'}</button></span></div>
      </div>
    </Modal>}

    {slotSetup && <Modal title={`Set up ${slotSetup.color.label} ink`} subtitle={`${slotSetup.printer.name} · ${slotSetup.printer.tag}`} onClose={() => setSlotSetup(null)}>
      <div className="ink-slot-picker">
        <p>Select an existing {slotSetup.color.label.toLowerCase()} stock record to link with this printer, or create a new pre-filled record.</p>
        {printerSupplies.filter((item) => isInk(item) && inkColor(item) === slotSetup.color.key).map((item) => <button key={item.id} type="button" onClick={() => {
          const ids = new Set(Array.isArray(item.compatiblePrinterIds) ? item.compatiblePrinterIds : []);
          ids.add(slotSetup.printer.id);
          if (onSetCompatibility(item.id, [...ids])) setSlotSetup(null);
        }}>
          <ModelStage url={`generated/models/toner-${slotSetup.color.key}.glb`} label="" />
          <span><strong>{item.name}</strong><code>{item.stockCode || item.tag}</code><small>{item.qty || 0} {item.unitOfMeasure || 'units'} · {item.location} · {item.room}</small></span>
          <b>Link</b>
        </button>)}
        {!printerSupplies.some((item) => isInk(item) && inkColor(item) === slotSetup.color.key) && <div className="ink-slot-picker-empty">No existing {slotSetup.color.label.toLowerCase()} stock records were found.</div>}
        <button type="button" className="ink-create-record" onClick={() => { const { label } = slotSetup.color; const printerId = slotSetup.printer.id; setSlotSetup(null); onCreateInk(label, printerId); }}><span>＋</span><span><strong>Create new {slotSetup.color.label} stock record</strong><small>Opens a pre-filled toner form already linked to this printer.</small></span></button>
      </div>
    </Modal>}

    {using && <Modal title="Use or issue stock" subtitle={`${using.name} · ${using.qty} ${using.unitOfMeasure || 'units'} available`} onClose={() => setUsing(null)}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{[['qty', 'Quantity used', 'number'], ['issuedTo', 'Issued to / used by', 'text'], ['department', 'Department / location', 'text'], ['purpose', 'Purpose', 'text']].map(([key, label, type]) => <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span><input type={type} min={type === 'number' ? 1 : undefined} max={type === 'number' ? using.qty : undefined} value={useForm[key]} onChange={(event) => setUseForm((current) => ({ ...current, [key]: event.target.value }))} style={field} /></label>)}<label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>Notes</span><textarea rows={3} value={useForm.notes} onChange={(event) => setUseForm((current) => ({ ...current, notes: event.target.value }))} style={{ ...field, height: 72, padding: 10 }} /></label>{error && <div style={{ gridColumn: 'span 2', padding: 9, borderRadius: 7, background: '#fdeceb', color: '#a01a12', fontSize: 12 }}>{error}</div>}<div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn-ghost" onClick={() => setUsing(null)}>Cancel</button><button type="button" className="btn-primary" onClick={confirmUse}>Record usage</button></div></div></Modal>}

    {bulkOpen && <Modal title="Issue multiple consumables" subtitle="One recipient, purpose, and note for the entire batch" onClose={() => setBulkOpen(false)}><div style={{ display: 'grid', gap: 14 }}>
      <div style={{ maxHeight: 270, overflow: 'auto', display: 'grid', gap: 6 }}>{visibleSupplies.map((item) => <label key={item.id} style={{ padding: '9px 11px', display: 'grid', gridTemplateColumns: '22px 1fr 82px', alignItems: 'center', gap: 9, border: bulkSelected.includes(item.id) ? '1px solid #16755d' : '1px solid #dde4ea', borderRadius: 9, background: bulkSelected.includes(item.id) ? '#f1faf7' : '#fff', cursor: Number(item.qty || 0) > 0 ? 'pointer' : 'not-allowed', opacity: Number(item.qty || 0) > 0 ? 1 : .55 }}><input type="checkbox" disabled={Number(item.qty || 0) < 1} checked={bulkSelected.includes(item.id)} onChange={() => toggleBulkItem(item)} /><span><strong style={{ display: 'block', fontSize: 12 }}>{item.name}</strong><small style={{ color: '#71808d' }}>{item.tag} · {item.qty || 0} {item.unitOfMeasure || 'units'} available</small></span><input aria-label={`Quantity for ${item.name}`} type="number" min="1" max={item.qty || 0} disabled={!bulkSelected.includes(item.id)} value={bulkQuantities[item.id] || 1} onClick={(event) => event.stopPropagation()} onChange={(event) => setBulkQuantities((current) => ({ ...current, [item.id]: event.target.value }))} style={{ ...field, width: 78 }} /></label>)}{!visibleSupplies.length && <div className="consumables-empty compact">No consumables match this building and category.</div>}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{[['issuedTo', 'Issued to / used by'], ['department', 'Department / location'], ['purpose', 'Shared purpose'], ['notes', 'Shared record note']].map(([key, label]) => <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 650 }}>{label}</span><input value={bulkForm[key]} onChange={(event) => setBulkForm((current) => ({ ...current, [key]: event.target.value }))} style={field} /></label>)}</div>
      {error && <div style={{ padding: 9, borderRadius: 7, background: '#fdeceb', color: '#a01a12', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><strong style={{ color: '#315448', fontSize: 12 }}>{bulkSelected.length} stock record{bulkSelected.length === 1 ? '' : 's'} selected</strong><span style={{ display: 'flex', gap: 8 }}><button type="button" className="btn-ghost" onClick={() => setBulkOpen(false)}>Cancel</button><button type="button" className="btn-primary" onClick={confirmBulkUse}>Record batch usage</button></span></div>
    </div></Modal>}

    {mapping && <Modal title="Printer compatibility" subtitle={`${mapping.name} · choose every printer that uses this supply`} onClose={() => setMapping(null)}><div style={{ maxHeight: 430, overflow: 'auto', display: 'grid', gap: 7 }}>{printers.map((printer) => <label key={printer.id} style={{ padding: '10px 11px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #dfe5eb', borderRadius: 8, cursor: 'pointer' }}><input type="checkbox" checked={mappedIds.includes(printer.id)} onChange={(event) => setMappedIds((current) => event.target.checked ? [...current, printer.id] : current.filter((id) => id !== printer.id))} /><span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 12 }}>{printer.name} · {printer.tag}</strong><small style={{ color: '#6e7d8c' }}>{printer.location} · {printer.room}{printer.modelNumber ? ` · ${printer.modelNumber}` : ''}</small></span></label>)}{!printers.length && <div style={{ padding: 28, textAlign: 'center', color: '#7b8794' }}>No printer assets are currently recorded in Inventory.</div>}</div><div style={{ marginTop: 15, display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn-ghost" onClick={() => setMapping(null)}>Cancel</button><button type="button" className="btn-primary" onClick={saveMapping}>Save compatibility</button></div></Modal>}
  </div>;
}

function SupplyTile({ item, highlighted, canManage, onOpenItem, onMap, onUse, onReorder }) {
  const quantity = Number(item.qty || 0);
  const low = isLowStock(item);
  const color = inkColor(item);
  const url = color ? `generated/models/toner-${color}.glb` : glbUrl(item.model);
  return <article className="supply-tile" data-consumable-id={item.id} data-scanned={highlighted ? 'true' : undefined} data-alert={quantity === 0 ? 'empty' : low ? 'low' : 'healthy'}>
    <ModelStage url={url} label={`${item.name} 3D model`} />
    <div className="supply-tile-copy">
      <span><StockState item={item} /><small>{supplyFamily(item)}</small></span>
      <button type="button" onClick={() => onOpenItem(item.id)}>{item.name}</button>
      <code>{item.stockCode || item.tag}</code>
      <div className="supply-stock-summary"><strong>{quantity}</strong><span>{item.unitOfMeasure || 'units'}<small>Minimum {item.min || 0}</small></span></div>
      <p><b>Stored:</b> {item.location || 'Unassigned'} · {item.room || 'No room'}</p>
    </div>
    {canManage && <footer>{supplyFamily(item) === 'Printer supplies' && <button type="button" className="btn-ghost" onClick={() => onMap(item)}>Assign printer</button>}{low && <button type="button" className="btn-ghost" onClick={() => onReorder(item.id, Math.max(12, Number(item.min || 0) * 2))}>Reorder</button>}<button type="button" className="btn-primary" disabled={quantity === 0} onClick={() => onUse(item)}>Issue stock</button></footer>}
  </article>;
}

function Modal({ title, subtitle, onClose, children }) {
  return <div className="consumables-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}><div className="consumables-modal"><header><span><strong>{title}</strong><small>{subtitle}</small></span><button type="button" className="btn-ghost" onClick={onClose}><IconX /></button></header><div>{children}</div></div></div>;
}

export default memo(Consumables, (previous, next) => previous.items === next.items
  && previous.usage === next.usage
  && previous.query === next.query
  && previous.canManage === next.canManage
  && previous.scannerAction === next.scannerAction);
