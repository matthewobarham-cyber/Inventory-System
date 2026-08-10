export default function CheckoutModal({ open, itemName, borrower, due, period, tsrs, loanedBy, error, onChangeBorrower, onChangeDue, onChangePeriod, onChangeLoanedBy, onConfirm, onClose }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,22,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 40 }}>
      <div style={{ width: '100%', maxWidth: 460, background: '#fff', borderRadius: 12, overflow: 'hidden', animation: 'rise .18s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eceff3', fontSize: 15, fontWeight: 600 }}>Check out — {itemName}</div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3f4a56' }}>Borrower</span>
            <input value={borrower} onChange={(e) => onChangeBorrower(e.target.value)} placeholder="Name or staff ID"
              style={{ height: 38, padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 13, outline: 'none' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3f4a56' }}>TSR / administrator who loaned the item</span>
            <select value={loanedBy} onChange={(e) => onChangeLoanedBy(e.target.value)} style={{ height: 38, padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 13, outline: 'none' }}>
              <option value="">Select an authorized user</option>{tsrs.map((account) => <option key={account.email} value={account.name}>{account.name} — {account.title}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3f4a56' }}>Expected loan period (days)</span>
            <input type="number" min="1" step="1" value={period} onChange={(e) => onChangePeriod(e.target.value)}
              style={{ height: 38, padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 13, outline: 'none' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#3f4a56' }}>Due back</span>
            <input type="date" value={due} onChange={(e) => onChangeDue(e.target.value)}
              style={{ height: 38, padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 13, outline: 'none' }} />
          </label>
          {!!error && <span style={{ fontSize: 12, color: '#a01a12' }}>{error}</span>}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #eceff3', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onConfirm} style={{ height: 36, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>Review agreement</button>
        </div>
      </div>
    </div>
  );
}
