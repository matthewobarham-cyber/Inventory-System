import { useEffect, useMemo, useState } from 'react';
import { shortDate, today } from '../data.js';
import { IconX } from '../icons.jsx';
import { openOutlookCompose } from '../outlook.js';

const DAY = 86400000;
const validEmail = (value) => /^\S+@\S+\.\S+$/.test(String(value || '').trim());

export default function LoanEmailModal({ item, sender, contacts = [], onAddContact, onPrepared, onClose }) {
  const recipients = useMemo(() => contacts.filter((contact) => validEmail(contact.email)).sort((a, b) => a.name.localeCompare(b.name)), [contacts]);
  const [form, setForm] = useState({ contactId: '', to: '', cc: '', subject: '', body: '' });
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', title: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!item) return;
    const matched = recipients.find((contact) => contact.email.toLowerCase() === String(item.borrowerEmail || '').toLowerCase());
    const dueDate = item.due ? new Date(`${item.due}T12:00:00`) : null;
    const days = dueDate ? Math.ceil((dueDate.getTime() - today().getTime()) / DAY) : null;
    const status = days == null ? 'Return date not recorded' : days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} remaining`;
    const urgency = days != null && days < 0 ? 'Overdue loan reminder' : days != null && days <= 3 ? 'Upcoming equipment return' : 'Equipment loan information';
    setForm({
      contactId: matched?.id || '',
      to: item.borrowerEmail || matched?.email || '',
      cc: '',
      subject: `${urgency}: ${item.name} (${item.tag})`,
      body: `Dear ${item.borrower || matched?.name || 'Borrower'},

This message concerns the MSBM equipment currently issued to you. Please review the loan information below and contact IT Services if any detail is incorrect.

LOAN INFORMATION
Asset: ${item.name || 'Not recorded'}
Asset tag: ${item.tag || 'Not recorded'}
Serial number: ${item.serial || 'Not recorded'}
Equipment type: ${item.category || 'Not recorded'}
Agreement number: ${item.loanAgreement?.agreementNumber || 'Not recorded'}

LOAN PERIOD
Checked out: ${shortDate(item.since)}
Return due: ${shortDate(item.due)}
Current position: ${status}
Issued by: ${item.issuedBy || 'MSBM IT Services'}

RETURN INFORMATION
Please return the equipment to MSBM IT Services by the stated due date with all issued accessories. If an extension is required, reply before the due date so availability and authorization can be reviewed. Report any loss, damage, or operating issue immediately.

Please reference asset tag ${item.tag || 'not recorded'} in your reply.

Regards,
${sender?.name || 'MSBM IT Services'}
${sender?.title || sender?.role || 'IT Services'}
${sender?.email || ''}`
    });
    setAdding(false); setNewContact({ name: '', email: '', title: '' }); setError('');
  }, [item?.id]);

  if (!item) return null;

  const selectContact = (id) => {
    if (id === '__add__') { setAdding(true); setNewContact({ name: '', email: '', title: '' }); setError(''); return; }
    const contact = recipients.find((entry) => entry.id === id);
    setForm((current) => ({ ...current, contactId: id, to: contact?.email || '', body: current.body.replace(/^Dear [^,\n]+,/i, `Dear ${contact?.name || 'Borrower'},`) }));
    setError('');
  };

  const saveContact = () => {
    const result = onAddContact?.(newContact);
    if (!result || result.error) { setError(result?.error || 'The contact could not be saved.'); return; }
    const contact = result.contact;
    setForm((current) => ({ ...current, contactId: contact.id, to: contact.email, body: current.body.replace(/^Dear [^,\n]+,/i, `Dear ${contact.name},`) }));
    setAdding(false); setNewContact({ name: '', email: '', title: '' }); setError('');
  };

  const openOutlook = async () => {
    if (!validEmail(form.to)) { setError('Enter a valid recipient email address.'); return; }
    if (form.cc.trim() && !validEmail(form.cc)) { setError('Enter a valid CC email address or leave it blank.'); return; }
    if (!form.subject.trim() || !form.body.trim()) { setError('Enter both a subject and message.'); return; }
    setBusy(true); setError('');
    try {
      const result = await openOutlookCompose({ to: form.to, cc: form.cc, subject: form.subject, body: form.body });
      if (result?.ok === false) throw new Error(result.error || 'Outlook Web could not be opened.');
      onPrepared?.({ to: form.to.trim(), cc: form.cc.trim(), subject: form.subject.trim(), bodyCopied: !!result?.bodyCopied });
      onClose();
    } catch (caught) { setError(caught.message || 'The Outlook handoff could not be prepared.'); }
    finally { setBusy(false); }
  };

  return <div className="loan-email-backdrop"><section className="loan-email-modal" role="dialog" aria-modal="true" aria-labelledby="loan-email-title">
    <header><span><small>OUTLOOK LOAN COMMUNICATION</small><strong id="loan-email-title">Email borrower</strong><p>{item.name} · {item.tag} · due {shortDate(item.due)}</p></span><button type="button" onClick={onClose} aria-label="Close"><IconX /></button></header>
    <div className="loan-email-content">
      <div className="loan-email-borrower"><span>{String(item.borrower || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><small>Current borrower</small><strong>{item.borrower || 'Not recorded'}</strong><p>{item.borrowerEmail || 'No email stored on the loan'} · Agreement {item.loanAgreement?.agreementNumber || 'not recorded'}</p></div></div>
      <div className="loan-email-grid">
        <label><span>Saved recipient</span><select value={form.contactId} onChange={(event) => selectContact(event.target.value)}><option value="">Choose or enter an email below</option>{recipients.map((contact) => <option key={contact.id} value={contact.id}>{contact.name} · {contact.email}</option>)}<option value="__add__">Add a new contact…</option></select></label>
        <label><span>To</span><input type="email" value={form.to} onChange={(event) => setForm((current) => ({ ...current, contactId: '', to: event.target.value }))} placeholder="borrower email" /></label>
        {adding && <section className="loan-add-contact"><span><strong>Add loan contact</strong><small>Saved locally for future borrower messages.</small></span><label><span>Contact name</span><input value={newContact.name} onChange={(event) => setNewContact((current) => ({ ...current, name: event.target.value }))} /></label><label><span>Email address</span><input type="email" value={newContact.email} onChange={(event) => setNewContact((current) => ({ ...current, email: event.target.value }))} /></label><label className="wide"><span>Department / role (optional)</span><input value={newContact.title} onChange={(event) => setNewContact((current) => ({ ...current, title: event.target.value }))} /></label><div><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button type="button" className="btn-primary" onClick={saveContact}>Save and select</button></div></section>}
        <label className="wide"><span>CC (optional)</span><input type="email" value={form.cc} onChange={(event) => setForm((current) => ({ ...current, cc: event.target.value }))} /></label>
        <label className="wide"><span>Subject</span><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} /></label>
        <label className="wide"><span>Message</span><textarea rows="13" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} /></label>
      </div>
      {error && <div className="loan-email-error">{error}</div>}
    </div>
    <footer><span>Outlook opens with the address, subject, and message prefilled.</span><div><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="loan-email-open" disabled={busy} onClick={openOutlook}>{busy ? 'Opening Outlook…' : 'Open in Outlook'}</button></div></footer>
  </section></div>;
}
