import { useEffect } from 'react';
import { IconScan, IconX } from '../icons.jsx';
import { effStatus, glbUrl } from '../data.js';
import { BarcodeGraphic } from './BarcodeLabelModal.jsx';

const ACTIONS = {
  view: { icon: '⌕', tone: 'blue' },
  checkout: { icon: '↗', tone: 'green' },
  checkin: { icon: '↙', tone: 'amber' },
  consume: { icon: '−', tone: 'green' },
  consumables: { icon: '◫', tone: 'blue' },
  register: { icon: '+', tone: 'green' },
  stocktake: { icon: '✓', tone: 'slate' },
  console: { icon: '▥', tone: 'slate' }
};

function Action({ kind, title, detail, disabled, recommended = false, onClick }) {
  const action = ACTIONS[kind];
  return <button type="button" className={`global-scan-action ${action.tone}${recommended ? ' recommended' : ''}`} disabled={disabled} onClick={onClick}>
    <i>{action.icon}</i><span><strong>{title}{recommended && <em>Smart choice</em>}</strong><small>{detail}</small></span><b>→</b>
  </button>;
}

export default function GlobalScanModal({ scan, item, reserved, canManageLoans, canEdit, onClose, onView, onUseConsumable, onOpenConsumables, onCheckout, onCheckin, onStocktake, onRegister, onScannerConsole }) {
  useEffect(() => {
    if (!scan) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [scan?.id, onClose]);
  if (!scan) return null;

  const modelId = item?.model || reserved?.model;
  const status = item ? (item.consumable ? `${Number(item.qty || 0)} ${item.unitOfMeasure || 'units'} available` : effStatus(item)) : reserved ? 'Reserved label' : 'Not registered';
  const statusKey = item ? (item.consumable ? Number(item.qty || 0) > 0 ? 'available' : 'attention' : effStatus(item).toLowerCase().replaceAll(' ', '-')) : reserved ? 'reserved' : 'attention';
  const canCheckout = canManageLoans && item && !item.consumable && item.status === 'In stock';
  const canCheckin = canManageLoans && item?.status === 'On loan';
  const recommendation = item?.consumable
    ? Number(item.qty || 0) > 0 && canEdit ? { kind: 'consume', label: 'Issue consumable stock' } : { kind: 'consumables', label: 'Review stock position' }
    : item?.status === 'On loan' && canCheckin ? { kind: 'checkin', label: 'Check this item back in' }
      : item?.status === 'In stock' && canCheckout ? { kind: 'checkout', label: 'Check this item out' }
        : item ? { kind: 'view', label: `Review item while ${item.status.toLowerCase()}` }
          : canEdit ? { kind: 'register', label: reserved ? 'Register this generated label' : 'Register this new barcode' } : { kind: 'console', label: 'Review this barcode' };

  return <div className="global-scan-backdrop" role="dialog" aria-modal="true" aria-labelledby="global-scan-title">
    <section className="global-scan-modal">
      <header className="global-scan-header">
        <span className="global-scan-live"><IconScan size={19} /><i /></span>
        <span className="global-scan-heading"><small>Live barcode detection</small><strong id="global-scan-title">{item ? 'Inventory item recognized' : reserved ? 'Blank label recognized' : 'Unregistered barcode'}</strong></span>
        <span className="global-scan-smart-state"><i>⌁</i><span><b>Smart Scan</b><small>Automatic routing</small></span></span>
        <button type="button" className="global-scan-close" onClick={onClose} aria-label="Dismiss scanned barcode"><IconX color="currentColor" /></button>
      </header>

      <div className="global-scan-body">
        <main className="global-scan-content">
          <section className="global-scan-overview">
            <div className="global-scan-visual-panel">
              <div className="global-scan-beam" aria-hidden="true" />
              {modelId ? <div className="global-scan-item-model" data-detail-model={glbUrl(modelId)} data-detail-interactive="false" data-detail-spin="true" data-detail-fps="60" data-detail-scale="1.3" aria-label={`${item?.name || reserved?.equipmentType || 'Scanned equipment'} 3D model`}><span className="dashboard-model-loader" aria-hidden="true" /></div> : <div className="global-scan-brand-mark" aria-hidden="true"><IconScan size={34} /><span>NEW</span></div>}
              <span className={`global-scan-status ${statusKey}`}><i />{status}</span>
            </div>

            <div className="global-scan-summary">
              {item ? <>
                <div className="global-scan-record-title"><span><small>{item.category || 'Inventory asset'}</small><h2>{item.name}</h2><code>{item.tag}</code></span>{item.serial && <span><small>Serial number</small><strong>{item.serial}</strong></span>}</div>
                <div className="global-scan-facts">
                  <span><small>Location</small><strong>{item.location || 'Unassigned'}</strong><em>{item.room || 'No room recorded'}</em></span>
                  <span><small>{item.consumable ? 'Stock position' : item.status === 'On loan' ? 'Borrower' : 'Assignment'}</small><strong>{item.consumable ? `${Number(item.qty || 0)} on hand` : item.borrower || item.assignedTo || 'Not assigned'}</strong><em>{item.consumable ? `Minimum ${Number(item.min || 0)}` : item.due ? `Due ${item.due}` : item.condition || 'Condition not recorded'}</em></span>
                </div>
              </> : reserved ? <div className="global-scan-message reserved"><small>Generated inventory label</small><h2>Ready to register {reserved.equipmentType || 'new equipment'}</h2><p>This barcode was created by the system and is still unused. The equipment type and asset tag will be filled into the new inventory form automatically.</p><span><b>Category</b>{reserved.category || 'Inventory'}</span></div>
                : <div className="global-scan-message unknown"><small>Exception detected</small><h2>This barcode is not in inventory</h2><p>It may be a new device, an unregistered manufacturer barcode, or a label that was deleted. Register it as a new asset or review it in the scanner console.</p></div>}
            </div>

            <aside className="global-scan-code-panel">
              <div className="global-scan-barcode-card">
                <div className="global-scan-barcode-brand"><img src="brand/msbm-lockup.png" alt="Mona School of Business & Management" /><span><b>LIVE SCAN</b><small>Inventory identification</small></span></div>
                <div className="global-scan-barcode-bars"><BarcodeGraphic value={scan.value} height={48} width={1.45} displayValue={false} /></div>
                <code>{scan.value}</code>
              </div>
              <small>Captured {new Date(scan.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</small>
            </aside>
          </section>

          <div className="global-scan-recommendation"><i>⌁</i><span><small>Smart Scan recommendation</small><strong>{recommendation.label}</strong><p>Based on the barcode record, item class, current status, and your access level.</p></span></div>
          <div className="global-scan-action-heading"><span><small>Available workflows</small><strong>Confirm the recommended action or choose another</strong></span><em>Only this scan is active.</em></div>
          <div className="global-scan-actions">
            {item?.consumable ? <>
              <Action kind="consume" recommended={recommendation.kind === 'consume'} title="Issue this supply" detail={Number(item.qty || 0) > 0 ? 'Record quantity, recipient, and purpose' : 'This supply is currently depleted'} disabled={!canEdit || Number(item.qty || 0) === 0} onClick={onUseConsumable} />
              <Action kind="consumables" recommended={recommendation.kind === 'consumables'} title="Open Consumables" detail="Review printer compatibility and stock position" onClick={onOpenConsumables} />
              <Action kind="view" recommended={recommendation.kind === 'view'} title="View stock record" detail="Open purchasing and usage details" onClick={onView} />
            </> : item ? <>
              <Action kind="view" recommended={recommendation.kind === 'view'} title="View full asset" detail="Open lifecycle, assignment, and service history" onClick={onView} />
              <Action kind="checkout" recommended={recommendation.kind === 'checkout'} title="Check out" detail={canCheckout ? 'Start borrower and custody workflow' : `Unavailable while ${item.status}`} disabled={!canCheckout} onClick={onCheckout} />
              <Action kind="checkin" recommended={recommendation.kind === 'checkin'} title="Check in" detail={canCheckin ? 'Inspect and process the return' : 'Only available for loaned assets'} disabled={!canCheckin} onClick={onCheckin} />
            </> : <Action kind="register" recommended={recommendation.kind === 'register'} title={reserved ? `Add ${reserved.equipmentType || 'inventory item'}` : 'Register new asset'} detail={reserved ? 'Open a categorized, pre-filled inventory form' : 'Create a new record using this barcode'} disabled={!canEdit} onClick={onRegister} />}
            <Action kind="stocktake" title="Stocktake scanner" detail="Verify this item in a physical count" onClick={onStocktake} />
            <Action kind="console" recommended={recommendation.kind === 'console'} title="Scanner console" detail="Use continuous scanning and workflow modes" onClick={onScannerConsole} />
          </div>
        </main>
      </div>

      <footer className="global-scan-footer"><span><i />The next barcode replaces this scan with its own smart action</span><div><button type="button" onClick={onClose}>Dismiss</button></div></footer>
    </section>
  </div>;
}
