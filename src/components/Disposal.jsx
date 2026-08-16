import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { iso, money, thumbStyle, today } from '../data.js';
import { deleteAttachment, loadAttachment, saveAttachment } from '../attachment-store.js';
import StocktakeFlag from './StocktakeFlag.jsx';

const DISPOSAL_TYPES = ['Disposal', 'Donation', 'Write-off', 'Loss'];
const DISPOSAL_METHODS = ['Certified recycling', 'Secure destruction', 'Auction / sale', 'Donation', 'Trade-in', 'Return to vendor', 'Write-off', 'Other'];
const ACTIVE_STATUSES = ['Pending approval', 'Approved'];

const blankRequest = (itemId = '') => ({
  itemId,
  type: 'Disposal',
  effectiveDate: iso(today()),
  justification: '',
  recipient: '',
  vendor: '',
  disposalMethod: 'Certified recycling',
  incidentReference: '',
  proceeds: 0,
  dataSanitization: '',
  documents: []
});

function statusClass(status) {
  return String(status || '').toLowerCase().replace(/\s+/g, '-');
}

function readiness(item) {
  if (item.status === 'On loan') return { label: 'Return required', tone: 'warning', note: 'Asset must be checked in before disposal.' };
  if (item.status === 'Maintenance') return { label: 'Close repair first', tone: 'warning', note: 'Active maintenance work must be closed first.' };
  const replacement = new Date(`${item.expectedReplacementDate || ''}T12:00:00`);
  if (item.expectedReplacementDate && !Number.isNaN(replacement.getTime()) && replacement <= new Date()) return { label: 'Lifecycle due', tone: 'critical', note: 'Planned replacement date has passed.' };
  if (/poor|damaged|beyond repair/i.test(item.condition || '')) return { label: 'Condition flagged', tone: 'critical', note: `Recorded condition: ${item.condition}.` };
  return { label: 'Review candidate', tone: 'ready', note: 'Available for a controlled disposal assessment.' };
}

