import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const publishableKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
).trim();

export const supabaseConfigured = Boolean(url && publishableKey);
export const supabase = supabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'msbm-inventory-auth'
      }
    })
  : null;

const valueOrEmpty = (value) => value == null ? '' : value;

export function profileToAccount(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    email: valueOrEmpty(profile.email).toLowerCase(),
    name: valueOrEmpty(profile.name),
    role: profile.role || 'Staff',
    tsr: Boolean(profile.tsr),
    active: profile.active !== false,
    lastSeen: profile.last_seen ? new Date(profile.last_seen).toLocaleString() : 'Never',
    campusId: valueOrEmpty(profile.campus_id),
    title: valueOrEmpty(profile.title),
    department: valueOrEmpty(profile.department),
    phone: valueOrEmpty(profile.phone),
    office: valueOrEmpty(profile.office),
    joined: valueOrEmpty(profile.joined),
    manager: valueOrEmpty(profile.manager),
    avatar: valueOrEmpty(profile.avatar),
    source: 'supabase'
  };
}

function profileChanges(account = {}) {
  const output = {};
  const fields = {
    name: 'name', role: 'role', tsr: 'tsr', campusId: 'campus_id', title: 'title',
    department: 'department', phone: 'phone', office: 'office', joined: 'joined',
    manager: 'manager', avatar: 'avatar', active: 'active'
  };
  Object.entries(fields).forEach(([source, target]) => {
    if (Object.prototype.hasOwnProperty.call(account, source)) output[target] = account[source];
  });
  return output;
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured for this installation.');
  return supabase;
}

export async function signInWithSupabase(email, password) {
  const client = requireClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data: profile, error: profileError } = await client.from('profiles').select('*').eq('id', data.user.id).single();
  if (profileError) {
    await client.auth.signOut();
    throw new Error('Your login exists, but its MSBM user profile is unavailable. Contact an administrator.');
  }
  if (profile.active === false) {
    await client.auth.signOut();
    throw new Error('This account has been suspended. Contact an administrator.');
  }
  const signedInAt = new Date().toISOString();
  await client.rpc('touch_own_profile_last_seen');
  return profileToAccount({ ...profile, last_seen: signedInAt });
}

export async function loadSupabaseSessionAccount() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (error || data?.active === false) {
    await supabase.auth.signOut();
    return null;
  }
  return profileToAccount(data);
}

export async function listSupabaseAccounts() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('profiles').select('*').order('name');
  if (error) throw error;
  return (data || []).map(profileToAccount);
}

