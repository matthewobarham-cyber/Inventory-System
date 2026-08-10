import { useEffect, useMemo, useState } from 'react';
import { IconX } from '../icons.jsx';
import { generateRepairTicketPdf } from '../repair-ticket-pdf.js';
import { money } from '../data.js';
import { openOutlookCompose } from '../outlook.js';

const field = { height: 39, padding: '0 10px', border: '1px solid #d7e0e7', borderRadius: 9, background: '#fff', fontSize: 12 };

export default function MaintenanceEmailModal({ ticket, sender, contacts = [], onAddContact, onPrepared, onClose }) {
  const recipients = useMemo(() => contacts.filter((contact) => contact.email).sort((a, b) => a.name.localeCompare(b.name)), [contacts]);
  const [form, setForm] = useState({ contactId: '', to: '', cc: '', subject: '', body: '' });
  const [pdf, setPdf] = useState({ status: 'idle', filename: '', path: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', title: '' });

  useEffect(() => {
    if (!ticket) return undefined;
    const assigned = recipients.find((contact) => contact.name.toLowerCase() === String(ticket.technician || '').toLowerCase()) || null;
    const totalCost = Number(ticket.partsCost || 0) + Number(ticket.laborCost || 0);
    const created = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'Not recorded';
    const latestActivity = (ticket.activity || []).slice(-5).reverse().map((entry) => `• ${entry.at ? new Date(entry.at).toLocaleString() : 'Date not recorded'} — ${entry.by || 'System'}: ${entry.text}`).join('\n') || 'No additional activity recorded.';
    const message = `Dear ${assigned?.name || 'Colleague'},

Please review the attached MSBM repair and maintenance work order. The key service information is included below for immediate reference.

MAINTENANCE TICKET
Ticket number: ${ticket.id}
Work type: ${ticket.type || 'Repair'}
Priority: ${ticket.priority || 'Normal'}
Current status: ${ticket.status || 'Open'}
Created: ${created}
Created by: ${ticket.createdBy || 'Not recorded'}

ASSET INFORMATION
Asset: ${ticket.itemName || 'Not recorded'}
Asset tag: ${ticket.itemTag || 'Not recorded'}
Serial number: ${ticket.itemSerial || 'Not recorded'}
Location: ${ticket.itemLocation || 'Not recorded'}${ticket.itemRoom ? ` · ${ticket.itemRoom}` : ''}
Previous inventory status: ${ticket.previousStatus || 'Not recorded'}

FAULT / REQUIRED WORK
${String(ticket.faultDescription || 'No fault description recorded.').slice(0, 1400)}

ASSIGNMENT
Assigned technician: ${ticket.technician || 'Unassigned'}
Repair route: ${ticket.vendor || 'Internal repair'}
Vendor contact: ${ticket.vendorContact || 'Not recorded'}
RMA / repair reference: ${ticket.rmaNumber || 'Not recorded'}

SERVICE LOGISTICS
Sent to vendor: ${ticket.sentToVendorOn || 'Not sent'}
Expected return: ${ticket.expectedReturnOn || 'Not scheduled'}
Returned: ${ticket.returnedOn || 'Not returned'}

COST SUMMARY
Parts: ${money(ticket.partsCost || 0)}
Labor: ${money(ticket.laborCost || 0)}
Total recorded cost: ${money(totalCost)}

RESOLUTION / WORK COMPLETED
${String(ticket.resolution || 'No resolution has been recorded; the ticket remains open for updates.').slice(0, 1400)}

SUPPORTING RECORDS
Photographs recorded in the maintenance ticket: ${(ticket.photos || []).length}
Recent ticket activity:
${latestActivity}

Please reference ticket ${ticket.id} in all correspondence and reply with diagnosis, work performed, parts used, revised completion date, or vendor updates so the maintenance record can be kept current.

Regards,
${sender?.name || 'MSBM IT Services'}
${sender?.title || sender?.role || 'IT Services'}
${sender?.email || ''}`;
    setForm({
      contactId: assigned?.id || '', to: assigned?.email || '', cc: '',
      subject: `Maintenance ticket ${ticket.id}: ${ticket.itemName} (${ticket.itemTag})`,
      body: message
    });
    setError('');
    setAdding(false);
    setNewContact({ name: '', email: '', title: '' });
    setPdf({ status: 'saving', filename: '', path: '' });
    let cancelled = false;
    generateRepairTicketPdf(ticket, { preview: false }).then((result) => {
      if (!cancelled) setPdf({ status: 'saved', filename: result.filename, path: result.path });
    }).catch((caught) => {
      if (!cancelled) { setPdf({ status: 'error', filename: '', path: '' }); setError(caught.message || 'The maintenance PDF could not be saved.'); }
    });
    return () => { cancelled = true; };
  }, [ticket?.id]);

  if (!ticket) return null;

  const selectRecipient = (id) => {
    if (id === '__add__') { setAdding(true); setNewContact({ name: '', email: '', title: '' }); setError(''); return; }
    const contact = recipients.find((entry) => entry.id === id) || null;
    setForm((current) => ({ ...current, contactId: id, to: contact?.email || '', body: current.body.replace(/^Dear [^,\n]+,/i, `Dear ${contact?.name || 'Colleague'},`) }));
    setError('');
  };

  const saveNewContact = () => {
    const result = onAddContact?.(newContact);
    if (!result || result.error) { setError(result?.error || 'The contact could not be saved.'); return; }
    const contact = result.contact;
    setForm((current) => ({ ...current, contactId: contact.id, to: contact.email, body: current.body.replace(/^Dear [^,\n]+,/i, `Dear ${contact.name},`) }));
    setAdding(false);
    setNewContact({ name: '', email: '', title: '' });
    setError('');
  };

  const retryPdf = async () => {
    setPdf({ status: 'saving', filename: '', path: '' }); setError('');
    try { const result = await generateRepairTicketPdf(ticket, { preview: false }); setPdf({ status: 'saved', filename: result.filename, path: result.path }); }
    catch (caught) { setPdf({ status: 'error', filename: '', path: '' }); setError(caught.message || 'The maintenance PDF could not be saved.'); }
  };

  const openOutlook = async () => {
    const to = form.to.trim();
    if (!/^\S+@\S+\.\S+$/.test(to)) { setError('Enter a valid recipient email address.'); return; }
    if (!form.subject.trim() || !form.body.trim()) { setError('Enter both a subject and message.'); return; }
    if (pdf.status !== 'saved') { setError('Wait for the maintenance PDF to finish saving before opening Outlook.'); return; }
    setBusy(true); setError('');
    try {
      const result = await openOutlookCompose({ to, cc: form.cc, subject: form.subject, body: form.body });
      if (result?.ok === false) throw new Error(result.error || 'Outlook Web could not be opened.');
      onPrepared?.({ to, cc: form.cc.trim(), subject: form.subject.trim(), filename: pdf.filename, path: pdf.path, bodyCopied: false });
      onClose();
    } catch (caught) { setError(caught.message || 'The Outlook handoff could not be prepared.'); }
    finally { setBusy(false); }
  };

  return <div className="maintenance-email-backdrop"><div className="maintenance-email-modal">
    <header><span><small>OUTLOOK HANDOFF</small><strong>Email maintenance work order</strong><p>{ticket.id} · {ticket.itemName} · {ticket.itemTag}</p></span><button type="button" className="btn-ghost" onClick={onClose} aria-label="Close"><IconX /></button></header>
    <div className="maintenance-email-content">
      <div className="maintenance-email-file" data-status={pdf.status}>
        <span>{pdf.status === 'saving' ? '…' : pdf.status === 'saved' ? 'PDF' : '!'}</span>
        <div>{pdf.status === 'saving' && <><strong>Preparing branded work order</strong><small>Saving to Documents\MSBM IT Inventory\Maintenance Tickets</small></>}{pdf.status === 'saved' && <><strong>Work-order PDF saved</strong><code>{pdf.path || pdf.filename}</code><small>Attach this file in Outlook before sending.</small></>}{pdf.status === 'error' && <><strong>PDF could not be saved</strong><button type="button" className="btn-link" onClick={retryPdf}>Try again</button></>}</div>
      </div>
      <div className="maintenance-email-grid">
        <label><span>Saved recipient</span><select value={form.contactId} onChange={(event) => selectRecipient(event.target.value)} style={field}><option value="">Choose or enter an address below</option>{recipients.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.email}</option>)}<option value="__add__">Add a new contact…</option></select></label>
        <label><span>To</span><input type="email" value={form.to} onChange={(event) => setForm((current) => ({ ...current, contactId: '', to: event.target.value }))} placeholder="technician or vendor email" style={field} /></label>
        {adding && <section className="maintenance-add-contact">
          <span><strong>Add maintenance contact</strong><small>Saved locally for future work orders and Outlook messages.</small></span>
          <label><span>Contact name</span><input value={newContact.name} onChange={(event) => setNewContact((current) => ({ ...current, name: event.target.value }))} style={field} /></label>
          <label><span>Email address</span><input type="email" value={newContact.email} onChange={(event) => setNewContact((current) => ({ ...current, email: event.target.value }))} style={field} /></label>
          <label className="wide"><span>Company / role (optional)</span><input value={newContact.title} onChange={(event) => setNewContact((current) => ({ ...current, title: event.target.value }))} style={field} /></label>
          <div><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button type="button" className="btn-primary" onClick={saveNewContact}>Save and select contact</button></div>
        </section>}
        <label className="wide"><span>CC (optional)</span><input type="email" value={form.cc} onChange={(event) => setForm((current) => ({ ...current, cc: event.target.value }))} style={field} /></label>
        <label className="wide"><span>Subject</span><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} style={field} /></label>
        <label className="wide"><span>Message</span><textarea rows="10" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} /></label>
      </div>
      {error && <div className="maintenance-email-error">{error}</div>}
    </div>
    <footer><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={busy || pdf.status === 'saving'} onClick={openOutlook}>{busy ? 'Opening Outlook…' : 'Open Outlook with PDF'}</button></footer>
  </div></div>;
}
