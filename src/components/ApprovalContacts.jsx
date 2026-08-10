import { useState } from 'react';

const blank = { name: '', email: '', title: '', active: true };
const field = { height: 38, padding: '0 10px', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 12.5 };

export default function ApprovalContacts({ contacts, onSave, onToggle }) {
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const save = () => {
    const contact = { ...editing, name: editing.name.trim(), email: editing.email.trim().toLowerCase(), title: editing.title.trim() };
    if (!contact.name || !/^\S+@\S+\.\S+$/.test(contact.email)) { setError('Enter the approver’s name and a valid email address.'); return; }
    const issue = onSave(contact);
    if (issue) { setError(issue); return; }
    setEditing(null); setError('');
  };
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}><p style={{ margin: 0, color: '#617080', fontSize: 12.5 }}>These people appear in the management name and email dropdowns when an order is sent for approval.</p><button type="button" className="btn-primary" onClick={() => setEditing({ ...blank })}>Add approver</button></div>
    {contacts.slice().sort((a, b) => a.name.localeCompare(b.name)).map((contact) => <div key={contact.id} style={{ padding: '13px 15px', display: 'grid', gridTemplateColumns: '1.3fr 1.2fr auto', gap: 14, alignItems: 'center', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 9 }}>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><strong style={{ fontSize: 13 }}>{contact.name}</strong><small style={{ color: '#718090' }}>{contact.title || 'Management approver'}</small></span>
      <span style={{ fontSize: 12.5, color: '#0a3d7c' }}>{contact.email}</span>
      <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><b style={{ padding: '4px 8px', borderRadius: 999, background: contact.active !== false ? '#e7f4ec' : '#f1f2f4', color: contact.active !== false ? '#155e3f' : '#5b6672', fontSize: 10.5 }}>{contact.active !== false ? 'Available' : 'Inactive'}</b><button type="button" className="btn-ghost" onClick={() => { setEditing({ ...contact }); setError(''); }}>Edit</button><button type="button" className="btn-ghost" onClick={() => onToggle(contact.id)}>{contact.active !== false ? 'Deactivate' : 'Activate'}</button></span>
    </div>)}
    {!contacts.length && <div style={{ padding: 34, textAlign: 'center', color: '#7b8794', border: '1px dashed #cbd4dd', borderRadius: 9 }}>No management approvers are stored yet.</div>}
    {editing && <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: 30, background: 'rgba(13,17,22,.45)' }}><div style={{ width: 'min(520px,100%)', padding: 20, background: '#fff', borderRadius: 12 }}>
      <h3 style={{ margin: '0 0 15px', fontSize: 16 }}>{editing.id ? 'Edit management approver' : 'Add management approver'}</h3>
      <div style={{ display: 'grid', gap: 11 }}>{[['name', 'Full name'], ['email', 'Approval email'], ['title', 'Position / title']].map(([key, label]) => <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span><input type={key === 'email' ? 'email' : 'text'} value={editing[key] || ''} onChange={(event) => setEditing((current) => ({ ...current, [key]: event.target.value }))} style={field} /></label>)}</div>
      {error && <div style={{ marginTop: 11, padding: 9, borderRadius: 7, background: '#fdeceb', color: '#a01a12', fontSize: 12 }}>{error}</div>}
      <div style={{ marginTop: 15, display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="btn-primary" onClick={save}>Save approver</button></div>
    </div></div>}
  </div>;
}
