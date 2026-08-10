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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,22,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 45 }}>
      <div style={{ width: '100%', maxWidth: 620, background: '#fff', borderRadius: 12, overflow: 'hidden', animation: 'rise .18s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eceff3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{directOrder ? 'Create pending order' : 'Raise reorder requisition'}</span>
          <button type="button" onClick={onClose} className="btn-ghost" aria-label="Close reorder form" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 7 }}>
            <IconX />
          </button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxHeight: '68vh', overflow: 'auto' }}>
          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#f7f9fb', border: '1px solid #eceff3', borderRadius: 9 }}>
            <span style={thumbStyle(item.model, 44, 7)}></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{item.name}</span>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#7b8794' }}>{item.tag} · {item.location} · {item.room}</span>
            </span>
          </div>

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
            <input type="number" min="1" step="1" value={form.qty || ''} onChange={set('qty')} style={fieldStyle} />
          </label>

          <label style={labelStyle}>
            <span style={captionStyle}>Unit cost (JMD)</span>
            <input type="number" min="0" step="0.01" value={form.unitCost ?? ''} onChange={set('unitCost')} style={fieldStyle} />
          </label>

          <label style={labelStyle}>
            <span style={captionStyle}>Expected delivery</span>
            <input type="date" value={form.expectedOn || ''} onChange={set('expectedOn')} style={fieldStyle} />
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

          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 12px', background: '#eef4fb', border: '1px solid #d5e2f1', borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: '#3f4a56' }}>Estimated order total</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 14, fontWeight: 600, color: '#0a3d7c' }}>{money(qty * unitCost)}</span>
          </div>

          {!!error && (
            <div style={{ gridColumn: 'span 2', padding: '9px 12px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 8, color: '#a01a12', fontSize: 12 }}>{error}</div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #eceff3', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onSubmit} style={{ height: 36, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>{directOrder ? 'Create pending order' : 'Submit for approval'}</button>
        </div>
      </div>
    </div>
  );
}
