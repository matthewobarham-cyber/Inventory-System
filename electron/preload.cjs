const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowState: (cb) => {
    const listener = (_evt, state) => cb(state);
    ipcRenderer.on('window:state', listener);
    return () => ipcRenderer.removeListener('window:state', listener);
  },
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (data) => ipcRenderer.invoke('store:save', data),
  saveRecentCredential: (email, password) => ipcRenderer.invoke('credentials:save-recent', email, password),
  loadRecentCredential: (email) => ipcRenderer.invoke('credentials:load-recent', email),
  deleteRecentCredential: (email) => ipcRenderer.invoke('credentials:delete-recent', email),
  sendMail: (message) => ipcRenderer.invoke('mail:send', message),
  openExternal: (url) => ipcRenderer.invoke('external:open', url),
  saveProcurementPdf: (bytes, fileName) => ipcRenderer.invoke('pdf:save-procurement', bytes, fileName),
  saveMaintenancePdf: (bytes, fileName) => ipcRenderer.invoke('pdf:save-maintenance', bytes, fileName),
  openPrintPreview: (bytes, fileName) => ipcRenderer.invoke('print:preview', bytes, fileName)
});