function dateLabel(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function fileSizeLabel(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function previewableFile(file) {
  return file?.type === 'application/pdf' || /^image\/(png|jpe?g|webp|gif)$/i.test(file?.type || '');
}

function Modal({ children, onClose, wide = false }) {
  return createPortal(
    <div className="disposal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`disposal-modal${wide ? ' disposal-modal--wide' : ''}`} role="dialog" aria-modal="true">{children}</section>
    </div>,
    document.body
  );
}

function EmptyState({ title, text }) {
  return <div className="disposal-empty"><span aria-hidden="true">✓</span><strong>{title}</strong><p>{text}</p></div>;
}

export default function Disposal({ items, actions, query, canManage, canApprove, createSignal = 0, onCreateSignalHandled, onCreateAction, onDecide, onComplete, onCancel, onOpenItem }) {
  const [tab, setTab] = useState('queue');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState(blankRequest());
  const [requestError, setRequestError] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState(null);
  const [decision, setDecision] = useState(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [page, setPage] = useState(1);
  const [filesBusy, setFilesBusy] = useState(false);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [documentMessage, setDocumentMessage] = useState('');

  const term = String(query || '').trim().toLowerCase();
  const disposalActions = useMemo(() => actions
    .filter((action) => DISPOSAL_TYPES.includes(action.type))
    .filter((action) => statusFilter === 'All statuses' || action.status === statusFilter)
    .filter((action) => !term || `${action.id} ${action.itemName} ${action.itemTag} ${action.itemSerial} ${action.type} ${action.status} ${action.vendor} ${action.recipient} ${action.disposalMethod}`.toLowerCase().includes(term))
    .sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0)), [actions, statusFilter, term]);

  const activeItemIds = useMemo(() => new Set(actions.filter((action) => ACTIVE_STATUSES.includes(action.status)).map((action) => action.itemId)), [actions]);
  const candidates = useMemo(() => items
    .filter((item) => !item.consumable && !item.archived && item.status !== 'Retired' && !activeItemIds.has(item.id))
    .filter((item) => !term || `${item.name} ${item.tag} ${item.serial} ${item.location} ${item.room} ${item.condition}`.toLowerCase().includes(term))
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, ready: 2 };
      return order[readiness(a).tone] - order[readiness(b).tone] || a.name.localeCompare(b.name);
    }), [items, activeItemIds, term]);
  const disposedItems = useMemo(() => items
    .filter((item) => item.status === 'Retired' && DISPOSAL_TYPES.includes(item.dispositionType))
    .filter((item) => !term || `${item.name} ${item.tag} ${item.serial} ${item.dispositionType} ${item.dispositionRecipient} ${item.dispositionReason}`.toLowerCase().includes(term))
    .sort((a, b) => String(b.dispositionDate || '').localeCompare(String(a.dispositionDate || ''))), [items, term]);
  const requestCandidates = useMemo(() => {
    const search = assetSearch.trim().toLowerCase();
    return search
      ? candidates.filter((item) => `${item.tag} ${item.name} ${item.serial || ''}`.toLowerCase().includes(search))
      : candidates;
  }, [assetSearch, candidates]);

  const pending = actions.filter((action) => DISPOSAL_TYPES.includes(action.type) && action.status === 'Pending approval').length;
  const approved = actions.filter((action) => DISPOSAL_TYPES.includes(action.type) && action.status === 'Approved').length;
  const recovered = disposedItems.reduce((sum, item) => sum + Math.max(0, Number(item.dispositionProceeds) || 0), 0);
  const pageSize = tab === 'candidates' ? 24 : 50;
  const currentRows = tab === 'queue' ? disposalActions : tab === 'candidates' ? candidates : disposedItems;
  const pageCount = Math.max(1, Math.ceil(currentRows.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pagedActions = disposalActions.slice(pageStart, pageStart + pageSize);
  const pagedCandidates = candidates.slice(pageStart, pageStart + pageSize);
  const pagedDisposedItems = disposedItems.slice(pageStart, pageStart + pageSize);
  useEffect(() => setPage(1), [tab, statusFilter, term]);
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);
  useEffect(() => () => { if (documentPreview?.url) URL.revokeObjectURL(documentPreview.url); }, [documentPreview]);

  const openRequest = (itemId = '') => {
    setRequestForm(blankRequest(itemId || candidates[0]?.id || ''));
    setAssetSearch('');
    setRequestError('');
    setRequestOpen(true);
  };
  useEffect(() => {
    if (createSignal && canManage) { openRequest(); onCreateSignalHandled?.(); }
  }, [createSignal]);
  const saveRequest = () => {
    if (!requestForm.itemId) return setRequestError('Choose an asset to dispose of.');
    if (!requestForm.justification.trim()) return setRequestError('Enter the reason and business justification.');
    if (!requestForm.disposalMethod.trim()) return setRequestError('Choose or enter a disposal method.');
    if (requestForm.type !== 'Loss' && !`${requestForm.vendor} ${requestForm.recipient}`.trim()) return setRequestError('Record the vendor or receiving party responsible for custody.');
    const saved = onCreateAction({ ...requestForm, proceeds: Math.max(0, Number(requestForm.proceeds) || 0) });
    if (saved) setRequestOpen(false);
  };
  const discardRequest = () => {
    if (filesBusy) return;
    requestForm.documents.forEach((file) => { if (['indexeddb', 'supabase'].includes(file.storage)) deleteAttachment(file).catch(() => {}); });
    setRequestOpen(false);
  };
  const selectDocuments = async (event) => {
    const selected = Array.from(event.target.files || []).slice(0, 4);
    event.target.value = '';
    if (!selected.length) return;
    if (selected.some((file) => file.size > 20 * 1024 * 1024)) { setRequestError('Each supporting document must be 20 MB or smaller.'); return; }
    if (selected.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) { setRequestError('Supporting documents cannot exceed 50 MB in total.'); return; }
    setFilesBusy(true);
    setRequestError('');
    try {
      await Promise.all(requestForm.documents.filter((file) => ['indexeddb', 'supabase'].includes(file.storage)).map((file) => deleteAttachment(file).catch(() => {})));
      const stamp = Date.now();
      const documents = await Promise.all(selected.map(async (file, index) => {
        const id = `DOC-${stamp}-${index}-${Math.random().toString(36).slice(2, 7)}`;
        return saveAttachment(id, file);
      }));
      setRequestForm((form) => ({ ...form, documents }));
    } catch (fileError) {
      setRequestError(fileError?.message || 'The supporting documents could not be stored.');
    } finally { setFilesBusy(false); }
  };
  const viewDocument = async (file) => {
    setDocumentMessage('');
    try {
      const stored = ['indexeddb', 'supabase'].includes(file.storage) ? await loadAttachment(file) : null;
      if (!stored?.blob) { setDocumentMessage('This older record retained the document name only; its file content is unavailable.'); return; }
      if (!previewableFile(file)) { setDocumentMessage('This file type cannot be previewed here. Use Download to open it in its associated application.'); return; }
      const url = URL.createObjectURL(stored.blob);
      setDocumentPreview({ file, url });
    } catch { setDocumentMessage('The document could not be loaded from attachment storage.'); }
  };
  const downloadDocument = async (file) => {
    setDocumentMessage('');
    try {
      const stored = ['indexeddb', 'supabase'].includes(file.storage) ? await loadAttachment(file) : null;
      if (!stored?.blob) { setDocumentMessage('This older record retained the document name only; its file content is unavailable.'); return; }
      const url = URL.createObjectURL(stored.blob);
      const link = document.createElement('a');
      link.href = url; link.download = file.name || stored.name || 'disposal-document'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setDocumentMessage('The document could not be downloaded from attachment storage.'); }
  };
  const submitDecision = () => {
    if (!decision || !selectedAction) return;
    if (decision === 'Rejected' && !decisionNote.trim()) return;
    if (onDecide(selectedAction.id, decision, decisionNote)) {
      setDecision(null);
      setDecisionNote('');
      setSelectedAction(null);
    }
  };

  return <div className="disposal-workspace">
    <section className="disposal-hero">
      <div className="disposal-hero-copy"><span>Controlled asset exit</span><h2>Disposal & decommissioning</h2><p>Move end-of-life equipment through documented review, approval, sanitization, custody, and final retirement.</p></div>
      <div className="disposal-hero-mark" aria-hidden="true"><i /><i /><i /><strong>{pending + approved}</strong><small>active workflows</small></div>
      {canManage && <button type="button" className="disposal-new" onClick={() => openRequest()}>+ New disposal request</button>}
    </section>

    <section className="disposal-metrics">
      <article className="critical"><small>Awaiting approval</small><strong>{pending}</strong><span>Management decision required</span></article>
      <article className="approved"><small>Approved to dispose</small><strong>{approved}</strong><span>Ready for final custody checks</span></article>
      <article className="candidate"><small>Available candidates</small><strong>{candidates.length}</strong><span>No active disposal workflow</span></article>
      <article className="recovery"><small>Recorded recovery</small><strong>{money(recovered)}</strong><span>Proceeds from completed disposals</span></article>
    </section>

    <section className="disposal-commandbar">
      <div className="disposal-tabs">
        {[['queue', 'Workflow queue', disposalActions.length], ['candidates', 'Candidates', candidates.length], ['archive', 'Disposed archive', disposedItems.length]].map(([key, label, count]) => <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setPage(1); }}>{label}<b>{count}</b></button>)}
      </div>
      {tab === 'queue' && <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter disposal workflows by status"><option>All statuses</option><option>Pending approval</option><option>Approved</option><option>Rejected</option><option>Completed</option><option>Cancelled</option></select>}
      <span>{term ? `Filtered by “${query}”` : 'Search using the bar above'}</span>
    </section>

    {tab === 'queue' && <section className="disposal-list">
      {pagedActions.map((action) => <article key={action.id} className="disposal-workflow-card">
        <div className="disposal-card-stripe" data-status={statusClass(action.status)} />
        <button type="button" className="disposal-asset" onClick={() => onOpenItem(action.itemId)}><span style={thumbStyle(items.find((item) => item.id === action.itemId)?.model, 54, 10)} /><span><small>{action.itemTag}</small><strong>{action.itemName}</strong><em>{action.recordedLocation || 'Location unavailable'} · {action.itemSerial || 'No serial'}</em></span></button>
        <div className="disposal-workflow"><span className={`disposal-status disposal-status--${statusClass(action.status)}`}>{action.status}</span><strong>{action.type} · {action.disposalMethod || 'Method pending'}</strong><p>{action.justification || 'No justification recorded'}</p></div>
        <div className="disposal-custody"><small>Custody / recovery</small><strong>{action.vendor || action.recipient || 'Not recorded'}</strong><span>{money(action.proceeds || 0)} · Effective {dateLabel(action.effectiveDate)}</span></div>
        <div className="disposal-actions"><button type="button" onClick={() => { setDocumentPreview(null); setDocumentMessage(''); setSelectedAction(action); }}>View details</button>{canApprove && action.status === 'Pending approval' && <button type="button" className="approve" onClick={() => { setSelectedAction(action); setDecision('Approved'); }}>Review</button>}{canApprove && action.status === 'Approved' && <button type="button" className="complete" onClick={() => onComplete(action.id)}>Complete</button>}{canManage && action.status === 'Pending approval' && <button type="button" className="cancel" onClick={() => onCancel(action.id)}>Cancel</button>}</div>
      </article>)}
      {!disposalActions.length && <EmptyState title="No disposal workflows here" text="Create a controlled disposal request from the candidate list or change the status filter." />}
    </section>}

    {tab === 'candidates' && <section className="disposal-candidate-grid">
      {pagedCandidates.map((item) => { const state = readiness(item); return <article key={item.id} data-stocktake-state={item.stocktakeState || undefined}>
        <StocktakeFlag item={item} />
        <div className="disposal-candidate-preview"><span style={thumbStyle(item.model, 86, 15)} /><span className={`disposal-readiness disposal-readiness--${state.tone}`}>{state.label}</span></div>
        <div className="disposal-candidate-copy"><small>{item.tag}</small><h3>{item.name}</h3><p>{state.note}</p><dl><div><dt>Location</dt><dd>{item.location} · {item.room}</dd></div><div><dt>Condition</dt><dd>{item.condition || 'Not recorded'}</dd></div><div><dt>Book cost</dt><dd>{money(item.cost || 0)}</dd></div></dl></div>
        <footer><button type="button" onClick={() => onOpenItem(item.id)}>View asset</button>{canManage && <button type="button" className="primary" onClick={() => openRequest(item.id)}>Start disposal</button>}</footer>
      </article>; })}
      {!candidates.length && <EmptyState title="No available candidates" text="Every matching asset is retired, archived, or already has an active lifecycle workflow." />}
    </section>}

    {tab === 'archive' && <section className="disposal-archive">
      <header><span>Asset</span><span>Disposition</span><span>Recipient / vendor</span><span>Completed</span><span>Recovery</span><span /></header>
      {pagedDisposedItems.map((item) => <div key={item.id}><span className="archive-asset"><i style={thumbStyle(item.model, 38, 7)} /><b>{item.name}<small>{item.tag}</small></b></span><span><b>{item.dispositionType}</b><small>{item.dispositionReference}</small></span><span>{item.dispositionRecipient || 'Not recorded'}</span><span>{dateLabel(item.dispositionDate)}</span><span>{money(item.dispositionProceeds || 0)}</span><button type="button" onClick={() => onOpenItem(item.id)}>Open record</button></div>)}
      {!disposedItems.length && <EmptyState title="No completed disposals" text="Completed workflows will remain here as the permanent disposal register." />}
    </section>}

    {pageCount > 1 && <nav className="disposal-pagination" aria-label="Disposal page navigation"><span>Showing {pageStart + 1}–{Math.min(pageStart + pageSize, currentRows.length)} of {currentRows.length}</span><div><button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button><b>Page {page} of {pageCount}</b><button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</button></div></nav>}

    {requestOpen && <Modal onClose={discardRequest} wide><header className="disposal-modal-header"><div><span>New controlled workflow</span><h2>Request asset disposal</h2><p>All required custody and authorization details stay with the permanent asset record.</p></div><button type="button" disabled={filesBusy} onClick={discardRequest} aria-label="Close">×</button></header><div className="disposal-form">
      <label className="full"><span>Asset</span><div className="disposal-asset-picker"><div><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input value={assetSearch} onChange={(event) => { const value = event.target.value; setAssetSearch(value); const selected = candidates.find((item) => item.id === requestForm.itemId); if (selected && value.trim() && !`${selected.tag} ${selected.name} ${selected.serial || ''}`.toLowerCase().includes(value.trim().toLowerCase())) setRequestForm((form) => ({ ...form, itemId: '' })); }} placeholder="Search by item tag, asset name, or serial number…" aria-label="Search disposal assets by item tag" />{assetSearch && <button type="button" onClick={() => setAssetSearch('')} aria-label="Clear asset search">×</button>}</div><select value={requestForm.itemId} onChange={(event) => setRequestForm((form) => ({ ...form, itemId: event.target.value }))}><option value="">{requestCandidates.length ? `Choose from ${requestCandidates.length} matching asset${requestCandidates.length === 1 ? '' : 's'}…` : 'No matching assets'}</option>{requestCandidates.map((item) => <option key={item.id} value={item.id}>{item.tag} · {item.name} · {item.serial || 'No serial'} · {item.location}</option>)}</select><small>{assetSearch ? 'Results update as you type the item tag.' : `${candidates.length} available disposal candidates`}</small></div></label>
      <label><span>Disposition type</span><select value={requestForm.type} onChange={(event) => setRequestForm((form) => ({ ...form, type: event.target.value }))}>{DISPOSAL_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label><span>Proposed effective date</span><input type="date" value={requestForm.effectiveDate} onChange={(event) => setRequestForm((form) => ({ ...form, effectiveDate: event.target.value }))} /></label>
      <label><span>Disposal method</span><select value={requestForm.disposalMethod} onChange={(event) => setRequestForm((form) => ({ ...form, disposalMethod: event.target.value }))}>{DISPOSAL_METHODS.map((method) => <option key={method}>{method}</option>)}</select></label>
      <label><span>Vendor / receiving organization</span><input value={requestForm.vendor} onChange={(event) => setRequestForm((form) => ({ ...form, vendor: event.target.value }))} placeholder="Company or organization" /></label>
      <label><span>Custodian / recipient</span><input value={requestForm.recipient} onChange={(event) => setRequestForm((form) => ({ ...form, recipient: event.target.value }))} placeholder="Named recipient" /></label>
      <label><span>Authorization / incident reference</span><input value={requestForm.incidentReference} onChange={(event) => setRequestForm((form) => ({ ...form, incidentReference: event.target.value }))} placeholder="Memo, incident or certificate number" /></label>
      <label><span>Expected proceeds / recovery</span><input type="number" min="0" value={requestForm.proceeds} onChange={(event) => setRequestForm((form) => ({ ...form, proceeds: event.target.value }))} /></label>
      <label className="full"><span>Business justification</span><textarea rows="4" value={requestForm.justification} onChange={(event) => setRequestForm((form) => ({ ...form, justification: event.target.value }))} placeholder="Explain why this asset should leave service and how the decision was assessed." /></label>
      <label className="full"><span>Data sanitization and custody controls</span><textarea rows="3" value={requestForm.dataSanitization} onChange={(event) => setRequestForm((form) => ({ ...form, dataSanitization: event.target.value }))} placeholder="Drive wiping, certificate of destruction, chain of custody, accessories removed…" /></label>
      <label className="full disposal-upload"><span>Supporting documents</span><input type="file" multiple disabled={filesBusy} accept="image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx" onChange={selectDocuments} /><small>{filesBusy ? 'Securing uploaded files…' : 'Up to four files. Images and PDFs can be previewed from View Details; Office files can be downloaded.'}</small></label>
      {!!requestForm.documents.length && <div className="disposal-files full">{requestForm.documents.map((file) => <span key={file.id}><b>{file.name}</b><small>{fileSizeLabel(file.size)}</small></span>)}</div>}
      {requestError && <div className="disposal-form-error full">{requestError}</div>}
    </div><footer className="disposal-modal-footer"><button type="button" onClick={discardRequest}>Cancel</button><button type="button" className="primary" disabled={filesBusy} onClick={saveRequest}>{filesBusy ? 'Storing documents…' : 'Submit for approval'}</button></footer></Modal>}

    {selectedAction && !decision && <Modal onClose={() => { setDocumentPreview(null); setSelectedAction(null); }} wide><header className="disposal-modal-header disposal-modal-header--detail"><div><span>{selectedAction.id}</span><h2>{selectedAction.itemName}</h2><p>{selectedAction.itemTag} · {selectedAction.type} workflow</p></div><span className={`disposal-status disposal-status--${statusClass(selectedAction.status)}`}>{selectedAction.status}</span><button type="button" onClick={() => { setDocumentPreview(null); setSelectedAction(null); }} aria-label="Close">×</button></header><div className="disposal-detail-grid">
      {[['Requested by', selectedAction.requestedBy], ['Requested', dateLabel(selectedAction.requestedAt)], ['Effective date', dateLabel(selectedAction.effectiveDate)], ['Method', selectedAction.disposalMethod], ['Vendor', selectedAction.vendor], ['Recipient', selectedAction.recipient], ['Reference', selectedAction.incidentReference], ['Recovery value', money(selectedAction.proceeds || 0)]].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value || 'Not recorded'}</strong></div>)}
      <section><small>Business justification</small><p>{selectedAction.justification || 'Not recorded'}</p></section><section><small>Data sanitization / custody controls</small><p>{selectedAction.dataSanitization || 'Not recorded'}</p></section>
      <section className="full disposal-detail-documents"><header><span><small>Supporting documents</small><strong>{(selectedAction.documents || []).length} uploaded file{(selectedAction.documents || []).length === 1 ? '' : 's'}</strong></span>{documentPreview && <button type="button" onClick={() => setDocumentPreview(null)}>Close preview</button>}</header>
        {!!(selectedAction.documents || []).length ? <div className="disposal-document-list">{selectedAction.documents.map((file) => <article key={file.id}><span className="disposal-document-icon">{file.type === 'application/pdf' ? 'PDF' : /^image\//.test(file.type || '') ? 'IMG' : 'DOC'}</span><span><strong>{file.name}</strong><small>{fileSizeLabel(file.size)} · {file.type || 'Unknown file type'}</small></span><div>{previewableFile(file) && <button type="button" onClick={() => viewDocument(file)}>View</button>}<button type="button" className="download" onClick={() => downloadDocument(file)}>Download</button></div></article>)}</div> : <p className="disposal-document-empty">No supporting documents were uploaded with this request.</p>}
        {documentMessage && <div className="disposal-document-message">{documentMessage}</div>}
        {documentPreview && <div className="disposal-document-preview"><header><span><strong>{documentPreview.file.name}</strong><small>{fileSizeLabel(documentPreview.file.size)}</small></span><button type="button" onClick={() => downloadDocument(documentPreview.file)}>Download</button></header>{documentPreview.file.type === 'application/pdf' ? <iframe src={documentPreview.url} title={`Preview ${documentPreview.file.name}`} /> : <img src={documentPreview.url} alt={`Preview of ${documentPreview.file.name}`} />}</div>}
      </section>
      <section className="full"><small>Workflow activity</small><ol>{(selectedAction.activity || []).map((entry, index) => <li key={`${entry.at}-${index}`}><i /><span><strong>{entry.text}</strong><small>{dateLabel(entry.at)} · {entry.by}</small></span></li>)}</ol></section>
    </div><footer className="disposal-modal-footer"><button type="button" onClick={() => { setDocumentPreview(null); setSelectedAction(null); }}>Close</button>{canApprove && selectedAction.status === 'Pending approval' && <><button type="button" className="danger" onClick={() => { setDocumentPreview(null); setDecision('Rejected'); }}>Reject</button><button type="button" className="primary" onClick={() => { setDocumentPreview(null); setDecision('Approved'); }}>Approve</button></>}{canApprove && selectedAction.status === 'Approved' && <button type="button" className="primary" onClick={() => { if (onComplete(selectedAction.id)) { setDocumentPreview(null); setSelectedAction(null); } }}>Complete disposal</button>}</footer></Modal>}

    {selectedAction && decision && <Modal onClose={() => { setDecision(null); setDecisionNote(''); }}><header className="disposal-modal-header"><div><span>Management decision</span><h2>{decision === 'Approved' ? 'Approve disposal' : 'Reject disposal'}</h2><p>{selectedAction.itemName} · {selectedAction.itemTag}</p></div><button type="button" onClick={() => setDecision(null)} aria-label="Close">×</button></header><div className="disposal-decision"><label><span>Decision note {decision === 'Rejected' ? '(required)' : '(optional)'}</span><textarea rows="5" value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder={decision === 'Rejected' ? 'Explain why this request cannot proceed.' : 'Record approval conditions or custody instructions.'} /></label>{decision === 'Rejected' && !decisionNote.trim() && <small>A rejection reason is required.</small>}</div><footer className="disposal-modal-footer"><button type="button" onClick={() => setDecision(null)}>Back</button><button type="button" className={decision === 'Rejected' ? 'danger' : 'primary'} onClick={submitDecision}>Confirm {decision.toLowerCase()}</button></footer></Modal>}
  </div>;
}
