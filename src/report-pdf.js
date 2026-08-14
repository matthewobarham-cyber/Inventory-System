import { money } from './data.js';

const loadImage = (src) => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Could not load ${src}`)); image.src = src; });
let brandingPromise;
function branding() {
  if (brandingPromise) return brandingPromise;
  brandingPromise = loadImage('brand/msbm-lockup.png').then((logo) => {
    const canvas = document.createElement('canvas'); canvas.width = logo.naturalWidth; canvas.height = logo.naturalHeight; canvas.getContext('2d').drawImage(logo, 0, 0);
    return canvas.toDataURL('image/png');
  });
  return brandingPromise;
}
const clean = (value) => String(value || '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
const short = (value, length = 35) => String(value ?? '—').length > length ? `${String(value).slice(0, length - 1)}…` : String(value ?? '—');

export async function generateManagementReportPdf(report) {
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), branding()]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const sections = report.options?.sections || { overview: true, categories: true, locations: true, assets: true, maintenance: true, commitments: true };
  doc.setProperties({ title: report.title, subject: `Inventory report as at ${report.filters.asOf}`, author: 'MSBM IT Inventory System', creator: 'MSBM IT Inventory System' });
  let page = 0; let y = 0;
  const addHeader = () => {
    page += 1;
    doc.setFillColor(247, 250, 253); doc.rect(0, 0, 210, 27, 'F');
    doc.addImage(logo, 'PNG', 10, 2.5, 45, 23);
    doc.setFillColor(9, 48, 94); doc.rect(128, 0, 82, 27, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text('MANAGEMENT & ACCOUNTING REPORT', 202, 10, { align: 'right' });
    doc.setFont('courier', 'normal'); doc.setFontSize(7); doc.text(`AS AT ${report.filters.asOf}`, 202, 17, { align: 'right' });
    doc.setDrawColor(193, 28, 48); doc.setLineWidth(.7); doc.line(0, 27, 210, 27); y = 34;
  };
  const newPageIf = (height) => { if (y + height > 278) { doc.addPage(); addHeader(); } };
  const heading = (text) => { newPageIf(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(9, 48, 94); doc.text(text.toUpperCase(), 12, y); doc.setDrawColor(190, 202, 214); doc.line(12, y + 2, 198, y + 2); y += 7; };
  const row = (values, widths, options = {}) => {
    newPageIf(options.height || 7); const height = options.height || 7; let x = 12;
    if (options.header) { doc.setFillColor(237, 242, 247); doc.rect(12, y - 4.5, 186, height, 'F'); }
    doc.setFont('helvetica', options.header || options.bold ? 'bold' : 'normal'); doc.setFontSize(options.header ? 6.2 : 7); doc.setTextColor(options.header ? 84 : 45, options.header ? 98 : 58, options.header ? 112 : 71);
    values.forEach((value, index) => { doc.text(short(value, options.max?.[index] || 34), x + 1.5, y); x += widths[index]; });
    if (!options.header) { doc.setDrawColor(235, 239, 243); doc.line(12, y + 2, 198, y + 2); }
    y += height;
  };
  const metric = (label, value, x, width = 43) => { doc.setFillColor(246, 248, 250); doc.roundedRect(x, y, width, 18, 1.5, 1.5, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(5.8); doc.setTextColor(104, 118, 132); doc.text(label.toUpperCase(), x + 3, y + 5); doc.setFontSize(10); doc.setTextColor(21, 48, 73); doc.text(short(value, 20), x + 3, y + 13); };

  addHeader();
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(27, 42, 56); doc.text(report.title, 12, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(91, 105, 119);
  doc.text(`Period: ${report.filters.from} to ${report.filters.to}   |   Valuation date: ${report.filters.asOf}`, 12, y); y += 5;
  doc.text(`Category: ${report.filters.category}   |   Location: ${report.filters.location}   |   Status: ${report.filters.status}`, 12, y); y += 9;
  if (sections.overview) {
    heading('Executive financial position');
    metric('Historical cost', money(report.summary.costBasis), 12); metric('Accum. depreciation', money(report.summary.accumulatedDepreciation), 59); metric('Net book value', money(report.summary.bookValue), 106); metric('Open commitments', money(report.summary.commitments + report.summary.openRepairEstimate), 153, 45); y += 24;
    row(['Inventory records', report.summary.records, 'Units', report.summary.units, 'Utilisation', `${Math.round(report.summary.utilisation * 100)}%`], [35, 20, 30, 20, 35, 46], { bold: true });
    row(['Period acquisitions', money(report.summary.periodAcquisitions), 'Completed repairs', money(report.summary.completedRepairExpense), 'Annual depreciation', money(report.summary.annualDepreciation)], [35, 30, 35, 30, 35, 21]); y += 5;
  }

  if (sections.categories) {
    heading('Asset value by category');
    row(['Category', 'Units', 'Historical cost', 'Accum. depr.', 'Net book value'], [65, 20, 35, 32, 34], { header: true });
    report.categoryRows.forEach((entry) => row([entry.name, entry.units, money(entry.costBasis), money(entry.depreciation), money(entry.bookValue)], [65, 20, 35, 32, 34])); y += 4;
  }
  if (sections.locations) {
    heading('Asset value by location');
    row(['Location', 'Units', 'Historical cost', 'Net book value'], [75, 25, 43, 43], { header: true });
    report.locationRows.forEach((entry) => row([entry.name, entry.units, money(entry.costBasis), money(entry.bookValue)], [75, 25, 43, 43])); y += 4;
  }

  if (sections.assets) {
    heading(report.options?.assetDetail === 'exceptions' ? 'Asset exceptions requiring attention' : 'Detailed fixed-asset schedule');
    row(['Asset / tag', 'Status', 'Acquired', 'Cost', 'Accum. depr.', 'Book value'], [66, 25, 24, 24, 25, 22], { header: true });
    report.assetRows.forEach((entry) => row([`${entry.name} · ${entry.tag}`, entry.status, entry.purchased || '—', money(entry.costBasis), money(entry.accumulatedDepreciation), money(entry.bookValue)], [66, 25, 24, 24, 25, 22], { max: [42, 16, 12, 15, 15, 15] }));
    if (!report.assetRows.length) row(['No asset exceptions match the selected scope.'], [186]); y += 4;
  }

  if (sections.depreciation) {
    heading('Depreciation roll-forward by category');
    row(['Category', 'Historical cost', 'Accum. depr.', 'Period depr.', 'Net book value'], [57, 36, 32, 29, 32], { header: true });
    (report.depreciationRows || []).forEach((entry) => row([entry.name, money(entry.costBasis), money(entry.depreciation), money(entry.periodDepreciation), money(entry.bookValue)], [57, 36, 32, 29, 32], { max: [34, 18, 18, 18, 18] }));
    if (!report.depreciationRows?.length) row(['No depreciation schedule is available for this scope.'], [186]);
    y += 4;
  }

  if (sections.maintenance) {
    heading('Maintenance cost ledger');
    row(['Date / ticket', 'Asset', 'Vendor', 'Status', 'Parts', 'Labor', 'Total'], [31, 42, 29, 24, 20, 20, 20], { header: true });
    report.expenseRows.forEach((entry) => row([`${entry.date} ${entry.id}`, entry.itemName, entry.vendor || 'Internal', entry.status, money(entry.parts), money(entry.labor), money(entry.total)], [31, 42, 29, 24, 20, 20, 20], { max: [22, 27, 18, 16, 13, 13, 13] }));
    if (!report.expenseRows.length) row(['No maintenance expenses in the selected period.'], [186]); y += 4;
  }

  if (sections.commitments) {
    heading('Open purchase commitments');
    row(['Order / item', 'Supplier', 'Status', 'Remaining', 'Commitment'], [57, 47, 27, 25, 30], { header: true });
    report.pendingOrders.forEach((order) => row([`${order.requisitionNumber || order.id} · ${order.name}`, order.supplier, order.status, order.remainingQty ?? order.qty, money(Number(order.unitCost || 0) * Number(order.remainingQty ?? order.qty ?? 0))], [57, 47, 27, 25, 30]));
    if (!report.pendingOrders.length) row(['No open purchase commitments in the selected scope.'], [186]); y += 5;
  }

  if (sections.disposals) {
    heading('Completed disposal accounting');
    row(['Date / type', 'Asset', 'Method', 'Book value', 'Proceeds', 'Loss / gain'], [31, 45, 39, 24, 23, 24], { header: true });
    (report.disposalRows || []).forEach((entry) => row([`${entry.effectiveDate} ${entry.type}`, `${entry.itemName} ${entry.itemTag}`, entry.disposalMethod || entry.vendor || 'Not recorded', money(entry.carryingValue), money(entry.proceeds), entry.gain ? `${money(entry.gain)} gain` : `${money(entry.loss)} loss`], [31, 45, 39, 24, 23, 24], { max: [20, 28, 24, 14, 14, 15] }));
    if (!report.disposalRows?.length) row(['No completed disposals fall within the selected period.'], [186]);
    y += 4;
  }

  if (sections.journal) {
    heading('General ledger journal worksheet');
    row(['Date / source', 'Memo', 'Debit account', 'Credit account', 'Amount'], [32, 49, 39, 39, 27], { header: true });
    (report.journalRows || []).forEach((entry) => row([`${entry.date} ${entry.source}`, entry.memo, entry.debitAccount, entry.creditAccount, money(entry.debit)], [32, 49, 39, 39, 27], { max: [20, 30, 24, 24, 16] }));
    if (!report.journalRows?.length) row(['No journal activity was calculated for this period.'], [186]);
    y += 4;
  }

  if (sections.controls) {
    heading('Reconciliation and data-quality controls');
    row(['Severity', 'Asset', 'Asset tag', 'Control exception'], [27, 55, 42, 62], { header: true });
    (report.controlRows || []).forEach((entry) => row([entry.severity, entry.itemName, entry.tag || 'Not recorded', entry.issue], [27, 55, 42, 62], { max: [14, 34, 24, 38] }));
    if (!report.controlRows?.length) row(['No reconciliation exceptions were detected.'], [186]);
    y += 4;
  }

  heading('Reporting basis and limitations');
  const notes = 'Management report in JMD. Historical cost equals recorded unit cost multiplied by quantity. Consumable inventory remains at recorded cost; serialized fixed assets use configured straight-line depreciation, useful life and salvage value. Completed repair tickets are treated as period expense; open repair values and pending purchase orders are commitments and are not posted expenditure. This operational report is not a substitute for the institution’s general ledger or audited financial statements.';
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(63, 77, 91); const lines = doc.splitTextToSize(notes, 184); newPageIf(lines.length * 4 + 4); doc.text(lines, 13, y); y += lines.length * 4;

  const pages = doc.getNumberOfPages();
  for (let index = 1; index <= pages; index += 1) { doc.setPage(index); doc.setDrawColor(220, 226, 232); doc.line(12, 283, 198, 283); doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(110, 123, 136); doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()} · MSBM IT Inventory System`, 12, 288); doc.text(`Page ${index} of ${pages}`, 198, 288, { align: 'right' }); }
  const filename = `MSBM-Inventory-Report-${clean(report.filters.asOf)}.pdf`;
  if (window.api?.openPrintPreview) { const result = await window.api.openPrintPreview(new Uint8Array(doc.output('arraybuffer')), filename); if (!result?.ok) throw new Error(result?.error || 'The report preview could not be opened.'); }
  else window.open(doc.output('bloburl'), '_blank', 'noopener,noreferrer');
  return filename;
}
