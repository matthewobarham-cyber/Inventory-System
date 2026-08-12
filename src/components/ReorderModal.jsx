import { money, thumbStyle } from '../data.js';
import { IconX } from '../icons.jsx';

const fieldStyle = { height: 38, padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 13, outline: 'none' };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6 };
const captionStyle = { fontSize: 11.5, fontWeight: 600, color: '#3f4a56' };

export default function ReorderModal({ open, item, form, error, vendors = [], directOrder = false, onChange, onSubmit, onClose }) {
  if (!open || !item) return null;

  const set = (key) => (event) => onChange(key, event.target.value);
  const qty = Math.max(0, parseInt(form.qty, 10) || 0);
  const unitCost = Math.max(0, parseFloat(form.unitCost) || 0);
  const onHand = Math.max(0, Number(item.qty || 0));
  const minimum = Math.max(0, Number(item.min || 0));
  const shortage = Math.max(0, minimum - onHand);
  const targetLevel = Math.max(minimum, minimum * 2);
  const recommended = Math.max(1, targetLevel - onHand);
  const projected = onHand + qty;
  const projectedPercent = minimum ? Math.min(100, Math.round((projected / Math.max(1, targetLevel)) * 100)) : 100;
  const deliveryDate = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    onChange('expectedOn', date.toISOString().slice(0, 10));
  };

  return (
    <div className="reorder-modal-backdrop">
      <div className="reorder-modal-card">
        <div className="reorder-modal-header">
          <span><small>PROCUREMENT WORKFLOW</small><strong>{directOrder ? 'Create pending order' : 'Plan stock replenishment'}</strong><p>Review the stock position, choose an approved supplier and confirm the requirement.</p></span>
          <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close reorder form" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 7 }}>
            <IconX />
          </button>
        </div>

        <div className="reorder-modal-body">
          <div className="reorder-item-summary">
            <span style={thumbStyle(item.model, 44, 7)}></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.name}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#7b8794' }}>{item.tag} · {item.location} · {item.room}</span>
            </span>
            <b className={onHand === 0 ? 'depleted' : ''}>{onHand === 0 ? 'OUT OF STOCK' : 'LOW STOCK'}</b>
          </div>

          <section className="reorder-stock-plan">
            <header><span><small>STOCK POSITION</small><strong>Replenishment forecast</strong></span><em>Recommended order: {recommended}</em></header>
            <div><span><small>On hand</small><strong>{onHand}</strong></span><span><small>Minimum</small><strong>{minimum}</strong></span><span><small>Shortfall</small><strong className="danger">{shortage}</strong></span><span><small>After delivery</small><strong className="success">{projected}</strong></span></div>
            <i><b style={{ width: `${projectedPercent}%` }} /></i>
            <p>{projected < minimum ? `This order still leaves stock ${minimum - projected} below minimum.` : projected < targetLevel ? 'This restores minimum stock, but remains below the recommended reserve.' : `This restores the recommended reserve of ${targetLevel}.`}</p>
          </section>

          <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Approved vendor</span>
            <select value={form.vendorId || ''} onChange={set('vendorId')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option value="">Select an approved vendor</option>
              {vendors.filter((vendor) => vendor.approved !== false).sort((a, b) => a.name.localeCompare(b.name)).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name} — {vendor.vendorNumber}</option>)}
            </select>
            {!vendors.some((vendor) => vendor.approved !== false) && <span style={{ fontSize: 11, color: '#a01a12' }}>No active vendors are configured. Add one in Settings → Approved vendors.</span>}
          </label>

          <label style={labelStyle}>
            <span style={captionStyle}>Vendor name</span>
            <input value={form.supplier || ''} readOnly style={{ ...fieldStyle, color: '#4e5b68' }} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Vendor number</span>
            <input value={form.vendorNumber || ''} readOnly style={{ ...fieldStyle, color: '#0a3d7c', fontFamily: "'IBM Plex Mono',monospace" }} />
          </label>

          <label style={labelStyle}>
            <span style={captionStyle}>Vendor contact name</span>
            <input value={form.vendorContact || ''} readOnly placeholder="Not recorded" style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Vendor phone</span>
            <input value={form.vendorPhone || ''} readOnly placeholder="Not recorded" style={fieldStyle} />
          </label>
          <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Vendor email</span>
            <input type="email" value={form.vendorEmail || ''} readOnly placeholder="Not recorded" style={fieldStyle} />
          </label>

          <label style={labelStyle}>
            <span style={captionStyle}>Quantity to order</span>
            <div className="reorder-quantity-control"><button type="button" onClick={() => onChange('qty', Math.max(1, qty - 1))}>−</button><input type="number" min="1" step="1" value={form.qty || ''} onChange={set('qty')} /><button type="button" onClick={() => onChange('qty', qty + 1)}>+</button></div>
            <span className="reorder-presets"><button type="button" onClick={() => onChange('qty', Math.max(1, shortage))}>Cover shortage</button><button type="button" onClick={() => onChange('qty', recommended)}>Recommended {recommended}</button></span>
          </label>

          <label style={labelStyle}>
            <span style={captionStyle}>Unit cost (JMD)</span>
            <input type="number" min="0" step="0.01" value={form.unitCost ?? ''} onChange={set('unitCost')} style={fieldStyle} />
          </label>

          <label style={labelStyle}>
            <span style={captionStyle}>Expected delivery</span>
            <input type="date" value={form.expectedOn || ''} onChange={set('expectedOn')} style={fieldStyle} />
            <span className="reorder-presets"><button type="button" onClick={() => deliveryDate(7)}>7 days</button><button type="button" onClick={() => deliveryDate(14)}>14 days</button><button type="button" onClick={() => deliveryDate(30)}>30 days</button></span>
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Requisition number</span>
            <input value={form.requisitionNumber || ''} onChange={set('requisitionNumber')} placeholder="REQ-..." style={{ ...fieldStyle, fontFamily: "'IBM Plex Mono',monospace" }} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>PO number</span>
            <input value={form.purchaseOrderNumber || ''} onChange={set('purchaseOrderNumber')} placeholder="Assigned after Oracle Banner approval" style={{ ...fieldStyle, fontFamily: "'IBM Plex Mono',monospace" }} />
          </label>

          <div style={{ gridColumn: 'span 2', padding: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f7f9fb', border: '1px solid #e2e7ed', borderRadius: 9 }}>
            <label style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.labelsRequired !== false} onChange={(event) => onChange('labelsRequired', event.target.checked)} />
              Prepare labels when this order is received
            </label>
            {form.labelsRequired !== false && (
              <>
                <label style={labelStyle}>
                  <span style={captionStyle}>Label format</span>
                  <select value={form.labelFormat || 'Individual asset barcode per unit'} onChange={set('labelFormat')} style={{ ...fieldStyle, cursor: 'pointer' }}>
                    <option>Individual asset barcode per unit</option>
                    <option>Stock / bin barcode label</option>
                    <option>Location label only</option>
                  </select>
                </label>
                <label style={labelStyle}>
                  <span style={captionStyle}>Labels to prepare</span>
                  <input type="number" min="1" step="1" value={form.labelCopies || 1} onChange={set('labelCopies')} style={fieldStyle} />
                </label>
                <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
                  <span style={captionStyle}>Label instructions</span>
                  <input value={form.labelNotes || ''} onChange={set('labelNotes')} placeholder="Size, printer, placement, or other label requirements" style={fieldStyle} />
                </label>
              </>
            )}
          </div>

          <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Order notes</span>
            <textarea value={form.notes || ''} onChange={set('notes')} rows={3} placeholder="Delivery instructions, contact details, quotation number, or other requirements"
              style={{ ...fieldStyle, height: 76, resize: 'vertical', padding: 10, lineHeight: 1.45 }} />
          </label>

          <div className="reorder-total-card">
            <span><small>Estimated commitment</small><strong>{qty} × {money(unitCost)}</strong></span>
            <b>{money(qty * unitCost)}</b>
          </div>

          {!!error && (
            <div style={{ gridColumn: 'span 2', padding: '9px 12px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 8, color: '#a01a12', fontSize: 12 }}>{error}</div>
          )}
        </div>

        <div className="reorder-modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Cancel</button>
          <button type="button" className="btn-primary reorder-submit" onClick={onSubmit}>{directOrder ? 'Create pending order' : 'Submit requisition for approval'} →</button>
        </div>
      </div>
    </div>
  );
}
