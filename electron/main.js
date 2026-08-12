import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !!process.env.VITE_DEV_SERVER_URL;
const STORE_PATH = path.join(app.getPath('userData'), 'inventory-store.json');
const MAIL_OUTBOX_PATH = path.join(app.getPath('userData'), 'mail-outbox.json');
const APP_ICON_PATH = isDev
  ? path.join(__dirname, '..', 'public', 'brand', 'msbm-app-icon.png')
  : path.join(__dirname, '..', 'dist', 'brand', 'msbm-app-icon.png');

let mainWindow = null;

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function writeStore(data) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to write store', e);
    return false;
  }
}

function saveLocalMail(message) {
  try {
    let entries = [];
    try { entries = JSON.parse(fs.readFileSync(MAIL_OUTBOX_PATH, 'utf8')); } catch { /* first message */ }
    entries.unshift({ ...message, id: `MAIL-${Date.now()}`, createdAt: new Date().toISOString(), status: 'Recorded locally' });
    fs.mkdirSync(path.dirname(MAIL_OUTBOX_PATH), { recursive: true });
    fs.writeFileSync(MAIL_OUTBOX_PATH, JSON.stringify(entries), 'utf8');
    return { ok: true, local: true };
  } catch (error) {
    console.error('Failed to record local mail', error);
    return { ok: false, error: error.message };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#f5f6f8',
    icon: APP_ICON_PATH,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.on('console-message', (_evt, level, message, line, sourceId) => {
    if (level >= 2) console.error('[renderer]', message, sourceId + ':' + line);
  });
  mainWindow.webContents.on('render-process-gone', (_evt, details) => console.error('[renderer] gone', details));

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:state', { maximized: true }));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:state', { maximized: false }));

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:toggleMaximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => !!mainWindow?.isMaximized());

ipcMain.handle('store:load', () => readStore());
ipcMain.handle('store:save', (_evt, data) => writeStore(data));
ipcMain.handle('mail:send', (_evt, message) => saveLocalMail(message));
ipcMain.handle('external:open', async (_evt, requestedUrl) => {
  try {
    const url = new URL(String(requestedUrl || ''));
    const allowed = url.protocol === 'https:' && ['outlook.office.com', 'outlook.office365.com'].includes(url.hostname);
    if (!allowed) return { ok: false, error: 'Only approved Outlook Web links can be opened.' };
    await shell.openExternal(url.toString());
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
});
ipcMain.handle('pdf:save-procurement', (_evt, bytes, requestedName) => {
  try {
    const safeName = String(requestedName || 'MSBM-Procurement-Approval.pdf').replace(/[^a-zA-Z0-9._-]/g, '-');
    const approvalDirectory = path.join(app.getPath('documents'), 'MSBM IT Inventory', 'Procurement Approvals');
    fs.mkdirSync(approvalDirectory, { recursive: true });
    const filePath = path.join(approvalDirectory, safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`);
    fs.writeFileSync(filePath, Buffer.from(bytes));
    return { ok: true, path: filePath };
  } catch (error) {
    console.error('Failed to save procurement approval PDF', error);
    return { ok: false, error: error.message };
  }
});
ipcMain.handle('pdf:save-maintenance', (_evt, bytes, requestedName) => {
  try {
    const safeName = String(requestedName || 'MSBM-Repair-Ticket.pdf').replace(/[^a-zA-Z0-9._-]/g, '-');
    const maintenanceDirectory = path.join(app.getPath('documents'), 'MSBM IT Inventory', 'Maintenance Tickets');
    fs.mkdirSync(maintenanceDirectory, { recursive: true });
    const filePath = path.join(maintenanceDirectory, safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`);
    fs.writeFileSync(filePath, Buffer.from(bytes));
    return { ok: true, path: filePath };
  } catch (error) {
    console.error('Failed to save maintenance PDF', error);
    return { ok: false, error: error.message };
  }
});
ipcMain.handle('print:preview', async (_evt, bytes, requestedName) => {
  try {
    const safeName = String(requestedName || 'Checkout-Agreement.pdf').replace(/[^a-zA-Z0-9._-]/g, '-');
    const previewDirectory = path.join(app.getPath('temp'), 'msbm-it-inventory-print-preview');
    fs.mkdirSync(previewDirectory, { recursive: true });
    const previewPath = path.join(previewDirectory, safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`);
    fs.writeFileSync(previewPath, Buffer.from(bytes));
    const error = await shell.openPath(previewPath);
    return error ? { ok: false, error } : { ok: true };
  } catch (error) {
    console.error('Failed to open print preview', error);
    return { ok: false, error: error.message };
  }
});

if (process.platform === 'win32') app.setAppUserModelId('edu.uwi.mona.msbm.it-inventory');

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
