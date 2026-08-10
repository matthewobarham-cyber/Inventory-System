import { useEffect, useState } from 'react';
import { IconX } from '../icons.jsx';
import { BarcodeGraphic } from './BarcodeLabelModal.jsx';
import { MODELS } from '../data.js';

const EQUIPMENT_TYPES = [...MODELS].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
const sheetsOf = (labels) => Array.from({ length: Math.ceil(labels.length / 14) }, (_, index) => labels.slice(index * 14, index * 14 + 14));

export default function BlankBarcodeModal({ open, reserved, onGenerate, onDelete, onClear, onClose }) {
  const [quantity, setQuantity] = useState(14);
  const [modelId, setModelId] = useState(EQUIPMENT_TYPES[0]?.id || '');
  const [batch, setBatch] = useState([]);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  if (!open) return null;
  const generate = () => setBatch(onGenerate(quantity, modelId));
  const sheets = sheetsOf(batch);
  const deleteLabel = (tag) => {
    if (onDelete(tag)) setBatch((current) => current.filter((entry) => entry.tag !== tag));
  };
  const clearLabels = () => {
    if (onClear()) setBatch([]);
  };
  const printBatch = () => window.print();
  const savePdf = async () => {
    if (!batch.length || pdfBusy) return;
    setPdfBusy(true);
    try {
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')]);
      const sheetElements = [...document.querySelectorAll('.avery-5162-print-pages .avery-5162-sheet')];
      const doc = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter', compress: true });
      for (let index = 0; index < sheetElements.length; index += 1) {
        const sheet = sheetElements[index];
        sheet.classList.add('avery-5162-pdf-export');
        try {
          const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
          if (index > 0) doc.addPage('letter', 'portrait');
          doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 8.5, 11, undefined, 'FAST');
        } finally {
          sheet.classList.remove('avery-5162-pdf-export');
        }
      }
      doc.save(`MSBM-Avery-5162-Labels-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      window.alert(`The label PDF could not be created. ${error?.message || 'Please try again.'}`);
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="barcode-modal-backdrop" role="dialog" aria-modal="true" aria-label="Generate blank inventory barcodes">
      <div className="bulk-barcode-modal">
        <header className="barcode-modal-controls" style={{ padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #e3e8ed' }}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}><strong style={{ fontSize: 15 }}>Generate blank inventory labels</strong><span style={{ color: '#7b8794', fontSize: 11.5 }}>Reserve unique tags now, print them, then scan a label whenever new equipment arrives.</span></span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close blank label generator" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8 }}><IconX /></button>
        </header>

        <div className="barcode-modal-controls bulk-barcode-workspace" style={{ gridTemplateColumns: '330px minmax(0,1fr)' }}>
          <aside className="bulk-barcode-selector">
            <div style={{ padding: 12, border: '1px solid #cddceb', borderRadius: 9, background: '#eef5fc', color: '#244766', fontSize: 11.5, lineHeight: 1.5 }}><strong>How it works</strong><br />Every generated label receives an unused asset tag but no equipment record. Scanning it anywhere opens the registration menu with that tag already filled in.</div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#526170', fontSize: 11.5, fontWeight: 650 }}>Labels in new batch
              <input type="number" min="1" max="100" value={quantity} onChange={(event) => setQuantity(Math.min(100, Math.max(1, Number(event.target.value) || 1)))} style={{ height: 37, padding: '0 10px', border: '1px solid #cdd7e1', borderRadius: 8, fontSize: 13 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: '#526170', fontSize: 11.5, fontWeight: 650 }}>Equipment type for this batch
              <select value={modelId} onChange={(event) => setModelId(event.target.value)} style={{ height: 37, padding: '0 10px', border: '1px solid #cdd7e1', borderRadius: 8, background: '#fff', fontSize: 12 }}>
                {EQUIPMENT_TYPES.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.cat}</option>)}
              </select>
            </label>
            <div style={{ padding: 10, border: '1px solid #dfe5eb', borderRadius: 8, background: '#fff', color: '#65727f', fontSize: 10.5, lineHeight: 1.45 }}><strong>Avery 5162 format</strong><br />US Letter · 2 columns × 7 rows · 14 labels per sheet · 4″ × 1⅓″</div>
            <button type="button" className="btn-primary" disabled={!modelId} onClick={generate} style={{ height: 40, borderRadius: 8, fontWeight: 650 }}>Generate and reserve {quantity}</button>
            <div style={{ paddingTop: 12, borderTop: '1px solid #dfe5eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#63717e', fontSize: 11.5 }}><span>Unassigned labels</span><strong style={{ color: '#0a3d7c' }}>{reserved.length}</strong></div>
              <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}><button type="button" className="btn-ghost" disabled={!reserved.length} onClick={() => setBatch(reserved.slice(0, 100))} style={{ height: 34, borderRadius: 7, fontSize: 11 }}>Preview all</button><button type="button" className="btn-ghost-danger" disabled={!reserved.length} onClick={clearLabels} style={{ height: 34, borderRadius: 7, fontSize: 11 }}>Clear all</button></div>
            </div>
            <div className="bulk-barcode-list">
              {reserved.slice(0, 100).map((entry) => <div key={entry.tag} style={{ padding: '8px 9px', display: 'grid', gridTemplateColumns: '1fr minmax(70px,1fr) auto', alignItems: 'center', gap: 7, borderBottom: '1px solid #eef1f4' }}><span style={{ fontFamily: "'IBM Plex Mono',monospace", color: '#0b4a94', fontSize: 10.5 }}>{entry.tag}</span><span title={entry.equipmentType || 'Uncategorized'} style={{ overflow: 'hidden', color: '#7b8794', fontSize: 10, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.equipmentType || 'Uncategorized'}</span><button type="button" className="btn-ghost-danger" onClick={() => deleteLabel(entry.tag)} aria-label={`Delete generated label ${entry.tag}`} style={{ height: 25, padding: '0 6px', borderRadius: 5, fontSize: 9.5 }}>Delete</button></div>)}
              {!reserved.length && <div style={{ padding: 24, textAlign: 'center', color: '#7b8794', fontSize: 12 }}>No blank labels reserved yet.</div>}
            </div>
          </aside>

          <section className="bulk-barcode-preview-panel">
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #dfe5eb', background: '#fff', color: '#5f6d79', fontSize: 11.5 }}><span>Avery 5162 · US Letter preview</span><span><strong>{batch.length}</strong> labels · {sheets.length} sheet{sheets.length === 1 ? '' : 's'}</span></div>
            <div className="bulk-barcode-preview-scroll">
              <div className="avery-5162-print-pages">
                {sheets.map((sheet, sheetIndex) => <div key={sheetIndex} className="bulk-barcode-print-sheet avery-5162-sheet">
                  {sheet.map((entry, labelIndex) => <div
                    key={entry.tag}
                    className="bulk-barcode-label avery-5162-label"
                    style={{
                      left: `${0.156 + (labelIndex % 2) * 4.188}in`,
                      top: `${0.833 + Math.floor(labelIndex / 2) * (4 / 3)}in`
                    }}
                  >
                    <img src="brand/msbm-lockup.png" alt="" />
                    <span className="avery-5162-label-body"><strong>{entry.equipmentType || 'UNASSIGNED ASSET'}</strong><BarcodeGraphic value={entry.tag} height={50} width={1.5} displayValue={false} /><span>{entry.tag} · Scan to register</span></span>
                  </div>)}
                </div>)}
                {!batch.length && <div className="bulk-barcode-print-sheet avery-5162-sheet"><div className="bulk-barcode-empty">Generate a new batch or preview currently reserved labels.</div></div>}
              </div>
            </div>
          </section>
        </div>

        <footer className="barcode-modal-controls" style={{ padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 9, borderTop: '1px solid #e3e8ed' }}>
          <span style={{ flex: 1, color: '#71808e', fontSize: 11.5 }}>Print on US Letter at 100% / Actual size. Do not use “Fit to page.” Reserved labels disappear after their inventory records are saved.</span>
          <button type="button" className="btn-ghost" disabled={!batch.length} onClick={() => setBatch([])} style={{ height: 36, padding: '0 12px', borderRadius: 8 }}>Clear preview</button>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8 }}>Close</button>
          <button type="button" disabled={!batch.length || pdfBusy} onClick={savePdf} style={{ height: 36, padding: '0 15px', border: '1px solid #991b1b', borderRadius: 8, background: '#b42318', color: '#fff', fontWeight: 650, cursor: batch.length && !pdfBusy ? 'pointer' : 'not-allowed', opacity: batch.length && !pdfBusy ? 1 : .55 }}>{pdfBusy ? 'Saving PDF…' : 'Save as PDF'}</button>
          <button type="button" className="btn-primary" disabled={!batch.length} onClick={printBatch} style={{ height: 36, padding: '0 15px', borderRadius: 8, fontWeight: 650 }}>Print {batch.length} labels</button>
        </footer>
      </div>
    </div>
  );
}
