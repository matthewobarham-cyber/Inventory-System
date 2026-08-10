import { useMemo, useState } from 'react';
import { money, isLowStock } from '../data.js';
import { bookValueFor, expectedReplacementFor } from '../lifecycle.js';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';
import { generateManagementReportPdf } from '../report-pdf.js';

const todayIso = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const quantity = (item) => {
  const value = Number(item.qty);
  return Number.isFinite(value) ? Math.max(0, value) : 1;
};
const dateOnly = (value) => String(value || '').slice(0, 10);
const inPeriod = (value, from, to) => {
  const date = dateOnly(value);
  return !!date && date >= from && date <= to;
};
const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;

export default function Reports({ items = [], history = [], tickets = [], orders = [], procurementRecords = [] }) {
  const [tab, setTab] = useState('overview');
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(todayIso());
  const [asOf, setAsOf] = useState(todayIso());
  const [category, setCategory] = useState('All categories');
  const [location, setLocation] = useState('All locations');
  const [status, setStatus] = useState('All statuses');
  const [assetSort, setAssetSort] = useState({ key: 'bookValue', direction: 'desc' });
  const [expenseSort, setExpenseSort] = useState({ key: 'date', direction: 'desc' });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [pdfSections, setPdfSections] = useState({ overview: true, categories: true, locations: false, assets: false, maintenance: true, commitments: true });
  const [assetDetail, setAssetDetail] = useState('exceptions');

  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const locations = useMemo(() => [...new Set(items.map((item) => item.location).filter(Boolean))].sort(), [items]);
  const statuses = useMemo(() => [...new Set(items.map((item) => item.status).filter(Boolean))].sort(), [items]);
  const asOfDate = useMemo(() => {
    const date = new Date(`${asOf}T23:59:59`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }, [asOf]);

  const scopedItems = useMemo(() => items.filter((item) => {
    if (item.archived) return false;
    if (dateOnly(item.purchased) && dateOnly(item.purchased) > asOf) return false;
    if (category !== 'All categories' && item.category !== category) return false;
    if (location !== 'All locations' && item.location !== location) return false;
    if (status !== 'All statuses' && item.status !== status) return false;
    return true;
  }), [items, asOf, category, location, status]);

  const assetRows = useMemo(() => scopedItems.map((item) => {
    const units = quantity(item);
    const costBasis = Number(item.cost || 0) * units;
    const bookValue = item.consumable ? costBasis : bookValueFor(item, asOfDate) * units;
    const salvage = Math.min(costBasis, Number(item.salvageValue || 0) * units);
    const annualDepreciation = item.consumable || (item.depreciationMethod || 'Straight-line') === 'None' ? 0 : Math.max(0, costBasis - salvage) / Math.max(1, Number(item.usefulLifeYears) || 5);
    return { ...item, units, costBasis, bookValue, accountingClass: item.consumable ? 'Inventory stock' : 'Fixed asset', accumulatedDepreciation: Math.max(0, costBasis - bookValue), annualDepreciation, replacementDate: item.consumable ? '' : expectedReplacementFor(item) };
  }), [scopedItems, asOfDate]);

  const sortedAssets = useMemo(() => sortRows(assetRows, assetSort, {
    asset: (row) => `${row.name} ${row.tag}`, category: (row) => row.category, status: (row) => row.status,
    acquired: (row) => row.purchased, costBasis: (row) => row.costBasis, depreciation: (row) => row.accumulatedDepreciation,
    bookValue: (row) => row.bookValue, replacement: (row) => row.replacementDate
  }), [assetRows, assetSort]);

  const scopedIds = useMemo(() => new Set(scopedItems.map((item) => item.id)), [scopedItems]);
  const periodTickets = useMemo(() => tickets.filter((ticket) => scopedIds.has(ticket.itemId) && inPeriod(ticket.updatedAt || ticket.createdAt, from, to)), [tickets, scopedIds, from, to]);
  const expenseRows = useMemo(() => periodTickets.map((ticket) => ({
    ...ticket, date: dateOnly(ticket.updatedAt || ticket.createdAt), parts: Number(ticket.partsCost || 0), labor: Number(ticket.laborCost || 0), total: Number(ticket.partsCost || 0) + Number(ticket.laborCost || 0)
  })), [periodTickets]);
  const sortedExpenses = useMemo(() => sortRows(expenseRows, expenseSort, {
    date: (row) => row.date, ticket: (row) => row.id, asset: (row) => row.itemName, vendor: (row) => row.vendor, status: (row) => row.status, total: (row) => row.total
  }), [expenseRows, expenseSort]);

  const periodLoans = useMemo(() => history.filter((entry) => scopedIds.has(entry.itemId) && inPeriod(entry.back || entry.out, from, to)), [history, scopedIds, from, to]);
  const pendingOrders = useMemo(() => orders.filter((order) => ['Pending', 'Partially received'].includes(order.status) && (!order.itemId || scopedIds.has(order.itemId))), [orders, scopedIds]);
  const completedRepairExpense = expenseRows.filter((row) => row.status === 'Completed').reduce((sum, row) => sum + row.total, 0);
  const openRepairEstimate = expenseRows.filter((row) => row.status !== 'Completed' && row.status !== 'Cancelled').reduce((sum, row) => sum + row.total, 0);
  const commitments = pendingOrders.reduce((sum, order) => sum + Number(order.unitCost || 0) * Number(order.remainingQty ?? order.qty ?? 0), 0);
  const costBasis = assetRows.reduce((sum, row) => sum + row.costBasis, 0);
  const bookValue = assetRows.reduce((sum, row) => sum + row.bookValue, 0);
  const accumulatedDepreciation = assetRows.reduce((sum, row) => sum + row.accumulatedDepreciation, 0);
  const annualDepreciation = assetRows.reduce((sum, row) => sum + row.annualDepreciation, 0);
  const acquiredRows = assetRows.filter((row) => inPeriod(row.purchased, from, to));
  const periodAcquisitions = acquiredRows.reduce((sum, row) => sum + row.costBasis, 0);
  const activeRows = assetRows.filter((row) => row.status !== 'Retired');
  const serializedRows = activeRows.filter((row) => !row.consumable);
  const onLoan = serializedRows.filter((row) => row.status === 'On loan');
  const lowRows = activeRows.filter(isLowStock);
  const dueReplacement = activeRows.filter((row) => row.replacementDate && row.replacementDate <= asOf);
  const maintenanceRows = activeRows.filter((row) => row.status === 'Maintenance');
  const avgLoanDays = periodLoans.length ? periodLoans.reduce((sum, entry) => {
    const start = new Date(entry.out);
    const end = new Date(entry.back || asOf);
    return sum + (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) ? 0 : Math.max(0, (end - start) / 864e5));
  }, 0) / periodLoans.length : 0;

  const summarize = (field) => [...assetRows.reduce((map, row) => {
    const name = row[field] || 'Unspecified';
    const current = map.get(name) || { name, records: 0, units: 0, costBasis: 0, bookValue: 0, depreciation: 0 };
    current.records += 1; current.units += row.units; current.costBasis += row.costBasis; current.bookValue += row.bookValue; current.depreciation += row.accumulatedDepreciation;
    map.set(name, current); return map;
  }, new Map()).values()].sort((a, b) => b.bookValue - a.bookValue);
  const categoryRows = useMemo(() => summarize('category'), [assetRows]);
  const locationRows = useMemo(() => summarize('location'), [assetRows]);
  const statusRows = useMemo(() => summarize('status'), [assetRows]);

  const summary = {
    records: assetRows.length, units: assetRows.reduce((sum, row) => sum + row.units, 0), costBasis, accumulatedDepreciation, bookValue, annualDepreciation,
    periodAcquisitions, completedRepairExpense, openRepairEstimate, commitments, loans: periodLoans.length, avgLoanDays,
    utilisation: onLoan.length / Math.max(1, serializedRows.length), lowStock: lowRows.length, maintenance: maintenanceRows.length,
    replacementsDue: dueReplacement.length, procurementArchiveRecords: procurementRecords.length
  };

  const exceptionAssets = sortedAssets.filter((row) => row.status === 'Maintenance' || row.status === 'Retired' || isLowStock(row) || (row.replacementDate && row.replacementDate <= asOf));
  const report = { title: 'Inventory Management & Accounting Report', generatedAt: new Date().toISOString(), filters: { from, to, asOf, category, location, status }, options: { sections: pdfSections, assetDetail }, summary, categoryRows, locationRows, statusRows, assetRows: assetDetail === 'exceptions' ? exceptionAssets : sortedAssets, expenseRows: sortedExpenses, pendingOrders, periodLoans };
  const selectedSectionCount = Object.values(pdfSections).filter(Boolean).length;
  const togglePdfSection = (key) => setPdfSections((current) => ({ ...current, [key]: !current[key] }));
  const createPdf = async () => {
    setPdfBusy(true); setPdfError('');
    try { await generateManagementReportPdf(report); }
    catch (error) { setPdfError(error?.message || 'The PDF could not be generated.'); }
    finally { setPdfBusy(false); }
  };

  const tiles = tab === 'accounting' ? [
    ['Historical cost', money(costBasis), `${summary.units.toLocaleString()} units in scope`],
    ['Accumulated depreciation', money(accumulatedDepreciation), `As at ${asOf}`],
    ['Net book value', money(bookValue), `${percent(bookValue / Math.max(1, costBasis))} of cost retained`],
    ['Annual depreciation', money(annualDepreciation), 'Straight-line estimate']
  ] : tab === 'operations' ? [
    ['Loan transactions', periodLoans.length.toLocaleString(), `${from} to ${to}`],
    ['Average loan length', `${avgLoanDays.toFixed(1)} days`, 'Completed/recorded returns'],
    ['Assets in maintenance', maintenanceRows.length.toLocaleString(), `${expenseRows.length} period repair tickets`],
    ['Low-stock records', lowRows.length.toLocaleString(), 'Below configured minimum']
  ] : [
    ['Assets in scope', summary.units.toLocaleString(), `${summary.records} inventory records`],
    ['Net book value', money(bookValue), `Cost basis ${money(costBasis)}`],
    ['Period expenditure', money(periodAcquisitions + completedRepairExpense), 'Acquisitions + completed repairs'],
    ['Open commitments', money(commitments + openRepairEstimate), 'Orders + open repair estimates']
  ];

  return <div className="report-workspace">
    <section className="report-hero">
      <img className="report-hero-watermark" src="brand/msbm-crest.png" alt="" />
      <div className="report-hero-copy">
        <span className="report-eyebrow">MSBM · Inventory intelligence</span>
        <h2>Management reporting centre</h2>
        <p>Financial position, asset stewardship and operational performance in one controlled view.</p>
        <div className="report-hero-meta"><span>JMD reporting currency</span><span>As at {asOf}</span><span>{summary.records} records in scope</span></div>
      </div>
      <img className="report-hero-brand" src="brand/msbm-lockup-light.png" alt="Mona School of Business & Management" />
    </section>

    <section className="report-controls">
      <div className="report-date-controls">
        <Filter label="Reporting period starts"><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={controlStyle} /></Filter>
        <span className="report-date-divider">to</span>
        <Filter label="Reporting period ends"><input type="date" value={to} onChange={(event) => setTo(event.target.value)} style={controlStyle} /></Filter>
        <span className="report-control-rule" />
        <Filter label="Valuation date"><input type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} style={controlStyle} /></Filter>
      </div>
      <div className="report-scope-controls">
        <Filter label="Asset category"><select value={category} onChange={(event) => setCategory(event.target.value)} style={filterSelect}><option>All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></Filter>
        <Filter label="Campus location"><select value={location} onChange={(event) => setLocation(event.target.value)} style={filterSelect}><option>All locations</option>{locations.map((value) => <option key={value}>{value}</option>)}</select></Filter>
        <Filter label="Inventory status"><select value={status} onChange={(event) => setStatus(event.target.value)} style={filterSelect}><option>All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></Filter>
        <button type="button" className="report-reset" onClick={() => { setFrom(yearStart()); setTo(todayIso()); setAsOf(todayIso()); setCategory('All categories'); setLocation('All locations'); setStatus('All statuses'); }}>Reset filters</button>
      </div>
      {pdfError && <div className="report-error">{pdfError}</div>}
    </section>

    <nav className="report-tabs" aria-label="Report views">{[['overview', 'Executive overview', 'Position and key indicators'], ['accounting', 'Asset accounting', 'Valuation and depreciation'], ['operations', 'Operations & cost', 'Loans, repairs and commitments']].map(([key, label, detail]) => <button key={key} type="button" onClick={() => setTab(key)} data-active={tab === key}><span>{label}</span><small>{detail}</small></button>)}</nav>

    <section className="report-pdf-builder">
      <div className="report-pdf-builder-title"><span className="report-pdf-icon">PDF</span><span><strong>Choose what the PDF should contain</strong><small>Summary sections are selected by default. Add line-item detail only when it is actually needed.</small></span></div>
      <div className="report-section-picks">{[
        ['overview', 'Executive summary'], ['categories', 'Category totals'], ['locations', 'Location totals'], ['assets', 'Asset line items'], ['maintenance', 'Repair costs'], ['commitments', 'Open commitments']
      ].map(([key, label]) => <button key={key} type="button" data-selected={pdfSections[key]} onClick={() => togglePdfSection(key)}><span>{pdfSections[key] ? '✓' : '+'}</span>{label}</button>)}</div>
      {pdfSections.assets && <label className="report-detail-select"><span>Asset rows</span><select value={assetDetail} onChange={(event) => setAssetDetail(event.target.value)}><option value="exceptions">Exceptions only ({exceptionAssets.length})</option><option value="all">All records ({sortedAssets.length})</option></select></label>}
      <button type="button" className="report-generate-button" disabled={pdfBusy || !assetRows.length || !selectedSectionCount} onClick={createPdf}><span>{pdfBusy ? 'Building PDF…' : 'Generate selected report'}</span><b>↗</b></button>
      {!selectedSectionCount && <div className="report-section-warning">Select at least one report section.</div>}
    </section>

    <div className="report-metrics">{tiles.map(([label, value, note], index) => <Metric key={label} label={label} value={value} note={note} index={index} />)}</div>

    {tab === 'overview' && <Overview summary={summary} categoryRows={categoryRows} locationRows={locationRows} statusRows={statusRows} />}
    {tab === 'accounting' && <Accounting assets={sortedAssets} sort={assetSort} setSort={setAssetSort} categoryRows={categoryRows} />}
    {tab === 'operations' && <Operations expenses={sortedExpenses} sort={expenseSort} setSort={setExpenseSort} orders={pendingOrders} periodAcquisitions={periodAcquisitions} completedRepairExpense={completedRepairExpense} openRepairEstimate={openRepairEstimate} commitments={commitments} utilisation={summary.utilisation} replacementsDue={dueReplacement.length} />}

    <div className="report-basis"><span>i</span><p><strong>Reporting basis</strong> Values are management estimates in JMD. Historical cost is unit cost × recorded quantity. Consumable inventory remains at recorded cost; serialized fixed assets use the configured straight-line method, useful life and salvage value as at the selected date. Maintenance expense includes completed tickets in the period; open ticket values and purchase orders are shown as commitments, not posted expenditure.</p></div>
  </div>;
}

