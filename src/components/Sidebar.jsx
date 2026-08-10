import { LABELS } from '../data.js';
import { IconLogout } from '../icons.jsx';
import { ProfileAvatar } from './ProfileAvatar.jsx';

export default function Sidebar({ role, navItems, screen, itemSection = 'inventory', counts, hasNewAlert, alertMuted, onToggleAlertSound, onNav, session, onOpenProfile, onLogout }) {
  const keys = navItems;

  return (
    <div style={{ width: 246, flex: 'none', background: '#fff', borderRight: '1px solid #dfe3e9', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <img src="brand/msbm-lockup.png" alt="Mona School of Business & Management, The University of the West Indies, Mona"
            style={{ width: 214, height: 'auto', flex: 'none', alignSelf: 'flex-start', display: 'block' }} />
          <span style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7b8794' }}>IT Inventory System</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {keys.map((key) => {
          const on = screen === key || (key === itemSection && screen === 'item');
          const count = key === 'alerts' ? counts.alerts : key === 'consumables' ? counts.consumables : key === 'requests' ? counts.requests : key === 'loans' ? counts.loans : key === 'disposal' ? counts.disposal : 0;
          return (
            <button key={key} type="button" data-nav={on ? 'on' : 'off'} onClick={() => onNav(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 10px', border: 'none',
                borderRadius: 7, fontSize: 13, fontWeight: on ? 600 : 500, cursor: 'pointer', textAlign: 'left',
                background: on ? '#0a3d7c' : 'transparent', color: on ? '#ffffff' : '#3f4a56'
              }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', flex: 'none', background: on ? '#ffffff' : '#c3ccd6' }}></span>
              <span style={{ flex: 1 }}>{LABELS[key][0]}</span>
              {key === 'alerts' && hasNewAlert && <span title="New low-stock alert" style={{ width: 8, height: 8, flex: 'none', borderRadius: '50%', background: '#d52b1e', boxShadow: '0 0 0 3px rgba(213,43,30,.14)' }} />}
              {!!count && (
                <span style={{
                  minWidth: 20, height: 18, padding: '0 5px', display: 'inline-grid', placeItems: 'center', borderRadius: 9,
                  background: on ? 'rgba(255,255,255,.22)' : '#eceff3', color: on ? '#fff' : '#5b6672',
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, fontWeight: 600
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 'none', padding: '12px 12px 14px', borderTop: '1px solid #eceff3', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {keys.includes('alerts') && <button type="button" className="btn-ghost" onClick={onToggleAlertSound} style={{ height: 28, padding: '0 8px', borderRadius: 7, fontSize: 10.5 }}>Alert sound: {alertMuted ? 'muted' : 'on'}</button>}
        <button type="button" onClick={onOpenProfile} title="Open my profile" style={{ width: '100%', padding: 6, display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: '1px solid transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
          <ProfileAvatar account={session} size={34} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.name}</span>
            <span style={{ fontSize: 11, color: '#7b8794' }}>{session.role}</span>
          </div>
        </button>
        <button type="button" className="btn-ghost" onClick={onLogout}
          style={{ height: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderRadius: 7, fontSize: 12, fontWeight: 500 }}>
          <IconLogout />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
