import { useEffect, useRef } from 'react';
import { CONDITIONS } from '../data.js';
import { IconCheck, IconX } from '../icons.jsx';

const fieldStyle = { height: 38, padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 13, outline: 'none' };
const labelStyle = { display: 'flex', flexDirection: 'column', gap: 6 };
const captionStyle = { fontSize: 11.5, fontWeight: 600, color: '#3f4a56' };

export default function CheckInModal({ open, item, receiver, form, error, onChange, onConfirm, onClose }) {
  const notesRef = useRef(null);
  const hasIssue = form.outcome !== 'Returned complete' || form.accessories === 'Missing accessories' || form.condition === 'Needs repair' || form.disposition === 'Send to maintenance';
  useEffect(() => {
    if (open && hasIssue) requestAnimationFrame(() => notesRef.current?.focus());
  }, [open, hasIssue]);
  if (!open || !item) return null;
  const set = (key) => (event) => onChange(key, event.target.value);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="check-in-title" style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,22,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 120, pointerEvents: 'auto' }}>
      <div style={{ width: '100%', maxWidth: 580, background: '#fff', borderRadius: 12, overflow: 'hidden', animation: 'rise .18s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eceff3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span id="check-in-title" style={{ fontSize: 15, fontWeight: 600 }}>Process return — {item.name}</span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close check-in form" style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 7 }}><IconX /></button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxHeight: '68vh', overflow: 'auto' }}>
          <div style={{ gridColumn: 'span 2', padding: '11px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f7f9fb', border: '1px solid #eceff3', borderRadius: 8 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={captionStyle}>Borrower</span><span style={{ fontSize: 12.5 }}>{item.borrower}</span></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}><span style={captionStyle}>Received by</span><span style={{ fontSize: 12.5 }}>{receiver}</span></span>
          </div>

          <label style={labelStyle}>
            <span style={captionStyle}>Physical condition</span>
            <select value={form.condition} onChange={set('condition')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              {CONDITIONS.filter((condition) => condition !== 'New').map((condition) => <option key={condition}>{condition}</option>)}
            </select>
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Return outcome</span>
            <select value={form.outcome} onChange={set('outcome')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option>Returned complete</option>
              <option>Returned incomplete</option>
              <option>Returned damaged</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span style={captionStyle}>Accessories / contents</span>
            <select value={form.accessories} onChange={set('accessories')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option>All accessories returned</option>
              <option>Missing accessories</option>
              <option>Not applicable</option>
            </select>
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>After check-in</span>
            <select value={form.disposition} onChange={set('disposition')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              <option>Return to stock</option>
              <option>Send to maintenance</option>
            </select>
          </label>

          <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Issue / return notes{hasIssue ? ' (required)' : ''}</span>
            <textarea ref={notesRef} id="return-issue-notes" value={form.notes} onChange={set('notes')} rows={3} tabIndex={0} placeholder="Describe damage, missing accessories, cleaning required, or other return details"
              onPointerDown={(event) => event.stopPropagation()}
              style={{ ...fieldStyle, position: 'relative', zIndex: 1, height: 78, padding: 10, resize: 'vertical', lineHeight: 1.45, cursor: 'text', pointerEvents: 'auto', WebkitAppRegion: 'no-drag' }} />
          </label>

          {!!error && <div style={{ gridColumn: 'span 2', padding: '9px 11px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 8, color: '#a01a12', fontSize: 12 }}>{error}</div>}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #eceff3', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={{ height: 36, padding: '0 15px', display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 8, background: '#1c7c54', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 600 }}>
            <IconCheck color="currentColor" /><span>Check in</span>
          </button>
        </div>
      </div>
    </div>
  );
}
