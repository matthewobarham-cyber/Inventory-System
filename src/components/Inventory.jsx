import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MODELS, glbUrl, money, thumbStyle, statusTagStyle, CARD_MIN_WIDTH, effStatus } from '../data.js';
import BulkBarcodeModal from './BulkBarcodeModal.jsx';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';
import { Inv3D } from '../three-engine.js';
import StocktakeFlag from './StocktakeFlag.jsx';

const STATUS_OPTIONS = ['All statuses', 'In stock', 'On loan', 'Low stock', 'Maintenance', 'Retired'];
const RECENT_INVENTORY_DAYS = 7;
const ALL_BUILDINGS = '__all_buildings__';
const INVENTORY_WEB_POSITIONS_KEY = 'msbm.inventoryWebNodePositions.v1';

function loadInventoryWebPositions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INVENTORY_WEB_POSITIONS_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function recentInventoryDate(item) {
  const addedTimestamp = inventoryAddedTimestamp(item, false);
  if (!addedTimestamp) return null;
  const age = Date.now() - addedTimestamp;
  const recentWindow = RECENT_INVENTORY_DAYS * 24 * 60 * 60 * 1000;
  return age >= 0 && age <= recentWindow ? new Date(addedTimestamp) : null;
}

function inventoryAddedTimestamp(item, includePurchaseDate = true) {
  const exactDate = item.createdAt || item.receivedAt;
  if (exactDate) {
    const timestamp = Date.parse(exactDate);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  // Imported and order-created records use timestamp-based IDs even when older
  // data did not persist a dedicated createdAt field.
  const idTimestamp = String(item.id || '').match(/\d{13}/)?.[0];
  if (idTimestamp) {
    const timestamp = Number(idTimestamp);
    if (Number.isFinite(timestamp)) return timestamp;
  }

  const fallbackDate = item.receivedOn || (includePurchaseDate ? item.purchased : '');
  if (!fallbackDate) return 0;
  const timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(fallbackDate) ? `${fallbackDate}T00:00:00` : fallbackDate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function recentDateLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TypePreview({ model }) {
  return (
    <span className="equipment-preview equipment-preview--compact" style={{ width: 66, height: 50, flex: 'none' }}>
      <canvas className="equipment-preview__canvas" data-model={glbUrl(model.id)} aria-label={`${model.name} 3D preview`} />
    </span>
  );
}

function InventoryWeb({ groupBy, options, onChangeMode, onSelect }) {
  const [category, setCategory] = useState('');
  const [nodePositions, setNodePositions] = useState({});
  const [draggingNode, setDraggingNode] = useState('');
  const canvasRef = useRef(null);
  const nodePositionsRef = useRef(nodePositions);
  const dragRef = useRef(null);
  const suppressClickRef = useRef('');
  useEffect(() => setCategory(''), [groupBy]);
  useEffect(() => {
    const loaded = loadInventoryWebPositions();
    nodePositionsRef.current = loaded;
    setNodePositions(loaded);
  }, []);
  useEffect(() => { nodePositionsRef.current = nodePositions; }, [nodePositions]);

  const categoryOptions = useMemo(() => {
    if (groupBy !== 'type') return [];
    const totals = new Map();
    options.forEach((option) => {
      const model = MODELS.find((entry) => entry.id === option.value);
      const name = model?.cat || 'Uncategorized equipment';
      totals.set(name, (totals.get(name) || 0) + option.count);
    });
    return Array.from(totals, ([label, count]) => ({ value: label, label, count, category: true })).sort((a, b) => a.label.localeCompare(b.label));
  }, [groupBy, options]);

  const visibleOptions = groupBy === 'location'
    ? options
    : category
      ? options.filter((option) => (MODELS.find((model) => model.id === option.value)?.cat || 'Uncategorized equipment') === category)
      : categoryOptions;
  const webWidth = groupBy === 'type' ? 1200 : 1000;
  const webHeight = groupBy === 'type' ? 680 : 500;
  const positionScope = `${groupBy}:${category || 'overview'}`;
  const defaultPositions = webPositions(visibleOptions.length, webWidth, webHeight);
  const positions = defaultPositions.map((position, index) => {
    const saved = nodePositions[positionScope]?.[visibleOptions[index]?.value];
    return saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? { x: saved.x * webWidth, y: saved.y * webHeight } : position;
  });
  const centerTitle = groupBy === 'location' ? 'Inventory locations' : category || 'Equipment catalogue';
  const centerSubtitle = groupBy === 'location' ? `${options.length} active locations` : category ? `${visibleOptions.length} available types` : `${categoryOptions.length} categories`;
  const visibleRecords = visibleOptions.reduce((total, option) => total + Number(option.count || 0), 0);
  const nodeAccents = ['#0a3d7c', '#315f8f', '#52779b', '#234f78', '#6c8297', '#183f68'];
  const beginNodeDrag = (event, option) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, value: option.value, startX: event.clientX, startY: event.clientY, moved: false };
    setDraggingNode(option.value);
  };
  const moveNode = (event) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !canvas) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    const bounds = canvas.getBoundingClientRect();
    const nextPosition = { x: Math.min(.94, Math.max(.06, (event.clientX - bounds.left) / bounds.width)), y: Math.min(.89, Math.max(.08, (event.clientY - bounds.top) / bounds.height)) };
    const next = { ...nodePositionsRef.current, [positionScope]: { ...(nodePositionsRef.current[positionScope] || {}), [drag.value]: nextPosition } };
    nodePositionsRef.current = next;
    setNodePositions(next);
  };
  const endNodeDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressClickRef.current = drag.value;
      try { localStorage.setItem(INVENTORY_WEB_POSITIONS_KEY, JSON.stringify(nodePositionsRef.current)); } catch { /* Persistence can be unavailable in restricted browser sessions. */ }
    }
    dragRef.current = null;
    setDraggingNode('');
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const activateNode = (option) => {
    if (suppressClickRef.current === option.value) { suppressClickRef.current = ''; return; }
    if (option.category) setCategory(option.value);
    else onSelect(option.value);
  };

  return (
    <div className="inventory-web-map" style={{ minHeight: webHeight + 104 }}>
      <div className="inventory-web-toolbar">
        <span className="inventory-web-heading">
          <small><i /> INVENTORY EXPLORER</small>
          <strong>{groupBy === 'location' ? 'Campus asset network' : category ? `${category} equipment` : 'Equipment intelligence map'}</strong>
          <p>{groupBy === 'location' ? 'Select a connected building to inspect every asset held at that location.' : category ? 'Choose an equipment type to open its complete inventory register.' : 'Move from a broad equipment family into its individual tracked types.'}</p>
        </span>
        <span className="inventory-web-toolbar-stats">
          <span><small>VISIBLE RECORDS</small><strong>{visibleRecords.toLocaleString()}</strong></span>
          <span><small>{groupBy === 'location' ? 'BUILDINGS' : category ? 'ITEM TYPES' : 'CATEGORIES'}</small><strong>{visibleOptions.length}</strong></span>
        </span>
        <span className="inventory-web-mode-switch">
          <button type="button" data-active={groupBy === 'location'} onClick={() => onChangeMode('location')}><WebNodeIcon category="" location /> Locations</button>
          <button type="button" data-active={groupBy === 'type'} onClick={() => onChangeMode('type')}><WebNodeIcon category="Computers" /> Equipment</button>
        </span>
        {category && <button type="button" className="inventory-web-back" onClick={() => setCategory('')}>← All categories</button>}
      </div>

      <div ref={canvasRef} className="inventory-web-canvas" style={{ height: webHeight }}>
        <div className="inventory-web-grid" aria-hidden="true" />
        <div className="inventory-web-orbit inventory-web-orbit--outer" aria-hidden="true" />
        <div className="inventory-web-orbit inventory-web-orbit--inner" aria-hidden="true" />
        <svg className="inventory-web-links" viewBox={`0 0 ${webWidth} ${webHeight}`} preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="inventory-link" x1="0" x2="1"><stop stopColor="#9bb7d3" stopOpacity=".32"/><stop offset=".5" stopColor="#0a3d7c" stopOpacity=".58"/><stop offset="1" stopColor="#9bb7d3" stopOpacity=".32"/></linearGradient></defs>
          {positions.map((position, index) => <g key={visibleOptions[index]?.value || index}><line className="inventory-web-link" pathLength="1" style={{ animationDelay: `${35 + Math.min(index, 12) * 15}ms` }} x1={webWidth / 2} y1={webHeight / 2} x2={position.x} y2={position.y} stroke="url(#inventory-link)" strokeWidth="2"/><line className="inventory-web-flow" pathLength="1" style={{ animationDelay: `${500 + (index % 7) * 210}ms` }} x1={webWidth / 2} y1={webHeight / 2} x2={position.x} y2={position.y}/><circle className="inventory-web-junction" style={{ animationDelay: `${250 + Math.min(index, 12) * 15}ms` }} cx={position.x} cy={position.y} r="4" fill="#0a3d7c" opacity=".5"/></g>)}
        </svg>

        <div className="inventory-web-centre">
          <span className="inventory-web-centre-icon"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 20V8l8-4 8 4v12"/><path d="M8 20v-5h8v5M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01"/></svg></span>
          <small>LIVE INVENTORY HUB</small>
          <strong>{centerTitle}</strong>
          <p>{centerSubtitle}</p>
          <em><i /> Synchronized</em>
        </div>

        {visibleOptions.map((option, index) => {
          const position = positions[index];
          const model = !option.category ? MODELS.find((entry) => entry.id === option.value) : null;
          const horizontalPosition = position.x / webWidth;
          const expandDirection = horizontalPosition < .37 ? 'right' : horizontalPosition > .63 ? 'left' : 'centre';
          return <button key={option.value} type="button" className="inventory-web-node" data-expand={expandDirection} data-dragging={draggingNode === option.value ? 'true' : undefined} title={`${option.label} · ${option.count} record${option.count === 1 ? '' : 's'} · drag to reposition`} aria-label={`Open ${option.label}, ${option.count} record${option.count === 1 ? '' : 's'}. Drag to reposition.`} onPointerDown={(event) => beginNodeDrag(event, option)} onPointerMove={moveNode} onPointerUp={endNodeDrag} onPointerCancel={endNodeDrag} onClick={() => activateNode(option)}
            style={{ '--node-accent': nodeAccents[index % nodeAccents.length], '--node-open-width': groupBy === 'type' ? '216px' : '202px', animationDelay: `${80 + Math.min(index, 12) * 22}ms`, left: `${position.x / webWidth * 100}%`, top: `${position.y / webHeight * 100}%` }}>
            <span className={`inventory-web-node-visual${model ? ' equipment-preview equipment-preview--node' : ''}`}>
              {model ? <canvas className="equipment-preview__canvas" data-model={glbUrl(model.id)} aria-label={`${model.name} 3D preview`} /> : <WebNodeIcon category={option.category ? option.label : ''} location={!option.category} />}
            </span>
            <span className="inventory-web-node-copy"><small>{option.category ? 'EQUIPMENT FAMILY' : model?.cat || 'CAMPUS LOCATION'}</small><strong>{option.label}</strong><span><b>{option.count}</b> record{option.count === 1 ? '' : 's'}</span></span>
            <span className="inventory-web-node-arrow">›</span>
          </button>;
        })}
        {!visibleOptions.length && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#7b8794', fontSize: 12.5 }}>No groups match the current search and filters.</div>}
        <div className="inventory-web-map-footer"><span><i className="blue" /> Connected dataset</span><span><i className="green" /> Live inventory count</span><small>Select any node to explore its records</small></div>
      </div>
    </div>
  );
}

