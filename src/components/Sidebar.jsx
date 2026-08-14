import { useState } from 'react';
import { LABELS } from '../data.js';
import { IconLogout } from '../icons.jsx';
import { ProfileAvatar } from './ProfileAvatar.jsx';

const NAV_ICON_PATHS = {
  dashboard: 'M4.5 3.5h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM14.5 3.5h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM4.5 13.5h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM14.5 13.5h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z',
  inventory: 'm3.5 7 8.5-4.5L20.5 7 12 11.5zM3.5 7v10L12 21.5l8.5-4.5V7M12 11.5v10',
  consumables: 'M12 2.8S18.4 9.2 18.4 14a6.4 6.4 0 0 1-12.8 0C5.6 9.2 12 2.8 12 2.8z',
  stocktakes: 'M6 3.5h12a1 1 0 0 1 1 1v16H5v-16a1 1 0 0 1 1-1zM9 3.5V2h6v1.5M8 9.5l2 2 4-4M8 16h8',
  maintenance: 'M14.5 5.2a4.1 4.1 0 0 0-5 5.2l-5.8 5.8a1.45 1.45 0 0 0 0 2.05l2.05 2.05a1.45 1.45 0 0 0 2.05 0l5.8-5.8a4.1 4.1 0 0 0 5.2-5l-2.7 2.7-2.35-.6-.6-2.35z',
  lifecycle: 'M20 7v5h-5M4 17v-5h5M6.2 8.5A7 7 0 0 1 18.7 7M17.8 15.5A7 7 0 0 1 5.3 17',
  disposal: 'M4 6.5h16M9 6.5V3.8h6v2.7M6.5 6.5l.8 14h9.4l.8-14M10 10.5v6M14 10.5v6',
  loans: 'M3.5 12h16M14.5 6.5 20 12l-5.5 5.5M5.5 4.5v15',
  history: 'M12 3.5a8.5 8.5 0 1 1-7.8 5.1M3.5 3.5v5.8h5.8M12 7.5v5l3.5 2',
  requests: 'M7 4.5h10a1 1 0 0 1 1 1v15H6v-15a1 1 0 0 1 1-1zM9 4.5V2.8h6v1.7M9 10h6M9 14h6M9 18h4',
  alerts: 'm12 3 9.3 17H2.7zM12 8.5v5M12 17.2v.1',
  orders: 'M3 4.5h2.5l2.2 10.2h9.8l2.2-7.2H6.2M9.5 19.5h.1M17 19.5h.1',
  placements: 'M12 21.5s6.5-5.8 6.5-11.3a6.5 6.5 0 1 0-13 0C5.5 15.7 12 21.5 12 21.5zM12 7.3v5.8M9.1 10.2h5.8',
  scan: 'M3.5 9V5.5a2 2 0 0 1 2-2H9M15 3.5h3.5a2 2 0 0 1 2 2V9M20.5 15v3.5a2 2 0 0 1-2 2H15M9 20.5H5.5a2 2 0 0 1-2-2V15M7.5 12h9',
  imports: 'M12 3v12M7.8 10.8 12 15l4.2-4.2M4.5 20h15M6 17.5v2.5M18 17.5v2.5',
  reports: 'M4 20.5V11h4v9.5M10 20.5V4h4v16.5M16 20.5v-7h4v7M2.5 20.5h19',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2.5 21v-2a6.5 6.5 0 0 1 13 0v2M16 4a4 4 0 0 1 0 7M17 15a6.5 6.5 0 0 1 4.5 6',
  settings: 'M9.5 3.3h5l.55 2.05c.65.22 1.25.57 1.78 1.02l2.02-.57 2.5 4.34-1.5 1.48c.13.68.13 1.38 0 2.06l1.5 1.48-2.5 4.34-2.02-.57c-.53.45-1.13.8-1.78 1.02L14.5 22h-5l-.55-2.05a8 8 0 0 1-1.78-1.02l-2.02.57-2.5-4.34 1.5-1.48a5.5 5.5 0 0 1 0-2.06l-1.5-1.48 2.5-4.34 2.02.57a8 8 0 0 1 1.78-1.02z'
};

const NAV_ICON_DETAILS = {
  dashboard: 'M6.5 7h1.5M16.5 7H18M6.5 17H8M16.5 17H18',
  inventory: 'm7.8 5 8.4 4.5M6.8 14.2l2.2 1.2M15 16.2l2.2-1.2',
  consumables: 'M9 14.4a3.2 3.2 0 0 0 5.1 2.6M10 10.3c.7-1.4 2-3 2-3',
  stocktakes: 'M8 15.8h3M13 11h3',
  maintenance: 'm5.25 16.65 2.1 2.1M11.2 12.8l1.95 1.95M16.1 7.9l1.75-1.75',
  lifecycle: 'M12 7.3v4.9l3 1.8M20 7h-2.8M4 17h2.8',
  disposal: 'M8.5 6.5h7M9 20.5h6',
  loans: 'M8.2 9.2 5.5 12l2.7 2.8M5.5 12H9',
  history: 'M6.5 5.8 4.2 8.6M17.2 18.2l1.4-1.7',
  requests: 'M9 7h6M9 12h1M9 16h1',
  alerts: 'M8.5 19.8h7M10 5.8h4',
  orders: 'M9 10h7M10.2 12.5h5',
  placements: 'M9.3 16.7h5.4M12 5.6v1.7',
  scan: 'M9.5 8.5v7M12 8.5v7M14.5 8.5v7',
  imports: 'M8 6.5h8M9.5 18h5',
  reports: 'M5.5 8.5h1M11.5 7h1M17.5 17h1',
  users: 'M5.8 8.2h6.4M4.8 17.2h8.4M18 8h2',
  settings: 'M12 8.7a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6zM12 11.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z'
};

function NavIcon({ screen }) {
  return <svg className="app-sidebar-icon" viewBox="0 0 24 24" aria-hidden="true"><path className="app-sidebar-icon-primary" d={NAV_ICON_PATHS[screen] || NAV_ICON_PATHS.inventory} /><path className="app-sidebar-icon-detail" d={NAV_ICON_DETAILS[screen] || NAV_ICON_DETAILS.inventory} /></svg>;
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
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d={collapsed ? 'M4 4h16v16H4zM9 4v16m4-12 4 4-4 4' : 'm15 6-6 6 6 6'} /></svg>
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
