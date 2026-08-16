import { useEffect, useMemo, useState } from 'react';
import { daysBetween, glbUrlForItem, longDate } from '../data.js';
import { Inv3D } from '../three-engine.js';

const todayIso = () => new Date().toISOString().slice(0, 10);
const belongsTo = (record, session) => record.borrowerEmail
  ? record.borrowerEmail.toLowerCase() === String(session?.email || '').toLowerCase()
  : record.borrower === session?.name;

const outcome = (row) => row.condition !== 'Returned complete'
  ? ['Returned with an issue', 'red']
  : daysBetween(row.due, row.back) > 0
    ? ['Returned late', 'amber']
    : ['Returned on time', 'green'];

export default function StaffLoanHistory({ history = [], items = [], session, onOpenItem, onBrowse }) {
  const [view, setView] = useState('Active');
  const active = useMemo(() => items.filter((item) => item.status === 'On loan' && belongsTo({ borrower: item.borrower, borrowerEmail: item.borrowerEmail }, session)), [items, session]);
  const completed = useMemo(() => history.filter((row) => belongsTo(row, session)), [history, session]);
  const late = completed.filter((row) => daysBetween(row.due, row.back) > 0).length;
  const attention = completed.filter((row) => row.condition !== 'Returned complete').length;
  const onTime = Math.max(0, completed.length - late - attention);
  const onTimeRate = completed.length ? Math.round((onTime / completed.length) * 100) : 100;
  const rows = view === 'Active' ? active : view === 'Attention' ? completed.filter((row) => outcome(row)[1] !== 'green') : completed;

  useEffect(() => {
    const frame = requestAnimationFrame(() => Inv3D.sync());
    return () => cancelAnimationFrame(frame);
  }, [rows]);

  return <div className="staff-personal staff-loan-centre">
    <section className="staff-personal-hero loans">
      <div>
        <small>My borrowing record</small>
        <h2>Your equipment, return dates, and borrowing history.</h2>
        <p>Keep track of what you currently have and review every completed return recorded by IT Services.</p>
        <button type="button" onClick={onBrowse}>Browse available equipment</button>
      </div>
      <div className="staff-loan-score"><span><strong>{onTimeRate}%</strong><small>on-time return record</small></span><i style={{ '--score': `${onTimeRate * 3.6}deg` }} /><p>{completed.length ? `${onTime} of ${completed.length} completed loans returned on time and complete.` : 'Your score begins after your first completed loan.'}</p></div>
    </section>

    <section className="staff-personal-stats">
      <article data-tone="blue"><i /><span><strong>{active.length}</strong><small>Currently with you</small></span></article>
      <article data-tone="green"><i /><span><strong>{completed.length}</strong><small>Completed returns</small></span></article>
      <article data-tone="amber"><i /><span><strong>{late}</strong><small>Returned late</small></span></article>
      <article data-tone="red"><i /><span><strong>{attention}</strong><small>Returns with issues</small></span></article>
    </section>

    <section className="staff-personal-register">
      <header>
        <span><small>Personal loan register</small><h3>{view === 'Active' ? 'Equipment currently with you' : view === 'Completed' ? 'Completed loan history' : 'Returns needing attention'}</h3><p>{rows.length} record{rows.length === 1 ? '' : 's'} in this view.</p></span>
        <nav aria-label="Loan history views">{[['Active', active.length], ['Completed', completed.length], ['Attention', late + attention]].map(([label, count]) => <button key={label} type="button" data-active={view === label} onClick={() => setView(label)}>{label}<b>{count}</b></button>)}</nav>
      </header>

      <div className="staff-loan-list">
        {rows.map((row) => {
          const current = view === 'Active';
          const state = current
            ? (row.due && row.due < todayIso() ? ['Return overdue', 'red'] : ['Currently on loan', 'blue'])
            : outcome(row);
          const days = current && row.due ? daysBetween(todayIso(), row.due) : 0;
          return <article key={row.id} className="staff-loan-card" data-tone={state[1]}>
            <button type="button" className="staff-personal-model compact" onClick={() => onOpenItem(row.itemId || row.id)} aria-label={`View ${row.name}`}><canvas data-model={glbUrlForItem(row)} aria-hidden="true" /><span>{row.tag}</span></button>
            <div className="staff-loan-main"><span className="staff-personal-status"><i />{state[0]}</span><small>{row.category || 'MSBM equipment'}</small><h4>{row.name}</h4><p>{current ? `Checked out ${longDate(row.since)} by ${row.issuedBy || 'IT Services'}.` : `Returned ${longDate(row.back)}. ${row.condition || 'Return completed'}.`}</p></div>
            <div className="staff-loan-dates">
              {current ? <><small>Return by</small><strong>{longDate(row.due)}</strong><span data-tone={state[1]}>{days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} remaining`}</span></> : <><small>Loan period</small><strong>{longDate(row.out)} – {longDate(row.back)}</strong><span data-tone={state[1]}>{state[0]}</span></>}
            </div>
            <button type="button" className="staff-personal-link" onClick={() => onOpenItem(row.itemId || row.id)}>View asset <span aria-hidden="true">→</span></button>
          </article>;
        })}
      </div>

      {!rows.length && <div className="staff-personal-empty"><span>⌁</span><strong>{view === 'Active' ? 'You do not currently have any equipment' : 'No loan records in this view'}</strong><p>{view === 'Active' ? 'Browse the available catalogue if you need to borrow something.' : 'Your completed returns will appear here.'}</p>{view === 'Active' && <button type="button" onClick={onBrowse}>Browse available equipment</button>}</div>}
    </section>
  </div>;
}
