import { IconCheck } from '../icons.jsx';

export default function Toast({ message, action, tone = 'default' }) {
  if (!message) return null;
  const success = tone === 'success';
  return (
    <div style={{
      position: 'fixed', left: '50%', bottom: 26, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 9,
      padding: '11px 16px', background: success ? 'linear-gradient(135deg,#137a52,#0f6645)' : '#171c22', color: '#fff', border: success ? '1px solid rgba(126,226,178,.42)' : '1px solid transparent', borderRadius: 11, fontSize: 12.5, fontWeight: 600, zIndex: 120, animation: 'toastin .2s ease', boxShadow: success ? '0 13px 30px rgba(11,91,59,.28)' : '0 10px 24px rgba(10,15,20,.22)'
    }}>
      <IconCheck />
      <span>{message}</span>
      {action?.label && <button type="button" onClick={action.onClick} style={{ marginLeft: 5, height: 28, padding: '0 10px', border: '1px solid rgba(255,255,255,.28)', borderRadius: 7, background: '#fff', color: '#17212b', fontSize: 11.5, fontWeight: 750, cursor: 'pointer' }}>{action.label}</button>}
    </div>
  );
}
