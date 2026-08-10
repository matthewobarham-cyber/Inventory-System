import { useState } from 'react';
import { roleTagStyle } from '../data.js';
import { IconX } from '../icons.jsx';
import { ProfilePhotoControl } from './ProfileAvatar.jsx';

export default function MyProfileModal({ account, onAvatarChange, onClose }) {
  const [error, setError] = useState('');
  if (!account) return null;
  const details = [
    ['Campus ID', account.campusId], ['Campus email', account.email],
    ['Position', account.title], ['Department', account.department],
    ['Phone', account.phone], ['Office', account.office],
    ['Reports to', account.manager], ['Member since', account.joined]
  ];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 66, padding: 32, display: 'grid', placeItems: 'center', background: 'rgba(13,17,22,.46)' }}>
      <div style={{ width: 'min(720px,100%)', maxHeight: '86vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, animation: 'rise .18s ease' }}>
        <div style={{ padding: '15px 19px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eceff3' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>My profile</span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close profile" style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', borderRadius: 7 }}><IconX /></button>
        </div>
        <div style={{ overflow: 'auto' }}>
          <div style={{ padding: 22, display: 'flex', alignItems: 'center', gap: 17, background: '#f7f9fb', borderBottom: '1px solid #e4e9ee' }}>
            <ProfilePhotoControl account={account} size={82} onAvatarChange={onAvatarChange} onError={setError} />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <strong style={{ fontSize: 21 }}>{account.name}</strong>
              <span style={{ fontSize: 12.5, color: '#5b6672' }}>{account.title} · {account.department}</span>
              <span><span style={roleTagStyle(account.role)}>{account.role}</span></span>
            </span>
          </div>
          {error && <div style={{ margin: '14px 20px 0', padding: '9px 11px', color: '#a01a12', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 7, fontSize: 12 }}>{error}</div>}
          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #e2e7ed', borderRadius: 9, overflow: 'hidden' }}>
              {details.map(([label, value], index) => <div key={label} style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 4, borderRight: index % 2 === 0 ? '1px solid #e2e7ed' : 'none', borderBottom: index < details.length - 2 ? '1px solid #e2e7ed' : 'none' }}><span style={{ fontSize: 10, fontWeight: 700, color: '#7b8794', letterSpacing: '.07em', textTransform: 'uppercase' }}>{label}</span><span style={{ fontSize: 12.5 }}>{value || 'Not recorded'}</span></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
