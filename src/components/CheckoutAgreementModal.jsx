import { useEffect, useRef, useState } from 'react';
import { longDate } from '../data.js';
import { IconX } from '../icons.jsx';

function SignaturePad({ label, value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.width, canvas.height);
      image.src = value;
    }
  }, [value]);

  const point = (event) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) * (canvas.width / bounds.width), y: (event.clientY - bounds.top) * (canvas.height / bounds.height) };
  };
  const start = (event) => {
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = canvasRef.current.getContext('2d');
    const p = point(event);
    context.beginPath();
    context.moveTo(p.x, p.y);
  };
  const move = (event) => {
    if (!drawing.current) return;
    const context = canvasRef.current.getContext('2d');
    const p = point(event);
    context.lineWidth = 2.4;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#14273a';
    context.lineTo(p.x, p.y);
    context.stroke();
  };
  const finish = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#536373', letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</span>
        <button type="button" className="btn-link checkout-agreement-controls" onClick={() => onChange('')} style={{ fontSize: 10.5 }}>Clear</button>
      </div>
      <canvas ref={canvasRef} width="520" height="150" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}
        style={{ width: '100%', height: 92, display: 'block', touchAction: 'none', background: '#fff', border: '1px solid #cfd8e1', borderRadius: 5, cursor: 'crosshair' }} />
    </div>
  );
}

async function checkoutBranding() {
  const [logo, crest] = await Promise.all([
    loadImage('brand/msbm-lockup.png'),
    loadImage('brand/msbm-crest.png')
  ]);

  const header = document.createElement('canvas');
  header.width = 1200;
  header.height = 375;
  const headerContext = header.getContext('2d');
  const gradient = headerContext.createLinearGradient(0, 0, header.width, 0);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(.66, '#ffffff');
  gradient.addColorStop(1, '#0a3d7c');
  headerContext.fillStyle = gradient;
  headerContext.fillRect(0, 0, header.width, header.height);
  const logoHeight = 315;
  const logoWidth = logoHeight * (logo.naturalWidth / logo.naturalHeight);
  headerContext.drawImage(logo, 48, 30, logoWidth, logoHeight);

  const watermark = document.createElement('canvas');
  watermark.width = 512;
  watermark.height = 704;
  const watermarkContext = watermark.getContext('2d');
  watermarkContext.globalAlpha = .055;
  watermarkContext.drawImage(crest, 0, 0, watermark.width, watermark.height);

  return {
    header: header.toDataURL('image/png'),
    watermark: watermark.toDataURL('image/png')
  };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The MSBM branding could not be loaded.'));
    image.src = url;
  });
}

