import { IconSearch, IconScan, IconPlus, IconArrowLeft, IconArrowRight, IconRefresh } from '../icons.jsx';

export default function TopBar({
  title, subtitle, query, onQuery, showSearch = true, canScan, onScan,
  canEdit, onNewAsset, newLabel = 'New asset', canGoBack, canGoForward,
  onGoBack, onGoForward, onRefresh
}) {
  return (
    <header className="workspace-nav-bar">
      <nav className="workspace-nav-controls" aria-label="Page navigation">
        <button type="button" onClick={onGoBack} disabled={!canGoBack} aria-label="Go back" title="Back"><IconArrowLeft /></button>
        <button type="button" onClick={onGoForward} disabled={!canGoForward} aria-label="Go forward" title="Forward"><IconArrowRight /></button>
        <button type="button" onClick={onRefresh} aria-label="Refresh current page" title="Refresh"><IconRefresh /></button>
      </nav>
      <span className="workspace-nav-divider" aria-hidden="true" />
      <div className="workspace-nav-title">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>
      {showSearch && (
        <label className="workspace-nav-search">
          <IconSearch />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search name, tag, serial, room…" />
        </label>
      )}
      <div className="workspace-nav-actions">
        {canScan && (
          <button type="button" className="btn-ghost workspace-nav-action" onClick={onScan}>
            <IconScan /><span>Scan</span>
          </button>
        )}
        {canEdit && (
          <button type="button" className="btn-primary workspace-nav-action" onClick={onNewAsset}>
            <IconPlus /><span>{newLabel}</span>
          </button>
        )}
      </div>
    </header>
  );
}
