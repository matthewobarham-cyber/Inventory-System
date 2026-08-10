import { money } from './data.js';
import { jsPDF } from 'jspdf';

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Could not load ${src}`));
  image.src = src;
});

let brandingPromise;
const branding = () => brandingPromise || (brandingPromise = Promise.all([loadImage('brand/msbm-lockup.png'), loadImage('brand/msbm-crest.png')]).then(([lockup, crest]) => {
  const data = (image) => { const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext('2d').drawImage(image, 0, 0); return canvas.toDataURL('image/png'); };
  const watermark = document.createElement('canvas'); watermark.width = 520; watermark.height = 700;
  const context = watermark.getContext('2d'); context.globalAlpha = .032; context.drawImage(crest, 0, 0, 520, 700);
  return { lockup: data(lockup), watermark: watermark.toDataURL('image/png') };
}));

const safe = (value) => String(value || 'order').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');

export async function generateOrderApprovalPdf(order, { preview = true } = {}) {
  const brand = await branding();
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const requisition = order.requisitionNumber || order.reference || 'Not assigned';
  const poNumber = order.purchaseOrderNumber || 'Pending Oracle Banner processing';
  doc.setProperties({ title: `Procurement approval ${requisition}`, subject: `${order.name} from ${order.supplier}`, author: 'MSBM IT Inventory System', creator: 'MSBM IT Inventory System' });

  const gradient = document.createElement('canvas'); gradient.width = 1200; gradient.height = 210;
  const gx = gradient.getContext('2d'); const fill = gx.createLinearGradient(0, 0, gradient.width, 0); fill.addColorStop(0, '#ffffff'); fill.addColorStop(.36, '#f7faff'); fill.addColorStop(.66, '#89a8c8'); fill.addColorStop(1, '#09305e'); gx.fillStyle = fill; gx.fillRect(0, 0, gradient.width, gradient.height);
  doc.addImage(gradient.toDataURL('image/png'), 'PNG', 0, 0, 210, 37);
  doc.addImage(brand.lockup, 'PNG', 10, 3.5, 57, 29.5);
  doc.addImage(brand.watermark, 'PNG', 54, 72, 102, 138);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text('PROCUREMENT APPROVAL', 198, 13, { align: 'right' }); doc.setFontSize(9); doc.text('IT EQUIPMENT REORDER REQUEST', 198, 20, { align: 'right' });
  doc.setDrawColor(193, 28, 48); doc.setLineWidth(.8); doc.line(0, 36.5, 210, 36.5);

  let y = 46;
  doc.setTextColor(27, 42, 58); doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.text(order.name || 'Equipment order', 14, y);
  doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(10, 61, 124); doc.text(`${requisition}  |  ${order.tag || 'No asset tag'}`, 14, y + 7);
  y += 17;

  const fields = [
    ['Requisition number', requisition], ['PO number', poNumber],
    ['Approved vendor', order.supplier], ['Vendor number', order.vendorNumber || 'Not recorded'],
    ['Vendor email', order.vendorEmail || 'Not recorded'], ['Vendor contact', order.vendorContact || 'Not recorded'],
    ['Requested by', order.orderedBy || 'Not recorded'], ['Date raised', order.orderedOn || 'Not recorded'],
    ['Expected delivery', order.expectedOn || 'Not recorded'], ['Destination', `${order.location || 'Unassigned'} · ${order.room || 'Unassigned'}`]
  ];
  fields.forEach(([label, value], index) => {
    const x = index % 2 ? 107 : 14; const boxY = y + Math.floor(index / 2) * 16;
    doc.setFillColor(247, 249, 251); doc.setDrawColor(224, 230, 236); doc.roundedRect(x, boxY, 89, 13, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.7); doc.setTextColor(105, 119, 133); doc.text(label.toUpperCase(), x + 4, boxY + 4.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3); doc.setTextColor(38, 52, 66); doc.text(String(value || 'Not recorded').slice(0, 50), x + 4, boxY + 10);
  });
  y += 88;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(10, 61, 124); doc.text('ORDER SUMMARY', 14, y);
  y += 5; doc.setFillColor(10, 61, 124); doc.rect(14, y, 182, 9, 'F');
  doc.setTextColor(255, 255, 255); doc.setFontSize(7.5); doc.text('ITEM', 18, y + 6); doc.text('QTY', 126, y + 6, { align: 'right' }); doc.text('UNIT COST', 158, y + 6, { align: 'right' }); doc.text('TOTAL', 192, y + 6, { align: 'right' });
  y += 9; doc.setFillColor(248, 250, 252); doc.setDrawColor(220, 226, 232); doc.rect(14, y, 182, 18, 'FD');
  doc.setTextColor(40, 53, 67); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.text(String(order.name || '').slice(0, 58), 18, y + 7); doc.setFontSize(7); doc.text(String(order.tag || ''), 18, y + 13);
  doc.setFont('courier', 'normal'); doc.setFontSize(8.5); doc.text(String(order.qty || 0), 126, y + 10, { align: 'right' }); doc.text(money(order.unitCost || 0), 158, y + 10, { align: 'right' }); doc.setFont('courier', 'bold'); doc.text(money(Number(order.qty || 0) * Number(order.unitCost || 0)), 192, y + 10, { align: 'right' });
  y += 26;

  const notes = doc.splitTextToSize(order.notes || 'No additional order or delivery instructions.', 174);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(10, 61, 124); doc.text('BUSINESS JUSTIFICATION / NOTES', 14, y); doc.setDrawColor(194, 205, 216); doc.line(14, y + 2.5, 196, y + 2.5);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(47, 61, 75); doc.setFontSize(8.5); doc.text(notes.slice(0, 8), 14, y + 9); y += 17 + Math.min(notes.length, 8) * 4;

  doc.setFillColor(239, 244, 250); doc.setDrawColor(204, 216, 228); doc.roundedRect(14, y, 182, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setTextColor(67, 82, 97); doc.setFontSize(8); doc.text('TOTAL COMMITMENT REQUESTED', 19, y + 7);
  doc.setTextColor(10, 61, 124); doc.setFont('courier', 'bold'); doc.setFontSize(15); doc.text(money(Number(order.qty || 0) * Number(order.unitCost || 0)), 191, y + 13, { align: 'right' });
  y += 32;
  [['IT MANAGER REVIEW / DATE', 14, 91], ['MANAGEMENT APPROVAL / DATE', 105, 196]].forEach(([label, x1, x2]) => { doc.setDrawColor(142, 156, 170); doc.line(x1, y + 10, x2, y + 10); doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(100, 114, 128); doc.text(label, x1, y + 15); });

  doc.setDrawColor(219, 226, 232); doc.line(14, 282, 196, 282); doc.setFontSize(7); doc.setTextColor(110, 124, 138); doc.text('MSBM IT Inventory System · Management approval copy', 14, 287); doc.text('Page 1 of 1', 196, 287, { align: 'right' });
  const filename = `MSBM-Procurement-Approval-${safe(requisition)}.pdf`;
  let savedPath = '';
  if (preview) {
    if (window.api?.openPrintPreview) { const result = await window.api.openPrintPreview(new Uint8Array(doc.output('arraybuffer')), filename); if (!result?.ok) throw new Error(result?.error || 'The approval PDF could not be opened.'); }
    else window.open(doc.output('bloburl'), '_blank', 'noopener,noreferrer');
  } else if (window.api?.saveProcurementPdf) {
    const result = await window.api.saveProcurementPdf(new Uint8Array(doc.output('arraybuffer')), filename);
    if (!result?.ok) throw new Error(result?.error || 'The approval PDF could not be saved.');
    savedPath = result.path || '';
  } else doc.save(filename);
  return { filename, path: savedPath };
}