export default function CheckoutAgreementModal({ agreement, onProceed, onClose }) {
  const [borrowerSignature, setBorrowerSignature] = useState('');
  const [tsrSignature, setTsrSignature] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    setBorrowerSignature(agreement?.borrowerSignature || '');
    setTsrSignature(agreement?.tsrSignature || '');
  }, [agreement?.agreementNumber]);

  if (!agreement) return null;
  const { item } = agreement;

  const downloadPdf = async (openPreview = false) => {
    openPreview = openPreview === true;
    setPdfBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const branding = await checkoutBranding();
      doc.setFillColor(10, 61, 124);
      doc.rect(0, 0, 210, 25, 'F');
      doc.addImage(branding.header, 'PNG', 0, 0, 82, 25);
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('EQUIPMENT CHECKOUT AGREEMENT', 196, 12, { align: 'right' });
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.text(agreement.agreementNumber, 196, 18, { align: 'right' });

      doc.addImage(branding.watermark, 'PNG', 50, 106, 110, 151);

      doc.setTextColor(24, 36, 48);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(item.name, 14, 39);
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(10, 61, 124);
      doc.text(`${item.tag}  |  ${item.serial || 'Serial not recorded'}`, 14, 45);

      const fields = [
        ['Borrower', agreement.borrower], ['Issued by (TSR)', agreement.loanedBy],
        ['Checked out', longDate(agreement.checkedOutOn)], ['Due back', longDate(agreement.due)],
        ['Expected loan period', `${agreement.period} days`], ['Condition at issue', item.condition],
        ['Location of record', `${item.location} · ${item.room}`], ['Assignment', item.assignedTo || 'Temporary equipment loan']
      ];
      let y = 55;
      fields.forEach(([label, value], index) => {
        const column = index % 2;
        const x = 14 + column * 92;
        if (column === 0 && index > 0) y += 18;
        doc.setFillColor(246, 248, 250);
        doc.roundedRect(x, y, 86, 14, 2, 2, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(105, 119, 132); doc.text(label.toUpperCase(), x + 4, y + 5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(35, 48, 61); doc.text(String(value), x + 4, y + 11);
      });

      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(24, 36, 48); doc.text('BORROWER RESPONSIBILITIES', 14, 137);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(66, 79, 91);
      const obligations = [
        'I accept responsibility for the equipment listed above while it is issued to me.',
        'I will protect it from loss, theft, damage, and unauthorized use and will not transfer it to another person.',
        'I will return the equipment, including accessories, by the due date and report any issue immediately.',
        'I understand that the equipment remains the property of The University of the West Indies.'
      ];
      obligations.forEach((text, index) => doc.text(`${index + 1}.  ${text}`, 17, 145 + index * 8));

      doc.setDrawColor(207, 216, 225);
      doc.line(14, 183, 196, 183);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(83, 99, 115);
      doc.text('BORROWER SIGNATURE', 14, 191); doc.text('TSR SIGNATURE', 108, 191);
      doc.setDrawColor(207, 216, 225);
      doc.roundedRect(14, 195, 80, 29, 2, 2, 'S'); doc.roundedRect(108, 195, 80, 29, 2, 2, 'S');
      if (borrowerSignature) doc.addImage(borrowerSignature, 'PNG', 14, 195, 80, 25);
      if (tsrSignature) doc.addImage(tsrSignature, 'PNG', 108, 195, 80, 25);

      doc.setFillColor(238, 244, 251); doc.roundedRect(14, 245, 182, 24, 3, 3, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(10, 61, 124); doc.text('RETURN THIS EQUIPMENT BY', 20, 253);
      doc.setFontSize(16); doc.text(longDate(agreement.due), 20, 263);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(83, 99, 115); doc.text(`${agreement.period}-day approved loan period`, 190, 260, { align: 'right' });
      doc.setFontSize(7.5); doc.setTextColor(120, 132, 143); doc.text('MSBM IT Inventory System · Equipment custody record', 105, 288, { align: 'center' });
      const fileName = `Checkout-Agreement-${item.tag}.pdf`;
      if (openPreview) {
        if (window.api?.openPrintPreview) {
          const result = await window.api.openPrintPreview(new Uint8Array(doc.output('arraybuffer')), fileName);
          if (!result?.ok) throw new Error(result?.error || 'The PDF preview could not be opened.');
        } else {
          window.open(doc.output('bloburl'), '_blank', 'noopener,noreferrer');
        }
      } else {
        doc.save(fileName);
      }
    } finally {
      setPdfBusy(false);
    }
  };

  const detail = (label, value) => <div style={{ padding: '10px 12px', background: '#f7f9fb', borderRadius: 6 }}><span style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', color: '#788795', textTransform: 'uppercase' }}>{label}</span><span style={{ display: 'block', marginTop: 4, fontSize: 12, fontWeight: 500, color: '#263746' }}>{value}</span></div>;

  return (
    <div className="checkout-agreement-backdrop" role="dialog" aria-modal="true" aria-label="Equipment checkout agreement preview">
      <div className="checkout-agreement-modal">
        <div className="checkout-agreement-controls" style={{ height: 72, minHeight: 72, flex: 'none', padding: '0 20px 0 22px', display: 'flex', alignItems: 'center', gap: 10, background: '#fff', borderBottom: '1px solid #dfe3e9' }}>
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5 }}><strong style={{ fontSize: 15, lineHeight: 1.15 }}>Checkout agreement preview</strong><span style={{ fontSize: 11.5, lineHeight: 1.25, color: '#7b8794' }}>Sign in the boxes below, then print or download the completed PDF.</span></span>
          <button type="button" className="btn-ghost" disabled={pdfBusy} onClick={() => downloadPdf(true)} style={{ height: 38, padding: '0 15px', flex: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Print preview</button>
          {agreement.pending && <button type="button" onClick={() => onProceed({ ...agreement, borrowerSignature, tsrSignature })} style={{ height: 38, padding: '0 17px', flex: 'none', border: '1px solid #12633f', borderRadius: 8, background: '#16794f', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Proceed</button>}
          <button type="button" className="btn-primary" disabled={pdfBusy} onClick={downloadPdf} style={{ height: 34, padding: '0 12px', borderRadius: 7, fontSize: 12, fontWeight: 600 }}>{pdfBusy ? 'Generating…' : 'Download PDF'}</button>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close agreement" style={{ width: 38, height: 38, flex: 'none', display: 'grid', placeItems: 'center', borderRadius: 8 }}><IconX /></button>
        </div>
        <div style={{ padding: 24, overflow: 'auto', background: '#e9edf2' }}>
          <article className="checkout-agreement-sheet">
            <div className="checkout-agreement-watermark" aria-hidden="true"><img src="brand/msbm-crest.png" alt="" /></div>
            <header style={{ margin: '-32px -36px 0', padding: '20px 36px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0a3d7c', color: '#fff' }}>
              <span className="checkout-agreement-logo-panel"><img src="brand/msbm-lockup.png" alt="Mona School of Business & Management" /></span>
              <span style={{ textAlign: 'right' }}><strong style={{ display: 'block', fontSize: 16, letterSpacing: '.03em' }}>EQUIPMENT CHECKOUT AGREEMENT</strong><small style={{ fontFamily: "'IBM Plex Mono',monospace", opacity: .8 }}>{agreement.agreementNumber}</small></span>
            </header>
            <section style={{ padding: '25px 0 19px', borderBottom: '2px solid #0a3d7c' }}>
              <span style={{ fontSize: 21, fontWeight: 700 }}>{item.name}</span>
              <span style={{ marginTop: 5, display: 'block', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#0a3d7c' }}>{item.tag} · {item.serial || 'Serial not recorded'}</span>
            </section>
            <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {detail('Borrower', agreement.borrower)}{detail('Issued by (TSR)', agreement.loanedBy)}
              {detail('Checked out', longDate(agreement.checkedOutOn))}{detail('Due back', longDate(agreement.due))}
              {detail('Expected loan period', `${agreement.period} days`)}{detail('Condition at issue', item.condition)}
              {detail('Location of record', `${item.location} · ${item.room}`)}{detail('Assignment', item.assignedTo || 'Temporary equipment loan')}
            </section>
            <section style={{ marginTop: 21 }}>
              <h3 style={{ margin: 0, fontSize: 11, letterSpacing: '.08em', color: '#263746' }}>BORROWER RESPONSIBILITIES</h3>
              <ol style={{ margin: '9px 0 0', paddingLeft: 20, color: '#465665', fontSize: 10.5, lineHeight: 1.55 }}>
                <li>I accept responsibility for the equipment listed above while it is issued to me.</li>
                <li>I will protect it from loss, theft, damage, and unauthorized use and will not transfer it to another person.</li>
                <li>I will return the equipment, including accessories, by the due date and report any issue immediately.</li>
                <li>I understand that the equipment remains the property of The University of the West Indies.</li>
              </ol>
            </section>
            <section style={{ marginTop: 21, paddingTop: 17, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, borderTop: '1px solid #d8e0e7' }}>
              <SignaturePad label="Borrower signature" value={borrowerSignature} onChange={setBorrowerSignature} />
              <SignaturePad label="TSR signature" value={tsrSignature} onChange={setTsrSignature} />
            </section>
            <section style={{ marginTop: 20, padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eef4fb', borderRadius: 7, color: '#0a3d7c' }}>
              <span><small style={{ display: 'block', fontSize: 9, fontWeight: 700, letterSpacing: '.08em' }}>RETURN THIS EQUIPMENT BY</small><strong style={{ display: 'block', marginTop: 3, fontSize: 17 }}>{longDate(agreement.due)}</strong></span>
              <span style={{ fontSize: 10.5 }}>{agreement.period}-day approved loan period</span>
            </section>
            <footer style={{ marginTop: 'auto', paddingTop: 17, textAlign: 'center', color: '#87939e', fontSize: 9 }}>MSBM IT Inventory System · Equipment custody record</footer>
          </article>
        </div>
      </div>
    </div>
  );
}
