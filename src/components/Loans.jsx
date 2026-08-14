import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { thumbStyle, shortDate, iso, today } from '../data.js';
import LoanEmailModal from './LoanEmailModal.jsx';
import StocktakeFlag from './StocktakeFlag.jsx';

const DAY = 86400000;
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const daysUntil = (value) => Math.ceil((new Date(`${value}T12:00:00`).getTime() - today().getTime()) / DAY);
const addDays = (value, amount) => {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return iso(date);
};

function loanState(item) {
  const days = daysUntil(item.due);
  if (days < 0) return 'Overdue';
  if (days <= 3) return 'Due soon';
  return 'On track';
}

function loanProgress(item) {
  const start = new Date(`${item.since}T12:00:00`).getTime();
  const end = new Date(`${item.due}T12:00:00`).getTime();
  const span = Math.max(DAY, end - start);
  return Math.max(4, Math.min(100, ((today().getTime() - start) / span) * 100));
}

export default function Loans({ items, canReturn, sender, emailContacts, onAddEmailContact, onEmailPrepared, onOpenItem, onCheckIn, onExtendLoan, onPreviewAgreement }) {
  const todayIso = iso(today());
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('urgency');
  const [emailItem, setEmailItem] = useState(null);
  const [extensionItem, setExtensionItem] = useState(null);
  const [extensionForm, setExtensionForm] = useState({ due: '', reason: '' });
  const [extensionError, setExtensionError] = useState('');
  const onLoan = useMemo(() => items.filter((item) => item.status === 'On loan'), [items]);
  const counts = useMemo(() => ({
    overdue: onLoan.filter((item) => loanState(item) === 'Overdue').length,
    dueSoon: onLoan.filter((item) => loanState(item) === 'Due soon').length,
    onTrack: onLoan.filter((item) => loanState(item) === 'On track').length,
    borrowers: new Set(onLoan.map((item) => item.borrower).filter(Boolean)).size
  }), [onLoan, todayIso]);
  const visible = useMemo(() => onLoan
    .filter((item) => filter === 'All' || loanState(item) === filter)
    .sort((a, b) => sort === 'asset' ? a.name.localeCompare(b.name) : sort === 'borrower' ? String(a.borrower).localeCompare(String(b.borrower)) : String(a.due).localeCompare(String(b.due))), [onLoan, filter, sort, todayIso]);

  const openExtension = (item) => {
    setExtensionItem(item);
    setExtensionForm({ due: addDays(item.due || todayIso, 7), reason: '' });
    setExtensionError('');
  };
  const closeExtension = () => {
    setExtensionItem(null);
    setExtensionError('');
  };
  const submitExtension = (event) => {
    event.preventDefault();
    if (!extensionItem) return;
    if (!extensionForm.due) {
      setExtensionError('Choose a new return date.');
      return;
    }
    if (extensionForm.due <= extensionItem.due) {
      setExtensionError('The extended return date must be later than the current due date.');
      return;
    }
    if (!extensionForm.reason.trim()) {
      setExtensionError('Enter a reason for the extension.');
      return;
    }
    const error = onExtendLoan?.(extensionItem.id, { due: extensionForm.due, reason: extensionForm.reason.trim() });
    if (error) {
      setExtensionError(error);
      return;
    }
    closeExtension();
  };

  return <div className="loans-workspace">
    <section className="loans-hero">
      <div><small>ACTIVE LENDING OPERATIONS</small><h2>Equipment currently in circulation</h2><p>Track every borrower, agreement and return deadline with immediate visibility of lending risk.</p><span><b>{onLoan.length}</b> active loan{onLoan.length === 1 ? '' : 's'} across <b>{counts.borrowers}</b> borrower{counts.borrowers === 1 ? '' : 's'}</span></div>
      <div className="loans-hero-orbit" aria-hidden="true"><i /><i /><span>↗</span><strong>{counts.overdue ? `${counts.overdue} overdue` : 'Healthy'}</strong><small>{counts.overdue ? 'Immediate follow-up required' : 'All returns within schedule'}</small></div>
    </section>

    <section className="loan-health-grid">
      {[['Active loans', onLoan.length, 'All equipment checked out', 'blue'], ['Overdue', counts.overdue, 'Past the agreed return date', 'red'], ['Due soon', counts.dueSoon, 'Due within the next three days', 'amber'], ['On track', counts.onTrack, 'Within the agreed loan period', 'green']].map(([label, value, note, tone]) => <button key={label} type="button" data-tone={tone} onClick={() => setFilter(label === 'Active loans' ? 'All' : label)}><small>{label}</small><strong>{value}</strong><span>{note}</span><i>Filter view →</i></button>)}
    </section>

    <section className="loans-toolbar">
      <div>{['All', 'Overdue', 'Due soon', 'On track'].map((value) => <button key={value} type="button" data-active={filter === value} onClick={() => setFilter(value)}>{value}<span>{value === 'All' ? onLoan.length : value === 'Overdue' ? counts.overdue : value === 'Due soon' ? counts.dueSoon : counts.onTrack}</span></button>)}</div>
      <span>{visible.length} result{visible.length === 1 ? '' : 's'}</span>
      <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="urgency">Return urgency</option><option value="asset">Asset name</option><option value="borrower">Borrower</option></select></label>
    </section>

    <section className="loan-card-grid">
      {visible.map((item) => {
        const state = loanState(item);
        const days = daysUntil(item.due);
        return <article className="loan-card" data-state={state} data-stocktake-state={item.stocktakeState || undefined} key={item.id}>
          <header><button type="button" className="loan-asset-identity" onClick={() => onOpenItem(item.id)}><span style={thumbStyle(item.model, 46, 8)} /><span><small>{item.category || 'Equipment'}</small><strong>{item.name}<StocktakeFlag item={item} /></strong><code>{item.tag}</code></span></button><b>{state}</b></header>
          <div className="loan-borrower"><span>{initials(item.borrower)}</span><div><small>Issued to</small><strong>{item.borrower || 'Borrower not recorded'}</strong><p>{item.borrowerEmail || 'No borrower email'} · Authorized by {item.issuedBy || 'not recorded'}</p></div></div>
          <div className="loan-dates"><span><small>Checked out</small><strong>{shortDate(item.since)}</strong></span><i>→</i><span><small>Return due</small><strong>{shortDate(item.due)}</strong></span></div>
          <div className="loan-life"><span><i style={{ width: `${loanProgress(item)}%` }} /></span><div><small>Loan period progress</small><strong>{days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue` : days === 0 ? 'Due today' : `${days} day${days === 1 ? '' : 's'} remaining`}</strong></div></div>
          <footer>{item.loanAgreement ? <button type="button" className="btn-ghost" onClick={() => onPreviewAgreement(item.loanAgreement)}>View agreement</button> : <span>No agreement attached</span>}{canReturn && <><button type="button" className="loan-email-button" onClick={() => setEmailItem(item)}>Email borrower</button><button type="button" className="loan-extension-button" onClick={() => openExtension(item)}>Extend loan</button><button type="button" className="loan-return-button" onClick={() => onCheckIn(item.id)}>Check in asset</button></>}</footer>
        </article>;
      })}
      {!visible.length && <div className="loans-empty"><span>✓</span><strong>{onLoan.length ? 'No loans match this filter' : 'Everything is accounted for'}</strong><p>{onLoan.length ? 'Choose another loan-health filter to see active records.' : 'No equipment is currently checked out.'}</p></div>}
    </section>
    {emailItem && <LoanEmailModal item={emailItem} sender={sender} contacts={emailContacts} onAddContact={onAddEmailContact} onPrepared={(details) => onEmailPrepared?.(emailItem.id, details)} onClose={() => setEmailItem(null)} />}
    {extensionItem && createPortal(<div className="loan-extension-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeExtension()}>
      <form className="loan-extension-modal" onSubmit={submitExtension} role="dialog" aria-modal="true" aria-labelledby="loan-extension-title">
        <header>
          <span className="loan-extension-icon" aria-hidden="true">&#8635;</span>
          <span><small>LOAN TERM MANAGEMENT</small><strong id="loan-extension-title">Extend this loan</strong><p>Approve a revised return date without interrupting the active loan.</p></span>
          <button type="button" onClick={closeExtension} aria-label="Close extension dialog">&times;</button>
        </header>
        <section className="loan-extension-asset">
          <span style={thumbStyle(extensionItem.model, 52, 10)} />
          <div><small>{extensionItem.category || 'Equipment'}</small><strong>{extensionItem.name}</strong><code>{extensionItem.tag}</code></div>
          <div><small>Borrower</small><strong>{extensionItem.borrower || 'Not recorded'}</strong></div>
        </section>
        <section className="loan-extension-dates">
          <div><small>Current return date</small><strong>{shortDate(extensionItem.due)}</strong></div>
          <span aria-hidden="true">&#8594;</span>
          <label><small>New return date</small><input type="date" min={addDays(extensionItem.due, 1)} value={extensionForm.due} onChange={(event) => { setExtensionForm((current) => ({ ...current, due: event.target.value })); setExtensionError(''); }} autoFocus /></label>
        </section>
        <label className="loan-extension-reason"><span>Reason for extension</span><textarea value={extensionForm.reason} onChange={(event) => { setExtensionForm((current) => ({ ...current, reason: event.target.value })); setExtensionError(''); }} placeholder="Explain why the borrower needs additional time..." rows="4" /></label>
        <div className="loan-extension-approval"><span aria-hidden="true">&#10003;</span><div><small>Extension authorized by</small><strong>{sender?.name || 'Current user'}</strong><p>The previous and revised due dates will be retained in the audit trail.</p></div></div>
        {extensionError && <p className="loan-extension-error" role="alert">{extensionError}</p>}
        <footer><button type="button" className="btn-ghost" onClick={closeExtension}>Cancel</button><button type="submit" className="loan-extension-confirm">Approve extension</button></footer>
      </form>
    </div>, document.body)}
  </div>;
}
