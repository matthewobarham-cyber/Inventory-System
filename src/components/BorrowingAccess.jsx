import { useMemo, useState } from 'react';

const approved = (item, categoryAccess) => item.borrowEligibility === 'allowed'
  || (item.borrowEligibility !== 'blocked' && categoryAccess[item.category] === true);

export default function BorrowingAccess({ items = [], categoryAccess = {}, onChange }) {
  const [query, setQuery] = useState('');
  const categories = useMemo(() => {
    const grouped = new Map();
    items.filter((item) => !item.archived && !item.consumable).forEach((item) => {
      const category = item.category || 'Uncategorized equipment';
      const group = grouped.get(category) || { category, total: 0, available: 0, allowedOverrides: 0, blockedOverrides: 0 };
      group.total += 1;
      if (item.status === 'In stock') group.available += 1;
      if (item.borrowEligibility === 'allowed') group.allowedOverrides += 1;
      if (item.borrowEligibility === 'blocked') group.blockedOverrides += 1;
      grouped.set(category, group);
    });
    return [...grouped.values()].sort((a, b) => a.category.localeCompare(b.category));
  }, [items]);
  const visible = categories.filter((entry) => entry.category.toLowerCase().includes(query.trim().toLowerCase()));
  const eligibleAssets = items.filter((item) => !item.archived && !item.consumable && approved(item, categoryAccess)).length;
  const approvedCategories = categories.filter((entry) => categoryAccess[entry.category] === true).length;

  return <div className="borrowing-access">
    <section className="borrowing-access-hero">
      <span><small>Controlled lending catalogue</small><h3>TSR checkout permissions</h3><p>Only explicitly approved categories or individual asset overrides can be borrowed. Restricted equipment is hidden completely from regular staff.</p></span>
      <div><span><small>Approved categories</small><strong>{approvedCategories}</strong></span><span><small>Visible assets</small><strong>{eligibleAssets}</strong></span><span><small>Restricted assets</small><strong>{Math.max(0, items.filter((item) => !item.archived && !item.consumable).length - eligibleAssets)}</strong></span></div>
    </section>
    <div className="borrowing-access-toolbar"><span><strong>Equipment category rules</strong><small>An item-level rule set on its asset record takes priority.</small></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories…" aria-label="Search borrowing categories" /></div>
    <div className="borrowing-access-list">
      {visible.map((entry) => {
        const allowed = categoryAccess[entry.category] === true;
        return <article key={entry.category} data-allowed={allowed ? 'true' : undefined}>
          <span className="borrowing-access-icon">{allowed ? '✓' : '—'}</span>
          <span className="borrowing-access-copy"><strong>{entry.category}</strong><small>{entry.total} asset{entry.total === 1 ? '' : 's'} · {entry.available} currently in stock</small>{(entry.allowedOverrides > 0 || entry.blockedOverrides > 0) && <em>{entry.allowedOverrides} individually allowed · {entry.blockedOverrides} individually blocked</em>}</span>
          <span className="borrowing-access-state"><small>{allowed ? 'Staff can see and request' : 'Hidden from staff'}</small><strong>{allowed ? 'Approved' : 'Restricted'}</strong></span>
          <button type="button" role="switch" aria-checked={allowed} onClick={() => onChange(entry.category, !allowed)}><i /><span>{allowed ? 'Allowed' : 'Blocked'}</span></button>
        </article>;
      })}
      {!visible.length && <div className="borrowing-access-empty">No equipment categories match this search.</div>}
    </div>
    <p className="borrowing-access-note"><b>Secure default:</b> categories remain restricted until an administrator approves them. To make one exception, open the asset, choose <b>Edit record</b>, and set its borrowing permission.</p>
  </div>;
}
