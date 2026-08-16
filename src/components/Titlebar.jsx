import { useEffect, useState } from 'react';
import { IconMinimize, IconMaximize, IconClose } from '../icons.jsx';

const hasApi = typeof window !== 'undefined' && !!window.api;

export default function Titlebar({ buildLabel }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!hasApi) return;
    window.api.isMaximized().then(setMaximized);
    const off = window.api.onWindowState((s) => setMaximized(s.maximized));
    return off;
  }, []);

  // Browser deployments use the browser's own chrome. Rendering the desktop
  // title bar there duplicates window controls that cannot do anything and
  // wastes vertical space. Electron exposes window.api through the preload
  // bridge, so the native desktop build keeps the complete title bar.
  if (!hasApi) return null;

  return (
    <div className="desktop-titlebar" style={{ height: 38, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: '#171c22', WebkitAppRegion: 'drag' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#f0564a' }}></span>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#f0b73d' }}></span>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#3fbf5e' }}></span>
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 500, letterSpacing: '.06em', color: '#8d99a6', whiteSpace: 'nowrap' }}>
        MSBM IT Inventory — {buildLabel}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: '#6f7a86', WebkitAppRegion: 'no-drag' }}>
        <button type="button" className="titlebar-btn" style={{ display: 'flex', padding: 0 }} onClick={() => hasApi && window.api.minimize()} aria-label="Minimize">
          <IconMinimize />
        </button>
        <button type="button" className="titlebar-btn" style={{ display: 'flex', padding: 0 }} onClick={() => hasApi && window.api.toggleMaximize()} aria-label={maximized ? 'Restore' : 'Maximize'}>
          <IconMaximize />
        </button>
        <button type="button" className="titlebar-btn titlebar-btn-close" style={{ display: 'flex', padding: 0 }} onClick={() => hasApi && window.api.close()} aria-label="Close">
          <IconClose />
        </button>
      </div>
    </div>
  );
}
