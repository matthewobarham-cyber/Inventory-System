import { useEffect, useMemo, useRef, useState } from 'react';
import { MODELS, BUILDINGS, CONDITIONS } from '../data.js';
import { IconX } from '../icons.jsx';

const fieldStyle = { height: 38, padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 13, outline: 'none' };
const monoFieldStyle = { ...fieldStyle, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5 };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6 };
const captionStyle = { fontSize: 11.5, fontWeight: 600, color: '#3f4a56' };

function SearchableEquipmentSelect({ value, consumablesOnly, onChange }) {
  const rootRef = useRef(null);
  const options = useMemo(() => MODELS
    .filter((model) => !consumablesOnly || model.cons === 1)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [consumablesOnly]);
  const selected = options.find((model) => model.id === value) || MODELS.find((model) => model.id === value);
  const [query, setQuery] = useState(selected?.name || '');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { setQuery(selected?.name || ''); }, [value, selected?.name]);

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || term === selected?.name?.toLowerCase()) return options;
    return options.filter((model) => `${model.name} ${model.cat || ''} ${model.id}`.toLowerCase().includes(term));
  }, [options, query, selected?.name]);

  const choose = (model) => {
    setQuery(model.name);
    setExpanded(false);
    onChange(model.id);
  };

  return <div ref={rootRef} className="asset-type-combobox" onBlur={(event) => {
    if (!rootRef.current?.contains(event.relatedTarget)) {
      setExpanded(false);
      setQuery(selected?.name || '');
    }
  }}>
    <span className="asset-type-search-icon" aria-hidden="true">⌕</span>
    <input
      value={query}
      onChange={(event) => { setQuery(event.target.value); setExpanded(true); }}
      onFocus={(event) => { event.target.select(); setExpanded(true); }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && expanded && matches.length) { event.preventDefault(); choose(matches[0]); }
        if (event.key === 'Escape') { setExpanded(false); setQuery(selected?.name || ''); }
        if (event.key === 'ArrowDown') { event.preventDefault(); setExpanded(true); rootRef.current?.querySelector('[role="option"]')?.focus(); }
      }}
      role="combobox"
      aria-expanded={expanded}
      aria-controls="asset-type-options"
      aria-autocomplete="list"
      placeholder="Search equipment types…"
      autoComplete="off"
    />
    <button type="button" className="asset-type-toggle" tabIndex={-1} aria-label="Show equipment types" onMouseDown={(event) => event.preventDefault()} onClick={() => setExpanded((current) => !current)}>⌄</button>
    {expanded && <div id="asset-type-options" className="asset-type-options" role="listbox">
      {matches.map((model) => <button
        type="button"
        role="option"
        aria-selected={model.id === value}
        key={model.id}
        className={model.id === value ? 'selected' : ''}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => choose(model)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); event.currentTarget.nextElementSibling?.focus(); }
          if (event.key === 'ArrowUp') { event.preventDefault(); (event.currentTarget.previousElementSibling || rootRef.current?.querySelector('input'))?.focus(); }
          if (event.key === 'Escape') { setExpanded(false); rootRef.current?.querySelector('input')?.focus(); }
        }}
      ><span>{model.name}</span><small>{model.cat || 'Equipment'}</small></button>)}
      {!matches.length && <div className="asset-type-no-results">No equipment types match “{query}”</div>}
    </div>}
  </div>;
}

