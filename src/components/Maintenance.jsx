import { useEffect, useMemo, useRef, useState } from 'react';
import { iso, money, thumbStyle, today } from '../data.js';
import { IconX } from '../icons.jsx';
import SortableHeader, { nextSort, sortRows } from './SortableHeader.jsx';
import { generateRepairTicketPdf } from '../repair-ticket-pdf.js';
import MaintenanceEmailModal from './MaintenanceEmailModal.jsx';
import StocktakeFlag from './StocktakeFlag.jsx';

const ACTIVE = ['Open', 'In progress', 'Awaiting vendor'];
const TICKET_STATUSES = [...ACTIVE, 'Completed', 'Cancelled'];
const FREQUENCIES = [['Monthly', 30], ['Quarterly', 90], ['Every 6 months', 182], ['Annual', 365]];
const dateTime = (value) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function ticketTone(status) {
  if (status === 'Completed') return { background: '#e7f4ec', color: '#155e3f' };
  if (status === 'Cancelled') return { background: '#f1f2f4', color: '#5b6672' };
  if (status === 'Awaiting vendor') return { background: '#f4eefa', color: '#684493' };
  if (status === 'In progress') return { background: '#e9effa', color: '#0a3d7c' };
  return { background: '#fdf0e0', color: '#8a5209' };
}

function TicketBadge({ status }) {
  return <span style={{ ...ticketTone(status), padding: '4px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>{status}</span>;
}

function blankTicket(itemId = '', linkedSchedule = null) {
  return {
    itemId, type: linkedSchedule ? 'Preventive maintenance' : 'Repair', priority: linkedSchedule ? 'Routine' : 'Normal',
    status: 'Open', technician: linkedSchedule?.technician || '', faultDescription: linkedSchedule ? `Scheduled preventive maintenance: ${linkedSchedule.instructions || linkedSchedule.title}` : '',
    resolution: '', partsCost: 0, laborCost: 0, vendor: linkedSchedule?.vendor || '', vendorContact: '', rmaNumber: '',
    sentToVendorOn: '', expectedReturnOn: '', returnedOn: '', photos: [], linkedScheduleId: linkedSchedule?.id || ''
  };
}

function blankSchedule(itemId = '') {
  return { itemId, title: '', frequencyLabel: 'Quarterly', frequencyDays: 90, nextDue: iso(new Date(today().getTime() + 90 * 864e5)), reminderEnabled: true, reminderDays: 7, technician: '', vendor: '', instructions: '' };
}

async function readRepairPhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Only image files can be attached.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Each photograph must be smaller than 10 MB.');
  const source = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('The photograph could not be read.')); reader.readAsDataURL(file); });
  const image = await new Promise((resolve, reject) => { const next = new Image(); next.onload = () => resolve(next); next.onerror = () => reject(new Error('The photograph could not be opened.')); next.src = source; });
  const scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return { id: `photo-${Date.now()}-${Math.random().toString(16).slice(2)}`, name: file.name, data: canvas.toDataURL('image/jpeg', .78), addedAt: new Date().toISOString() };
}

