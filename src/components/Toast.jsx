import { IconCheck } from '../icons.jsx';

export default function Toast({ message, action }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 9,
      padding: '11px 16px', background: '#171c22', color: '#fff', borderRadius: 9, fontSize: 12.5, fontWeight: 500, zIndex: 60, animation: 'toastin .2s ease'
    }}>
      <IconCheck />
      <span>{message}</span>
      {action?.label && <button type="button" onClick={action.onClick} style={{ marginLeft: 5, height: 28, padding: '0 10px', border: '1px solid rgba(255,255,255,.28)', borderRadius: 7, background: '#fff', color: '#17212b', fontSize: 11.5, fontWeight: 750, cursor: 'pointer' }}>{action.label}</button>}
    </div>
  );
}
