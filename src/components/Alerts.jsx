import { useMemo, useState } from 'react';
import { thumbStyle, isLowStock } from '../data.js';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';
import StocktakeFlag from './StocktakeFlag.jsx';

const shortageFor = (item) => Math.max(0, Number(item.min || 0) - Number(item.qty || 0));
const reorderFor = (item) => Math.max(1, (Number(item.min || 0) * 2) - Number(item.qty || 0));

export default function Alerts({ items, pendingOrders, pendingPlacements, canEdit, onOpenItem, onReorder, onViewOrder, onOpenPlacements }) {
  const low = items.filter(isLowStock);
  const [sort, setSort] = useState({ key: 'shortage', direction: 'desc' });
  const [filter, setFilter] = useState('All');
  const replenishmentState = (item) => pendingPlacements.some((placement) => placement.itemId === item.id) ? 'Received' : pendingOrders.some((order) => order.itemId === item.id) ? 'Ordered' : Number(item.qty || 0) === 0 ? 'Out of stock' : 'Low stock';
  const outCount = low.filter((item) => replenishmentState(item) === 'Out of stock').length;
  const lowCount = low.filter((item) => replenishmentState(item) === 'Low stock').length;
  const orderedCount = low.filter((item) => replenishmentState(item) === 'Ordered').length;
  const receivedCount = low.filter((item) => replenishmentState(item) === 'Received').length;
  const filters = [['All', low.length], ['Out of stock', outCount], ['Low stock', lowCount], ['Ordered', orderedCount], ['Received', receivedCount]];
  const filtered = useMemo(() => low.filter((item) => {
    if (filter === 'All') return true;
    const state = pendingPlacements.some((placement) => placement.itemId === item.id) ? 'Received' : pendingOrders.some((order) => order.itemId === item.id) ? 'Ordered' : Number(item.qty || 0) === 0 ? 'Out of stock' : 'Low stock';
    return state === filter;
  }), [filter, low, pendingOrders, pendingPlacements]);
  const sorted = useMemo(() => sortRows(filtered, sort, { consumable: (item) => item.name, location: (item) => item.location, onHand: (item) => Number(item.qty || 0), minimum: (item) => Number(item.min || 0), shortage: shortageFor }), [filtered, sort]);

  return (
    <div className="low-stock-workspace">
      <section className="low-stock-overview">
        <div><small>Supply assurance</small><h2>Low-stock command centre</h2><p>Prioritize shortages, see replenishment already in motion, and move received stock into service.</p></div>
        <div className="low-stock-risk"><span className={outCount ? 'risk' : 'clear'}><strong>{outCount}</strong><small>completely depleted</small></span><span><strong>{orderedCount + receivedCount}</strong><small>replenishments active</small></span></div>
      </section>

      <div className="low-stock-filter-grid">
        {filters.map(([label, value]) => <button key={label} type="button" data-active={filter === label} data-tone={label.toLowerCase().replaceAll(' ', '-')} onClick={() => setFilter(label)}><small>{label}</small><strong>{value}</strong><span>{label === 'All' ? 'Every supply risk' : label === 'Out of stock' ? 'Immediate attention' : label === 'Low stock' ? 'Below minimum' : label === 'Ordered' ? 'Vendor processing' : 'Awaiting setup'}</span></button>)}
      </div>

      <section className="low-stock-register">
        <header><span><strong>{filter === 'All' ? 'Replenishment register' : filter}</strong><small>{sorted.length} item{sorted.length === 1 ? '' : 's'} shown · click a heading to sort</small></span></header>
        <div className="low-stock-head">{[['consumable', 'Supply item'], ['location', 'Location'], ['onHand', 'On hand'], ['minimum', 'Minimum'], ['shortage', 'Shortage']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} />)}<span>Replenishment</span></div>
        {sorted.map((item) => {
          const reorderQty = reorderFor(item);
          const pendingOrder = pendingOrders.find((order) => order.itemId === item.id);
          const pendingPlacement = pendingPlacements.find((placement) => placement.itemId === item.id);
          const ratio = Number(item.min || 0) ? Math.min(100, Math.round((Number(item.qty || 0) / Number(item.min)) * 100)) : 0;
          const state = pendingPlacement ? 'received' : pendingOrder ? 'ordered' : Number(item.qty || 0) === 0 ? 'depleted' : 'low';
          return (
            <div key={item.id} className={`low-stock-row low-stock-${state}`} data-stocktake-state={item.stocktakeState || undefined}>
              <button type="button" className="low-stock-identity" onClick={() => onOpenItem(item.id)}><span style={thumbStyle(item.model, 42, 9)} /><span><strong>{item.name}<StocktakeFlag item={item} /></strong><small>{item.category || 'Consumable supply'}</small><i><b style={{ width: `${ratio}%` }} /></i></span></button>
              <span className="low-stock-location"><strong>{item.location}</strong><small>{item.room || 'Room not recorded'}</small></span>
              <strong className="low-stock-quantity">{item.qty}</strong>
              <span className="low-stock-minimum">{item.min}</span>
              <span className="low-stock-shortage">-{shortageFor(item)}</span>
              <span className="low-stock-action">
                {pendingPlacement ? <><small>Delivery received<br />Labels and placement pending</small>{canEdit && <button type="button" className="low-stock-received-button" onClick={onOpenPlacements}>Set up stock</button>}</> : pendingOrder ? <><small>Ordered · {pendingOrder.qty} units<br />Expected {pendingOrder.expectedOn}</small>{canEdit && <button type="button" className="low-stock-ordered-button" onClick={() => onViewOrder(pendingOrder.id)}>View order</button>}</> : <><small>Recommended: {reorderQty}<br />Target: {Number(item.min || 0) * 2} on hand</small>{canEdit && <button type="button" className="low-stock-reorder-button" onClick={() => onReorder(item.id, reorderQty)}>Plan reorder</button>}</>}
              </span>
            </div>
          );
        })}
        {!sorted.length && <div className="low-stock-empty"><span>✓</span><strong>{low.length ? 'No items match this replenishment view' : 'Stock levels are healthy'}</strong><small>{low.length ? 'Choose another filter to view the remaining supply risks.' : 'All tracked supplies are currently above their configured minimums.'}</small></div>}
      </section>
    </div>
  );
}
