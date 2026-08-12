import { useMemo, useState } from 'react';
import { money, thumbStyle } from '../data.js';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';
import BarcodeLabelModal from './BarcodeLabelModal.jsx';
import BulkBarcodeModal from './BulkBarcodeModal.jsx';

export default function PlacementQueue({ placements, items = [], query, canSetUp, onSetUp, onAcknowledge }) {
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [sort, setSort] = useState({ key: 'received', direction: 'desc' });
  const [barcodeItems, setBarcodeItems] = useState([]);
  const list = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    return placements.filter((item) => item.status === statusFilter && (!q || (
      `${item.name} ${item.supplier} ${item.reference || ''} ${item.location} ${item.room} ${item.receivedBy}`
    ).toLowerCase().includes(q)));
  }, [placements, query, statusFilter]);
  const sorted = useMemo(() => sortRows(list, sort, { item: (row) => row.name, supplier: (row) => row.supplier, quantity: (row) => Number(row.remainingQty || 0), received: (row) => row.receivedOn, location: (row) => `${row.location} ${row.room}` }), [list, sort]);
  const pending = placements.filter((item) => item.status === 'Pending');
  const totalUnits = pending.reduce((sum, item) => sum + item.remainingQty, 0);
  const totalValue = pending.reduce((sum, item) => sum + item.remainingQty * item.unitCost, 0);
  const suppliers = new Set(pending.map((item) => item.supplier)).size;
  const summaries = [
    { label: 'Awaiting setup', value: String(placements.length), note: 'Received deliveries' },
    { label: 'Items to assign', value: String(totalUnits), note: 'Units not yet added' },
    { label: 'Received value', value: money(totalValue), note: 'Remaining intake value' },
    { label: 'Suppliers', value: String(suppliers), note: 'Across pending intake' }
  ];
  const linkedAssets = (placement) => items.filter((asset) => (placement.assetIds || []).includes(asset.id) || asset.sourcePlacementId === placement.id);

  return (
    <div style={{ maxWidth: 1280, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {summaries.map((summary) => (
          <div key={summary.label} style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7b8794' }}>{summary.label}</span>
            <span style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-.03em', lineHeight: 1 }}>{summary.value}</span>
            <span style={{ fontSize: 11.5, color: '#7b8794' }}>{summary.note}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>{['Pending', 'Placed'].map((status) => <button key={status} type="button" className={statusFilter === status ? 'btn-primary' : 'btn-ghost'} onClick={() => setStatusFilter(status)} style={{ height: 32, padding: '0 11px', borderRadius: 7, fontSize: 11.5 }}>{status}</button>)}</div>

      <div style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr .7fr 1fr 1.2fr .9fr', gap: 12, padding: '10px 16px', background: '#f7f9fb', borderBottom: '1px solid #dfe3e9', fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7b8794' }}>
          {[['item', 'Received item'], ['supplier', 'Supplier'], ['quantity', 'Quantity'], ['received', 'Received'], ['location', 'Suggested location']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} />)}<span></span>
        </div>
        {sorted.map((item) => (
          <div key={item.id} data-row="1" data-workflow-unread={item.workflowUnread ? 'true' : undefined} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr .7fr 1fr 1.2fr .9fr', gap: 12, alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #f2f4f7', fontSize: 12.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={thumbStyle(item.model, 34, 6)}></span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}{item.workflowUnread && <i className="workflow-item-dot" title="New workflow item" />}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#7b8794' }}>{item.reference || item.orderId}</span>
              </span>
            </span>
            <span style={{ color: '#3f4a56' }}>{item.supplier}</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}>{item.remainingQty}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>{item.receivedOn}</span>
              <span style={{ fontSize: 10.5, color: '#7b8794' }}>by {item.receivedBy}</span>
            </span>
            <span style={{ color: '#3f4a56' }}>{item.location} · {item.room}</span>
            <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {canSetUp && item.status === 'Pending' ? (
                <button type="button" className="btn-primary" onClick={() => { onAcknowledge?.(item.id); onSetUp(item.id); }} style={{ height: 30, padding: '0 11px', borderRadius: 7, fontSize: 11.5, fontWeight: 600 }}>Set up asset</button>
              ) : <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ padding: '3px 8px', borderRadius: 999, background: '#f1f2f4', color: '#5b6672', fontSize: 10.5, fontWeight: 600 }}>{item.status}</span>
                {!!linkedAssets(item).length && <button type="button" className="btn-primary" onClick={() => setBarcodeItems(linkedAssets(item))} style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 11 }}>Generate barcode{linkedAssets(item).length > 1 ? 's' : ''}</button>}
              </span>}
            </span>
          </div>
        ))}
        {list.length === 0 && (
          <div style={{ padding: 44, textAlign: 'center', fontSize: 13, color: '#7b8794' }}>{placements.length === 0 ? 'No received items are waiting to be labeled and placed.' : 'No received items match your search.'}</div>
        )}
      </div>
      {barcodeItems.length === 1 && <BarcodeLabelModal open item={barcodeItems[0]} onClose={() => setBarcodeItems([])} />}
      {barcodeItems.length > 1 && <BulkBarcodeModal open items={barcodeItems} onClose={() => setBarcodeItems([])} />}
    </div>
  );
}
