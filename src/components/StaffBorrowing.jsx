import { useEffect, useMemo, useState } from 'react';
import { glbUrlForItem } from '../data.js';
import { Inv3D } from '../three-engine.js';

const PAGE_SIZE = 12;

export default function StaffBorrowing({ items, requests = [], session, initialQuery = '', onOpenItem, onRequest, onOpenRequests }) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState('All equipment');
  const [page, setPage] = useState(1);
  const pendingIds = useMemo(() => new Set(requests.filter((request) => request.byEmail === session?.email && request.state === 'Pending').map((request) => request.itemId)), [requests, session?.email]);
  const availableItems = useMemo(() => items.filter((item) => item.status === 'In stock' && Number(item.qty || 0) > 0 && !item.archived && !item.consumable), [items]);
  const categories = useMemo(() => ['All equipment', ...Array.from(new Set(availableItems.map((item) => item.category || 'Other equipment'))).sort()], [availableItems]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return availableItems
      .filter((item) => category === 'All equipment' || (item.category || 'Other equipment') === category)
      .filter((item) => !needle || `${item.name} ${item.category} ${item.tag} ${item.location} ${item.room}`.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name) || a.tag.localeCompare(b.tag));
  }, [availableItems, category, query]);
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageItems = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pendingCount = pendingIds.size;

  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => setPage(1), [query, category]);
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => Inv3D.sync());
    return () => cancelAnimationFrame(frame);
  }, [pageItems]);

  return <div className="staff-borrowing">
    <section className="staff-borrowing-hero">
      <div className="staff-borrowing-welcome">
        <span className="staff-borrowing-eyebrow">MSBM equipment borrowing</span>
        <h2>Hello{session?.name ? `, ${session.name.split(' ')[0]}` : ''}. What do you need today?</h2>
        <p>Choose any available item below. IT Services will review your request and let you know when it is ready for collection.</p>
        <label className="staff-borrowing-search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a laptop, projector, microphone…" aria-label="Search available equipment" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
        </label>
      </div>
      <div className="staff-borrowing-guide" aria-label="How equipment requests work">
        <strong>Borrowing is easy</strong>
        <ol>
          <li><b>1</b><span><strong>Choose an item</strong><small>Only equipment you may borrow is shown.</small></span></li>
          <li><b>2</b><span><strong>Send your request</strong><small>Press the large green button once.</small></span></li>
          <li><b>3</b><span><strong>Wait for approval</strong><small>IT Services will prepare it for you.</small></span></li>
        </ol>
      </div>
    </section>

    <section className="staff-borrowing-summary">
      <span><i className="available" /><strong>{availableItems.length}</strong><small>items available to you</small></span>
      <button type="button" onClick={onOpenRequests}><i className={pendingCount ? 'pending' : ''} /><strong>{pendingCount}</strong><small>requests awaiting approval</small><em>View my requests →</em></button>
      <span><i className="help" /><strong>Need help?</strong><small>Contact IT Services if you are unsure.</small></span>
    </section>

    <section className="staff-borrowing-catalogue">
      <header>
        <span><small>Available now</small><h3>Equipment you can request</h3><p>{visible.length} matching item{visible.length === 1 ? '' : 's'}</p></span>
        <label><span>Type of equipment</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((name) => <option key={name}>{name}</option>)}</select></label>
      </header>

      <div className="staff-borrowing-grid">
        {pageItems.map((item) => {
          const pending = pendingIds.has(item.id);
          return <article className="staff-borrow-card" key={item.id} data-pending={pending ? 'true' : undefined}>
            <button type="button" className="staff-borrow-model" onClick={() => onOpenItem(item.id)} aria-label={`View details for ${item.name}`}>
              <canvas data-model={glbUrlForItem(item)} aria-hidden="true" />
              <span><i />Available now</span>
              <em>Click the picture for details</em>
            </button>
            <div className="staff-borrow-copy">
              <small>{item.category || 'Equipment'}</small>
              <h4>{item.name}</h4>
              <p><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2" /></svg><span><b>{item.location || 'Location to be confirmed'}</b>{item.room && <small>{item.room}</small>}</span></p>
              <div className="staff-borrow-condition"><span><b>Condition</b><small>{item.condition || 'Good'}</small></span><span><b>Asset number</b><small>{item.tag}</small></span></div>
            </div>
            <footer>
              <button type="button" className="staff-borrow-details" onClick={() => onOpenItem(item.id)}>View details</button>
              <button type="button" className="staff-borrow-request" disabled={pending} onClick={() => onRequest(item.id)}>{pending ? <><span>✓</span> Request sent</> : <><span>+</span> Request this item</>}</button>
            </footer>
          </article>;
        })}
      </div>

      {!pageItems.length && <div className="staff-borrow-empty"><span>⌕</span><strong>No available equipment matches that search</strong><p>Try a shorter search or choose “All equipment.”</p><button type="button" onClick={() => { setQuery(''); setCategory('All equipment'); }}>Show all available items</button></div>}

      {totalPages > 1 && <nav className="staff-borrow-pagination" aria-label="Equipment pages"><button type="button" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>← Previous</button><span>Page <b>{page}</b> of {totalPages}</span><button type="button" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next →</button></nav>}
    </section>
  </div>;
}
