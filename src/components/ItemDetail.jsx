import { useEffect, useMemo, useState } from 'react';
import { Inv3D } from '../three-engine.js';
import { glbUrl, money, longDate, daysBetween, statusTagStyle, today, iso, SHOW_WATERMARK, effStatus } from '../data.js';
import { IconArrowLeft, IconRefresh, IconCheckoutArrow } from '../icons.jsx';
import BarcodeLabelModal, { BarcodeGraphic } from './BarcodeLabelModal.jsx';
import { bookValueFor, expectedReplacementFor } from '../lifecycle.js';

export default function ItemDetail({
  item, history, maintenanceTickets = [], lifecycleActions = [], canLoanNow, isStaff, canEdit, canDelete, onBack, onOpenCheckout, onRequestBorrow, onOpenEdit, onDelete, onGenerateInvoice, onReorder, onOpenLifecycle,
  pendingOrder, pendingPlacement, onViewOrder, onOpenPlacements
}) {
  const [spin, setSpin] = useState(true);
  const [labelOpen, setLabelOpen] = useState(false);

  useEffect(() => {
    Inv3D.sync();
  }, [item.model]);

  const toggleSpin = async () => {
    const on = Inv3D.toggleSpin();
    setSpin(on);
  };
  const resetView = async () => {
    Inv3D.resetDetail();
    setSpin(true);
  };

  const past = useMemo(() => history.filter((h) => h.itemId === item.id), [history, item.id]);
  const todayIso = iso(today());

  const loanLog = useMemo(() => {
    const current = item.borrower ? [{
      borrower: item.borrower,
      rail: '#0a3d7c',
      flag: 'Out now', flagStatus: 'On loan',
      dates: longDate(item.since) + '  →  due ' + longDate(item.due),
      dateTone: item.due < todayIso ? '#a01a12' : '#0a3d7c',
      dateBackground: item.due < todayIso ? '#fff3f2' : '#f1f5fb',
      meta: daysBetween(item.since, todayIso) + ' days out · authorized by ' + (item.issuedBy || 'not recorded') + ' · held in ' + item.location + ' ' + item.room
    }] : [];
    const pastRows = past.map((h) => {
      const late = daysBetween(h.due, h.back);
      return {
        borrower: h.borrower,
        rail: late > 0 ? '#b3261e' : '#c3ccd6',
        flag: late > 0 ? late + ' day' + (late === 1 ? '' : 's') + ' late' : 'On time',
        flagStatus: late > 0 ? 'Low stock' : 'In stock',
        dates: longDate(h.out) + '  →  ' + longDate(h.back),
        dateTone: late > 0 ? '#a01a12' : '#0a3d7c',
        dateBackground: late > 0 ? '#fff3f2' : '#f1f5fb',
        meta: daysBetween(h.out, h.back) + ' days out · issued by ' + h.issuedBy + ' · ' + h.condition.toLowerCase()
      };
    });
    return current.concat(pastRows);
  }, [item, past, todayIso]);

  const borrowers = Array.from(new Set(past.map((h) => h.borrower).concat(item.borrower ? [item.borrower] : [])));
  const daysOut = past.reduce((a, h) => a + daysBetween(h.out, h.back), 0) + (item.borrower ? daysBetween(item.since, todayIso) : 0);
  const late = past.filter((h) => h.back > h.due).length;

  const fields = [
    { label: 'Serial', value: item.serial },
    { label: 'Location', value: item.location + ' · ' + item.room },
    { label: 'Assignment', value: item.assignedTo || item.borrower || 'Unassigned' },
    { label: item.consumable ? 'On hand' : 'Units', value: item.consumable ? item.qty + ' (min ' + item.min + ')' : String(item.qty ?? 1) },
    ...(item.consumable ? [
      { label: 'Unit of measure', value: item.unitOfMeasure || 'unit' },
      { label: 'Supply / cartridge code', value: item.stockCode || 'Not recorded' },
      { label: 'Colour / variant', value: item.color || 'Not recorded' },
      { label: 'Batch / lot', value: item.batchNumber || 'Not recorded' },
      { label: 'Expiry date', value: item.expiryDate ? longDate(item.expiryDate) : 'Not recorded' }
    ] : []),
    { label: 'Condition', value: item.condition },
    { label: 'Unit cost', value: money(item.cost) },
    { label: 'Current book value', value: money(bookValueFor(item)) },
    { label: 'Supplier', value: item.supplier },
    { label: 'Purchased', value: longDate(item.purchased) },
    { label: 'Warranty until', value: longDate(item.warranty) },
    { label: 'Expected replacement', value: longDate(expectedReplacementFor(item)) },
    { label: 'Last physically verified', value: item.lastVerifiedAt ? `${dateTimeForAsset(item.lastVerifiedAt)} · ${item.lastVerifiedBy || 'Unknown user'}` : 'Never verified' },
    { label: 'Lifetime loans', value: item.loanCount + '×' },
    { label: 'Custodian', value: item.borrower || 'IT Services store' }
  ];

  const lifecycle = [
    { date: longDate(item.purchased), text: 'Received from ' + item.supplier + ' and tagged ' + item.tag },
    { date: longDate(item.warranty), text: 'Warranty cover ends' },
    { date: longDate(item.purchased), text: 'Onboarded into ' + item.location + ' ' + item.room }
  ];

  const st = effStatus(item);
  const canCheckout = canLoanNow && !item.archived && !item.consumable && item.status === 'In stock';

  return (
    <div style={{ maxWidth: 1420, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button type="button" className="btn-link" onClick={onBack} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 500 }}>
        <IconArrowLeft />
        <span>{item.consumable ? 'Back to consumables' : 'Back to inventory'}</span>
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 20, alignItems: 'stretch' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={{ height: 550, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
              <div data-detail-model={glbUrl(item.model)}
                style={{ position: 'relative', height: '100%', background: 'radial-gradient(closest-side,#eaeff6,#f8f9fb)', cursor: 'grab' }}></div>
              {SHOW_WATERMARK && (
                <img src="brand/msbm-lockup.png" alt="" style={{ position: 'absolute', left: 16, bottom: 14, width: 84, height: 'auto', opacity: .15, pointerEvents: 'none' }} />
              )}
            </div>
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderTop: '1px solid #eceff3' }}>
              <button type="button" className="btn-ghost" onClick={toggleSpin} style={{ height: 31, display: 'flex', alignItems: 'center', gap: 7, padding: '0 11px', borderRadius: 7, fontSize: 12, fontWeight: 500 }}>
                <IconRefresh />
                <span>{spin ? 'Pause rotation' : 'Resume rotation'}</span>
              </button>
              <button type="button" className="btn-ghost" onClick={resetView} style={{ height: 31, padding: '0 11px', borderRadius: 7, fontSize: 12, fontWeight: 500 }}>Reset view</button>
              <div style={{ flex: 1 }}></div>
              <span style={{ fontSize: 11, color: '#8d99a6' }}>Drag to orbit · scroll to zoom</span>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 260, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid #eceff3', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flex: 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Borrowing history</span>
              <span style={{ fontSize: 11.5, color: '#7b8794' }}>{loanLog.length}{loanLog.length === 1 ? ' loan on record' : ' loans on record'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#eceff3', borderBottom: '1px solid #eceff3', flex: 'none' }}>
              {[
                { label: 'Distinct borrowers', value: String(borrowers.length) },
                { label: 'Total days out', value: String(daysOut) },
                { label: 'Returned late', value: String(late) }
              ].map((ls) => (
                <div key={ls.label} style={{ background: '#fff', padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8d99a6' }}>{ls.label}</span>
                  <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em' }}>{ls.value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'auto' }}>
              {loanLog.map((lg, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f2f4f7' }}>
                  <span style={{ width: 3, flex: 'none', borderRadius: 2, background: lg.rail }}></span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{lg.borrower}</span>
                      <span style={statusTagStyle(lg.flagStatus)}>{lg.flag}</span>
                    </div>
                    <span style={{ margin: '2px 0', padding: '7px 9px', display: 'flex', alignItems: 'center', gap: 10, background: lg.dateBackground, border: '1px solid ' + (lg.dateTone === '#a01a12' ? '#f4cdc9' : '#d9e3f0'), borderRadius: 7 }}>
                      <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: lg.dateTone }}>Loan period</span>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, fontWeight: 600, color: lg.dateTone }}>{lg.dates}</span>
                    </span>
                    <span style={{ fontSize: 11.5, color: '#7b8794' }}>{lg.meta}</span>
                  </div>
                </div>
              ))}
              {loanLog.length === 0 && (
                <div style={{ padding: '30px 16px', textAlign: 'center', fontSize: 12.5, color: '#8d99a6' }}>This asset has never been loaned out.</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ height: 550, display: 'flex', flexDirection: 'column', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, padding: 18, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#7b8794' }}>{item.category}</span>
                <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-.02em', lineHeight: 1.2 }}>{item.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#0b4a94' }}>{item.tag}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <button type="button" onClick={() => setLabelOpen(true)} title="Preview barcode label" style={{ padding: '7px 9px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, cursor: 'pointer', maxWidth: 190 }}>
                  <BarcodeGraphic value={item.tag} height={30} width={1.3} displayValue={false} />
                </button>
                <span style={statusTagStyle(st)}>{st}</span>
              </div>
            </div>
            {pendingOrder && (
              <button type="button" onClick={() => onViewOrder(pendingOrder.id)} style={{ marginTop: 10, minHeight: 34, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, background: '#fdf6e9', border: '1px solid #f1d5ad', borderRadius: 8, color: '#8a5209', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: '#b8710f' }}></span>
                <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600 }}>Restock already ordered: {pendingOrder.qty} units from {pendingOrder.supplier} · expected {pendingOrder.expectedOn}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>View vendor order →</span>
              </button>
            )}
            {!pendingOrder && pendingPlacement && (
              <button type="button" onClick={onOpenPlacements} style={{ marginTop: 10, minHeight: 34, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, background: '#eaf5ee', border: '1px solid #cce6d6', borderRadius: 8, color: '#155e3f', textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: '#1c7c54' }}></span>
                <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600 }}>Restock received: {pendingPlacement.remainingQty} units awaiting assignment</span>
                <span style={{ fontSize: 10.5, fontWeight: 700 }}>Open intake →</span>
              </button>
            )}
            <div style={{ marginTop: pendingOrder || pendingPlacement ? 9 : 16, flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#eceff3', border: '1px solid #eceff3', borderRadius: 8, overflow: 'hidden' }}>
              {fields.map((fd) => (
                <div key={fd.label} style={{ background: '#fff', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8d99a6' }}>{fd.label}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500 }}>{fd.value}</span>
                </div>
              ))}
            </div>
            <div data-action-row="1" style={{ marginTop: 16, flex: 'none', display: 'flex', flexWrap: 'nowrap', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {canCheckout && (
                <button type="button" className="btn-primary" onClick={() => onOpenCheckout(item.id)} style={{ height: 36, display: 'flex', alignItems: 'center', gap: 7, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
                  <IconCheckoutArrow />
                  <span>Check out</span>
                </button>
              )}
              {isStaff && !item.archived && item.status === 'In stock' && !item.consumable && (
                <button type="button" className="btn-primary" onClick={onRequestBorrow} style={{ height: 36, display: 'flex', alignItems: 'center', gap: 7, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>
                  <span>Request to borrow</span>
                </button>
              )}
              {canEdit && (
                <button type="button" className="btn-ghost" onClick={onOpenEdit} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Edit record</button>
              )}
              {canEdit && (
                <button type="button" className="btn-ghost" onClick={onReorder} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Reorder</button>
              )}
              {canEdit && (
                <button type="button" className="btn-ghost" onClick={onOpenLifecycle} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Lifecycle</button>
              )}
              {canDelete && (
                <button type="button" className="btn-ghost-danger" onClick={onDelete} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Delete permanently</button>
              )}
              {canDelete && item.invoiceRequired && !item.invoiceGenerated && (
                <button type="button" className="btn-ghost" onClick={onGenerateInvoice} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Generate invoice</button>
              )}
              <button type="button" className="btn-ghost" onClick={() => setLabelOpen(true)} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Preview / print barcode</button>
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10 }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid #eceff3', fontSize: 13, fontWeight: 600 }}>Asset lifecycle</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {lifecycle.map((h, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, padding: '11px 16px', borderBottom: '1px solid #f2f4f7' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#8d99a6', width: 92, flex: 'none' }}>{h.date}</span>
                  <span style={{ flex: 1, fontSize: 12.5 }}>{h.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #eceff3' }}><span style={{ fontSize: 13, fontWeight: 600 }}>Repair & maintenance history</span><span style={{ color: '#7b8794', fontSize: 11 }}>{maintenanceTickets.length} ticket{maintenanceTickets.length === 1 ? '' : 's'}</span></div>
            {maintenanceTickets.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).map((ticket) => (
              <div key={ticket.id} style={{ padding: '11px 16px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: '1px solid #f0f2f4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><strong style={{ flex: 1, fontSize: 12 }}>{ticket.faultDescription}</strong><span style={{ padding: '3px 7px', borderRadius: 999, background: ticket.status === 'Completed' ? '#e7f4ec' : ticket.status === 'Cancelled' ? '#f1f2f4' : '#fdf0e0', color: ticket.status === 'Completed' ? '#155e3f' : ticket.status === 'Cancelled' ? '#5b6672' : '#8a5209', fontSize: 9.5, fontWeight: 700 }}>{ticket.status}</span></div>
                <span style={{ color: '#65727f', fontSize: 10.5 }}>{ticket.id} · Opened {dateTimeForAsset(ticket.createdAt)} by {ticket.createdBy} · Technician: {ticket.technician || 'Unassigned'}</span>
                {ticket.resolution && <span style={{ padding: '7px 8px', background: '#f6f8fa', borderRadius: 6, color: '#45525f', fontSize: 10.5 }}><strong>Resolution:</strong> {ticket.resolution}</span>}
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: '#778491', fontSize: 10.5 }}><span>{ticket.vendor ? `${ticket.vendor}${ticket.rmaNumber ? ` · RMA ${ticket.rmaNumber}` : ''}` : 'Internal service'}</span><span>Parts {money(Number(ticket.partsCost || 0))} · Labor {money(Number(ticket.laborCost || 0))}</span></span>
              </div>
            ))}
            {!maintenanceTickets.length && <div style={{ padding: '26px 16px', textAlign: 'center', color: '#8a96a2', fontSize: 12 }}>No repair or preventive-maintenance tickets on record.</div>}
          </div>

          <div style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eceff3' }}><span style={{ fontSize: 13, fontWeight: 600 }}>Lifecycle workflow history</span><span style={{ color: '#7b8794', fontSize: 11 }}>{lifecycleActions.length} request{lifecycleActions.length === 1 ? '' : 's'}</span></div>
            {lifecycleActions.slice().sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt))).map((action) => <div key={action.id} style={{ padding: '10px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, borderBottom: '1px solid #f0f2f4' }}><span><strong style={{ display: 'block', fontSize: 12 }}>{action.type}</strong><small style={{ color: '#687582' }}>{action.id} · requested by {action.requestedBy} on {dateTimeForAsset(action.requestedAt)}</small></span><span style={{ padding: '3px 7px', alignSelf: 'start', borderRadius: 999, background: action.status === 'Rejected' ? '#fdeceb' : ['Approved', 'Completed'].includes(action.status) ? '#e7f4ec' : '#fdf0e0', color: action.status === 'Rejected' ? '#a01a12' : ['Approved', 'Completed'].includes(action.status) ? '#155e3f' : '#8a5209', fontSize: 9.5, fontWeight: 700 }}>{action.status}</span><span style={{ gridColumn: '1 / -1', color: '#586572', fontSize: 10.5 }}>{action.justification}</span></div>)}
            {!lifecycleActions.length && <div style={{ padding: '24px 16px', textAlign: 'center', color: '#8a96a2', fontSize: 12 }}>No transfer or disposition workflows on record.</div>}
          </div>
        </div>
      </div>
      <BarcodeLabelModal open={labelOpen} item={item} onClose={() => setLabelOpen(false)} />
    </div>
  );
}

function dateTimeForAsset(value) {
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
