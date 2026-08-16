import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACCOUNTS, NAV, LABELS, BUILDINGS, MODELS, SUPPLIERS,
  iso, today, isLowStock, needsStockAttention, money, glbUrl,
  ROTATION_SPEED, DEFAULT_VIEW, LOAN_TERM_DAYS
} from './data.js';
import { loadPersisted, savePersisted, loadSessionPointer, saveSessionPointer, clearSessionPointer } from './store.js';
import { migrateWorkspaceAttachments } from './attachment-store.js';
import { sendHelpdeskMail } from './mailer.js';
import { classifyEquipment } from './csv-import.js';
import { Inv3D } from './three-engine.js';
import {
  supabaseConfigured, signInWithSupabase, loadSupabaseSessionAccount, listSupabaseAccounts,
  createSupabaseAccount, resetSupabaseAccountPassword, updateSupabaseProfile, updateOwnSupabaseAvatar,
  requestSupabasePasswordReset, updateSupabasePassword, subscribeToPasswordRecovery, signOutSupabase,
  loadSupabaseCsvSnapshot, storeSupabaseCsvImport, loadSupabaseWorkspaceSnapshot,
  saveSupabaseWorkspaceSnapshot, subscribeToSupabaseWorkspace
} from './supabase.js';

import Titlebar from './components/Titlebar.jsx';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import { rememberSuccessfulLogin } from './recent-logins.js';
import PasswordRecoveryModal from './components/PasswordRecoveryModal.jsx';
import GlobalScanModal from './components/GlobalScanModal.jsx';
import Toast from './components/Toast.jsx';
import BlankBarcodeModal from './components/BlankBarcodeModal.jsx';
import AssetFormModal from './components/AssetFormModal.jsx';
import CheckoutModal from './components/CheckoutModal.jsx';
import CheckoutAgreementModal from './components/CheckoutAgreementModal.jsx';
import CheckInModal from './components/CheckInModal.jsx';
import ReorderModal from './components/ReorderModal.jsx';
import OrderDetailsModal from './components/OrderDetailsModal.jsx';
import OrderApprovalModal from './components/OrderApprovalModal.jsx';
import ReceiveOrderModal from './components/ReceiveOrderModal.jsx';
import MyProfileModal from './components/MyProfileModal.jsx';

const workspaceModuleLoaders = {
  Dashboard: () => import('./components/Dashboard.jsx'),
  Inventory: () => import('./components/Inventory.jsx'),
  StaffBorrowing: () => import('./components/StaffBorrowing.jsx'),
  Consumables: () => import('./components/Consumables.jsx'),
  ItemDetail: () => import('./components/ItemDetail.jsx'),
  Loans: () => import('./components/Loans.jsx'),
  LoanHistory: () => import('./components/LoanHistory.jsx'),
  Requests: () => import('./components/Requests.jsx'),
  Alerts: () => import('./components/Alerts.jsx'),
  PendingOrders: () => import('./components/PendingOrders.jsx'),
  PlacementQueue: () => import('./components/PlacementQueue.jsx'),
  Scan: () => import('./components/Scan.jsx'),
  Reports: () => import('./components/Reports.jsx'),
  Settings: () => import('./components/Settings.jsx'),
  Stocktakes: () => import('./components/Stocktakes.jsx'),
  Maintenance: () => import('./components/Maintenance.jsx'),
  Lifecycle: () => import('./components/Lifecycle.jsx'),
  Disposal: () => import('./components/Disposal.jsx'),
  OrderApprovalPdf: () => import('./order-approval-pdf.js')
};

const Dashboard = lazy(workspaceModuleLoaders.Dashboard);
const Inventory = lazy(workspaceModuleLoaders.Inventory);
const StaffBorrowing = lazy(workspaceModuleLoaders.StaffBorrowing);
const Consumables = lazy(workspaceModuleLoaders.Consumables);
const ItemDetail = lazy(workspaceModuleLoaders.ItemDetail);
const Loans = lazy(workspaceModuleLoaders.Loans);
const LoanHistory = lazy(workspaceModuleLoaders.LoanHistory);
const Requests = lazy(workspaceModuleLoaders.Requests);
const Alerts = lazy(workspaceModuleLoaders.Alerts);
const PendingOrders = lazy(workspaceModuleLoaders.PendingOrders);
const PlacementQueue = lazy(workspaceModuleLoaders.PlacementQueue);
const Scan = lazy(workspaceModuleLoaders.Scan);
const Reports = lazy(workspaceModuleLoaders.Reports);
const Settings = lazy(workspaceModuleLoaders.Settings);
const Stocktakes = lazy(workspaceModuleLoaders.Stocktakes);
const Maintenance = lazy(workspaceModuleLoaders.Maintenance);
const Lifecycle = lazy(workspaceModuleLoaders.Lifecycle);
const Disposal = lazy(workspaceModuleLoaders.Disposal);

let workspaceCodeWarmup;
function preloadWorkspaceCode() {
  if (!workspaceCodeWarmup) workspaceCodeWarmup = Promise.all(Object.values(workspaceModuleLoaders).map((load) => load()));
  return workspaceCodeWarmup;
}

window.__inv3dSpeed = ROTATION_SPEED;
const ACTIVE_REPAIR_STATES = ['Open', 'In progress', 'Awaiting vendor'];
const DISPOSITION_ACTION_TYPES = ['Disposal', 'Donation', 'Write-off', 'Loss'];
const LOCAL_PASSWORD_HASHES = {
  'a.hosein@uwi.edu': '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
};

