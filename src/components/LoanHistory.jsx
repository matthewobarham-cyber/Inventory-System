import { useMemo, useState } from 'react';
import { thumbStyle, longDate, daysBetween } from '../data.js';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';

const historyState = (row) => row.condition !== 'Returned complete' ? 'Attention' : daysBetween(row.due, row.back) > 0 ? 'Late' : 'On time';
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

export default function LoanHistory({ history, stillOutCount, isStaff, sessionName, query, onOpenItem }) {
  const [sort, setSort] = useState({ key: 'returned', direction: 'desc' });
  const [filter, setFilter] = useState('All');
  const scope = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (isStaff ? history.filter((row) => row.borrower === sessionName) : history).filter((row) => !needle || `${row.name} ${row.tag} ${row.borrower} ${row.room}`.toLowerCase().includes(needle));
  }, [history, isStaff, sessionName, query]);
  const filtered = useMemo(() => scope.filter((row) => filter === 'All' || historyState(row) === filter), [scope, filter]);
  const sorted = useMemo(() => sortRows(filtered, sort, { asset: (row) => row.name, borrower: (row) => row.borrower, out: (row) => row.out, due: (row) => row.due, returned: (row) => row.back, outcome: (row) => `${daysBetween(row.due, row.back)} ${row.condition}` }), [filtered, sort]);
  const returnedLateCount = scope.filter((row) => daysBetween(row.due, row.back) > 0).length;
  const lateCount = scope.filter((row) => historyState(row) === 'Late').length;
  const attentionCount = scope.filter((row) => historyState(row) === 'Attention').length;
  const onTimeCount = scope.filter((row) => historyState(row) === 'On time').length;
  const avgDays = scope.length ? Math.round(scope.reduce((sum, row) => sum + daysBetween(row.out, row.back), 0) / scope.length) : 0;
  const onTimeRate = scope.length ? Math.round((onTimeCount / scope.length) * 100) : 100;

  return <div className="loan-history-workspace">
    <section className="loan-history-overview">
      <div><small>LENDING PERFORMANCE</small><h2>Loan history & accountability</h2><p>Review completed lending activity, return performance and equipment condition across the full audit trail.</p></div>
      <div><span><strong>{onTimeRate}%</strong><small>on-time & complete</small></span><i style={{ '--rate': `${onTimeRate * 3.6}deg` }} /><p>{scope.length} completed loan{scope.length === 1 ? '' : 's'} in this view</p></div>
    </section>

    <section className="loan-history-stats">
      {[['Completed loans', scope.length, 'Recorded returns', 'blue'], ['Returned late', returnedLateCount, scope.length ? `${Math.round((returnedLateCount / scope.length) * 100)}% of completed loans` : 'No completed loans', 'red'], ['Average duration', `${avgDays} days`, 'Time equipment remained out', 'purple'], ['Still circulating', stillOutCount, 'Active loans outside this history', 'amber']].map(([label, value, note, tone]) => <article key={label} data-tone={tone}><small>{label}</small><strong>{value}</strong><span>{note}</span></article>)}
    </section>

    <section className="loan-history-toolbar"><div>{[['All', scope.length], ['On time', onTimeCount], ['Late', lateCount], ['Attention', attentionCount]].map(([label, count]) => <button key={label} type="button" data-active={filter === label} onClick={() => setFilter(label)}>{label}<span>{count}</span></button>)}</div><p>{filtered.length} matching record{filtered.length === 1 ? '' : 's'}{query ? ` for “${query}”` : ''}</p></section>

    <section className="loan-history-table">
      <header>{[['asset', 'Asset'], ['borrower', 'Borrower'], ['out', 'Checked out'], ['due', 'Due'], ['returned', 'Returned'], ['outcome', 'Outcome']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} />)}</header>
      {sorted.map((row) => {
        const late = Math.max(0, daysBetween(row.due, row.back));
        const state = historyState(row);
        return <button className="loan-history-row" data-state={state} key={row.id} type="button" onClick={() => onOpenItem(row.itemId)}>
          <span className="history-asset"><span style={thumbStyle(row.model, 38, 7)} /><span><small>{row.id}</small><strong>{row.name}</strong><code>{row.tag}</code></span></span>
          <span className="history-borrower"><i>{initials(row.borrower)}</i><span><strong>{row.borrower}</strong><small>Issued by {row.issuedBy || 'not recorded'}</small></span></span>
          <time>{longDate(row.out)}</time><time>{longDate(row.due)}</time><time>{longDate(row.back)}</time>
          <span className="history-outcome"><b>{state}</b><strong>{late ? `${late} day${late === 1 ? '' : 's'} late` : 'Returned on schedule'}</strong><small>{row.condition}</small></span>
        </button>;
      })}
      {!sorted.length && <div className="loans-empty compact"><span>⌁</span><strong>No completed loans match this view</strong><p>Adjust the outcome filter or search query.</p></div>}
    </section>
  </div>;
}
