import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { statusTagStyle, thumbStyle } from '../data.js';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';

const STATE_COLORS = {
  Verified: { background: '#e7f4ec', color: '#155e3f', border: '#c5e4d2' },
  Missing: { background: '#fdeceb', color: '#a01a12', border: '#f2c8c5' },
  'Wrong location': { background: '#fdf0e0', color: '#8a5209', border: '#efd2aa' },
  'Quantity mismatch': { background: '#fff5e8', color: '#8a5209', border: '#efd2aa' },
  Unexpected: { background: '#efeafa', color: '#5b3f91', border: '#d9cdef' },
  Cancelled: { background: '#f1f3f5', color: '#66717c', border: '#dce1e6' },
  Unverified: { background: '#f1f3f5', color: '#66717c', border: '#dce1e6' }
};

const dateTime = (value) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const scopeLabel = (session) => session.scopeType === 'room' ? `${session.building} · ${session.room}` : session.building;

function StateBadge({ state }) {
  const tone = STATE_COLORS[state] || STATE_COLORS.Unverified;
  return <span style={{ padding: '4px 8px', display: 'inline-flex', borderRadius: 999, background: tone.background, color: tone.color, border: `1px solid ${tone.border}`, fontSize: 10.5, fontWeight: 700 }}>{state}</span>;
}

function countsFor(session) {
  const observations = Object.values(session.observations || {});
  const expected = new Set(session.expectedIds || []);
  const expectedObservations = observations.filter((entry) => entry.itemId && expected.has(entry.itemId));
  const extras = observations.filter((entry) => !entry.itemId || !expected.has(entry.itemId));
  const expectedCount = (state) => expectedObservations.filter((entry) => entry.state === state).length;
  const observedExpected = new Set(observations.filter((entry) => entry.itemId && expected.has(entry.itemId) && entry.state !== 'Unverified').map((entry) => entry.itemId));
  return {
    expected: expected.size,
    verified: expectedCount('Verified'),
    missing: expectedCount('Missing'),
    wrong: observations.filter((entry) => entry.state === 'Wrong location').length,
    quantity: expectedCount('Quantity mismatch'),
    unexpected: extras.filter((entry) => entry.state === 'Unexpected').length,
    excluded: (session.excludedAssets || []).length,
    unverified: [...expected].filter((id) => !observedExpected.has(id)).length
  };
}

