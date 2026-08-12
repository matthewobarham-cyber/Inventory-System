import { useMemo, useState } from 'react';
import { iso, money, thumbStyle, today } from '../data.js';
import { sortRows } from './SortableHeader.jsx';

const currentIso = () => iso(today());
const pillButton = { minHeight: 36, padding: '0 14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 999, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', transition: 'transform .14s ease, box-shadow .14s ease, background .14s ease' };

export default function PendingOrders({ orders, query, canReceive, onOpenItem, onReceive, onViewOrder, onPreviewApproval, onSendApproval, onAcknowledge }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [sort, setSort] = useState({ key: 'expected', direction: 'asc' });
  const list = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return orders.filter((order) => (statusFilter === 'All' || order.status === statusFilter) && (!q || (`${order.name} ${order.tag} ${order.supplier} ${order.vendorNumber || ''} ${order.location} ${order.room} ${order.orderedBy} ${order.requisitionNumber || order.reference || ''} ${order.purchaseOrderNumber || ''} ${order.notes || ''}`).toLowerCase().includes(q)));
  }, [orders, query, statusFilter]);
  const sorted = useMemo(() => sortRows(list, sort, { item: (row) => row.name, supplier: (row) => row.supplier, quantity: (row) => Number(row.remainingQty ?? row.qty), value: (row) => Number(row.qty || 0) * Number(row.unitCost || 0), expected: (row) => row.expectedOn }), [list, sort]);
  const openOrders = orders.filter((order) => ['Pending', 'Partially received'].includes(order.status));
  const totalUnits = openOrders.reduce((sum, order) => sum + Number(order.remainingQty ?? order.qty), 0);
  const totalValue = openOrders.reduce((sum, order) => sum + Number(order.remainingQty ?? order.qty) * Number(order.unitCost || 0), 0);
  const suppliers = new Set(openOrders.map((order) => order.supplier)).size;
  const overdue = openOrders.filter((order) => order.expectedOn < currentIso()).length;
  const statusCounts = Object.fromEntries(['Pending', 'Partially received', 'Received'].map((status) => [status, orders.filter((order) => order.status === status).length]));
  const summaries = [
    { label: 'Open orders', value: openOrders.length, note: 'Awaiting full receipt', tone: '#0a3d7c', soft: '#eaf2fb', mark: 'O' },
    { label: 'Units committed', value: totalUnits, note: 'Outstanding quantity', tone: '#6a3478', soft: '#f4ebf7', mark: 'Q' },
    { label: 'Open value', value: money(totalValue), note: 'Current commitment', tone: '#16704f', soft: '#e8f5ee', mark: '$' },
    { label: 'Delivery position', value: suppliers, note: `${overdue} overdue ${overdue === 1 ? 'delivery' : 'deliveries'}`, tone: overdue ? '#aa3a27' : '#9a650e', soft: overdue ? '#fceceb' : '#fdf3df', mark: 'D' }
  ];

  return <div className="orders-workspace">
    <section className="orders-hero">
      <span><small>Procurement control</small><h2>Pending orders</h2><p>Review approvals, vendor commitments, expected deliveries, and receiving activity in one organized queue.</p></span>
      <div><strong>{openOrders.length}</strong><small>active procurement records</small><i>{overdue ? `${overdue} require delivery attention` : 'All deliveries are within schedule'}</i></div>
    </section>

    <div className="orders-metrics">{summaries.map((summary) => <article key={summary.label} style={{ '--order-tone': summary.tone, '--order-soft': summary.soft }}><span>{summary.mark}</span><div><small>{summary.label}</small><strong>{summary.value}</strong><p>{summary.note}</p></div></article>)}</div>

    <section className="orders-toolbar">
      <div className="orders-status-filters">{['All', 'Pending', 'Partially received', 'Received'].map((status) => <button key={status} type="button" data-active={statusFilter === status} onClick={() => setStatusFilter(status)}><span>{status}</span><b>{status === 'All' ? orders.length : statusCounts[status] || 0}</b></button>)}</div>
      <label><span>Sort by</span><select value={sort.key} onChange={(event) => setSort((current) => ({ ...current, key: event.target.value }))}><option value="expected">Expected delivery</option><option value="item">Item name</option><option value="supplier">Supplier</option><option value="quantity">Quantity</option><option value="value">Order value</option></select></label>
      <button type="button" className="orders-sort-direction" onClick={() => setSort((current) => ({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }))}>{sort.direction === 'asc' ? 'Ascending ↑' : 'Descending ↓'}</button>
    </section>

    <div className="orders-list">{sorted.map((order) => {
      const late = ['Pending', 'Partially received'].includes(order.status) && order.expectedOn < currentIso();
      const remaining = Number(order.remainingQty ?? order.qty);
      const received = Math.max(0, Number(order.qty || 0) - remaining);
      const progress = Math.min(100, Math.round(received / Math.max(1, Number(order.qty || 1)) * 100));
      const pending = ['Pending', 'Partially received'].includes(order.status);
      const review = (action) => { onAcknowledge?.(order.id); action(); };
      return <article key={order.id} className="order-card" data-late={late ? 'true' : 'false'} data-workflow-unread={order.workflowUnread ? 'true' : undefined}>
        <header>
          <button type="button" className="order-item-link" onClick={() => review(() => onOpenItem(order.itemId))}>
            <span style={thumbStyle(order.model, 48, 10)} />
            <span><strong>{order.name}{order.workflowUnread && <i className="workflow-item-dot" title="New workflow item" />}</strong><small>{order.tag}</small><i>{order.location} · {order.room}</i></span>
          </button>
          <span className="order-status" data-status={order.status}>{late ? 'Overdue' : order.status}</span>
        </header>

        <div className="order-card-body">
          <div className="order-vendor-block"><small>Approved vendor</small><strong>{order.supplier}</strong><span>{order.vendorNumber || 'Vendor number not recorded'}</span>{order.vendorEmail && <span>{order.vendorEmail}</span>}</div>
          <div className="order-reference-block"><span><small>Requisition</small><strong>{order.requisitionNumber || order.reference || 'Not assigned'}</strong></span><span><small>Purchase order</small><strong>{order.purchaseOrderNumber || 'Awaiting Oracle Banner'}</strong></span></div>
          <div className="order-quantity-block"><span><small>Ordered</small><strong>{order.qty}</strong></span><span><small>Remaining</small><strong>{remaining}</strong></span><div><i style={{ width: `${progress}%` }} /></div><small>{progress}% received</small></div>
          <div className="order-value-block"><small>Committed value</small><strong>{money(Number(order.qty || 0) * Number(order.unitCost || 0))}</strong><span>{money(order.unitCost || 0)} per unit</span></div>
          <div className="order-date-block" data-late={late ? 'true' : 'false'}><small>Expected delivery</small><strong>{order.expectedOn}</strong><span>{late ? 'Delivery is overdue' : `Raised ${order.orderedOn}`}</span></div>
        </div>

        <footer>
          <div className="order-card-flags">
            <span data-tone={order.approvalPreparedAt ? 'green' : 'amber'}>{order.approvalPreparedAt ? 'Approval packet prepared' : 'Approval not yet prepared'}</span>
            <span data-tone={typeof order.labelsRequired === 'boolean' ? 'blue' : 'amber'}>{typeof order.labelsRequired === 'boolean' ? 'Label configuration checked' : 'Labels need review'}</span>
          </div>
          <div className="order-actions">
            <button type="button" onClick={() => review(() => onViewOrder(order.id))} style={{ ...pillButton, border: '1px solid #ced8e2', color: '#465666', background: '#f5f7f9' }}><b>i</b> Details</button>
            <button type="button" onClick={() => review(() => onPreviewApproval(order.id))} style={{ ...pillButton, border: '1px solid #d7c7e2', color: '#67367b', background: '#f5edf8' }}><b>PDF</b> Approval PDF</button>
            <button type="button" onClick={() => review(() => onSendApproval(order.id))} style={{ ...pillButton, border: '1px solid #8bb8dc', color: '#fff', background: 'linear-gradient(135deg,#1673b8,#0d5894)', boxShadow: '0 7px 15px -10px #0d5894' }}><b>↗</b> Send for approval</button>
            {canReceive && pending ? <button type="button" onClick={() => review(() => onReceive(order.id))} style={{ ...pillButton, border: '1px solid #71b795', color: '#fff', background: 'linear-gradient(135deg,#21825e,#156848)', boxShadow: '0 7px 15px -10px #156848' }}><b>✓</b> Receive order</button> : <span className="order-complete-pill">{order.status}</span>}
          </div>
        </footer>
      </article>;
    })}{!sorted.length && <div className="orders-empty"><span>◎</span><strong>{orders.length ? 'No orders match this view' : 'No pending orders yet'}</strong><p>{orders.length ? 'Try another status filter or search term.' : 'Reorders raised from low stock will appear here.'}</p></div>}</div>
  </div>;
}
