import { longDate, money } from '../data.js';
import { IconCheck, IconX } from '../icons.jsx';

const detailStyle = { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, background: '#fff' };
const labelStyle = { fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7b8794' };
const valueStyle = { fontSize: 12.5, color: '#2f3944' };

export default function OrderDetailsModal({ order, canReceive, canGenerateInvoice, onReceive, onGenerateInvoice, onClose }) {
  if (!order) return null;
  const pending = ['Pending', 'Partially received'].includes(order.status);
  const labelConfigured = typeof order.labelsRequired === 'boolean';
  const labelsRequired = order.labelsRequired !== false;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 52, padding: 32, display: 'grid', placeItems: 'center', background: 'rgba(13,17,22,.44)' }}>
      <div style={{ width: 'min(720px,100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, overflow: 'hidden', animation: 'rise .18s ease' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eceff3' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Vendor order information</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#7b8794' }}>{order.requisitionNumber || order.reference || order.id}</span>
          </span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close order details" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 7 }}><IconX /></button>
        </div>

        <div style={{ padding: 20, overflow: 'auto' }}>
          <div style={{ padding: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, background: pending ? '#fdf6e9' : '#eaf5ee', border: '1px solid ' + (pending ? '#f1d5ad' : '#cce6d6'), borderRadius: 9 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{order.name}</span>
              <span style={{ fontSize: 11.5, color: '#5b6672' }}>{order.qty} units from {order.supplier}</span>
            </span>
            <span style={{ padding: '4px 9px', borderRadius: 999, background: '#fff', color: pending ? '#8a5209' : '#155e3f', fontSize: 10.5, fontWeight: 700 }}>{pending ? 'Restock ordered' : order.status}</span>
          </div>

          <div style={{ marginTop: 14, fontSize: 12.5, fontWeight: 600 }}>Vendor and purchase order</div>
          <div style={{ marginTop: 9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#eceff3', border: '1px solid #eceff3', borderRadius: 9, overflow: 'hidden' }}>
            {[
              ['Company / supplier', order.supplier],
              ['Vendor number', order.vendorNumber || 'Not recorded'],
              ['Vendor contact', order.vendorContact || 'Not recorded'],
              ['Vendor email', order.vendorEmail || 'Not recorded'],
              ['Vendor phone', order.vendorPhone || 'Not recorded'],
              ['Requisition number', order.requisitionNumber || order.reference || 'Legacy / direct order'],
              ['PO number', order.purchaseOrderNumber || 'Pending Oracle Banner processing'],
              ['Approved by', order.approvedBy || 'Not recorded'],
              ['Ordered by', order.orderedBy],
              ['Ordered on', longDate(order.orderedOn)],
              ['Expected delivery', longDate(order.expectedOn)],
              ['Quantity', String(order.qty)],
              ['Remaining', String(order.remainingQty ?? (pending ? order.qty : 0))],
              ['Damaged / rejected', String(order.damagedQty || 0)],
              ['Unit cost', money(order.unitCost)],
              ['Committed total', money(order.qty * order.unitCost)],
              ['Destination', `${order.location} · ${order.room}`]
            ].map(([label, value]) => <div key={label} style={detailStyle}><span style={labelStyle}>{label}</span><span style={valueStyle}>{value}</span></div>)}
          </div>

          {!!order.receiptNotes?.length && <div style={{ marginTop: 16 }}><div style={{ fontSize: 12.5, fontWeight: 600 }}>Receipt history</div>{order.receiptNotes.slice().reverse().map((receipt) => <div key={receipt.id} style={{ marginTop: 7, padding: 10, background: '#f7f9fb', borderRadius: 8, fontSize: 11.5 }}><strong>{receipt.receivedOn} · {receipt.receivedBy}</strong><span style={{ display: 'block', marginTop: 3 }}>{receipt.receivedQty} delivered · {receipt.damagedQty} damaged · {receipt.usableQty} accepted</span>{receipt.note && <span style={{ display: 'block', marginTop: 3, color: '#5b6672' }}>{receipt.note}</span>}</div>)}</div>}

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>Label configuration check</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 999, background: !labelConfigured ? '#fdf0e0' : labelsRequired ? '#e7f4ec' : '#f1f2f4', color: !labelConfigured ? '#8a5209' : labelsRequired ? '#155e3f' : '#5b6672', fontSize: 10.5, fontWeight: 700 }}>
              {labelConfigured && labelsRequired && <IconCheck size={12} color="#155e3f" />}{!labelConfigured ? 'Check configuration' : labelsRequired ? 'Configured' : 'No labels required'}
            </span>
          </div>
          <div style={{ marginTop: 9, padding: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f7f9fb', border: '1px solid #e2e7ed', borderRadius: 9 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={labelStyle}>Label format</span><span style={valueStyle}>{!labelConfigured ? 'Not recorded — confirm before receipt' : labelsRequired ? order.labelFormat : 'None'}</span></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={labelStyle}>Labels to prepare</span><span style={valueStyle}>{!labelConfigured ? 'Not recorded' : labelsRequired ? order.labelCopies : 0}</span></span>
            <span style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}><span style={labelStyle}>Label notes</span><span style={valueStyle}>{order.labelNotes || 'No special label instructions.'}</span></span>
          </div>

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={labelStyle}>Order notes</span>
            <span style={{ ...valueStyle, padding: 11, minHeight: 42, background: '#f7f9fb', border: '1px solid #eceff3', borderRadius: 8, lineHeight: 1.5 }}>{order.notes || 'No additional order notes.'}</span>
          </div>
          {!pending && (
            <div style={{ marginTop: 16, padding: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: order.invoiceGenerated ? '#eaf5ee' : '#fdf6e9', border: `1px solid ${order.invoiceGenerated ? '#cce6d6' : '#f1d5ad'}`, borderRadius: 9 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{order.invoiceGenerated ? 'Invoice generated' : 'Invoice generation required'}</span>
                <span style={{ fontSize: 11, color: '#5b6672' }}>{order.invoiceGenerated ? `${order.invoiceNumber} · ${order.invoiceGeneratedBy}` : 'Received stock requires an invoice record.'}</span>
              </span>
              {!order.invoiceGenerated && canGenerateInvoice && <button type="button" className="btn-primary" onClick={() => onGenerateInvoice(order.id)} style={{ height: 32, padding: '0 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 600 }}>Generate invoice</button>}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: 9, borderTop: '1px solid #eceff3' }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Close</button>
          {pending && canReceive && <button type="button" className="btn-primary" onClick={() => { onReceive(order.id); onClose(); }} style={{ height: 36, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>Receive order</button>}
        </div>
      </div>
    </div>
  );
}
