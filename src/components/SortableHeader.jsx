export function compareSortValues(left, right) {
  const a = left ?? '';
  const b = right ?? '';
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const aNumber = typeof a === 'string' && a.trim() !== '' ? Number(a) : Number.NaN;
  const bNumber = typeof b === 'string' && b.trim() !== '' ? Number(b) : Number.NaN;
  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) return aNumber - bNumber;
  const aDate = typeof a === 'string' && /^\d{4}-\d{2}-\d{2}/.test(a) ? Date.parse(a) : Number.NaN;
  const bDate = typeof b === 'string' && /^\d{4}-\d{2}-\d{2}/.test(b) ? Date.parse(b) : Number.NaN;
  if (Number.isFinite(aDate) && Number.isFinite(bDate)) return aDate - bDate;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRows(rows, sort, accessors = {}) {
  if (!sort?.key) return rows;
  const accessor = accessors[sort.key] || ((row) => row?.[sort.key]);
  return rows.map((row, index) => ({ row, index })).sort((left, right) => {
    const result = compareSortValues(accessor(left.row), accessor(right.row));
    return (result || left.index - right.index) * (sort.direction === 'desc' ? -1 : 1);
  }).map(({ row }) => row);
}

export function nextSort(current, key) {
  return current.key === key
    ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
    : { key, direction: 'asc' };
}

export default function SortableHeader({ label, column, sort, onSort, align = 'left' }) {
  const active = sort.key === column;
  return (
    <button type="button" onClick={() => onSort(column)} aria-label={`Sort by ${label}${active ? `, currently ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      style={{ minWidth: 0, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: align === 'right' ? 'flex-end' : 'flex-start', gap: 4, background: 'none', border: 0, color: active ? '#0a3d7c' : 'inherit', font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', textAlign: align, cursor: 'pointer' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span aria-hidden="true" style={{ width: 9, color: active ? '#0a3d7c' : '#a6b0ba', fontSize: 9 }}>{active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
    </button>
  );
}
