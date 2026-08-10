import { useEffect, useMemo, useState } from 'react';
import { generateOrderApprovalPdf } from '../order-approval-pdf.js';
import { IconX } from '../icons.jsx';
import { openOutlookCompose } from '../outlook.js';

const field = { height: 38, padding: '0 10px', border: '1px solid #dfe3e9', borderRadius: 8, background: '#fff', fontSize: 12.5 };

export default function OrderApprovalModal({ order, sender, approvalContacts = [], onAddApprovalContact, onPrepared, onClose }) {
  const contacts = useMemo(() => approvalContacts.filter((contact) => contact.active !== false).sort((a, b) => a.name.localeCompare(b.name)), [approvalContacts]);
  const [form, setForm] = useState({ approverId: '', cc: '', subject: '', body: '' });
  const [pdf, setPdf] = useState({ status: 'idle', filename: '', path: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', email: '', title: '' });
  const selected = contacts.find((contact) => contact.id === form.approverId) || null;

  useEffect(() => {
    if (!order) return undefined;
    const first = contacts[0] || null;
    const requisition = order.requisitionNumber || order.reference || order.id;
    const greeting = first?.name || 'Management Approver';
    setForm({ approverId: first?.id || '', cc: '', subject: `Approval required: IT procurement requisition ${requisition}`, body: `Dear ${greeting},\n\nPlease review the attached MSBM IT procurement approval request for ${order.qty} × ${order.name} from ${order.supplier}. The estimated commitment is ${new Intl.NumberFormat('en-JM', { style: 'currency', currency: 'JMD' }).format(Number(order.qty || 0) * Number(order.unitCost || 0))}.\n\nFollowing approval by the IT Manager and management, this request can be submitted to Oracle Banner for PO processing.\n\nRegards,\n${sender?.name || 'MSBM IT Services'}` });
    setError('');
    setAdding(false);
    setNewContact({ name: '', email: '', title: '' });
    setPdf({ status: 'saving', filename: '', path: '' });
    let cancelled = false;
    generateOrderApprovalPdf(order, { preview: false }).then((result) => {
      if (!cancelled) setPdf({ status: 'saved', filename: result.filename, path: result.path });
    }).catch((caught) => {
      if (!cancelled) { setPdf({ status: 'error', filename: '', path: '' }); setError(caught.message || 'The approval PDF could not be saved.'); }
    });
    return () => { cancelled = true; };
  }, [order?.id]);

  if (!order) return null;

  const selectApprover = (id) => {
    if (id === '__add__') {
      setAdding(true);
      setNewContact({ name: '', email: '', title: '' });
      setError('');
      return;
    }
    const contact = contacts.find((entry) => entry.id === id);
    setForm((current) => ({ ...current, approverId: id, body: current.body.replace(/^Dear [^,\n]+,/i, `Dear ${contact?.name || 'Management Approver'},`) }));
    setError('');
  };

  const saveNewContact = () => {
    const result = onAddApprovalContact?.(newContact);
    if (!result || result.error) { setError(result?.error || 'The manager could not be saved.'); return; }
    setForm((current) => ({ ...current, approverId: result.contact.id, body: current.body.replace(/^Dear [^,\n]+,/i, `Dear ${result.contact.name},`) }));
    setAdding(false);
    setNewContact({ name: '', email: '', title: '' });
    setError('');
  };

  const retryPdf = async () => {
    setPdf({ status: 'saving', filename: '', path: '' }); setError('');
    try { const result = await generateOrderApprovalPdf(order, { preview: false }); setPdf({ status: 'saved', filename: result.filename, path: result.path }); }
    catch (caught) { setPdf({ status: 'error', filename: '', path: '' }); setError(caught.message || 'The approval PDF could not be saved.'); }
  };

  const prepare = async () => {
    if (!selected) { setError('Select a stored management approver. Add approvers in Settings if this list is empty.'); return; }
    if (pdf.status !== 'saved') { setError('Wait for the approval PDF to finish saving before opening Outlook.'); return; }
    setBusy(true); setError('');
    try {
      const result = await openOutlookCompose({ to: selected.email, cc: form.cc, subject: form.subject, body: form.body });
      if (result?.ok === false) throw new Error(result.error || 'Outlook Web could not be opened.');
      onPrepared({ to: selected.email, approverName: selected.name, cc: form.cc.trim(), subject: form.subject, filename: pdf.filename, path: pdf.path, bodyCopied: false });
      onClose();
    } catch (caught) { setError(caught.message || 'The approval handoff could not be prepared.'); }
    finally { setBusy(false); }
  };

  return <div style={{ position: 'fixed', inset: 0, zIndex: 75, display: 'grid', placeItems: 'center', padding: 30, background: 'rgba(13,17,22,.48)' }}><div style={{ width: 'min(700px,100%)', maxHeight: '88vh', overflow: 'auto', borderRadius: 12, background: '#fff' }}>
    <header style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eceff3' }}><span><strong style={{ display: 'block', fontSize: 15 }}>Send procurement request for approval</strong><small style={{ color: '#718090' }}>{order.requisitionNumber || order.reference || order.id}</small></span><button type="button" className="btn-ghost" onClick={onClose} aria-label="Close"><IconX /></button></header>
    <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div style={{ gridColumn: 'span 2', padding: 12, border: '1px solid #d4e1ef', borderRadius: 9, background: '#eff5fb', color: '#354c63', fontSize: 12, lineHeight: 1.5 }}>
        {pdf.status === 'saving' && <><strong>Saving the approval PDF…</strong><br />It is being placed in Documents\MSBM IT Inventory\Procurement Approvals.</>}
        {pdf.status === 'saved' && <><strong>Approval PDF saved automatically.</strong><br /><code style={{ wordBreak: 'break-all' }}>{pdf.path || pdf.filename}</code><br />Attach this file in Outlook Web before sending.</>}
        {pdf.status === 'error' && <><strong>The approval PDF was not saved.</strong> <button type="button" className="btn-link" onClick={retryPdf}>Try again</button></>}
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>Management approver name</span><select value={form.approverId} onChange={(event) => selectApprover(event.target.value)} style={field}><option value="">Select a saved approver</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}<option value="__add__">Add a new manager…</option></select></label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>Management approval email</span><select value={form.approverId} onChange={(event) => selectApprover(event.target.value)} style={field}><option value="">Select a saved email</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.email}</option>)}<option value="__add__">Add a new manager and email…</option></select></label>
      {adding && <div style={{ gridColumn: 'span 2', padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, border: '1px solid #cfddeb', borderRadius: 9, background: '#f7faff' }}>
        <span style={{ gridColumn: 'span 2' }}><strong style={{ display: 'block', fontSize: 12.5 }}>Add management approver</strong><small style={{ color: '#718090' }}>This manager will be saved locally and available automatically for future orders.</small></span>
        {[['name', 'Manager name', 'text'], ['email', 'Manager email', 'email'], ['title', 'Position / title (optional)', 'text']].map(([key, label, type]) => <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: key === 'title' ? 'span 2' : undefined }}><span style={{ fontSize: 11, fontWeight: 600 }}>{label}</span><input type={type} value={newContact[key]} onChange={(event) => setNewContact((current) => ({ ...current, [key]: event.target.value }))} style={field} /></label>)}
        <span style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: 7 }}><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button><button type="button" className="btn-primary" onClick={saveNewContact}>Save and select manager</button></span>
      </div>}
      <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>CC (optional)</span><input type="email" value={form.cc} onChange={(event) => setForm((current) => ({ ...current, cc: event.target.value }))} style={field} /></label>
      <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>Subject</span><input value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} style={field} /></label>
      <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>Approval message</span><textarea rows={9} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} style={{ ...field, height: 180, padding: 10, resize: 'vertical', lineHeight: 1.5 }} /></label>
      {error && <div style={{ gridColumn: 'span 2', padding: 10, borderRadius: 8, background: '#fdeceb', color: '#a01a12', fontSize: 12 }}>{error}</div>}
    </div>
    <footer style={{ padding: '14px 20px', display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #eceff3' }}><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button type="button" className="btn-primary" disabled={busy || pdf.status === 'saving'} onClick={prepare}>{busy ? 'Opening Outlook…' : 'Open Outlook for approval'}</button></footer>
  </div></div>;
}