export async function createSupabaseAccount(account) {
  const client = requireClient();
  const { data, error } = await client.functions.invoke('admin-create-user', {
    body: { email: account.email, password: account.pass, profile: profileChanges(account) }
  });
  if (error) {
    let detail = '';
    try { detail = (await error.context?.json())?.error || ''; } catch { /* Use the SDK error below. */ }
    throw new Error(detail || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return profileToAccount(data.profile);
}

export async function resetSupabaseAccountPassword(email, password) {
  const client = requireClient();
  const { data, error } = await client.functions.invoke('admin-reset-password', {
    body: { email: String(email || '').trim().toLowerCase(), password }
  });
  if (error) {
    let detail = '';
    try { detail = (await error.context?.json())?.error || ''; } catch { /* Use the SDK error below. */ }
    throw new Error(detail || error.message);
  }
  if (data?.error) throw new Error(data.error);
}

/** Create (or return) the Zoho Desk ticket linked to a saved borrowing request. */
export async function createZohoLoanRequestTicket(requestId) {
  const client = requireClient();
  const { data, error } = await client.functions.invoke('zoho-loan-request', {
    body: { requestId: String(requestId || '').trim() }
  });
  if (error) {
    let detail = '';
    try { detail = (await error.context?.json())?.error || ''; } catch { /* Use the SDK error below. */ }
    throw new Error(detail || error.message || 'Zoho Desk could not be reached.');
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function updateSupabaseProfile(email, changes) {
  const client = requireClient();
  const { data, error } = await client.from('profiles').update({ ...profileChanges(changes), updated_at: new Date().toISOString() }).eq('email', email.toLowerCase()).select().single();
  if (error) throw error;
  return profileToAccount(data);
}

export async function updateOwnSupabaseAvatar(avatar) {
  const client = requireClient();
  const { error } = await client.rpc('set_own_profile_avatar', { new_avatar: avatar || null });
  if (error) throw error;
}

export async function requestSupabasePasswordReset(email) {
  const client = requireClient();
  const configuredRedirect = String(import.meta.env.VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL || '').trim();
  const browserRedirect = /^https?:$/.test(window.location.protocol)
    ? new URL(window.location.pathname || '/', window.location.origin).toString()
    : '';
  const redirectTo = configuredRedirect || browserRedirect;
  if (!redirectTo) throw new Error('Password reset requires VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL for the desktop application.');
  const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error) throw error;
}

export async function updateSupabasePassword(password) {
  const client = requireClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}

const CSV_PAGE_SIZE = 1000;
const CSV_UPLOAD_CHUNK_SIZE = 250;
const WORKSPACE_ID = 'msbm';
const WORKSPACE_PAGE_SIZE = 1000;
const WORKSPACE_UPLOAD_CHUNK_SIZE = 150;
const WORKSPACE_ARRAY_TYPES = {
  items: 'items',
  history: 'history',
  requests: 'requests',
  orders: 'orders',
  placements: 'placements',
  stocktakes: 'stocktakes',
  repairTickets: 'repair_tickets',
  maintenanceSchedules: 'maintenance_schedules',
  lifecycleActions: 'lifecycle_actions',
  procurementRecords: 'procurement_records',
  importRuns: 'import_runs',
  auditLog: 'audit_log',
  reservedBarcodes: 'reserved_barcodes',
  approvedVendors: 'approved_vendors',
  approvalContacts: 'approval_contacts',
  maintenanceContacts: 'maintenance_contacts',
  loanContacts: 'loan_contacts',
  consumableUsage: 'consumable_usage'
};
const WORKSPACE_SINGLETON_TYPES = {
  navOverrides: 'nav_overrides',
  borrowCategoryAccess: 'borrow_category_access'
};
const WORKSPACE_FIELD_BY_TYPE = Object.fromEntries([
  ...Object.entries(WORKSPACE_ARRAY_TYPES),
  ...Object.entries(WORKSPACE_SINGLETON_TYPES)
].map(([field, type]) => [type, field]));
let workspaceBaseline = new Map();
let workspaceSortIndexes = new Map();
let workspaceInitialized = false;
let workspaceSaveChain = Promise.resolve();

async function selectEveryCsvRow(table, columns, orderColumn) {
  const client = requireClient();
  const rows = [];
  for (let from = 0; ; from += CSV_PAGE_SIZE) {
    const { data, error } = await client.from(table).select(columns).order(orderColumn, { ascending: true }).range(from, from + CSV_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < CSV_PAGE_SIZE) return rows;
  }
}

async function selectEveryCompletedCsvRecord() {
  const client = requireClient();
  const rows = [];
  for (let from = 0; ; from += CSV_PAGE_SIZE) {
    const { data, error } = await client
      .from('csv_import_records')
      .select('record_type, payload, imported_at, csv_import_runs!inner(complete)')
      .eq('csv_import_runs.complete', true)
      .order('imported_at', { ascending: true })
      .range(from, from + CSV_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < CSV_PAGE_SIZE) return rows;
  }
}

/**
 * Checks the small import cursor first. The complete shared CSV archive is only
 * downloaded when this installation's durable local cache is out of date.
 */
export async function loadSupabaseCsvSnapshot(cachedCursor = '') {
  const client = requireClient();
  const { data: latest, error: latestError } = await client
    .from('csv_import_runs')
    .select('id, imported_at')
    .eq('complete', true)
    .order('imported_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;
  if (!latest) return { cursor: '', unchanged: !cachedCursor, assets: [], procurement: [], runs: [] };
  if (cachedCursor && cachedCursor === latest.id) return { cursor: cachedCursor, unchanged: true, assets: [], procurement: [], runs: [] };

  const [records, runRows] = await Promise.all([
    selectEveryCompletedCsvRecord(),
    selectEveryCsvRow('csv_import_runs', 'id, payload, imported_at, complete', 'imported_at')
  ]);
  return {
    cursor: latest.id,
    unchanged: false,
    assets: records.filter((row) => row.record_type === 'asset').map((row) => row.payload).filter(Boolean),
    procurement: records.filter((row) => row.record_type === 'procurement').map((row) => row.payload).filter(Boolean),
    runs: runRows.filter((row) => row.complete).map((row) => row.payload).filter(Boolean).reverse()
  };
}

/** Store interpreted records, not the original CSV file, so every installation can hydrate the same archive. */
export async function storeSupabaseCsvImport({ assets = [], procurement = [], run }) {
  const client = requireClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) throw new Error('Sign in again before uploading company data.');
  if (!run?.id) throw new Error('The CSV import is missing its run identifier.');
  const importedAt = new Date().toISOString();
  const rows = [
    ...assets.map((payload) => ({ import_key: payload.importKey, record_type: 'asset', payload, source_file: payload.sourceFile || '', source_row: Number(payload.sourceRow || 0), import_run_id: run.id, imported_by: user.id, imported_at: importedAt })),
    ...procurement.map((payload) => ({ import_key: payload.importKey, record_type: 'procurement', payload, source_file: payload.sourceFile || '', source_row: Number(payload.sourceRow || 0), import_run_id: run.id, imported_by: user.id, imported_at: importedAt }))
  ].filter((row) => row.import_key);

  // Publish the cursor only after every record is durable, preventing another
  // installation from caching a partially uploaded batch.
  const { error: pendingRunError } = await client.from('csv_import_runs').upsert({ id: run.id, payload: run, imported_by: user.id, imported_at: importedAt, complete: false }, { onConflict: 'id' });
  if (pendingRunError) throw pendingRunError;

  for (let index = 0; index < rows.length; index += CSV_UPLOAD_CHUNK_SIZE) {
    const { error } = await client.from('csv_import_records').upsert(rows.slice(index, index + CSV_UPLOAD_CHUNK_SIZE), { onConflict: 'import_key' });
    if (error) throw error;
  }
  const { error: runError } = await client.from('csv_import_runs').update({ complete: true }).eq('id', run.id);
  if (runError) throw runError;
  return { cursor: run.id, stored: rows.length };
}

function workspaceRecordKey(entityType, recordId) {
  return `${entityType}\u0000${recordId}`;
}

function workspaceRecordHash(payload, sortIndex) {
  return JSON.stringify([sortIndex, payload]);
}

function workspaceRows(snapshot = {}, userId = '') {
  const rows = [];
  Object.entries(WORKSPACE_ARRAY_TYPES).forEach(([field, entityType]) => {
    const records = Array.isArray(snapshot[field]) ? snapshot[field] : [];
    const establishedSorts = [...workspaceSortIndexes.entries()]
      .filter(([key]) => key.startsWith(`${entityType}\u0000`))
      .map(([, value]) => value);
    let nextNewSort = establishedSorts.length ? Math.min(...establishedSorts) - records.length : 0;
    records.forEach((payload, sortIndex) => {
      const recordId = String(payload?.id || '').trim();
      if (!recordId) return;
      const key = workspaceRecordKey(entityType, recordId);
      const stableSortIndex = workspaceSortIndexes.has(key) ? workspaceSortIndexes.get(key) : (establishedSorts.length ? nextNewSort++ : sortIndex);
      rows.push({
        workspace_id: WORKSPACE_ID,
        entity_type: entityType,
        record_id: recordId,
        payload,
        sort_index: stableSortIndex,
        updated_by: userId,
        updated_at: new Date().toISOString()
      });
    });
  });
  Object.entries(WORKSPACE_SINGLETON_TYPES).forEach(([field, entityType]) => {
    rows.push({
      workspace_id: WORKSPACE_ID,
      entity_type: entityType,
      record_id: 'current',
      payload: snapshot[field] && typeof snapshot[field] === 'object' ? snapshot[field] : {},
      sort_index: 0,
      updated_by: userId,
      updated_at: new Date().toISOString()
    });
  });
  return rows;
}

async function selectEveryWorkspaceRow() {
  const client = requireClient();
  const rows = [];
  for (let from = 0; ; from += WORKSPACE_PAGE_SIZE) {
    const { data, error } = await client
      .from('workspace_records')
      .select('entity_type, record_id, payload, sort_index, updated_at, updated_by')
      .eq('workspace_id', WORKSPACE_ID)
      .order('entity_type', { ascending: true })
      .order('sort_index', { ascending: true })
      .range(from, from + WORKSPACE_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < WORKSPACE_PAGE_SIZE) return rows;
  }
}

/** Load the canonical shared workspace and establish the local diff baseline. */
export async function loadSupabaseWorkspaceSnapshot() {
  const client = requireClient();
  const [rows, registryResult] = await Promise.all([
    selectEveryWorkspaceRow(),
    client.from('workspace_registry').select('initialized').eq('workspace_id', WORKSPACE_ID).maybeSingle()
  ]);
  if (registryResult.error) throw registryResult.error;
  const world = {
    ...Object.fromEntries(Object.keys(WORKSPACE_ARRAY_TYPES).map((field) => [field, []])),
    ...Object.fromEntries(Object.keys(WORKSPACE_SINGLETON_TYPES).map((field) => [field, {}]))
  };
  const nextBaseline = new Map();
  const nextSortIndexes = new Map();
  rows.forEach((row) => {
    const field = WORKSPACE_FIELD_BY_TYPE[row.entity_type];
    if (!field) return;
    const sortIndex = Number(row.sort_index || 0);
    const key = workspaceRecordKey(row.entity_type, row.record_id);
    nextBaseline.set(key, workspaceRecordHash(row.payload, sortIndex));
    nextSortIndexes.set(key, sortIndex);
    if (Object.prototype.hasOwnProperty.call(WORKSPACE_ARRAY_TYPES, field)) world[field].push({ ...row.payload });
    else world[field] = row.payload && typeof row.payload === 'object' ? row.payload : {};
  });
  workspaceBaseline = nextBaseline;
  workspaceSortIndexes = nextSortIndexes;
  workspaceInitialized = registryResult.data?.initialized === true;
  return { empty: !workspaceInitialized, rows: rows.length, world };
}

/**
 * Refresh one workspace collection without rehydrating the entire application.
 * This is used by personal Staff views as a small fallback when a browser or
 * network temporarily delays a Realtime notification.
 */
export async function loadSupabaseWorkspaceRecords(entityType) {
  const client = requireClient();
  const normalizedType = String(entityType || '').trim();
  if (!normalizedType || !Object.values(WORKSPACE_ARRAY_TYPES).includes(normalizedType)) {
    throw new Error('That workspace record type cannot be refreshed.');
  }
  const { data, error } = await client
    .from('workspace_records')
    .select('entity_type, record_id, payload, sort_index')
    .eq('workspace_id', WORKSPACE_ID)
    .eq('entity_type', normalizedType)
    .order('sort_index', { ascending: true });
  if (error) throw error;
  (data || []).forEach((row) => {
    const sortIndex = Number(row.sort_index || 0);
    const key = workspaceRecordKey(row.entity_type, row.record_id);
    workspaceBaseline.set(key, workspaceRecordHash(row.payload, sortIndex));
    workspaceSortIndexes.set(key, sortIndex);
  });
  return (data || []).map((row) => ({ ...row.payload }));
}

/**
 * Persist only changed entity rows. Independent records are upserted separately,
 * preventing an asset edit on one device from replacing an unrelated loan or
 * stocktake created on another device.
 */
function mayWriteWorkspaceChange(role, row, existed) {
  if (role === 'Admin') return true;
  if (role === 'Student assistant') {
    if (['nav_overrides', 'borrow_category_access'].includes(row.entity_type)) return false;
    // Operational assistants may append audit evidence, but existing audit
    // records remain immutable unless an administrator changes them.
    if (row.entity_type === 'audit_log') return !existed;
    return true;
  }
  if (role === 'Staff') {
    // RLS performs the final ownership check using payload.byEmail. Avoid
    // offering unrelated inventory/settings changes from a Staff renderer in
    // the first place, especially after a Realtime refresh.
    if (row.entity_type === 'audit_log') return !existed;
    return row.entity_type === 'requests' && !existed;
  }
  return false;
}

function mayDeleteWorkspaceRecord(role, entityType) {
  if (role === 'Admin') return true;
  return role === 'Student assistant'
    && !['nav_overrides', 'borrow_category_access', 'audit_log'].includes(entityType);
}

export function saveSupabaseWorkspaceSnapshot(snapshot = {}, access = {}) {
  const requestedRows = workspaceRows(snapshot);
  workspaceSaveChain = workspaceSaveChain.catch(() => {}).then(async () => {
    const client = requireClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new Error('Sign in again before synchronizing inventory data.');

    const rows = requestedRows.map((row) => ({ ...row, updated_by: user.id }));
    const next = new Map(rows.map((row) => [
      workspaceRecordKey(row.entity_type, row.record_id),
      workspaceRecordHash(row.payload, row.sort_index)
    ]));
    const role = String(access.role || 'Admin');
    const changed = rows.filter((row) => {
      const key = workspaceRecordKey(row.entity_type, row.record_id);
      return workspaceBaseline.get(key) !== workspaceRecordHash(row.payload, row.sort_index)
        && mayWriteWorkspaceChange(role, row, workspaceBaseline.has(key));
    });

    for (let index = 0; index < changed.length; index += WORKSPACE_UPLOAD_CHUNK_SIZE) {
      const { error } = await client.from('workspace_records').upsert(changed.slice(index, index + WORKSPACE_UPLOAD_CHUNK_SIZE), {
        onConflict: 'workspace_id,entity_type,record_id'
      });
      if (error) throw error;
    }

    const removedByType = new Map();
    workspaceBaseline.forEach((_, key) => {
      if (next.has(key)) return;
      const [entityType, recordId] = key.split('\u0000');
      if (!mayDeleteWorkspaceRecord(role, entityType)) return;
      if (!removedByType.has(entityType)) removedByType.set(entityType, []);
      removedByType.get(entityType).push(recordId);
    });
    for (const [entityType, recordIds] of removedByType) {
      for (let index = 0; index < recordIds.length; index += WORKSPACE_UPLOAD_CHUNK_SIZE) {
        const { error } = await client.from('workspace_records')
          .delete()
          .eq('workspace_id', WORKSPACE_ID)
          .eq('entity_type', entityType)
          .in('record_id', recordIds.slice(index, index + WORKSPACE_UPLOAD_CHUNK_SIZE));
        if (error) throw error;
      }
    }
    if (!workspaceInitialized) {
      const { error } = await client.from('workspace_registry').upsert({
        workspace_id: WORKSPACE_ID,
        initialized: true,
        initialized_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        updated_by: user.id
      }, { onConflict: 'workspace_id' });
      if (error) throw error;
      workspaceInitialized = true;
    }
    // Advance the database baseline only for rows this role actually wrote.
    // Protected local differences remain excluded instead of being mistaken
    // for successfully synchronized data.
    changed.forEach((row) => {
      const key = workspaceRecordKey(row.entity_type, row.record_id);
      workspaceBaseline.set(key, workspaceRecordHash(row.payload, row.sort_index));
      workspaceSortIndexes.set(key, row.sort_index);
    });
    removedByType.forEach((recordIds, entityType) => recordIds.forEach((recordId) => {
      const key = workspaceRecordKey(entityType, recordId);
      workspaceBaseline.delete(key);
      workspaceSortIndexes.delete(key);
    }));
    return { changed: changed.length, deleted: [...removedByType.values()].reduce((sum, ids) => sum + ids.length, 0) };
  });
  return workspaceSaveChain;
}

/** Persist Page Access immediately instead of waiting for the general workspace debounce. */
export function saveSupabaseRoleNavigation(navOverrides = {}) {
  workspaceSaveChain = workspaceSaveChain.catch(() => {}).then(async () => {
    const client = requireClient();
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw new Error('Sign in again before changing Page Access.');
    const payload = Object.fromEntries(Object.entries(navOverrides).map(([role, screens]) => [
      role,
      Array.isArray(screens) ? Array.from(new Set(screens.map(String))) : []
    ]));
    const row = {
      workspace_id: WORKSPACE_ID,
      entity_type: WORKSPACE_SINGLETON_TYPES.navOverrides,
      record_id: 'current',
      payload,
      sort_index: 0,
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('workspace_records').upsert(row, {
      onConflict: 'workspace_id,entity_type,record_id'
    });
    if (error) throw error;
    const key = workspaceRecordKey(row.entity_type, row.record_id);
    workspaceBaseline.set(key, workspaceRecordHash(row.payload, row.sort_index));
    workspaceSortIndexes.set(key, row.sort_index);
    return payload;
  });
  return workspaceSaveChain;
}

export function subscribeToSupabaseWorkspace(onRemoteChange, currentUserId = '') {
  if (!supabase) return () => {};
  const channel = supabase.channel(`workspace-records-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_records', filter: `workspace_id=eq.${WORKSPACE_ID}` }, (change) => {
      const changedBy = change.new?.updated_by || change.old?.updated_by || '';
      if (currentUserId && changedBy === currentUserId) return;
      onRemoteChange?.(change);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function uploadWorkspaceAttachment(id, file) {
  const client = requireClient();
  const safeName = String(file.name || 'attachment').replace(/[^a-zA-Z0-9._-]+/g, '-');
  const path = `disposal/${String(id).replace(/[^a-zA-Z0-9_-]+/g, '-')}/${safeName}`;
  const { error } = await client.storage.from('workspace-attachments').upload(path, file, { upsert: true, contentType: file.type || 'application/octet-stream' });
  if (error) throw error;
  return { id, name: file.name, type: file.type, size: file.size, storage: 'supabase', path };
}

export async function downloadWorkspaceAttachment(path) {
  const client = requireClient();
  const { data, error } = await client.storage.from('workspace-attachments').download(path);
  if (error) throw error;
  return data;
}

export async function deleteWorkspaceAttachment(path) {
  const client = requireClient();
  const { error } = await client.storage.from('workspace-attachments').remove([path]);
  if (error) throw error;
}

export function subscribeToPasswordRecovery(onRecovery) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') onRecovery();
  });
  return () => data.subscription.unsubscribe();
}

export async function signOutSupabase() {
  if (supabase) await supabase.auth.signOut();
}