function StocktakeReport({ session, itemsById }) {
  const counts = countsFor(session);
  const discrepancies = Object.values(session.observations || {}).filter((entry) => entry.state !== 'Verified');
  return (
    <div className="stocktake-print-report">
      <header className="stocktake-report-header">
        <img src="brand/msbm-lockup.png" alt="Mona School of Business & Management" />
        <span><strong>PHYSICAL STOCKTAKE SIGN-OFF</strong><small>{session.id}</small></span>
      </header>
      <section className="stocktake-report-title">
        <h1>{session.title}</h1>
        <p>{scopeLabel(session)} · Completed {dateTime(session.completedAt)}</p>
      </section>
      <section className="stocktake-report-metrics">
        {[['Expected', counts.expected], ['Verified', counts.verified], ['Missing', counts.missing], ['Wrong location', counts.wrong], ['Quantity mismatch', counts.quantity], ['Unexpected', counts.unexpected]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
      </section>
      <section>
        <h2>Discrepancy report</h2>
        <table><thead><tr><th>Asset</th><th>Tag</th><th>Recorded location</th><th>Result</th><th>Note</th></tr></thead>
          <tbody>{discrepancies.map((entry) => {
            const item = entry.itemId ? itemsById.get(entry.itemId) : null;
            return <tr key={entry.key}><td>{entry.name || item?.name || 'Unregistered barcode'}</td><td>{entry.tag || item?.tag || '—'}</td><td>{entry.recordedLocation ? `${entry.recordedLocation} · ${entry.recordedRoom || ''}` : entry.expectedLocation ? `${entry.expectedLocation} · ${entry.expectedRoom || ''}` : item ? `${item.location} · ${item.room}` : 'Not in inventory'}</td><td>{entry.state}</td><td>{entry.note || '—'}</td></tr>;
          })}</tbody>
        </table>
        {!discrepancies.length && <p className="stocktake-report-clear">No discrepancies were recorded.</p>}
      </section>
      <section className="stocktake-signoff-block">
        <div><small>Performed by</small><strong>{session.createdBy}</strong><span>{dateTime(session.createdAt)}</span></div>
        <div><small>Signed off by</small><strong>{session.signedBy}</strong><span>{dateTime(session.completedAt)}</span></div>
      </section>
      <section className="stocktake-report-notes"><small>Sign-off notes</small><p>{session.signoffNotes || 'No additional notes.'}</p></section>
      <footer>MSBM IT Inventory System · Physical asset verification record</footer>
    </div>
  );
}

export default function Stocktakes({ items, sessions, sessionUser, canManage, createSignal = 0, onCreateSignalHandled, onCreate, onRecord, onRemove, onComplete, onCancel, onDelete, onOpenItem }) {
  const [activeId, setActiveId] = useState('');
  const [creating, setCreating] = useState(false);
  const [scopeType, setScopeType] = useState('building');
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [title, setTitle] = useState('');
  const [scanText, setScanText] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [signing, setSigning] = useState(false);
  const [signoffNotes, setSignoffNotes] = useState('');
  const [acknowledgeMissing, setAcknowledgeMissing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [rowFilter, setRowFilter] = useState('All');
  const [sessionFilter, setSessionFilter] = useState('All');
  const [sessionSort, setSessionSort] = useState({ key: 'created', direction: 'desc' });
  const [rowSort, setRowSort] = useState({ key: 'asset', direction: 'asc' });
  const scanRef = useRef(null);
  const scannerBuffer = useRef('');
  const lastKeyAt = useRef(0);

  const active = sessions.find((session) => session.id === activeId) || null;
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const buildings = useMemo(() => Array.from(new Set(items.filter((item) => item.status !== 'Retired').map((item) => item.location || 'Unassigned'))).sort(), [items]);
  const rooms = useMemo(() => Array.from(new Set(items.filter((item) => item.status !== 'Retired' && (item.location || 'Unassigned') === building).map((item) => item.room || 'Unassigned'))).sort(), [items, building]);

  useEffect(() => {
    if (!building && buildings.length) setBuilding(buildings[0]);
  }, [building, buildings]);
  useEffect(() => {
    if (scopeType === 'room' && !rooms.includes(room)) setRoom(rooms[0] || '');
  }, [scopeType, room, rooms]);
  useEffect(() => {
    if (!createSignal || !canManage) return;
    setActiveId('');
    setTitle('');
    setFeedback(null);
    setCreating(true);
    onCreateSignalHandled?.();
  }, [createSignal, canManage]);

  const rows = useMemo(() => {
    if (!active) return [];
    const snapshots = new Map((active.expectedAssets || []).map((item) => [item.id, item]));
    const expected = (active.expectedIds || []).map((id) => {
      const item = itemsById.get(id) || snapshots.get(id);
      return item ? { key: id, item, observation: active.observations?.[id], expected: true } : null;
    }).filter(Boolean);
    const expectedIds = active.expectedIds || [];
    const extra = Object.values(active.observations || {}).filter((entry) => !expectedIds.includes(entry.itemId || entry.key)).map((entry) => ({ key: entry.key, item: entry.itemId ? itemsById.get(entry.itemId) : null, observation: entry, expected: false }));
    return [...expected, ...extra];
  }, [active, itemsById]);

  const visibleRows = useMemo(() => sortRows(rows.filter(({ observation }) => {
    const state = observation?.state || 'Unverified';
    return rowFilter === 'All' || state === rowFilter;
  }), rowSort, { asset: (row) => row.item?.name || row.observation?.name, tag: (row) => row.item?.tag || row.observation?.tag, location: (row) => row.item ? `${row.item.location} ${row.item.room}` : '', result: (row) => row.observation?.state || 'Unverified', recorded: (row) => row.observation?.recordedAt || '' }), [rows, rowFilter, rowSort]);

  const sortedSessions = useMemo(() => sortRows(sessions.filter((session) => {
    if (sessionFilter === 'All') return true;
    if (sessionFilter === 'Discrepancies') {
      const counts = countsFor(session);
      return counts.missing + counts.wrong + counts.quantity + counts.unexpected > 0;
    }
    return session.status === sessionFilter;
  }), sessionSort, { session: (row) => row.title, scope: (row) => scopeLabel(row), progress: (row) => { const counts = countsFor(row); return counts.expected ? (counts.expected - counts.unverified) / counts.expected : 0; }, status: (row) => row.status, created: (row) => row.createdAt }), [sessions, sessionFilter, sessionSort]);

  useEffect(() => {
    setFeedback(null);
    setSigning(false);
    setSignoffNotes('');
    setAcknowledgeMissing(false);
    setCanceling(false);
    setCancelReason('');
    setRowFilter('All');
    scannerBuffer.current = '';
  }, [activeId]);

  const recordState = useCallback((item, state, extra = {}) => {
    if (!active || active.status !== 'In progress') return;
    const key = item?.id || extra.key;
    onRecord(active.id, {
      ...(active.observations?.[key] || {}), key, itemId: item?.id || null,
      tag: item?.tag || extra.tag || '', name: item?.name || extra.name || '', serial: item?.serial || extra.serial || '',
      recordedLocation: item?.location || extra.recordedLocation || '', recordedRoom: item?.room || extra.recordedRoom || '', state,
      recordedAt: new Date().toISOString(), recordedBy: sessionUser.name, ...extra
    });
  }, [active, onRecord, sessionUser.name]);

  const recordQuantity = useCallback((item, rawValue) => {
    if (!active || !item) return;
    if (rawValue === '') {
      onRemove(active.id, item.id);
      setFeedback({ tone: '#8a5209', text: `${item.name} quantity cleared; a physical count is still required.` });
      return;
    }
    const countedQty = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(countedQty) || countedQty < 0) return;
    const expectedQty = Math.max(0, Number(item.qty || 0));
    const state = countedQty === expectedQty ? 'Verified' : 'Quantity mismatch';
    recordState(item, state, { countedQty, expectedQty, note: state === 'Verified' ? `Physical quantity confirmed: ${countedQty}` : `Expected ${expectedQty}; physically counted ${countedQty}` });
    setFeedback({ tone: state === 'Verified' ? '#155e3f' : '#8a5209', text: state === 'Verified' ? `${item.name} quantity verified at ${countedQty}.` : `${item.name}: expected ${expectedQty}, counted ${countedQty}. Discrepancy recorded.` });
  }, [active, onRemove, recordState]);

  const submitScan = useCallback((rawValue) => {
    if (!active || active.status !== 'In progress') return;
    const value = rawValue.trim();
    if (!value) return;
    const normalized = value.toLowerCase();
    const item = items.find((entry) => String(entry.tag || '').trim().toLowerCase() === normalized || String(entry.serial || '').trim().toLowerCase() === normalized);
    if (!item) {
      const key = `unknown-${normalized}`;
      const previous = active.observations?.[key];
      recordState(null, 'Unexpected', { key, tag: value, name: 'Unregistered barcode', note: 'Barcode is not registered in inventory', scanCount: Number(previous?.scanCount || 0) + 1 });
      setFeedback({ tone: '#5b3f91', text: previous ? `${value} was already recorded as unexpected; its scan time was refreshed.` : `${value} recorded as an unexpected, unregistered barcode.` });
    } else if ((active.expectedIds || []).includes(item.id)) {
      const previous = active.observations?.[item.id];
      if (item.consumable) {
        recordState(item, previous?.state || 'Unverified', { expectedQty: Number(item.qty || 0), countedQty: previous?.countedQty ?? '', note: previous?.note || 'Barcode recognized; physical quantity must be entered', scanCount: Number(previous?.scanCount || 0) + 1 });
        setFeedback({ tone: '#8a5209', text: `${item.name} recognized. Enter the physical quantity in its checklist row to verify it.` });
      } else {
        recordState(item, 'Verified', { scanCount: Number(previous?.scanCount || 0) + 1 });
        setFeedback({ tone: '#155e3f', text: previous?.state === 'Verified' ? `${item.name} was already verified; duplicate scan ignored safely.` : `${item.name} (${item.tag}) verified.` });
      }
    } else {
      const previous = active.observations?.[item.id];
      const wasExcluded = (active.excludedAssets || []).some((entry) => entry.id === item.id);
      recordState(item, 'Wrong location', {
        note: wasExcluded
          ? `Asset is recorded as checked out${item.borrower ? ` to ${item.borrower}` : ''} but was physically scanned during this stocktake`
          : `Recorded in ${item.location} · ${item.room}; found during ${scopeLabel(active)} stocktake`,
        scanCount: Number(previous?.scanCount || 0) + 1
      });
      setFeedback({ tone: '#8a5209', text: wasExcluded ? `${item.name} is checked out but was found here; recorded for follow-up.` : `${item.name} belongs to ${item.location} · ${item.room}; marked wrong location.` });
    }
    setScanText('');
    requestAnimationFrame(() => scanRef.current?.focus());
  }, [active, items, recordState]);

  useEffect(() => {
    if (!active || active.status !== 'In progress') return undefined;
    requestAnimationFrame(() => scanRef.current?.focus());
    const listen = (event) => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      if (editing || event.ctrlKey || event.altKey || event.metaKey) return;
      const now = Date.now();
      if (now - lastKeyAt.current > 250) scannerBuffer.current = '';
      lastKeyAt.current = now;
      if (event.key === 'Enter' || event.key === 'Tab') {
        const value = scannerBuffer.current.trim();
        scannerBuffer.current = '';
        if (value) { event.preventDefault(); submitScan(value); }
      } else if (event.key.length === 1) scannerBuffer.current += event.key;
    };
    document.addEventListener('keydown', listen);
    return () => document.removeEventListener('keydown', listen);
  }, [active, submitScan]);

  const create = () => {
    if (!building || (scopeType === 'room' && !room)) return;
    const record = onCreate({ scopeType, building, room, title });
    if (record) { setActiveId(record.id); setCreating(false); setTitle(''); setFeedback(null); }
  };

  const exportDiscrepancies = () => {
    if (!active) return;
    const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const output = [['Asset', 'Tag', 'Serial', 'Recorded building', 'Recorded room', 'Result', 'Note', 'Recorded by', 'Recorded at']];
    Object.values(active.observations || {}).filter((entry) => entry.state !== 'Verified').forEach((entry) => {
      const item = entry.itemId ? itemsById.get(entry.itemId) : null;
      output.push([entry.name || item?.name, entry.tag || item?.tag, entry.serial || item?.serial, entry.recordedLocation || entry.expectedLocation || item?.location, entry.recordedRoom || entry.expectedRoom || item?.room, entry.state, entry.note, entry.recordedBy, entry.recordedAt]);
    });
    const blob = new Blob([output.map((line) => line.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${active.id}-discrepancies.csv`; link.click(); URL.revokeObjectURL(url);
  };

  if (!active) {
    const completed = sessions.filter((session) => session.status === 'Completed').length;
    const open = sessions.filter((session) => session.status === 'In progress').length;
    const discrepancies = sessions.filter((session) => session.status === 'Completed').reduce((sum, session) => { const c = countsFor(session); return sum + c.missing + c.wrong + c.quantity + c.unexpected; }, 0);
    const totalExpected = sessions.reduce((sum, session) => sum + countsFor(session).expected, 0);
    const totalVerified = sessions.reduce((sum, session) => sum + countsFor(session).verified, 0);
    const verificationRate = totalExpected ? Math.round((totalVerified / totalExpected) * 100) : 0;
    return (
      <div className="stocktake-workspace">
        <section className="stocktake-hero">
          <div className="stocktake-hero-copy"><span className="stocktake-eyebrow">Physical verification control</span><h2>Know exactly what is on site.</h2><p>Run auditable building and room checks, resolve location exceptions, and create signed verification records.</p><div className="stocktake-hero-meta"><span><i className="stocktake-live-dot" /> {open} live session{open === 1 ? '' : 's'}</span><span>{totalExpected} assets in scope</span></div></div>
          <div className="stocktake-rate" style={{ '--stocktake-rate': `${verificationRate * 3.6}deg` }}><div><strong>{verificationRate}%</strong><span>verified</span></div></div>
        </section>
        <div className="stocktake-health-grid">
          {[
            ['All', 'All sessions', sessions.length, 'Complete stocktake register', 'blue', '◎'],
            ['In progress', 'In progress', open, 'Verification underway', 'cyan', '↻'],
            ['Completed', 'Completed', completed, 'Signed and archived', 'green', '✓'],
            ['Discrepancies', 'Discrepancies', discrepancies, 'Exceptions requiring review', 'amber', '!']
          ].map(([key, label, value, note, tone, icon]) => <button key={key} type="button" className={`stocktake-health-card ${tone} ${sessionFilter === key ? 'active' : ''}`} onClick={() => setSessionFilter(key)}><span className="stocktake-health-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong><em>{note}</em></span></button>)}
        </div>
        <div className="stocktake-section-heading">
          <span><strong>Stocktake sessions</strong><small>{sessionFilter === 'All' ? 'Showing the complete verification register.' : `Filtered to ${sessionFilter.toLowerCase()}.`}</small></span>
          {canManage && <button type="button" className={`stocktake-new-button ${creating ? 'open' : ''}`} onClick={() => setCreating((value) => !value)}><span>{creating ? '×' : '+'}</span>{creating ? 'Close' : 'New stocktake'}</button>}
        </div>
        {creating && <div className="stocktake-create-panel">
          <div className="stocktake-create-intro"><span>01</span><strong>Define verification scope</strong><small>Choose the smallest useful physical area.</small></div>
          <label style={fieldLabel}>Session title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Optional descriptive title" style={fieldInput} /></label>
          <label style={fieldLabel}>Scope<select value={scopeType} onChange={(event) => setScopeType(event.target.value)} style={fieldInput}><option value="building">Building</option><option value="room">Specific room</option></select></label>
          <label style={fieldLabel}>Building<select value={building} onChange={(event) => { setBuilding(event.target.value); setRoom(''); }} style={fieldInput}>{buildings.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label style={fieldLabel}>Room<select disabled={scopeType !== 'room'} value={room} onChange={(event) => setRoom(event.target.value)} style={fieldInput}>{rooms.map((value) => <option key={value}>{value}</option>)}</select></label>
          <button type="button" className="btn-primary" disabled={!building || (scopeType === 'room' && !room)} onClick={create} style={{ height: 36, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 650 }}>Create session</button>
        </div>}
        <div className="stocktake-session-list">
          <div className="stocktake-session-head">{[['session', 'Session'], ['scope', 'Scope'], ['progress', 'Progress'], ['status', 'Status'], ['created', 'Performed']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={sessionSort} onSort={(key) => setSessionSort((current) => nextSort(current, key))} />)}<span>Actions</span></div>
          {sortedSessions.map((session) => { const c = countsFor(session); const processed = c.expected - c.unverified; return <div key={session.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'stretch', borderTop: '1px solid #edf0f3' }}><button type="button" onClick={() => setActiveId(session.id)} style={{ minWidth: 0, display: 'grid', gridTemplateColumns: '1.5fr 1fr .7fr .8fr .9fr', gap: 12, alignItems: 'center', padding: '12px 15px', background: '#fff', border: 0, textAlign: 'left', cursor: 'pointer' }}><span><strong style={{ display: 'block', fontSize: 12.5 }}>{session.title}</strong><small style={{ color: '#7b8794', fontFamily: "'IBM Plex Mono',monospace" }}>{session.id}</small></span><span style={{ fontSize: 12 }}>{scopeLabel(session)}</span><span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5 }}>{processed}/{c.expected}</span><span>{session.status === 'Cancelled' ? <StateBadge state="Cancelled" /> : <span style={statusTagStyle(session.status === 'Completed' ? 'In stock' : 'On loan')}>{session.status}</span>}</span><span style={{ fontSize: 11.5, color: '#61707e' }}>{session.createdBy}<small style={{ display: 'block', marginTop: 2 }}>{dateTime(session.createdAt)}</small></span></button>{canManage && <button type="button" className="stocktake-delete-button" onClick={() => setDeleteCandidate(session)} aria-label={`Delete ${session.title}`} title="Delete stocktake"><span aria-hidden="true">&#128465;</span> Delete</button>}</div>; })}
          {!sortedSessions.length && <div className="stocktake-empty"><span>⌁</span><strong>{sessions.length ? 'No sessions match this view' : 'No stocktakes yet'}</strong><small>{sessions.length ? 'Choose another status filter to see more records.' : 'Create a controlled physical verification session to begin.'}</small></div>}
        </div>
        {deleteCandidate && <div style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(13,17,22,.58)', backdropFilter: 'blur(5px)' }}><div role="alertdialog" aria-modal="true" aria-labelledby="delete-stocktake-title" style={{ width: 'min(470px,100%)', padding: 22, display: 'flex', flexDirection: 'column', gap: 15, border: '1px solid #e3d1cf', borderRadius: 16, background: '#fff', boxShadow: '0 26px 80px rgba(13,17,22,.3)' }}><span><strong id="delete-stocktake-title" style={{ display: 'block', color: '#8f1d17', fontSize: 17 }}>Delete this stocktake?</strong><small style={{ display: 'block', marginTop: 6, color: '#687581', lineHeight: 1.5 }}>{deleteCandidate.title} ({deleteCandidate.id}) and all of its recorded observations will be permanently removed. This action will remain noted in the audit log.</small></span>{deleteCandidate.status === 'Completed' && <div style={{ padding: '10px 11px', border: '1px solid #efd2aa', borderRadius: 9, color: '#7a4a09', background: '#fff5e8', fontSize: 11.5 }}>This is a completed, signed stocktake record. Its verification history and discrepancy report will no longer be available.</div>}<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}><button type="button" className="btn-ghost" onClick={() => setDeleteCandidate(null)} style={{ height: 37, padding: '0 14px', borderRadius: 10 }}>Keep stocktake</button><button type="button" className="btn-ghost-danger" onClick={() => { if (onDelete(deleteCandidate.id)) setDeleteCandidate(null); }} style={{ height: 37, padding: '0 14px', borderRadius: 10, fontWeight: 700 }}>Delete permanently</button></div></div></div>}
      </div>
    );
  }

  const counts = countsFor(active);
  const complete = active.status === 'Completed';
  const inProgress = active.status === 'In progress';
  const discrepancyTotal = counts.missing + counts.wrong + counts.quantity + counts.unexpected + counts.unverified;
  const canFinalize = (counts.unverified === 0 || acknowledgeMissing) && (discrepancyTotal === 0 || signoffNotes.trim().length >= 3);
  return (
    <div className="stocktake-detail-workspace">
      <div className="stocktake-screen-controls stocktake-detail-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="button" className="btn-ghost" onClick={() => { setActiveId(''); setFeedback(null); }} style={{ height: 34, padding: '0 11px', borderRadius: 8, fontSize: 12 }}>← Back to sessions</button>
        <span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 15 }}>{active.title}</strong><small style={{ color: '#71808d' }}>{active.id} · {scopeLabel(active)} · created by {active.createdBy}</small></span>
        {complete && <><button type="button" className="btn-ghost" onClick={exportDiscrepancies} style={{ height: 35, padding: '0 12px', borderRadius: 8, fontSize: 12 }}>Download discrepancies</button><button type="button" className="btn-primary" onClick={() => window.print()} style={{ height: 35, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 650 }}>Print sign-off report</button></>}
        {inProgress && canManage && <><button type="button" className="btn-ghost-danger" onClick={() => setCanceling(true)} style={{ height: 35, padding: '0 12px', borderRadius: 8, fontSize: 12 }}>Cancel session</button><button type="button" className="btn-primary" onClick={() => setSigning(true)} style={{ height: 35, padding: '0 13px', borderRadius: 8, background: '#1c7c54', fontSize: 12.5, fontWeight: 650 }}>Complete & sign off</button></>}
      </div>

      <div className="stocktake-detail-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 10 }}>
        {[['Expected on site', counts.expected, '#0a3d7c'], ['Verified', counts.verified, '#1c7c54'], [complete ? 'Missing' : 'Remaining', complete ? counts.missing : counts.unverified, '#b3261e'], ['Location / quantity', counts.wrong + counts.quantity, '#b8710f'], ['Unexpected', counts.unexpected, '#6b4aa0'], ['Checked out', counts.excluded, '#66717c']].map(([label, value, color]) => <div key={label} style={{ padding: '12px 13px', background: '#fff', border: '1px solid #dfe3e9', borderTop: `3px solid ${color}`, borderRadius: 9 }}><small style={{ color: '#778491', fontWeight: 650 }}>{label}</small><strong style={{ marginTop: 5, display: 'block', color, fontSize: 22 }}>{value}</strong></div>)}
      </div>

      {inProgress && canManage && <div className="stocktake-screen-controls stocktake-scanner-console" style={{ padding: 15, display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, background: '#17202a', borderRadius: 10 }}>
        <span style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between' }}><strong style={{ color: '#fff', fontSize: 12.5 }}>Scan an asset barcode</strong><small style={{ color: '#56d182' }}>Wireless scanner ready</small></span>
        <input ref={scanRef} data-stocktake-scanner="true" autoComplete="off" value={scanText} onChange={(event) => setScanText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); submitScan(scanText); } }} placeholder="Scan barcode or enter asset tag" style={{ height: 40, padding: '0 12px', background: '#0d131a', border: '1px solid #3c4a58', borderRadius: 8, color: '#fff', fontFamily: "'IBM Plex Mono',monospace", outline: 'none' }} />
        <button type="button" className="btn-primary" onClick={() => submitScan(scanText)} style={{ height: 40, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 650 }}>Record scan</button>
        {feedback && <span style={{ gridColumn: '1 / -1', color: feedback.tone === '#155e3f' ? '#65d895' : feedback.tone === '#8a5209' ? '#ffc66d' : '#c4a8f2', fontSize: 11.5 }}>{feedback.text}</span>}
      </div>}

      {active.status === 'Cancelled' && <div style={{ padding: '12px 14px', background: '#f5f6f8', border: '1px solid #d9dee4', borderRadius: 9, color: '#596672', fontSize: 12 }}><strong>This session was cancelled by {active.cancelledBy || 'an authorized user'}.</strong>{active.cancellationReason ? ` Reason: ${active.cancellationReason}` : ''} No inventory verification dates were changed.</div>}

      <div className="stocktake-screen-controls stocktake-checklist" style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
        <div className="stocktake-checklist-toolbar" style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 9, borderBottom: '1px solid #e5e9ed' }}><strong style={{ flex: 1, fontSize: 12.5 }}>Asset checklist</strong><span style={{ color: '#7b8794', fontSize: 11 }}>{visibleRows.length} of {rows.length} rows</span><select value={rowFilter} onChange={(event) => setRowFilter(event.target.value)} aria-label="Filter stocktake results" style={{ height: 31, padding: '0 8px', background: '#fff', border: '1px solid #cfd8e1', borderRadius: 7, fontSize: 11.5 }}><option>All</option><option>Unverified</option><option>Verified</option><option>Missing</option><option>Wrong location</option><option>Quantity mismatch</option><option>Unexpected</option></select></div>
        <div className="stocktake-checklist-head" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.25fr .85fr 1fr', gap: 10, padding: '10px 14px', background: '#f6f8fa', color: '#778491', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em' }}>{[['asset', 'Asset'], ['tag', 'Tag'], ['location', 'Recorded location'], ['result', 'Result'], ['recorded', 'Recorded']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={rowSort} onSort={(key) => setRowSort((current) => nextSort(current, key))} />)}</div>
        {visibleRows.map(({ key, item, observation, expected }) => { const state = observation?.state || 'Unverified'; return <div key={key} className={`stocktake-checklist-row state-${state.toLowerCase().replaceAll(' ', '-')}`} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.25fr .85fr 1fr', gap: 10, alignItems: 'center', padding: '10px 14px', borderTop: '1px solid #edf0f3' }}>
          <button type="button" disabled={!item || !itemsById.has(item.id)} onClick={() => item && itemsById.has(item.id) && onOpenItem(item.id)} style={{ minWidth: 0, padding: 0, display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 0, textAlign: 'left', cursor: item && itemsById.has(item.id) ? 'pointer' : 'default' }}>{item && <span style={thumbStyle(item.model, 28, 5)} />}<span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{item?.name || observation?.name || 'Unregistered barcode'}</strong><small style={{ color: '#7b8794' }}>{expected ? 'Expected in this scope' : 'Discrepancy discovered during scan'}</small></span></button>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", color: '#0b4a94', fontSize: 10.5 }}>{item?.tag || observation?.tag}</span>
          <span style={{ color: '#5d6975', fontSize: 11.5 }}>{item ? `${item.location} · ${item.room}` : 'Not registered'}</span>
          <span>{inProgress && canManage && expected ? item?.consumable ? <label style={{ display: 'flex', alignItems: 'center', gap: 5 }}><input type="number" min="0" step="1" value={observation?.countedQty ?? ''} onChange={(event) => recordQuantity(item, event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); scanRef.current?.focus(); } }} placeholder="Count" aria-label={`Physical quantity for ${item.name}`} style={{ width: 64, height: 30, padding: '0 6px', border: '1px solid #d2dae2', borderRadius: 7, fontSize: 10.5 }} /><small style={{ color: '#7b8794' }}>/ {item.qty}</small></label> : <select value={state} onChange={(event) => { if (event.target.value === 'Unverified') onRemove(active.id, key); else recordState(item, event.target.value, event.target.value === 'Missing' ? { note: 'Manually marked missing during stocktake' } : {}); requestAnimationFrame(() => scanRef.current?.focus()); }} style={{ height: 30, width: '100%', padding: '0 6px', border: '1px solid #d2dae2', borderRadius: 7, background: '#fff', fontSize: 10.5 }}><option>Unverified</option><option>Verified</option><option>Missing</option></select> : <StateBadge state={state} />}</span>
          <span style={{ color: '#6c7884', fontSize: 10.5 }}>{observation ? <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ flex: 1 }}>{observation.recordedBy}<small style={{ display: 'block', marginTop: 2 }}>{dateTime(observation.recordedAt)}{observation.scanCount > 1 ? ` · ${observation.scanCount} scans` : ''}</small></span>{inProgress && canManage && !expected && <button type="button" className="btn-ghost-danger" onClick={() => onRemove(active.id, key)} style={{ height: 27, padding: '0 7px', borderRadius: 6, fontSize: 10 }}>Remove</button>}</span> : 'Awaiting verification'}</span>
        </div>; })}
        {!visibleRows.length && <div style={{ padding: 32, textAlign: 'center', color: '#7b8794', fontSize: 12 }}>No checklist rows match this filter.</div>}
      </div>

      {complete && <StocktakeReport session={active} itemsById={itemsById} />}

      {signing && <div style={{ position: 'fixed', inset: 0, zIndex: 75, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(13,17,22,.55)' }}><div style={{ width: 'min(540px,100%)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: '#fff', borderRadius: 12, boxShadow: '0 24px 70px rgba(13,17,22,.25)' }}>
        <span><strong style={{ display: 'block', fontSize: 16 }}>Complete and sign off stocktake</strong><small style={{ display: 'block', marginTop: 4, color: '#7b8794' }}>{counts.unverified} unverified expected assets will be recorded as missing.</small></span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 7 }}>{[['Verified', counts.verified], ['Will be missing', counts.unverified + counts.missing], ['Location / quantity', counts.wrong + counts.quantity], ['Unexpected', counts.unexpected]].map(([label, value]) => <span key={label} style={{ padding: 9, background: '#f7f9fb', border: '1px solid #e0e5ea', borderRadius: 7 }}><small style={{ display: 'block', color: '#7b8794' }}>{label}</small><strong style={{ display: 'block', marginTop: 3 }}>{value}</strong></span>)}</div>
        <div style={fieldLabel}>Signed off by<strong style={{ padding: '10px 11px', background: '#f7f9fb', border: '1px solid #dfe3e9', borderRadius: 8 }}>{sessionUser.name} · {sessionUser.email}</strong></div>
        {counts.unverified > 0 && <label style={{ padding: 10, display: 'flex', alignItems: 'flex-start', gap: 9, background: '#fff5e8', border: '1px solid #efd2aa', borderRadius: 8, color: '#7a4a09', fontSize: 11.5 }}><input type="checkbox" checked={acknowledgeMissing} onChange={(event) => setAcknowledgeMissing(event.target.checked)} /><span>I confirm the {counts.unverified} remaining asset{counts.unverified === 1 ? '' : 's'} were not found and should be recorded as missing.</span></label>}
        <label style={fieldLabel}>Sign-off notes {discrepancyTotal > 0 && '(required for discrepancies)'}<textarea value={signoffNotes} onChange={(event) => setSignoffNotes(event.target.value)} rows="4" placeholder="Explain discrepancies, follow-up actions, or exceptions…" style={{ ...fieldInput, height: 'auto', padding: 10, resize: 'vertical' }} /></label>
        {!canFinalize && <small style={{ color: '#a01a12' }}>{counts.unverified > 0 && !acknowledgeMissing ? 'Confirm the unverified assets before signing off.' : 'Add sign-off notes describing the discrepancies.'}</small>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}><button type="button" className="btn-ghost" onClick={() => setSigning(false)} style={{ height: 36, padding: '0 13px', borderRadius: 8 }}>Cancel</button><button type="button" className="btn-primary" disabled={!canFinalize} onClick={() => { if (onComplete(active.id, { notes: signoffNotes })) setSigning(false); }} style={{ height: 36, padding: '0 14px', borderRadius: 8, background: '#1c7c54', fontWeight: 650 }}>Sign and complete</button></div>
      </div></div>}

      {canceling && <div style={{ position: 'fixed', inset: 0, zIndex: 75, display: 'grid', placeItems: 'center', padding: 24, background: 'rgba(13,17,22,.55)' }}><div style={{ width: 'min(470px,100%)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: '#fff', borderRadius: 12 }}><span><strong style={{ display: 'block', fontSize: 16 }}>Cancel this stocktake?</strong><small style={{ display: 'block', marginTop: 4, color: '#7b8794' }}>The session will become read-only. Existing observations remain in its audit record, but no assets will be marked verified.</small></span><label style={fieldLabel}>Reason for cancellation<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows="3" placeholder="Why is this session being cancelled?" style={{ ...fieldInput, height: 'auto', padding: 10, resize: 'vertical' }} /></label><div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}><button type="button" className="btn-ghost" onClick={() => setCanceling(false)} style={{ height: 36, padding: '0 13px', borderRadius: 8 }}>Keep session</button><button type="button" className="btn-ghost-danger" disabled={cancelReason.trim().length < 3} onClick={() => { if (onCancel(active.id, cancelReason)) setCanceling(false); }} style={{ height: 36, padding: '0 13px', borderRadius: 8 }}>Cancel stocktake</button></div></div></div>}
    </div>
  );
}

const fieldLabel = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5, color: '#64717e', fontSize: 10.5, fontWeight: 650 };
const fieldInput = { boxSizing: 'border-box', width: '100%', height: 36, padding: '0 9px', background: '#fff', border: '1px solid #cbd6e1', borderRadius: 8, color: '#263746', fontSize: 11.5 };