function webPositions(count, width, height) {
  if (!count) return [];
  const positions = [];
  const outerCount = count > 12 ? Math.ceil(count * .62) : count;
  const innerCount = count - outerCount;
  for (let index = 0; index < outerCount; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / outerCount;
    positions.push({ x: width / 2 + Math.cos(angle) * width * .415, y: height / 2 + Math.sin(angle) * height * .31 });
  }
  for (let index = 0; index < innerCount; index += 1) {
    const angle = -Math.PI / 2 + Math.PI / Math.max(innerCount, 1) + (index * Math.PI * 2) / innerCount;
    positions.push({ x: width / 2 + Math.cos(angle) * width * .265, y: height / 2 + Math.sin(angle) * height * .24 });
  }
  return positions;
}

function WebNodeIcon({ category, location }) {
  const key = category.toLowerCase();
  if (location) return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 12h.01M12 12h.01M16 12h.01"/></svg>;
  if (/computer/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 21h8M12 16v5"/></svg>;
  if (/display/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M7 21h10M12 17v4"/></svg>;
  if (/network|cable|adapter/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 11l9-4M7.5 13l9 4"/></svg>;
  if (/audio|visual|conferenc|classroom|communication/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11"/></svg>;
  if (/print/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M7 8V3h10v5M7 17H4V9h16v8h-3M7 14h10v7H7z"/><circle cx="17" cy="11" r=".7" fill="currentColor"/></svg>;
  if (/storage/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></svg>;
  if (/power|facilit/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m13 2-8 12h7l-1 8 8-12h-7z"/></svg>;
  if (/security/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>;
  if (/office|furniture|appliance/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16v16H4zM4 10h16M10 10v10"/><circle cx="17" cy="15" r="1"/></svg>;
  if (/peripheral|accessor|tool|repair/.test(key)) return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 6a4 4 0 0 0-5 5L3 17l4 4 6-6a4 4 0 0 0 5-5l-3 3-3-3z"/></svg>;
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
}

function Inventory({ resetKey, items, filters, setFilters, view, setView, onOpenItem, canDelete, onDelete }) {
  const inventoryTopRef = useRef(null);
  const paginationChangeRef = useRef(false);
  const [section, setSection] = useState('records');
  const [groupBy, setGroupBy] = useState('location');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [bulkBarcodeOpen, setBulkBarcodeOpen] = useState(false);
  const [viewingModel, setViewingModel] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [recordSort, setRecordSort] = useState({ key: 'added', direction: 'desc' });
  const [summarySort, setSummarySort] = useState({ key: 'type', direction: 'asc' });
  const categories = useMemo(() => Array.from(new Set(MODELS.map((model) => model.cat))).sort(), []);

  const list = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return items.filter((it) => {
      if (showArchived ? !it.archived : it.archived) return false;
      if (filters.fCategory !== 'All categories' && it.category !== filters.fCategory) return false;
      if (filters.fStatus !== 'All statuses' && effStatus(it) !== filters.fStatus) return false;
      if (q && !(it.name + ' ' + it.tag + ' ' + it.serial + ' ' + it.room + ' ' + it.location + ' ' + it.category + ' ' + (it.assignedTo || '')).toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.rank - b.rank) || a.tag.localeCompare(b.tag));
  }, [items, filters, showArchived]);

  const groupOptions = useMemo(() => {
    const counts = new Map();
    list.forEach((item) => {
      const key = groupBy === 'location' ? (item.location || 'Unassigned location') : item.model;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts, ([value, count]) => ({
      value,
      count,
      label: groupBy === 'location' ? value : (MODELS.find((model) => model.id === value)?.name || value)
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [list, groupBy]);

  const groupedList = useMemo(() => {
    if (!selectedGroup) return [];
    if (groupBy === 'location' && selectedGroup === ALL_BUILDINGS) return list;
    return list.filter((item) => (groupBy === 'location' ? (item.location || 'Unassigned location') : item.model) === selectedGroup);
  }, [list, groupBy, selectedGroup]);
  const sortedGroupedList = useMemo(() => sortRows(groupedList, recordSort, {
    asset: (item) => item.name, tag: (item) => item.tag, location: (item) => `${item.location} ${item.room}`,
    status: (item) => effStatus(item), assignment: (item) => item.assignedTo || item.borrower || '', quantity: (item) => Number(item.qty || 0), condition: (item) => item.condition,
    added: inventoryAddedTimestamp
  }), [groupedList, recordSort]);
  const pageSize = view === 'grid' ? 36 : 100;
  const totalPages = Math.max(1, Math.ceil(groupedList.length / pageSize));
  const pageItems = useMemo(() => sortedGroupedList.slice((page - 1) * pageSize, page * pageSize), [sortedGroupedList, page, pageSize]);

  const goToPage = (nextPage) => {
    paginationChangeRef.current = true;
    setPage(Math.max(1, Math.min(totalPages, nextPage)));
  };

  useEffect(() => {
    if (!paginationChangeRef.current) return;
    paginationChangeRef.current = false;
    const scrollPanel = inventoryTopRef.current?.closest('[data-app-content-scroll="true"]');
    if (scrollPanel) scrollPanel.scrollTop = 0;
    else inventoryTopRef.current?.scrollIntoView({ block: 'start' });
  }, [page]);

  useEffect(() => {
    const validSelection = groupBy === 'type'
      ? MODELS.some((model) => model.id === selectedGroup)
      : selectedGroup === ALL_BUILDINGS || groupOptions.some((option) => option.value === selectedGroup);
    if (selectedGroup && !validSelection) setSelectedGroup('');
    setPage(1);
  }, [groupBy, selectedGroup, filters.query, filters.fCategory, filters.fStatus, view, items.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => Inv3D.sync());
    return () => cancelAnimationFrame(frame);
  }, [section, selectedGroup, page, view, refreshVersion, viewingModel]);

  useEffect(() => {
    if (!viewingModel) return undefined;
    const close = (event) => { if (event.key === 'Escape') setViewingModel(null); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [viewingModel]);

  useEffect(() => {
    setSection('records');
    setGroupBy('location');
    setSelectedGroup('');
    setPage(1);
  }, [resetKey]);

  const typeList = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return MODELS.filter((model) => {
      if (filters.fCategory !== 'All categories' && model.cat !== filters.fCategory) return false;
      if (query && !`${model.name} ${model.cat} ${model.id}`.toLowerCase().includes(query)) return false;
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [filters.fCategory, filters.query]);

  const typeSummary = useMemo(() => MODELS.map((model) => {
    const records = items.filter((item) => item.model === model.id && (showArchived ? item.archived : !item.archived) && (showArchived || item.status !== 'Retired'));
    const quantity = (record) => Math.max(0, Number(record.qty) || 0);
    return {
      ...model,
      total: records.reduce((sum, record) => sum + quantity(record), 0),
      inStock: records.filter((record) => record.status === 'In stock').reduce((sum, record) => sum + quantity(record), 0),
      onLoan: records.filter((record) => record.status === 'On loan').reduce((sum, record) => sum + quantity(record), 0),
      maintenance: records.filter((record) => record.status === 'Maintenance').reduce((sum, record) => sum + quantity(record), 0),
      outStock: records.filter((record) => quantity(record) === 0).length,
      assigned: records.filter((record) => record.assignedTo || record.borrower).reduce((sum, record) => sum + quantity(record), 0)
    };
  }).filter((row) => {
    const query = filters.query.trim().toLowerCase();
    return (filters.fCategory === 'All categories' || row.cat === filters.fCategory) && (!query || `${row.name} ${row.cat}`.toLowerCase().includes(query));
  }), [items, filters.fCategory, filters.query, showArchived]);
  const sortedTypeSummary = useMemo(() => sortRows(typeSummary, summarySort, {
    type: (row) => row.name, total: (row) => row.total, inStock: (row) => row.inStock, onLoan: (row) => row.onLoan,
    maintenance: (row) => row.maintenance, outStock: (row) => row.outStock, assigned: (row) => row.assigned
  }), [typeSummary, summarySort]);

  const openTypeRecords = (modelId) => {
    setSection('records');
    setGroupBy('type');
    setSelectedGroup(modelId);
    setShowArchived(false);
    setPage(1);
    setFilters((current) => ({ ...current, query: '', fCategory: 'All categories', fStatus: 'All statuses' }));
  };

  const selectedTypeModel = groupBy === 'type' && selectedGroup
    ? MODELS.find((model) => model.id === selectedGroup)
    : null;

  return (
    <div ref={inventoryTopRef} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {section === 'records' && selectedGroup && (
          <button type="button" className="btn-ghost" onClick={() => { setSelectedGroup(''); setPage(1); }}
            style={{ height: 34, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 8, color: '#0a3d7c', fontSize: 12, fontWeight: 650 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/><path d="M9 12h10"/></svg>
            Back to inventory web
          </button>
        )}
        <div style={{ display: 'flex', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, overflow: 'hidden' }}>
          <button type="button" onClick={() => setSection('records')}
            style={{ height: 34, padding: '0 12px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: section === 'records' ? '#0a3d7c' : '#fff', color: section === 'records' ? '#fff' : '#5b6672' }}>Inventory records</button>
          <button type="button" onClick={() => setSection('types')}
            style={{ height: 34, padding: '0 12px', border: 'none', borderLeft: '1px solid #dfe3e9', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: section === 'types' ? '#0a3d7c' : '#fff', color: section === 'types' ? '#fff' : '#5b6672' }}>Equipment types</button>
          <button type="button" onClick={() => { setSection('summary'); setFilters((current) => ({ ...current, query: '', fCategory: 'All categories' })); }}
            style={{ height: 34, padding: '0 12px', border: 'none', borderLeft: '1px solid #dfe3e9', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: section === 'summary' ? '#0a3d7c' : '#fff', color: section === 'summary' ? '#fff' : '#5b6672' }}>Item type summary</button>
        </div>
        <select value={filters.fCategory} onChange={(e) => setFilters((f) => ({ ...f, fCategory: e.target.value }))}
          style={{ height: 34, padding: '0 10px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>
          {['All categories', ...categories].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {section === 'records' && (
          <>
            <select value={groupBy} onChange={(e) => { setGroupBy(e.target.value); setSelectedGroup(''); setPage(1); }} aria-label="Group inventory records by"
              style={{ height: 34, padding: '0 10px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <option value="location">Browse by location</option>
              <option value="type">Browse by equipment type</option>
            </select>
            <select value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setPage(1); }} aria-label={groupBy === 'location' ? 'Choose a location' : 'Choose an equipment type'}
              style={{ minWidth: 220, height: 34, padding: '0 10px', background: '#fff', border: '1px solid #c8d5e2', borderRadius: 8, color: selectedGroup ? '#263746' : '#7b8794', fontSize: 12.5, cursor: 'pointer' }}>
              <option value="">{groupBy === 'location' ? 'Choose a location…' : 'Choose an equipment type…'}</option>
              {groupBy === 'location' && <option value={ALL_BUILDINGS}>All buildings ({list.length})</option>}
              {selectedTypeModel && !groupOptions.some((option) => option.value === selectedGroup) && <option value={selectedGroup}>{selectedTypeModel.name} (0)</option>}
              {groupOptions.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.count})</option>)}
            </select>
            <select value={filters.fStatus} onChange={(e) => setFilters((f) => ({ ...f, fStatus: e.target.value }))}
              style={{ height: 34, padding: '0 10px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, fontSize: 12.5, cursor: 'pointer' }}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}
        <div style={{ flex: 1 }}></div>
        {canDelete && section === 'records' && <button type="button" className="btn-ghost" onClick={() => { setShowArchived((value) => !value); setSelectedGroup(''); setPage(1); }} style={{ height: 34, padding: '0 11px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{showArchived ? 'Active assets' : 'Archived assets'}</button>}
        {section === 'records' && (
          <button type="button" className="btn-ghost" onClick={() => setBulkBarcodeOpen(true)}
            style={{ height: 34, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 8, color: '#0a3d7c', fontSize: 12, fontWeight: 600 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5v14M7 5v14M11 5v14M15 5v14M18 5v14M21 5v14"/><path d="M2 8V4a2 2 0 0 1 2-2h4M22 8V4a2 2 0 0 0-2-2h-4M2 16v4a2 2 0 0 0 2 2h4M22 16v4a2 2 0 0 1-2 2h-4"/></svg>
            Bulk barcodes
          </button>
        )}
        <button type="button" className="btn-ghost" onClick={() => { setPage(1); setRefreshVersion((current) => current + 1); }}
          title="Refresh inventory data and model previews" style={{ height: 34, padding: '0 11px', display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 8, color: '#0a3d7c', fontSize: 12, fontWeight: 600 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9a7 7 0 0 1 11.4-2.6L20 9M4 15l2.5 2.6A7 7 0 0 0 17.9 15"/></svg>
          Refresh
        </button>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: '#7b8794' }}>{section === 'types' ? `${typeList.length} of ${MODELS.length} potential types` : section === 'summary' ? `${typeSummary.length} type summaries` : selectedGroup ? `${groupedList.length} records in selection` : `${groupOptions.length} groups available`}</span>
        {section === 'records' && (
          <div style={{ display: 'flex', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, overflow: 'hidden' }}>
            <button type="button" onClick={() => setView('grid')}
              style={{ height: 32, padding: '0 12px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: view === 'grid' ? '#0a3d7c' : '#fff', color: view === 'grid' ? '#fff' : '#5b6672' }}>3D cards</button>
            <button type="button" onClick={() => setView('table')}
              style={{ height: 32, padding: '0 12px', border: 'none', borderLeft: '1px solid #dfe3e9', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: view === 'table' ? '#0a3d7c' : '#fff', color: view === 'table' ? '#fff' : '#5b6672' }}>Table</button>
          </div>
        )}
      </div>

      {section === 'summary' ? (
        <div style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#eef4fb', borderBottom: '1px solid #d5e1ef' }}>
            <span style={{ fontSize: 11.5, color: '#526579' }}>Complete 3D equipment catalogue with live quantities for every supported item type.</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 700, color: '#0a3d7c' }}>{typeSummary.length} / {MODELS.length} types</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2.1fr .75fr .75fr .75fr .85fr .8fr .8fr', gap: 12, padding: '10px 16px', background: '#f7f9fb', borderBottom: '1px solid #dfe3e9', fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7b8794' }}>
            {[['type', 'Item type'], ['total', 'Total'], ['inStock', 'In stock'], ['onLoan', 'In use'], ['maintenance', 'Maintenance'], ['outStock', 'Out stock'], ['assigned', 'Assigned']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={summarySort} onSort={(key) => setSummarySort((current) => nextSort(current, key))} />)}
          </div>
          {sortedTypeSummary.map((row) => (
            <button key={row.id} type="button" data-row="1" onClick={() => openTypeRecords(row.id)} style={{ width: '100%', display: 'grid', gridTemplateColumns: '2.1fr .75fr .75fr .75fr .85fr .8fr .8fr', gap: 12, alignItems: 'center', padding: '11px 16px', background: '#fff', border: 0, borderBottom: '1px solid #f2f4f7', color: 'inherit', textAlign: 'left', cursor: 'pointer', fontSize: 12.5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}><TypePreview model={row} /><span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontWeight: 600 }}>{row.name}</strong><small style={{ color: '#7b8794' }}>{row.cat}</small></span></span>
              {[row.total, row.inStock, row.onLoan, row.maintenance, row.outStock, row.assigned].map((value, index) => <span key={index} style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: index === 0 ? 700 : 500, color: index === 4 && value ? '#b3261e' : '#3f4a56' }}>{value}</span>)}
            </button>
          ))}
        </div>
      ) : section === 'types' ? (
        <>
          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#eef4fb', border: '1px solid #d5e1ef', borderRadius: 9 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0a3d7c' }}>Equipment Type Catalogue</span>
              <span style={{ fontSize: 11.5, color: '#526579' }}>These are all equipment types the system can support, regardless of whether any units currently exist in inventory.</span>
            </span>
            <span style={{ flex: 'none', padding: '4px 9px', borderRadius: 999, background: '#fff', color: '#0a3d7c', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600 }}>{MODELS.length} types</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${CARD_MIN_WIDTH}px,1fr))`, gap: 16 }}>
            {typeList.map((model) => (
              <div key={model.id} role="button" tabIndex={0} data-card="1" onClick={() => openTypeRecords(model.id)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTypeRecords(model.id); } }}
                style={{ padding: 0, background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', textAlign: 'left' }}>
                <span className="equipment-preview equipment-preview--card" style={{ height: 160 }}>
                  <canvas className="equipment-preview__canvas" data-model={glbUrl(model.id)} aria-label={`${model.name} 3D equipment preview`} />
                  <span style={{ position: 'absolute', top: 9, right: 9, padding: '3px 7px', background: model.cons ? '#fdf0e0' : '#e9effa', color: model.cons ? '#8a5209' : '#0a3d7c', borderRadius: 999, fontSize: 9.5, fontWeight: 700 }}>{model.cons ? 'Consumable' : 'Tracked asset'}</span>
                </span>
                <span className="equipment-type-card-body" style={{ padding: 12, borderTop: '1px solid #eceff3', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button type="button" className="equipment-model-view-button" title={`View ${model.name} in 3D`} aria-label={`View ${model.name} in 3D`}
                    onClick={(event) => { event.stopPropagation(); setViewingModel(model); }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 8 4.5v9L12 20l-8-4.5v-9z"/><path d="m4 6.5 8 4.5 8-4.5M12 11v9"/></svg>
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{model.name}</span>
                  <span style={{ fontSize: 10.5, color: '#7b8794' }}>{model.cat}</span>
                  <span style={{ paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f2f4f7' }}>
                    <span style={{ fontSize: 10.5, color: '#7b8794' }}>Typical unit cost</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, fontWeight: 600 }}>{money(model.cost)}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
          {typeList.length === 0 && <div style={{ padding: 44, textAlign: 'center', fontSize: 13, color: '#7b8794' }}>No equipment types match this search and category.</div>}
        </>
      ) : !selectedGroup ? (
        <InventoryWeb key={`${groupBy}-${resetKey}`} groupBy={groupBy} options={groupOptions} onChangeMode={(mode) => { setGroupBy(mode); setSelectedGroup(''); }} onSelect={(value) => { setSelectedGroup(value); setPage(1); }} />
      ) : view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill,minmax(${CARD_MIN_WIDTH}px,1fr))`, gap: 16 }}>
          {pageItems.map((it) => {
            const st = effStatus(it);
            const recentDate = recentInventoryDate(it);
            return (
              <div key={it.id} data-card="1" data-recent={recentDate ? 'true' : undefined} data-stocktake-state={it.stocktakeState || undefined} role="button" tabIndex={0} onClick={() => onOpenItem(it.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenItem(it.id); } }} style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden', cursor: 'pointer' }}>
                <div style={{ position: 'relative', height: 150, background: 'radial-gradient(closest-side,#eef2f7,#f8f9fb)' }}>
                  <canvas data-model={glbUrl(it.model)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}></canvas>
                  {recentDate && <span className="inventory-recent-badge">Recently added · {recentDateLabel(recentDate)}</span>}
                  <span style={{
                    position: 'absolute', top: 9, right: 9, padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                    ...statusTagStyle(st), border: '1px solid rgba(20,24,29,.06)'
                  }}>{st}</span>
                </div>
                <div style={{ padding: 12, borderTop: '1px solid #eceff3', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, letterSpacing: '-.01em', lineHeight: 1.25 }}>{it.name}<StocktakeFlag item={it} /></span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10.5, color: '#0b4a94' }}>{it.tag}</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 7, borderTop: '1px solid #f2f4f7' }}>
                    <span style={{ fontSize: 11.5, color: '#7b8794' }}>{it.location} · {it.room}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, fontWeight: 600, color: it.consumable && it.qty <= it.min ? '#b3261e' : '#3f4a56' }}>
                      {it.qty + (it.qty === 1 ? ' unit' : ' units')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(event) => event.stopPropagation()}>
                    <span style={{ flex: 1, fontSize: 10.5, color: '#7b8794' }}>{it.assignedTo ? `Assigned: ${it.assignedTo}` : 'Unassigned'}</span>
                    {canDelete && <button type="button" className="btn-ghost-danger" onClick={() => onDelete(it.id)} style={{ height: 28, padding: '0 8px', borderRadius: 7, fontSize: 10.5 }}>Delete</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.25fr 1fr 1.15fr .7fr .75fr .65fr', gap: 10, padding: '10px 16px', background: '#f7f9fb', borderBottom: '1px solid #dfe3e9', fontSize: 10.5, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#7b8794' }}>
            {[['asset', 'Asset'], ['tag', 'Tag'], ['location', 'Location'], ['status', 'Status'], ['assignment', 'Assignment'], ['quantity', 'Qty'], ['condition', 'Condition']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={recordSort} onSort={(key) => { setRecordSort((current) => nextSort(current, key)); setPage(1); }} />)}<span></span>
          </div>
          {pageItems.map((it) => {
            const st = effStatus(it);
            const recentDate = recentInventoryDate(it);
            return (
              <div key={it.id} data-row="1" data-recent={recentDate ? 'true' : undefined} data-stocktake-state={it.stocktakeState || undefined} role="button" tabIndex={0} onClick={() => onOpenItem(it.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpenItem(it.id); } }}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.25fr 1fr 1.15fr .7fr .75fr .65fr', gap: 10, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f2f4f7', cursor: 'pointer', fontSize: 12.5 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={thumbStyle(it.model, 30, 5)}></span>
                  <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                    <span style={{ maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}<StocktakeFlag item={it} /></span>
                    {recentDate && <span className="inventory-recent-badge inventory-recent-badge--row">Recently added · {recentDateLabel(recentDate)}</span>}
                  </span>
                </span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#0b4a94' }}>{it.tag}</span>
                <span style={{ color: '#3f4a56' }}>{it.location} · {it.room}</span>
                <span><span style={statusTagStyle(st)}>{st}</span></span>
                <span style={{ color: '#5b6672', fontSize: 11.5 }}>{it.assignedTo || it.borrower || '—'}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5 }}>{it.qty}</span>
                <span style={{ color: '#5b6672', fontSize: 11.5 }}>{it.condition}</span>
                <span onClick={(event) => event.stopPropagation()}>{canDelete && <button type="button" className="btn-ghost-danger" onClick={() => onDelete(it.id)} style={{ height: 27, padding: '0 7px', borderRadius: 6, fontSize: 10.5 }}>Delete</button>}</span>
              </div>
            );
          })}
          {groupedList.length === 0 && (
            <div style={{ padding: 44, textAlign: 'center', fontSize: 13, color: '#7b8794' }}>No assets match these filters.</div>
          )}
        </div>
      )}

      {section === 'records' && selectedGroup && totalPages > 1 && (
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#fff', border: '1px solid #dfe3e9', borderRadius: 9 }}>
          <button type="button" className="btn-ghost" disabled={page === 1} onClick={() => goToPage(page - 1)} style={{ height: 32, padding: '0 12px', borderRadius: 7, fontSize: 11.5 }}>Previous</button>
          <span style={{ minWidth: 150, textAlign: 'center', fontFamily: "'IBM Plex Mono',monospace", color: '#5b6672', fontSize: 11.5 }}>Page {page} of {totalPages}</span>
          <button type="button" className="btn-ghost" disabled={page === totalPages} onClick={() => goToPage(page + 1)} style={{ height: 32, padding: '0 12px', borderRadius: 7, fontSize: 11.5 }}>Next</button>
        </div>
      )}

      <BulkBarcodeModal open={bulkBarcodeOpen} items={selectedGroup ? groupedList : list} onClose={() => setBulkBarcodeOpen(false)} />
      {viewingModel && createPortal(
        <div className="equipment-model-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewingModel(null); }}>
          <section className="equipment-model-modal" role="dialog" aria-modal="true" aria-labelledby="equipment-model-modal-title">
            <header>
              <span><small>INTERACTIVE 3D PREVIEW</small><strong id="equipment-model-modal-title">{viewingModel.name}</strong><em>{viewingModel.cat}</em></span>
              <button type="button" onClick={() => setViewingModel(null)} aria-label="Close 3D model viewer">×</button>
            </header>
            <div className="equipment-model-modal-stage">
              <canvas className="equipment-preview__canvas" data-model={glbUrl(viewingModel.id)} aria-label={`${viewingModel.name} interactive 3D model`} />
              <span className="equipment-model-modal-hint">Drag to rotate · Scroll to zoom</span>
            </div>
            <footer><span>{viewingModel.cons ? 'Consumable item' : 'Tracked asset'}</span><span>{money(viewingModel.cost)} typical unit cost</span></footer>
          </section>
        </div>, document.body
      )}
    </div>
  );
}

export default memo(Inventory, (previous, next) => previous.resetKey === next.resetKey
  && previous.items === next.items
  && previous.filters === next.filters
  && previous.view === next.view
  && previous.canDelete === next.canDelete);
