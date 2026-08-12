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

export function saveAttachment(id, file) {
  return transact('readwrite', (store) => store.put({ id, blob: file, name: file.name, type: file.type, size: file.size, savedAt: new Date().toISOString() }));
}

export function loadAttachment(id) {
  return transact('readonly', (store) => store.get(id));
}

export function deleteAttachment(id) {
  return transact('readwrite', (store) => store.delete(id));
}
