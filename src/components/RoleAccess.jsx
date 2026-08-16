import { LABELS } from '../data.js';

export default function RoleAccess({ navConfig, onChange }) {
  const screens = Object.keys(LABELS).filter((screen) => !['imports', 'users'].includes(screen));
  return <div style={{ maxWidth: 1250, display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ padding: 14, background: '#eef4fb', border: '1px solid #d5e1ef', borderRadius: 9, color: '#33414e', fontSize: 12 }}>Changes take effect immediately and persist for every user assigned to that role. Settings access is locked on for administrators to prevent configuration lockout.</div>
    {Object.entries(navConfig).map(([role, enabled]) => <section key={role} style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}><div style={{ padding: '12px 15px', background: '#f7f9fb', borderBottom: '1px solid #e5e9ee' }}><strong>{role}</strong><small style={{ marginLeft: 8, color: '#7b8794' }}>{enabled.length} pages</small></div><div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 9 }}>
      {screens.map((screen) => { const adminLock = screen === 'settings' && role === 'Admin'; const staffConsumablesLock = screen === 'consumables' && role === 'Staff'; const locked = adminLock || staffConsumablesLock; const checked = adminLock || (!staffConsumablesLock && enabled.includes(screen)); return <label key={screen} style={{ padding: '9px 10px', display: 'flex', alignItems: 'center', gap: 9, border: '1px solid #e2e7ed', borderRadius: 8, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? .7 : 1 }}><input type="checkbox" checked={checked} disabled={locked} onChange={(event) => onChange(role, screen, event.target.checked)} /><span><strong style={{ display: 'block', fontSize: 11.5 }}>{LABELS[screen][0]}</strong><small style={{ color: '#7b8794' }}>{adminLock ? 'Locked on for administrators to prevent configuration lockout' : staffConsumablesLock ? 'Restricted for Staff accounts' : LABELS[screen][1]}</small></span></label>; })}
    </div></section>)}
  </div>;
}
