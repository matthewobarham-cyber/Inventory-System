import { useEffect, useMemo, useRef, useState } from 'react';
import { MODEL_BY, thumbStyle } from '../data.js';
import { BarcodeGraphic } from './BarcodeLabelModal.jsx';

const MAX_LABELS = 14;
const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const normalizeSearch = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const equipmentTypeFor = (item) => MODEL_BY[item.model]?.name || item.importedType || item.category || 'Other equipment';
const searchFieldsFor = (item) => {
  const model = MODEL_BY[item.model];
  return {
    type: normalizeSearch(`${model?.name || ''} ${model?.cat || ''} ${item.model || ''} ${item.category || ''} ${item.importedType || ''}`),
    all: normalizeSearch(`${item.name} ${item.tag} ${item.serial || ''} ${item.location || ''} ${item.room || ''} ${model?.name || ''} ${model?.cat || ''} ${item.model || ''} ${item.category || ''} ${item.importedType || ''} ${item.modelNumber || ''}`)
  };
};
const createdTimeFor = (item) => {
  const explicit = new Date(item.createdAt || '').getTime();
  if (Number.isFinite(explicit)) return explicit;
  const idTime = /^itm(\d{12,})$/i.exec(String(item.id || ''));
  return idTime ? Number(idTime[1]) : 0;
};
const recentDateLabel = (time) => new Date(time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function ScannerLabelStudio({ items, placements = [] }) {
  const [query, setQuery] = useState('');
  const [recentQuery, setRecentQuery] = useState('');
  const [sourceTab, setSourceTab] = useState('search');
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [printActive, setPrintActive] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const sheetRef = useRef(null);

  const available = useMemo(() => items.filter((item) => item.tag && !item.archived), [items]);
  const selected = useMemo(() => selectedIds.map((id) => available.find((item) => item.id === id)).filter(Boolean), [available, selectedIds]);
  const recentAssets = useMemo(() => available
    .map((item) => ({ item, createdAt: createdTimeFor(item) }))
    .filter((entry) => entry.createdAt > 0 && entry.createdAt >= Date.now() - RECENT_WINDOW_MS)
    .sort((left, right) => right.createdAt - left.createdAt), [available]);
  const filteredRecentAssets = useMemo(() => {
    const term = normalizeSearch(recentQuery);
    if (!term) return recentAssets;
    const tokens = term.split(' ').filter(Boolean).map((token) => token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token);
    return recentAssets.filter(({ item }) => {
      const fields = searchFieldsFor(item);
      return tokens.every((token) => fields.all.includes(token));
    });
  }, [recentAssets, recentQuery]);
  const placementGroups = useMemo(() => placements
    .map((placement) => ({
      placement,
      assets: available.filter((item) => item.sourcePlacementId === placement.id || (placement.assetIds || []).includes(item.id))
    }))
    .filter((group) => group.assets.length)
    .sort((left, right) => String(right.placement.placedOn || right.placement.receivedOn || '').localeCompare(String(left.placement.placedOn || left.placement.receivedOn || '')))
    .slice(0, 12), [available, placements]);
  const matches = useMemo(() => {
    const term = normalizeSearch(query);
    if (!term) return available.filter((item) => !selectedIds.includes(item.id)).slice(0, 7);
    const tokens = term.split(' ').filter(Boolean).map((token) => token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token);
    return available
      .filter((item) => !selectedIds.includes(item.id))
      .map((item) => ({ item, fields: searchFieldsFor(item) }))
      .filter(({ fields }) => tokens.every((token) => fields.all.includes(token)))
      .sort((left, right) => {
        const score = ({ item, fields }) => {
          const typeName = normalizeSearch(equipmentTypeFor(item));
          if (typeName === term) return 0;
          if (typeName.startsWith(term)) return 1;
          if (fields.type.includes(term)) return 2;
          if (normalizeSearch(item.name).startsWith(term)) return 3;
          return 4;
        };
        return score(left) - score(right) || left.item.name.localeCompare(right.item.name) || String(left.item.tag).localeCompare(String(right.item.tag));
      })
      .map(({ item }) => item);
  }, [available, query, selectedIds]);

  useEffect(() => {
    const valid = new Set(available.map((item) => item.id));
    setSelectedIds((current) => current.filter((id) => valid.has(id)).slice(0, MAX_LABELS));
  }, [available]);

  const add = (item) => {
    if (!item || selectedIds.includes(item.id) || selectedIds.length >= MAX_LABELS) return;
    setSelectedIds((current) => [...current, item.id]);
    setSearchOpen(true);
  };
  const addPlacementAssets = (assets) => {
    setSelectedIds((current) => {
      const next = [...current];
      assets.forEach((item) => { if (!next.includes(item.id) && next.length < MAX_LABELS) next.push(item.id); });
      return next;
    });
  };
  const addRecentAssets = () => addPlacementAssets(filteredRecentAssets.map((entry) => entry.item).filter((item) => !selectedIds.includes(item.id)));
  const remove = (id) => setSelectedIds((current) => current.filter((entry) => entry !== id));
  const openPrintPreview = () => {
    if (!selected.length || printActive) return;
    setPrintActive(true);
    document.body.classList.add('scanner-label-printing');
    let fallbackTimer;
    const finishPrint = () => {
      window.removeEventListener('afterprint', finishPrint);
      clearTimeout(fallbackTimer);
      document.body.classList.remove('scanner-label-printing');
      setPrintActive(false);
    };
    window.addEventListener('afterprint', finishPrint, { once: true });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        fallbackTimer = window.setTimeout(finishPrint, 60000);
        window.print();
      } catch (error) {
        finishPrint();
        window.alert(`The print preview could not be opened. ${error?.message || 'Please try again.'}`);
      }
    }));
  };

  useEffect(() => () => document.body.classList.remove('scanner-label-printing'), []);
  const downloadPdf = async () => {
    if (!selected.length || pdfBusy || !sheetRef.current) return;
    setPdfBusy(true);
    const sheet = sheetRef.current;
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
      sheet.classList.add('avery-5162-pdf-export');
      const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
      const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter', compress: true });
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 8.5, 11, undefined, 'FAST');
      doc.save(`MSBM-Custom-Barcode-Labels-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      window.alert(`The custom label PDF could not be created. ${error?.message || 'Please try again.'}`);
    } finally {
      sheet.classList.remove('avery-5162-pdf-export');
      setPdfBusy(false);
    }
  };

  return <section className="scanner-label-studio">
    <header className="scanner-label-studio-header">
      <span><small>LABEL PRODUCTION</small><strong>Build a 14-label barcode sheet</strong><p>Search inventory, arrange up to fourteen assets, and inspect the exact Avery 5162 layout before printing.</p></span>
      <div><b>{selected.length}</b><span>of {MAX_LABELS}<small>labels loaded</small></span></div>
    </header>

    <nav className="scanner-label-source-tabs" aria-label="Barcode label sources">
      <button type="button" data-active={sourceTab === 'search'} onClick={() => setSourceTab('search')}><span>⌕</span><b>Inventory search</b><small>Find any tagged asset</small></button>
      <button type="button" data-active={sourceTab === 'recent'} onClick={() => setSourceTab('recent')}><span>◷</span><b>Recents</b><small>{recentAssets.length} added in 30 days</small></button>
      <button type="button" data-active={sourceTab === 'assignment'} onClick={() => setSourceTab('assignment')}><span>＋</span><b>Assignment intake</b><small>{placementGroups.reduce((count, group) => count + group.assets.length, 0)} order assets</small></button>
    </nav>

    <div className="scanner-label-studio-grid">
      {sourceTab === 'search' && <div className="scanner-label-search-panel">
        <label htmlFor="scanner-label-search">Add an inventory item</label>
        <div className="scanner-label-search-box">
          <span>⌕</span><input id="scanner-label-search" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === 'Enter' && matches[0]) { event.preventDefault(); add(matches[0]); } }} placeholder="Search item type, category, name, tag or location" autoComplete="off" />
        </div>
        {searchOpen && <div className="scanner-label-results">
          {matches.map((item) => <button key={item.id} type="button" disabled={selected.length >= MAX_LABELS} onMouseDown={(event) => event.preventDefault()} onClick={() => add(item)}>
            <span style={thumbStyle(item.model, 34, 7)} /><span><strong>{item.name}</strong><code>{item.tag}</code><small>{equipmentTypeFor(item)} · {item.location || 'Unassigned'}{item.room ? ` · ${item.room}` : ''}</small></span><b>{selected.length >= MAX_LABELS ? 'Full' : 'Add +'}</b>
          </button>)}
          {!matches.length && <div>{available.length ? 'No additional assets match this search.' : 'No tagged inventory is available. Import or add assets first.'}</div>}
        </div>}
        <div className="scanner-label-format-note"><b>Avery 5162</b><span>US Letter · 2 columns × 7 rows</span><small>Print at 100% / Actual size. Do not use Fit to page.</small></div>
      </div>}

      {sourceTab === 'recent' && <div className="scanner-label-search-panel scanner-label-recents-panel">
        <header><span><small>LAST 30 DAYS</small><strong>Ready-to-print asset tags</strong></span>{filteredRecentAssets.some(({ item }) => !selectedIds.includes(item.id)) && <button type="button" disabled={selected.length >= MAX_LABELS} onClick={addRecentAssets}>Load newest</button>}</header>
        <p>Search every tagged asset created in the last 30 days, then add individual records or load the newest matches into the sheet.</p>
        <div className="scanner-label-search-box scanner-label-recent-search">
          <span>⌕</span><input value={recentQuery} onChange={(event) => setRecentQuery(event.target.value)} placeholder="Search recent name, tag, type, serial or location" autoComplete="off" />
          {recentQuery && <button type="button" onClick={() => setRecentQuery('')} aria-label="Clear recent asset search">×</button>}
        </div>
        <div className="scanner-label-recent-list">
          {filteredRecentAssets.map(({ item, createdAt }) => { const loaded = selectedIds.includes(item.id); return <button key={item.id} type="button" data-loaded={loaded ? 'true' : 'false'} disabled={loaded || selected.length >= MAX_LABELS} onClick={() => add(item)}>
            <span style={thumbStyle(item.model, 38, 8)} /><span><strong>{item.name}</strong><code>{item.tag}</code><small>{recentDateLabel(createdAt)}{item.createdBy ? ` · ${item.createdBy}` : ''}</small></span><b>{loaded ? 'Loaded ✓' : selected.length >= MAX_LABELS ? 'Full' : 'Add +'}</b>
          </button>; })}
          {!filteredRecentAssets.length && <div className="scanner-label-source-empty"><span>◷</span><strong>{recentAssets.length ? 'No recent assets match this search' : 'No assets added in the last 30 days'}</strong><small>{recentAssets.length ? 'Try a name, tag, equipment type, serial number, or location.' : 'Newly created tagged assets will appear here automatically.'}</small></div>}
        </div>
      </div>}

      {sourceTab === 'assignment' && <div className="scanner-label-search-panel scanner-label-assignment-panel">
        <header><span><small>ASSIGNMENT INTAKE</small><strong>Newly registered order assets</strong></span></header>
        <p>Load labels from assets registered through Pending Orders and Assignment.</p>
        <div className="scanner-label-assignment-list">
          {placementGroups.map(({ placement, assets }) => { const unloaded = assets.filter((item) => !selectedIds.includes(item.id)); return <article key={placement.id}>
            <header><span style={thumbStyle(placement.model, 38, 8)} /><span><strong>{placement.name}</strong><code>{placement.purchaseOrderNumber || placement.requisitionNumber || placement.reference || placement.id}</code></span></header>
            <div>{assets.map((item) => { const loaded = selectedIds.includes(item.id); return <button type="button" key={item.id} disabled={loaded || selected.length >= MAX_LABELS} onClick={() => addPlacementAssets([item])}><span><strong>{item.name}</strong><code>{item.tag}</code></span><b>{loaded ? 'Loaded ✓' : 'Add +'}</b></button>; })}</div>
            <footer><small>{assets.length} asset{assets.length === 1 ? '' : 's'}</small><button type="button" disabled={!unloaded.length || selected.length >= MAX_LABELS} onClick={() => addPlacementAssets(unloaded)}>Load group</button></footer>
          </article>; })}
          {!placementGroups.length && <div className="scanner-label-source-empty"><span>＋</span><strong>No Assignment assets ready</strong><small>Registered order assets will appear here automatically.</small></div>}
        </div>
      </div>}

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
          <div ref={sheetRef} className={`bulk-barcode-print-sheet avery-5162-sheet scanner-label-sheet${printActive ? ' scanner-label-sheet-printing' : ''}`}>
            {selected.map((item, labelIndex) => <div key={item.id} className="bulk-barcode-label avery-5162-label" style={{ left: `${0.156 + (labelIndex % 2) * 4.188}in`, top: `${0.833 + Math.floor(labelIndex / 2) * (4 / 3)}in` }}>
              <img src="brand/msbm-lockup.png" alt="" />
              <span className="avery-5162-label-body"><strong>{item.name}</strong><BarcodeGraphic value={item.tag} height={50} width={1.5} displayValue={false} /><span>{item.tag} · {item.location || 'Unassigned'}</span></span>
            </div>)}
          </div>
          {!selected.length && <div className="scanner-label-preview-empty"><span>▥</span><strong>Your sheet is empty</strong><small>Add an inventory item to begin.</small></div>}
        </div>
        <footer><span>{MAX_LABELS - selected.length} position{MAX_LABELS - selected.length === 1 ? '' : 's'} remaining</span><div><button type="button" className="scanner-label-pdf" disabled={!selected.length || pdfBusy} onClick={downloadPdf}>{pdfBusy ? 'Creating PDF…' : 'Download PDF'}</button><button type="button" disabled={!selected.length || pdfBusy} onClick={openPrintPreview}>Open print preview</button></div></footer>
      </div>
    </div>

    {false && <section className="scanner-placement-labels">
      <header>
        <span><small>ASSIGNMENT INTAKE</small><strong>Newly registered order assets</strong><p>Load barcodes directly from assets created through Pending Orders and Assignment—no catalogue search required.</p></span>
        <b>{placementGroups.reduce((count, group) => count + group.assets.length, 0)} ready</b>
      </header>
      <div className="scanner-placement-groups">
        {placementGroups.map(({ placement, assets }) => {
          const unloaded = assets.filter((item) => !selectedIds.includes(item.id));
          return <article key={placement.id}>
            <div className="scanner-placement-group-head">
              <span style={thumbStyle(placement.model, 48, 10)} />
              <span><small>{placement.supplier || 'Received order'}</small><strong>{placement.name}</strong><code>{placement.purchaseOrderNumber || placement.requisitionNumber || placement.reference || placement.id}</code></span>
              <em>{placement.placedOn || placement.receivedOn}</em>
            </div>
            <div className="scanner-placement-assets">
              {assets.map((item) => {
                const loaded = selectedIds.includes(item.id);
                return <button type="button" key={item.id} data-loaded={loaded ? 'true' : 'false'} disabled={loaded || selectedIds.length >= MAX_LABELS} onClick={() => addPlacementAssets([item])}><span><strong>{item.name}</strong><code>{item.tag}</code></span><b>{loaded ? 'Loaded ✓' : 'Add +'}</b></button>;
              })}
            </div>
            <footer><span>{assets.length} registered asset{assets.length === 1 ? '' : 's'} · {unloaded.length} not yet loaded</span><button type="button" disabled={!unloaded.length || selectedIds.length >= MAX_LABELS} onClick={() => addPlacementAssets(unloaded)}>{unloaded.length ? `Load ${Math.min(unloaded.length, MAX_LABELS - selectedIds.length)} label${Math.min(unloaded.length, MAX_LABELS - selectedIds.length) === 1 ? '' : 's'}` : 'All loaded'}</button></footer>
          </article>;
        })}
        {!placementGroups.length && <div className="scanner-placement-empty"><span>▥</span><strong>No Assignment assets are ready yet</strong><p>Once received equipment is registered in Assignment, its generated asset tags will appear here automatically.</p></div>}
      </div>
    </section>}
  </section>;
}
