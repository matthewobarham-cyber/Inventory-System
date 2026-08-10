import { useMemo, useState } from 'react';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';

export default function AuditLog({ entries }) {
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('All actions');
  const [sort, setSort] = useState({ key: 'when', direction: 'desc' });
  const actions = useMemo(() => Array.from(new Set(entries.map((entry) => entry.action))).sort(), [entries]);
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = entries
      .filter((entry) => action === 'All actions' || entry.action === action)
      .filter((entry) => !term || `${entry.by} ${entry.byEmail} ${entry.action} ${entry.details}`.toLowerCase().includes(term));
    return sortRows(filtered, sort, { when: (row) => row.at, user: (row) => row.by, action: (row) => row.action, details: (row) => row.details });
  }, [entries, query, action, sort]);

  return <div style={{ maxWidth: 1300, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <div style={{ display: 'flex', gap: 10 }}>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter by user or details…" style={{ width: 320, height: 36, padding: '0 11px', border: '1px solid #dfe3e9', borderRadius: 8 }} />
      <select value={action} onChange={(event) => setAction(event.target.value)} style={{ height: 36, padding: '0 10px', border: '1px solid #dfe3e9', borderRadius: 8, background: '#fff' }}>
        <option>All actions</option>{actions.map((value) => <option key={value}>{value}</option>)}
      </select>
      <span style={{ alignSelf: 'center', color: '#7b8794', fontSize: 11.5 }}>{visible.length} entries</span>
    </div>
    <div style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '170px 180px 190px 1fr', gap: 12, padding: '10px 15px', background: '#f7f9fb', color: '#7b8794', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase' }}>{[['when', 'When'], ['user', 'User'], ['action', 'Action'], ['details', 'Details']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={sort} onSort={(key) => setSort((current) => nextSort(current, key))} />)}</div>
      {visible.map((entry) => <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '170px 180px 190px 1fr', gap: 12, padding: '11px 15px', borderTop: '1px solid #edf0f3', fontSize: 11.5 }}>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{new Date(entry.at).toLocaleString()}</span>
        <span><strong style={{ display: 'block' }}>{entry.by}</strong><small style={{ color: '#7b8794' }}>{entry.byEmail}</small></span>
        <strong>{entry.action}</strong><span style={{ whiteSpace: 'pre-wrap' }}>{entry.details}</span>
      </div>)}
      {!visible.length && <div style={{ padding: 42, textAlign: 'center', color: '#7b8794', fontSize: 12.5 }}>No audit entries match this filter.</div>}
    </div>
  </div>;
}