export default function Maintenance({ items, tickets, schedules, technicians, emailContacts, sender, query, canManage, createSignal = 0, onCreateSignalHandled, onCreateTicket, onUpdateTicket, onCreateSchedule, onUpdateSchedule, onAddEmailContact, onEmailPrepared, onOpenItem, onAcknowledge }) {
  const [tab, setTab] = useState('tickets');
  const [ticketOpen, setTicketOpen] = useState(false);
  const [editingTicketId, setEditingTicketId] = useState('');
  const [ticketForm, setTicketForm] = useState(blankTicket());
  const [ticketError, setTicketError] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState('');
  const [scheduleForm, setScheduleForm] = useState(blankSchedule());
  const [scheduleError, setScheduleError] = useState('');
  const [ticketSort, setTicketSort] = useState({ key: 'status', direction: 'asc' });
  const [scheduleSort, setScheduleSort] = useState({ key: 'nextService', direction: 'asc' });
  const [ticketFilter, setTicketFilter] = useState('All');
  const [scheduleFilter, setScheduleFilter] = useState('All');
  const [pdfBusyId, setPdfBusyId] = useState('');
  const [emailTicket, setEmailTicket] = useState(null);
  const photoInput = useRef(null);

  const eligibleItems = useMemo(() => items.filter((item) => item.status !== 'Retired' && item.status !== 'On loan').sort((a, b) => a.name.localeCompare(b.name) || a.tag.localeCompare(b.tag)), [items]);
  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const term = (query || '').trim().toLowerCase();
  const visibleTickets = useMemo(() => sortRows(tickets.filter((ticket) => (ticketFilter === 'All' || ticket.status === ticketFilter) && (!term || `${ticket.id} ${ticket.itemName} ${ticket.itemTag} ${ticket.faultDescription} ${ticket.technician} ${ticket.vendor} ${ticket.rmaNumber}`.toLowerCase().includes(term))), ticketSort, { ticket: (row) => `${row.itemName} ${row.id}`, fault: (row) => row.faultDescription, technician: (row) => row.technician, vendor: (row) => row.vendor, cost: (row) => Number(row.partsCost || 0) + Number(row.laborCost || 0), status: (row) => row.status }), [tickets, term, ticketSort, ticketFilter]);
  const visibleSchedules = useMemo(() => sortRows(schedules.filter((schedule) => {
    const due = schedule.active && schedule.nextDue <= iso(today());
    const matchesFilter = scheduleFilter === 'All' || (scheduleFilter === 'Due' ? due : scheduleFilter === 'Active' ? schedule.active && !due : !schedule.active);
    return matchesFilter && (!term || `${schedule.title} ${schedule.itemName} ${schedule.itemTag} ${schedule.technician} ${schedule.vendor}`.toLowerCase().includes(term));
  }), scheduleSort, { asset: (row) => `${row.itemName} ${row.title}`, frequency: (row) => Number(row.frequencyDays || 0), nextService: (row) => row.nextDue, technician: (row) => row.technician, instructions: (row) => row.instructions }), [schedules, term, scheduleSort, scheduleFilter]);
  const openTickets = tickets.filter((ticket) => ACTIVE.includes(ticket.status));
  const unavailableAssets = items.filter((item) => item.status === 'Maintenance').length;
  const dueSchedules = schedules.filter((schedule) => schedule.active && schedule.nextDue <= iso(today()));
  const totalSpend = tickets.filter((ticket) => ticket.status === 'Completed').reduce((sum, ticket) => sum + Number(ticket.partsCost || 0) + Number(ticket.laborCost || 0), 0);

  const openNewTicket = (schedule = null) => {
    setEditingTicketId(''); setTicketError(''); setTicketForm(blankTicket(schedule?.itemId || eligibleItems[0]?.id || '', schedule)); setTicketOpen(true);
  };
  useEffect(() => {
    if (createSignal && canManage) { openNewTicket(); onCreateSignalHandled?.(); }
  }, [createSignal]);
  const openTicket = (ticket) => { onAcknowledge?.(ticket.id); setEditingTicketId(ticket.id); setTicketError(''); setTicketForm({ ...blankTicket(ticket.itemId), ...ticket, photos: ticket.photos || [] }); setTicketOpen(true); };
  const saveTicket = () => {
    if (!ticketForm.itemId) { setTicketError('Choose an asset.'); return; }
    if (!ticketForm.faultDescription.trim()) { setTicketError('Describe the fault or maintenance work required.'); return; }
    if (ticketForm.status === 'Completed' && !ticketForm.resolution.trim()) { setTicketError('Enter the completed repair or service resolution.'); return; }
    const clean = { ...ticketForm, partsCost: Math.max(0, Number(ticketForm.partsCost) || 0), laborCost: Math.max(0, Number(ticketForm.laborCost) || 0) };
    const saved = editingTicketId ? onUpdateTicket(editingTicketId, clean) : onCreateTicket(clean);
    if (saved !== false && saved !== null) setTicketOpen(false);
  };
  const addPhotos = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, Math.max(0, 6 - ticketForm.photos.length));
    try {
      const photos = await Promise.all(files.map(readRepairPhoto));
      setTicketForm((current) => ({ ...current, photos: [...current.photos, ...photos].slice(0, 6) }));
    } catch (error) { setTicketError(error.message); }
    event.target.value = '';
  };
  const saveSchedule = () => {
    if (!scheduleForm.itemId) { setScheduleError('Choose an asset.'); return; }
    if (!scheduleForm.title.trim()) { setScheduleError('Enter a schedule name.'); return; }
    if (!scheduleForm.nextDue) { setScheduleError('Choose the next service date.'); return; }
    if (editingScheduleId) onUpdateSchedule(editingScheduleId, scheduleForm); else onCreateSchedule(scheduleForm);
    setScheduleOpen(false);
  };
  const previewTicketPdf = async (event, ticket) => {
    event.stopPropagation();
    if (pdfBusyId) return;
    setPdfBusyId(ticket.id);
    try {
      await generateRepairTicketPdf(ticket, { preview: true });
    } catch (error) {
      window.alert(`The repair ticket PDF could not be opened. ${error?.message || 'Please try again.'}`);
    } finally {
      setPdfBusyId('');
    }
  };

  return (
    <div className="maintenance-workspace">
      <section className="maintenance-overview">
        <div className="maintenance-overview-copy">
          <small>IT SERVICE OPERATIONS</small>
          <h2>Maintenance command center</h2>
          <p>Coordinate internal repairs, vendor work, service costs and preventive care from one operational workspace.</p>
          <div><span><b>{openTickets.length}</b> active ticket{openTickets.length === 1 ? '' : 's'}</span><span><b>{schedules.filter((schedule) => schedule.active).length}</b> active schedules</span><span><b>{technicians.length}</b> available technicians</span></div>
        </div>
        <div className="maintenance-overview-visual" aria-hidden="true">
          <span className="maintenance-gear large">⚙</span><span className="maintenance-gear small">⚙</span>
          <div><small>Service readiness</small><strong>{dueSchedules.length ? 'Action needed' : 'On schedule'}</strong><i data-alert={dueSchedules.length ? 'true' : 'false'}>{dueSchedules.length ? `${dueSchedules.length} overdue` : 'No overdue service'}</i></div>
        </div>
      </section>

      <section className="maintenance-metrics">
        {[
          ['tool', 'Unavailable for repair', unavailableAssets, 'Assets currently in maintenance', 'amber'],
          ['vendor', 'Awaiting vendor', openTickets.filter((ticket) => ticket.status === 'Awaiting vendor').length, 'External repair or RMA work', 'purple'],
          ['calendar', 'Preventive service due', dueSchedules.length, 'Schedules at or past due', 'red'],
          ['cost', 'Completed service cost', money(totalSpend), 'Recorded parts and labor', 'blue']
        ].map(([icon, label, value, note, tone]) => <article key={label} data-tone={tone}><span className="maintenance-metric-icon" data-icon={icon} /><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div><i>View in workspace</i></article>)}
      </section>

      <section className="maintenance-toolbar">
        <div className="maintenance-tabs">
          <button type="button" data-active={tab === 'tickets'} onClick={() => setTab('tickets')}><span>Repair tickets</span><b>{tickets.length}</b></button>
          <button type="button" data-active={tab === 'schedules'} onClick={() => setTab('schedules')}><span>Preventive schedules</span><b>{schedules.length}</b></button>
        </div>
        <div className="maintenance-filter-pills">
          {(tab === 'tickets' ? ['All', ...TICKET_STATUSES] : ['All', 'Due', 'Active', 'Paused']).map((value) => <button key={value} type="button" data-active={(tab === 'tickets' ? ticketFilter : scheduleFilter) === value} onClick={() => tab === 'tickets' ? setTicketFilter(value) : setScheduleFilter(value)}>{value}</button>)}
        </div>
        <span className="maintenance-result-count">{tab === 'tickets' ? `${visibleTickets.length} repair record${visibleTickets.length === 1 ? '' : 's'}` : `${visibleSchedules.length} maintenance schedule${visibleSchedules.length === 1 ? '' : 's'}`}</span>
        {canManage && tab === 'tickets' && <button type="button" className="btn-primary maintenance-create-button" onClick={() => openNewTicket()}>+ New repair ticket</button>}
        {canManage && tab === 'schedules' && <button type="button" className="btn-primary maintenance-create-button schedule" onClick={() => { setEditingScheduleId(''); setScheduleForm(blankSchedule(eligibleItems[0]?.id || '')); setScheduleError(''); setScheduleOpen(true); }}>+ New schedule</button>}
      </section>

      {tab === 'tickets' ? <div className="maintenance-table-card">
        <div className="maintenance-table-head" style={tableGrid}>{[['ticket', 'Ticket / asset'], ['fault', 'Fault or service'], ['technician', 'Technician'], ['vendor', 'Vendor / RMA'], ['cost', 'Cost'], ['status', 'Status / document']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={ticketSort} onSort={(key) => setTicketSort((current) => nextSort(current, key))} />)}</div>
        {visibleTickets.map((ticket) => { const item = itemMap.get(ticket.itemId); return <div className="maintenance-ticket-row" data-priority={ticket.priority} data-status={ticket.status} data-workflow-unread={ticket.workflowUnread ? 'true' : undefined} data-stocktake-state={item?.stocktakeState || undefined} key={ticket.id} role="button" tabIndex={0} onClick={() => openTicket(ticket)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openTicket(ticket); } }} style={tableGrid}>
          <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 9 }}>{item && <span style={thumbStyle(item.model, 30, 5)} />}<span style={{ minWidth: 0 }}><strong style={{ display: 'block', fontSize: 12 }}>{ticket.itemName}<StocktakeFlag item={item} />{ticket.workflowUnread && <i className="workflow-item-dot" title="New workflow item" />}</strong><small style={{ color: '#0b4a94', fontFamily: "'IBM Plex Mono',monospace" }}>{ticket.id} · {ticket.itemTag}</small></span></span>
          <span style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }}>{ticket.faultDescription}</strong><small style={{ color: '#7b8794' }}>{ticket.type} · {ticket.priority} priority</small></span>
          <span style={{ color: '#566472', fontSize: 11.5 }}>{ticket.technician || 'Unassigned'}</span>
          <span style={{ color: '#566472', fontSize: 11.5 }}>{ticket.vendor || 'Internal repair'}<small style={{ display: 'block', color: '#7b8794' }}>{ticket.rmaNumber ? `RMA ${ticket.rmaNumber}` : 'No RMA'}</small></span>
          <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>{money(Number(ticket.partsCost || 0) + Number(ticket.laborCost || 0))}</span><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TicketBadge status={ticket.status} /><button type="button" className="btn-ghost" disabled={!!pdfBusyId} onClick={(event) => previewTicketPdf(event, ticket)} style={{ height: 29, padding: '0 8px', borderRadius: 7, color: '#0a3d7c', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{pdfBusyId === ticket.id ? 'Opening…' : 'PDF'}</button><button type="button" className="maintenance-email-button" onClick={(event) => { event.stopPropagation(); setEmailTicket({ ...ticket, itemLocation: ticket.itemLocation || item?.location, itemRoom: ticket.itemRoom || item?.room }); }}>Outlook</button></span>
        </div>; })}
        {!visibleTickets.length && <div style={emptyStyle}>No repair tickets match this view.</div>}
      </div> : <div className="maintenance-table-card">
        <div className="maintenance-table-head" style={scheduleGrid}>{[['asset', 'Asset / schedule'], ['frequency', 'Frequency'], ['nextService', 'Next service'], ['technician', 'Technician'], ['instructions', 'Instructions']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={scheduleSort} onSort={(key) => setScheduleSort((current) => nextSort(current, key))} />)}<span>Actions</span></div>
        {visibleSchedules.map((schedule) => { const due = schedule.active && schedule.nextDue <= iso(today()); return <div className="maintenance-schedule-row" data-due={due ? 'true' : 'false'} data-active={schedule.active ? 'true' : 'false'} key={schedule.id} style={scheduleGrid}>
          <button type="button" onClick={() => onOpenItem(schedule.itemId)} style={{ padding: 0, background: 'none', border: 0, textAlign: 'left', cursor: 'pointer' }}><strong style={{ display: 'block', fontSize: 12 }}>{schedule.itemName}</strong><small style={{ color: '#0b4a94', fontFamily: "'IBM Plex Mono',monospace" }}>{schedule.itemTag} · {schedule.title}</small></button>
          <span style={{ fontSize: 11.5 }}>{schedule.frequencyLabel}<small style={{ display: 'block', color: schedule.reminderEnabled === false ? '#8b96a1' : '#08775c' }}>{schedule.reminderEnabled === false ? 'Reminder off' : `${schedule.reminderDays || 7}-day reminder`}</small></span><span><strong style={{ color: due ? '#b3261e' : '#33414e', fontSize: 11.5 }}>{schedule.nextDue}</strong><small style={{ display: 'block', color: due ? '#b3261e' : '#7b8794' }}>{due ? 'Service due' : schedule.lastCompletedAt ? `Last: ${dateTime(schedule.lastCompletedAt)}` : 'Not serviced yet'}</small></span>
          <span style={{ fontSize: 11.5 }}>{schedule.technician || 'Unassigned'}</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#65717d', fontSize: 11.5 }}>{schedule.instructions || 'No instructions'}</span>
          <span style={{ display: 'flex', gap: 6 }}>{canManage && schedule.active && <button type="button" className="btn-ghost" onClick={() => openNewTicket(schedule)} style={smallButton}>{due ? 'Start due service' : 'Start service'}</button>}{canManage && <button type="button" className="btn-ghost" onClick={() => { setEditingScheduleId(schedule.id); setScheduleForm({ ...blankSchedule(schedule.itemId), ...schedule }); setScheduleError(''); setScheduleOpen(true); }} style={smallButton}>Edit</button>}{canManage && <button type="button" className="btn-ghost" onClick={() => onUpdateSchedule(schedule.id, { active: !schedule.active })} style={smallButton}>{schedule.active ? 'Pause' : 'Resume'}</button>}</span>
        </div>; })}
        {!visibleSchedules.length && <div style={emptyStyle}>No preventive-maintenance schedules match this view.</div>}
      </div>}

      {ticketOpen && <div style={backdrop} role="dialog" aria-modal="true" aria-label={editingTicketId ? `Repair ticket ${editingTicketId}` : 'New repair ticket'}><div style={{ ...modalCard, width: 'min(980px,100%)' }}>
        <div style={modalHeader}><span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 15 }}>{editingTicketId ? `Repair ticket ${editingTicketId}` : 'New repair ticket'}</strong><small style={{ color: '#7b8794' }}>Fault, assignment, vendor, costs, photographs, and resolution</small></span><button type="button" className="btn-ghost" onClick={() => setTicketOpen(false)} style={closeButton}><IconX /></button></div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, overflowY: 'auto' }}>
          <section style={formSection}><h3>Repair details</h3>
            <label style={labelStyle}>Asset<select disabled={!!editingTicketId} value={ticketForm.itemId} onChange={(event) => setTicketForm((current) => ({ ...current, itemId: event.target.value }))} style={inputStyle}>{eligibleItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.tag} · {item.location} {item.room}</option>)}</select></label>
            <div style={twoColumns}><label style={labelStyle}>Work type<select value={ticketForm.type} onChange={setTicketField(setTicketForm, 'type')} style={inputStyle}><option>Repair</option><option>Preventive maintenance</option><option>Inspection</option><option>Warranty service</option></select></label><label style={labelStyle}>Priority<select value={ticketForm.priority} onChange={setTicketField(setTicketForm, 'priority')} style={inputStyle}><option>Routine</option><option>Normal</option><option>High</option><option>Critical</option></select></label></div>
            <label style={labelStyle}>Fault or required work<textarea value={ticketForm.faultDescription} onChange={setTicketField(setTicketForm, 'faultDescription')} rows="4" style={textareaStyle} /></label>
            <div style={twoColumns}><label style={labelStyle}>Assigned Systems administrator<select value={ticketForm.technician} onChange={setTicketField(setTicketForm, 'technician')} style={inputStyle}><option value="">Unassigned</option>{technicians.map((name) => <option key={name}>{name}</option>)}</select></label><label style={labelStyle}>Status<select value={ticketForm.status} onChange={setTicketField(setTicketForm, 'status')} style={inputStyle}>{TICKET_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label></div>
            <label style={labelStyle}>Resolution / work completed<textarea value={ticketForm.resolution} onChange={setTicketField(setTicketForm, 'resolution')} rows="3" placeholder="Required when completing the ticket" style={textareaStyle} /></label>
          </section>
          <section style={formSection}><h3>Vendor, RMA and cost</h3>
            <div style={twoColumns}><label style={labelStyle}>Repair vendor<input value={ticketForm.vendor} onChange={setTicketField(setTicketForm, 'vendor')} style={inputStyle} /></label><label style={labelStyle}>Vendor contact<input value={ticketForm.vendorContact} onChange={setTicketField(setTicketForm, 'vendorContact')} style={inputStyle} /></label></div>
            <label style={labelStyle}>RMA / repair reference<input value={ticketForm.rmaNumber} onChange={setTicketField(setTicketForm, 'rmaNumber')} style={inputStyle} /></label>
            <div style={threeColumns}><label style={labelStyle}>Sent to vendor<input type="date" value={ticketForm.sentToVendorOn} onChange={setTicketField(setTicketForm, 'sentToVendorOn')} style={inputStyle} /></label><label style={labelStyle}>Expected return<input type="date" value={ticketForm.expectedReturnOn} onChange={setTicketField(setTicketForm, 'expectedReturnOn')} style={inputStyle} /></label><label style={labelStyle}>Returned<input type="date" value={ticketForm.returnedOn} onChange={setTicketField(setTicketForm, 'returnedOn')} style={inputStyle} /></label></div>
            <div style={twoColumns}><label style={labelStyle}>Parts cost<input type="number" min="0" step="0.01" value={ticketForm.partsCost} onChange={setTicketField(setTicketForm, 'partsCost')} style={inputStyle} /></label><label style={labelStyle}>Labor cost<input type="number" min="0" step="0.01" value={ticketForm.laborCost} onChange={setTicketField(setTicketForm, 'laborCost')} style={inputStyle} /></label></div>
            <div style={{ padding: 10, display: 'flex', justifyContent: 'space-between', background: '#eef4fb', borderRadius: 8, color: '#0a3d7c', fontSize: 12 }}><span>Total repair cost</span><strong>{money(Number(ticketForm.partsCost || 0) + Number(ticketForm.laborCost || 0))}</strong></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><strong style={{ flex: 1, fontSize: 12 }}>Fault photographs</strong><input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={addPhotos} /><button type="button" className="btn-ghost" disabled={ticketForm.photos.length >= 6} onClick={() => photoInput.current?.click()} style={smallButton}>+ Add photographs</button></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>{ticketForm.photos.map((photo) => <span key={photo.id} style={{ position: 'relative', height: 92, overflow: 'hidden', border: '1px solid #dce3ea', borderRadius: 7 }}><img src={photo.data} alt={photo.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />{canManage && <button type="button" onClick={() => setTicketForm((current) => ({ ...current, photos: current.photos.filter((entry) => entry.id !== photo.id) }))} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, border: 0, borderRadius: 999, background: 'rgba(20,25,31,.78)', color: '#fff', cursor: 'pointer' }}>×</button>}</span>)}</div>
          </section>
          {editingTicketId && <section style={{ ...formSection, gridColumn: '1 / -1' }}><h3>Ticket activity</h3><div style={{ display: 'flex', flexDirection: 'column' }}>{(ticketForm.activity || []).slice().reverse().map((entry, index) => <div key={`${entry.at}-${index}`} style={{ padding: '8px 0', display: 'grid', gridTemplateColumns: '150px 150px 1fr', borderTop: '1px solid #edf0f3', fontSize: 11.5 }}><span style={{ color: '#6d7985' }}>{dateTime(entry.at)}</span><strong>{entry.by}</strong><span>{entry.text}</span></div>)}</div></section>}
        </div>
        <div style={modalFooter}>{ticketError && <span style={{ flex: 1, color: '#a01a12', fontSize: 11.5 }}>{ticketError}</span>}<button type="button" className="btn-ghost" onClick={() => setTicketOpen(false)} style={secondaryButton}>Cancel</button>{canManage && <button type="button" className="btn-primary" onClick={saveTicket} style={primaryButton}>{editingTicketId ? 'Save ticket' : 'Create ticket'}</button>}</div>
      </div></div>}

      {scheduleOpen && <div style={backdrop} role="dialog" aria-modal="true" aria-label={editingScheduleId ? 'Edit preventive-maintenance schedule' : 'New preventive-maintenance schedule'}><div style={{ ...modalCard, width: 'min(650px,100%)' }}><div style={modalHeader}><span style={{ flex: 1 }}><strong style={{ display: 'block', fontSize: 15 }}>{editingScheduleId ? 'Edit preventive-maintenance schedule' : 'New preventive-maintenance schedule'}</strong><small style={{ color: '#7b8794' }}>Plan recurring inspection and servicing</small></span><button type="button" className="btn-ghost" onClick={() => setScheduleOpen(false)} style={closeButton}><IconX /></button></div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}><label style={labelStyle}>Asset<select disabled={!!editingScheduleId} value={scheduleForm.itemId} onChange={setScheduleField(setScheduleForm, 'itemId')} style={inputStyle}>{items.filter((item) => item.status !== 'Retired').map((item) => <option key={item.id} value={item.id}>{item.name} · {item.tag}</option>)}</select></label><label style={labelStyle}>Schedule name<input value={scheduleForm.title} onChange={setScheduleField(setScheduleForm, 'title')} placeholder="Example: Quarterly projector cleaning" style={inputStyle} /></label>
          <div style={twoColumns}><label style={labelStyle}>Frequency<select value={scheduleForm.frequencyDays} onChange={(event) => { const days = Number(event.target.value); const label = FREQUENCIES.find((entry) => entry[1] === days)?.[0] || 'Custom'; setScheduleForm((current) => ({ ...current, frequencyDays: days, frequencyLabel: label })); }} style={inputStyle}>{FREQUENCIES.map(([label, days]) => <option key={days} value={days}>{label}</option>)}</select></label><label style={labelStyle}>Next service date<input type="date" value={scheduleForm.nextDue} onChange={setScheduleField(setScheduleForm, 'nextDue')} style={inputStyle} /></label></div>
          <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1.5fr 1fr', alignItems: 'center', gap: 12, border: '1px solid #cfe7df', borderRadius: 10, background: '#f2faf7' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#214b3f', fontSize: 12, fontWeight: 700 }}><input type="checkbox" checked={scheduleForm.reminderEnabled !== false} onChange={(event) => setScheduleForm((current) => ({ ...current, reminderEnabled: event.target.checked }))} />Advance maintenance notification<span style={{ display: 'block', color: '#678077', fontSize: 10.5, fontWeight: 500 }}>Saved reminder records are retained for one year.</span></label>
            <label style={labelStyle}>Notify before due date<select disabled={scheduleForm.reminderEnabled === false} value={scheduleForm.reminderDays || 7} onChange={(event) => setScheduleForm((current) => ({ ...current, reminderDays: Number(event.target.value) }))} style={inputStyle}>{[1, 3, 7, 14, 30].map((days) => <option key={days} value={days}>{days} day{days === 1 ? '' : 's'} before</option>)}</select></label>
          </div>
          <div style={twoColumns}><label style={labelStyle}>Preferred technician<select value={scheduleForm.technician} onChange={setScheduleField(setScheduleForm, 'technician')} style={inputStyle}><option value="">Unassigned</option>{technicians.map((name) => <option key={name}>{name}</option>)}</select></label><label style={labelStyle}>Preferred vendor<input value={scheduleForm.vendor} onChange={setScheduleField(setScheduleForm, 'vendor')} style={inputStyle} /></label></div>
          <label style={labelStyle}>Service instructions<textarea value={scheduleForm.instructions} onChange={setScheduleField(setScheduleForm, 'instructions')} rows="4" style={textareaStyle} /></label></div>
        <div style={modalFooter}>{scheduleError && <span style={{ flex: 1, color: '#a01a12', fontSize: 11.5 }}>{scheduleError}</span>}<button type="button" className="btn-ghost" onClick={() => setScheduleOpen(false)} style={secondaryButton}>Cancel</button><button type="button" className="btn-primary" onClick={saveSchedule} style={primaryButton}>{editingScheduleId ? 'Save schedule' : 'Create schedule'}</button></div>
      </div></div>}
      {emailTicket && <MaintenanceEmailModal ticket={emailTicket} sender={sender} contacts={emailContacts} onAddContact={onAddEmailContact} onPrepared={(details) => onEmailPrepared?.(emailTicket.id, details)} onClose={() => setEmailTicket(null)} />}
    </div>
  );
}

