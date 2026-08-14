import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { IconX } from '../icons.jsx';

export function BarcodeGraphic({ value, height = 54, width = 2, displayValue = true }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    const svg = svgRef.current;
    try {
      svg.removeAttribute('data-barcode-error');
      JsBarcode(svg, String(value), {
        format: 'CODE128',
        lineColor: '#111820',
        background: '#ffffff',
        width,
        height,
        margin: 0,
        marginBottom: displayValue ? 12 : 0,
        displayValue,
        font: 'IBM Plex Mono',
        fontSize: 14,
        textMargin: 6
      });
    } catch (error) {
      svg.replaceChildren();
      svg.setAttribute('data-barcode-error', 'true');
      svg.setAttribute('viewBox', '0 0 240 56');
      const message = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      message.setAttribute('x', '120');
      message.setAttribute('y', '31');
      message.setAttribute('text-anchor', 'middle');
      message.textContent = 'Barcode preview unavailable';
      svg.appendChild(message);
      console.error('Barcode rendering failed', error);
    }
  }, [value, height, width, displayValue]);

  return <svg ref={svgRef} role="img" aria-label={`Barcode for ${value}`} style={{ display: 'block', maxWidth: '100%', height: 'auto', overflow: 'visible' }} />;
}

export default function BarcodeLabelModal({ open, item, onClose, onAddToPrintSheet, isInPrintSheet = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !item) return null;

  return (
    <div className="barcode-modal-backdrop" role="dialog" aria-modal="true" aria-label={`Barcode label for ${item.name}`}>
      <div className="barcode-modal-card">
        <div className="barcode-modal-controls" style={{ padding: '15px 18px', borderBottom: '1px solid #eceff3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Barcode label preview</span>
            <span style={{ fontSize: 11.5, color: '#7b8794' }}>The barcode identifies this asset by its unique tag.</span>
          </div>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close barcode preview" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 7 }}><IconX /></button>
        </div>

        <div style={{ padding: 28, background: '#f5f6f8', display: 'grid', placeItems: 'center' }}>
          <div className="barcode-print-sheet">
            <img src="brand/msbm-lockup.png" alt="Mona School of Business & Management" className="barcode-label-logo" />
            <div className="barcode-label-name">{item.name}</div>
            <BarcodeGraphic value={item.tag} height={66} width={2.2} />
            <div className="barcode-label-meta">
              <span>Serial: {item.serial || 'Not recorded'}</span>
              <span>{item.location} · {item.room}</span>
            </div>
          </div>
        </div>

        <div className="barcode-modal-controls" style={{ padding: '14px 18px', borderTop: '1px solid #eceff3', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Close</button>
          {onAddToPrintSheet && <button
            type="button"
            className="btn-ghost"
            disabled={isInPrintSheet}
            onClick={() => onAddToPrintSheet(item)}
            style={{ height: 36, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}
          >{isInPrintSheet ? 'Added to print sheet' : 'Add to Scanner Console'}</button>}
          <button type="button" className="btn-primary" onClick={() => window.print()} style={{ height: 36, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>Open print preview</button>
        </div>
      </div>
    </div>
  );
}
