import { useEffect, useMemo, useState } from 'react';
import { glbUrlForItem, longDate } from '../data.js';
import { Inv3D } from '../three-engine.js';

const FILTERS = ['All', 'Pending', 'Approved', 'Declined'];
const copy = {
  Pending: ['Waiting for review', 'IT Services is reviewing your request.', 'amber'],
  Approved: ['Approved', 'Your request has been approved.', 'green'],
  Declined: ['Not approved', 'Review the reason below or contact IT Services.', 'red']
};

const belongsTo = (request, session) => request.byEmail
  ? request.byEmail.toLowerCase() === String(session?.email || '').toLowerCase()
  : request.by === session?.name;

export default function StaffRequests({ requests = [], session, onOpenItem, onBrowse }) {
  const [filter, setFilter] = useState('All');
  const mine = useMemo(() => requests.filter((request) => belongsTo(request, session)), [requests, session]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((state) => [state, state === 'All' ? mine.length : mine.filter((request) => request.state === state).length])), [mine]);
  const visible = useMemo(() => mine.filter((request) => filter === 'All' || request.state === filter), [mine, filter]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => Inv3D.sync());
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return <div className="staff-personal staff-request-centre">
    <section className="staff-personal-hero requests">
      <div>
        <small>My equipment requests</small>
        <h2>Everything you have asked to borrow, in one place.</h2>
        <p>See what is waiting for review, what has been approved, and any action you may need to take.</p>
        <button type="button" onClick={onBrowse}><span>+</span> Request another item</button>
      </div>
      <ol>
        <li data-active={counts.Pending > 0}><b>1</b><span><strong>Request sent</strong><small>Your request reaches IT Services immediately.</small></span></li>
        <li data-active={counts.Pending > 0}><b>2</b><span><strong>IT review</strong><small>Availability and borrowing rules are checked.</small></span></li>
        <li data-active={counts.Approved > 0}><b>3</b><span><strong>Collection</strong><small>Approved equipment is prepared for you.</small></span></li>
      </ol>
    </section>

    <section className="staff-personal-stats">
      <article data-tone="blue"><i /><span><strong>{mine.length}</strong><small>Total requests</small></span></article>
      <article data-tone="amber"><i /><span><strong>{counts.Pending}</strong><small>Waiting for review</small></span></article>
      <article data-tone="green"><i /><span><strong>{counts.Approved}</strong><small>Approved</small></span></article>
      <article data-tone="red"><i /><span><strong>{counts.Declined}</strong><small>Not approved</small></span></article>
    </section>

    <section className="staff-personal-register">
      <header>
        <span><small>Request activity</small><h3>My requests</h3><p>Choose a status to narrow the list.</p></span>
        <nav aria-label="Request status filters">{FILTERS.map((state) => <button key={state} type="button" data-active={filter === state} onClick={() => setFilter(state)}>{state === 'Pending' ? 'Waiting' : state}<b>{counts[state]}</b></button>)}</nav>
      </header>

      <div className="staff-request-grid">
        {visible.map((request) => {
          const state = copy[request.state] || [request.state, 'Status recorded by IT Services.', 'blue'];
          return <article key={request.id} className="staff-request-card" data-tone={state[2]}>
            <button type="button" className="staff-personal-model" onClick={() => onOpenItem(request.itemId)} aria-label={`View ${request.itemName}`}>
              <canvas data-model={glbUrlForItem(request)} aria-hidden="true" />
              <span>{request.type === 'Requisition' ? 'Purchase request' : 'Equipment loan'}</span>
            </button>
            <div className="staff-request-body">
              <span className="staff-personal-status"><i />{state[0]}</span>
              <small>{request.itemTag || request.id}</small>
              <h4>{request.itemName}</h4>
              <p>{state[1]}</p>
              <dl><div><dt>Requested</dt><dd>{longDate(request.submittedOn) || request.when || 'Recently'}</dd></div><div><dt>Reference</dt><dd>{request.id}</dd></div></dl>
              {request.helpdeskStatus === 'Created' && <aside className="staff-request-message helpdesk"><strong>Helpdesk ticket created</strong><span>Zoho Desk reference #{request.helpdeskTicketNumber || request.helpdeskTicketId}. {request.helpdeskEmailStatus === 'Sent' && request.helpdeskPdfAttachmentKind === 'email-upload' && Number(request.helpdeskEmailAttachmentCount || 0) > 0 ? 'A PDF confirmation was emailed to you.' : 'IT Services can track your request there.'}</span></aside>}
              {request.helpdeskStatus === 'Sending' && <aside className="staff-request-message helpdesk pending"><strong>Connecting to IT Services</strong><span>Your inventory request is safely recorded while its helpdesk ticket is created.</span></aside>}
              {request.helpdeskStatus === 'Failed' && <aside className="staff-request-message helpdesk warning"><strong>Your request is still saved</strong><span>IT Services has been notified that helpdesk delivery needs attention. You do not need to submit it again.</span></aside>}
              {request.state === 'Approved' && <aside className="staff-request-message success"><strong>What happens next?</strong><span>{request.fulfilledOn ? 'This item was issued to you. Check My loan history for its return date.' : 'IT Services will contact you when the item is ready for collection.'}</span></aside>}
              {request.state === 'Declined' && <aside className="staff-request-message declined"><strong>Why was it declined?</strong><span>{request.declineReason || 'No reason was recorded. Please contact IT Services for help.'}</span></aside>}
              <button type="button" className="staff-personal-link" onClick={() => onOpenItem(request.itemId)}>View equipment details <span aria-hidden="true">→</span></button>
            </div>
          </article>;
        })}
      </div>

      {!visible.length && <div className="staff-personal-empty"><span>✓</span><strong>{mine.length ? `No ${filter.toLowerCase()} requests` : 'You have not requested anything yet'}</strong><p>{mine.length ? 'Choose another status to see your other requests.' : 'Browse the equipment catalogue when you are ready.'}</p><button type="button" onClick={onBrowse}>Browse available equipment</button></div>}
    </section>
  </div>;
}
