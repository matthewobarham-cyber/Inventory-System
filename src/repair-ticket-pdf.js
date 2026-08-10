import { money } from './data.js';

const loadImage = (src) => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error(`Could not load ${src}`));
  image.src = src;
});

let brandingPromise;
function repairBranding() {
  if (brandingPromise) return brandingPromise;
  brandingPromise = Promise.all([loadImage('brand/msbm-lockup.png'), loadImage('brand/msbm-crest.png')]).then(([lockup, crest]) => {
    const imageData = (image) => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      return canvas.toDataURL('image/png');
    };
    const watermark = document.createElement('canvas');
    watermark.width = 500;
    watermark.height = 690;
    const context = watermark.getContext('2d');
    context.globalAlpha = .035;
    context.drawImage(crest, 0, 0, watermark.width, watermark.height);
    const header = document.createElement('canvas');
    header.width = 1200;
    header.height = 200;
    const headerContext = header.getContext('2d');
    const gradient = headerContext.createLinearGradient(0, 0, header.width, 0);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(.34, '#f7faff');
    gradient.addColorStop(.62, '#8ea9c5');
    gradient.addColorStop(1, '#09305e');
    headerContext.fillStyle = gradient;
    headerContext.fillRect(0, 0, header.width, header.height);
    return { lockup: imageData(lockup), header: header.toDataURL('image/png'), watermark: watermark.toDataURL('image/png') };
  });
  return brandingPromise;
}

const cleanFilePart = (value) => String(value || 'asset').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '');
const displayDate = (value) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';

