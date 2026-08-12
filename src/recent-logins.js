const RECENT_LOGINS_KEY = 'msbm.inventory.recentLogins.v1';
const MAX_RECENT_LOGINS = 5;

export function loadRecentLogins() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_LOGINS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.email).slice(0, MAX_RECENT_LOGINS) : [];
  } catch {
    return [];
  }
}

export async function rememberSuccessfulLogin(account, password = '') {
  if (!account?.email) return;
  const email = String(account.email).trim().toLowerCase();
  const role = String(account.role || 'Staff');
  const recent = loadRecentLogins().filter((entry) => entry.email !== email);
  recent.unshift({ email, name: account.name || email.split('@')[0], role, signedInAt: new Date().toISOString() });
  try { localStorage.setItem(RECENT_LOGINS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_LOGINS))); } catch { /* Restricted browser storage. */ }

  if (!window.api) return;
  if (role.toLowerCase() === 'admin') await window.api.deleteRecentCredential?.(email);
  else if (password) await window.api.saveRecentCredential?.(email, password);
}

export async function loadRecentPassword(account) {
  if (!account || String(account.role || '').toLowerCase() === 'admin' || !window.api?.loadRecentCredential) return '';
  try { return await window.api.loadRecentCredential(account.email) || ''; }
  catch { return ''; }
}