export default function AssetFormModal({ open, mode, form, error, intakeProgress, isAdmin, consumablesOnly = false, printers = [], onChange, onSave, onDelete, onRequestRetire, onClose }) {
  if (!open) return null;

  const set = (key) => (e) => onChange(key, e.target.value);
  const selectedModel = MODELS.find((model) => model.id === form.model);
  const consumable = selectedModel?.cons === 1;
  const printerRelated = consumable && (selectedModel?.cat === 'Printer consumables' || /printer|toner|ink|cartridge|paper|label/i.test(`${selectedModel?.name || ''} ${selectedModel?.id || ''}`));
  const colorTracked = consumable && /toner|ink|cartridge/i.test(`${selectedModel?.name || ''} ${selectedModel?.id || ''}`);
  const selectedPrinterId = Array.isArray(form.compatiblePrinterIds) ? form.compatiblePrinterIds[0] || '' : '';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,22,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 40 }}>
      <div style={{ width: '100%', maxWidth: 620, background: '#fff', borderRadius: 12, overflow: 'hidden', animation: 'rise .18s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eceff3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>
              {mode === 'edit' ? `Edit ${consumable ? 'consumable' : 'asset'} record` : intakeProgress ? 'Set up received asset' : consumable ? 'Add consumable stock' : 'Add an asset'}
            </span>
            {intakeProgress && (
              <span style={{ fontSize: 11.5, color: '#7b8794', fontWeight: 500 }}>
                Asset {intakeProgress.current} of {intakeProgress.total} · each unit gets its own record
              </span>
            )}
          </span>
          <button type="button" onClick={onClose} className="btn-ghost" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 7 }}>
            <IconX />
          </button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxHeight: '62vh', overflow: 'auto' }}>
          <div style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Equipment type</span>
            <SearchableEquipmentSelect value={form.model} consumablesOnly={consumablesOnly} onChange={(model) => onChange('model', model)} />
          </div>
          {printerRelated && <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Printer using this consumable</span>
            <select value={selectedPrinterId} onChange={(event) => onChange('compatiblePrinterIds', event.target.value ? [event.target.value] : [])} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option value="">Select a printer…</option>
              {printers.map((printer) => <option key={printer.id} value={printer.id}>{printer.name} · {printer.tag} · {printer.location} / {printer.room}</option>)}
            </select>
            <span style={{ fontSize: 10.5, color: '#7b8794' }}>{printers.length ? 'This places the supply under the correct printer in Consumables.' : 'No printer assets are available. Add the printer to Inventory first.'}</span>
          </label>}
          {colorTracked && <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Ink / toner color</span>
            <select value={form.color || ''} onChange={set('color')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option value="">Select a color…</option>
              <option value="Cyan">Cyan (C)</option>
              <option value="Magenta">Magenta (M)</option>
              <option value="Yellow">Yellow (Y)</option>
              <option value="Black">Black (K)</option>
            </select>
            <span style={{ fontSize: 10.5, color: '#7b8794' }}>The selected color determines the CMYK tile and 3D cartridge model.</span>
          </label>}
          <label style={labelStyle}>
            <span style={captionStyle}>Asset tag</span>
            <input value={form.tag} onChange={set('tag')} style={monoFieldStyle} />
            {mode === 'add' && <span style={{ fontSize: 10.5, color: '#7b8794' }}>Generated as MSBM / asset class / sequence / month / year, using the selected equipment type and uploaded inventory.</span>}
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Serial</span>
            <input value={form.serial} onChange={set('serial')} style={monoFieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Inventory location</span>
            <select value={form.location} onChange={set('location')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              {BUILDINGS.map((bd) => <option key={bd} value={bd}>{bd}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Room</span>
            <input value={form.room} onChange={set('room')} style={fieldStyle} />
          </label>
          <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Assignment (optional)</span>
            <input value={form.assignedTo || ''} onChange={set('assignedTo')} placeholder="Person, department, lab, or purpose" style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Quantity per record</span>
            <input type="number" min={mode === 'edit' ? 0 : 1} value={consumable ? (form.qty ?? 1) : 1} disabled={!consumable} onChange={set('qty')} style={{ ...fieldStyle, color: consumable ? '#14181d' : '#7b8794', cursor: consumable ? 'text' : 'not-allowed' }} />
            <span style={{ fontSize: 10.5, color: '#8d99a6' }}>{consumable ? 'Consumables are stored as one quantity-based stock record.' : 'Each physical item is stored as its own record.'}</span>
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Minimum level</span>
            <input type="number" value={form.min} onChange={set('min')} style={fieldStyle} />
          </label>
          {consumable && <>
            <label style={labelStyle}>
              <span style={captionStyle}>Unit of measure</span>
              <select value={form.unitOfMeasure || 'unit'} onChange={set('unitOfMeasure')} style={{ ...fieldStyle, cursor: 'pointer' }}><option>unit</option><option>pack</option><option>box</option><option>ream</option><option>cartridge</option><option>roll</option><option>set</option></select>
            </label>
            <label style={labelStyle}>
              <span style={captionStyle}>Batch / lot number</span>
              <input value={form.batchNumber || ''} onChange={set('batchNumber')} style={monoFieldStyle} />
            </label>
            <label style={labelStyle}>
              <span style={captionStyle}>Expiry date</span>
              <input type="date" value={form.expiryDate || ''} onChange={set('expiryDate')} style={fieldStyle} />
            </label>
            <label style={labelStyle}>
              <span style={captionStyle}>Supply / cartridge code</span>
              <input value={form.stockCode || ''} onChange={set('stockCode')} placeholder="e.g. HP 26A / CF226A" style={monoFieldStyle} />
            </label>
            {!colorTracked && <label style={labelStyle}>
              <span style={captionStyle}>Colour / variant</span>
              <input value={form.color || ''} onChange={set('color')} placeholder="Black, cyan, A4…" style={fieldStyle} />
            </label>}
          </>}
          <label style={labelStyle}>
            <span style={captionStyle}>Condition</span>
            <select value={form.condition} onChange={set('condition')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              {CONDITIONS.map((cd) => <option key={cd} value={cd}>{cd}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Unit cost (JMD)</span>
            <input type="number" value={form.cost} onChange={set('cost')} style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Supplier</span>
            <input value={form.supplier} onChange={set('supplier')} style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Warranty until</span>
            <input type="date" value={form.warranty} onChange={set('warranty')} style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Purchase date</span>
            <input type="date" value={form.purchased || ''} onChange={set('purchased')} style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Depreciation method</span>
            <select value={form.depreciationMethod || 'Straight-line'} onChange={set('depreciationMethod')} style={{ ...fieldStyle, cursor: 'pointer' }}><option>Straight-line</option><option>None</option></select>
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Useful life (years)</span>
            <input type="number" min="1" value={form.usefulLifeYears || 5} onChange={set('usefulLifeYears')} style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Salvage value (JMD)</span>
            <input type="number" min="0" value={form.salvageValue || 0} onChange={set('salvageValue')} style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Expected replacement</span>
            <input type="date" value={form.expectedReplacementDate || ''} onChange={set('expectedReplacementDate')} style={fieldStyle} />
          </label>
          {!!error && (
            <div style={{ gridColumn: 'span 2', padding: '9px 12px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 8, color: '#a01a12', fontSize: 12 }}>{error}</div>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #eceff3', display: 'flex', alignItems: 'center', gap: 9 }}>
          {mode === 'edit' && (
            <button type="button" className="btn-ghost-danger" onClick={isAdmin ? onDelete : onRequestRetire} style={{ height: 36, padding: '0 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>{isAdmin ? 'Retire asset' : 'Request retirement'}</button>
          )}
          <div style={{ flex: 1 }}></div>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onSave} style={{ height: 36, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
            {mode === 'edit' ? 'Save changes' : intakeProgress && intakeProgress.current < intakeProgress.total ? 'Add & continue' : consumable ? 'Add consumable' : 'Add asset'}
          </button>
        </div>
      </div>
    </div>
  );
}
