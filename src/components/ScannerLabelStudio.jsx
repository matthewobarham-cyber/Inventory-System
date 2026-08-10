import { useEffect, useMemo, useState } from 'react';
import { thumbStyle } from '../data.js';
import { BarcodeGraphic } from './BarcodeLabelModal.jsx';

const MAX_LABELS = 14;

export default function ScannerLabelStudio({ items }) {
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [printActive, setPrintActive] = useState(false);

  const available = useMemo(() => items.filter((item) => item.tag && !item.archived), [items]);
  const selected = useMemo(() => selectedIds.map((id) => available.find((item) => item.id === id)).filter(Boolean), [available, selectedIds]);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return available.filter((item) => !selectedIds.includes(item.id)).slice(0, 7);
    return available.filter((item) => !selectedIds.includes(item.id)
      && `${item.name} ${item.tag} ${item.serial || ''} ${item.location || ''} ${item.room || ''}`.toLowerCase().includes(term)).slice(0, 8);
  }, [available, query, selectedIds]);

  useEffect(() => {
    const valid = new Set(available.map((item) => item.id));
    setSelectedIds((current) => current.filter((id) => valid.has(id)).slice(0, MAX_LABELS));
  }, [available]);

  const add = (item) => {
    if (!item || selectedIds.includes(item.id) || selectedIds.length >= MAX_LABELS) return;
    setSelectedIds((current) => [...current, item.id]);
    setQuery('');
    setSearchOpen(false);
  };
  const remove = (id) => setSelectedIds((current) => current.filter((entry) => entry !== id));
  const openPrintPreview = () => {
    if (!selected.length) return;
    setPrintActive(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.print();
      setPrintActive(false);
    }));
  };

  return <section className="scanner-label-studio">
    <header className="scanner-label-studio-header">
      <span><small>LABEL PRODUCTION</small><strong>Build a 14-label barcode sheet</strong><p>Search inventory, arrange up to fourteen assets, and inspect the exact Avery 5162 layout before printing.</p></span>
      <div><b>{selected.length}</b><span>of {MAX_LABELS}<small>labels loaded</small></span></div>
    </header>

    <div className="scanner-label-studio-grid">
      <div className="scanner-label-search-panel">
        <label htmlFor="scanner-label-search">Add an inventory item</label>
        <div className="scanner-label-search-box">
          <span>⌕</span><input id="scanner-label-search" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) { event.preventDefault(); add(matches[0]); } }} placeholder="Search name, tag, serial or location" autoComplete="off" />
        </div>
        {searchOpen && <div className="scanner-label-results">
          {matches.map((item) => <button key={item.id} type="button" disabled={selected.length >= MAX_LABELS} onMouseDown={(event) => event.preventDefault()} onClick={() => add(item)}>
            <span style={thumbStyle(item.model, 34, 7)} /><span><strong>{item.name}</strong><code>{item.tag}</code><small>{item.location || 'Unassigned'}{item.room ? ` · ${item.room}` : ''}</small></span><b>{selected.length >= MAX_LABELS ? 'Full' : 'Add +'}</b>
          </button>)}
          {!matches.length && <div>{available.length ? 'No additional assets match this search.' : 'No tagged inventory is available. Import or add assets first.'}</div>}
        </div>}
        <div className="scanner-label-format-note"><b>Avery 5162</b><span>US Letter · 2 columns × 7 rows</span><small>Print at 100% / Actual size. Do not use Fit to page.</small></div>
      </div>

      <div className="scanner-label-queue">
        <header><span><small>PRINT ORDER</small><strong>Selected labels</strong></span>{selected.length > 0 && <button type="button" onClick={() => setSelectedIds([])}>Clear all</button>}</header>
        <div>
          {selected.map((item, index) => <button type="button" key={item.id} onClick={() => remove(item.id)} title={`Remove ${item.name}`}><b>{String(index + 1).padStart(2, '0')}</b><span><strong>{item.name}</strong><code>{item.tag}</code></span><i>×</i></button>)}
          {Array.from({ length: MAX_LABELS - selected.length }, (_, index) => <span className="empty" key={`empty-${index}`}><b>{String(selected.length + index + 1).padStart(2, '0')}</b><small>Available position</small></span>)}
        </div>
      </div>

      <div className="scanner-label-preview-panel">
        <header><span><small>LIVE PRINT PREVIEW</small><strong>2 × 7 label sheet</strong></span><b>{selected.length ? 'Ready' : 'Empty'}</b></header>
        <div className="scanner-label-preview-stage">
          <div className={`bulk-barcode-print-sheet avery-5162-sheet scanner-label-sheet${printActive ? ' scanner-label-sheet-printing' : ''}`}>
            {selected.map((item, labelIndex) => <div key={item.id} className="bulk-barcode-label avery-5162-label" style={{ left: `${0.156 + (labelIndex % 2) * 4.188}in`, top: `${0.833 + Math.floor(labelIndex / 2) * (4 / 3)}in` }}>
              <img src="brand/msbm-lockup.png" alt="" />
              <span className="avery-5162-label-body"><strong>{item.name}</strong><BarcodeGraphic value={item.tag} height={50} width={1.5} displayValue={false} /><span>{item.tag} · {item.location || 'Unassigned'}</span></span>
            </div>)}
          </div>
          {!selected.length && <div className="scanner-label-preview-empty"><span>▥</span><strong>Your sheet is empty</strong><small>Add an inventory item to begin.</small></div>}
        </div>
        <footer><span>{MAX_LABELS - selected.length} position{MAX_LABELS - selected.length === 1 ? '' : 's'} remaining</span><button type="button" disabled={!selected.length} onClick={openPrintPreview}>Open print preview</button></footer>
      </div>
    </div>
  </section>;
}
