import { useMemo, useState } from 'react';
import { money } from '../data.js';

const emptyVendor = { name: '', vendorNumber: '', email: '', phone: '', contact: '', approved: true, notes: '' };
const inputStyle = { height: 38, padding: '0 10px', border: '1px solid #dfe3e9', borderRadius: 8, background: '#fff', fontSize: 12.5 };

export default function Vendors({ vendors, items, orders, procurementRecords, onSave, onToggle }) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const purchasing = useMemo(() => {
    const result = new Map();
    const add = (vendorName, itemName, quantity = 1, value = 0) => {
      const key = String(vendorName || '').trim().toLowerCase();
      if (!key || !itemName) return;
      if (!result.has(key)) result.set(key, new Map());
      const bucket = result.get(key);
      const current = bucket.get(itemName) || { name: itemName, quantity: 0, value: 0, records: 0 };
      current.quantity += Number(quantity) || 0;
      current.value += Number(value) || 0;
      current.records += 1;
      bucket.set(itemName, current);
    };
    orders.forEach((order) => add(order.supplier, order.name, order.qty, Number(order.qty || 0) * Number(order.unitCost || 0)));
    procurementRecords.forEach((record) => add(record.supplier || record.vendor, record.name || record.itemName || record.description, record.qty || record.quantity, record.total || record.value || (Number(record.qty || record.quantity || 0) * Number(record.unitCost || record.cost || 0))));
    items.forEach((item) => add(item.supplier, item.name, item.consumable ? item.qty : 1, item.cost));
    return result;
  }, [items, orders, procurementRecords]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return vendors.filter((vendor) => {
      const products = [...(purchasing.get(vendor.name.toLowerCase())?.values() || [])].map((entry) => entry.name).join(' ');
      return !needle || `${vendor.name} ${vendor.vendorNumber} ${vendor.email} ${vendor.contact} ${products}`.toLowerCase().includes(needle);
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, purchasing, query]);

  const submit = () => {
    const vendor = { ...editing, name: editing.name.trim(), vendorNumber: editing.vendorNumber.trim(), email: editing.email.trim().toLowerCase(), contact: editing.contact.trim(), phone: editing.phone.trim(), notes: editing.notes.trim() };
    if (!vendor.name || !vendor.vendorNumber || !vendor.email) { setError('Vendor name, vendor number, and email are required.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(vendor.email)) { setError('Enter a valid vendor email address.'); return; }
    const issue = onSave(vendor);
    if (issue) { setError(issue); return; }
    setEditing(null);
    setError('');
  };

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vendor, number, email, or purchased item" style={{ ...inputStyle, flex: 1 }} />
      <button type="button" className="btn-primary" onClick={() => { setEditing({ ...emptyVendor }); setError(''); }} style={{ height: 38, padding: '0 15px', borderRadius: 8, fontWeight: 600 }}>Add approved vendor</button>
    </div>
    <div style={{ display: 'grid', gap: 10 }}>
      {filtered.map((vendor) => {
        const products = [...(purchasing.get(vendor.name.toLowerCase())?.values() || [])].sort((a, b) => b.records - a.records || b.quantity - a.quantity);
        return <article key={vendor.id} style={{ border: '1px solid #dfe3e9', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 16, alignItems: 'center' }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><strong style={{ fontSize: 13.5 }}>{vendor.name}</strong><small style={{ color: '#617080' }}>{vendor.contact || 'No contact person'} · {vendor.phone || 'No phone recorded'}</small></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><code style={{ color: '#0a3d7c' }}>{vendor.vendorNumber}</code><small style={{ color: '#617080' }}>{vendor.email}</small></span>
            <span style={{ display: 'flex', gap: 7, alignItems: 'center' }}><b style={{ padding: '4px 8px', borderRadius: 999, background: vendor.approved !== false ? '#e7f4ec' : '#f1f2f4', color: vendor.approved !== false ? '#155e3f' : '#5b6672', fontSize: 10.5 }}>{vendor.approved !== false ? 'Approved' : 'Inactive'}</b><button type="button" className="btn-ghost" onClick={() => { setEditing({ ...vendor }); setError(''); }}>Edit</button><button type="button" className="btn-ghost" onClick={() => onToggle(vendor.id)}>{vendor.approved !== false ? 'Deactivate' : 'Approve'}</button></span>
          </div>
          <div style={{ padding: '10px 16px 13px', background: '#f7f9fb', borderTop: '1px solid #eceff3' }}>
            <strong style={{ display: 'block', marginBottom: 7, fontSize: 10.5, color: '#657383', textTransform: 'uppercase', letterSpacing: '.08em' }}>Usually purchased from this vendor</strong>
            {products.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{products.slice(0, 12).map((product) => <span key={product.name} title={`${product.records} record(s), ${money(product.value)}`} style={{ padding: '5px 8px', border: '1px solid #dce4ed', borderRadius: 7, background: '#fff', fontSize: 11.5 }}>{product.name} <small style={{ color: '#7b8794' }}>× {product.quantity || product.records}</small></span>)}</div> : <span style={{ color: '#7b8794', fontSize: 11.5 }}>No purchase history is linked to this vendor yet.</span>}
          </div>
        </article>;
      })}
      {!filtered.length && <div style={{ padding: 36, textAlign: 'center', color: '#7b8794' }}>No vendors match this search.</div>}
    </div>

    {editing && <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'grid', placeItems: 'center', padding: 30, background: 'rgba(13,17,22,.45)' }}><div style={{ width: 'min(620px,100%)', padding: 20, borderRadius: 12, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{editing.id ? 'Edit approved vendor' : 'Add approved vendor'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[['name', 'Vendor name'], ['vendorNumber', 'Vendor number'], ['email', 'Email address'], ['phone', 'Phone'], ['contact', 'Contact person']].map(([key, label]) => <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5, gridColumn: key === 'name' ? 'span 2' : undefined }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</span><input type={key === 'email' ? 'email' : 'text'} value={editing[key] || ''} onChange={(event) => setEditing((current) => ({ ...current, [key]: event.target.value }))} style={inputStyle} /></label>)}
        <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}><span style={{ fontSize: 11.5, fontWeight: 600 }}>Notes</span><textarea value={editing.notes || ''} onChange={(event) => setEditing((current) => ({ ...current, notes: event.target.value }))} rows={3} style={{ ...inputStyle, height: 76, padding: 10, resize: 'vertical' }} /></label>
      </div>
      {error && <div style={{ marginTop: 12, padding: 9, borderRadius: 7, background: '#fdeceb', color: '#a01a12', fontSize: 12 }}>{error}</div>}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button type="button" className="btn-primary" onClick={submit}>Save vendor</button></div>
    </div></div>}
  </div>;
}
