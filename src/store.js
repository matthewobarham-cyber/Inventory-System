// Persistence for inventory state: the Electron main process keeps a JSON file
// under app.getPath('userData'); when running outside Electron (e.g. `vite` in a
// plain browser tab for quick iteration) we fall back to localStorage so the app
// still works standalone.

const LOCAL_KEY = 'msbm-inv-store-v1';
const hasElectronApi = typeof window !== 'undefined' && !!window.api;

export async function loadPersisted() {
  if (hasElectronApi) {
    try { return await window.api.loadStore(); } catch { return null; }
  }
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function savePersisted(data) {
  try {
    if (hasElectronApi) return (await window.api.saveStore(data)) === true;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to persist inventory state', error);
    return false;
  }
}

const SESSION_KEY = 'uwi-inv-session';
export function loadSessionPointer() {
  try {
    const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function saveSessionPointer(session, persistent = false) {
  clearSessionPointer();
  try { (persistent ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* ignore */ }
}
export function clearSessionPointer() {
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
