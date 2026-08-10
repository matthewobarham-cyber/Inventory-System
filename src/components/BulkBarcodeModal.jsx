import { useEffect, useMemo, useState } from 'react';
import { IconX } from '../icons.jsx';
import { BarcodeGraphic } from './BarcodeLabelModal.jsx';

const SIZES = {
  compact: { label: 'Compact · 3 across', columns: 3, barcodeHeight: 34, barcodeWidth: 1.15 },
  standard: { label: 'Standard · 2 across', columns: 2, barcodeHeight: 48, barcodeWidth: 1.5 },
  large: { label: 'Large · 1 across', columns: 1, barcodeHeight: 62, barcodeWidth: 2 }
};

export default function BulkBarcodeModal({ open, items, onClose }) {
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery] = useState('');
  const [copies, setCopies] = useState(1);
  const [size, setSize] = useState('standard');
  const [building, setBuilding] = useState('All buildings');
  const [room, setRoom] = useState('All rooms');
  const [equipmentType, setEquipmentType] = useState('All equipment types');
  const [status, setStatus] = useState('All statuses');
  const [sortBy, setSortBy] = useState('building-room');

  useEffect(() => {
    if (!open) return undefined;
    setSelected(new Set(items.filter((item) => item.tag).map((item) => item.id)));
    setQuery('');
    setCopies(1);
    setBuilding('All buildings');
    setRoom('All rooms');
    setEquipmentType('All equipment types');
    setStatus('All statuses');
    setSortBy('building-room');
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, items, onClose]);

  const available = useMemo(() => items.filter((item) => item.tag), [items]);
  const buildings = useMemo(() => Array.from(new Set(available.map((item) => item.location || 'Unassigned'))).sort(), [available]);
  const rooms = useMemo(() => Array.from(new Set(available.filter((item) => building === 'All buildings' || (item.location || 'Unassigned') === building).map((item) => item.room || 'Unassigned'))).sort(), [available, building]);
  const equipmentTypes = useMemo(() => Array.from(new Set(available.map((item) => item.name || 'Unnamed equipment'))).sort(), [available]);
  const statuses = useMemo(() => Array.from(new Set(available.map((item) => item.status || 'Unknown'))).sort(), [available]);
  const sortRecords = (records) => [...records].sort((a, b) => {
    const fields = sortBy === 'room' ? ['room', 'location', 'name', 'tag'] : sortBy === 'equipment' ? ['name', 'location', 'room', 'tag'] : sortBy === 'tag' ? ['tag', 'name'] : ['location', 'room', 'name', 'tag'];
    for (const field of fields) {
      const result = String(a[field] || '').localeCompare(String(b[field] || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (result) return result;
    }
    return 0;
  });
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sortRecords(available.filter((item) => {
      if (building !== 'All buildings' && (item.location || 'Unassigned') !== building) return false;
      if (room !== 'All rooms' && (item.room || 'Unassigned') !== room) return false;
      if (equipmentType !== 'All equipment types' && (item.name || 'Unnamed equipment') !== equipmentType) return false;
      if (status !== 'All statuses' && (item.status || 'Unknown') !== status) return false;
      return !term || `${item.name} ${item.tag} ${item.serial || ''} ${item.location || ''} ${item.room || ''}`.toLowerCase().includes(term);
    }));
  }, [available, query, building, room, equipmentType, status, sortBy]);
  const chosen = useMemo(() => sortRecords(available.filter((item) => selected.has(item.id))), [available, selected, sortBy]);
  const printItems = useMemo(() => chosen.flatMap((item) => Array.from({ length: copies }, (_, copy) => ({ item, copy }))), [chosen, copies]);
  const config = SIZES[size];

  if (!open) return null;

  const toggle = (id) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectVisible = () => setSelected((current) => new Set([...current, ...visible.map((item) => item.id)]));
  const useVisibleOnly = () => setSelected(new Set(visible.map((item) => item.id)));

  return (
    <div className="barcode-modal-backdrop" role="dialog" aria-modal="true" aria-label="Bulk barcode printing">
      <div className="bulk-barcode-modal">
        <div className="barcode-modal-controls" style={{ padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #e3e8ed' }}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <strong style={{ fontSize: 15 }}>Bulk barcode printing</strong>
            <span style={{ color: '#7b8794', fontSize: 11.5 }}>Select assets, configure the labels, then print the complete sheet.</span>
          </span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close bulk barcode printing" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8 }}><IconX /></button>
        </div>

        <div className="barcode-modal-controls bulk-barcode-workspace">
          <aside className="bulk-barcode-selector">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label htmlFor="bulk-barcode-search" style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6d7a87' }}>Find assets</label>
              <input id="bulk-barcode-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, asset tag, serial, location…" style={{ height: 36, padding: '0 10px', border: '1px solid #cdd7e1', borderRadius: 8, fontSize: 12.5 }} />
            </div>
            <div className="bulk-barcode-filters">
              <label>Building
                <select value={building} onChange={(event) => { setBuilding(event.target.value); setRoom('All rooms'); }}><option>All buildings</option>{buildings.map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label>Room
                <select value={room} onChange={(event) => setRoom(event.target.value)}><option>All rooms</option>{rooms.map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label>Equipment type
                <select value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)}><option>All equipment types</option>{equipmentTypes.map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label>Status
                <select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select>
              </label>
              <label className="bulk-barcode-filter-wide">Sort printed labels by
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                  <option value="building-room">Building, then room</option>
                  <option value="room">Room, then building</option>
                  <option value="equipment">Equipment type</option>
                  <option value="tag">Asset tag</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" className="btn-primary" onClick={useVisibleOnly} style={{ height: 30, padding: '0 9px', borderRadius: 7, fontSize: 10.5 }}>Use shown only</button>
              <button type="button" className="btn-ghost" onClick={selectVisible} style={{ height: 30, padding: '0 9px', borderRadius: 7, fontSize: 10.5 }}>Add shown</button>
              <button type="button" className="btn-ghost" onClick={() => setSelected(new Set())} style={{ height: 30, padding: '0 9px', borderRadius: 7, fontSize: 10.5 }}>Clear all</button>
              <span style={{ marginLeft: 'auto', fontFamily: "'IBM Plex Mono',monospace", color: '#0a3d7c', fontSize: 10.5, fontWeight: 700 }}>{chosen.length} selected</span>
            </div>
            <div className="bulk-barcode-list">
              {visible.map((item) => (
                <label key={item.id} className="bulk-barcode-option">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }}>{item.name}</strong>
                    <small style={{ display: 'block', marginTop: 2, color: '#73808d', fontFamily: "'IBM Plex Mono',monospace", fontSize: 9.5 }}>{item.tag} · {item.location || 'Unassigned'}</small>
                  </span>
                </label>
              ))}
              {!visible.length && <div style={{ padding: 24, textAlign: 'center', color: '#7b8794', fontSize: 12 }}>No assets match this search.</div>}
            </div>
          </aside>

          <section className="bulk-barcode-preview-panel">
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'flex-end', gap: 12, background: '#fff', borderBottom: '1px solid #e1e6eb' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10.5, fontWeight: 650, color: '#65727f' }}>Label layout
                <select value={size} onChange={(event) => setSize(event.target.value)} style={{ height: 34, minWidth: 170, padding: '0 9px', border: '1px solid #cdd7e1', borderRadius: 7, background: '#fff', fontSize: 11.5 }}>
                  {Object.entries(SIZES).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 10.5, fontWeight: 650, color: '#65727f' }}>Copies per asset
                <input type="number" min="1" max="25" value={copies} onChange={(event) => setCopies(Math.min(25, Math.max(1, Number(event.target.value) || 1)))} style={{ width: 105, height: 34, padding: '0 9px', border: '1px solid #cdd7e1', borderRadius: 7, fontSize: 11.5 }} />
              </label>
              <span style={{ marginLeft: 'auto', paddingBottom: 8, color: '#5f6d79', fontSize: 11.5 }}><strong>{printItems.length}</strong> labels</span>
            </div>
            <div className="bulk-barcode-preview-scroll">
              <div className={`bulk-barcode-print-sheet bulk-barcode-${size}`} style={{ '--barcode-columns': config.columns }}>
                {printItems.map(({ item, copy }) => (
                  <div key={`${item.id}-${copy}`} className="bulk-barcode-label">
                    <img src="brand/msbm-lockup.png" alt="" />
                    <strong>{item.name}</strong>
                    <BarcodeGraphic value={item.tag} height={config.barcodeHeight} width={config.barcodeWidth} />
                    <span>{item.serial || 'No serial'} · {item.location || 'Unassigned'} {item.room || ''}</span>
                  </div>
                ))}
                {!printItems.length && <div className="bulk-barcode-empty">Select at least one asset to build the print sheet.</div>}
              </div>
            </div>
          </section>
        </div>

        <div className="barcode-modal-controls" style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 9, borderTop: '1px solid #e3e8ed' }}>
          <span style={{ flex: 1, color: '#71808e', fontSize: 11.5 }}>Use your printer settings to select the correct label paper and margins.</span>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12 }}>Close</button>
          <button type="button" className="btn-primary" disabled={!printItems.length} onClick={() => window.print()} style={{ height: 36, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 650 }}>Print {printItems.length} labels</button>
        </div>
      </div>
    </div>
  );
}
