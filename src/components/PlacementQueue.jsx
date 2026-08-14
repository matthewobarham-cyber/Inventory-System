import { useMemo, useState } from 'react';
import { money, thumbStyle } from '../data.js';
import { sortRows } from './SortableHeader.jsx';
import BarcodeLabelModal from './BarcodeLabelModal.jsx';
import BulkBarcodeModal from './BulkBarcodeModal.jsx';

const dateLabel = (value) => {
  if (!value) return 'Not recorded';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function PlacementQueue({ placements, items = [], query, canSetUp, onSetUp, onAcknowledge }) {
  const [statusFilter, setStatusFilter] = useState('Pending');
  const [sort, setSort] = useState({ key: 'received', direction: 'desc' });
  const [barcodeItems, setBarcodeItems] = useState([]);

  const pending = useMemo(() => placements.filter((entry) => entry.status === 'Pending'), [placements]);
  const placed = useMemo(() => placements.filter((entry) => entry.status === 'Placed'), [placements]);
  const totalUnits = pending.reduce((sum, entry) => sum + Number(entry.remainingQty || 0), 0);
  const totalValue = pending.reduce((sum, entry) => sum + Number(entry.remainingQty || 0) * Number(entry.unitCost || 0), 0);
  const suppliers = new Set(pending.map((entry) => entry.supplier).filter(Boolean)).size;

  const list = useMemo(() => {
    const needle = String(query || '').trim().toLowerCase();
    return sortRows(
      placements.filter((entry) => entry.status === statusFilter && (!needle || (
        `${entry.name} ${entry.supplier} ${entry.reference || ''} ${entry.requisitionNumber || ''} ${entry.purchaseOrderNumber || ''} ${entry.location} ${entry.room} ${entry.receivedBy}`
      ).toLowerCase().includes(needle))),
      sort,
      {
        item: (row) => row.name,
        supplier: (row) => row.supplier,
        quantity: (row) => Number(row.remainingQty || 0),
        received: (row) => row.receivedOn,
        location: (row) => `${row.location} ${row.room}`,
        value: (row) => Number(row.remainingQty || 0) * Number(row.unitCost || 0)
      }
    );
  }, [placements, query, statusFilter, sort]);

  const linkedAssets = (placement) => items.filter((asset) => (placement.assetIds || []).includes(asset.id) || asset.sourcePlacementId === placement.id);
  const selectStatus = (status) => setStatusFilter(status);

  return <div className="assignment-workspace">
    <section className="assignment-hero">
      <div className="assignment-hero-copy">
        <small>RECEIVING &amp; DEPLOYMENT</small>
        <h2>Assignment control centre</h2>
        <p>Convert received deliveries into tagged, located and deployment-ready inventory records.</p>
        <span><b>{suppliers}</b> supplier{suppliers === 1 ? '' : 's'} represented in the active intake queue</span>
      </div>
      <div className="assignment-pipeline" aria-label={`${totalUnits} units awaiting assignment`}>
        <span><i>1</i><small>Received</small></span>
        <b />
        <span className={totalUnits ? 'active' : ''}><i>2</i><small>Configure</small></span>
        <b />
        <span className={!totalUnits ? 'complete' : ''}><i>3</i><small>Ready</small></span>
        <strong>{totalUnits}<small>units remaining</small></strong>
      </div>
    </section>

    <section className="assignment-summary-grid">
      <button type="button" data-tone="rose" data-active={statusFilter === 'Pending'} onClick={() => selectStatus('Pending')}>
        <i aria-hidden="true">⌁</i><span><small>Awaiting setup</small><strong>{pending.length}</strong><em>Received delivery groups</em></span>
      </button>
      <button type="button" data-tone="blue" data-active={statusFilter === 'Pending'} onClick={() => selectStatus('Pending')}>
        <i aria-hidden="true">#</i><span><small>Items to assign</small><strong>{totalUnits}</strong><em>Individual records remaining</em></span>
      </button>
      <button type="button" data-tone="amber" data-active={statusFilter === 'Pending'} onClick={() => selectStatus('Pending')}>
        <i aria-hidden="true">$</i><span><small>Intake value</small><strong>{money(totalValue)}</strong><em>Value awaiting capitalization</em></span>
      </button>
      <button type="button" data-tone="green" data-active={statusFilter === 'Placed'} onClick={() => selectStatus('Placed')}>
        <i aria-hidden="true">✓</i><span><small>Completed setup</small><strong>{placed.length}</strong><em>Ready inventory batches</em></span>
      </button>
    </section>

    <section className="assignment-toolbar">
      <div className="assignment-status-tabs">
        {['Pending', 'Placed'].map((status) => <button key={status} type="button" data-active={statusFilter === status} onClick={() => selectStatus(status)}>{status === 'Pending' ? 'Awaiting setup' : 'Completed'}<span>{status === 'Pending' ? pending.length : placed.length}</span></button>)}
      </div>
      <span className="assignment-result-count">{list.length} delivery group{list.length === 1 ? '' : 's'}</span>
      <label>Sort by<select value={sort.key} onChange={(event) => setSort((current) => ({ ...current, key: event.target.value }))}><option value="received">Received date</option><option value="item">Item name</option><option value="supplier">Supplier</option><option value="quantity">Remaining quantity</option><option value="location">Destination</option><option value="value">Remaining value</option></select></label>
      <button type="button" className="assignment-sort-direction" onClick={() => setSort((current) => ({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc' }))} aria-label={`Sort ${sort.direction === 'asc' ? 'descending' : 'ascending'}`}>{sort.direction === 'asc' ? '↑' : '↓'}</button>
    </section>

    <section className="assignment-card-grid">
      {list.map((placement) => {
        const linked = linkedAssets(placement);
        const receivedQty = Math.max(Number(placement.receivedQty || 0), Number(placement.remainingQty || 0) + linked.length);
        const remainingQty = Number(placement.remainingQty || 0);
        const configuredQty = Math.max(0, receivedQty - remainingQty);
        const completion = receivedQty ? Math.min(100, Math.round((configuredQty / receivedQty) * 100)) : placement.status === 'Placed' ? 100 : 0;
        const reference = placement.purchaseOrderNumber || placement.requisitionNumber || placement.reference || placement.orderId;
        return <article key={placement.id} className="assignment-card" data-status={placement.status.toLowerCase()} data-workflow-unread={placement.workflowUnread ? 'true' : undefined}>
          <header>
            <span className="assignment-item-thumb" style={thumbStyle(placement, 64, 13)} />
            <span className="assignment-item-title"><small>{placement.model?.replaceAll('-', ' ') || 'Received equipment'}</small><strong>{placement.name}{placement.workflowUnread && <i className="workflow-item-dot" title="New assignment item" />}</strong><code>{reference}</code></span>
            <span className="assignment-status-pill">{placement.status === 'Pending' ? 'Setup required' : 'Ready'}</span>
          </header>

          <div className="assignment-progress">
            <span><small>{placement.status === 'Pending' ? 'Intake progress' : 'Assignment completed'}</small><strong>{configuredQty} of {receivedQty} configured</strong></span>
            <b>{completion}%</b>
            <i><em style={{ width: `${completion}%` }} /></i>
          </div>

          <div className="assignment-detail-grid">
            <span><small>Supplier</small><strong>{placement.supplier || 'Not recorded'}</strong></span>
            <span><small>Received</small><strong>{dateLabel(placement.receivedOn)}</strong><em>by {placement.receivedBy || 'not recorded'}</em></span>
            <span><small>Destination</small><strong>{placement.location || 'Unassigned'}</strong><em>{placement.room || 'Room not recorded'}</em></span>
            <span><small>{placement.status === 'Pending' ? 'Remaining value' : 'Received value'}</small><strong>{money((placement.status === 'Pending' ? remainingQty : receivedQty) * Number(placement.unitCost || 0))}</strong><em>{money(placement.unitCost || 0)} per unit</em></span>
          </div>

          <div className="assignment-flags">
            <span data-tone={placement.labelsRequired === false ? 'neutral' : 'blue'}>{placement.labelsRequired === false ? 'Labels not required' : placement.labelFormat || 'Barcode labels required'}</span>
            <span data-tone={placement.invoiceGenerated ? 'green' : 'amber'}>{placement.invoiceGenerated ? `Invoice ${placement.invoiceNumber || 'generated'}` : 'Invoice pending'}</span>
            {!!placement.damagedQty && <span data-tone="red">{placement.damagedQty} damaged</span>}
          </div>

          <footer>
            <span>{placement.status === 'Pending' ? <><strong>{remainingQty}</strong><small>unit{remainingQty === 1 ? '' : 's'} still need a tag, location and assignment</small></> : <><strong>{linked.length}</strong><small>linked inventory record{linked.length === 1 ? '' : 's'} ready for use</small></>}</span>
            {canSetUp && placement.status === 'Pending' ? <button type="button" className="assignment-setup-button" onClick={() => { onAcknowledge?.(placement.id); onSetUp(placement.id); }}><b>+</b> Set up next {remainingQty > 1 ? `(${remainingQty} left)` : 'asset'} <i>→</i></button> : !!linked.length && <button type="button" className="assignment-barcode-button" onClick={() => setBarcodeItems(linked)}><b>▥</b> Generate barcode{linked.length > 1 ? 's' : ''}</button>}
          </footer>
        </article>;
      })}
      {!list.length && <div className="assignment-empty"><span>{statusFilter === 'Pending' ? '✓' : '⌁'}</span><strong>{placements.length ? `No ${statusFilter.toLowerCase()} assignments match this view` : 'The intake queue is clear'}</strong><p>{placements.length ? 'Clear the search or choose the other status to see more delivery records.' : 'Received equipment will appear here when it is ready for labeling and placement.'}</p></div>}
    </section>

    {barcodeItems.length === 1 && <BarcodeLabelModal open item={barcodeItems[0]} onClose={() => setBarcodeItems([])} />}
    {barcodeItems.length > 1 && <BulkBarcodeModal open items={barcodeItems} onClose={() => setBarcodeItems([])} />}
  </div>;
}
