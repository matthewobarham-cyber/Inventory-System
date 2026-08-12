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
