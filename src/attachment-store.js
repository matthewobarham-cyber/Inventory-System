const DATABASE_NAME = 'msbm-inventory-attachments';
const DATABASE_VERSION = 1;
const STORE_NAME = 'files';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Local attachment storage is unavailable.'));
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Attachment database could not be opened.'));
  });
}

function transact(mode, operation) {
  return openDatabase().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error || new Error('Attachment operation failed.'));
    transaction.oncomplete = () => { database.close(); resolve(result); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Attachment transaction failed.')); };
  }));
}

export async function saveAttachment(id, file) {
  if (supabaseConfigured) return uploadWorkspaceAttachment(id, file);
  await transact('readwrite', (store) => store.put({ id, blob: file, name: file.name, type: file.type, size: file.size, savedAt: new Date().toISOString() }));
  return { id, name: file.name, type: file.type, size: file.size, storage: 'indexeddb' };
}

export async function loadAttachment(fileOrId) {
  if (fileOrId && typeof fileOrId === 'object' && fileOrId.storage === 'supabase' && fileOrId.path) {
    const blob = await downloadWorkspaceAttachment(fileOrId.path);
    return { ...fileOrId, blob };
  }
  const id = typeof fileOrId === 'object' ? fileOrId.id : fileOrId;
  return transact('readonly', (store) => store.get(id));
}

export function deleteAttachment(fileOrId) {
  if (fileOrId && typeof fileOrId === 'object' && fileOrId.storage === 'supabase' && fileOrId.path) {
    return deleteWorkspaceAttachment(fileOrId.path);
  }
  const id = typeof fileOrId === 'object' ? fileOrId.id : fileOrId;
  return transact('readwrite', (store) => store.delete(id));
}

/** Upload legacy IndexedDB disposal files during the first cloud bootstrap. */
export async function migrateWorkspaceAttachments(snapshot = {}) {
  if (!supabaseConfigured || !Array.isArray(snapshot.lifecycleActions)) return snapshot;
  let changed = false;
  const lifecycleActions = await Promise.all(snapshot.lifecycleActions.map(async (action) => {
    if (!Array.isArray(action.documents) || !action.documents.some((file) => file.storage === 'indexeddb')) return action;
    const documents = await Promise.all(action.documents.map(async (file) => {
      if (file.storage !== 'indexeddb') return file;
      try {
        const stored = await loadAttachment(file);
        if (!stored?.blob) return file;
        changed = true;
        return await uploadWorkspaceAttachment(file.id, new File([stored.blob], file.name || stored.name || 'attachment', { type: file.type || stored.type || 'application/octet-stream' }));
      } catch (error) {
        console.warn('Legacy disposal attachment could not be uploaded', file.id, error);
        return file;
      }
    }));
    return { ...action, documents };
  }));
  return changed ? { ...snapshot, lifecycleActions } : snapshot;
}
import {
  deleteWorkspaceAttachment,
  downloadWorkspaceAttachment,
  supabaseConfigured,
  uploadWorkspaceAttachment
} from './supabase.js';
