import { useMemo, useState } from 'react';
import { LABELS, NAV, roleTagStyle } from '../data.js';
import { IconPlus, IconX } from '../icons.jsx';
import { ProfileAvatar, ProfilePhotoControl } from './ProfileAvatar.jsx';
import SortableHeader, { compareSortValues, nextSort } from './SortableHeader.jsx';
import AuditLog from './AuditLog.jsx';
import RoleAccess from './RoleAccess.jsx';

const ROLE_SUMMARY = {
  Admin: 'Full control of inventory, users, orders, loans, reports, and system activity.',
  'Student assistant': 'Operational access for inventory handling, loans, scanning, orders, and intake.',
  Auditor: 'Read-only access to inventory records, history, procurement, intake, and reports.',
  Staff: 'Can browse inventory, request equipment, and review their loan history.'
};

export default function Users({ accounts, userState, navConfig = NAV, auditEntries = [], activeSection = null, hideNavigation = false, onAccessChange, onToggle, onUpdateProfile, onCreateAccount, onResetPassword }) {
  const [localActiveTab, setLocalActiveTab] = useState('accounts');
  const activeTab = activeSection || localActiveTab;
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [editError, setEditError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState({});
  const [createError, setCreateError] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('All buildings');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const selected = accounts.find((account) => account.email === selectedEmail) || null;
  const buildingOf = (account) => (account.office || '').split('·')[0].trim() || 'Unassigned';
  const buildings = useMemo(() => Array.from(new Set(accounts.map(buildingOf))).sort(), [accounts]);
  const roleGroups = useMemo(() => Object.keys(NAV).map((role) => ({
    role,
    accounts: accounts
      .filter((account) => account.role === role && (buildingFilter === 'All buildings' || buildingOf(account) === buildingFilter))
      .sort((a, b) => {
        const values = { name: (row) => row.name, email: (row) => row.email, role: (row) => row.role, building: buildingOf, lastSeen: (row) => row.lastSeen || '' };
        return compareSortValues(values[sortBy]?.(a), values[sortBy]?.(b)) * (sortDirection === 'desc' ? -1 : 1);
      })
  })).filter((group) => group.accounts.length > 0), [accounts, buildingFilter, sortBy, sortDirection]);
  const headerSort = { key: sortBy, direction: sortDirection };
  const changeSort = (key) => {
    const next = nextSort(headerSort, key);
    setSortBy(next.key);
    setSortDirection(next.direction);
  };

  const openProfile = (email) => { setSelectedEmail(email); setEditing(false); setEditError(''); };
  const startCreating = () => {
    setCreateDraft({
      name: '', email: '', pass: '', role: 'Staff', campusId: '', title: '', department: '',
      phone: '', office: '', manager: '', joined: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), tsr: false
    });
    setCreateError('');
    setCreating(true);
  };
  const saveNewUser = async () => {
    const name = (createDraft.name || '').trim();
    const email = (createDraft.email || '').trim().toLowerCase();
    const password = createDraft.pass || '';
    if (!name) { setCreateError('Full name is required.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setCreateError('Enter a valid campus email address.'); return; }
    if (accounts.some((account) => account.email.toLowerCase() === email)) { setCreateError('An account already uses that campus email.'); return; }
    if (password.length < 8) { setCreateError('The temporary password must contain at least 8 characters.'); return; }
    if (!(createDraft.campusId || '').trim()) { setCreateError('Campus ID is required.'); return; }
    const result = await onCreateAccount(Object.fromEntries(Object.entries({ ...createDraft, name, email }).map(([key, value]) => [key, typeof value === 'string' && key !== 'pass' ? value.trim() : value])));
    if (result?.error) { setCreateError(result.error); return; }
    setCreating(false);
    setSelectedEmail(email);
  };
  const startEditing = () => {
    setDraft({
      name: selected.name, role: selected.role, campusId: selected.campusId, title: selected.title,
      department: selected.department, phone: selected.phone, office: selected.office,
      manager: selected.manager, joined: selected.joined, tsr: !!selected.tsr
    });
    setEditing(true);
    setEditError('');
  };
  const saveProfile = async () => {
    if (!(draft.name || '').trim()) { setEditError('Name is required.'); return; }
    if (!(draft.campusId || '').trim()) { setEditError('Campus ID is required.'); return; }
    const saved = await onUpdateProfile(selected.email, Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])));
    if (saved === false) return;
    setEditing(false);
  };
  const onRowKeyDown = (event, email) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProfile(email);
    }
  };

  return (
    <>
      {!hideNavigation && <nav aria-label="Users and roles sections" style={{ maxWidth: 1300, marginBottom: 14, padding: 5, display: 'flex', gap: 5, background: '#e8edf3', borderRadius: 10 }}>
        {[['accounts', 'User accounts'], ['access', 'Page access'], ['audit', 'Audit log']].map(([key, label]) => <button key={key} type="button" onClick={() => setLocalActiveTab(key)} aria-current={activeTab === key ? 'page' : undefined} style={{ height: 36, padding: '0 15px', border: activeTab === key ? '1px solid #d6dee7' : '1px solid transparent', borderRadius: 7, background: activeTab === key ? '#fff' : 'transparent', color: activeTab === key ? '#0a3d7c' : '#5f6d79', boxShadow: activeTab === key ? '0 1px 3px rgba(25,39,54,.09)' : 'none', fontSize: 12, fontWeight: activeTab === key ? 700 : 600, cursor: 'pointer' }}>{label}{key === 'audit' && auditEntries.length > 0 ? ` (${auditEntries.length})` : ''}</button>)}
      </nav>}
      {activeTab === 'accounts' && <>
      <div style={{ maxWidth: 1240, background: '#fff', border: '1px solid #dfe3e9', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #dfe3e9' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>User accounts</span>
            <span style={{ fontSize: 11.5, color: '#7b8794' }}>{accounts.length} account{accounts.length === 1 ? '' : 's'} with system access</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)} aria-label="Filter users by building" style={{ height: 34, padding: '0 9px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, color: '#3f4a56', fontSize: 12, cursor: 'pointer' }}>
              <option>All buildings</option>
              {buildings.map((building) => <option key={building}>{building}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); setSortDirection('asc'); }} aria-label="Sort users" style={{ height: 34, padding: '0 9px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, color: '#3f4a56', fontSize: 12, cursor: 'pointer' }}>
              <option value="name">Sort: Name</option>
              <option value="building">Sort: Building</option>
            </select>
            <button type="button" className="btn-primary" onClick={startCreating} style={{ height: 34, padding: '0 13px', display: 'flex', alignItems: 'center', gap: 7, borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
              <IconPlus /><span>New user</span>
            </button>
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.7fr 1.1fr 1.25fr 1fr 1.35fr', gap: 12, padding: '10px 16px', background: '#f7f9fb', borderBottom: '1px solid #dfe3e9', fontSize: 10.5, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase', color: '#7b8794' }}>
          {[['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['building', 'Building'], ['lastSeen', 'Last seen']].map(([column, label]) => <SortableHeader key={column} column={column} label={label} sort={headerSort} onSort={changeSort} />)}<span></span>
        </div>
        {roleGroups.map((group) => (
          <section key={group.role} aria-label={`${group.role} users`}>
            <div style={{ height: 36, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 9, background: '#eef4fb', borderBottom: '1px solid #d5e1ef', borderTop: '1px solid #d5e1ef' }}>
              <span style={roleTagStyle(group.role)}>{group.role}</span>
              <span style={{ fontSize: 11, color: '#526579' }}>{group.accounts.length} account{group.accounts.length === 1 ? '' : 's'} · {ROLE_SUMMARY[group.role]}</span>
            </div>
            {group.accounts.map((account) => {
              const active = userState[account.email] !== false;
              return (
                <div key={account.email} data-row="1" role="button" tabIndex={0} aria-label={`View ${account.name}'s profile`}
                  onClick={() => openProfile(account.email)} onKeyDown={(event) => onRowKeyDown(event, account.email)}
                  style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.7fr 1.1fr 1.25fr 1fr 1.35fr', gap: 12, alignItems: 'center', padding: '11px 16px', borderBottom: '1px solid #f2f4f7', fontSize: 12.5, cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProfileAvatar account={account} size={30} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>{account.name}{account.tsr && <span style={{ padding: '2px 5px', borderRadius: 5, background: '#e9effa', color: '#0a3d7c', fontSize: 9.5, fontWeight: 700 }}>TSR</span>}</span>
                      <span style={{ fontSize: 10.5, color: '#8d99a6' }}>{account.title}</span>
                    </span>
                  </span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#5b6672' }}>{account.email}</span>
                  <span><span style={roleTagStyle(account.role)}>{account.role}</span></span>
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><span style={{ fontSize: 11.5, color: '#3f4a56' }}>{buildingOf(account)}</span><span style={{ fontSize: 10.5, color: '#8d99a6' }}>{(account.office || '').split('·').slice(1).join('·').trim() || 'Office not specified'}</span></span>
                  <span style={{ fontSize: 11.5, color: active ? '#7b8794' : '#a01a12' }}>{active ? account.lastSeen : 'Suspended'}</span>
                  <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                    <button type="button" className="btn-ghost" onClick={(event) => { event.stopPropagation(); openProfile(account.email); }}
                      style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600 }}>View profile</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(account.email, active); }}
                      style={{ height: 30, padding: '0 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', background: '#fff', border: '1px solid ' + (active ? '#f4cdc9' : '#dfe3e9'), color: active ? '#a01a12' : '#0a3d7c' }}>
                      {active ? 'Suspend' : 'Restore'}
                    </button>
                  </span>
                </div>
              );
            })}
          </section>
        ))}
        {roleGroups.length === 0 && <div style={{ padding: 42, textAlign: 'center', color: '#7b8794', fontSize: 12.5 }}>No users are assigned to this building.</div>}
      </div>

      {selected && (
        <UserProfile account={selected} active={userState[selected.email] !== false} editing={editing} draft={draft} error={editError} navConfig={navConfig}
          onDraftChange={(key, value) => { setDraft((current) => ({ ...current, [key]: value })); setEditError(''); }}
          onStartEditing={startEditing} onCancelEditing={() => { setEditing(false); setEditError(''); }} onSave={saveProfile}
          onAvatarChange={(avatar) => onUpdateProfile(selected.email, { avatar })}
          onToggle={onToggle} onResetPassword={onResetPassword} onClose={() => setSelectedEmail(null)} />
      )}
      {creating && (
        <NewUserModal draft={createDraft} error={createError}
          onChange={(key, value) => { setCreateDraft((current) => ({ ...current, [key]: value })); setCreateError(''); }}
          onSave={saveNewUser} onClose={() => { setCreating(false); setCreateError(''); }} />
      )}
      </>}
      {activeTab === 'access' && <RoleAccess navConfig={navConfig} onChange={onAccessChange} />}
      {activeTab === 'audit' && <AuditLog entries={auditEntries} />}
    </>
  );
}

function NewUserModal({ draft, error, onChange, onSave, onClose }) {
  const fieldStyle = { height: 38, width: '100%', padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 7, fontSize: 12.5, outline: 'none' };
  const labelStyle = { display: 'flex', flexDirection: 'column', gap: 5 };
  const captionStyle = { fontSize: 10.5, fontWeight: 600, color: '#7b8794', letterSpacing: '.06em', textTransform: 'uppercase' };
  const input = (key) => (event) => onChange(key, event.target.value);
  const fields = [
    ['campusId', 'Campus ID'],
    ['title', 'Position'],
    ['department', 'Department'],
    ['phone', 'Phone'],
    ['office', 'Office'],
    ['manager', 'Reports to'],
    ['joined', 'Member since']
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 47, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,17,22,.42)' }}>
      <div style={{ width: '100%', maxWidth: 700, maxHeight: '86vh', background: '#fff', borderRadius: 12, overflow: 'hidden', animation: 'rise .18s ease', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eceff3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Create user account</span>
            <span style={{ fontSize: 11.5, color: '#7b8794' }}>Set login credentials, profile details, and system access.</span>
          </span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close new user form" style={{ width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center' }}><IconX /></button>
        </div>

        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13, overflow: 'auto' }}>
          <label style={labelStyle}>
            <span style={captionStyle}>Full name</span>
            <input autoFocus value={draft.name || ''} onChange={input('name')} style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Campus email</span>
            <input type="email" value={draft.email || ''} onChange={input('email')} placeholder="name@uwi.edu" style={{ ...fieldStyle, fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5 }} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Temporary password</span>
            <input type="password" value={draft.pass || ''} onChange={input('pass')} placeholder="Minimum 8 characters" style={fieldStyle} />
          </label>
          <label style={labelStyle}>
            <span style={captionStyle}>Assigned role</span>
            <select value={draft.role || 'Staff'} onChange={input('role')} style={{ ...fieldStyle, cursor: 'pointer' }}>
              {Object.keys(NAV).map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          {fields.map(([key, label]) => (
            <label key={key} style={labelStyle}>
              <span style={captionStyle}>{label}</span>
              <input value={draft[key] || ''} onChange={input(key)} style={fieldStyle} />
            </label>
          ))}
          <label style={{ ...labelStyle, gridColumn: 'span 2' }}>
            <span style={captionStyle}>Checkout authorization</span>
            <span style={{ height: 42, padding: '0 11px', display: 'flex', alignItems: 'center', gap: 9, background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 7, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={!!draft.tsr} onChange={(event) => onChange('tsr', event.target.checked)} />
              Make this user a TSR who can authorize equipment checkouts
            </span>
          </label>
          {!!error && <div style={{ gridColumn: 'span 2', padding: '9px 11px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 7, color: '#a01a12', fontSize: 12 }}>{error}</div>}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #eceff3', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <button type="button" className="btn-ghost" onClick={onClose} style={{ height: 36, padding: '0 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 500 }}>Cancel</button>
          <button type="button" className="btn-primary" onClick={onSave} style={{ height: 36, padding: '0 15px', borderRadius: 8, fontSize: 12.5, fontWeight: 600 }}>Create user</button>
        </div>
      </div>
    </div>
  );
}

function UserProfile({ account, active, editing, draft, error, navConfig, onDraftChange, onStartEditing, onCancelEditing, onSave, onAvatarChange, onToggle, onResetPassword, onClose }) {
  const [avatarError, setAvatarError] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const details = [
    ['Campus ID', account.campusId],
    ['Campus email', account.email],
    ['Position', account.title],
    ['Department', account.department],
    ['Phone', account.phone],
    ['Office', account.office],
    ['Reports to', account.manager],
    ['Member since', account.joined]
  ];
  const access = navConfig[account.role] || [];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 45, padding: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(13,17,22,.42)' }}>
      <div style={{ width: '100%', maxWidth: 760, maxHeight: '82vh', background: '#fff', borderRadius: 12, overflow: 'hidden', animation: 'rise .18s ease', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #eceff3', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>User profile</span>
          <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close user profile" style={{ width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center' }}><IconX /></button>
        </div>

        <div style={{ overflow: 'auto' }}>
          <div style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid #eceff3' }}>
            <ProfilePhotoControl account={account} size={58} onAvatarChange={onAvatarChange} onError={setAvatarError} />
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.02em' }}>{account.name}</span>
              <span style={{ fontSize: 12.5, color: '#5b6672' }}>{account.title} · {account.department}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={roleTagStyle(account.role)}>{account.role}</span>
                <span style={{ padding: '3px 8px', borderRadius: 999, background: active ? '#e7f4ec' : '#fdeceb', color: active ? '#155e3f' : '#a01a12', fontSize: 10.5, fontWeight: 600 }}>{active ? 'Active' : 'Suspended'}</span>
              </span>
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              {!editing && <button type="button" className="btn-ghost" onClick={onStartEditing} style={{ height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Edit profile</button>}
              {!editing && onResetPassword && <button type="button" className="btn-ghost" onClick={() => { setResetStatus(''); setResetOpen(true); }} style={{ height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Reset password</button>}
              {!editing && <button type="button" onClick={() => onToggle(account.email, active)} className={active ? 'btn-ghost-danger' : 'btn-primary'} style={{ height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>{active ? 'Suspend account' : 'Restore account'}</button>}
              {editing && <button type="button" className="btn-ghost" onClick={onCancelEditing} style={{ height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Cancel</button>}
              {editing && <button type="button" className="btn-primary" onClick={onSave} style={{ height: 34, padding: '0 12px', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>Save changes</button>}
            </span>
          </div>
          {!!resetStatus && <div style={{ margin: '12px 20px 0', padding: '9px 11px', background: resetStatus.startsWith('Temporary') ? '#e7f4ec' : '#fdeceb', borderRadius: 8, color: resetStatus.startsWith('Temporary') ? '#155e3f' : '#a01a12', fontSize: 11 }}>{resetStatus}</div>}
          {avatarError && <div style={{ margin: '12px 20px 0', padding: '9px 11px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 7, color: '#a01a12', fontSize: 12 }}>{avatarError}</div>}

          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Profile details</div>
            {editing ? (
              <ProfileEditor account={account} draft={draft} error={error} onChange={onDraftChange} />
            ) : (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #eceff3', borderRadius: 9, overflow: 'hidden' }}>
                {details.map(([label, value], index) => (
                  <div key={label} style={{ padding: '11px 13px', display: 'flex', flexDirection: 'column', gap: 4, background: '#fff', borderRight: index % 2 === 0 ? '1px solid #eceff3' : 'none', borderBottom: index < details.length - 2 ? '1px solid #eceff3' : 'none' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: '#7b8794', letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>
                    <span style={{ fontSize: 12.5, color: '#2f3944' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>Role and access</div>
            <div style={{ marginTop: 10, padding: 13, background: '#f7f9fb', border: '1px solid #eceff3', borderRadius: 9 }}>
              <div style={{ fontSize: 12, color: '#3f4a56', lineHeight: 1.5 }}>{ROLE_SUMMARY[account.role]}</div>
              <div style={{ marginTop: 11, display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {access.map((key) => (
                  <span key={key} style={{ padding: '4px 8px', background: '#fff', border: '1px solid #dfe3e9', borderRadius: 6, color: '#3f4a56', fontSize: 10.5, fontWeight: 500 }}>{LABELS[key][0]}</span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ margin: '0 20px 20px', padding: '11px 13px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #eceff3', borderRadius: 9 }}>
            <span style={{ fontSize: 11.5, color: '#7b8794' }}>Most recent system activity</span>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, fontWeight: 600, color: active ? '#3f4a56' : '#a01a12' }}>{active ? account.lastSeen : 'Account suspended'}</span>
          </div>
        </div>
      </div>
      {resetOpen && <PasswordResetModal account={account} onReset={onResetPassword} onClose={() => setResetOpen(false)} onComplete={() => { setResetOpen(false); setResetStatus(`Temporary password updated for ${account.email}.`); }} />}
    </div>
  );
}

function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('');
}

function PasswordResetModal({ account, onReset, onClose, onComplete }) {
  const [password, setPassword] = useState(() => generateTemporaryPassword());
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (password.length < 8) { setError('The temporary password must contain at least 8 characters.'); return; }
    if (password !== confirm) { setError('The passwords do not match.'); return; }
    setSaving(true);
    const result = await onReset(account.email, password);
    setSaving(false);
    if (result?.error) { setError(result.error); return; }
    onComplete();
  };
  const regenerate = () => {
    setPassword(generateTemporaryPassword());
    setConfirm('');
    setError('');
    setVisible(true);
  };
  const inputStyle = { height: 42, padding: '0 12px', border: '1px solid #d8e0e7', borderRadius: 9, background: '#f7f9fb', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, outline: 'none' };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="password-reset-title" style={{ position: 'fixed', inset: 0, zIndex: 49, padding: 24, display: 'grid', placeItems: 'center', background: 'rgba(10,18,25,.58)', backdropFilter: 'blur(8px)' }}>
      <div style={{ width: 'min(100%, 480px)', overflow: 'hidden', borderRadius: 16, background: '#fff', boxShadow: '0 24px 70px rgba(5,17,28,.3)' }}>
        <div style={{ padding: '19px 21px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#102c3a', color: '#fff' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span id="password-reset-title" style={{ fontSize: 16, fontWeight: 700 }}>Set temporary password</span>
            <span style={{ color: '#b9ced7', fontSize: 11.5 }}>{account.name} · {account.email}</span>
          </span>
          <button type="button" onClick={onClose} aria-label="Close password reset" style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', border: 0, borderRadius: 9, background: 'rgba(255,255,255,.1)', color: '#fff', cursor: 'pointer' }}><IconX /></button>
        </div>
        <div style={{ padding: 21, display: 'flex', flexDirection: 'column', gap: 15 }}>
          <p style={{ margin: 0, color: '#657483', fontSize: 12.5, lineHeight: 1.55 }}>Give this password to the user securely. It takes effect immediately after you confirm the reset.</p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#647382', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>New temporary password</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <input autoFocus type={visible ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} autoComplete="new-password" style={{ ...inputStyle, minWidth: 0, flex: 1 }} />
              <button type="button" className="btn-ghost" onClick={() => setVisible((current) => !current)} style={{ height: 42, padding: '0 12px', borderRadius: 9 }}>{visible ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ color: '#647382', fontSize: 10.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>Confirm password</span>
            <input type={visible ? 'text' : 'password'} value={confirm} onChange={(event) => { setConfirm(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter' && !saving) submit(); }} autoComplete="new-password" style={inputStyle} />
          </label>
          <button type="button" onClick={regenerate} style={{ alignSelf: 'flex-start', padding: 0, border: 0, background: 'transparent', color: '#0a5b91', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Generate a different password</button>
          {!!error && <div role="alert" style={{ padding: '10px 12px', borderRadius: 9, background: '#fdeceb', color: '#a01a12', fontSize: 12 }}>{error}</div>}
        </div>
        <div style={{ padding: '14px 21px 18px', display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving} style={{ height: 38, padding: '0 14px', borderRadius: 9 }}>Cancel</button>
          <button type="button" className="btn-primary" onClick={submit} disabled={saving} style={{ height: 38, padding: '0 16px', borderRadius: 9 }}>{saving ? 'Resetting…' : 'Set password'}</button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditor({ account, draft, error, onChange }) {
  const fieldStyle = { height: 37, width: '100%', padding: '0 10px', background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 7, fontSize: 12.5, outline: 'none' };
  const fields = [
    ['name', 'Full name'],
    ['campusId', 'Campus ID'],
    ['title', 'Position'],
    ['department', 'Department'],
    ['phone', 'Phone'],
    ['office', 'Office'],
    ['manager', 'Reports to'],
    ['joined', 'Member since']
  ];

  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#7b8794', letterSpacing: '.06em', textTransform: 'uppercase' }}>Campus email</span>
        <input value={account.email} readOnly style={{ ...fieldStyle, color: '#7b8794', cursor: 'not-allowed' }} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#7b8794', letterSpacing: '.06em', textTransform: 'uppercase' }}>Assigned role</span>
        <select value={draft.role || 'Staff'} onChange={(event) => onChange('role', event.target.value)} style={{ ...fieldStyle, cursor: 'pointer' }}>
          {Object.keys(NAV).map((role) => <option key={role} value={role}>{role}</option>)}
        </select>
      </label>
      {fields.map(([key, label]) => (
        <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#7b8794', letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>
          <input value={draft[key] || ''} onChange={(event) => onChange(key, event.target.value)} style={fieldStyle} />
        </label>
      ))}
      <label style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: '#7b8794', letterSpacing: '.06em', textTransform: 'uppercase' }}>Checkout authorization</span>
        <span style={{ height: 42, padding: '0 11px', display: 'flex', alignItems: 'center', gap: 9, background: '#f8f9fb', border: '1px solid #dfe3e9', borderRadius: 7, fontSize: 12.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!draft.tsr} onChange={(event) => onChange('tsr', event.target.checked)} />
          This user is a TSR and may authorize equipment checkouts
        </span>
      </label>
      {!!error && <div style={{ gridColumn: 'span 2', padding: '9px 11px', background: '#fdeceb', border: '1px solid #f4cdc9', borderRadius: 7, color: '#a01a12', fontSize: 12 }}>{error}</div>}
    </div>
  );
}