export async function generateRepairTicketPdf(ticket, { preview = true } = {}) {
  const [{ jsPDF }, branding] = await Promise.all([import('jspdf'), repairBranding()]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: `Repair ticket ${ticket.id}`,
    subject: `${ticket.itemName} (${ticket.itemTag})`,
    author: 'MSBM IT Inventory System',
    creator: 'MSBM IT Inventory System'
  });

  const addPageBranding = (fullHeader = false) => {
    if (fullHeader) {
      doc.addImage(branding.header, 'PNG', 0, 0, 210, 35);
      doc.addImage(branding.lockup, 'PNG', 10, 3.2, 57, 29.6);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('REPAIR & MAINTENANCE', 198, 12, { align: 'right' });
      doc.text('WORK ORDER', 198, 18, { align: 'right' });
      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(230, 237, 244);
      doc.text(ticket.id, 198, 26, { align: 'right' });
      doc.setDrawColor(193, 28, 48);
      doc.setLineWidth(.8);
      doc.line(0, 34.5, 210, 34.5);
    }
    doc.addImage(branding.watermark, 'PNG', 55, 74, 100, 138);
  };

  addPageBranding(true);
  let y = 43;
  doc.setTextColor(29, 43, 57);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(ticket.itemName || 'Asset repair', 14, y);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(10, 61, 124);
  doc.text(`${ticket.itemTag || 'Tag not recorded'}  |  ${ticket.itemSerial || 'Serial not recorded'}`, 14, y + 7);
  doc.setFillColor(ticket.priority === 'Critical' || ticket.priority === 'High' ? 253 : 233, ticket.priority === 'Critical' || ticket.priority === 'High' ? 236 : 239, ticket.priority === 'Critical' || ticket.priority === 'High' ? 235 : 250);
  doc.setTextColor(ticket.priority === 'Critical' || ticket.priority === 'High' ? 160 : 10, ticket.priority === 'Critical' || ticket.priority === 'High' ? 26 : 61, ticket.priority === 'Critical' || ticket.priority === 'High' ? 18 : 124);
  doc.roundedRect(158, y - 7, 38, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`${ticket.priority || 'Normal'} priority`, 177, y, { align: 'center' });
  y += 17;

  const fields = [
    ['Ticket status', ticket.status || 'Open'], ['Work type', ticket.type || 'Repair'],
    ['Created', displayDate(ticket.createdAt)], ['Created by', ticket.createdBy || 'Not recorded'],
    ['Assigned technician', ticket.technician || 'Unassigned'], ['Source', ticket.source || 'Maintenance desk'],
    ['Vendor', ticket.vendor || 'Internal repair'], ['RMA / reference', ticket.rmaNumber || 'Not recorded'],
    ['Expected return', ticket.expectedReturnOn || 'Not scheduled'], ['Previous asset status', ticket.previousStatus || 'In stock']
  ];
  fields.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = column ? 107 : 14;
    const boxY = y + row * 16;
    doc.setFillColor(246, 248, 250);
    doc.setDrawColor(224, 230, 236);
    doc.roundedRect(x, boxY, 89, 13, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.7);
    doc.setTextColor(110, 124, 137);
    doc.text(label.toUpperCase(), x + 4, boxY + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(38, 52, 66);
    doc.text(String(value).slice(0, 48), x + 4, boxY + 10);
  });
  y += Math.ceil(fields.length / 2) * 16 + 2;

  const writeSection = (title, value) => {
    let lines = doc.splitTextToSize(String(value || 'Not recorded'), 174);
    let continued = false;
    do {
      if (y > 255) {
        doc.addPage('a4', 'portrait');
        addPageBranding(false);
        y = 18;
      }
      const availableLines = Math.max(1, Math.floor((270 - y - 12) / 4.3));
      const chunk = lines.splice(0, availableLines);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(10, 61, 124);
      doc.text(`${title.toUpperCase()}${continued ? ' (CONTINUED)' : ''}`, 14, y);
      doc.setDrawColor(192, 204, 216);
      doc.line(14, y + 2.5, 196, y + 2.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(48, 62, 76);
      doc.text(chunk, 14, y + 8);
      y += 11 + chunk.length * 4.3;
      continued = true;
    } while (lines.length);
    y += 4;
  };

  writeSection('Fault / required work', ticket.faultDescription);
  if (ticket.resolution) writeSection('Resolution / work completed', ticket.resolution);
  writeSection('Vendor and logistics', `Vendor: ${ticket.vendor || 'Internal repair'}\nContact: ${ticket.vendorContact || 'Not recorded'}\nSent to vendor: ${ticket.sentToVendorOn || 'Not sent'}\nExpected return: ${ticket.expectedReturnOn || 'Not scheduled'}\nReturned: ${ticket.returnedOn || 'Not returned'}`);

  if (y > 225) {
    doc.addPage('a4', 'portrait');
    addPageBranding(false);
    y = 18;
  }
  const total = Number(ticket.partsCost || 0) + Number(ticket.laborCost || 0);
  doc.setFillColor(239, 244, 250);
  doc.setDrawColor(205, 216, 228);
  doc.roundedRect(14, y, 182, 24, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(68, 82, 96);
  doc.setFontSize(8);
  doc.text('ESTIMATED / RECORDED COST', 19, y + 7);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(`Parts ${money(ticket.partsCost || 0)}   Labor ${money(ticket.laborCost || 0)}`, 19, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(10, 61, 124);
  doc.text(money(total), 191, y + 15, { align: 'right' });
  y += 34;
  doc.setDrawColor(150, 162, 174);
  doc.line(14, y + 14, 90, y + 14);
  doc.line(120, y + 14, 196, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(105, 118, 131);
  doc.text('TECHNICIAN SIGNATURE / DATE', 14, y + 19);
  doc.text('REQUESTOR / SUPERVISOR SIGN-OFF', 120, y + 19);

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(219, 226, 232);
    doc.line(14, 282, 196, 282);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(112, 125, 138);
    doc.text('MSBM IT Inventory System · Controlled maintenance record', 14, 287);
    doc.text(`Page ${page} of ${pages}`, 196, 287, { align: 'right' });
  }

  const filename = `MSBM-Repair-${cleanFilePart(ticket.id)}-${cleanFilePart(ticket.itemTag)}.pdf`;
  let savedPath = '';
  if (preview) {
    if (window.api?.openPrintPreview) {
      const result = await window.api.openPrintPreview(new Uint8Array(doc.output('arraybuffer')), filename);
      if (!result?.ok) throw new Error(result?.error || 'The repair ticket PDF preview could not be opened.');
    } else {
      window.open(doc.output('bloburl'), '_blank', 'noopener,noreferrer');
    }
  } else if (window.api?.saveMaintenancePdf) {
    const result = await window.api.saveMaintenancePdf(new Uint8Array(doc.output('arraybuffer')), filename);
    if (!result?.ok) throw new Error(result?.error || 'The repair ticket PDF could not be saved.');
    savedPath = result.path || '';
  } else doc.save(filename);
  return { filename, path: savedPath };
}