function Filter({ label, children }) { return <label className="report-filter"><span>{label}</span>{children}</label>; }
function Metric({ label, value, note, index }) { const tones = ['#0a3d7c', '#16715a', '#9a5b0a', '#75499b']; return <div className="report-metric" style={{ '--metric-tone': tones[index % tones.length] }}><span className="report-metric-icon">{['▦', '◒', '↗', '◇'][index % 4]}</span><span className="report-metric-label">{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function Overview({ summary, categoryRows, locationRows, statusRows }) {
  return <div className="report-overview-grid">
    <ValueBars title="Net book value by category" subtitle="Top asset classes by carrying value" rows={categoryRows} />
    <div className="report-overview-stack"><ValueBars title="Value by campus location" subtitle="Where inventory value is currently held" rows={locationRows.slice(0, 8)} compact /><StatusPanel rows={statusRows} /></div>
    <section className="report-indicators"><div className="report-section-title"><span><strong>Management indicators</strong><small>Signals requiring financial or operational attention</small></span><span className="report-live-pill">Live analysis</span></div><div className="report-indicator-grid">{[
      ['Utilisation', percent(summary.utilisation), 'Serialized equipment currently deployed', '#0a3d7c'], ['Replacements due', summary.replacementsDue, 'Assets at or beyond planned life', '#a05a08'], ['Completed repairs', money(summary.completedRepairExpense), 'Expense recorded in selected period', '#16715a'], ['Open repair estimates', money(summary.openRepairEstimate), 'Unposted maintenance exposure', '#9c3d35'], ['Procurement archive', summary.procurementArchiveRecords, 'Historical purchasing records available', '#75499b']
    ].map(([label, value, detail, tone]) => <div key={label} className="report-indicator" style={{ '--indicator-tone': tone }}><span /><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>)}</div></section>
  </div>;
}
function ValueBars({ title, subtitle, rows, compact = false }) {
  const visible = rows.slice(0, compact ? 8 : 12); const max = Math.max(1, ...visible.map((row) => row.bookValue));
  return <section className="report-chart-card"><div className="report-section-title"><span><strong>{title}</strong><small>{subtitle}</small></span><span className="report-chart-total">{money(rows.reduce((sum, row) => sum + row.bookValue, 0))}</span></div><div className={compact ? 'report-bars compact' : 'report-bars'}>{visible.map((row, index) => <div key={row.name} className="report-bar-row"><div><strong>{row.name}</strong><small>{row.units.toLocaleString()} units</small></div><span className="report-bar-track"><i style={{ width: `${Math.max(2, (row.bookValue / max) * 100)}%`, opacity: Math.max(.45, 1 - index * .045) }} /></span><em>{money(row.bookValue)}</em></div>)}</div></section>;
}
function StatusPanel({ rows }) {
  const total = Math.max(1, rows.reduce((sum, row) => sum + row.units, 0)); const colors = ['#16715a', '#0a5aa6', '#b16a10', '#a9443c', '#7b8794'];
  return <section className="report-chart-card"><div className="report-section-title"><span><strong>Inventory status mix</strong><small>Unit distribution across the selected scope</small></span><span className="report-chart-total">{total.toLocaleString()} units</span></div><div className="report-status-bar">{rows.map((row, index) => <span key={row.name} title={`${row.name}: ${row.units}`} style={{ width: `${(row.units / total) * 100}%`, background: colors[index % colors.length] }} />)}</div><div className="report-status-legend">{rows.map((row, index) => <span key={row.name}><i style={{ background: colors[index % colors.length] }} /><span><strong>{row.name}</strong><small>{row.units} · {percent(row.units / total)}</small></span></span>)}</div></section>;
}
function Accounting({ assets, sort, setSort, categoryRows }) {
  const cols = [['asset', 'Asset'], ['category', 'Category'], ['acquired', 'Acquired'], ['costBasis', 'Historical cost'], ['depreciation', 'Accum. depreciation'], ['bookValue', 'Net book value'], ['replacement', 'Replacement']];
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><SummaryTable title="Accounting roll-forward by category" rows={categoryRows} />
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}><div style={sectionHeader}><span><strong>Detailed fixed-asset register</strong><small style={{ display: 'block', marginTop: 3, color: '#7a8793' }}>{assets.length} records in the selected scope</small></span></div><div style={{ overflowX: 'auto' }}><div style={{ minWidth: 1160 }}><div style={{ ...assetGrid, ...tableHeader }}>{cols.map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />)}</div>{assets.slice(0, 500).map((row) => <div key={row.id} style={assetGrid}><span><strong>{row.name}</strong><small>{row.tag} · {row.units} unit{row.units === 1 ? '' : 's'}</small></span><span>{row.category}</span><span>{row.purchased || '—'}</span><Mono>{money(row.costBasis)}</Mono><Mono>{money(row.accumulatedDepreciation)}</Mono><Mono strong>{money(row.bookValue)}</Mono><span>{row.replacementDate || '—'}</span></div>)}</div></div></div>
  </div>;
}
function Operations({ expenses, sort, setSort, orders, periodAcquisitions, completedRepairExpense, openRepairEstimate, commitments, utilisation, replacementsDue }) {
  const cols = [['date', 'Date'], ['ticket', 'Ticket'], ['asset', 'Asset'], ['vendor', 'Vendor'], ['status', 'Status'], ['total', 'Total cost']];
  return <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 16, alignItems: 'start' }}>
    <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}><div style={sectionHeader}><strong>Maintenance cost ledger</strong></div><div style={{ ...expenseGrid, ...tableHeader }}>{cols.map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />)}</div>{expenses.map((row) => <div key={row.id} style={expenseGrid}><span>{row.date}</span><Mono>{row.id}</Mono><span>{row.itemName}</span><span>{row.vendor || 'Internal'}</span><span>{row.status}</span><Mono strong>{money(row.total)}</Mono></div>)}{!expenses.length && <Empty text="No maintenance costs fall within this reporting period." />}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div style={cardStyle}><strong style={{ fontSize: 13 }}>Period expenditure bridge</strong>{[['Asset acquisitions', periodAcquisitions], ['Completed repair expense', completedRepairExpense], ['Recorded expenditure', periodAcquisitions + completedRepairExpense], ['Open repair estimates', openRepairEstimate], ['Purchase commitments', commitments]].map(([label, value], index) => <div key={label} style={{ marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #edf0f3', fontSize: 11.5, fontWeight: index === 2 ? 700 : 400 }}><span>{label}</span><Mono strong={index === 2}>{money(value)}</Mono></div>)}</div>
      <div style={cardStyle}><strong style={{ fontSize: 13 }}>Operational controls</strong>{[['Serialized utilisation', percent(utilisation)], ['Replacements due', replacementsDue], ['Open purchase orders', orders.length]].map(([label, value]) => <div key={label} style={{ marginTop: 11, display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}><div style={sectionHeader}><strong>Open purchase commitments</strong></div>{orders.map((order) => <div key={order.id} style={{ padding: '10px 13px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, borderTop: '1px solid #edf0f3', fontSize: 11.5 }}><span><strong style={{ display: 'block' }}>{order.name}</strong><small>{order.supplier} · {order.status}</small></span><Mono strong>{money(Number(order.unitCost || 0) * Number(order.remainingQty ?? order.qty ?? 0))}</Mono></div>)}{!orders.length && <Empty text="No open purchase commitments in this scope." />}</div></div>
  </div>;
}
function SummaryTable({ title, rows, compact = false }) { return <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}><div style={sectionHeader}><strong>{title}</strong></div><div style={{ display: 'grid', gridTemplateColumns: compact ? '1.4fr .5fr 1fr' : '1.4fr .45fr 1fr 1fr', gap: 10, padding: '8px 13px', ...tableHeader }}><span>Group</span><span>Units</span><span>Historical cost</span>{!compact && <span>Net book value</span>}</div>{rows.map((row) => <div key={row.name} style={{ display: 'grid', gridTemplateColumns: compact ? '1.4fr .5fr 1fr' : '1.4fr .45fr 1fr 1fr', gap: 10, padding: '9px 13px', borderTop: '1px solid #edf0f3', alignItems: 'center', fontSize: 11.5 }}><strong>{row.name}</strong><Mono>{row.units}</Mono><Mono>{money(row.costBasis)}</Mono>{!compact && <Mono strong>{money(row.bookValue)}</Mono>}</div>)}</div>; }
function Mono({ children, strong = false }) { return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, fontWeight: strong ? 700 : 400 }}>{children}</span>; }
function Empty({ text }) { return <div style={{ padding: 28, textAlign: 'center', color: '#7b8794', fontSize: 11.5 }}>{text}</div>; }

const cardStyle = { padding: 15, background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10 };
const controlStyle = { width: 130, height: 37, padding: '0 8px', border: '1px solid #d8dee5', borderRadius: 8, background: '#fff', fontSize: 11.5 };
const filterSelect = { minWidth: 170, height: 34, padding: '0 9px', border: '1px solid #d8dee5', borderRadius: 8, background: '#fff', fontSize: 11.5 };
const tabStyle = (active) => ({ height: 34, padding: '0 11px', border: `1px solid ${active ? '#0a3d7c' : '#d8dee5'}`, borderRadius: 7, color: active ? '#fff' : '#53606c', background: active ? '#0a3d7c' : '#fff', cursor: 'pointer', fontSize: 11.5, fontWeight: 650 });
const sectionHeader = { padding: '12px 14px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e8ecf0', fontSize: 13 };
const tableHeader = { background: '#f6f8fa', color: '#74818d', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' };
const assetGrid = { display: 'grid', gridTemplateColumns: '2fr 1fr .8fr 1fr 1.1fr 1fr .85fr', gap: 11, padding: '10px 13px', alignItems: 'center', borderTop: '1px solid #edf0f3', fontSize: 11 };
const expenseGrid = { display: 'grid', gridTemplateColumns: '.75fr .95fr 1.5fr 1fr .8fr .9fr', gap: 9, padding: '9px 12px', alignItems: 'center', borderTop: '1px solid #edf0f3', fontSize: 10.5 };
