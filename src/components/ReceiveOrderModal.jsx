export default function ReceiveOrderModal({ order, form, error, onChange, onConfirm, onClose }) {
  if (!order) return null;
  const available = Number(order.remainingQty ?? order.qty);
  return <div style={{ position: 'fixed', inset: 0, zIndex: 60, padding: 32, display: 'grid', placeItems: 'center', background: 'rgba(13,17,22,.44)' }}>
    <div style={{ width: 'min(480px,100%)', background: '#fff', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #eceff3' }}><strong>Receive order</strong><small style={{ display: 'block', marginTop: 3, color: '#7b8794' }}>{order.name} · {available} units outstanding</small></div>
      <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, fontWeight: 600 }}>Quantity delivered<input type="number" min="1" max={available} value={form.receivedQty} onChange={(event) => onChange('receivedQty', event.target.value)} style={fieldStyle} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, fontWeight: 600 }}>Damaged / rejected<input type="number" min="0" value={form.damagedQty} onChange={(event) => onChange('damagedQty', event.target.value)} style={fieldStyle} /></label>
        <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, fontWeight: 600 }}>Receipt note<textarea rows="3" value={form.note} onChange={(event) => onChange('note', event.target.value)} placeholder="Delivery reference, damage details, or discrepancy note" style={{ ...fieldStyle, height: 78, padding: 10, resize: 'vertical' }} /></label>
        {error && <div style={{ gridColumn: 'span 2', padding: '9px 11px', background: '#fdeceb', color: '#a01a12', borderRadius: 8, fontSize: 11.5 }}>{error}</div>}
      </div>
      <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: 9, borderTop: '1px solid #eceff3' }}><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" onClick={onConfirm}>Record receipt</button></div>
    </div>
  </div>;
}

const fieldStyle = { height: 38, padding: '0 10px', border: '1px solid #dfe3e9', borderRadius: 8, background: '#f8f9fb', fontSize: 13 };
