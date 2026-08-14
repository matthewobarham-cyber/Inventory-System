import { useMemo, useState } from 'react';
import { money, isLowStock } from '../data.js';
import { bookValueFor, expectedReplacementFor } from '../lifecycle.js';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';
import { generateManagementReportPdf } from '../report-pdf.js';

const DAY = 864e5;
const todayIso = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const dateOnly = (value) => String(value || '').slice(0, 10);
const validDate = (value, fallback = new Date()) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? fallback : date; };
const inPeriod = (value, from, to) => { const date = dateOnly(value); return !!date && date >= from && date <= to; };
const quantity = (item) => Number.isFinite(Number(item.qty)) ? Math.max(0, Number(item.qty)) : 1;
const percent = (value) => `${Math.round((Number(value) || 0) * 100)}%`;
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const downloadCsv = (filename, headers, rows) => {
  const body = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function Reports({ items = [], history = [], tickets = [], orders = [], procurementRecords = [], consumableUsage = [], lifecycleActions = [] }) {
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
  const [pdfSections, setPdfSections] = useState({ overview: true, categories: true, locations: false, assets: false, depreciation: true, maintenance: true, commitments: true, disposals: true, journal: false, controls: false });
  const [assetDetail, setAssetDetail] = useState('exceptions');

  const categories = useMemo(() => [...new Set(items.map((item) => item.category).filter(Boolean))].sort(), [items]);
  const locations = useMemo(() => [...new Set(items.map((item) => item.location).filter(Boolean))].sort(), [items]);
  const statuses = useMemo(() => [...new Set(items.map((item) => item.status).filter(Boolean))].sort(), [items]);
  const asOfDate = useMemo(() => validDate(`${asOf}T23:59:59`, new Date()), [asOf]);
  const fromDate = useMemo(() => validDate(`${from}T00:00:00`, new Date()), [from]);
  const toDate = useMemo(() => validDate(`${to}T23:59:59`, asOfDate), [to, asOfDate]);

  const scopedItems = useMemo(() => items.filter((item) => {
    if (item.archived || (dateOnly(item.purchased) && dateOnly(item.purchased) > asOf)) return false;
    if (category !== 'All categories' && item.category !== category) return false;
    if (location !== 'All locations' && item.location !== location) return false;
    if (status !== 'All statuses' && item.status !== status) return false;
    return true;
  }), [items, asOf, category, location, status]);

  const assetRows = useMemo(() => scopedItems.map((item) => {
    const units = quantity(item);
    const unitCost = Math.max(0, Number(item.cost || 0));
    const costBasis = unitCost * units;
    const isFixedAsset = !item.consumable;
    const closingBookValue = isFixedAsset ? bookValueFor(item, asOfDate) * units : costBasis;
    const openingBookValue = isFixedAsset && dateOnly(item.purchased) < from ? bookValueFor(item, fromDate) * units : 0;
    const salvage = Math.min(costBasis, Math.max(0, Number(item.salvageValue || 0)) * units);
    const method = item.depreciationMethod || 'Straight-line';
    const life = Math.max(1, Number(item.usefulLifeYears) || 5);
    const annualDepreciation = !isFixedAsset || method === 'None' ? 0 : Math.max(0, costBasis - salvage) / life;
    const additions = inPeriod(item.purchased, from, to) ? costBasis : 0;
    const periodClosingValue = isFixedAsset ? bookValueFor(item, toDate) * units : costBasis;
    const periodDepreciation = Math.max(0, openingBookValue + additions - periodClosingValue);
    return { ...item, units, unitCost, costBasis, bookValue: closingBookValue, openingBookValue, additions, periodDepreciation, accountingClass: isFixedAsset ? 'Fixed asset' : 'Consumable inventory', accumulatedDepreciation: Math.max(0, costBasis - closingBookValue), annualDepreciation, salvage, usefulLife: life, method, replacementDate: isFixedAsset ? expectedReplacementFor(item) : '' };
  }), [scopedItems, asOfDate, fromDate, toDate, from, to]);

  const fixedAssets = assetRows.filter((row) => !row.consumable);
  const inventoryStock = assetRows.filter((row) => row.consumable);
  const scopedIds = useMemo(() => new Set(scopedItems.map((item) => item.id)), [scopedItems]);
  const periodTickets = useMemo(() => tickets.filter((ticket) => scopedIds.has(ticket.itemId) && inPeriod(ticket.updatedAt || ticket.createdAt, from, to)), [tickets, scopedIds, from, to]);
  const expenseRows = useMemo(() => periodTickets.map((ticket) => ({ ...ticket, date: dateOnly(ticket.updatedAt || ticket.createdAt), parts: Number(ticket.partsCost || 0), labor: Number(ticket.laborCost || 0), total: Number(ticket.partsCost || 0) + Number(ticket.laborCost || 0) })), [periodTickets]);
  const usageRows = useMemo(() => consumableUsage.filter((entry) => (!entry.itemId || scopedIds.has(entry.itemId)) && inPeriod(entry.usedAt, from, to)).map((entry) => ({ ...entry, date: dateOnly(entry.usedAt), total: Math.max(0, Number(entry.qty || 0)) * Math.max(0, Number(entry.unitCost || 0)) })), [consumableUsage, scopedIds, from, to]);
  const pendingOrders = useMemo(() => orders.filter((order) => ['Pending', 'Partially received', 'Approved'].includes(order.status) && (!order.itemId || scopedIds.has(order.itemId))), [orders, scopedIds]);
  const disposalRows = useMemo(() => lifecycleActions.filter((action) => ['Disposal', 'Donation', 'Write-off', 'Loss'].includes(action.type) && action.status === 'Completed' && inPeriod(action.completedAt || action.effectiveDate || action.decidedAt, from, to)).map((action) => {
    const item = items.find((candidate) => candidate.id === action.itemId);
    const effectiveDate = dateOnly(action.completedAt || action.effectiveDate || action.decidedAt);
    const carryingValue = item ? bookValueFor(item, validDate(`${effectiveDate}T23:59:59`, asOfDate)) * quantity(item) : 0;
    const proceeds = Math.max(0, Number(action.proceeds ?? item?.dispositionProceeds ?? 0));
    return { ...action, effectiveDate, itemName: action.itemName || item?.name || 'Unknown asset', itemTag: action.itemTag || item?.tag || '', carryingValue, proceeds, loss: Math.max(0, carryingValue - proceeds), gain: Math.max(0, proceeds - carryingValue) };
  }), [lifecycleActions, items, from, to, asOfDate]);
  const periodLoans = useMemo(() => history.filter((entry) => scopedIds.has(entry.itemId) && inPeriod(entry.back || entry.out, from, to)), [history, scopedIds, from, to]);
  const sortedAssets = useMemo(() => sortRows(fixedAssets, assetSort, { asset: (row) => `${row.name} ${row.tag}`, category: (row) => row.category, status: (row) => row.status, acquired: (row) => row.purchased, costBasis: (row) => row.costBasis, depreciation: (row) => row.accumulatedDepreciation, periodDepreciation: (row) => row.periodDepreciation, bookValue: (row) => row.bookValue, replacement: (row) => row.replacementDate }), [fixedAssets, assetSort]);
  const sortedExpenses = useMemo(() => sortRows(expenseRows, expenseSort, { date: (row) => row.date, ticket: (row) => row.id, asset: (row) => row.itemName, vendor: (row) => row.vendor, status: (row) => row.status, total: (row) => row.total }), [expenseRows, expenseSort]);

  const summarize = (field, source = assetRows) => [...source.reduce((map, row) => { const name = row[field] || 'Unspecified'; const current = map.get(name) || { name, records: 0, units: 0, costBasis: 0, bookValue: 0, depreciation: 0, periodDepreciation: 0 }; current.records += 1; current.units += row.units; current.costBasis += row.costBasis; current.bookValue += row.bookValue; current.depreciation += row.accumulatedDepreciation; current.periodDepreciation += row.periodDepreciation; map.set(name, current); return map; }, new Map()).values()].sort((a, b) => b.bookValue - a.bookValue);
  const categoryRows = useMemo(() => summarize('category'), [assetRows]);
  const locationRows = useMemo(() => summarize('location'), [assetRows]);
  const statusRows = useMemo(() => summarize('status'), [assetRows]);
  const depreciationRows = useMemo(() => summarize('category', fixedAssets), [fixedAssets]);

  const completedRepairExpense = expenseRows.filter((row) => row.status === 'Completed').reduce((sum, row) => sum + row.total, 0);
  const openRepairEstimate = expenseRows.filter((row) => !['Completed', 'Cancelled'].includes(row.status)).reduce((sum, row) => sum + row.total, 0);
  const consumableExpense = usageRows.reduce((sum, row) => sum + row.total, 0);
  const commitments = pendingOrders.reduce((sum, order) => sum + Number(order.unitCost || 0) * Number(order.remainingQty ?? order.qty ?? 0), 0);
  const costBasis = fixedAssets.reduce((sum, row) => sum + row.costBasis, 0);
  const openingBookValue = fixedAssets.reduce((sum, row) => sum + row.openingBookValue, 0);
  const bookValue = fixedAssets.reduce((sum, row) => sum + row.bookValue, 0);
  const accumulatedDepreciation = fixedAssets.reduce((sum, row) => sum + row.accumulatedDepreciation, 0);
  const annualDepreciation = fixedAssets.reduce((sum, row) => sum + row.annualDepreciation, 0);
  const periodDepreciation = fixedAssets.reduce((sum, row) => sum + row.periodDepreciation, 0);
  const periodAcquisitions = fixedAssets.reduce((sum, row) => sum + row.additions, 0);
  const inventoryValue = inventoryStock.reduce((sum, row) => sum + row.costBasis, 0);
  const disposalProceeds = disposalRows.reduce((sum, row) => sum + row.proceeds, 0);
  const disposalLoss = disposalRows.reduce((sum, row) => sum + row.loss, 0);
  const activeRows = assetRows.filter((row) => row.status !== 'Retired');
  const lowRows = activeRows.filter(isLowStock);
  const dueReplacement = fixedAssets.filter((row) => row.replacementDate && row.replacementDate <= asOf);
  const maintenanceRows = fixedAssets.filter((row) => row.status === 'Maintenance');
  const avgLoanDays = periodLoans.length ? periodLoans.reduce((sum, entry) => sum + Math.max(0, (validDate(entry.back || asOf) - validDate(entry.out)) / DAY), 0) / periodLoans.length : 0;

  const controlRows = useMemo(() => {
    const duplicates = new Map(); scopedItems.forEach((item) => { if (item.tag) duplicates.set(item.tag, (duplicates.get(item.tag) || 0) + 1); });
    return scopedItems.flatMap((item) => {
      const issues = [];
      if (!item.tag) issues.push(['Missing asset tag', 'Critical']);
      if (item.tag && duplicates.get(item.tag) > 1) issues.push(['Duplicate asset tag', 'Critical']);
      if (!item.consumable && !Number(item.cost)) issues.push(['Missing acquisition cost', 'Warning']);
      if (!item.consumable && !dateOnly(item.purchased)) issues.push(['Missing purchase date', 'Warning']);
      if (!item.location) issues.push(['Missing location', 'Warning']);
      if (!item.consumable && !Number(item.usefulLifeYears)) issues.push(['Useful life defaults to 5 years', 'Advisory']);
      if (item.warranty && item.purchased && item.warranty < item.purchased) issues.push(['Warranty ends before purchase date', 'Critical']);
      return issues.map(([issue, severity]) => ({ id: `${item.id}-${issue}`, itemName: item.name, tag: item.tag, issue, severity }));
    });
  }, [scopedItems]);

  const journalRows = useMemo(() => {
    const rows = [];
    const add = (date, source, memo, debitAccount, creditAccount, amount) => { if (amount > 0) rows.push({ id: `${source}-${rows.length}`, date, source, memo, debitAccount, creditAccount, debit: amount, credit: amount }); };
    add(to, 'FA-ADD', 'Fixed assets acquired during reporting period', 'Fixed assets at cost', 'Capital purchases clearing', periodAcquisitions);
    add(to, 'FA-DEP', 'Straight-line depreciation for reporting period', 'Depreciation expense', 'Accumulated depreciation', periodDepreciation);
    add(to, 'MNT-EXP', 'Completed maintenance tickets', 'Repairs and maintenance expense', 'Accounts payable / cash', completedRepairExpense);
    add(to, 'CON-USE', 'Consumables issued during reporting period', 'IT supplies expense', 'Consumable inventory', consumableExpense);
    add(to, 'DSP-LOSS', 'Net carrying value written off on completed disposals', 'Loss on asset disposal', 'Asset disposal clearing', disposalLoss);
    add(to, 'DSP-CASH', 'Proceeds recovered from completed disposals', 'Cash / receivable', 'Asset disposal clearing', disposalProceeds);
    return rows;
  }, [to, periodAcquisitions, periodDepreciation, completedRepairExpense, consumableExpense, disposalLoss, disposalProceeds]);

  const summary = { records: assetRows.length, units: assetRows.reduce((sum, row) => sum + row.units, 0), costBasis, openingBookValue, accumulatedDepreciation, bookValue, annualDepreciation, periodDepreciation, periodAcquisitions, inventoryValue, consumableExpense, completedRepairExpense, openRepairEstimate, commitments, disposalProceeds, disposalLoss, loans: periodLoans.length, avgLoanDays, utilisation: fixedAssets.filter((row) => row.status === 'On loan').length / Math.max(1, fixedAssets.length), lowStock: lowRows.length, maintenance: maintenanceRows.length, replacementsDue: dueReplacement.length, controlExceptions: controlRows.length, procurementArchiveRecords: procurementRecords.length };
  const exceptionAssets = sortedAssets.filter((row) => row.status === 'Maintenance' || row.status === 'Retired' || (row.replacementDate && row.replacementDate <= asOf));
  const report = { title: 'Inventory Accounting & Management Report', generatedAt: new Date().toISOString(), filters: { from, to, asOf, category, location, status }, options: { sections: pdfSections, assetDetail }, summary, categoryRows, locationRows, statusRows, depreciationRows, assetRows: assetDetail === 'exceptions' ? exceptionAssets : sortedAssets, expenseRows: sortedExpenses, usageRows, pendingOrders, disposalRows, periodLoans, journalRows, controlRows };
  const selectedSectionCount = Object.values(pdfSections).filter(Boolean).length;
  const createPdf = async () => { setPdfBusy(true); setPdfError(''); try { await generateManagementReportPdf(report); } catch (error) { setPdfError(error?.message || 'The PDF could not be generated.'); } finally { setPdfBusy(false); } };
  const exportRegister = () => downloadCsv(`MSBM-fixed-asset-register-${asOf}.csv`, ['Asset tag', 'Asset', 'Category', 'Status', 'Location', 'Acquired', 'Units', 'Historical cost', 'Accumulated depreciation', 'Net book value', 'Useful life', 'Replacement date'], sortedAssets.map((row) => [row.tag, row.name, row.category, row.status, row.location, row.purchased, row.units, row.costBasis, row.accumulatedDepreciation, row.bookValue, row.usefulLife, row.replacementDate]));
  const exportJournal = () => downloadCsv(`MSBM-journal-worksheet-${from}-to-${to}.csv`, ['Date', 'Source', 'Memo', 'Debit account', 'Debit', 'Credit account', 'Credit'], journalRows.map((row) => [row.date, row.source, row.memo, row.debitAccount, row.debit, row.creditAccount, row.credit]));

  const tabs = [['overview', 'Financial position'], ['assets', 'Asset register'], ['depreciation', 'Depreciation'], ['expenses', 'Expenses'], ['commitments', 'Commitments'], ['disposals', 'Disposals'], ['journal', 'Journal worksheet'], ['controls', 'Controls']];
  const tiles = [['Historical cost', money(costBasis), `${fixedAssets.length} fixed-asset records`], ['Accumulated depreciation', money(accumulatedDepreciation), `As at ${asOf}`], ['Net book value', money(bookValue), `${percent(bookValue / Math.max(1, costBasis))} of cost retained`], ['Open commitments', money(commitments + openRepairEstimate), 'Orders and repair estimates']];

  return <div className="report-workspace accounting-suite">
    <section className="report-hero"><img className="report-hero-watermark" src="brand/msbm-crest.png" alt="" /><div className="report-hero-copy"><span className="report-eyebrow">MSBM · Finance and asset stewardship</span><h2>Inventory accounting suite</h2><p>Asset valuation, depreciation, expenditure, commitments and audit-ready control schedules in one reporting workspace.</p><div className="report-hero-meta"><span>Reporting currency · JMD</span><span>Valuation date · {asOf}</span><span>{summary.records} records in scope</span><span>{controlRows.length} control exceptions</span></div></div><img className="report-hero-brand" src="brand/msbm-lockup-light.png" alt="Mona School of Business & Management" /></section>

    <section className="report-controls"><div className="report-date-controls"><Filter label="Period starts"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={controlStyle} /></Filter><span className="report-date-divider">to</span><Filter label="Period ends"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={controlStyle} /></Filter><span className="report-control-rule" /><Filter label="Valuation date"><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={controlStyle} /></Filter></div><div className="report-scope-controls"><Filter label="Category"><select value={category} onChange={(e) => setCategory(e.target.value)} style={filterSelect}><option>All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select></Filter><Filter label="Location"><select value={location} onChange={(e) => setLocation(e.target.value)} style={filterSelect}><option>All locations</option>{locations.map((value) => <option key={value}>{value}</option>)}</select></Filter><Filter label="Status"><select value={status} onChange={(e) => setStatus(e.target.value)} style={filterSelect}><option>All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></Filter><button type="button" className="report-reset" onClick={() => { setFrom(yearStart()); setTo(todayIso()); setAsOf(todayIso()); setCategory('All categories'); setLocation('All locations'); setStatus('All statuses'); }}>Reset</button></div>{pdfError && <div className="report-error">{pdfError}</div>}</section>

    <nav className="accounting-tabs" aria-label="Accounting suite sections">{tabs.map(([key, label]) => <button key={key} type="button" data-active={tab === key} onClick={() => setTab(key)}>{label}{key === 'controls' && controlRows.length > 0 && <b>{controlRows.length}</b>}</button>)}</nav>
    <section className="report-pdf-builder"><div className="report-pdf-builder-title"><span className="report-pdf-icon">PDF</span><span><strong>Board-ready accounting pack</strong><small>Select only the schedules required for this report.</small></span></div><div className="report-section-picks">{[['overview', 'Position'], ['categories', 'Categories'], ['locations', 'Locations'], ['assets', 'Register'], ['depreciation', 'Depreciation'], ['maintenance', 'Expenses'], ['commitments', 'Commitments'], ['disposals', 'Disposals'], ['journal', 'Journal'], ['controls', 'Controls']].map(([key, label]) => <button key={key} type="button" data-selected={pdfSections[key]} onClick={() => setPdfSections((current) => ({ ...current, [key]: !current[key] }))}><span>{pdfSections[key] ? '✓' : '+'}</span>{label}</button>)}</div>{pdfSections.assets && <label className="report-detail-select"><span>Asset rows</span><select value={assetDetail} onChange={(e) => setAssetDetail(e.target.value)}><option value="exceptions">Exceptions ({exceptionAssets.length})</option><option value="all">All records ({sortedAssets.length})</option></select></label>}<button type="button" className="report-generate-button" disabled={pdfBusy || !selectedSectionCount} onClick={createPdf}><span>{pdfBusy ? 'Building PDF…' : 'Generate accounting pack'}</span><b>↗</b></button></section>
    <div className="report-metrics">{tiles.map(([label, value, note], index) => <Metric key={label} label={label} value={value} note={note} index={index} />)}</div>

    {tab === 'overview' && <Overview summary={summary} categoryRows={categoryRows} locationRows={locationRows} statusRows={statusRows} />}
    {tab === 'assets' && <AssetRegister assets={sortedAssets} sort={assetSort} setSort={setAssetSort} onExport={exportRegister} />}
    {tab === 'depreciation' && <Depreciation assets={sortedAssets} rows={depreciationRows} summary={summary} />}
    {tab === 'expenses' && <Expenses expenses={sortedExpenses} usage={usageRows} sort={expenseSort} setSort={setExpenseSort} completed={completedRepairExpense} consumables={consumableExpense} />}
    {tab === 'commitments' && <Commitments orders={pendingOrders} repairEstimate={openRepairEstimate} total={commitments} />}
    {tab === 'disposals' && <Disposals rows={disposalRows} proceeds={disposalProceeds} loss={disposalLoss} />}
    {tab === 'journal' && <Journal rows={journalRows} onExport={exportJournal} />}
    {tab === 'controls' && <Controls rows={controlRows} />}
    <div className="report-basis"><span>i</span><p><strong>Accounting basis</strong> Management reporting in JMD. Fixed assets use recorded historical cost and configured straight-line useful life and salvage value. Consumables remain inventory until issued. Open orders and unfinished repairs are commitments, not posted expenditure. Journal rows are an exportable worksheet for review before entry into the institution’s general ledger.</p></div>
  </div>;
}

function Filter({ label, children }) { return <label className="report-filter"><span>{label}</span>{children}</label>; }
function Metric({ label, value, note, index }) { const tones = ['#0a3d7c', '#16715a', '#9a5b0a', '#75499b']; return <div className="report-metric" style={{ '--metric-tone': tones[index % tones.length] }}><span className="report-metric-icon">{['◇', '◒', '↗', '◈'][index % 4]}</span><span className="report-metric-label">{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function Overview({ summary, categoryRows, locationRows, statusRows }) { return <div className="report-overview-grid"><ValueBars title="Net book value by category" subtitle="Carrying value across asset classes" rows={categoryRows} /><div className="report-overview-stack"><ValueBars title="Value by campus location" subtitle="Where inventory value is held" rows={locationRows.slice(0, 8)} compact /><StatusPanel rows={statusRows} /></div><section className="report-indicators"><SectionTitle title="Accounting position" subtitle="Period activity and balance-sheet exposure" badge="Live analysis" /><div className="report-indicator-grid">{[['Opening net book value', money(summary.openingBookValue), 'Carrying value at period start', '#0a3d7c'], ['Capital additions', money(summary.periodAcquisitions), 'Fixed assets acquired in period', '#16715a'], ['Period depreciation', money(summary.periodDepreciation), 'Calculated non-cash expense', '#9a5b0a'], ['Consumable inventory', money(summary.inventoryValue), 'Stock held at recorded cost', '#75499b'], ['Operating expense', money(summary.completedRepairExpense + summary.consumableExpense), 'Repairs and issued supplies', '#a9443c']].map(([label, value, detail, tone]) => <div key={label} className="report-indicator" style={{ '--indicator-tone': tone }}><span /><small>{label}</small><strong>{value}</strong><p>{detail}</p></div>)}</div></section></div>; }
function AssetRegister({ assets, sort, setSort, onExport }) { const cols = [['asset', 'Asset'], ['category', 'Category'], ['acquired', 'Acquired'], ['costBasis', 'Historical cost'], ['depreciation', 'Accum. depreciation'], ['bookValue', 'Net book value'], ['replacement', 'Replacement']]; return <ReportCard title="Detailed fixed-asset register" subtitle={`${assets.length} records in scope`} action={<button className="accounting-export" onClick={onExport}>Export CSV</button>}><div className="accounting-table-scroll"><div style={{ minWidth: 1160 }}><div style={{ ...assetGrid, ...tableHeader }}>{cols.map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />)}</div>{assets.map((row) => <div key={row.id} style={assetGrid}><span><strong>{row.name}</strong><small>{row.tag} · {row.units} unit{row.units === 1 ? '' : 's'}</small></span><span>{row.category}</span><span>{row.purchased || '—'}</span><Mono>{money(row.costBasis)}</Mono><Mono>{money(row.accumulatedDepreciation)}</Mono><Mono strong>{money(row.bookValue)}</Mono><span>{row.replacementDate || '—'}</span></div>)}</div></div></ReportCard>; }
function Depreciation({ assets, rows, summary }) { return <div className="accounting-two-column"><div><ReportCard title="Depreciation roll-forward" subtitle="Straight-line management estimate by category"><AccountingGrid headings={['Category', 'Opening NBV', 'Additions', 'Period depreciation', 'Closing NBV']}>{rows.map((row) => { const related = assets.filter((asset) => (asset.category || 'Unspecified') === row.name); return <div key={row.name}><strong>{row.name}</strong><Mono>{money(related.reduce((s, a) => s + a.openingBookValue, 0))}</Mono><Mono>{money(related.reduce((s, a) => s + a.additions, 0))}</Mono><Mono>{money(row.periodDepreciation)}</Mono><Mono strong>{money(row.bookValue)}</Mono></div>; })}</AccountingGrid></ReportCard></div><div className="accounting-side-stack"><MiniStatement title="Fixed asset roll-forward" rows={[['Opening net book value', summary.openingBookValue], ['Additions', summary.periodAcquisitions], ['Less: period depreciation', -summary.periodDepreciation], ['Closing net book value', summary.bookValue]]} /><ReportCard title="Methodology" subtitle="Current valuation assumptions"><div className="accounting-note"><strong>Straight-line depreciation</strong><p>Depreciable amount equals historical cost less salvage value and is allocated evenly across the configured useful life. Assets using “None” remain at cost.</p></div></ReportCard></div></div>; }
function Expenses({ expenses, usage, sort, setSort, completed, consumables }) { const cols = [['date', 'Date'], ['ticket', 'Ticket'], ['asset', 'Asset'], ['vendor', 'Vendor'], ['status', 'Status'], ['total', 'Total']]; return <div className="accounting-two-column wide"><ReportCard title="Maintenance expense ledger" subtitle="Completed and open repair activity"><div style={{ ...expenseGrid, ...tableHeader }}>{cols.map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={(column) => setSort((current) => nextSort(current, column))} />)}</div>{expenses.map((row) => <div key={row.id} style={expenseGrid}><span>{row.date}</span><Mono>{row.id}</Mono><span>{row.itemName}</span><span>{row.vendor || 'Internal'}</span><span>{row.status}</span><Mono strong>{money(row.total)}</Mono></div>)}{!expenses.length && <Empty text="No maintenance costs in this period." />}</ReportCard><div className="accounting-side-stack"><MiniStatement title="Operating expense summary" rows={[['Completed maintenance', completed], ['Consumables issued', consumables], ['Total recorded OPEX', completed + consumables]]} /><ReportCard title="Consumable issues" subtitle={`${usage.length} usage records in period`}>{usage.slice(0, 25).map((row) => <LedgerLine key={row.id} title={row.itemName} detail={`${row.date} · ${row.qty} issued · ${row.department || row.issuedTo || 'Unspecified'}`} value={money(row.total)} />)}{!usage.length && <Empty text="No consumable issues in this period." />}</ReportCard></div></div>; }
function Commitments({ orders, repairEstimate, total }) { return <div className="accounting-two-column"><ReportCard title="Open procurement commitments" subtitle={`${orders.length} purchase orders or requisitions`} >{orders.map((order) => <LedgerLine key={order.id} title={order.name} detail={`${order.supplier || 'Supplier not recorded'} · ${order.status} · ${order.remainingQty ?? order.qty ?? 0} remaining`} value={money(Number(order.unitCost || 0) * Number(order.remainingQty ?? order.qty ?? 0))} />)}{!orders.length && <Empty text="No open purchase commitments in scope." />}</ReportCard><MiniStatement title="Commitment exposure" rows={[['Purchase commitments', total], ['Open repair estimates', repairEstimate], ['Total unposted exposure', total + repairEstimate]]} /></div>; }
function Disposals({ rows, proceeds, loss }) { return <div className="accounting-two-column"><ReportCard title="Completed disposal accounting" subtitle={`${rows.length} completed asset exits in the period`}><AccountingGrid headings={['Date / type', 'Asset', 'Method', 'Carrying value', 'Proceeds', 'Loss / gain']}>{rows.map((row) => <div key={row.id}><span><strong>{row.effectiveDate}</strong><small>{row.type}</small></span><span><strong>{row.itemName}</strong><small>{row.itemTag}</small></span><span>{row.disposalMethod || row.vendor || 'Not recorded'}</span><Mono>{money(row.carryingValue)}</Mono><Mono>{money(row.proceeds)}</Mono><Mono strong>{row.gain ? `${money(row.gain)} gain` : `${money(row.loss)} loss`}</Mono></div>)}</AccountingGrid>{!rows.length && <Empty text="No completed disposals fall within this reporting period." />}</ReportCard><MiniStatement title="Asset exit summary" rows={[['Carrying value removed', rows.reduce((sum, row) => sum + row.carryingValue, 0)], ['Recovery proceeds', proceeds], ['Net loss on disposal', loss]]} /></div>; }
function Journal({ rows, onExport }) { const total = rows.reduce((sum, row) => sum + row.debit, 0); return <ReportCard title="General ledger journal worksheet" subtitle="Balanced suggested entries for finance review — not automatically posted" action={<button className="accounting-export" onClick={onExport}>Export journal CSV</button>}><AccountingGrid headings={['Date / source', 'Memo', 'Debit account', 'Credit account', 'Amount']}>{rows.map((row) => <div key={row.id}><span><strong>{row.date}</strong><small>{row.source}</small></span><span>{row.memo}</span><span>{row.debitAccount}</span><span>{row.creditAccount}</span><Mono strong>{money(row.debit)}</Mono></div>)}</AccountingGrid>{!rows.length && <Empty text="No journal activity was calculated for this period." />}<div className="accounting-journal-total"><span>Control total</span><strong>Debits {money(total)}</strong><strong>Credits {money(total)}</strong><b>Balanced</b></div></ReportCard>; }
function Controls({ rows }) { const counts = ['Critical', 'Warning', 'Advisory'].map((severity) => [severity, rows.filter((row) => row.severity === severity).length]); return <div className="accounting-controls"><div className="accounting-control-summary">{counts.map(([label, count]) => <div key={label} data-severity={label}><small>{label}</small><strong>{count}</strong><span>exception{count === 1 ? '' : 's'}</span></div>)}</div><ReportCard title="Reconciliation and data-quality exceptions" subtitle="Resolve these records before relying on the schedules for formal accounting"><AccountingGrid headings={['Severity', 'Asset', 'Asset tag', 'Control exception', 'Action']} compact>{rows.map((row) => <div key={row.id}><span className="accounting-severity" data-severity={row.severity}>{row.severity}</span><strong>{row.itemName}</strong><Mono>{row.tag || 'Not recorded'}</Mono><span>{row.issue}</span><span>Review source record</span></div>)}</AccountingGrid>{!rows.length && <Empty text="No reconciliation exceptions were detected in this scope." />}</ReportCard></div>; }
function ValueBars({ title, subtitle, rows, compact = false }) { const visible = rows.slice(0, compact ? 8 : 12); const max = Math.max(1, ...visible.map((row) => row.bookValue)); return <section className="report-chart-card"><SectionTitle title={title} subtitle={subtitle} badge={money(rows.reduce((sum, row) => sum + row.bookValue, 0))} /><div className={compact ? 'report-bars compact' : 'report-bars'}>{visible.map((row, index) => <div key={row.name} className="report-bar-row"><div><strong>{row.name}</strong><small>{row.units.toLocaleString()} units</small></div><span className="report-bar-track"><i style={{ width: `${Math.max(2, (row.bookValue / max) * 100)}%`, opacity: Math.max(.45, 1 - index * .045) }} /></span><em>{money(row.bookValue)}</em></div>)}</div></section>; }
function StatusPanel({ rows }) { const total = Math.max(1, rows.reduce((sum, row) => sum + row.units, 0)); const colors = ['#16715a', '#0a5aa6', '#b16a10', '#a9443c', '#7b8794']; return <section className="report-chart-card"><SectionTitle title="Inventory status mix" subtitle="Unit distribution across the selected scope" badge={`${total.toLocaleString()} units`} /><div className="report-status-bar">{rows.map((row, i) => <span key={row.name} style={{ width: `${(row.units / total) * 100}%`, background: colors[i % colors.length] }} />)}</div><div className="report-status-legend">{rows.map((row, i) => <span key={row.name}><i style={{ background: colors[i % colors.length] }} /><span><strong>{row.name}</strong><small>{row.units} · {percent(row.units / total)}</small></span></span>)}</div></section>; }
function SectionTitle({ title, subtitle, badge }) { return <div className="report-section-title"><span><strong>{title}</strong><small>{subtitle}</small></span>{badge && <span className="report-chart-total">{badge}</span>}</div>; }
function ReportCard({ title, subtitle, action, children }) { return <section className="accounting-card"><SectionTitle title={title} subtitle={subtitle} badge={action} />{children}</section>; }
function AccountingGrid({ headings, children, compact = false }) { return <div className={`accounting-grid ${compact ? 'compact' : ''}`} style={{ '--accounting-columns': headings.length }}>{<div className="accounting-grid-head">{headings.map((heading) => <span key={heading}>{heading}</span>)}</div>}{children}</div>; }
function MiniStatement({ title, rows }) { return <ReportCard title={title} subtitle="JMD management values"><div className="accounting-statement">{rows.map(([label, value], index) => <div key={label} data-total={index === rows.length - 1}><span>{label}</span><Mono strong={index === rows.length - 1}>{money(value)}</Mono></div>)}</div></ReportCard>; }
function LedgerLine({ title, detail, value }) { return <div className="accounting-ledger-line"><span><strong>{title}</strong><small>{detail}</small></span><Mono strong>{value}</Mono></div>; }
function Mono({ children, strong = false }) { return <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, fontWeight: strong ? 700 : 400 }}>{children}</span>; }
function Empty({ text }) { return <div style={{ padding: 28, textAlign: 'center', color: '#7b8794', fontSize: 11.5 }}>{text}</div>; }

const controlStyle = { width: 130, height: 37, padding: '0 8px', border: '1px solid #d8dee5', borderRadius: 8, background: '#fff', fontSize: 11.5 };
const filterSelect = { minWidth: 145, height: 34, padding: '0 9px', border: '1px solid #d8dee5', borderRadius: 8, background: '#fff', fontSize: 11.5 };
const tableHeader = { background: '#f6f8fa', color: '#74818d', fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' };
const assetGrid = { display: 'grid', gridTemplateColumns: '2fr 1fr .8fr 1fr 1.1fr 1fr .85fr', gap: 11, padding: '10px 13px', alignItems: 'center', borderTop: '1px solid #edf0f3', fontSize: 11 };
const expenseGrid = { display: 'grid', gridTemplateColumns: '.75fr .95fr 1.5fr 1fr .8fr .9fr', gap: 9, padding: '9px 12px', alignItems: 'center', borderTop: '1px solid #edf0f3', fontSize: 10.5 };
