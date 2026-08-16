import { useEffect, useMemo, useState } from 'react';
import { thumbStyle } from '../data.js';

const FILTERS = ['All', 'Pending', 'Approved', 'Declined'];

export default function Requests({ requests, role, sessionName, focusRequestId, focusNonce, onApprove, onDecline, onRetryHelpdesk, onAcknowledge }) {
  const isStaff = role === 'Staff';
  const [filter, setFilter] = useState('All');
  const [declineCandidate, setDeclineCandidate] = useState(null);
  const [declineReason, setDeclineReason] = useState('');
  const scope = useMemo(() => isStaff ? requests.filter((request) => request.by === sessionName) : requests, [isStaff, requests, sessionName]);
  const visible = useMemo(() => scope.filter((request) => filter === 'All' || request.state === filter), [filter, scope]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((state) => [state, state === 'All' ? scope.length : scope.filter((request) => request.state === state).length])), [scope]);
  const requisitions = scope.filter((request) => request.type === 'Requisition').length;

  useEffect(() => {
    if (!focusRequestId) return undefined;
    setFilter('All');
    const frame = requestAnimationFrame(() => document.querySelector(`[data-request-id="${CSS.escape(String(focusRequestId))}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [focusRequestId, focusNonce]);

  return (
    <div className="requests-workspace">
      <section className="requests-overview">
        <div><small>Decision workspace</small><h2>Requests and approvals</h2><p>Review borrowing needs and purchasing requisitions with the operational context needed to make a clear decision.</p></div>
        <div className="requests-overview-stats"><span><small>Awaiting decision</small><strong>{counts.Pending}</strong></span><span><small>Requisitions</small><strong>{requisitions}</strong></span><span><small>Approval rate</small><strong>{scope.length ? Math.round((counts.Approved / scope.length) * 100) : 0}%</strong></span></div>
      </section>

      <div className="requests-filter-bar">
        <span><strong>{filter === 'All' ? 'Request register' : `${filter} requests`}</strong><small>{visible.length} record{visible.length === 1 ? '' : 's'} in this view</small></span>
        <div>{FILTERS.map((state) => <button key={state} type="button" data-active={filter === state} onClick={() => setFilter(state)}>{state}<b>{counts[state]}</b></button>)}</div>
      </div>

      <div className="requests-card-list">
        {visible.map((request) => {
          const requisition = request.type === 'Requisition';
          const actionable = role === 'Admin' && request.state === 'Pending';
          const sendingSince = Date.parse(request.helpdeskLastAttemptAt || request.helpdeskQueuedAt || '');
          const staleSending = request.helpdeskStatus === 'Sending' && (!Number.isFinite(sendingSince) || Date.now() - sendingSince > 120000);
          const pdfEmailVerified = request.helpdeskEmailStatus === 'Sent'
            && request.helpdeskPdfAttachmentKind === 'email-upload'
            && Number(request.helpdeskEmailAttachmentCount || 0) > 0;
          const emailIncomplete = request.helpdeskStatus === 'Created' && !pdfEmailVerified;
          const helpdeskRetryable = emailIncomplete || (request.helpdeskStatus !== 'Created' && (request.helpdeskStatus !== 'Sending' || staleSending));
          return (
            <article key={request.id} data-request-id={request.id} data-dashboard-focus={request.id === focusRequestId ? 'true' : undefined} data-workflow-unread={request.workflowUnread ? 'true' : undefined} onClick={() => onAcknowledge?.(request.id)} className={`request-card request-${request.state.toLowerCase()}`}>
              <span className="request-state-rail" />
              <div className="request-asset-block">
                <span className="request-asset-thumb" style={thumbStyle(request.model, 62, 12)} />
                <span><small>{requisition ? 'Purchase requisition' : 'Equipment request'}</small><strong>{request.itemName}{request.workflowUnread && <i className="workflow-item-dot" title="New workflow item" />}</strong><code>{request.id}</code></span>
              </div>
              <div className="request-context">
                <span className="request-person-mark">{String(request.by || '?').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
                <span><small>Requested by</small><strong>{request.by}</strong><p>{request.need || 'No additional purpose was recorded.'}</p><em>{request.when}</em></span>
              </div>
              <div className="request-decision">
                <span className={`request-status request-status-${request.state.toLowerCase()}`}><i />{request.state}</span>
                {!requisition && request.helpdeskStatus === 'Created' && pdfEmailVerified && <small className="request-helpdesk-status success">Zoho ticket <b>#{request.helpdeskTicketNumber || request.helpdeskTicketId}</b> created · PDF emailed</small>}
                {!requisition && request.helpdeskStatus === 'Created' && !pdfEmailVerified && <small className="request-helpdesk-status failed" title={request.helpdeskEmailError || ''}>Zoho ticket <b>#{request.helpdeskTicketNumber || request.helpdeskTicketId}</b> created · PDF email needs attention{role === 'Admin' && request.helpdeskEmailError ? `: ${request.helpdeskEmailError}` : ''}</small>}
                {!requisition && request.helpdeskStatus === 'Sending' && <small className="request-helpdesk-status sending">Creating Zoho ticket…</small>}
                {!requisition && request.helpdeskStatus !== 'Created' && request.helpdeskStatus !== 'Sending' && <small className="request-helpdesk-status failed" title={request.helpdeskError || ''}>Helpdesk delivery needs attention{role === 'Admin' && request.helpdeskError ? `: ${request.helpdeskError}` : ''}</small>}
                {requisition && request.state === 'Approved' && <small>Approved by {request.approvedBy || 'IT management'}<br />Order workflow generated</small>}
                {request.state === 'Declined' && <small className="request-decline-summary"><b>Reason:</b> {request.declineReason || 'No reason was recorded for this historical decision.'}{request.declinedBy && <><br />Declined by {request.declinedBy}{request.declinedOn ? ` · ${request.declinedOn}` : ''}</>}</small>}
                {actionable && <div><button type="button" className="request-approve" onClick={() => onApprove(request.id)}>{requisition ? 'Approve requisition' : 'Approve request'}</button><button type="button" className="request-decline" onClick={() => { setDeclineCandidate(request); setDeclineReason(''); }}>Decline</button></div>}
                {role === 'Admin' && !requisition && helpdeskRetryable && <button type="button" className="request-helpdesk-retry" onClick={(event) => { event.stopPropagation(); onRetryHelpdesk?.(request.id); }}>Retry Zoho</button>}
              </div>
            </article>
          );
        })}
        {!visible.length && <div className="requests-empty"><span>✓</span><strong>No {filter === 'All' ? '' : filter.toLowerCase()} requests to show</strong><small>{scope.length ? 'Choose another decision filter to view existing records.' : 'New borrowing requests and requisitions will appear here.'}</small></div>}
      </div>
      {declineCandidate && <div className="request-decline-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeclineCandidate(null); }}>
        <section className="request-decline-modal" role="dialog" aria-modal="true" aria-labelledby="request-decline-title">
          <header><span><small>Decision record</small><strong id="request-decline-title">Decline this {declineCandidate.type === 'Requisition' ? 'requisition' : 'loan request'}?</strong><p>The requester will be able to see the reason you provide.</p></span><button type="button" onClick={() => setDeclineCandidate(null)} aria-label="Close">×</button></header>
          <div className="request-decline-item"><span style={thumbStyle(declineCandidate.model, 48, 10)} /><span><small>Requested item</small><strong>{declineCandidate.itemName}</strong><p>{declineCandidate.by} · {declineCandidate.need}</p></span></div>
          <label className="request-decline-field"><span>Reason for declining <b>Required</b></span><textarea autoFocus rows="5" value={declineReason} onChange={(event) => setDeclineReason(event.target.value)} placeholder="Explain why this request cannot be approved and, where possible, suggest the next step…" /><small>{declineReason.trim().length < 3 ? 'Enter at least 3 characters.' : 'This explanation will be saved with the request.'}</small></label>
          <footer><button type="button" className="request-decline-cancel" onClick={() => setDeclineCandidate(null)}>Keep pending</button><button type="button" className="request-decline-confirm" disabled={declineReason.trim().length < 3} onClick={() => { if (onDecline(declineCandidate.id, declineReason)) { setDeclineCandidate(null); setDeclineReason(''); } }}>Decline with reason</button></footer>
        </section>
      </div>}
    </div>
  );
}
