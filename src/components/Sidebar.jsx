import { useState } from 'react';
import { LABELS } from '../data.js';
import { IconLogout } from '../icons.jsx';
import { ProfileAvatar } from './ProfileAvatar.jsx';

const NAV_ICON_PATHS = {
  dashboard: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  inventory: 'm4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10',
  consumables: 'M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11zM9 15c.5 1.3 1.5 2 3 2',
  stocktakes: 'M5 4h14v16H5zM8 9l2 2 4-4M8 15h8',
  maintenance: 'M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-3 1-2-2z',
  lifecycle: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  disposal: 'M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
  loans: 'M5 12h14M14 7l5 5-5 5M5 5v14',
  history: 'M12 4a8 8 0 1 1-7.4 5M4 4v5h5M12 8v5l3 2',
  requests: 'M8 4h8M9 3v3h6V3M6 5h12v16H6zM9 11h6M9 15h6',
  alerts: 'm12 4 9 16H3zM12 9v4M12 17h.01',
  orders: 'M4 5h2l2 10h9l2-7H7M10 19h.01M17 19h.01',
  placements: 'M12 21s6-5.6 6-11a6 6 0 1 0-12 0c0 5.4 6 11 6 11zM12 8v4M10 10h4',
  scan: 'M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4M7 12h10',
  imports: 'M12 3v12M8 11l4 4 4-4M5 19h14',
  reports: 'M5 20V10h4v10M10 20V4h4v16M15 20v-7h4v7M3 20h18',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM3 21v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 7M17 15a6 6 0 0 1 4 6',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19 12l2-1-2-4-2 .5-2-2L15 3h-6l-.5 2.5-2 2L4 7l-2 4 2 1v3l-2 1 2 4 2-.5 2 2L9 21h6l.5-2.5 2-2 2 .5 2-4-2-1z'
};

function NavIcon({ screen }) {
  return <svg className="app-sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={NAV_ICON_PATHS[screen] || NAV_ICON_PATHS.inventory} /></svg>;
}

const loadCollapsed = () => {
  try { return window.localStorage.getItem('msbm-sidebar-collapsed') === 'true'; }
  catch { return false; }
};

export default function Sidebar({ role, navItems, screen, itemSection = 'inventory', counts, workflowAlerts = {}, hasNewAlert, alertMuted, onToggleAlertSound, onNav, session, onOpenProfile, onLogout, onCollapseChange }) {
  const keys = navItems;
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { window.localStorage.setItem('msbm-sidebar-collapsed', String(next)); } catch { /* Persistence is best effort. */ }
    onCollapseChange?.(next);
  };

  return (
    <aside className="app-sidebar" data-collapsed={collapsed ? 'true' : 'false'} style={{ width: collapsed ? 74 : 246, flex: 'none', background: '#fff', borderRight: '1px solid #dfe3e9', display: 'flex', flexDirection: 'column' }}>
      <div className="app-sidebar-brand" style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <img className="app-sidebar-brand-lockup" src="brand/msbm-lockup.png" alt="Mona School of Business & Management, The University of the West Indies, Mona"
            style={{ width: 190, height: 'auto', flex: 'none', alignSelf: 'flex-start', display: 'block' }} />
          <img className="app-sidebar-brand-crest" src="brand/msbm-crest.png" alt="MSBM crest" />
          <span className="app-sidebar-brand-label" style={{ fontSize: 10.5, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7b8794' }}>IT Inventory System</span>
        </div>
        <button type="button" className="app-sidebar-collapse" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={collapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} /></svg>
        </button>
      </div>

      <nav className="app-sidebar-nav" aria-label="Application sections" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {keys.map((key) => {
          const on = screen === key || (key === itemSection && screen === 'item');
          const count = key === 'alerts' ? counts.alerts : key === 'consumables' ? counts.consumables : key === 'requests' ? counts.requests : key === 'loans' ? counts.loans : key === 'disposal' ? counts.disposal : 0;
          const notification = (key === 'alerts' && hasNewAlert) || workflowAlerts[key];
          const hasCount = Number(count) > 0;
          const showIndicators = Boolean(notification) || hasCount;
          return (
            <button className="app-sidebar-link" key={key} type="button" data-nav={on ? 'on' : 'off'} data-screen={key} aria-label={LABELS[key][0]} title={LABELS[key][0]} onClick={() => onNav(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, height: 36, padding: '0 10px', border: 'none',
                borderRadius: 7, fontSize: 13, fontWeight: on ? 600 : 500, cursor: 'pointer', textAlign: 'left',
                background: on ? '#0a3d7c' : 'transparent', color: on ? '#ffffff' : '#3f4a56'
              }}>
              <NavIcon screen={key} />
              <span className="app-sidebar-label" style={{ flex: 1 }}>{LABELS[key][0]}</span>
              {showIndicators && <span className={`app-sidebar-indicators${hasCount ? ' has-count' : ''}`}>
                {notification ? <span className="app-sidebar-notification-dot" title={key === 'alerts' ? 'New low-stock alert' : 'New workflow item'} aria-label={key === 'alerts' ? 'New low-stock alert' : 'New workflow item'} /> : <span className="app-sidebar-indicator-spacer" aria-hidden="true" />}
                {hasCount ? <span className="app-sidebar-count" style={{
                  minWidth: 20, height: 18, padding: '0 5px', display: 'inline-grid', placeItems: 'center', borderRadius: 9,
                  background: on ? 'rgba(255,255,255,.22)' : '#eceff3', color: on ? '#fff' : '#5b6672',
                  fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, fontWeight: 600
                }}>{count}</span> : <span className="app-sidebar-count-spacer" aria-hidden="true" />}
              </span>}
            </button>
          );
        })}
      </nav>

      <div className="app-sidebar-footer" style={{ flex: 'none', padding: '12px 12px 14px', borderTop: '1px solid #eceff3', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {keys.includes('alerts') && <button type="button" className="btn-ghost app-sidebar-alert-toggle" title={`Alert sound: ${alertMuted ? 'muted' : 'on'}`} onClick={onToggleAlertSound} style={{ height: 28, padding: '0 8px', borderRadius: 7, fontSize: 10.5 }}><span>Alert sound: {alertMuted ? 'muted' : 'on'}</span><b aria-hidden="true">{alertMuted ? '×' : '♪'}</b></button>}
        <button className="app-sidebar-profile" type="button" onClick={onOpenProfile} title="Open my profile" style={{ width: '100%', padding: 6, display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: '1px solid transparent', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
          <ProfileAvatar account={session} size={34} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.name}</span>
            <span style={{ fontSize: 11, color: '#7b8794' }}>{session.role}</span>
          </div>
        </button>
        <button type="button" className="btn-ghost app-sidebar-logout" onClick={onLogout}
          style={{ height: 32, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', borderRadius: 7, fontSize: 12, fontWeight: 500 }}>
          <IconLogout />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