async function hashPassword(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const asArray = (value) => Array.isArray(value) ? value : [];
const isPrinterSupplyModel = (model) => Boolean(model?.cons === 1 && (
  model.id === 'printer-toner' || /toner|ink cartridge|printer cartridge/i.test(`${model.name || ''} ${model.id || ''}`)
));
const normalizeNavOverrides = (stored = {}) => Object.fromEntries(Object.entries(NAV).map(([role, defaults]) => {
  const source = Array.isArray(stored?.[role]) ? stored[role] : defaults;
  const hadLegacyAdministration = source.includes('imports') || source.includes('users');
  const migrated = hadLegacyAdministration && !source.includes('settings') ? [...source, 'settings'] : source;
  const allowed = migrated.filter((screen) => LABELS[screen] && !['imports', 'users'].includes(screen));
  if (defaults.includes('consumables') && !allowed.includes('consumables')) {
    const inventoryIndex = allowed.indexOf('inventory');
    allowed.splice(inventoryIndex < 0 ? allowed.length : inventoryIndex + 1, 0, 'consumables');
  }
  if (defaults.includes('disposal') && !allowed.includes('disposal')) {
    const lifecycleIndex = allowed.indexOf('lifecycle');
    allowed.splice(lifecycleIndex < 0 ? allowed.length : lifecycleIndex + 1, 0, 'disposal');
  }
  if (role === 'Admin' && !allowed.includes('settings')) allowed.push('settings');
  return [role, Array.from(new Set(allowed))];
}));
const MSBM_ASSET_TAG = /^MSBM\/([A-Z0-9]+)\/\s*(\d+)[A-Z]?\s*\//i;
const parseMsbmAssetTag = (tag) => {
  const match = MSBM_ASSET_TAG.exec(String(tag || '').trim());
  return match ? { code: match[1].toUpperCase(), sequence: Number(match[2]) } : null;
};
const highestEstablishedSequence = (tags, code) => {
  const normalizedCode = String(code || '').toUpperCase();
  const numbers = Array.from(new Set(tags.map(parseMsbmAssetTag)
    .filter((parsed) => parsed?.code === normalizedCode)
    .map((parsed) => parsed.sequence)
    .filter(Number.isFinite))).sort((a, b) => a - b);
  while (numbers.length > 1) {
    const last = numbers.at(-1);
    const previous = numbers.at(-2);
    if (last - previous <= Math.max(250, previous * .5)) break;
    numbers.pop();
  }
  return numbers.at(-1) || 0;
};
const formatMsbmAssetTag = (code, sequence, dateValue = new Date()) => {
  const parsed = dateValue instanceof Date ? dateValue : new Date(`${dateValue || ''}T12:00:00`);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `MSBM/${String(code || 'EQP').toUpperCase()}/${sequence}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
};
const expectedReplacementFrom = (purchaseValue, usefulLifeYears) => {
  const years = Number.parseInt(usefulLifeYears, 10);
  if (!Number.isFinite(years) || years < 1) return '';
  const purchaseDate = purchaseValue instanceof Date ? new Date(purchaseValue) : new Date(`${purchaseValue || ''}T12:00:00`);
  if (Number.isNaN(purchaseDate.getTime())) return '';
  const originalMonth = purchaseDate.getMonth();
  purchaseDate.setFullYear(purchaseDate.getFullYear() + years);
  // Keep leap-day assets at the end of February instead of rolling into March.
  if (purchaseDate.getMonth() !== originalMonth) purchaseDate.setDate(0);
  return iso(purchaseDate);
};

function freshWorld() {
  return { items: [], history: [], requests: [], orders: [], placements: [], stocktakes: [], repairTickets: [], maintenanceSchedules: [], lifecycleActions: [], procurementRecords: [], importRuns: [], csvCloudCursor: '', auditLog: [], userState: {}, profileState: {}, customAccounts: [], reservedBarcodes: [], approvedVendors: [], approvalContacts: [], maintenanceContacts: [], loanContacts: [], consumableUsage: [], borrowCategoryAccess: {} };
}

const SHARED_WORKSPACE_ARRAY_FIELDS = [
  'items', 'history', 'requests', 'orders', 'placements', 'stocktakes',
  'repairTickets', 'maintenanceSchedules', 'lifecycleActions',
  'procurementRecords', 'importRuns', 'auditLog', 'reservedBarcodes',
  'approvedVendors', 'approvalContacts', 'maintenanceContacts', 'loanContacts',
  'consumableUsage'
];

function sharedWorkspaceSnapshot(source = {}) {
  return {
    ...Object.fromEntries(SHARED_WORKSPACE_ARRAY_FIELDS.map((field) => [field, asArray(source[field])])),
    navOverrides: source.navOverrides && typeof source.navOverrides === 'object' ? source.navOverrides : NAV,
    borrowCategoryAccess: source.borrowCategoryAccess && typeof source.borrowCategoryAccess === 'object' ? source.borrowCategoryAccess : {}
  };
}

const isBorrowingApproved = (item, categoryAccess = {}) => {
  if (!item || item.archived || item.consumable || item.disposalApproved || item.status === 'Retired') return false;
  if (item.borrowEligibility === 'allowed') return true;
  if (item.borrowEligibility === 'blocked') return false;
  return categoryAccess[item.category] === true;
};

const mergeCachedCsvRecords = (local = [], cloud = []) => {
  const merged = new Map();
  cloud.forEach((entry) => merged.set(entry.importKey || entry.id, entry));
  local.forEach((entry) => merged.set(entry.importKey || entry.id, entry));
  return Array.from(merged.values());
};

const MODEL_WARMUP_LIMIT = 64;
const MODEL_WARMUP_TIMEOUT_MS = 10000;
const TONER_MODEL_URLS = ['cyan', 'magenta', 'yellow', 'black'].map((color) => `generated/models/toner-${color}.glb`);

function workspaceModelUrls(items = []) {
  const priorityIds = [
    'multifunction-printer', 'laser-printer', 'printer-toner', 'laptop', 'monitor',
    ...items.filter((item) => item.status === 'On loan' || item.status === 'Maintenance' || isLowStock(item)).map((item) => item.model),
    ...items.map((item) => item.model),
    ...MODELS.map((model) => model.id)
  ];
  const urls = [];
  const seen = new Set();
  priorityIds.forEach((id) => {
    if (!id || seen.has(id) || urls.length >= MODEL_WARMUP_LIMIT) return;
    seen.add(id);
    try { urls.push(glbUrl(id)); } catch { /* Ignore stale catalogue model ids. */ }
  });
  return [...TONER_MODEL_URLS, ...urls];
}

function waitForWarmup(promise) {
  if (!promise) return Promise.resolve();
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(resolve, MODEL_WARMUP_TIMEOUT_MS))
  ]);
}

function prepareWorkspaceResources(modelPromise) {
  return Promise.all([preloadWorkspaceCode(), waitForWarmup(modelPromise)]);
}

function afterNextPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function WorkspaceLoginOverlay({ phase }) {
  return <div className="workspace-login-overlay" role="status" aria-live="polite" aria-label={phase}>
    <div className="workspace-login-card">
      <img src="brand/msbm-lockup.png" alt="MSBM" />
      <span className="workspace-login-spinner" aria-hidden="true" />
      <strong>Logging in</strong>
      <small>{phase}</small>
      <div className="workspace-login-progress"><i /></div>
    </div>
  </div>;
}

function WorkspacePanel({ name, activeScreen, children }) {
  const active = activeScreen === name;
  return <div className={`workspace-screen${active ? ' active' : ''}`} data-app-content-scroll="true" aria-hidden={!active}>{children}</div>;
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [persistenceEpoch, setPersistenceEpoch] = useState(0);
  const [session, setSession] = useState(null);
  const [loginPhase, setLoginPhase] = useState('');
  const [workspaceMounted, setWorkspaceMounted] = useState(false);
  const [sharedWorkspaceConnected, setSharedWorkspaceConnected] = useState(false);

  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [history, setHistory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [stocktakes, setStocktakes] = useState([]);
  const [repairTickets, setRepairTickets] = useState([]);
  const [maintenanceSchedules, setMaintenanceSchedules] = useState([]);
  const [lifecycleActions, setLifecycleActions] = useState([]);
  const [procurementRecords, setProcurementRecords] = useState([]);
  const [importRuns, setImportRuns] = useState([]);
  const [csvCloudCursor, setCsvCloudCursor] = useState('');
  const [auditLog, setAuditLog] = useState([]);
  const [seenAlertIds, setSeenAlertIds] = useState([]);
  const [alertPreferences, setAlertPreferences] = useState({ muted: true });
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const [userState, setUserState] = useState({});
  const [profileState, setProfileState] = useState({});
  const [customAccounts, setCustomAccounts] = useState([]);
  const [remoteAccounts, setRemoteAccounts] = useState([]);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [navOverrides, setNavOverrides] = useState(NAV);
  const [recentScans, setRecentScans] = useState([]);
  const [detectedScan, setDetectedScan] = useState(null);
  const [reservedBarcodes, setReservedBarcodes] = useState([]);
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [approvalContacts, setApprovalContacts] = useState([]);
  const [maintenanceContacts, setMaintenanceContacts] = useState([]);
  const [loanContacts, setLoanContacts] = useState([]);
  const [consumableUsage, setConsumableUsage] = useState([]);
  const [borrowCategoryAccess, setBorrowCategoryAccess] = useState({});
  const [consumableScannerAction, setConsumableScannerAction] = useState(null);
  const [blankBarcodeOpen, setBlankBarcodeOpen] = useState(false);
  const [scannerLabelQueue, setScannerLabelQueue] = useState([]);
  const [scannerLabelFocusSignal, setScannerLabelFocusSignal] = useState(0);
  const [lifecycleFocus, setLifecycleFocus] = useState({ itemId: '', nonce: 0 });

  const [screen, setScreen] = useState('dashboard');
  const [sidebarMotion, setSidebarMotion] = useState('');
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const [topActionSignal, setTopActionSignal] = useState({ screen: '', nonce: 0 });
  const [navigationAvailability, setNavigationAvailability] = useState({ back: false, forward: false });
  const [myProfileOpen, setMyProfileOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [filters, setFilters] = useState({ query: '', fCategory: 'All categories', fLocation: 'All buildings', fStatus: 'All statuses' });
  const [view, setView] = useState(DEFAULT_VIEW);
  const [inventoryResetKey, setInventoryResetKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [form, setForm] = useState({});
  const [formError, setFormError] = useState('');
  const [placementSource, setPlacementSource] = useState(null);
  const [placementProgress, setPlacementProgress] = useState(null);

  const [coOpen, setCoOpen] = useState(false);
  const [coItem, setCoItem] = useState(null);
  const [coBorrower, setCoBorrower] = useState('');
  const [coDue, setCoDue] = useState('');
  const [coLoanedBy, setCoLoanedBy] = useState('');
  const [coPeriod, setCoPeriod] = useState(String(LOAN_TERM_DAYS));
  const [coError, setCoError] = useState('');
  const [checkoutAgreement, setCheckoutAgreement] = useState(null);

  const [ciOpen, setCiOpen] = useState(false);
  const [ciItem, setCiItem] = useState(null);
  const [ciForm, setCiForm] = useState({});
  const [ciError, setCiError] = useState('');

  const [orderOpen, setOrderOpen] = useState(false);
  const [orderItem, setOrderItem] = useState(null);
  const [orderForm, setOrderForm] = useState({});
  const [orderError, setOrderError] = useState('');
  const [orderDetailsId, setOrderDetailsId] = useState(null);
  const [approvalOrderId, setApprovalOrderId] = useState(null);
  const [receiveOrderId, setReceiveOrderId] = useState(null);
  const [receiveForm, setReceiveForm] = useState({ receivedQty: 1, damagedQty: 0, note: '' });
  const [receiveError, setReceiveError] = useState('');

  const [toastMsg, setToastMsg] = useState('');
  const [toastAction, setToastAction] = useState(null);
  const [toastTone, setToastTone] = useState('default');
  const [dashboardRequestFocus, setDashboardRequestFocus] = useState({ id: '', nonce: 0 });
  const [saveError, setSaveError] = useState('');
  const toastTimer = useRef(null);
  const hydrated = useRef(false);
  const modelWarmup = useRef(null);
  const navigationHistory = useRef([]);
  const navigationHistoryIndex = useRef(-1);
  const applyingNavigationHistory = useRef(false);
  const checkoutFinalizing = useRef(false);
  const lastGlobalScan = useRef({ value: '', at: 0 });
  const csvSyncPromise = useRef(null);
  const sidebarMotionTimer = useRef(null);
  const currentSharedWorkspaceRef = useRef(null);
  const cloudSession = supabaseConfigured && session?.source === 'supabase';

  const handleSidebarCollapse = useCallback((collapsed) => {
    if (sidebarMotionTimer.current) clearTimeout(sidebarMotionTimer.current);
    setSidebarMotion(collapsed ? 'collapsing' : 'expanding');
    sidebarMotionTimer.current = setTimeout(() => {
      sidebarMotionTimer.current = null;
      setSidebarMotion('');
    }, 210);
  }, []);

  useEffect(() => () => {
    if (sidebarMotionTimer.current) clearTimeout(sidebarMotionTimer.current);
  }, []);

  useEffect(() => subscribeToPasswordRecovery(() => setPasswordRecovery(true)), []);

  const enqueueDetectedScan = useCallback((scan) => {
    const at = new Date(scan.detectedAt).getTime();
    if (lastGlobalScan.current.value === scan.value.toUpperCase() && at - lastGlobalScan.current.at < 650) return;
    lastGlobalScan.current = { value: scan.value.toUpperCase(), at };
    setDetectedScan(scan);
  }, []);

  const toast = useCallback((msg, action = null) => {
    setToastMsg(msg);
    setToastAction(action?.label ? action : null);
    setToastTone(action?.tone || 'default');
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => { setToastMsg(''); setToastAction(null); setToastTone('default'); }, action?.label ? 6500 : 2600);
  }, []);

  const currentSharedWorkspace = useMemo(() => sharedWorkspaceSnapshot({
    items, history, requests, orders, placements, stocktakes, repairTickets,
    maintenanceSchedules, lifecycleActions, procurementRecords, importRuns,
    auditLog, reservedBarcodes, approvedVendors, approvalContacts,
    maintenanceContacts, loanContacts, consumableUsage, navOverrides,
    borrowCategoryAccess
  }), [
    items, history, requests, orders, placements, stocktakes, repairTickets,
    maintenanceSchedules, lifecycleActions, procurementRecords, importRuns,
    auditLog, reservedBarcodes, approvedVendors, approvalContacts,
    maintenanceContacts, loanContacts, consumableUsage, navOverrides,
    borrowCategoryAccess
  ]);
  currentSharedWorkspaceRef.current = currentSharedWorkspace;

  const applySharedWorkspace = useCallback((world) => {
    if (!world) return;
    setItems(asArray(world.items));
    setHistory(asArray(world.history));
    setRequests(asArray(world.requests));
    setOrders(asArray(world.orders));
    setPlacements(asArray(world.placements));
    setStocktakes(asArray(world.stocktakes));
    setRepairTickets(asArray(world.repairTickets));
    setMaintenanceSchedules(asArray(world.maintenanceSchedules));
    setLifecycleActions(asArray(world.lifecycleActions));
    setProcurementRecords(asArray(world.procurementRecords));
    setImportRuns(asArray(world.importRuns));
    setAuditLog(asArray(world.auditLog));
    setReservedBarcodes(asArray(world.reservedBarcodes));
    setApprovedVendors(asArray(world.approvedVendors));
    setApprovalContacts(asArray(world.approvalContacts));
    setMaintenanceContacts(asArray(world.maintenanceContacts));
    setLoanContacts(asArray(world.loanContacts));
    setConsumableUsage(asArray(world.consumableUsage));
    setNavOverrides(normalizeNavOverrides(world.navOverrides));
    setBorrowCategoryAccess(world.borrowCategoryAccess && typeof world.borrowCategoryAccess === 'object' ? world.borrowCategoryAccess : {});
    if (world.items?.length) modelWarmup.current = Inv3D.preload(workspaceModelUrls(world.items));
  }, []);

  const syncSharedCsvCache = async () => {
    if (!supabaseConfigured) return { unchanged: true };
    if (csvSyncPromise.current) return csvSyncPromise.current;
    csvSyncPromise.current = (async () => {
      const cloudCsv = await loadSupabaseCsvSnapshot(csvCloudCursor);
      if (cloudCsv.unchanged) return cloudCsv;
      setItems((current) => mergeCachedCsvRecords(current, cloudCsv.assets));
      setProcurementRecords((current) => mergeCachedCsvRecords(current, cloudCsv.procurement));
      setImportRuns((current) => mergeCachedCsvRecords(current, cloudCsv.runs));
      setCsvCloudCursor(cloudCsv.cursor);
      if (cloudCsv.assets.length) modelWarmup.current = Inv3D.preload(workspaceModelUrls(cloudCsv.assets));
      return cloudCsv;
    })();
    try { return await csvSyncPromise.current; }
    finally { csvSyncPromise.current = null; }
  };

  const logAudit = useCallback((action, details) => {
    if (!session) return;
    const at = new Date().toISOString();
    setAuditLog((current) => [{ id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at, retainedUntil: new Date(Date.now() + 365 * 864e5).toISOString(), by: session.name, byEmail: session.email, action, details }, ...current]);
  }, [session]);

  // ---- boot: load persisted world, then resume any remembered session ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadPersisted();
      const world = stored && Array.isArray(stored.items) ? stored : freshWorld();
      if (cancelled) return;
      const migrateEntry = (entry) => {
        const reclassifiedModel = entry.sourceFile && (entry.classificationVersion || 0) < 4
          ? classifyEquipment(`${entry.name || ''} ${entry.importedType || ''} ${entry.modelNumber || ''} ${entry.notes || ''}`)
          : null;
        const establishedModel = MODELS.find((model) => model.id === (reclassifiedModel?.id || entry.model));
        const isStorageRecord = /(?:^|\b)(?:storage|store\s*room|storeroom|stock\s*room)(?:\b|$)/i.test(`${entry.location || ''} ${entry.room || ''}`);
        return ({
        ...entry,
        ...(establishedModel ? { consumable: establishedModel.cons === 1, category: establishedModel.cat, rank: establishedModel.rank } : {}),
        ...(reclassifiedModel ? { model: reclassifiedModel.id, category: reclassifiedModel.cat, consumable: reclassifiedModel.cons === 1, rank: reclassifiedModel.rank, classificationVersion: 4 } : {}),
        ...(entry.model === 'laptop' && /macbook air/i.test(entry.name || '') ? { name: 'Laptop' } : {}),
        ...(entry.location === 'Building C' ? { location: 'Building D', room: (entry.room || '').replace(/^C-/, 'D-') } : {}),
        ...(isStorageRecord ? { location: 'Storage room', room: entry.room || 'Main storage', assignedTo: '' } : {}),
        ...(entry.office?.includes('Building C') ? { office: entry.office.replace('Building C', 'Building D') } : {}),
        ...(entry.need?.includes('Building C') ? { need: entry.need.replace('Building C', 'Building D') } : {})
      });
      };
      const migratedItems = world.items.map(migrateEntry);
      modelWarmup.current = Inv3D.preload(workspaceModelUrls(migratedItems));
      setItems(migratedItems);
      setHistory((world.history || []).map(migrateEntry));
      const migratedRequests = asArray(world.requests).map((entry) => {
        const migrated = migrateEntry(entry);
        if (migrated.type === 'Requisition' || migrated.itemId) return migrated;
        const item = world.items.find((candidate) => candidate.model === migrated.model && candidate.status === 'In stock' && !candidate.consumable);
        const requester = (world.accounts || ACCOUNTS).find((account) => account.name === migrated.by);
        return { ...migrated, itemId: item?.id || null, itemTag: item?.tag || '', byEmail: requester?.email || '' };
      });
      const migratedOrders = (world.orders || []).map((entry) => {
        const migrated = migrateEntry(entry);
        return { ...migrated, requisitionNumber: migrated.requisitionNumber || migrated.reference || '', purchaseOrderNumber: migrated.purchaseOrderNumber || '' };
      });
      const hydratedAccounts = [...ACCOUNTS, ...asArray(world.customAccounts)].map((account) => ({ ...account, ...((world.profileState || {})[account.email] || {}) }));
      const adminNames = new Set(hydratedAccounts.filter((account) => account.role === 'Admin').map((account) => account.name));
      const linkedRequisitions = new Set(migratedOrders.map((order) => order.requisitionId).filter(Boolean));
      const activeOrderItems = new Set(migratedOrders.filter((order) => ['Pending', 'Partially received'].includes(order.status)).map((order) => order.itemId));
      const promotedRequisitions = migratedRequests.filter((request) => request.type === 'Requisition' && request.state === 'Pending' && request.orderDraft && adminNames.has(request.by) && !linkedRequisitions.has(request.id) && !activeOrderItems.has(request.itemId));
      const promotedIds = new Set(promotedRequisitions.map((request) => request.id));
      setRequests(migratedRequests.map((request) => promotedIds.has(request.id) ? { ...request, state: 'Approved', approvedBy: request.by, approvedOn: request.submittedOn || iso(today()), migratedToOrder: true } : request));
      const hydratedOrders = [
        ...promotedRequisitions.map((request) => ({ id: `ord-${request.id}`, ...request.orderDraft, requisitionId: request.id, requisitionNumber: request.orderDraft.requisitionNumber || `REQ-${String(request.id).replace(/^req/, '')}`, orderedOn: request.submittedOn || iso(today()), orderedBy: request.by, approvedBy: request.by, approvedOn: request.submittedOn || iso(today()), status: 'Pending' })),
        ...migratedOrders
      ];
      setOrders(hydratedOrders);
      setPlacements((world.placements || []).map(migrateEntry));
      setStocktakes(asArray(world.stocktakes).map((entry) => {
        const expectedIds = asArray(entry.expectedIds);
        const expectedAssets = asArray(entry.expectedAssets);
        if (entry.status !== 'In progress' || Array.isArray(entry.excludedAssets)) {
          return { ...entry, expectedIds, expectedAssets, observations: entry.observations && typeof entry.observations === 'object' ? entry.observations : {}, excludedAssets: asArray(entry.excludedAssets) };
        }
        // Repair sessions created before checked-out assets were treated as
        // legitimate off-site exclusions.
        const checkedOutIds = new Set(expectedIds.filter((id) => migratedItems.find((item) => item.id === id)?.status === 'On loan'));
        const excludedAssets = expectedAssets.filter((asset) => checkedOutIds.has(asset.id)).map((asset) => ({ ...asset, status: 'On loan' }));
        return {
          ...entry,
          expectedIds: expectedIds.filter((id) => !checkedOutIds.has(id)),
          expectedAssets: expectedAssets.filter((asset) => !checkedOutIds.has(asset.id)),
          excludedAssets,
          observations: entry.observations && typeof entry.observations === 'object' ? entry.observations : {}
        };
      }));
      setRepairTickets(world.repairTickets || []);
      setMaintenanceSchedules(world.maintenanceSchedules || []);
      setLifecycleActions(world.lifecycleActions || []);
      setProcurementRecords(world.procurementRecords || []);
      setImportRuns(world.importRuns || []);
      setCsvCloudCursor(world.csvCloudCursor || '');
      setAuditLog(world.auditLog || []);
      setSeenAlertIds(asArray(world.seenAlertIds));
      setAlertPreferences({ muted: true, ...(world.alertPreferences || {}) });
      setUserState(world.userState || {});
      setProfileState(world.profileState || {});
      setCustomAccounts(asArray(world.customAccounts));
      setReservedBarcodes(asArray(world.reservedBarcodes));
      setApprovedVendors(asArray(world.approvedVendors));
      setApprovalContacts(asArray(world.approvalContacts));
      setMaintenanceContacts(asArray(world.maintenanceContacts));
      setLoanContacts(asArray(world.loanContacts));
      setConsumableUsage(asArray(world.consumableUsage));
      setBorrowCategoryAccess(world.borrowCategoryAccess && typeof world.borrowCategoryAccess === 'object' ? world.borrowCategoryAccess : {});
      const normalizedNav = normalizeNavOverrides(world.navOverrides);
      setNavOverrides(normalizedNav);
      const bootSharedSnapshot = sharedWorkspaceSnapshot({
        ...world,
        items: migratedItems,
        history: (world.history || []).map(migrateEntry),
        requests: migratedRequests.map((request) => promotedIds.has(request.id) ? { ...request, state: 'Approved', approvedBy: request.by, approvedOn: request.submittedOn || iso(today()), migratedToOrder: true } : request),
        orders: hydratedOrders,
        navOverrides: normalizedNav
      });

      if (supabaseConfigured) {
        const acct = await loadSupabaseSessionAccount();
        if (acct) {
          let accountNav = normalizedNav;
          try {
            const cloudCsv = await loadSupabaseCsvSnapshot(world.csvCloudCursor || '');
            if (!cloudCsv.unchanged) {
              const mergedItems = mergeCachedCsvRecords(migratedItems, cloudCsv.assets);
              setItems(mergedItems);
              setProcurementRecords(mergeCachedCsvRecords(world.procurementRecords || [], cloudCsv.procurement));
              setImportRuns(mergeCachedCsvRecords(world.importRuns || [], cloudCsv.runs));
              setCsvCloudCursor(cloudCsv.cursor);
              modelWarmup.current = Inv3D.preload(workspaceModelUrls(mergedItems));
            }
          } catch (error) { console.error('Failed to refresh the shared CSV cache', error); }
          try {
            const shared = await loadSupabaseWorkspaceSnapshot();
            if (shared.empty) {
              if (acct.role !== 'Admin') throw new Error('The shared inventory must be initialized by an administrator.');
              const migratedBootstrap = await migrateWorkspaceAttachments(bootSharedSnapshot);
              await saveSupabaseWorkspaceSnapshot(migratedBootstrap);
              applySharedWorkspace(migratedBootstrap);
            } else {
              applySharedWorkspace(shared.world);
              accountNav = normalizeNavOverrides(shared.world.navOverrides);
            }
            setSharedWorkspaceConnected(true);
          } catch (error) { console.error('Failed to hydrate the shared inventory workspace', error); }
          let cloudAccounts = [acct];
          try { cloudAccounts = await listSupabaseAccounts(); } catch (error) { console.error('Failed to load Supabase profiles', error); }
          setRemoteAccounts(cloudAccounts);
          setUserState((current) => ({ ...current, ...Object.fromEntries(cloudAccounts.map((entry) => [entry.email, entry.active !== false])) }));
          await prepareWorkspaceResources(modelWarmup.current);
          if (cancelled) return;
          setWorkspaceMounted(true);
          setSession(acct);
          setScreen(accountNav[acct.role]?.[0] || NAV[acct.role][0]);
        } else {
          const pointer = loadSessionPointer();
          const demo = pointer?.source === 'demo' ? ACCOUNTS.find((entry) => entry.email === pointer.email) : null;
          const local = pointer?.source === 'local'
            ? asArray(world.customAccounts).find((entry) => entry.email === pointer.email)
            : null;
          if (demo && (world.userState || {})[demo.email] !== false) {
            await prepareWorkspaceResources(modelWarmup.current);
            if (cancelled) return;
            setWorkspaceMounted(true);
            setSession({ ...demo, source: 'demo' });
            setScreen(normalizedNav[demo.role]?.[0] || NAV[demo.role][0]);
          } else if (local && (world.userState || {})[local.email] !== false) {
            await prepareWorkspaceResources(modelWarmup.current);
            if (cancelled) return;
            const { passwordHash: _passwordHash, ...safeLocal } = local;
            setWorkspaceMounted(true);
            setSession({ ...safeLocal, ...((world.profileState || {})[local.email] || {}), source: 'local' });
            setScreen(normalizedNav[local.role]?.[0] || NAV[local.role][0]);
          } else if (pointer?.source === 'demo' || pointer?.source === 'local') clearSessionPointer();
        }
      } else {
        const pointer = loadSessionPointer();
        if (pointer) {
          const acct = [...ACCOUNTS, ...asArray(world.customAccounts)].map((account) => ({ ...account, ...((world.profileState || {})[account.email] || {}) })).find((a) => a.email === pointer.email);
          const active = acct && (world.userState || {})[acct.email] !== false;
          if (acct && active) {
            await prepareWorkspaceResources(modelWarmup.current);
            if (cancelled) return;
            setWorkspaceMounted(true);
            setSession(acct);
            setScreen(normalizedNav[acct.role]?.[0] || NAV[acct.role][0]);
          } else clearSessionPointer();
        }
      }
      hydrated.current = true;
      setPersistenceEpoch((current) => current + 1);
      setBooted(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Carry disposal locks forward for records approved before this version added
  // the explicit asset-level flag.
  useEffect(() => {
    const approvedByItem = new Map(lifecycleActions
      .filter((action) => DISPOSITION_ACTION_TYPES.includes(action.type) && ['Approved', 'Completed'].includes(action.status))
      .map((action) => [action.itemId, action]));
    if (!approvedByItem.size) return;
    setItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        const action = approvedByItem.get(item.id);
        if (!action || (item.disposalApproved && item.borrowEligibility === 'blocked')) return item;
        changed = true;
        return {
          ...item,
          disposalApproved: true,
          disposalApprovedAt: item.disposalApprovedAt || action.decidedAt || action.completedAt || action.requestedAt,
          disposalApprovedBy: item.disposalApprovedBy || action.decidedBy || action.completedBy || 'Management',
          disposalApprovalReference: item.disposalApprovalReference || action.id,
          disposalApprovalType: item.disposalApprovalType || action.type,
          disposalReason: item.disposalReason || action.justification || '',
          borrowEligibility: 'blocked'
        };
      });
      return changed ? next : current;
    });
  }, [lifecycleActions]);

  // ---- persist world on every mutation (skips the initial hydration write) ----
  useEffect(() => {
    if (!hydrated.current) return;
    const snapshot = { items, history, requests, orders, placements, stocktakes, repairTickets, maintenanceSchedules, lifecycleActions, procurementRecords, importRuns, csvCloudCursor, auditLog, seenAlertIds, alertPreferences, navOverrides, userState, profileState, customAccounts, reservedBarcodes, approvedVendors, approvalContacts, maintenanceContacts, loanContacts, consumableUsage, borrowCategoryAccess };
    let cancelled = false;
    let retryTimer = null;
    let saveTimer = null;
    let idleSave = null;
    let backoff = 1000;
    const attempt = async () => {
      const saved = await savePersisted(snapshot);
      if (cancelled) return;
      if (!saved) {
        setSaveError('Changes could not be saved to disk. The application will keep retrying; do not close it.');
        retryTimer = setTimeout(attempt, backoff);
        backoff = Math.min(backoff * 2, 30000);
        return;
      }
      if (cloudSession && sharedWorkspaceConnected) {
        try {
          await saveSupabaseWorkspaceSnapshot(currentSharedWorkspace, {
            role: session?.role,
            email: session?.email
          });
        }
        catch (error) {
          if (cancelled) return;
          console.error('Shared inventory save failed', error);
          setSaveError('Saved locally, but Supabase synchronization is retrying. Keep this window open until the connection recovers.');
          retryTimer = setTimeout(attempt, backoff);
          backoff = Math.min(backoff * 2, 30000);
          return;
        }
      }
      if (cancelled) return;
      setSaveError('');
    };
    // Coalesce rapid mutations, then serialize the full workspace while the UI
    // is idle so a save cannot stall navigation or a running animation.
    saveTimer = setTimeout(() => {
      if (typeof requestIdleCallback === 'function') idleSave = requestIdleCallback(attempt, { timeout: 1000 });
      else attempt();
    }, 300);
    return () => {
      cancelled = true;
      if (saveTimer) clearTimeout(saveTimer);
      if (retryTimer) clearTimeout(retryTimer);
      if (idleSave !== null && typeof cancelIdleCallback === 'function') cancelIdleCallback(idleSave);
    };
  }, [items, history, requests, orders, placements, stocktakes, repairTickets, maintenanceSchedules, lifecycleActions, procurementRecords, importRuns, csvCloudCursor, auditLog, seenAlertIds, alertPreferences, navOverrides, userState, profileState, customAccounts, reservedBarcodes, approvedVendors, approvalContacts, maintenanceContacts, loanContacts, consumableUsage, borrowCategoryAccess, persistenceEpoch, cloudSession, sharedWorkspaceConnected, currentSharedWorkspace, session?.role, session?.email]);

  // Keep browser-style navigation local to the signed-in workspace.
  useEffect(() => {
    if (!session) {
      navigationHistory.current = [];
      navigationHistoryIndex.current = -1;
      applyingNavigationHistory.current = false;
      setNavigationAvailability({ back: false, forward: false });
      return;
    }

    if (applyingNavigationHistory.current) {
      applyingNavigationHistory.current = false;
    } else {
      const nextEntry = { screen, selectedId };
      const currentEntry = navigationHistory.current[navigationHistoryIndex.current];
      if (!currentEntry || currentEntry.screen !== nextEntry.screen || currentEntry.selectedId !== nextEntry.selectedId) {
        const nextHistory = navigationHistory.current.slice(0, navigationHistoryIndex.current + 1);
        nextHistory.push(nextEntry);
        navigationHistory.current = nextHistory;
        navigationHistoryIndex.current = nextHistory.length - 1;
      }
    }

    setNavigationAvailability({
      back: navigationHistoryIndex.current > 0,
      forward: navigationHistoryIndex.current < navigationHistory.current.length - 1
    });
  }, [screen, selectedId, session]);

  const moveThroughNavigationHistory = useCallback((direction) => {
    const nextIndex = navigationHistoryIndex.current + direction;
    const target = navigationHistory.current[nextIndex];
    if (!target) return;
    applyingNavigationHistory.current = true;
    navigationHistoryIndex.current = nextIndex;
    setScreen(target.screen);
    setSelectedId(target.selectedId || null);
    setNavigationAvailability({
      back: nextIndex > 0,
      forward: nextIndex < navigationHistory.current.length - 1
    });
  }, []);

  // ---- 3D engine: resync whenever the visible canvases could have changed ----
  useEffect(() => {
    const activeWorkspace = document.querySelector('.workspace-screen.active');
    if (!activeWorkspace?.querySelector('canvas[data-model], [data-detail-model]')) return;
    Inv3D.sync(activeWorkspace);
  }, [screen, view, selectedId, items.length, filters, session]);

  useEffect(() => {
    let observer;
    let frame;
    let cancelled = false;
    const scheduleSync = () => {
      if (frame || !document.querySelector('canvas[data-model], [data-detail-model]')) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!cancelled) Inv3D.sync();
      });
    };
    observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-model', 'data-detail-model'] });
    scheduleSync();
    return () => { cancelled = true; observer?.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => {
    if (!cloudSession || !sharedWorkspaceConnected) return undefined;
    let cancelled = false;
    let reloadTimer = null;
    const unsubscribe = subscribeToSupabaseWorkspace(() => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(async () => {
        try {
          // Publish any local edit already waiting in the debounce window before
          // applying another device's canonical record set.
          await saveSupabaseWorkspaceSnapshot(currentSharedWorkspaceRef.current || {}, {
            role: session?.role,
            email: session?.email
          });
          const shared = await loadSupabaseWorkspaceSnapshot();
          if (!cancelled && !shared.empty) applySharedWorkspace(shared.world);
        } catch (error) {
          console.error('Realtime shared workspace refresh failed', error);
        }
      }, 500);
    }, session?.id);
    return () => {
      cancelled = true;
      if (reloadTimer) clearTimeout(reloadTimer);
      unsubscribe();
    };
  }, [cloudSession, sharedWorkspaceConnected, session?.id, session?.role, session?.email, applySharedWorkspace]);

  useEffect(() => {
    if (!session) return undefined;
    const checkReminders = async () => {
      const todayIso = iso(today());
      const due = maintenanceSchedules.filter((schedule) => {
        if (!schedule.active || schedule.reminderEnabled === false || !schedule.nextDue || schedule.lastReminderSentFor === schedule.nextDue) return false;
        const reminderDays = Math.max(1, Number(schedule.reminderDays || 7));
        const reminderDate = iso(new Date(new Date(`${schedule.nextDue}T12:00:00`).getTime() - reminderDays * 864e5));
        return todayIso >= reminderDate && todayIso <= schedule.nextDue;
      });
      for (const schedule of due) {
        const reminderDays = Math.max(1, Number(schedule.reminderDays || 7));
        const sentAt = new Date().toISOString();
        const result = await sendHelpdeskMail(`Preventive maintenance due in ${reminderDays} day${reminderDays === 1 ? '' : 's'}: ${schedule.itemTag}`, `Asset: ${schedule.itemName} (${schedule.itemTag})\nSchedule: ${schedule.title}\nDue: ${schedule.nextDue}\nTechnician: ${schedule.technician || 'Unassigned'}\nVendor: ${schedule.vendor || 'Internal service'}\nInstructions: ${schedule.instructions || 'None recorded'}`);
        const reminderRecord = { id: `PMR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, dueDate: schedule.nextDue, daysBefore: reminderDays, sentAt, channel: result?.ok ? 'Email and in-app' : 'In-app', deliveryStatus: result?.ok ? 'Prepared' : 'Email unavailable', retainedUntil: new Date(Date.now() + 365 * 864e5).toISOString() };
        setMaintenanceSchedules((current) => current.map((entry) => entry.id === schedule.id ? { ...entry, lastReminderSentFor: schedule.nextDue, lastReminderSentAt: sentAt, reminderHistory: [reminderRecord, ...(entry.reminderHistory || [])] } : entry));
      }
    };
    checkReminders();
    const timer = setInterval(checkReminders, 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [maintenanceSchedules, session]);

  // ---- derived ----
  const role = session ? session.role : null;
  const isAdmin = role === 'Admin';
  const canEdit = role === 'Admin' || role === 'Student assistant';
  const canLoanNow = canEdit;
  const isStaff = role === 'Staff';
  const availableScreens = role ? (navOverrides[role] || NAV[role]) : [];
  const canScan = availableScreens.includes('scan');

  const stocktakeStateByItem = useMemo(() => {
    const latest = new Map();
    stocktakes.filter((entry) => entry.status !== 'Cancelled').forEach((stocktake) => {
      Object.values(stocktake.observations || {}).forEach((observation) => {
        if (!observation.itemId || observation.state === 'Unverified' || observation.state === 'Unexpected') return;
        const recordedAt = observation.recordedAt || stocktake.completedAt || stocktake.createdAt || '';
        const previous = latest.get(observation.itemId);
        if (!previous || recordedAt >= previous.recordedAt) latest.set(observation.itemId, {
          state: observation.state,
          recordedAt,
          sessionId: stocktake.id,
          sessionTitle: stocktake.title,
          note: observation.note || '',
          scope: stocktake.scopeType === 'room' ? `${stocktake.building} · ${stocktake.room}` : stocktake.building
        });
      });
    });
    return latest;
  }, [stocktakes]);
  const displayItems = useMemo(() => items.map((item) => {
    const result = stocktakeStateByItem.get(item.id);
    return result ? { ...item, stocktakeState: result.state, stocktakeRecordedAt: result.recordedAt, stocktakeSessionId: result.sessionId, stocktakeSessionTitle: result.sessionTitle, stocktakeNote: result.note, stocktakeScope: result.scope } : item;
  }), [items, stocktakeStateByItem]);
  const activeItems = useMemo(() => displayItems.filter((item) => !item.archived && !(item.model === 'printer-toner' && item.serializedConsumable && Number(item.qty || 0) < 1)), [displayItems]);
  const staffVisibleItems = useMemo(() => isStaff
    ? activeItems.filter((item) => item.consumable || isBorrowingApproved(item, borrowCategoryAccess))
    : activeItems, [activeItems, borrowCategoryAccess, isStaff]);
  const onLoan = useMemo(() => activeItems.filter((i) => i.status === 'On loan'), [activeItems]);
  const low = useMemo(() => activeItems.filter(needsStockAttention), [activeItems]);
  const pending = useMemo(() => requests.filter((r) => r.state === 'Pending'), [requests]);
  const pendingOrders = useMemo(() => orders.filter((o) => ['Pending', 'Partially received'].includes(o.status)), [orders]);
  const pendingRequisitions = useMemo(() => requests.filter((r) => r.type === 'Requisition' && r.state === 'Pending'), [requests]);
  const pendingPlacements = useMemo(() => placements.filter((p) => p.status === 'Pending'), [placements]);
  const sel = useMemo(() => displayItems.find((i) => i.id === selectedId) || null, [displayItems, selectedId]);
  const selectedPendingOrder = useMemo(() => pendingOrders.find((order) => order.itemId === selectedId) || null, [pendingOrders, selectedId]);
  const selectedPendingPlacement = useMemo(() => pendingPlacements.find((placement) => placement.itemId === selectedId) || null, [pendingPlacements, selectedId]);
  const globallyScannedItem = useMemo(() => {
    if (!detectedScan) return null;
    const value = detectedScan.value.toUpperCase();
    return staffVisibleItems.find((item) => String(item.tag || '').toUpperCase() === value || String(item.serial || '').toUpperCase() === value) || null;
  }, [staffVisibleItems, detectedScan]);
  const globallyScannedReservation = useMemo(() => {
    if (!detectedScan) return null;
    return reservedBarcodes.find((entry) => entry.status !== 'Voided' && String(entry.tag || '').toUpperCase() === detectedScan.value.toUpperCase()) || null;
  }, [reservedBarcodes, detectedScan]);
  const accounts = useMemo(() => {
    const source = cloudSession ? remoteAccounts : [...ACCOUNTS, ...customAccounts];
    const merged = new Map(source.map(({ passwordHash, ...account }) => [account.email, { ...account, ...(cloudSession ? {} : (profileState[account.email] || {})) }]));
    return [...merged.values()];
  }, [customAccounts, profileState, remoteAccounts, cloudSession]);
  const checkoutTsrs = useMemo(() => accounts.filter((account) => (account.tsr || account.role === 'Admin') && userState[account.email] !== false), [accounts, userState]);
  const maintenanceEmailContacts = useMemo(() => {
    const contacts = new Map();
    accounts.filter((account) => userState[account.email] !== false && /^\S+@\S+\.\S+$/.test(account.email || '')).forEach((account) => {
      contacts.set(account.email.toLowerCase(), { id: `user-${account.email}`, name: account.name, email: account.email, title: account.title || account.role, source: 'User account' });
    });
    maintenanceContacts.filter((contact) => contact.active !== false).forEach((contact) => contacts.set(contact.email.toLowerCase(), contact));
    return [...contacts.values()];
  }, [accounts, userState, maintenanceContacts]);
  const loanEmailContacts = useMemo(() => {
    const contacts = new Map();
    accounts.filter((account) => userState[account.email] !== false && /^\S+@\S+\.\S+$/.test(account.email || '')).forEach((account) => {
      contacts.set(account.email.toLowerCase(), { id: `loan-user-${account.email}`, name: account.name, email: account.email, title: account.title || account.role, source: 'User account' });
    });
    loanContacts.filter((contact) => contact.active !== false).forEach((contact) => contacts.set(contact.email.toLowerCase(), contact));
    return [...contacts.values()];
  }, [accounts, userState, loanContacts]);

  useEffect(() => {
    // The stocktake screen owns barcode input while it is open. The scanner
    // console still uses this global detector so a physical HID scan opens the
    // same action popup available everywhere else in the application.
    if (!session || screen === 'stocktakes') return undefined;
    let buffer = '';
    let startedAt = 0;
    let lastKeyAt = 0;
    let longestKeyGap = 0;
    const resetScannerBuffer = () => {
      buffer = '';
      startedAt = 0;
      lastKeyAt = 0;
      longestKeyGap = 0;
    };
    const clearScannedTextFromField = (target, scannedValue) => {
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      const current = String(target.value || '');
      if (!current.toUpperCase().endsWith(scannedValue.toUpperCase())) return;
      const next = current.slice(0, current.length - scannedValue.length);
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), 'value');
      descriptor?.set?.call(target, next);
      target.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const detectScanner = (event) => {
      if (event.isComposing || event.repeat || event.ctrlKey || event.altKey || event.metaKey) { resetScannerBuffer(); return; }
      const now = performance.now();
      if (event.key.length === 1) {
        if (!buffer || now - lastKeyAt > 100) resetScannerBuffer();
        if (!buffer) startedAt = now;
        else longestKeyGap = Math.max(longestKeyGap, now - lastKeyAt);
        buffer += event.key;
        lastKeyAt = now;
        return;
      }
      if (event.key !== 'Enter' && event.key !== 'Tab') {
        if (!['Shift', 'CapsLock'].includes(event.key)) resetScannerBuffer();
        return;
      }
      const value = buffer.trim();
      const duration = lastKeyAt - startedAt;
      const terminatorGap = now - lastKeyAt;
      const averageKeyGap = value.length > 1 ? duration / (value.length - 1) : Number.POSITIVE_INFINITY;
      const maximumKeyGap = longestKeyGap;
      const normalized = value.toUpperCase();
      const isKnownBarcode = activeItems.some((item) => String(item.tag || '').toUpperCase() === normalized || String(item.serial || '').toUpperCase() === normalized)
        || reservedBarcodes.some((entry) => entry.status !== 'Voided' && String(entry.tag || '').toUpperCase() === normalized);
      resetScannerBuffer();
      const minimumLength = isKnownBarcode ? 4 : 6;
      const hasScannerCadence = terminatorGap <= 100 && maximumKeyGap <= 85 && averageKeyGap <= 55;
      if (value.length < minimumLength || !hasScannerCadence) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      clearScannedTextFromField(event.target, value);
      enqueueDetectedScan({ id: `SCAN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, value, detectedAt: new Date().toISOString() });
    };
    document.addEventListener('keydown', detectScanner, true);
    return () => document.removeEventListener('keydown', detectScanner, true);
  }, [session, screen, activeItems, reservedBarcodes, enqueueDetectedScan]);

  const navCounts = { alerts: low.length, consumables: low.length, requests: pending.length, loans: onLoan.length, orders: pendingOrders.length, placements: pendingPlacements.length, disposal: lifecycleActions.filter((action) => ['Disposal', 'Donation', 'Write-off', 'Loss'].includes(action.type) && action.status === 'Pending approval').length };
  const workflowAlerts = {
    maintenance: repairTickets.some((ticket) => ticket.workflowUnread),
    orders: orders.some((order) => order.workflowUnread),
    placements: placements.some((placement) => placement.workflowUnread),
    requests: requests.some((request) => request.workflowUnread)
  };

  useEffect(() => {
    if (!session) return;
    const unseen = low.some((item) => !seenAlertIds.includes(item.id));
    setHasNewAlert(unseen);
    if (unseen && !alertPreferences.muted) {
      try { const AudioContext = window.AudioContext || window.webkitAudioContext; const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.frequency.value = 740; gain.gain.setValueAtTime(.06, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .22); oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .22); } catch { /* sound is best effort */ }
    }
  }, [low, seenAlertIds, alertPreferences.muted, session]);

  const goScreen = useCallback((key) => {
    if (key === 'alerts') { setSeenAlertIds((current) => Array.from(new Set([...current, ...low.map((item) => item.id)]))); setHasNewAlert(false); }
    setScreen(key); setSelectedId(null);
  }, [low]);
  const handleSidebarNav = useCallback((key) => {
    setFilters((current) => current.query ? { ...current, query: '' } : current);
    goScreen(key);
  }, [goScreen]);
  const acknowledgeWorkflowRecord = useCallback((target, id) => {
    if (target === 'maintenance') setRepairTickets((current) => current.map((entry) => entry.id === id ? { ...entry, workflowUnread: false } : entry));
    if (target === 'orders') setOrders((current) => current.map((entry) => entry.id === id ? { ...entry, workflowUnread: false } : entry));
    if (target === 'placements') setPlacements((current) => current.map((entry) => entry.id === id ? { ...entry, workflowUnread: false } : entry));
    if (target === 'requests') setRequests((current) => current.map((entry) => entry.id === id ? { ...entry, workflowUnread: false } : entry));
  }, []);
  const openItem = useCallback((id) => {
    const requestedItem = items.find((item) => item.id === id);
    const disposed = requestedItem?.disposalApproved || (requestedItem?.status === 'Retired' && requestedItem?.dispositionType);
    if (disposed) {
      toast(`Disposed asset — ${requestedItem.name} is locked from operational use`);
    }
    if (isStaff && requestedItem && !requestedItem.consumable && !isBorrowingApproved(requestedItem, borrowCategoryAccess)) {
      if (!disposed) toast('This asset is not available in the staff borrowing catalogue');
      return;
    }
    setFilters((current) => current.query ? { ...current, query: '' } : current);
    setScreen('item');
    setSelectedId(id);
  }, [borrowCategoryAccess, isStaff, items]);

  const addBarcodeToScannerSheet = useCallback((item) => {
    if (!item?.id || !item?.tag) {
      toast('This asset does not have a printable barcode yet');
      return;
    }
    const duplicate = scannerLabelQueue.includes(item.id);
    if (!duplicate && scannerLabelQueue.length >= 14) {
      toast('The barcode sheet is full. Remove a label before adding another.');
      return;
    }
    if (!duplicate) setScannerLabelQueue((current) => [...current, item.id]);
    toast(duplicate ? 'This barcode is already in the Scanner Console print queue' : `${item.name} barcode sent to the Scanner Console print queue`, duplicate ? null : { tone: 'success' });
  }, [scannerLabelQueue, toast]);

  const openItemLifecycle = useCallback((itemId) => {
    if (!itemId) return;
    setFilters((current) => current.query ? { ...current, query: '' } : current);
    setLifecycleFocus((current) => ({ itemId, nonce: current.nonce + 1 }));
    setScreen('lifecycle');
    setSelectedId(null);
  }, []);

  const openDashboardSummary = useCallback((target) => {
    const destinations = { assets: 'inventory', inventory: 'inventory', loans: 'loans', alerts: 'alerts', requests: 'requests', orders: 'orders', placements: 'placements', reports: 'reports' };
    const destination = destinations[target] || 'inventory';
    if (availableScreens.includes(destination)) {
      if (destination === 'inventory') {
        setFilters({ query: '', fCategory: 'All categories', fLocation: 'All buildings', fStatus: 'All statuses' });
      }
      goScreen(destination);
      return;
    }

    // Use a filtered inventory view when this role has no dedicated summary screen.
    const fallbackStatus = target === 'loans' ? 'On loan' : target === 'alerts' ? 'Low stock' : 'All statuses';
    setFilters({ query: '', fCategory: 'All categories', fLocation: 'All buildings', fStatus: fallbackStatus });
    goScreen('inventory');
  }, [goScreen, availableScreens]);

  const openDashboardNotification = useCallback((notification) => {
    if (notification.target === 'item' && notification.itemId) {
      openItem(notification.itemId);
      return;
    }
    if (notification.target === 'orders') {
      goScreen('orders');
      if (notification.orderId) setOrderDetailsId(notification.orderId);
      else {
        if (notification.searchTerm) setFilters((current) => ({ ...current, query: notification.searchTerm }));
      }
      return;
    }
    if (notification.target === 'requests') {
      setDashboardRequestFocus({ id: notification.requestId || '', nonce: Date.now() });
      goScreen('requests');
      return;
    }
    if (['placements', 'maintenance', 'alerts'].includes(notification.target) && availableScreens.includes(notification.target)) {
      if (notification.searchTerm) setFilters((current) => ({ ...current, query: notification.searchTerm }));
      goScreen(notification.target);
      return;
    }
    if (notification.target && availableScreens.includes(notification.target)) {
      goScreen(notification.target);
      return;
    }
    if (notification.itemId) {
      openItem(notification.itemId);
      return;
    }
    goScreen('inventory');
  }, [goScreen, openItem, availableScreens]);

  const onQuery = useCallback((val) => {
    setFilters((f) => ({ ...f, query: val }));
    setScreen((s) => (s === 'item' ? (items.find((item) => item.id === selectedId)?.consumable ? 'consumables' : 'inventory') : s));
  }, [items, selectedId]);
  const submitGlobalSearch = useCallback(() => {
    const term = filters.query.trim().toLowerCase();
    if (!term) return;
    const matches = staffVisibleItems.filter((item) => [item.name, item.tag, item.serial, item.location, item.room, item.category, item.model]
      .some((value) => String(value || '').toLowerCase().includes(term)));
    const exact = matches.find((item) => [item.tag, item.serial, item.name].some((value) => String(value || '').toLowerCase() === term));
    if (exact || matches.length === 1) openItem((exact || matches[0]).id);
  }, [staffVisibleItems, filters.query, openItem]);

  // ---- auth ----
  const login = async (email, pass, remember, playSuccessTransition) => {
    const normalizedEmail = email.trim().toLowerCase();
    let account;
    const custom = customAccounts.find((entry) => entry.email.toLowerCase() === normalizedEmail);
    if (supabaseConfigured && !custom) {
      try {
        account = await signInWithSupabase(normalizedEmail, pass);
        let cloudAccounts = [account];
        try { cloudAccounts = await listSupabaseAccounts(); } catch (profileError) { console.error('Failed to refresh Supabase profiles', profileError); }
        setRemoteAccounts(cloudAccounts);
        setUserState((current) => ({ ...current, ...Object.fromEntries(cloudAccounts.map((entry) => [entry.email, entry.active !== false])) }));
      } catch (authError) {
        return { error: authError?.message || 'Invalid email or password.' };
      }
    } else {
      const localAccount = custom || ACCOUNTS.find((entry) => entry.email.toLowerCase() === normalizedEmail);
      const expectedHash = custom?.passwordHash || LOCAL_PASSWORD_HASHES[normalizedEmail];
      const { passwordHash: _passwordHash, ...safeAccount } = localAccount || {};
      account = localAccount ? { ...safeAccount, ...(profileState[localAccount.email] || {}), source: 'local' } : null;
      if (!account || userState[account.email] === false || !expectedHash || await hashPassword(pass) !== expectedHash) return { error: 'Invalid email or password.' };
      saveSessionPointer({ email: account.email, source: 'local' }, remember);
    }
    await rememberSuccessfulLogin(account, pass);
    await playSuccessTransition?.();
    setSharedWorkspaceConnected(false);
    setWorkspaceMounted(false);
    setLoginPhase('Opening your secure workspace');
    setSession(account);
    setScreen((navOverrides[account.role] || NAV[account.role])[0]);
    await afterNextPaint();
    if (account.source === 'supabase') {
      setLoginPhase('Synchronizing the shared CSV archive');
      let csvResult = null;
      try { csvResult = await syncSharedCsvCache(); }
      catch (syncError) { console.error('Shared CSV sync failed; continuing with the local cache', syncError); }
      setLoginPhase('Synchronizing shared inventory records');
      try {
        const shared = await loadSupabaseWorkspaceSnapshot();
        if (shared.empty) {
          if (account.role !== 'Admin') throw new Error('The shared inventory has not been initialized. Sign in once with an administrator account.');
          const bootstrap = {
            ...currentSharedWorkspace,
            items: csvResult?.assets?.length ? mergeCachedCsvRecords(currentSharedWorkspace.items, csvResult.assets) : currentSharedWorkspace.items,
            procurementRecords: csvResult?.procurement?.length ? mergeCachedCsvRecords(currentSharedWorkspace.procurementRecords, csvResult.procurement) : currentSharedWorkspace.procurementRecords,
            importRuns: csvResult?.runs?.length ? mergeCachedCsvRecords(currentSharedWorkspace.importRuns, csvResult.runs) : currentSharedWorkspace.importRuns
          };
          const migratedBootstrap = await migrateWorkspaceAttachments(bootstrap);
          await saveSupabaseWorkspaceSnapshot(migratedBootstrap);
          applySharedWorkspace(migratedBootstrap);
        } else {
          applySharedWorkspace(shared.world);
          const sharedNav = normalizeNavOverrides(shared.world.navOverrides);
          setScreen((current) => (sharedNav[account.role] || NAV[account.role]).includes(current) ? current : (sharedNav[account.role] || NAV[account.role])[0]);
        }
        setSharedWorkspaceConnected(true);
      } catch (syncError) {
        console.error('Shared workspace sync failed; continuing with the durable local cache', syncError);
        toast(syncError?.message || 'Shared workspace sync is unavailable; changes will remain cached locally.');
      }
    }
    setLoginPhase('Preparing inventory, consumables, and dashboard');
    await Promise.all([preloadWorkspaceCode(), afterNextPaint()]);
    setLoginPhase('Loading 3D equipment and workspace data');
    await waitForWarmup(modelWarmup.current);
    setWorkspaceMounted(true);
    await afterNextPaint();
    await waitForWarmup(Inv3D.sync(document.querySelector('.workspace-screen-stack') || document));
    await afterNextPaint();
    setLoginPhase('');
    return {};
  };
  const demoLogin = async (email, remember, playSuccessTransition) => {
    const demo = ACCOUNTS.find((entry) => entry.email === email);
    const account = demo ? { ...demo, source: 'demo' } : null;
    if (!account || userState[account.email] === false) return { error: 'This demo account is unavailable.' };
    saveSessionPointer({ email: account.email, source: 'demo' }, remember);
    await playSuccessTransition?.();
    setWorkspaceMounted(false);
    setLoginPhase('Opening your secure workspace');
    setSession(account);
    setScreen((navOverrides[account.role] || NAV[account.role])[0]);
    await afterNextPaint();
    setLoginPhase('Preparing inventory, consumables, and dashboard');
    await Promise.all([preloadWorkspaceCode(), afterNextPaint()]);
    setLoginPhase('Loading 3D equipment and workspace data');
    await waitForWarmup(modelWarmup.current);
    setWorkspaceMounted(true);
    await afterNextPaint();
    await waitForWarmup(Inv3D.sync(document.querySelector('.workspace-screen-stack') || document));
    await afterNextPaint();
    setLoginPhase('');
    return {};
  };
  const logout = async () => {
    if (cloudSession) await signOutSupabase();
    clearSessionPointer();
    setMyProfileOpen(false);
    setSession(null);
    setSharedWorkspaceConnected(false);
    setLoginPhase('');
    setWorkspaceMounted(false);
    setScreen('dashboard');
    setSelectedId(null);
    setFilters({ query: '', fCategory: 'All categories', fLocation: 'All buildings', fStatus: 'All statuses' });
  };
  const requestPasswordReset = async (email) => {
    if (!supabaseConfigured) return { error: 'Password recovery is available after Supabase is configured.' };
    try {
      await requestSupabasePasswordReset(email);
      return {};
    } catch (resetError) {
      return { error: resetError?.message || 'The recovery email could not be sent.' };
    }
  };
  const completePasswordReset = async (password) => {
    try {
      await updateSupabasePassword(password);
      await signOutSupabase();
      setPasswordRecovery(false);
      setSession(null);
      setWorkspaceMounted(false);
      return {};
    } catch (resetError) {
      return { error: resetError?.message || 'The password could not be updated.' };
    }
  };

  // ---- asset form ----
  const assetTagCodeForModel = (modelId, fallbackCategory = '') => {
    const observedCodes = new Map();
    items.forEach((item) => {
      if (item.model !== modelId) return;
      const parsed = parseMsbmAssetTag(item.tag);
      if (parsed) observedCodes.set(parsed.code, (observedCodes.get(parsed.code) || 0) + 1);
    });
    reservedBarcodes.forEach((entry) => {
      if (entry.model !== modelId) return;
      const parsed = parseMsbmAssetTag(entry.tag);
      if (parsed) observedCodes.set(parsed.code, (observedCodes.get(parsed.code) || 0) + 1);
    });
    const learnedCode = [...observedCodes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (learnedCode) return learnedCode;
    const model = MODELS.find((entry) => entry.id === modelId);
    const category = model?.cat || fallbackCategory;
    const description = `${model?.name || ''} ${category}`;
    if (['Computers', 'Displays', 'Peripherals'].includes(category)
      || /\b(computer|desktop|laptop|notebook|monitor|tablet|workstation|server|network switch|docking station)\b/i.test(description)) return 'COM';
    return 'EQP';
  };

  const nextAssetTag = (modelId = MODELS[0].id, reservedTag = '') => {
    const code = assetTagCodeForModel(modelId);
    const knownTags = [...items.map((item) => item.tag), ...reservedBarcodes.map((entry) => entry.tag), reservedTag].filter(Boolean);
    const usedSequences = new Set(knownTags.map(parseMsbmAssetTag).filter((parsed) => parsed?.code === code).map((parsed) => parsed.sequence));
    let number = highestEstablishedSequence(knownTags, code) + 1;
    while (usedSequences.has(number)) number += 1;
    return formatMsbmAssetTag(code, number);
  };

  const allocateAssetTags = (modelId, count, firstTag = '') => {
    const total = Math.max(1, Number.parseInt(count, 10) || 1);
    const code = assetTagCodeForModel(modelId);
    const knownTags = [...items.map((item) => item.tag), ...reservedBarcodes.map((entry) => entry.tag)].filter(Boolean);
    const usedSequences = new Set(knownTags.map(parseMsbmAssetTag).filter((parsed) => parsed?.code === code).map((parsed) => parsed.sequence));
    const tags = firstTag ? [String(firstTag).trim().toUpperCase()] : [];
    const firstParsed = parseMsbmAssetTag(firstTag);
    if (firstParsed?.code === code) usedSequences.add(firstParsed.sequence);
    let number = highestEstablishedSequence([...knownTags, firstTag], code) + 1;
    while (tags.length < total) {
      while (usedSequences.has(number)) number += 1;
      tags.push(formatMsbmAssetTag(code, number));
      usedSequences.add(number);
      number += 1;
    }
    return tags;
  };

  // One physical toner cartridge must always have one inventory row and barcode.
  // Upgrade older printer-linked toner rows that stored several cartridges under one tag.
  useEffect(() => {
    if (!items.some((item) => item.model === 'printer-toner' && item.consumable && !item.archived && Array.isArray(item.compatiblePrinterIds) && item.compatiblePrinterIds.length > 0 && Number(item.qty || 0) > 1)) return;
    setItems((current) => {
      const knownTags = [...current.map((item) => item.tag), ...reservedBarcodes.map((entry) => entry.tag)].filter(Boolean);
      const nextUniqueTag = (modelId) => {
        const code = assetTagCodeForModel(modelId);
        const used = new Set(knownTags.map(parseMsbmAssetTag).filter((parsed) => parsed?.code === code).map((parsed) => parsed.sequence));
        let number = highestEstablishedSequence(knownTags, code) + 1;
        while (used.has(number)) number += 1;
        const tag = formatMsbmAssetTag(code, number);
        knownTags.push(tag);
        return tag;
      };
      return current.flatMap((item) => {
        if (item.model !== 'printer-toner' || !item.consumable || item.archived || !Array.isArray(item.compatiblePrinterIds) || !item.compatiblePrinterIds.length || Number(item.qty || 0) <= 1) return [item];
        const count = Math.max(1, Number.parseInt(item.qty, 10) || 1);
        const stamp = Date.now();
        return [
          { ...item, qty: 1, serializedConsumable: true, serializedAt: item.serializedAt || new Date().toISOString() },
          ...Array.from({ length: count - 1 }, (_, index) => ({ ...item, id: `itm-toner-split-${stamp}-${index}-${Math.random().toString(36).slice(2, 7)}`, tag: nextUniqueTag(item.model), qty: 1, stockReceipts: [], serializedConsumable: true, splitFromItemId: item.id, createdAt: item.createdAt || new Date().toISOString(), serializedAt: new Date().toISOString() }))
        ];
      });
    });
  }, [items, reservedBarcodes]);

  const generateBlankBarcodes = (requestedCount, modelId) => {
    if (!canEdit) return [];
    const model = MODELS.find((entry) => entry.id === modelId);
    if (!model) { toast('Choose an equipment type for this barcode batch'); return []; }
    const count = Math.min(100, Math.max(1, parseInt(requestedCount, 10) || 1));
    const code = assetTagCodeForModel(model.id, model.cat);
    const knownTags = [...items.map((item) => item.tag), ...reservedBarcodes.map((entry) => entry.tag)].filter(Boolean);
    const usedSequences = new Set(knownTags.map(parseMsbmAssetTag).filter((parsed) => parsed?.code === code).map((parsed) => parsed.sequence));
    let number = highestEstablishedSequence(knownTags, code) + 1;
    const createdAt = new Date().toISOString();
    const generated = [];
    while (generated.length < count) {
      if (usedSequences.has(number)) { number += 1; continue; }
      const tag = formatMsbmAssetTag(code, number);
      usedSequences.add(number);
      number += 1;
      generated.push({ tag, model: model.id, equipmentType: model.name, category: model.cat, createdAt, createdBy: session.name, status: 'Reserved' });
    }
    setReservedBarcodes((current) => [...generated, ...current]);
    logAudit('Blank barcode batch generated', `${generated.length} ${model.name} labels (${generated[0].tag} to ${generated.at(-1).tag})`);
    toast(`${generated.length} blank barcode${generated.length === 1 ? '' : 's'} reserved`);
    return generated;
  };

  const deleteReservedBarcode = (tag) => {
    const target = reservedBarcodes.find((entry) => entry.status !== 'Voided' && entry.tag === tag);
    if (!target) return false;
    if (!window.confirm(`Delete reserved label ${tag}?\n\nAny copy already printed will no longer be recognized as a categorized reserved label.`)) return false;
    const voidedAt = new Date().toISOString();
    setReservedBarcodes((current) => current.map((entry) => entry.tag === tag ? { ...entry, status: 'Voided', voidedAt, voidedBy: session.name } : entry));
    logAudit('Reserved barcode deleted', `${tag} — ${target.equipmentType || 'Uncategorized'}`);
    toast(`Reserved label deleted — ${tag}`);
    return true;
  };

  const clearReservedBarcodes = () => {
    const active = reservedBarcodes.filter((entry) => entry.status !== 'Voided');
    if (!active.length) return false;
    if (!window.confirm(`Clear all ${active.length} generated labels?\n\nPrinted copies will no longer be recognized as categorized reserved labels.`)) return false;
    const voidedAt = new Date().toISOString();
    const activeTags = new Set(active.map((entry) => entry.tag));
    setReservedBarcodes((current) => current.map((entry) => activeTags.has(entry.tag) ? { ...entry, status: 'Voided', voidedAt, voidedBy: session.name } : entry));
    logAudit('Generated barcode labels cleared', `${active.length} reserved labels voided`);
    toast(`${active.length} generated labels cleared`);
    return true;
  };

  const openAdd = (modelId = MODELS[0].id) => {
    const selectedModel = MODELS.find((model) => model.id === modelId) || MODELS[0];
    setPlacementSource(null);
    setPlacementProgress(null);
    setFormMode('add');
    setFormError('');
    setForm({
      model: selectedModel.id, tag: nextAssetTag(selectedModel.id), serial: '', _autoTag: true,
      location: BUILDINGS[0], room: 'A-101', qty: 1, min: 0, condition: 'New', cost: selectedModel.cost,
      unitOfMeasure: 'unit', batchNumber: '', expiryDate: '', stockCode: '', color: '', compatiblePrinterIds: [],
      borrowEligibility: 'inherit',
      supplier: SUPPLIERS[0], assignedTo: '', purchased: iso(today()), warranty: iso(new Date(today().getFullYear() + 3, today().getMonth(), today().getDate())),
      depreciationMethod: 'Straight-line', usefulLifeYears: 5, salvageValue: 0,
      expectedReplacementDate: iso(new Date(today().getFullYear() + 5, today().getMonth(), today().getDate()))
    });
    setFormOpen(true);
  };
  const openEdit = () => {
    if (!sel) return;
    setPlacementSource(null);
    setPlacementProgress(null);
    setFormMode('edit');
    setFormError('');
    setForm({
      id: sel.id, model: sel.model, tag: sel.tag, serial: sel.serial, location: sel.location, room: sel.room,
      qty: sel.qty, min: sel.min, condition: sel.condition, cost: sel.cost, supplier: sel.supplier, assignedTo: sel.assignedTo || '',
      unitOfMeasure: sel.unitOfMeasure || 'unit', batchNumber: sel.batchNumber || '', expiryDate: sel.expiryDate || '', stockCode: sel.stockCode || '', color: sel.color || '', compatiblePrinterIds: asArray(sel.compatiblePrinterIds),
      borrowEligibility: sel.borrowEligibility || 'inherit',
      purchased: sel.purchased || iso(today()), warranty: sel.warranty,
      depreciationMethod: sel.depreciationMethod || 'Straight-line', usefulLifeYears: sel.usefulLifeYears || 5,
      salvageValue: sel.salvageValue || 0, expectedReplacementDate: sel.expectedReplacementDate || ''
    });
    setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setFormError(''); setPlacementSource(null); setPlacementProgress(null); };
  const onFormChange = (key, value) => {
    setForm((current) => {
      if (key === 'compatiblePrinterIds') {
        const compatiblePrinterIds = asArray(value);
        const printer = items.find((entry) => entry.id === compatiblePrinterIds[0] && !entry.archived && !entry.consumable);
        return { ...current, compatiblePrinterIds, ...(printer ? { location: printer.location, room: printer.room } : {}) };
      }
      if (key === 'model' && formMode === 'add') {
        return { ...current, model: value, ...(current._autoTag !== false ? { tag: nextAssetTag(value) } : {}) };
      }
      if (key === 'tag' && formMode === 'add') return { ...current, tag: value, _autoTag: false };
      if (key === 'usefulLifeYears') {
        const expectedReplacementDate = expectedReplacementFrom(current.purchased, value);
        return { ...current, usefulLifeYears: value, ...(expectedReplacementDate ? { expectedReplacementDate } : {}) };
      }
      if (key === 'purchased') {
        const expectedReplacementDate = expectedReplacementFrom(value, current.usefulLifeYears);
        return { ...current, purchased: value, ...(expectedReplacementDate ? { expectedReplacementDate } : {}) };
      }
      return { ...current, [key]: value };
    });
    setFormError('');
  };

  const startSerializedPlacement = (placement, original) => {
    setPlacementSource(placement.id);
    setPlacementProgress({ current: 1, total: placement.remainingQty });
    setFormMode('add'); setFormError('');
    setForm({ model: placement.model, tag: nextAssetTag(placement.model), serial: '', _autoTag: true, location: placement.location, room: placement.room, qty: 1, min: original?.min || 0, condition: 'New', cost: placement.unitCost, supplier: placement.supplier, assignedTo: '', purchased: iso(today()), warranty: iso(new Date(today().getFullYear() + 3, today().getMonth(), today().getDate())), unitOfMeasure: original?.unitOfMeasure || 'unit', batchNumber: '', expiryDate: '', stockCode: original?.stockCode || '', color: original?.color || '', compatiblePrinterIds: asArray(original?.compatiblePrinterIds), depreciationMethod: 'Straight-line', usefulLifeYears: 5, salvageValue: 0, expectedReplacementDate: iso(new Date(today().getFullYear() + 5, today().getMonth(), today().getDate())) });
    setFormOpen(true);
  };

  const openPlacementAsset = (id) => {
    const placement = pendingPlacements.find((entry) => entry.id === id);
    if (!placement) return;
    const original = items.find((item) => item.id === placement.itemId);
    const placementModel = MODELS.find((model) => model.id === placement.model);
    if (placementModel?.cons === 1 && !isPrinterSupplyModel(placementModel)) {
      setItems((current) => current.map((item) => item.id === original?.id ? { ...item, qty: Number(item.qty || 0) + placement.remainingQty, receivedOn: placement.receivedOn, receivedBy: placement.receivedBy, receiptSource: 'order' } : item));
      setPlacements((current) => current.map((entry) => entry.id === id ? { ...entry, remainingQty: 0, status: 'Placed', placedOn: iso(today()), placedBy: session.name } : entry));
      logAudit('Consumable stock placed', `${placement.name} — quantity ${placement.remainingQty}`);
      toast(`Stock increased by ${placement.remainingQty}`);
      return;
    }
    startSerializedPlacement(placement, original);
  };

  const saveForm = () => {
    if (!form.tag || !form.tag.trim()) { setFormError('An asset tag is required.'); return; }
    const normalizedTag = form.tag.trim().toUpperCase();
    const duplicateTag = items.some((item) => item.tag.toUpperCase() === normalizedTag && item.id !== form.id);
    if (duplicateTag) { setFormError('That asset tag is already in use. Every barcode must identify one unique item.'); return; }
    const m = MODELS.find((mo) => mo.id === form.model);
    const rec = {
      model: m.id, name: m.name, category: m.cat, consumable: m.cons === 1, rank: m.rank,
      tag: normalizedTag, serial: form.serial, location: form.location, room: form.room,
      qty: m.cons === 1 ? (formMode === 'add' ? Math.max(1, parseInt(form.qty, 10) || 1) : Math.max(0, parseInt(form.qty, 10) || 0)) : 1, min: Math.max(0, parseInt(form.min, 10) || 0),
      condition: form.condition, cost: Math.max(0, parseFloat(form.cost) || 0),
      supplier: form.supplier, assignedTo: (form.assignedTo || '').trim(), purchased: form.purchased || iso(today()), warranty: form.warranty,
      unitOfMeasure: m.cons === 1 ? (form.unitOfMeasure || 'unit').trim() : 'item', batchNumber: m.cons === 1 ? (form.batchNumber || '').trim() : '', expiryDate: m.cons === 1 ? form.expiryDate || '' : '',
      stockCode: m.cons === 1 ? (form.stockCode || '').trim() : '', color: m.cons === 1 ? (form.color || '').trim() : '', compatiblePrinterIds: m.cons === 1 ? asArray(form.compatiblePrinterIds) : [],
      borrowEligibility: m.cons === 1 ? 'blocked' : (['allowed', 'blocked'].includes(form.borrowEligibility) ? form.borrowEligibility : 'inherit'),
      depreciationMethod: form.depreciationMethod || 'Straight-line', usefulLifeYears: Math.max(1, parseInt(form.usefulLifeYears, 10) || 5),
      salvageValue: Math.max(0, parseFloat(form.salvageValue) || 0), expectedReplacementDate: form.expectedReplacementDate || ''
    };
    const sourcePlacement = placementSource ? pendingPlacements.find((entry) => entry.id === placementSource) : null;
    if (sourcePlacement) rec.qty = 1;
    if (sourcePlacement && isPrinterSupplyModel(m) && rec.compatiblePrinterIds.length < 1) {
      setFormError('Select the printer that will use this consumable before completing assignment.');
      return;
    }
    if (sourcePlacement && (rec.qty < 1 || rec.qty > sourcePlacement.remainingQty)) {
      setFormError('Quantity must be between 1 and ' + sourcePlacement.remainingQty + ' for this received order.');
      return;
    }
    setReservedBarcodes((current) => current.filter((entry) => String(entry.tag || '').toUpperCase() !== normalizedTag));
    if (formMode === 'edit') {
      setItems((prev) => prev.map((x) => (x.id === form.id ? { ...x, ...rec } : x)));
      setFormOpen(false);
      logAudit('Asset updated', `${rec.name} (${rec.tag})`);
      toast('Record updated — ' + rec.tag);
    } else {
      const id = 'itm' + Date.now();
      const createdAt = new Date().toISOString();
      const serializeToner = rec.model === 'printer-toner' && rec.consumable && rec.compatiblePrinterIds.length > 0 && !sourcePlacement;
      const createdRecords = serializeToner
        ? allocateAssetTags(rec.model, rec.qty, rec.tag).map((tag, index) => ({ id: `${id}-${index + 1}`, status: 'In stock', purchased: iso(today()), loanCount: 0, borrower: null, due: null, since: null, createdAt, createdBy: session.name, ...rec, tag, qty: 1, serializedConsumable: true, receivedOn: iso(today()), receivedBy: session.name, receivedCompany: rec.supplier, receiptSource: 'manual', invoiceRequired: true }))
        : [{ id, status: 'In stock', purchased: iso(today()), loanCount: 0, borrower: null, due: null, since: null, createdAt, createdBy: session.name, ...rec, ...(sourcePlacement ? { sourcePlacementId: sourcePlacement.id, serializedConsumable: rec.model === 'printer-toner', receivedOn: sourcePlacement.receivedOn, receivedBy: sourcePlacement.receivedBy, receivedCompany: sourcePlacement.supplier, receiptSource: 'order', invoiceRequired: true } : { receivedOn: iso(today()), receivedBy: session.name, receivedCompany: rec.supplier, receiptSource: 'manual', invoiceRequired: true }) }];
      setItems((prev) => [...createdRecords, ...prev]);
      logAudit('Asset created', `${rec.name} (${rec.tag})${rec.consumable ? ` — quantity ${rec.qty}` : ''}`);
      if (sourcePlacement) {
        const remainingQty = sourcePlacement.remainingQty - 1;
        setPlacements((prev) => prev.map((entry) => {
          if (entry.id !== sourcePlacement.id) return entry;
          const nextRemaining = entry.remainingQty - 1;
          return { ...entry, assetIds: [...asArray(entry.assetIds), id], remainingQty: nextRemaining, status: nextRemaining === 0 ? 'Placed' : 'Pending', ...(nextRemaining === 0 ? { placedOn: iso(today()), placedBy: session.name } : {}) };
        }));
        if (remainingQty > 0) {
          setPlacementProgress((progress) => ({ ...progress, current: progress.current + 1 }));
          setForm((current) => ({ ...current, tag: nextAssetTag(rec.model, rec.tag), serial: '', qty: 1, _autoTag: true }));
          setFormError('');
          toast('Asset added — continue with the next received unit');
          return;
        }
      }
      setFormOpen(false);
      setPlacementSource(null);
      setPlacementProgress(null);
      if (!rec.consumable) {
        setScreen('inventory');
        setView('grid');
      }
      toast(serializeToner ? `${createdRecords.length} cartridge${createdRecords.length === 1 ? '' : 's'} added with individual asset tags` : `${rec.consumable ? 'Consumable' : 'Asset'} added — ${rec.tag}`, { label: 'View item', onClick: () => { setToastMsg(''); setToastAction(null); openItem(createdRecords[0].id); } });
    }
  };
  const deleteItem = () => {
    if (!isAdmin) return;
    const item = items.find((entry) => entry.id === form.id);
    setItems((prev) => prev.map((x) => (x.id === form.id ? { ...x, status: 'Retired' } : x)));
    setFormOpen(false);
    if (item) logAudit('Asset retired', `${item.name} (${item.tag})`);
    toast('Asset retired');
  };

  const requestRetirement = () => {
    if (!form.id || isAdmin) return;
    const action = createLifecycleAction({ itemId: form.id, type: 'Retirement', justification: 'Retirement requested from the asset record', effectiveDate: iso(today()), recipient: '', vendor: '', proceeds: 0, documents: [] });
    if (action) { setFormOpen(false); setScreen('lifecycle'); }
  };

  const permanentlyDeleteItem = (id) => {
    if (!isAdmin) return;
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const confirmed = window.confirm(`Archive ${item.name} (${item.tag})?\n\nThe asset leaves normal views, but all related history and workflow records are retained.`);
    if (!confirmed) return;

    const archivedAt = new Date().toISOString();
    setItems((prev) => prev.map((entry) => entry.id === id ? { ...entry, archived: true, archivedAt, archivedBy: session.name } : entry));
    setRecentScans((prev) => prev.filter((entryId) => entryId !== id));
    setSelectedId(null);
    setFormOpen(false);
    setScreen('inventory');
    logAudit('Asset archived', `${item.name} (${item.tag})`);
    toast('Asset archived — ' + item.tag);
  };
  const openReorder = (id, suggestedQty) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const existing = pendingOrders.find((order) => order.itemId === id);
    if (existing) {
      toast('Order already pending — ' + existing.qty + ' × ' + it.name);
      return;
    }
    if (pendingRequisitions.some((request) => request.itemId === id)) {
      toast('Reorder requisition already awaiting approval');
      return;
    }
    const awaitingSetup = pendingPlacements.find((entry) => entry.itemId === id);
    if (awaitingSetup) {
      toast('Received items are still awaiting labeling and placement');
      return;
    }
    const matchedVendor = approvedVendors.find((vendor) => vendor.approved !== false && vendor.name.toLowerCase() === String(it.supplier || '').toLowerCase());
    const requisitionNumber = `REQ-${iso(today()).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
    setOrderItem(id);
    setOrderError('');
    setOrderForm({
      vendorId: matchedVendor?.id || '',
      supplier: matchedVendor?.name || '',
      vendorNumber: matchedVendor?.vendorNumber || '',
      vendorContact: matchedVendor?.contact || '',
      vendorEmail: matchedVendor?.email || '',
      vendorPhone: matchedVendor?.phone || '',
      qty: suggestedQty || Math.max(1, (Number(it.min || 0) * 2) - Number(it.qty || 0)),
      unitCost: it.cost || 0,
      expectedOn: iso(new Date(today().getTime() + 14 * 864e5)),
      requisitionNumber,
      purchaseOrderNumber: '',
      notes: '',
      labelsRequired: true,
      labelFormat: it.consumable ? 'Stock / bin barcode label' : 'Individual asset barcode per unit',
      labelCopies: it.consumable ? 1 : (suggestedQty || Math.max(1, (Number(it.min || 0) * 2) - Number(it.qty || 0))),
      labelNotes: ''
    });
    setOrderOpen(true);
  };

  const closeReorder = () => {
    setOrderOpen(false);
    setOrderError('');
  };

  const onOrderChange = (key, value) => {
    if (key === 'vendorId') {
      const vendor = approvedVendors.find((entry) => entry.id === value && entry.approved !== false);
      setOrderForm((current) => ({ ...current, vendorId: value, supplier: vendor?.name || '', vendorNumber: vendor?.vendorNumber || '', vendorEmail: vendor?.email || '', vendorPhone: vendor?.phone || '', vendorContact: vendor?.contact || '' }));
      setOrderError('');
      return;
    }
    setOrderForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'qty' && current.labelsRequired !== false && current.labelFormat === 'Individual asset barcode per unit' ? { labelCopies: value } : {})
    }));
    setOrderError('');
  };

  const submitReorder = () => {
    const it = items.find((x) => x.id === orderItem);
    if (!it) return;
    const supplier = (orderForm.supplier || '').trim();
    const qty = parseInt(orderForm.qty, 10);
    const unitCost = parseFloat(orderForm.unitCost);
    const selectedVendor = approvedVendors.find((vendor) => vendor.id === orderForm.vendorId && vendor.approved !== false);
    if (!selectedVendor || !supplier) { setOrderError('Select an active vendor from the approved vendor list.'); return; }
    if (!Number.isFinite(qty) || qty < 1) { setOrderError('Order quantity must be at least 1.'); return; }
    if (!Number.isFinite(unitCost) || unitCost < 0) { setOrderError('Enter a valid unit cost.'); return; }
    if (!orderForm.expectedOn) { setOrderError('Choose an expected delivery date.'); return; }
    if (orderForm.expectedOn < iso(today())) { setOrderError('Expected delivery cannot be in the past.'); return; }
    const labelCopies = parseInt(orderForm.labelCopies, 10);
    if (orderForm.labelsRequired !== false && (!Number.isFinite(labelCopies) || labelCopies < 1)) { setOrderError('Enter how many labels should be prepared.'); return; }

    const orderDraft = {
      itemId: it.id, model: it.model, name: it.name, tag: it.tag,
      supplier, location: it.location, room: it.room, qty, unitCost,
      expectedOn: orderForm.expectedOn,
      vendorId: selectedVendor.id, vendorNumber: selectedVendor.vendorNumber,
      requisitionNumber: (orderForm.requisitionNumber || '').trim(), purchaseOrderNumber: (orderForm.purchaseOrderNumber || '').trim(), notes: (orderForm.notes || '').trim(),
      vendorContact: (orderForm.vendorContact || '').trim(), vendorEmail: (orderForm.vendorEmail || '').trim(), vendorPhone: (orderForm.vendorPhone || '').trim(),
      labelsRequired: orderForm.labelsRequired !== false, labelFormat: orderForm.labelFormat,
      labelCopies: orderForm.labelsRequired !== false ? labelCopies : 0, labelNotes: (orderForm.labelNotes || '').trim()
    };
    if (isAdmin) {
      const createdAt = Date.now();
      const requisitionNumber = orderDraft.requisitionNumber || `REQ-${iso(today()).replaceAll('-', '')}-${String(createdAt).slice(-5)}`;
      const order = {
        id: `ord${createdAt}`, ...orderDraft, requisitionNumber,
        orderedOn: iso(today()), orderedBy: session.name, approvedBy: session.name, approvedOn: iso(today()), status: 'Pending', workflowUnread: screen !== 'orders'
      };
      setOrders((current) => [order, ...current]);
      setOrderOpen(false);
      setFilters((current) => ({ ...current, query: '' }));
      logAudit('Pending order created', `${order.name}: ${order.qty} units from ${order.supplier} — ${order.requisitionNumber}`);
      toast(`Pending order created — ${requisitionNumber}. Pending Orders has a new notification.`);
      return;
    }
    setRequests((prev) => [{
      id: 'req' + Date.now(), type: 'Requisition', itemId: it.id, itemName: it.name, model: it.model,
      by: session.name, when: 'Submitted just now', need: `${qty} units from ${supplier} · ${money(qty * unitCost)}`,
      submittedOn: iso(today()), state: 'Pending', orderDraft, workflowUnread: screen !== 'requests'
    }, ...prev]);
    setOrderOpen(false);
    toast('Reorder requisition submitted for admin / manager approval');
  };

  const useConsumable = (itemId, draft) => {
    if (!canEdit) return 'Your account cannot issue consumable stock.';
    const item = items.find((entry) => entry.id === itemId && entry.consumable && !entry.archived && entry.status !== 'Retired');
    if (!item) return 'This consumable record is no longer available.';
    const qty = Number.parseInt(draft.qty, 10);
    const onHand = Math.max(0, Number(item.qty || 0));
    if (!Number.isFinite(qty) || qty < 1) return 'Enter a quantity of at least 1.';
    if (qty > onHand) return `Only ${onHand} ${item.unitOfMeasure || 'units'} are available.`;
    if (!String(draft.issuedTo || '').trim()) return 'Record who received or used this stock.';
    if (!String(draft.purpose || '').trim()) return 'Record why the stock was used.';
    const remainingQty = onHand - qty;
    const entry = {
      id: `CON-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      itemId: item.id, itemName: item.name, itemTag: item.tag, category: item.category,
      qty, unitOfMeasure: item.unitOfMeasure || 'unit', issuedTo: String(draft.issuedTo).trim(),
      department: String(draft.department || '').trim(), purpose: String(draft.purpose).trim(), notes: String(draft.notes || '').trim(),
      previousQty: onHand, remainingQty, unitCost: Number(item.cost || 0), usedAt: new Date().toISOString(), retainedUntil: new Date(Date.now() + 365 * 864e5).toISOString(), recordedBy: session.name, recordedByEmail: session.email
    };
    const retireUsedCartridge = item.model === 'printer-toner' && item.serializedConsumable && remainingQty === 0;
    setItems((current) => current.map((record) => record.id === item.id ? {
      ...record,
      qty: remainingQty,
      lastConsumedAt: entry.usedAt,
      lastConsumedBy: session.name,
      ...(retireUsedCartridge ? { archived: true, status: 'Retired', archivedAt: entry.usedAt, archivedBy: session.name, archiveReason: 'Toner cartridge used' } : {})
    } : record));
    setConsumableUsage((current) => [entry, ...current]);
    logAudit('Consumable stock issued', `${item.name} (${item.tag}) — ${qty} ${entry.unitOfMeasure}; ${remainingQty} remaining; issued to ${entry.issuedTo}`);
    toast(retireUsedCartridge ? `${item.name} used and removed from active toner stock` : `${qty} ${entry.unitOfMeasure} issued — ${remainingQty} remaining`);
    return '';
  };

  const addConsumableStock = (itemId, draft) => {
    if (!canEdit) return 'Your account cannot add consumable stock.';
    const item = items.find((entry) => entry.id === itemId && entry.consumable && !entry.archived && entry.status !== 'Retired');
    if (!item) return 'This consumable record is no longer available.';
    const qty = Number.parseInt(draft.qty, 10);
    if (!Number.isFinite(qty) || qty < 1) return 'Enter a quantity of at least 1.';
    if (!String(draft.notes || '').trim()) return 'Add a receiving note or reference for this stock movement.';
    const linkedPrinterIds = Array.from(new Set([...(Array.isArray(item.compatiblePrinterIds) ? item.compatiblePrinterIds : []), draft.printerId].filter(Boolean)));
    if (item.model === 'printer-toner' && linkedPrinterIds.length) {
      const receivedAt = new Date().toISOString();
      const tags = allocateAssetTags(item.model, qty);
      const created = tags.map((tag, index) => {
        const id = `itm-toner-${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 6)}`;
        const receipt = { id: `CON-RCV-${Date.now()}-${index + 1}`, itemId: id, itemName: item.name, itemTag: tag, qty: 1, previousQty: 0, resultingQty: 1, batchNumber: String(draft.batchNumber || '').trim(), notes: String(draft.notes).trim(), printerId: draft.printerId || linkedPrinterIds[0], printerName: String(draft.printerName || item.compatiblePrinterName || '').trim(), receivedAt, receivedBy: session.name, receivedByEmail: session.email, retainedUntil: new Date(Date.now() + 365 * 864e5).toISOString() };
        return { ...item, id, tag, qty: 1, compatiblePrinterIds: linkedPrinterIds, stockReceipts: [receipt], lastReceivedAt: receivedAt, lastReceivedBy: session.name, createdAt: receivedAt, createdBy: session.name, createdByEmail: session.email, updatedAt: receivedAt, serializedConsumable: true, copiedFromItemId: item.id };
      });
      setItems((current) => [...created, ...current]);
      logAudit('Individually tagged toner received', `${created.length} ${item.name} cartridge${created.length === 1 ? '' : 's'} created for ${draft.printerName || item.compatiblePrinterName || 'linked printer'} — ${created.map((record) => record.tag).join(', ')}`);
      toast(`${created.length} new cartridge${created.length === 1 ? '' : 's'} added with unique asset tags`);
      return { items: created };
    }
    const previousQty = Math.max(0, Number(item.qty || 0));
    const receivedAt = new Date().toISOString();
    const receipt = {
      id: `CON-RCV-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, itemId: item.id, itemName: item.name, itemTag: item.tag,
      qty, previousQty, resultingQty: previousQty + qty, batchNumber: String(draft.batchNumber || '').trim(), notes: String(draft.notes).trim(),
      printerId: draft.printerId || '', printerName: String(draft.printerName || '').trim(), receivedAt, receivedBy: session.name, receivedByEmail: session.email,
      retainedUntil: new Date(Date.now() + 365 * 864e5).toISOString()
    };
    setItems((current) => current.map((record) => record.id === item.id ? { ...record, qty: receipt.resultingQty, lastReceivedAt: receivedAt, lastReceivedBy: session.name, stockReceipts: [receipt, ...(record.stockReceipts || [])] } : record));
    logAudit('Consumable stock added', `${item.name} (${item.tag}) — ${qty} ${item.unitOfMeasure || 'units'} added; ${receipt.resultingQty} on hand${receipt.printerName ? ` for ${receipt.printerName}` : ''}`);
    toast(`${qty} ${item.unitOfMeasure || 'units'} added — ${receipt.resultingQty} now available`);
    return '';
  };

  const createPrinterTonerMovement = (printerId, color, mode, draft) => {
    if (!canEdit) return 'Your account cannot create toner stock.';
    const printer = items.find((entry) => entry.id === printerId && !entry.archived && !entry.consumable && entry.status !== 'Retired');
    if (!printer) return 'This printer is no longer available.';
    const qty = Number.parseInt(draft.qty, 10);
    if (!Number.isFinite(qty) || qty < 1) return 'Enter a quantity of at least 1.';
    if (mode === 'take' && !String(draft.issuedTo || '').trim()) return 'Record who installed or received this toner.';
    if (mode === 'take' && !String(draft.purpose || '').trim()) return 'Record why this toner was taken.';
    if (mode === 'add' && !String(draft.notes || '').trim()) return 'Add a receiving note or delivery reference.';
    const model = MODELS.find((entry) => entry.id === 'printer-toner');
    if (!model) return 'The printer toner equipment type is unavailable.';
    const createdAt = new Date().toISOString();
    const tags = allocateAssetTags(model.id, qty);
    const normalizedColor = String(color || 'Black').trim();
    const location = String(draft.storageLocation || printer.location || 'Storage room').trim();
    const room = String(draft.storageRoom || printer.room || 'Main storage').trim();
    const retainedUntil = new Date(Date.now() + 365 * 864e5).toISOString();
    const created = tags.map((tag, index) => ({
      id: `itm-toner-${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 6)}`, model: model.id, name: `${normalizedColor} ${model.name}`, category: model.cat, consumable: true, rank: model.rank,
      tag, serial: '', status: 'In stock', location, room, qty: mode === 'add' ? 1 : 0, min: 1, condition: 'New', cost: Number(model.cost || 0), supplier: '', assignedTo: '',
      purchased: iso(today()), warranty: '', unitOfMeasure: 'cartridge', batchNumber: String(draft.batchNumber || '').trim(), stockCode: String(draft.stockCode || '').trim(),
      color: normalizedColor, compatiblePrinterIds: [printer.id], depreciationMethod: 'Straight-line', usefulLifeYears: 1, salvageValue: 0, expectedReplacementDate: '',
      compatiblePrinterName: printer.name, compatiblePrinterTag: printer.tag, compatiblePrinterModel: printer.modelNumber || printer.name,
      sourcePrinterId: printer.id, sourcePrinterName: printer.name, sourcePrinterTag: printer.tag,
      receivedOn: iso(today()), receivedBy: session.name, receivedCompany: '', receiptSource: 'printer quick workflow', invoiceRequired: false, loanCount: 0, borrower: null, due: null, since: null,
      createdAt, createdBy: session.name, createdByEmail: session.email, updatedAt: createdAt, serializedConsumable: true
    }));
    if (mode === 'add') {
      created.forEach((record, index) => {
        record.stockReceipts = [{ id: `CON-RCV-${Date.now()}-${index + 1}`, itemId: record.id, itemName: record.name, itemTag: record.tag, qty: 1, previousQty: 0, resultingQty: 1, batchNumber: record.batchNumber, notes: String(draft.notes).trim(), printerId: printer.id, printerName: printer.name, receivedAt: createdAt, receivedBy: session.name, receivedByEmail: session.email, retainedUntil }];
        record.lastReceivedAt = createdAt;
        record.lastReceivedBy = session.name;
      });
    } else {
      const usageEntries = created.map((record, index) => ({ id: `CON-${Date.now()}-${index + 1}`, itemId: record.id, itemName: record.name, itemTag: record.tag, category: record.category, qty: 1, unitOfMeasure: record.unitOfMeasure, issuedTo: String(draft.issuedTo).trim(), department: String(draft.department || `${printer.location} · ${printer.room}`).trim(), purpose: String(draft.purpose).trim(), notes: String(draft.notes || '').trim(), previousQty: 1, remainingQty: 0, unitCost: 0, usedAt: createdAt, retainedUntil, recordedBy: session.name, recordedByEmail: session.email, untrackedOpeningUsage: true, printerId: printer.id }));
      created.forEach((record) => { record.lastConsumedAt = createdAt; record.lastConsumedBy = session.name; record.archived = true; record.status = 'Retired'; record.archivedAt = createdAt; record.archivedBy = session.name; record.archiveReason = 'Untracked toner cartridge used'; });
      setConsumableUsage((current) => [...usageEntries, ...current]);
    }
    setItems((current) => [...created, ...current]);
    logAudit(mode === 'add' ? 'Individually tagged printer toner received' : 'Untracked printer toner usage captured', `${created.length} ${created[0].name} cartridge${created.length === 1 ? '' : 's'} for ${printer.name} (${printer.tag}) — ${created.map((record) => record.tag).join(', ')}`);
    toast(mode === 'add' ? `${created.length} cartridge${created.length === 1 ? '' : 's'} created with unique tags` : `${created.length} installation record${created.length === 1 ? '' : 's'} created`);
    return { item: created[0], items: created };
  };

  const useConsumablesBulk = (lines, draft) => {
    if (!canEdit) return 'Your account cannot issue consumable stock.';
    if (!Array.isArray(lines) || !lines.length) return 'Select at least one consumable.';
    if (!String(draft.issuedTo || '').trim()) return 'Record who received or used this stock.';
    if (!String(draft.purpose || '').trim()) return 'Record why the stock was used.';
    const available = new Map(items.filter((entry) => entry.consumable && !entry.archived && entry.status !== 'Retired').map((entry) => [entry.id, entry]));
    const cleanLines = [];
    for (const line of lines) {
      const item = available.get(line.itemId);
      if (!item) return 'One of the selected consumables is no longer available.';
      const qty = Number.parseInt(line.qty, 10);
      const onHand = Math.max(0, Number(item.qty || 0));
      if (!Number.isFinite(qty) || qty < 1) return `Enter a valid quantity for ${item.name}.`;
      if (qty > onHand) return `${item.name} only has ${onHand} ${item.unitOfMeasure || 'units'} available.`;
      cleanLines.push({ item, qty, onHand });
    }
    const usedAt = new Date().toISOString();
    const retainedUntil = new Date(Date.now() + 365 * 864e5).toISOString();
    const batchId = `CON-BATCH-${Date.now()}`;
    const entries = cleanLines.map(({ item, qty, onHand }, index) => ({
      id: `${batchId}-${index + 1}`, batchId, batchSize: cleanLines.length, itemId: item.id, itemName: item.name, itemTag: item.tag, category: item.category,
      qty, unitOfMeasure: item.unitOfMeasure || 'unit', issuedTo: String(draft.issuedTo).trim(), department: String(draft.department || '').trim(), purpose: String(draft.purpose).trim(), notes: String(draft.notes || '').trim(),
      previousQty: onHand, remainingQty: onHand - qty, unitCost: Number(item.cost || 0), usedAt, retainedUntil, recordedBy: session.name, recordedByEmail: session.email
    }));
    const remainingById = new Map(entries.map((entry) => [entry.itemId, entry.remainingQty]));
    setItems((current) => current.map((record) => {
      if (!remainingById.has(record.id)) return record;
      const remainingQty = remainingById.get(record.id);
      const retireUsedCartridge = record.model === 'printer-toner' && record.serializedConsumable && remainingQty === 0;
      return {
        ...record,
        qty: remainingQty,
        lastConsumedAt: usedAt,
        lastConsumedBy: session.name,
        ...(retireUsedCartridge ? { archived: true, status: 'Retired', archivedAt: usedAt, archivedBy: session.name, archiveReason: 'Toner cartridge used in batch issue' } : {})
      };
    }));
    setConsumableUsage((current) => [...entries, ...current]);
    logAudit('Consumable batch issued', `${cleanLines.length} stock records issued to ${String(draft.issuedTo).trim()} under ${batchId}`);
    toast(`${cleanLines.length} consumable records issued together`);
    return '';
  };

  const setConsumablePrinterCompatibility = (itemId, printerIds) => {
    if (!canEdit) return false;
    const item = items.find((entry) => entry.id === itemId && entry.consumable);
    if (!item) return false;
    const validPrinterIds = new Set(items.filter((entry) => !entry.archived && !entry.consumable && (entry.category === 'Printing' || /printer|copier|plotter/i.test(`${entry.name} ${entry.model}`))).map((entry) => entry.id));
    const compatiblePrinterIds = asArray(printerIds).filter((id) => validPrinterIds.has(id));
    setItems((current) => current.map((entry) => entry.id === itemId ? { ...entry, compatiblePrinterIds, compatibilityUpdatedAt: new Date().toISOString(), compatibilityUpdatedBy: session.name } : entry));
    logAudit('Consumable printer compatibility updated', `${item.name} (${item.tag}) — ${compatiblePrinterIds.length} printer${compatiblePrinterIds.length === 1 ? '' : 's'}`);
    toast('Printer compatibility saved');
    return true;
  };

  const receiveOrder = (id) => {
    const order = orders.find((entry) => entry.id === id && ['Pending', 'Partially received'].includes(entry.status));
    if (!order) return;
    setReceiveOrderId(id);
    setReceiveForm({ receivedQty: String(order.remainingQty ?? order.qty), damagedQty: '0', note: '' });
    setReceiveError('');
  };

  const confirmReceiveOrder = () => {
    const order = orders.find((entry) => entry.id === receiveOrderId && ['Pending', 'Partially received'].includes(entry.status));
    if (!order) { setReceiveError('This order is no longer open for receipt.'); return; }
    const outstanding = Number(order.remainingQty ?? order.qty);
    const receivedQty = Number.parseInt(receiveForm.receivedQty, 10);
    const damagedQty = Number.parseInt(receiveForm.damagedQty, 10) || 0;
    if (!Number.isFinite(receivedQty) || receivedQty < 1 || receivedQty > outstanding) { setReceiveError(`Delivered quantity must be between 1 and ${outstanding}.`); return; }
    if (damagedQty < 0 || damagedQty > receivedQty) { setReceiveError('Damaged quantity cannot exceed the delivered quantity.'); return; }
    if (damagedQty > 0 && !receiveForm.note.trim()) { setReceiveError('Add a note describing damaged or rejected units.'); return; }
    const usableQty = receivedQty - damagedQty;
    const remainingQty = outstanding - receivedQty;
    const receivedOn = iso(today());
    const receipt = { id: `RCV-${Date.now()}`, receivedOn, receivedAt: new Date().toISOString(), receivedBy: session.name, receivedQty, damagedQty, usableQty, note: receiveForm.note.trim() };
    const model = MODELS.find((entry) => entry.id === order.model);
    const routeToAssignment = usableQty > 0 && isPrinterSupplyModel(model);
    if (usableQty > 0 && model?.cons === 1 && !routeToAssignment) {
      setItems((current) => {
        const target = current.find((item) => !item.archived && item.model === order.model && item.location === order.location);
        if (target) return current.map((item) => item.id === target.id ? { ...item, qty: Number(item.qty || 0) + usableQty, receivedOn, receivedBy: session.name, receivedCompany: order.supplier, receiptSource: 'order' } : item);
        return [{ id: `itm${Date.now()}`, model: model.id, name: model.name, category: model.cat, consumable: true, rank: model.rank, tag: nextAssetTag(model.id), serial: '', location: order.location, room: order.room, qty: usableQty, min: 0, condition: 'New', cost: order.unitCost, supplier: order.supplier, assignedTo: '', purchased: receivedOn, warranty: '', status: 'In stock', loanCount: 0, borrower: null, due: null, since: null, receivedOn, receivedBy: session.name, receivedCompany: order.supplier, receiptSource: 'order' }, ...current];
      });
    } else if (usableQty > 0) {
      const placement = { id: `plc${Date.now()}`, orderId: order.id, itemId: order.itemId, model: order.model, name: order.name, supplier: order.supplier, unitCost: order.unitCost, location: order.location, room: order.room, reference: order.purchaseOrderNumber || order.requisitionNumber || order.reference, requisitionNumber: order.requisitionNumber || order.reference || '', purchaseOrderNumber: order.purchaseOrderNumber || '', labelsRequired: order.labelsRequired !== false, labelFormat: order.labelFormat, labelCopies: order.labelCopies, labelNotes: order.labelNotes, receivedOn, receivedBy: session.name, receivedQty: usableQty, damagedQty, receiptNote: receiveForm.note.trim(), remainingQty: usableQty, invoiceRequired: true, invoiceGenerated: false, status: 'Pending', workflowUnread: screen !== 'placements' };
      setPlacements((current) => [placement, ...current]);
    }
    setOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, status: remainingQty > 0 ? 'Partially received' : 'Received', remainingQty, receivedOn, receivedBy: session.name, damagedQty: Number(entry.damagedQty || 0) + damagedQty, receiptNotes: [...(entry.receiptNotes || []), receipt], invoiceRequired: true, invoiceGenerated: entry.invoiceGenerated || false } : entry));
    setReceiveOrderId(null);
    logAudit('Order received', `${order.name} — ${receivedQty} delivered, ${damagedQty} damaged, ${remainingQty} remaining`);
    toast(routeToAssignment ? `Toner received — ${usableQty} cartridge${usableQty === 1 ? '' : 's'} ready in Assignment` : model?.cons === 1 ? `Stock increased by ${usableQty}` : remainingQty > 0 ? 'Partial receipt recorded — Assignment has a new notification' : 'Order received — Assignment has a new notification');
  };

  // ---- checkout / check-in ----
  const openCheckout = (itemOrId = sel?.id) => {
    // React click handlers receive an event argument. Only treat scalar values as
    // explicit IDs so the detail-page button reliably falls back to the selection.
    const itemId = typeof itemOrId === 'string' || typeof itemOrId === 'number' ? itemOrId : sel?.id;
    const item = items.find((entry) => entry.id === itemId);
    if (!canLoanNow) { toast('Your role cannot check out assets'); return false; }
    if (!item) { toast('The selected asset could not be found'); return false; }
    if (item.archived) { toast('Archived assets cannot be checked out'); return false; }
    if (item.consumable) { toast('Consumables do not use the checkout workflow'); return false; }
    if (!isBorrowingApproved(item, borrowCategoryAccess)) { toast('This asset has not been approved for TSR checkout'); return false; }
    if (item.status !== 'In stock') { toast(`This asset is unavailable while its status is ${item.status}`); return false; }
    if (checkoutTsrs.length === 0) { toast('No active TSR or administrator is available to authorize checkout'); return false; }
    setCoItem(item.id);
    setCoBorrower('');
    setCoError('');
    setCoLoanedBy(session.tsr && userState[session.email] !== false ? session.name : (checkoutTsrs[0]?.name || session.name));
    setCoPeriod(String(LOAN_TERM_DAYS));
    setCoDue(iso(new Date(today().getTime() + LOAN_TERM_DAYS * 864e5)));
    setCoOpen(true);
    return true;
  };
  const closeCheckout = () => { setCoOpen(false); setCoError(''); };
  const previewCheckoutAgreement = () => {
    const item = items.find((entry) => entry.id === coItem && !entry.archived && !entry.consumable && entry.status === 'In stock' && isBorrowingApproved(entry, borrowCategoryAccess));
    const period = parseInt(coPeriod, 10);
    if (!item) { setCoError('The selected item is no longer available for checkout.'); return; }
    if (coBorrower.trim().length < 2) { setCoError('Enter a valid borrower name or staff ID.'); return; }
    if (!checkoutTsrs.some((account) => account.name === coLoanedBy)) { setCoError('Select a recognized TSR or administrator.'); return; }
    if (!Number.isFinite(period) || period < 1) { setCoError('Enter an expected loan period of at least one day.'); return; }
    const expectedDue = iso(new Date(today().getTime() + period * 864e5));
    if (!coDue) { setCoError('Choose a due date.'); return; }
    if (coDue < iso(today())) { setCoError('The due date cannot be in the past.'); return; }
    if (coDue !== expectedDue) { setCoError(`Due date must match the ${period}-day loan period (${expectedDue}).`); return; }
    setCheckoutAgreement({
      agreementNumber: `LOAN-${iso(today()).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`,
      item: { ...item }, borrower: coBorrower.trim(), loanedBy: coLoanedBy.trim(),
      period, checkedOutOn: iso(today()), due: coDue, pending: true
    });
  };
  const finalizeCheckout = (agreement) => {
    if (checkoutFinalizing.current) return;
    checkoutFinalizing.current = true;
    const currentItem = items.find((entry) => entry.id === agreement.item.id);
    if (!currentItem || currentItem.archived || currentItem.consumable || currentItem.status !== 'In stock' || !isBorrowingApproved(currentItem, borrowCategoryAccess)) {
      toast('This asset is no longer available for checkout');
      setCheckoutAgreement(null);
      checkoutFinalizing.current = false;
      return;
    }
    const finalizedAgreement = { ...agreement, item: { ...currentItem }, pending: false };
    setItems((prev) => prev.map((x) => (x.id === agreement.item.id
      ? { ...x, status: 'On loan', borrower: agreement.borrower, issuedBy: agreement.loanedBy, expectedLoanDays: agreement.period, since: agreement.checkedOutOn, due: agreement.due, loanCount: Number(x.loanCount || 0) + 1, loanAgreement: finalizedAgreement, loanExtensions: [] }
      : x)));
    setCoOpen(false);
    setCheckoutAgreement(null);
    logAudit('Asset checked out', `${currentItem.name} (${currentItem.tag}) to ${agreement.borrower}; due ${agreement.due}`);
    sendHelpdeskMail(`Loan checkout: ${currentItem.tag}`, `Asset: ${currentItem.name} (${currentItem.tag})\nBorrower: ${agreement.borrower}\nChecked out: ${agreement.checkedOutOn}\nDue: ${agreement.due}\nAuthorized by: ${agreement.loanedBy}`);
    toast('Checked out to ' + agreement.borrower);
    checkoutFinalizing.current = false;
  };
  const extendLoan = (id, extensionDraft) => {
    if (!canLoanNow) return 'Your role cannot extend loans.';
    const it = items.find((entry) => entry.id === id);
    if (!it || it.status !== 'On loan') return 'This asset is no longer on loan.';
    const newDue = String(extensionDraft?.due || '');
    const reason = String(extensionDraft?.reason || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDue)) return 'Choose a valid new return date.';
    if (!it.due || newDue <= it.due) return 'The new return date must be later than the current due date.';
    if (!reason) return 'Enter a reason for the extension.';
    const extendedAt = new Date().toISOString();
    const extension = {
      id: `LEX-${extendedAt.slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`,
      previousDue: it.due,
      newDue,
      reason,
      authorizedBy: session.name,
      authorizedByEmail: session.email || '',
      extendedAt
    };
    setItems((current) => current.map((entry) => entry.id === id ? {
      ...entry,
      due: newDue,
      expectedLoanDays: Math.max(1, Math.round((new Date(`${newDue}T12:00:00`).getTime() - new Date(`${entry.since}T12:00:00`).getTime()) / 86400000)),
      loanExtensions: [...asArray(entry.loanExtensions), extension],
      loanAgreement: entry.loanAgreement ? { ...entry.loanAgreement, due: newDue, extensions: [...asArray(entry.loanAgreement.extensions), extension] } : entry.loanAgreement
    } : entry));
    logAudit('Loan extended', `${it.name} (${it.tag}) for ${it.borrower || 'borrower'}; ${it.due} to ${newDue}; authorized by ${session.name}; reason: ${reason}`);
    toast(`Loan extended to ${newDue}`);
    return '';
  };
  const openCheckIn = (id) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    setCiItem(id);
    setCiError('');
    setCiForm({ condition: it.condition === 'New' ? 'Good' : it.condition, outcome: 'Returned complete', accessories: 'All accessories returned', disposition: 'Return to stock', notes: '' });
    setCiOpen(true);
  };
  const closeCheckIn = () => { setCiOpen(false); setCiError(''); };
  const onCheckInChange = (key, value) => { setCiForm((form) => ({ ...form, [key]: value })); setCiError(''); };
  const confirmCheckIn = () => {
    const it = items.find((x) => x.id === ciItem && x.status === 'On loan');
    if (!it) { setCiError('This item is no longer checked out.'); return; }
    const hasIssue = ciForm.outcome !== 'Returned complete' || ciForm.accessories === 'Missing accessories' || ciForm.condition === 'Needs repair' || ciForm.disposition === 'Send to maintenance';
    if (hasIssue && !(ciForm.notes || '').trim()) { setCiError('Add return notes describing the issue.'); return; }
    const sendToMaintenance = ciForm.disposition === 'Send to maintenance';
    const nextStatus = sendToMaintenance ? 'Maintenance' : 'In stock';
    let maintenanceTicket = null;
    if (sendToMaintenance) {
      maintenanceTicket = createRepairTicket({ itemId: it.id, type: 'Repair', priority: ciForm.condition === 'Needs repair' || ciForm.outcome === 'Returned damaged' ? 'High' : 'Normal', status: 'Open', technician: '', faultDescription: ciForm.notes.trim(), resolution: '', partsCost: 0, laborCost: 0, vendor: '', vendorContact: '', rmaNumber: '', sentToVendorOn: '', expectedReturnOn: '', returnedOn: '', photos: [], linkedScheduleId: '', previousStatus: 'In stock', source: 'Loan check-in' }, { allowOnLoan: true });
      if (!maintenanceTicket) {
        setCiError('The maintenance ticket could not be created. The item has not been checked in; please try again.');
        return;
      }
    }
    setItems((prev) => prev.map((x) => (x.id === ciItem ? { ...x, status: nextStatus, condition: ciForm.condition, borrower: null, issuedBy: null, issuedByEmail: null, due: null, since: null, loanExtensions: [] } : x)));
    setHistory((prev) => [{
      id: 'h' + Date.now(), itemId: it.id, model: it.model, name: it.name, tag: it.tag,
      borrower: it.borrower, issuedBy: it.issuedBy || session.name, out: it.since, due: it.due, back: iso(today()),
      room: it.location + ' · ' + it.room, condition: ciForm.outcome,
      returnCondition: ciForm.condition, accessories: ciForm.accessories, disposition: ciForm.disposition,
      returnNotes: (ciForm.notes || '').trim(), checkedInBy: session.name, loanExtensions: asArray(it.loanExtensions)
    }, ...prev]);
    setCiOpen(false);
    logAudit('Asset checked in', `${it.name} (${it.tag}) from ${it.borrower}; ${ciForm.disposition}`);
    sendHelpdeskMail(`Loan check-in: ${it.tag}`, `Asset: ${it.name} (${it.tag})\nBorrower: ${it.borrower}\nChecked in: ${iso(today())}\nReceived by: ${session.name}\nDisposition: ${ciForm.disposition}\nNotes: ${ciForm.notes || 'None'}`);
    if (maintenanceTicket) {
      setFilters((current) => ({ ...current, query: '' }));
      toast(`${it.name} checked in — Maintenance has a new ticket (${maintenanceTicket.id})`);
    } else {
      toast(it.name + ' checked in');
    }
  };

  // ---- requests ----
  const requestBorrow = (requestedId) => {
    const itemId = typeof requestedId === 'string' ? requestedId : sel?.id;
    const requestedItem = items.find((item) => item.id === itemId);
    if (!requestedItem) return;
    if (requestedItem.archived || requestedItem.status !== 'In stock' || requestedItem.consumable || Number(requestedItem.qty) < 1 || !isBorrowingApproved(requestedItem, borrowCategoryAccess)) {
      toast('This item is not eligible for borrowing');
      return;
    }
    if (requests.some((request) => request.itemId === requestedItem.id && request.byEmail === session.email && request.state === 'Pending')) {
      toast('You already have a pending request for this item');
      return;
    }
    setRequests((prev) => [{
      id: 'rq' + Date.now(), itemId: requestedItem.id, itemName: requestedItem.name, itemTag: requestedItem.tag, model: requestedItem.model, by: session.name, byEmail: session.email,
      statusSnapshot: requestedItem.status, when: 'Requested just now', submittedOn: iso(today()), need: 'Awaiting IT approval', state: 'Pending', workflowUnread: screen !== 'requests'
    }, ...prev]);
    toast('Request sent for ' + requestedItem.name, { tone: 'success' });
  };
  const approveRequest = (id) => {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    if (r.type === 'Requisition' && r.orderDraft) {
      setRequests((prev) => prev.map((x) => (x.id === id ? { ...x, state: 'Approved', approvedBy: session.name, approvedOn: iso(today()) } : x)));
      const requisitionNumber = r.orderDraft.requisitionNumber || `REQ-${iso(today()).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
      setOrders((prev) => [{
        id: 'ord' + Date.now(), ...r.orderDraft, requisitionId: r.id, requisitionNumber,
        orderedOn: iso(today()), orderedBy: r.by, approvedBy: session.name, approvedOn: iso(today()), status: 'Pending', workflowUnread: true
      }, ...prev]);
      toast('Requisition approved — vendor order details generated');
      return;
    }
    const item = items.find((entry) => entry.id === r.itemId);
    if (!item || item.archived || item.status !== 'In stock' || item.consumable || Number(item.qty) < 1 || !isBorrowingApproved(item, borrowCategoryAccess)) {
      toast('Request cannot be approved because the asset is no longer available');
      return;
    }
    const checkedOutOn = iso(today());
    const due = iso(new Date(today().getTime() + LOAN_TERM_DAYS * 864e5));
    const agreement = { agreementNumber: `LOAN-${checkedOutOn.replaceAll('-', '')}-${String(Date.now()).slice(-5)}`, item: { ...item }, borrower: r.by, borrowerEmail: r.byEmail, loanedBy: session.name, period: LOAN_TERM_DAYS, checkedOutOn, due, pending: false, requestId: r.id };
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'On loan', borrower: r.by, borrowerEmail: r.byEmail, issuedBy: session.name, issuedByEmail: session.email, expectedLoanDays: LOAN_TERM_DAYS, since: checkedOutOn, due, loanCount: entry.loanCount + 1, loanAgreement: agreement, loanExtensions: [] } : entry));
    setRequests((prev) => prev.map((x) => (x.id === id ? { ...x, state: 'Approved', approvedBy: session.name, approvedOn: checkedOutOn, fulfilledOn: checkedOutOn } : x)));
    logAudit('Borrow request approved', `${item.name} (${item.tag}) checked out to ${r.by}; due ${due}`);
    toast('Approved and checked out to ' + r.by);
  };
  const declineRequest = (id, reason) => {
    const r = requests.find((x) => x.id === id);
    const explanation = String(reason || '').trim();
    if (!r || r.state !== 'Pending') return false;
    if (explanation.length < 3) { toast('Enter a reason for declining this request'); return false; }
    const declinedOn = iso(today());
    setRequests((prev) => prev.map((x) => (x.id === id ? { ...x, state: 'Declined', declineReason: explanation, declinedBy: session.name, declinedOn } : x)));
    logAudit(r.type === 'Requisition' ? 'Requisition declined' : 'Borrow request declined', `${r.itemName} requested by ${r.by}; reason: ${explanation}`);
    if (r) toast('Declined — ' + r.itemName);
    return true;
  };

  const generateInvoice = (id) => {
    if (!isAdmin) return;
    const invoiceNumber = `INV-${iso(today()).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
    setOrders((prev) => prev.map((order) => order.id === id ? { ...order, invoiceGenerated: true, invoiceNumber, invoiceGeneratedOn: iso(today()), invoiceGeneratedBy: session.name } : order));
    setPlacements((prev) => prev.map((placement) => placement.orderId === id ? { ...placement, invoiceGenerated: true, invoiceNumber } : placement));
    toast('Invoice generated — ' + invoiceNumber);
  };

  const saveApprovedVendor = (draft) => {
    if (!isAdmin) return 'Administrator access is required.';
    const duplicate = approvedVendors.find((vendor) => vendor.id !== draft.id && (vendor.name.toLowerCase() === draft.name.toLowerCase() || vendor.vendorNumber.toLowerCase() === draft.vendorNumber.toLowerCase()));
    if (duplicate) return 'Vendor names and vendor numbers must be unique.';
    const saved = { ...draft, id: draft.id || `vendor-${Date.now()}`, approved: draft.approved !== false, updatedAt: new Date().toISOString(), updatedBy: session.name };
    setApprovedVendors((current) => draft.id ? current.map((vendor) => vendor.id === draft.id ? saved : vendor) : [...current, saved]);
    logAudit(draft.id ? 'Approved vendor updated' : 'Approved vendor created', `${saved.name} (${saved.vendorNumber})`);
    toast(draft.id ? 'Vendor record updated' : 'Approved vendor added');
    return '';
  };

  const toggleApprovedVendor = (id) => {
    if (!isAdmin) return;
    const vendor = approvedVendors.find((entry) => entry.id === id);
    if (!vendor) return;
    setApprovedVendors((current) => current.map((entry) => entry.id === id ? { ...entry, approved: entry.approved === false, updatedAt: new Date().toISOString(), updatedBy: session.name } : entry));
    logAudit(vendor.approved === false ? 'Vendor approved' : 'Vendor deactivated', `${vendor.name} (${vendor.vendorNumber})`);
    toast(vendor.approved === false ? 'Vendor approved' : 'Vendor removed from active order selection');
  };

  const saveApprovalContact = (draft) => {
    if (!isAdmin) return 'Administrator access is required.';
    const duplicate = approvalContacts.find((contact) => contact.id !== draft.id && (contact.email.toLowerCase() === draft.email.toLowerCase() || contact.name.toLowerCase() === draft.name.toLowerCase()));
    if (duplicate) return 'Approver names and email addresses must be unique.';
    const saved = { ...draft, id: draft.id || `approver-${Date.now()}`, active: draft.active !== false, updatedAt: new Date().toISOString(), updatedBy: session.name };
    setApprovalContacts((current) => draft.id ? current.map((contact) => contact.id === draft.id ? saved : contact) : [...current, saved]);
    logAudit(draft.id ? 'Approval contact updated' : 'Approval contact created', `${saved.name} (${saved.email})`);
    toast(draft.id ? 'Approval contact updated' : 'Management approver added');
    return '';
  };

  const addApprovalContactFromOrder = (draft) => {
    if (!canEdit) return { error: 'Your account cannot add approval contacts.' };
    const name = String(draft.name || '').trim();
    const email = String(draft.email || '').trim().toLowerCase();
    const title = String(draft.title || '').trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter the manager’s name and a valid email address.' };
    const existing = approvalContacts.find((contact) => contact.email.toLowerCase() === email || contact.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (existing.active === false) setApprovalContacts((current) => current.map((contact) => contact.id === existing.id ? { ...contact, active: true, updatedAt: new Date().toISOString(), updatedBy: session.name } : contact));
      return { contact: { ...existing, active: true } };
    }
    const contact = { id: `approver-${Date.now()}`, name, email, title, active: true, createdAt: new Date().toISOString(), createdBy: session.name };
    setApprovalContacts((current) => [...current, contact]);
    logAudit('Approval contact created from order', `${contact.name} (${contact.email})`);
    toast('Manager saved for future approvals');
    return { contact };
  };

  const toggleApprovalContact = (id) => {
    if (!isAdmin) return;
    const contact = approvalContacts.find((entry) => entry.id === id);
    if (!contact) return;
    setApprovalContacts((current) => current.map((entry) => entry.id === id ? { ...entry, active: entry.active === false, updatedAt: new Date().toISOString(), updatedBy: session.name } : entry));
    logAudit(contact.active === false ? 'Approval contact activated' : 'Approval contact deactivated', `${contact.name} (${contact.email})`);
    toast(contact.active === false ? 'Approver activated' : 'Approver removed from approval dropdowns');
  };

  const previewOrderApproval = async (id) => {
    const order = orders.find((entry) => entry.id === id);
    if (!order) return;
    try {
      const { generateOrderApprovalPdf } = await workspaceModuleLoaders.OrderApprovalPdf();
      await generateOrderApprovalPdf(order);
    }
    catch (error) { toast(error.message || 'Approval PDF could not be generated'); }
  };

  const markApprovalPrepared = (details) => {
    const preparedAt = new Date().toISOString();
    const order = orders.find((entry) => entry.id === approvalOrderId);
    setOrders((current) => current.map((entry) => entry.id === approvalOrderId ? { ...entry, approvalStatus: 'Prepared for management', approvalPreparedAt: preparedAt, approvalPreparedBy: session.name, approvalRecipient: details.to, approvalRecipientName: details.approverName, approvalCc: details.cc, approvalFileName: details.filename, approvalFilePath: details.path } : entry));
    if (order) logAudit('Procurement approval prepared', `${order.requisitionNumber || order.id} for ${details.approverName} (${details.to})`);
    toast(details.bodyCopied ? 'Outlook opened — press Ctrl+V to insert the copied full message' : 'Approval PDF saved to Documents and Outlook opened');
  };

  const generateItemInvoice = (id) => {
    if (!isAdmin) return;
    const invoiceNumber = `INV-${iso(today()).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`;
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, invoiceGenerated: true, invoiceNumber, invoiceGeneratedOn: iso(today()), invoiceGeneratedBy: session.name } : item));
    toast('Invoice generated — ' + invoiceNumber);
  };

  // ---- scan ----
  const doScan = (text, mode = 'lookup') => {
    const t = (text || '').trim().toUpperCase();
    const it = activeItems.find((x) => String(x.tag || '').toUpperCase() === t || String(x.serial || '').toUpperCase() === t);
    const reservation = reservedBarcodes.find((entry) => entry.status !== 'Voided' && String(entry.tag || '').toUpperCase() === t);
    if (!it && reservation) {
      if (!canEdit) return { error: 'This is a reserved blank label, but your role cannot register new inventory.', reservation };
      if (!['smart', 'register'].includes(mode)) return { error: 'This barcode is a reserved blank label. Choose Register label to create its inventory record.', reservation };
      openAdd(reservation.model);
      setForm((current) => ({ ...current, tag: reservation.tag, _autoTag: false, ...(reservation.model ? { model: reservation.model } : {}) }));
      return { reservation, action: `New ${reservation.equipmentType || 'inventory'} form opened`, navigation: true };
    }
    if (!it) return { error: 'No asset carries the tag ' + (t || '—') + '.' };
    setRecentScans((prev) => [it.id, ...prev.filter((x) => x !== it.id)].slice(0, 5));
    if (mode === 'register') return { error: `${it.name} is already registered to this barcode.`, item: it };
    const action = mode === 'smart'
      ? (it.consumable ? 'consume' : it.status === 'On loan' ? 'checkin' : it.status === 'In stock' ? 'checkout' : 'lookup')
      : mode;
    if (action === 'checkout') {
      if (!canLoanNow) return { error: 'Your role cannot check out assets.', item: it };
      if (it.consumable) return { error: 'Consumable stock cannot be checked out as a serialized loan.', item: it };
      if (!isBorrowingApproved(it, borrowCategoryAccess)) return { error: 'This asset has not been approved for TSR checkout.', item: it };
      if (it.status !== 'In stock') return { error: `${it.name} is ${it.status.toLowerCase()} and cannot be checked out.`, item: it };
      openCheckout(it.id);
      return { item: it, action: 'Checkout form opened', navigation: true };
    }
    if (action === 'checkin') {
      if (!canLoanNow) return { error: 'Your role cannot check in assets.', item: it };
      if (it.status !== 'On loan') return { error: `${it.name} is not currently on loan.`, item: it };
      openCheckIn(it.id);
      return { item: it, action: 'Check-in inspection opened', navigation: true };
    }
    if (action === 'consume') {
      if (!canEdit) return { error: 'Your role cannot issue consumable stock.', item: it };
      if (!it.consumable) return { error: `${it.name} is a serialized asset, not consumable stock.`, item: it };
      if (Number(it.qty || 0) < 1) return { error: `${it.name} has no stock available to issue.`, item: it };
      setConsumableScannerAction({ itemId: it.id, action: 'issue', requestedAt: Date.now() });
      setScreen('consumables');
      return { item: it, action: 'Consumable issuing workflow opened', navigation: true };
    }
    setSelectedId(it.id);
    setScreen('item');
    return { item: it, action: 'Asset record opened', navigation: true };
  };
  const simulateScan = () => {
    const pick = activeItems[Math.floor(Math.random() * activeItems.length)];
    return pick ? pick.tag : '';
  };

  // ---- users ----
  const toggleUser = async (email, active) => {
    const target = accounts.find((account) => account.email === email);
    if (!target) return false;
    if (active && email === session.email) { toast('You cannot suspend your own account'); return false; }
    const otherActiveAdmins = accounts.filter((account) => account.email !== email && account.role === 'Admin' && userState[account.email] !== false);
    if (active && target.role === 'Admin' && otherActiveAdmins.length === 0) { toast('The last active administrator cannot be suspended'); return false; }
    if (cloudSession) {
      try {
        const updated = await updateSupabaseProfile(email, { active: !active });
        setRemoteAccounts((current) => current.map((entry) => entry.email === email ? updated : entry));
      } catch (error) {
        toast(error?.message || 'The cloud account status could not be updated.');
        return false;
      }
    }
    setUserState((prev) => ({ ...prev, [email]: !active }));
    logAudit(active ? 'User suspended' : 'User restored', `${target.name} (${email})`);
    toast(target.name + (active ? ' suspended' : ' restored'));
    return true;
  };

  const updateUserProfile = async (email, changes) => {
    if (!isAdmin) return false;
    const target = accounts.find((account) => account.email === email);
    if (!target) return false;
    if (email === session.email && changes.role && changes.role !== 'Admin') { toast('You cannot remove your own administrator role'); return false; }
    if (target.role === 'Admin' && changes.role && changes.role !== 'Admin') {
      const otherActiveAdmins = accounts.filter((account) => account.email !== email && account.role === 'Admin' && userState[account.email] !== false);
      if (otherActiveAdmins.length === 0) { toast('The last active administrator cannot be demoted'); return false; }
    }
    if (cloudSession) {
      try {
        const updated = await updateSupabaseProfile(email, changes);
        setRemoteAccounts((current) => current.map((entry) => entry.email === email ? updated : entry));
      } catch (error) {
        toast(error?.message || 'The cloud profile could not be updated.');
        return false;
      }
    }
    if (!cloudSession) setProfileState((prev) => ({ ...prev, [email]: { ...(prev[email] || {}), ...changes } }));
    if (session.email === email) {
      setSession((current) => ({ ...current, ...changes }));
      if (changes.role && !(navOverrides[changes.role] || NAV[changes.role]).includes(screen)) setScreen((navOverrides[changes.role] || NAV[changes.role])[0]);
    }
    logAudit('User profile updated', `${target.name} (${email})${changes.role && changes.role !== target.role ? ` role changed from ${target.role} to ${changes.role}` : ''}`);
    toast('User profile updated');
    return true;
  };

  const updateOwnAvatar = async (avatar) => {
    if (!session) return;
    if (cloudSession) {
      try {
        await updateOwnSupabaseAvatar(avatar);
        setRemoteAccounts((current) => current.map((entry) => entry.email === session.email ? { ...entry, avatar } : entry));
      } catch (error) {
        toast(error?.message || 'The profile picture could not be saved to Supabase.');
        return;
      }
    }
    if (!cloudSession) setProfileState((prev) => ({ ...prev, [session.email]: { ...(prev[session.email] || {}), avatar } }));
    setSession((current) => ({ ...current, avatar }));
    toast(avatar ? 'Profile picture updated' : 'Profile picture removed');
  };

  const createUserAccount = async (account) => {
    if (!isAdmin) return { error: 'Only administrators can create user accounts.' };
    const email = account.email.trim().toLowerCase();
    if (accounts.some((entry) => entry.email.toLowerCase() === email)) return { error: 'An account already uses that campus email.' };
    let created;
    if (cloudSession) {
      try {
        created = await createSupabaseAccount({ ...account, email });
        setRemoteAccounts((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        return { error: error?.message || 'The Supabase account could not be created.' };
      }
    } else {
      const passwordHash = await hashPassword(account.pass);
      created = { ...account, email, passwordHash, lastSeen: 'Never', tsr: !!account.tsr, source: 'local' };
      delete created.pass;
      setCustomAccounts((current) => [...current, created]);
    }
    setUserState((current) => ({ ...current, [email]: true }));
    toast('User account created — ' + created.name);
    return { account: created };
  };

  const resetAccountPassword = async (email, temporaryPassword) => {
    if (!isAdmin) return { error: 'Only administrators can reset account passwords.' };
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const password = String(temporaryPassword || '');
    if (password.length < 8) return { error: 'The temporary password must contain at least 8 characters.' };
    const target = accounts.find((account) => account.email.toLowerCase() === normalizedEmail);
    if (!target) return { error: 'That account could not be found.' };
    if (cloudSession) {
      try {
        await resetSupabaseAccountPassword(normalizedEmail, password);
      } catch (error) {
        return { error: error?.message || 'The Supabase password could not be reset.' };
      }
    } else {
      const passwordHash = await hashPassword(password);
      setCustomAccounts((current) => {
        const existing = current.find((entry) => entry.email.toLowerCase() === normalizedEmail);
        if (existing) return current.map((entry) => entry.email.toLowerCase() === normalizedEmail ? { ...entry, passwordHash, source: 'local' } : entry);
        return [...current, { ...target, passwordHash, source: 'local' }];
      });
    }
    logAudit('Password reset by administrator', `${target.name || normalizedEmail} (${normalizedEmail}) received a new temporary password`);
    toast(`Temporary password set for ${target.name || normalizedEmail}`);
    return {};
  };

  const setBorrowCategoryApproval = (category, allowed) => {
    if (!isAdmin) return false;
    const normalizedCategory = String(category || '').trim();
    if (!normalizedCategory) return false;
    setBorrowCategoryAccess((current) => ({ ...current, [normalizedCategory]: !!allowed }));
    logAudit('Borrowing category access updated', `${normalizedCategory}: ${allowed ? 'approved for TSR checkout and staff requests' : 'blocked from borrowing'}`);
    toast(`${normalizedCategory} ${allowed ? 'added to' : 'removed from'} the borrowing catalogue`);
    return true;
  };

  const updateRoleAccess = (targetRole, targetScreen, enabled) => {
    if (!isAdmin) return false;
    if (targetScreen === 'settings' && targetRole === 'Admin') return false;
    setNavOverrides((current) => ({
      ...current,
      [targetRole]: enabled
        ? Array.from(new Set([...(current[targetRole] || []), targetScreen]))
        : (current[targetRole] || []).filter((entry) => entry !== targetScreen)
    }));
    logAudit('Role page access updated', `${targetRole}: ${LABELS[targetScreen]?.[0] || targetScreen} ${enabled ? 'enabled' : 'disabled'}`);
    toast(`${LABELS[targetScreen]?.[0] || targetScreen} ${enabled ? 'enabled for' : 'removed from'} ${targetRole}`);
    return true;
  };

  const importCsvData = async ({ files, assets: interpretedAssets, procurement: interpretedProcurement }) => {
    if (!isAdmin) return { error: 'Only administrators can import company data.' };
    const assetKeys = new Set(items.map((item) => item.importKey).filter(Boolean));
    const serials = new Set(items.map((item) => (item.serial || '').trim().toLowerCase()).filter(Boolean));
    const tags = new Set(items.map((item) => (item.tag || '').trim().toLowerCase()).filter(Boolean));
    const procurementKeys = new Set(procurementRecords.map((record) => record.importKey).filter(Boolean));
    const knownTagValues = [...items.map((item) => item.tag), ...reservedBarcodes.map((entry) => entry.tag)].filter(Boolean);
    const nextByCode = new Map();
    const usedByCode = new Map();
    const importedAssets = [];
    let skipped = 0;
    interpretedAssets.forEach((record, index) => {
      const serial = (record.serial || '').trim().toLowerCase();
      const suppliedTag = (record.tag || '').trim().toLowerCase();
      if (assetKeys.has(record.importKey) || (serial && serials.has(serial)) || (suppliedTag && tags.has(suppliedTag))) { skipped += 1; return; }
      let tag = (record.tag || '').trim();
      if (!tag) {
        const code = assetTagCodeForModel(record.model, record.category);
        if (!usedByCode.has(code)) {
          usedByCode.set(code, new Set(knownTagValues.map(parseMsbmAssetTag).filter((parsed) => parsed?.code === code).map((parsed) => parsed.sequence)));
          nextByCode.set(code, highestEstablishedSequence(knownTagValues, code) + 1);
        }
        const usedSequences = usedByCode.get(code);
        let nextNumber = nextByCode.get(code);
        while (usedSequences.has(nextNumber)) nextNumber += 1;
        tag = formatMsbmAssetTag(code, nextNumber, record.purchased || new Date());
        usedSequences.add(nextNumber);
        nextByCode.set(code, nextNumber + 1);
        knownTagValues.push(tag);
      }
      const imported = { ...record, id: `csv-asset-${Date.now()}-${index}`, tag, purchased: record.purchased || iso(today()), warranty: record.warranty || '', qty: 1 };
      importedAssets.push(imported);
      assetKeys.add(record.importKey);
      tags.add(tag.toLowerCase());
      if (serial) serials.add(serial);
    });
    const importedProcurement = [];
    interpretedProcurement.forEach((record, index) => {
      if (procurementKeys.has(record.importKey)) { skipped += 1; return; }
      importedProcurement.push({ ...record, id: `csv-proc-${Date.now()}-${index}` });
      procurementKeys.add(record.importKey);
    });
    const run = { id: `csv-run-${Date.now()}`, files: files.map((file) => file.fileName), assets: importedAssets.length, procurement: importedProcurement.length, skipped, by: session.name, when: new Date().toLocaleString() };
    if (cloudSession) {
      try {
        const stored = await storeSupabaseCsvImport({ assets: importedAssets, procurement: importedProcurement, run });
        setCsvCloudCursor(stored.cursor);
      } catch (cloudError) {
        console.error('Failed to store CSV import in Supabase', cloudError);
        return { error: `Supabase could not store this CSV import: ${cloudError?.message || 'Unknown cloud storage error'}` };
      }
    }
    if (importedAssets.length) setItems((current) => [...current, ...importedAssets]);
    if (importedProcurement.length) setProcurementRecords((current) => [...importedProcurement, ...current]);
    setImportRuns((current) => [run, ...current]);
    toast(`CSV import completed — ${importedAssets.length + importedProcurement.length} records stored${cloudSession ? ' in Supabase' : ''}`);
    return { assets: importedAssets.length, procurement: importedProcurement.length, skipped, cloud: cloudSession };
  };

  const createStocktake = ({ scopeType, building, room, title }) => {
    const normalizedScope = scopeType === 'room' ? 'room' : 'building';
    const normalizedBuilding = String(building || '').trim();
    const normalizedRoom = normalizedScope === 'room' ? String(room || '').trim() : '';
    if (!normalizedBuilding || (normalizedScope === 'room' && !normalizedRoom)) {
      toast('Choose a valid stocktake location');
      return null;
    }
    const conflict = stocktakes.find((entry) => entry.status === 'In progress'
      && entry.building === normalizedBuilding
      && (entry.scopeType === 'building' || normalizedScope === 'building' || entry.room === normalizedRoom));
    if (conflict) { toast(`Stocktake already in progress — ${conflict.title}`); return null; }
    const createdAt = new Date().toISOString();
    const scopedAssets = items.filter((item) => !item.archived && item.status !== 'Retired'
      && (item.location || 'Unassigned') === normalizedBuilding
      && (normalizedScope !== 'room' || (item.room || 'Unassigned') === normalizedRoom));
    const snapshot = (item) => ({
      id: item.id, name: item.name, tag: item.tag, serial: item.serial,
      location: item.location, room: item.room, model: item.model, status: item.status,
      borrower: item.borrower || '', due: item.due || '', consumable: !!item.consumable, qty: Number(item.qty || 0)
    });
    const expectedAssets = scopedAssets.filter((item) => item.status !== 'On loan').map(snapshot);
    const excludedAssets = scopedAssets.filter((item) => item.status === 'On loan').map(snapshot);
    const expectedIds = expectedAssets.map((item) => item.id);
    const record = {
      id: `STK-${createdAt.slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`,
      title: title.trim() || `${normalizedScope === 'room' ? normalizedRoom : normalizedBuilding} physical stocktake`,
      scopeType: normalizedScope, building: normalizedBuilding, room: normalizedRoom, expectedIds, expectedAssets, excludedAssets,
      observations: {}, status: 'In progress', createdAt, createdBy: session.name
    };
    setStocktakes((current) => [record, ...current]);
    logAudit('Stocktake created', `${record.id} — ${record.title}; ${expectedIds.length} expected, ${excludedAssets.length} checked out`);
    toast(`Stocktake created — ${expectedIds.length} expected${excludedAssets.length ? `, ${excludedAssets.length} checked out` : ''}`);
    return record;
  };

  const updateAssetLifecycle = (itemId, changes) => {
    setItems((current) => current.map((item) => item.id === itemId ? { ...item, ...changes } : item));
    toast('Asset lifecycle settings updated');
  };

  const updateAssetBorrowing = useCallback((itemId, allowed) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item || item.consumable || !isAdmin) return;
    if (item.disposalApproved || (item.status === 'Retired' && item.dispositionType)) {
      toast('Disposed assets cannot be made available for borrowing');
      return;
    }
    const borrowEligibility = allowed ? 'allowed' : 'blocked';
    setItems((current) => current.map((entry) => entry.id === itemId ? { ...entry, borrowEligibility } : entry));
    logAudit('Asset borrowing permission updated', `${item.name} (${item.tag}) — ${allowed ? 'loanable' : 'restricted'}`);
    toast(`${item.name} is now ${allowed ? 'available for borrowing' : 'restricted from borrowing'}`);
  }, [isAdmin, items, logAudit, toast]);

  const createLifecycleAction = (draft) => {
    const item = items.find((entry) => entry.id === draft.itemId);
    if (!item || item.status === 'Retired') return null;
    if (lifecycleActions.some((entry) => entry.itemId === item.id && ['Pending approval', 'Approved'].includes(entry.status))) {
      toast('This asset already has an active lifecycle request');
      return null;
    }
    const requestedAt = new Date().toISOString();
    const action = {
      ...draft, id: `LCA-${requestedAt.slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`,
      itemName: item.name, itemTag: item.tag, itemSerial: item.serial, purchaseDate: item.purchased,
      purchaseCost: item.cost, recordedLocation: item.location, recordedRoom: item.room,
      status: 'Pending approval', requestedAt, requestedBy: session.name,
      activity: [{ at: requestedAt, by: session.name, text: `${draft.type} request submitted for approval` }]
    };
    setLifecycleActions((current) => [action, ...current]);
    logAudit('Lifecycle request created', `${draft.type} for ${item.name} (${item.tag})`);
    toast(`${draft.type} request submitted for approval`);
    return action;
  };

  const cancelLifecycleAction = (actionId) => {
    const action = lifecycleActions.find((entry) => entry.id === actionId);
    if (!action || action.status !== 'Pending approval' || (!isAdmin && action.requestedBy !== session.name)) return false;
    const at = new Date().toISOString();
    setLifecycleActions((current) => current.map((entry) => entry.id === actionId ? {
      ...entry, status: 'Cancelled', cancelledAt: at, cancelledBy: session.name,
      activity: [...(entry.activity || []), { at, by: session.name, text: 'Workflow cancelled before approval' }]
    } : entry));
    logAudit('Lifecycle request cancelled', `${action.type} for ${action.itemName} (${action.itemTag})`);
    toast('Lifecycle request cancelled');
    return true;
  };

  const decideLifecycleAction = (actionId, decision, note) => {
    if (!isAdmin) return false;
    const selectedAction = lifecycleActions.find((action) => action.id === actionId && action.status === 'Pending approval');
    if (!selectedAction) return false;
    const at = new Date().toISOString();
    setLifecycleActions((current) => current.map((action) => action.id === actionId && action.status === 'Pending approval' ? {
      ...action, status: decision, approvalNote: note.trim(), decidedAt: at, decidedBy: session.name,
      activity: [...(action.activity || []), { at, by: session.name, text: `${decision}${note.trim() ? ` — ${note.trim()}` : ''}` }]
    } : action));
    if (decision === 'Approved' && DISPOSITION_ACTION_TYPES.includes(selectedAction.type)) {
      setItems((current) => current.map((item) => item.id === selectedAction.itemId ? {
        ...item,
        disposalApproved: true,
        disposalApprovedAt: at,
        disposalApprovedBy: session.name,
        disposalApprovalReference: selectedAction.id,
        disposalApprovalType: selectedAction.type,
        disposalReason: selectedAction.justification || '',
        borrowEligibility: 'blocked'
      } : item));
    }
    logAudit('Lifecycle decision', `${actionId}: ${decision}${note.trim() ? ` — ${note.trim()}` : ''}`);
    toast(`Lifecycle request ${decision.toLowerCase()}`);
    return true;
  };

  const completeLifecycleAction = (actionId) => {
    if (!isAdmin) return false;
    const action = lifecycleActions.find((entry) => entry.id === actionId);
    if (!action || action.status !== 'Approved') return false;
    const currentItem = items.find((item) => item.id === action.itemId);
    if (!currentItem || currentItem.status === 'On loan' || currentItem.status === 'Maintenance') {
      toast('Check in the asset and close active maintenance work before completing this workflow');
      return false;
    }
    const completedAt = new Date().toISOString();
    setItems((current) => current.map((item) => {
      if (item.id !== action.itemId) return item;
      if (action.type === 'Transfer') return {
        ...item, location: action.destinationBuilding || item.location, room: action.destinationRoom || item.room,
        assignedTo: action.recipient || item.assignedTo, lastTransferAt: completedAt, lastTransferBy: session.name,
        lastTransferReference: action.id
      };
      return {
        ...item, status: 'Retired', disposalApproved: true, dispositionType: action.type, dispositionDate: action.effectiveDate || iso(today()),
        dispositionReference: action.id, dispositionRecipient: action.recipient || action.vendor || '',
        dispositionProceeds: Math.max(0, Number(action.proceeds) || 0), dispositionReason: action.justification
      };
    }));
    setLifecycleActions((current) => current.map((entry) => entry.id === actionId ? {
      ...entry, status: 'Completed', completedAt, completedBy: session.name,
      activity: [...(entry.activity || []), { at: completedAt, by: session.name, text: `${entry.type} workflow completed and asset record updated` }]
    } : entry));
    logAudit('Lifecycle completed', `${action.type} for ${action.itemName} (${action.itemTag})`);
    toast(`${action.type} workflow completed`);
    return true;
  };

  const createRepairTicket = (draft, options = {}) => {
    const item = items.find((entry) => entry.id === draft.itemId);
    if (!item || item.disposalApproved || item.status === 'Retired' || (item.status === 'On loan' && !options.allowOnLoan)) {
      toast('This asset must be checked in and active before entering repair');
      return null;
    }
    const createdAt = new Date().toISOString();
    const ticket = {
      ...draft,
      id: `RPR-${createdAt.slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-5)}`,
      itemName: item.name, itemTag: item.tag, itemSerial: item.serial, itemLocation: item.location, itemRoom: item.room,
      previousStatus: draft.previousStatus || (item.status === 'Maintenance' ? 'In stock' : item.status),
      status: ACTIVE_REPAIR_STATES.includes(draft.status) ? draft.status : 'Open', createdAt, createdBy: session.name, workflowUnread: screen !== 'maintenance',
      updatedAt: createdAt, updatedBy: session.name,
      activity: [{ at: createdAt, by: session.name, text: 'Repair ticket created' }]
    };
    setRepairTickets((current) => [ticket, ...current]);
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: 'Maintenance', maintenanceTicketId: ticket.id, maintenanceReason: ticket.faultDescription } : entry));
    logAudit('Repair ticket created', `${ticket.id}: ${ticket.itemName} (${ticket.itemTag})${ticket.source ? ` — ${ticket.source}` : ''}`);
    toast(`Repair ticket created — ${ticket.id}`);
    sendHelpdeskMail(`Repair ticket ${ticket.id}: ${ticket.itemTag}`, `Ticket: ${ticket.id}\nAsset: ${ticket.itemName} (${ticket.itemTag})\nPriority: ${ticket.priority}\nFault: ${ticket.faultDescription}\nCreated by: ${ticket.createdBy}`);
    return ticket;
  };

  const updateRepairTicket = (ticketId, changes) => {
    const ticket = repairTickets.find((entry) => entry.id === ticketId);
    if (!ticket) return false;
    const updatedAt = new Date().toISOString();
    const next = { ...ticket, ...changes, updatedAt, updatedBy: session.name };
    const activity = [...(ticket.activity || [])];
    if (changes.status && changes.status !== ticket.status) activity.push({ at: updatedAt, by: session.name, text: `Status changed from ${ticket.status} to ${changes.status}` });
    if (changes.resolution && changes.resolution !== ticket.resolution) activity.push({ at: updatedAt, by: session.name, text: 'Resolution details updated' });
    next.activity = activity;
    if (['Completed', 'Cancelled'].includes(next.status) && !next.completedAt) {
      next.completedAt = updatedAt;
      next.completedBy = session.name;
    }
    if (ACTIVE_REPAIR_STATES.includes(next.status)) {
      delete next.completedAt;
      delete next.completedBy;
    }
    setRepairTickets((current) => current.map((entry) => entry.id === ticketId ? next : entry));
    if (ACTIVE_REPAIR_STATES.includes(next.status)) {
      setItems((current) => current.map((entry) => entry.id === next.itemId ? { ...entry, status: 'Maintenance', maintenanceTicketId: next.id, maintenanceReason: next.faultDescription } : entry));
    } else {
      const anotherActive = repairTickets.some((entry) => entry.id !== ticketId && entry.itemId === next.itemId && ACTIVE_REPAIR_STATES.includes(entry.status));
      if (!anotherActive) setItems((current) => current.map((entry) => entry.id === next.itemId && entry.status !== 'Retired' ? { ...entry, status: next.previousStatus || 'In stock', maintenanceTicketId: null, maintenanceReason: '' } : entry));
      if (next.status === 'Completed' && next.linkedScheduleId) {
        setMaintenanceSchedules((current) => current.map((schedule) => schedule.id === next.linkedScheduleId ? {
          ...schedule, lastCompletedAt: updatedAt, lastCompletedBy: session.name,
          nextDue: iso(new Date(today().getTime() + Math.max(1, Number(schedule.frequencyDays) || 365) * 864e5))
        } : schedule));
      }
    }
    toast(`Repair ticket updated — ${next.status}`);
    return true;
  };

  const markMaintenanceEmailPrepared = (ticketId, details) => {
    const preparedAt = new Date().toISOString();
    const ticket = repairTickets.find((entry) => entry.id === ticketId);
    if (!ticket) return;
    setRepairTickets((current) => current.map((entry) => entry.id === ticketId ? {
      ...entry,
      lastEmailPreparedAt: preparedAt,
      lastEmailPreparedBy: session.name,
      lastEmailRecipient: details.to,
      lastEmailCc: details.cc,
      lastEmailSubject: details.subject,
      lastEmailFileName: details.filename,
      lastEmailFilePath: details.path,
      activity: [...(entry.activity || []), { at: preparedAt, by: session.name, text: `Outlook email prepared for ${details.to}` }]
    } : entry));
    logAudit('Maintenance email prepared', `${ticket.id} for ${details.to}`);
    toast(details.bodyCopied ? 'Outlook opened — press Ctrl+V to insert the copied full maintenance message' : 'Maintenance PDF saved to Documents and Outlook opened');
  };

  const addMaintenanceContact = (draft) => {
    if (!canEdit) return { error: 'Your account cannot add maintenance contacts.' };
    const name = String(draft.name || '').trim();
    const email = String(draft.email || '').trim().toLowerCase();
    const title = String(draft.title || '').trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a contact name and valid email address.' };
    const existing = maintenanceEmailContacts.find((contact) => contact.email.toLowerCase() === email || contact.name.toLowerCase() === name.toLowerCase());
    if (existing) return { contact: existing };
    const contact = { id: `maintenance-contact-${Date.now()}`, name, email, title, active: true, createdAt: new Date().toISOString(), createdBy: session.name };
    setMaintenanceContacts((current) => [...current, contact]);
    logAudit('Maintenance contact created', `${contact.name} (${contact.email})`);
    toast('Maintenance contact saved for future tickets');
    return { contact };
  };

  const addLoanContact = (draft) => {
    if (!canEdit) return { error: 'Your account cannot add loan email contacts.' };
    const name = String(draft.name || '').trim();
    const email = String(draft.email || '').trim().toLowerCase();
    const title = String(draft.title || '').trim();
    if (!name || !/^\S+@\S+\.\S+$/.test(email)) return { error: 'Enter a contact name and valid email address.' };
    const existing = loanEmailContacts.find((contact) => contact.email.toLowerCase() === email || contact.name.toLowerCase() === name.toLowerCase());
    if (existing) return { contact: existing };
    const contact = { id: `loan-contact-${Date.now()}`, name, email, title, active: true, createdAt: new Date().toISOString(), createdBy: session.name };
    setLoanContacts((current) => [...current, contact]);
    logAudit('Loan email contact created', `${contact.name} (${contact.email})`);
    toast('Loan contact saved for future messages');
    return { contact };
  };

  const markLoanEmailPrepared = (itemId, details) => {
    const preparedAt = new Date().toISOString();
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    setItems((current) => current.map((entry) => entry.id === itemId ? { ...entry, lastLoanEmailPreparedAt: preparedAt, lastLoanEmailPreparedBy: session.name, lastLoanEmailRecipient: details.to, lastLoanEmailCc: details.cc, lastLoanEmailSubject: details.subject } : entry));
    logAudit('Loan email prepared', `${item.name} (${item.tag}) for ${details.to}`);
    toast(details.bodyCopied ? 'Outlook opened — press Ctrl+V to insert the copied full loan message' : 'Loan email opened in Outlook');
  };

  const createMaintenanceSchedule = (draft) => {
    const item = items.find((entry) => entry.id === draft.itemId);
    if (!item) return null;
    const createdAt = new Date().toISOString();
    const schedule = { ...draft, reminderEnabled: draft.reminderEnabled !== false, reminderDays: Math.max(1, Number(draft.reminderDays || 7)), reminderHistory: [], id: `PM-${String(Date.now()).slice(-8)}`, itemName: item.name, itemTag: item.tag, active: true, createdAt, retainedUntil: new Date(Date.now() + 365 * 864e5).toISOString(), createdBy: session.name };
    setMaintenanceSchedules((current) => [schedule, ...current]);
    toast('Preventive-maintenance schedule created');
    return schedule;
  };

  const updateMaintenanceSchedule = (scheduleId, changes) => {
    setMaintenanceSchedules((current) => current.map((schedule) => schedule.id === scheduleId ? { ...schedule, ...changes, updatedAt: new Date().toISOString(), updatedBy: session.name } : schedule));
    toast('Maintenance schedule updated');
  };

  const recordStocktakeObservation = (sessionId, observation) => {
    setStocktakes((current) => current.map((stocktake) => stocktake.id === sessionId && stocktake.status === 'In progress'
      ? { ...stocktake, observations: { ...(stocktake.observations || {}), [observation.key]: observation } }
      : stocktake));
  };

  const removeStocktakeObservation = (sessionId, observationKey) => {
    setStocktakes((current) => current.map((stocktake) => {
      if (stocktake.id !== sessionId || stocktake.status !== 'In progress') return stocktake;
      const observations = { ...(stocktake.observations || {}) };
      delete observations[observationKey];
      return { ...stocktake, observations };
    }));
  };

  const cancelStocktake = (sessionId, reason = '') => {
    const stocktake = stocktakes.find((entry) => entry.id === sessionId);
    if (!stocktake || stocktake.status !== 'In progress') return false;
    const cancelledAt = new Date().toISOString();
    setStocktakes((current) => current.map((entry) => entry.id === sessionId ? {
      ...entry,
      status: 'Cancelled',
      cancelledAt,
      cancelledBy: session.name,
      cancellationReason: String(reason || '').trim()
    } : entry));
    logAudit('Stocktake cancelled', `${stocktake.id} — ${stocktake.title}${reason ? `; ${reason}` : ''}`);
    toast('Stocktake session cancelled');
    return true;
  };

  const deleteStocktake = (sessionId) => {
    const stocktake = stocktakes.find((entry) => entry.id === sessionId);
    if (!stocktake || !canEdit) return false;
    setStocktakes((current) => current.filter((entry) => entry.id !== sessionId));
    logAudit('Stocktake deleted', `${stocktake.id} — ${stocktake.title}; status: ${stocktake.status}`);
    toast('Stocktake deleted');
    return true;
  };

  const completeStocktake = (sessionId, signoff) => {
    const stocktake = stocktakes.find((entry) => entry.id === sessionId);
    if (!stocktake || stocktake.status !== 'In progress') return false;
    const completedAt = new Date().toISOString();
    const observations = { ...(stocktake.observations || {}) };
    const expectedSnapshots = new Map((stocktake.expectedAssets || []).map((item) => [item.id, item]));
    asArray(stocktake.expectedIds).forEach((itemId) => {
      const snapshot = expectedSnapshots.get(itemId);
      if (!observations[itemId] || observations[itemId].state === 'Unverified') observations[itemId] = {
        key: itemId, itemId, state: 'Missing', recordedAt: completedAt,
        recordedBy: session.name, name: snapshot?.name || '', tag: snapshot?.tag || '', serial: snapshot?.serial || '',
        expectedLocation: snapshot?.location || stocktake.building, expectedRoom: snapshot?.room || stocktake.room,
        note: 'Not located before stocktake sign-off'
      };
    });
    const physicallySeen = new Map(Object.values(observations).filter((entry) => entry.itemId && entry.state !== 'Missing').map((entry) => [entry.itemId, entry]));
    setItems((current) => current.map((item) => physicallySeen.has(item.id) ? {
      ...item,
      lastVerifiedAt: completedAt,
      lastVerifiedBy: physicallySeen.get(item.id).recordedBy || session.name,
      lastVerifiedSessionId: stocktake.id,
      lastVerifiedLocation: stocktake.scopeType === 'room' ? `${stocktake.building} · ${stocktake.room}` : stocktake.building
    } : item));
    setStocktakes((current) => current.map((entry) => entry.id === sessionId ? {
      ...entry, observations, status: 'Completed', completedAt,
      completedBy: session.name, signedBy: session.name, signedByEmail: session.email, signoffNotes: String(signoff?.notes || '').trim()
    } : entry));
    const discrepancyCount = Object.values(observations).filter((entry) => entry.state !== 'Verified').length;
    logAudit('Stocktake completed', `${stocktake.id} — ${stocktake.title}; ${physicallySeen.size} seen, ${discrepancyCount} discrepancies`);
    toast('Stocktake signed off and asset verification dates updated');
    return true;
  };

  if (passwordRecovery) return <PasswordRecoveryModal onSave={completePasswordReset} />;

  if (!booted) {
    return <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#f5f6f8', color: '#7b8794', fontSize: 13 }}>Loading…</div>;
  }

  if (!session) {
    return <LoginScreen accounts={ACCOUNTS} accountDirectory={accounts} onLogin={login} onDemoLogin={demoLogin} onRequestPasswordReset={requestPasswordReset} cloudEnabled={supabaseConfigured} />;
  }

  const screenKey = screen === 'item' ? (sel?.consumable ? 'consumables' : 'inventory') : ['audit', 'access'].includes(screen) ? 'users' : screen;
  const screenTitle = LABELS[screenKey][0] + (screen === 'item' && sel ? ' / ' + sel.name : '');
  const signalTopAction = (target) => setTopActionSignal({ screen: target, nonce: Date.now() });
  const clearTopActionSignal = () => setTopActionSignal((current) => current.screen ? { ...current, screen: '' } : current);
  const topBarAction = (() => {
    if (screen === 'consumables' || (screen === 'item' && sel?.consumable)) return { label: 'New consumable', run: () => openAdd('printer-toner') };
    if (screen === 'stocktakes') return { label: 'New stocktake', run: () => signalTopAction('stocktakes') };
    if (screen === 'maintenance') return { label: 'New repair ticket', run: () => signalTopAction('maintenance') };
    if (screen === 'lifecycle') return { label: 'New lifecycle request', run: () => signalTopAction('lifecycle') };
    if (screen === 'disposal') return { label: 'New disposal request', run: () => signalTopAction('disposal') };
    if (screen === 'scan') return { label: 'Generate barcodes', run: () => setBlankBarcodeOpen(true) };
    if (screen === 'loans') return { label: 'Find asset to loan', run: () => { setFilters({ query: '', fCategory: 'All categories', fLocation: 'All buildings', fStatus: 'In stock' }); goScreen('inventory'); } };
    if (screen === 'alerts') return { label: 'Add consumable', run: () => openAdd('printer-toner') };
    if (screen === 'orders') return { label: 'Review low stock', run: () => goScreen(availableScreens.includes('alerts') ? 'alerts' : 'consumables') };
    if (screen === 'placements' && pendingPlacements.length) return { label: 'Set up next asset', run: () => openPlacementAsset(pendingPlacements[0].id) };
    if (['dashboard', 'inventory', 'item'].includes(screen)) return { label: 'New asset', run: () => openAdd() };
    return null;
  })();
  const buildLabel = 'v1.0.0 · ' + (role === 'Admin' ? 'full access' : role === 'Auditor' ? 'read only' : role);

  return (
    <div className="app-shell" style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#f5f6f8' }}>
      <Titlebar buildLabel={buildLabel} />
      {saveError && <div role="alert" style={{ flex: 'none', padding: '9px 16px', background: '#9f1d17', color: '#fff', fontSize: 12.5, fontWeight: 600, textAlign: 'center' }}>{saveError}</div>}
      <div className="app-workspace" data-sidebar-motion={sidebarMotion || undefined} style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Sidebar role={role} navItems={availableScreens} screen={screen} itemSection={sel?.consumable ? 'consumables' : 'inventory'} counts={navCounts} workflowAlerts={workflowAlerts} hasNewAlert={hasNewAlert} alertMuted={alertPreferences.muted} onToggleAlertSound={() => setAlertPreferences((current) => ({ ...current, muted: !current.muted }))} onNav={handleSidebarNav} session={session} onOpenProfile={() => setMyProfileOpen(true)} onLogout={logout} onCollapseChange={handleSidebarCollapse} />
        <div className="app-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TopBar
            title={screenTitle}
            subtitle={LABELS[screenKey][1]}
            canGoBack={navigationAvailability.back}
            canGoForward={navigationAvailability.forward}
            onGoBack={() => moveThroughNavigationHistory(-1)}
            onGoForward={() => moveThroughNavigationHistory(1)}
            onRefresh={() => setWorkspaceRefreshKey((current) => current + 1)}
            query={filters.query}
            onQuery={onQuery}
            onSearchSubmit={submitGlobalSearch}
            showSearch={['inventory', 'consumables', 'item', 'maintenance', 'lifecycle', 'disposal', 'history', 'orders', 'placements'].includes(screen)}
            canScan={canScan}
            onScan={() => goScreen('scan')}
            canEdit={canEdit && !!topBarAction}
            onNewAsset={topBarAction?.run}
            newLabel={topBarAction?.label}
          />
          <div key={workspaceRefreshKey} className="workspace-screen-stack">
            {workspaceMounted && <Suspense fallback={null}>
            {availableScreens.includes('dashboard') && <div className={`workspace-screen${screen === 'dashboard' ? ' active' : ''}`} data-app-content-scroll="true" aria-hidden={screen !== 'dashboard'}>
              <Dashboard
                items={activeItems}
                requests={requests}
                orders={orders}
                placements={placements}
                history={history}
                availableScreens={availableScreens}
                session={session}
                onOpenItem={openItem}
                onGoInventory={() => goScreen('inventory')}
                onOpenSummary={openDashboardSummary}
                onOpenNotification={openDashboardNotification}
                isActive={screen === 'dashboard'}
              />
            </div>}
            {availableScreens.includes('inventory') && <div className={`workspace-screen${screen === 'inventory' ? ' active' : ''}`} data-app-content-scroll="true" aria-hidden={screen !== 'inventory'}>
              {isStaff
                ? <StaffBorrowing items={staffVisibleItems.filter((item) => !item.consumable)} requests={requests} session={session} initialQuery={filters.query} onOpenItem={openItem} onRequest={requestBorrow} onOpenRequests={() => goScreen('requests')} />
                : <Inventory resetKey={inventoryResetKey} items={displayItems.filter((item) => !item.consumable)} filters={filters} setFilters={setFilters} view={view} setView={setView} onOpenItem={openItem} canDelete={isAdmin} onDelete={permanentlyDeleteItem} />}
            </div>}
            {availableScreens.includes('consumables') && <div className={`workspace-screen${screen === 'consumables' ? ' active' : ''}`} data-app-content-scroll="true" aria-hidden={screen !== 'consumables'}>
              <Consumables items={displayItems} usage={consumableUsage} query={filters.query} canManage={canEdit} scannerAction={consumableScannerAction} onScannerActionHandled={() => setConsumableScannerAction(null)} onUse={useConsumable} onAddStock={addConsumableStock} onCreateTonerMovement={createPrinterTonerMovement} onBulkUse={useConsumablesBulk} onSetCompatibility={setConsumablePrinterCompatibility} onCreateInk={(color, printerId) => { openAdd('printer-toner'); setForm((current) => ({ ...current, color, compatiblePrinterIds: [printerId] })); }} onCreateSupply={(modelId, location) => { openAdd(modelId); setForm((current) => ({ ...current, location, room: '' })); }} onReorder={openReorder} onOpenItem={openItem} />
            </div>}
            {availableScreens.includes('stocktakes') && <WorkspacePanel name="stocktakes" activeScreen={screen}>
              <Stocktakes items={activeItems} sessions={stocktakes} sessionUser={session} canManage={canEdit} createSignal={topActionSignal.screen === 'stocktakes' ? topActionSignal.nonce : 0} onCreateSignalHandled={clearTopActionSignal}
                onCreate={createStocktake} onRecord={recordStocktakeObservation} onRemove={removeStocktakeObservation} onComplete={completeStocktake} onCancel={cancelStocktake} onDelete={deleteStocktake} onOpenItem={openItem} />
            </WorkspacePanel>}
            {availableScreens.includes('maintenance') && <WorkspacePanel name="maintenance" activeScreen={screen}>
              <Maintenance items={activeItems} tickets={repairTickets} schedules={maintenanceSchedules} createSignal={topActionSignal.screen === 'maintenance' ? topActionSignal.nonce : 0} onCreateSignalHandled={clearTopActionSignal}
                technicians={accounts.filter((account) => account.tsr || account.role === 'Admin' || account.role === 'Student assistant').map((account) => account.name)}
                emailContacts={maintenanceEmailContacts} sender={session}
                query={filters.query} canManage={canEdit} onCreateTicket={createRepairTicket} onUpdateTicket={updateRepairTicket} onAcknowledge={(id) => acknowledgeWorkflowRecord('maintenance', id)}
                onCreateSchedule={createMaintenanceSchedule} onUpdateSchedule={updateMaintenanceSchedule} onAddEmailContact={addMaintenanceContact} onEmailPrepared={markMaintenanceEmailPrepared} onOpenItem={openItem} />
            </WorkspacePanel>}
            {availableScreens.includes('lifecycle') && <WorkspacePanel name="lifecycle" activeScreen={screen}>
              <Lifecycle items={activeItems} actions={lifecycleActions} query={filters.query} canManage={canEdit} canApprove={isAdmin} createSignal={topActionSignal.screen === 'lifecycle' ? topActionSignal.nonce : 0} onCreateSignalHandled={clearTopActionSignal} focusItemId={lifecycleFocus.itemId} focusSignal={lifecycleFocus.nonce}
                onUpdateAsset={updateAssetLifecycle} onCreateAction={createLifecycleAction} onDecide={decideLifecycleAction}
                onComplete={completeLifecycleAction} onOpenItem={openItem} />
            </WorkspacePanel>}
            {availableScreens.includes('disposal') && <WorkspacePanel name="disposal" activeScreen={screen}>
              <Disposal items={activeItems} actions={lifecycleActions} query={filters.query} canManage={canEdit} canApprove={isAdmin} createSignal={topActionSignal.screen === 'disposal' ? topActionSignal.nonce : 0} onCreateSignalHandled={clearTopActionSignal}
                onCreateAction={createLifecycleAction} onDecide={decideLifecycleAction} onComplete={completeLifecycleAction}
                onCancel={cancelLifecycleAction} onOpenItem={openItem} />
            </WorkspacePanel>}
            {screen === 'item' && sel && (
              <WorkspacePanel name="item" activeScreen={screen}><ItemDetail
                item={sel}
                history={history}
                maintenanceTickets={repairTickets.filter((ticket) => ticket.itemId === sel.id)}
                lifecycleActions={lifecycleActions.filter((action) => action.itemId === sel.id)}
                canLoanNow={canLoanNow}
                isStaff={isStaff}
                borrowingApproved={isBorrowingApproved(sel, borrowCategoryAccess)}
                canEdit={canEdit && !sel.archived && !sel.disposalApproved && !(sel.status === 'Retired' && sel.dispositionType)}
                canDelete={isAdmin && !sel.archived && !sel.disposalApproved && !(sel.status === 'Retired' && sel.dispositionType)}
                onBack={() => navigationAvailability.back ? moveThroughNavigationHistory(-1) : goScreen(sel.consumable ? 'consumables' : 'inventory')}
                onOpenCheckout={openCheckout}
                onRequestBorrow={requestBorrow}
                onOpenEdit={openEdit}
                onDelete={() => permanentlyDeleteItem(sel.id)}
                onGenerateInvoice={() => generateItemInvoice(sel.id)}
                onReorder={() => openReorder(sel.id, Math.max(12, sel.min * 2))}
                onOpenLifecycle={() => openItemLifecycle(sel.id)}
                pendingOrder={selectedPendingOrder}
                pendingPlacement={selectedPendingPlacement}
                onViewOrder={(id) => setOrderDetailsId(id)}
                onOpenPlacements={() => goScreen('placements')}
                onAddBarcodeToPrintSheet={addBarcodeToScannerSheet}
                barcodeQueued={scannerLabelQueue.includes(sel.id)}
                canToggleBorrowing={isAdmin && !sel.disposalApproved && !(sel.status === 'Retired' && sel.dispositionType)}
                onToggleBorrowing={(allowed) => updateAssetBorrowing(sel.id, allowed)}
              /></WorkspacePanel>
            )}
            {availableScreens.includes('loans') && <WorkspacePanel name="loans" activeScreen={screen}>
              <Loans items={activeItems} canReturn={canLoanNow} sender={session} emailContacts={loanEmailContacts} onAddEmailContact={addLoanContact} onEmailPrepared={markLoanEmailPrepared} onOpenItem={openItem} onCheckIn={openCheckIn} onExtendLoan={extendLoan} onPreviewAgreement={(agreement) => setCheckoutAgreement(agreement)} />
            </WorkspacePanel>}
            {availableScreens.includes('history') && <WorkspacePanel name="history" activeScreen={screen}>
              <LoanHistory history={history} stillOutCount={onLoan.length} isStaff={isStaff} sessionName={session.name} query={filters.query} onOpenItem={openItem} />
            </WorkspacePanel>}
            {availableScreens.includes('requests') && <WorkspacePanel name="requests" activeScreen={screen}>
              <Requests requests={requests} role={role} sessionName={session.name} focusRequestId={dashboardRequestFocus.id} focusNonce={dashboardRequestFocus.nonce} onApprove={approveRequest} onDecline={declineRequest} onAcknowledge={(id) => acknowledgeWorkflowRecord('requests', id)} />
            </WorkspacePanel>}
            {availableScreens.includes('alerts') && <WorkspacePanel name="alerts" activeScreen={screen}>
              <Alerts items={activeItems} pendingOrders={pendingOrders} pendingPlacements={pendingPlacements} canEdit={canEdit} onOpenItem={openItem} onReorder={openReorder} onViewOrder={(id) => setOrderDetailsId(id)} onOpenPlacements={() => goScreen('placements')} />
            </WorkspacePanel>}
            {availableScreens.includes('orders') && <WorkspacePanel name="orders" activeScreen={screen}>
              <PendingOrders orders={orders} query={filters.query} canReceive={canEdit} onOpenItem={openItem} onReceive={receiveOrder} onViewOrder={(id) => setOrderDetailsId(id)} onPreviewApproval={previewOrderApproval} onSendApproval={(id) => setApprovalOrderId(id)} onAcknowledge={(id) => acknowledgeWorkflowRecord('orders', id)} />
            </WorkspacePanel>}
            {availableScreens.includes('placements') && <WorkspacePanel name="placements" activeScreen={screen}>
              <PlacementQueue placements={placements} items={activeItems} query={filters.query} canSetUp={canEdit} onSetUp={openPlacementAsset} onAcknowledge={(id) => acknowledgeWorkflowRecord('placements', id)} />
            </WorkspacePanel>}
            {availableScreens.includes('scan') && <WorkspacePanel name="scan" activeScreen={screen}>
              <Scan items={staffVisibleItems} placements={placements} recentScans={recentScans} reservedBarcodes={reservedBarcodes} canManageLoans={canLoanNow} isActive={screen === 'scan'} onScan={doScan} onSimulate={simulateScan} onOpenItem={openItem} onOpenStocktakes={() => goScreen('stocktakes')} onGenerateBlankLabels={() => setBlankBarcodeOpen(true)} labelQueueIds={scannerLabelQueue} onLabelQueueChange={setScannerLabelQueue} labelStudioFocusSignal={scannerLabelFocusSignal} />
            </WorkspacePanel>}
            {availableScreens.includes('reports') && <WorkspacePanel name="reports" activeScreen={screen}>
              <Reports items={items} history={history} tickets={repairTickets} orders={orders} procurementRecords={procurementRecords} consumableUsage={consumableUsage} lifecycleActions={lifecycleActions} />
            </WorkspacePanel>}
            {availableScreens.includes('settings') && <WorkspacePanel name="settings" activeScreen={screen}><Settings isAdmin={isAdmin} accounts={accounts} userState={userState} navConfig={navOverrides} auditEntries={auditLog} importRuns={importRuns} procurementRecords={procurementRecords} vendors={approvedVendors} approvalContacts={approvalContacts} items={items} orders={orders} borrowCategoryAccess={borrowCategoryAccess} accountStorage={cloudSession ? 'Supabase secured' : 'Demo data stored locally'} onImport={importCsvData} onSaveVendor={saveApprovedVendor} onToggleVendor={toggleApprovedVendor} onSaveApprovalContact={saveApprovalContact} onToggleApprovalContact={toggleApprovalContact} onBorrowCategoryChange={setBorrowCategoryApproval} onAccessChange={updateRoleAccess} onToggle={toggleUser} onUpdateProfile={updateUserProfile} onCreateAccount={createUserAccount} onResetPassword={resetAccountPassword} /></WorkspacePanel>}
            </Suspense>}
          </div>
        </div>
      </div>

      {loginPhase && <WorkspaceLoginOverlay phase={loginPhase} />}

      <GlobalScanModal
        scan={detectedScan}
        item={globallyScannedItem}
        reserved={globallyScannedReservation}
        canManageLoans={canLoanNow}
        borrowingApproved={isBorrowingApproved(globallyScannedItem, borrowCategoryAccess)}
        canEdit={canEdit}
        onClose={() => setDetectedScan(null)}
        onView={() => { const id = globallyScannedItem?.id; setDetectedScan(null); if (id) openItem(id); }}
        onUseConsumable={() => { const id = globallyScannedItem?.id; setDetectedScan(null); if (id) { setConsumableScannerAction({ itemId: id, action: 'issue', requestedAt: Date.now() }); goScreen('consumables'); } }}
        onOpenConsumables={() => { const id = globallyScannedItem?.id; setDetectedScan(null); if (id) { setConsumableScannerAction({ itemId: id, action: 'focus', requestedAt: Date.now() }); goScreen('consumables'); } }}
        onCheckout={() => { const id = globallyScannedItem?.id; setDetectedScan(null); if (id) openCheckout(id); }}
        onCheckin={() => { const id = globallyScannedItem?.id; setDetectedScan(null); if (id) openCheckIn(id); }}
        onStocktake={() => { setDetectedScan(null); goScreen('stocktakes'); }}
        onRegister={() => { const tag = detectedScan?.value || ''; const modelId = globallyScannedReservation?.model; setDetectedScan(null); openAdd(modelId); setForm((current) => ({ ...current, tag, _autoTag: false, ...(modelId ? { model: modelId } : {}) })); }}
        onScannerConsole={() => { setDetectedScan(null); goScreen('scan'); }}
      />
      {blankBarcodeOpen && <BlankBarcodeModal open={blankBarcodeOpen} reserved={reservedBarcodes.filter((entry) => entry.status !== 'Voided')} onGenerate={generateBlankBarcodes} onDelete={deleteReservedBarcode} onClear={clearReservedBarcodes} onClose={() => setBlankBarcodeOpen(false)} />}
      {formOpen && <AssetFormModal open={formOpen} mode={formMode} form={form} error={formError} intakeProgress={placementProgress} isAdmin={isAdmin} borrowCategoryAccess={borrowCategoryAccess} consumablesOnly={screen === 'consumables'} printers={items.filter((item) => !item.archived && !item.consumable && item.status !== 'Retired' && (item.category === 'Printing' || /printer|copier|plotter/i.test(`${item.name} ${item.model}`))).sort((a, b) => a.name.localeCompare(b.name) || a.tag.localeCompare(b.tag))} onChange={onFormChange} onSave={saveForm} onDelete={deleteItem} onRequestRetire={requestRetirement} onClose={closeForm} />}
      {orderOpen && <ReorderModal
        open={orderOpen}
        directOrder={isAdmin}
        item={items.find((item) => item.id === orderItem) || null}
        form={orderForm}
        error={orderError}
        vendors={approvedVendors}
        onChange={onOrderChange}
        onSubmit={submitReorder}
        onClose={closeReorder}
      />}
      {orderDetailsId && <OrderDetailsModal
        order={orders.find((order) => order.id === orderDetailsId) || null}
        canReceive={canEdit}
        canGenerateInvoice={isAdmin}
        onReceive={receiveOrder}
        onGenerateInvoice={generateInvoice}
        onClose={() => setOrderDetailsId(null)}
      />}
      {approvalOrderId && <OrderApprovalModal order={orders.find((order) => order.id === approvalOrderId) || null} sender={session} approvalContacts={approvalContacts} onAddApprovalContact={addApprovalContactFromOrder} onPrepared={markApprovalPrepared} onClose={() => setApprovalOrderId(null)} />}
      {receiveOrderId && <ReceiveOrderModal order={orders.find((order) => order.id === receiveOrderId) || null} form={receiveForm} error={receiveError} onChange={(key, value) => { setReceiveForm((current) => ({ ...current, [key]: value })); setReceiveError(''); }} onConfirm={confirmReceiveOrder} onClose={() => { setReceiveOrderId(null); setReceiveError(''); }} />}
      {coOpen && <CheckoutModal
        open={coOpen}
        itemName={(items.find((i) => i.id === coItem) || { name: '' }).name}
        borrower={coBorrower}
        due={coDue}
        period={coPeriod}
        tsrs={checkoutTsrs}
        loanedBy={coLoanedBy}
        error={coError}
        onChangeBorrower={setCoBorrower}
        onChangeDue={setCoDue}
        onChangePeriod={(value) => {
          setCoPeriod(value);
          const days = parseInt(value, 10);
          if (Number.isFinite(days) && days > 0) setCoDue(iso(new Date(today().getTime() + days * 864e5)));
          setCoError('');
        }}
        onChangeLoanedBy={(name) => { setCoLoanedBy(name); setCoError(''); }}
        onConfirm={previewCheckoutAgreement}
        onClose={closeCheckout}
      />}
      {checkoutAgreement && <CheckoutAgreementModal agreement={checkoutAgreement} onProceed={finalizeCheckout} onClose={() => setCheckoutAgreement(null)} />}
      {ciOpen && <CheckInModal
        open={ciOpen}
        item={items.find((item) => item.id === ciItem) || null}
        receiver={session.name}
        form={ciForm}
        error={ciError}
        onChange={onCheckInChange}
        onConfirm={confirmCheckIn}
        onClose={closeCheckIn}
      />}
      {myProfileOpen && <MyProfileModal account={session} onAvatarChange={updateOwnAvatar} onClose={() => setMyProfileOpen(false)} />}
      <Toast message={toastMsg} action={toastAction} tone={toastTone} />
    </div>
  );
}