const setTicketField = (setter, key) => (event) => setter((current) => ({ ...current, [key]: event.target.value }));
const setScheduleField = setTicketField;
const tabButton = (active) => ({ height: 35, padding: '0 13px', border: 0, background: active ? '#0a3d7c' : '#fff', color: active ? '#fff' : '#5c6874', fontSize: 12, fontWeight: 650, cursor: 'pointer' });
const primaryButton = { height: 36, padding: '0 14px', borderRadius: 8, fontSize: 12, fontWeight: 650 };
const secondaryButton = { height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12 };
const smallButton = { height: 30, padding: '0 9px', borderRadius: 7, fontSize: 10.5 };
const tableCard = { background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' };
const tableGrid = { padding: '11px 14px', display: 'grid', gridTemplateColumns: '1.35fr 1.7fr .85fr .9fr .55fr 1.15fr', gap: 12 };
const scheduleGrid = { padding: '11px 14px', display: 'grid', gridTemplateColumns: '1.35fr .65fr .9fr .85fr 1.2fr 1fr', gap: 12 };
const emptyStyle = { padding: 42, textAlign: 'center', color: '#7b8794', fontSize: 12.5 };
const backdrop = { position: 'fixed', inset: 0, zIndex: 720, padding: 24, display: 'grid', placeItems: 'center', overflow: 'hidden', overscrollBehavior: 'contain', background: 'rgba(13,17,22,.55)' };
const modalCard = { maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', borderRadius: 12, boxShadow: '0 24px 70px rgba(13,17,22,.25)' };
const modalHeader = { padding: '14px 17px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e5e9ed' };
const modalFooter = { padding: '13px 17px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 9, borderTop: '1px solid #e5e9ed' };
const closeButton = { width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8 };
const formSection = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 11 };
const labelStyle = { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5, color: '#62707d', fontSize: 10.5, fontWeight: 650 };
const inputStyle = { boxSizing: 'border-box', width: '100%', height: 36, padding: '0 9px', background: '#fff', border: '1px solid #cbd5df', borderRadius: 8, color: '#263746', fontSize: 11.5 };
const textareaStyle = { ...inputStyle, height: 'auto', padding: 9, resize: 'vertical', fontFamily: 'inherit' };
const twoColumns = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const threeColumns = { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 };
