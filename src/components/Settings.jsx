import { useState } from 'react';
import CsvImport from './CsvImport.jsx';
import Users from './Users.jsx';
import Vendors from './Vendors.jsx';
import ApprovalContacts from './ApprovalContacts.jsx';

const ADMIN_SECTIONS = [
  ['approvers', 'Approval contacts', 'Management names and approval email addresses', '@'],
  ['vendors', 'Approved vendors', 'Supplier records and purchasing history', '✓'],
  ['imports', 'CSV data', 'Import and review company records', '↥'],
  ['accounts', 'Users', 'Accounts, profiles and access status', '◎'],
  ['access', 'Page access', 'Role permissions and application pages', '◇'],
  ['audit', 'Activity log', 'Security and operational audit history', '≡']
];

export default function Settings({ isAdmin, accounts, userState, navConfig, auditEntries, importRuns, procurementRecords, vendors, approvalContacts, items, orders, onImport, onSaveVendor, onToggleVendor, onSaveApprovalContact, onToggleApprovalContact, onAccessChange, onToggle, onUpdateProfile, onCreateAccount }) {
  const sections = isAdmin ? ADMIN_SECTIONS : [ADMIN_SECTIONS[0]];
  const [active, setActive] = useState('imports');
  const selected = sections.find(([key]) => key === active) || sections[0];
  const activeKey = selected[0];

  return <div className="settings-workspace">
    <section className="settings-hero"><img src="brand/msbm-crest.png" alt="" /><span><small>System administration</small><h2>Settings</h2><p>Manage institutional data, user access, permissions, and accountable system activity from one place.</p></span><div><strong>{isAdmin ? 'Administrator controls' : 'Data access'}</strong><small>{isAdmin ? `${accounts.length} users · ${auditEntries.length} activity records` : `${procurementRecords.length} procurement records`}</small></div></section>
    <div className="settings-layout"><nav className="settings-nav" aria-label="Settings sections"><div><small>Configuration</small><strong>System settings</strong></div>{sections.map(([key, label, detail, icon]) => <button key={key} type="button" data-active={activeKey === key} onClick={() => setActive(key)}><span>{icon}</span><span><strong>{label}</strong><small>{detail}</small></span><i>›</i>{key === 'audit' && auditEntries.length > 0 && <b>{auditEntries.length}</b>}</button>)}</nav>
      <main className="settings-content"><header><span><small>{selected[1]}</small><strong>{selected[2]}</strong></span><span className="settings-local-badge">Stored locally</span></header><div className="settings-content-body">
        {activeKey === 'imports' && <CsvImport importRuns={importRuns} procurementRecords={procurementRecords} canImport={isAdmin} onCommit={onImport} />}
        {isAdmin && activeKey === 'vendors' && <Vendors vendors={vendors} items={items} orders={orders} procurementRecords={procurementRecords} onSave={onSaveVendor} onToggle={onToggleVendor} />}
        {isAdmin && activeKey === 'approvers' && <ApprovalContacts contacts={approvalContacts} onSave={onSaveApprovalContact} onToggle={onToggleApprovalContact} />}
        {isAdmin && !['imports', 'vendors', 'approvers'].includes(activeKey) && <Users accounts={accounts} userState={userState} navConfig={navConfig} auditEntries={auditEntries} activeSection={activeKey} hideNavigation onAccessChange={onAccessChange} onToggle={onToggle} onUpdateProfile={onUpdateProfile} onCreateAccount={onCreateAccount} />}
      </div></main>
    </div>
  </div>;
}
