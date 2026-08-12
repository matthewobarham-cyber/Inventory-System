# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MSBM IT Inventory — an Electron + React desktop app: 3D-referenced equipment tracking, loans, requests, low-stock alerts, barcode scan lookup, reports and role-based access for MSBM IT Services (UWI, Mona). It's a real implementation of the design bundle referenced in `README.md` (`../project/IT Inventory System.dc.html`, if present alongside this repo).

There is no server or database. All state lives in the renderer's React tree and is persisted as a single JSON blob — via Electron IPC to a file in `app.getPath('userData')` when running in Electron, or to `localStorage` when running as a plain browser tab (see `src/store.js`). Single-workstation, single-user-at-a-time by design.

Note: `my-react-app/` at the repo root is an unrelated, unused `create-vite` scaffold (has its own `package.json`/`node_modules`). Ignore it — the real app is rooted at the top level (`index.html`, `src/`, `electron/`).

## Commands

```
npm install
npm run dev:electron   # Vite dev server + Electron window, hot reload — normal dev loop
```

Other scripts (`package.json`):
- `npm run dev` — Vite dev server only (browser tab at localhost:5173, falls back to localStorage persistence instead of the Electron JSON store)
- `npm run build` — Vite production build to `dist/`
- `npm start` — build then launch Electron against the built `dist/` (production-like, no dev server/hot reload)
- `npm run electron` — launch Electron alone (expects either `dist/` built or `VITE_DEV_SERVER_URL` set)
- `npm run pack` — build then `electron-builder --dir` (unpacked app to `release/`)
- `npm run generate:models` / `generate:laptop-model` / `generate:mouse-models` — regenerate the procedural GLB packs under `public/generated/` via `scripts/*.mjs` (Three.js `GLTFExporter` run headless in Node)

There is no test suite and no linter configured in this repo — don't invent `npm test`/`npm run lint` commands.

Demo accounts (see `README.md` for the full table) gate the nav in `NAV` (`src/data.js`): Admin sees everything, Student assistant loses Reports/Users, Auditor is read-only, Staff only browses and requests borrows.

## Architecture

**Single-container state.** `src/App.jsx` is the whole app's brain: every piece of domain state (`items`, `history`, `requests`, `orders`, `placements`, `stocktakes`, `repairTickets`, `maintenanceSchedules`, `lifecycleActions`, `procurementRecords`, `importRuns`, `userState`, `profileState`, `customAccounts`, session/auth, all modal open/form state) lives in `useState` hooks here, and every mutation is a handler defined in this one file, passed down as props. Components under `src/components/` are one file per screen or modal and are intentionally "dumb" — they render props and call the callbacks passed in; they don't own domain state or reach into persistence themselves. When adding a feature, the new state/logic almost always belongs in `App.jsx`, with a new prop/callback threaded into the relevant screen component — this is not a bug to "fix" by extracting a store, it's the existing pattern.

**Boot / persist / migrate cycle** (top of `App.jsx`):
1. On mount, `loadPersisted()` (from `src/store.js`) reads the saved JSON blob (Electron file or localStorage); if nothing valid is stored, `freshWorld()` seeds it from `buildItems()`/`buildHistory()`/`buildRequests()` in `src/data.js`.
2. Every loaded record is run through an inline `migrateEntry` that re-derives fields on old records (e.g. re-running `classifyEquipment` when `classificationVersion` is stale, renaming a retired building to its replacement, moving records into a synthesized "Storage room" location by name-sniffing). When you change the shape of a persisted record or rename/retire a lookup value (a building, a model id), add a migration branch here rather than assuming existing users' saved JSON already matches.
3. After hydration, a `useEffect` saves the merged world on every relevant state change (debounced 250ms in `savePersisted`). A `hydrated` ref guards against writing back out during the initial load.
4. A remembered session pointer (`loadSessionPointer`/`localStorage`, separate from the world blob) auto-resumes login if the account still exists and isn't suspended.

**Data model & catalogue** (`src/data.js`): `MODELS` is the static equipment catalogue (id, display name, category, consumable flag, unit cost, which GLB pack it belongs to), ordered largest-to-smallest by real-world bounding volume so bulky equipment sorts first in the UI. `MODEL_BY`, `glbUrl()`, `pngUrl()` resolve a model id to its 3D asset / preview image under `public/uploads/<pack>/`. `GENERATED_MODELS` (from `src/generated-models.js`, produced by the `scripts/generate-*.mjs` generators) is appended to `MODELS` for procedurally-built packs under `public/generated/`. Also here: seed-data builders (`buildItems`/`buildHistory`/`buildRequests`), formatting helpers (`money`, `iso`, `shortDate`/`longDate`, `daysBetween`), `NAV`/`LABELS` (role-gated navigation and screen copy), and small style-object helpers (`statusTagStyle`, `roleTagStyle`, `avatarStyle`) used inline throughout components rather than CSS classes.

**Shared 3D renderer** (`src/three-engine.js`): one `THREE.WebGLRenderer` per "stage" (a small one for grid cards, a larger one for the detail viewer) draws every rotating model, blitting each frame into that item's own 2D `<canvas>` via `drawImage` — so dozens of simultaneously-rotating cards cost one or two GL contexts instead of one each. `Inv3D.sync()` scans the DOM for `canvas[data-model]` (cards) and `[data-detail-model]` (detail viewer container) and adopts/creates render entries; it's called from `App.jsx` on relevant state changes and on a 500ms interval as a safety net. GLB models are loaded once and cached by URL (`loadModel`); an `IntersectionObserver` pauses off-screen cards. Rotation speed is globally tunable via `window.__inv3dSpeed` (set from `ROTATION_SPEED` in `data.js`).

**CSV import** (`src/csv-import.js`): a hand-rolled CSV parser (`parseCsv`, handles quoted fields/embedded commas/CRLF) plus `classifyEquipment(description)`, a large ordered list of regexes that maps free-text equipment descriptions from imported company records onto a `MODELS` id/category/consumable/rank. This classifier is also re-run during the App boot migration (see above) whenever a persisted record's `classificationVersion` is behind the current version — bump that version and extend the regex list together when adding new aliases.

**Lifecycle/depreciation math** (`src/lifecycle.js`): pure functions — `bookValueFor` (straight-line depreciation from `cost`/`salvageValue`/`usefulLifeYears`/`purchased`), `expectedReplacementFor`, `lifecycleFlags` (due/soon flags for replacement and warranty windows). Used by the Lifecycle and Reports screens; keep these side-effect-free since they're called during render.

**Electron shell** (`electron/main.js`, `electron/preload.cjs`): frameless `BrowserWindow` with a custom titlebar driven by IPC (`window:minimize`/`toggleMaximize`/`close`/`isMaximized`, plus a `window:state` push on maximize/unmaximize — see `src/components/Titlebar.jsx`). `store:load`/`store:save` read/write the JSON persistence file. `print:preview` writes a PDF (checkout agreements, barcode labels, etc. built client-side with `jspdf`/`jsbarcode`) to a temp dir and shell-opens it. `contextIsolation` is on and `nodeIntegration` is off — the renderer only ever talks to Node/Electron through the `window.api` surface `preload.cjs` exposes; don't add new main-process capabilities without adding a matching narrow method there.

## Conventions worth matching

- No CSS modules/styled-components/Tailwind — layout and color are inline `style={{...}}` objects in JSX, with a handful of shared style-builder helpers in `data.js` (see above) and global rules in `src/styles.css`. Match this when adding UI rather than introducing a new styling approach.
- IDs for new records are ad hoc string prefixes plus `Date.now()` (e.g. `'itm' + Date.now()`, `` `RPR-${...}-${String(Date.now()).slice(-5)}` ``) — follow the existing prefix convention for the record type you're adding to (`itm`, `h`, `rq`/`req`, `ord`, `plc`, `STK-`, `LCA-`, `RPR-`, `PM-`, `INV-`, `LOAN-`).
- Every mutating action in `App.jsx` ends with a `toast('...')` call (via the `toast` helper) to confirm the action to the user — keep doing this for new actions rather than failing silently.
- Role/permission checks are booleans derived once near the top of `App` (`isAdmin`, `canEdit`, `canLoanNow`, `isStaff`, `canScan`) and passed down as props; screens don't re-derive role logic themselves.



Executive conclusion
Yes—the renderer is fundamentally a normal React/Vite web application. It uses standard browser technologies for nearly everything: React, DOM events, WebGL/Three.js, canvas, local storage, file inputs, barcode keyboard events, jsPDF, and browser printing.
Electron coupling is small and isolated behind window.api. Extracting the UI into a browser is easy. Turning it into a secure shared client/server system is a larger job because the renderer currently owns the database, authentication, authorization, audit logic, and nearly all business rules.
1. Renderer dependency on Electron
The renderer does not directly import electron, fs, path, Node’s Buffer, SQLite, or other Node modules. nodeIntegration is disabled and contextIsolation is enabled in [main.js (line 47)](C:/Users/matth/Downloads/Inven/electron/main.js:47).
Electron features are exposed through the preload bridge in [preload.cjs (line 1)](C:/Users/matth/Downloads/Inven/electron/preload.cjs:1).
Every renderer location touching window.api
Renderer file	Electron methods used	Purpose	Browser fallback
[store.js (line 7)](C:/Users/matth/Downloads/Inven/src/store.js:7)	loadStore, saveStore	Loads and saves the complete application state	Uses localStorage
[Titlebar.jsx (line 4)](C:/Users/matth/Downloads/Inven/src/components/Titlebar.jsx:4)	isMaximized, onWindowState, minimize, toggleMaximize, close	Custom frameless-window controls	Buttons remain visible but do nothing
[mailer.js (line 1)](C:/Users/matth/Downloads/Inven/src/mailer.js:1)	sendMail	Records helpdesk messages in a local outbox	Operation is skipped with a console warning
[outlook.js (line 11)](C:/Users/matth/Downloads/Inven/src/outlook.js:11)	openExternal	Opens an Outlook Web compose link using the OS browser	Uses window.open()
[order-approval-pdf.js (line 78)](C:/Users/matth/Downloads/Inven/src/order-approval-pdf.js:78)	openPrintPreview, saveProcurementPdf	Opens PDF through the OS or saves it under Documents	Opens a blob URL or downloads through jsPDF
[repair-ticket-pdf.js (line 196)](C:/Users/matth/Downloads/Inven/src/repair-ticket-pdf.js:196)	openPrintPreview, saveMaintenancePdf	Opens or saves repair-ticket PDFs	Opens a blob URL or downloads
[report-pdf.js (line 94)](C:/Users/matth/Downloads/Inven/src/report-pdf.js:94)	openPrintPreview	Opens an inventory report in the system PDF viewer	Opens a blob URL
[CheckoutAgreementModal.jsx (line 190)](C:/Users/matth/Downloads/Inven/src/components/CheckoutAgreementModal.jsx:190)	openPrintPreview	Opens checkout agreement PDF	Opens a blob URL


That is the complete renderer-to-Electron surface I found.
Renderer features already browser-native
These should work in Chrome/Edge without Electron:
React UI and internal navigation
Three.js/WebGL asset models
CSV import through browser file inputs
Barcode scanners operating as USB keyboards
Global and stocktake barcode capture through keyboard events
Barcode rendering
PDF generation through jsPDF
Browser printing and label printing
CSV downloads through Blob/object URLs
Outlook Web compose links
Search, reports, loans, inventory, disposal, maintenance, and workflow logic
Session pointers through localStorage/sessionStorage
The project explicitly supports browser-only persistence in [store.js (line 1)](C:/Users/matth/Downloads/Inven/src/store.js:1).
2. What the Electron main process does
All main-process logic is in [main.js (line 1)](C:/Users/matth/Downloads/Inven/electron/main.js:1).
Responsibility	Current implementation	Must remain desktop-only?
Window creation	Creates a frameless 1440×900 BrowserWindow with a minimum size of 1080×680	Electron-shell responsibility only
Window controls	Minimize, maximize/restore, close, and maximize-state events	Desktop-only; omit in web or replace with normal browser chrome
Renderer diagnostics	Forwards renderer console errors and logs renderer crashes	Desktop-only implementation; web could use browser logging/Sentry
Local application state	Reads and rewrites inventory-store.json in Electron’s user-data directory	No; should become an HTTP API/database
Local mail outbox	Appends messages to mail-outbox.json	No; could become an API table, queue, or real mail service
Outlook launching	Validates Outlook hosts and calls shell.openExternal()	Exact OS launch is desktop-only; web can use a normal link
Procurement PDFs	Writes generated bytes into Documents\\MSBM IT Inventory\\Procurement Approvals	Exact Documents-folder behavior is desktop-only; web can download or retrieve from an API
Maintenance PDFs	Writes generated bytes into Documents\\MSBM IT Inventory\\Maintenance Tickets	Same as above
Print preview	Writes a temporary PDF and opens it in the OS default PDF viewer	Desktop-only implementation; browser can open a blob or server URL
Application lifecycle	Handles ready, activate, window-all-closed, and macOS behavior	Desktop-only
Development loading	Loads Vite URL and opens detached developer tools	Desktop-only development convenience


Things the main process does not do
No native application menus
No native file-open/save dialogs
No USB, HID, serial, Bluetooth, or camera access
No barcode-scanner driver integration
No active SQLite access
No HTTP server
No WebSocket server
No SMTP or Microsoft Graph email delivery
No network authentication
No background synchronization
No database queries or migrations
The barcode scanner works entirely as a keyboard in the renderer. That also works in a normal desktop browser.
There are SQLite files under server/, but there is no server source, SQLite dependency, npm command, or runtime reference to them. They are inactive leftovers from the earlier online implementation—not the current database.
Also, sendMail is misleadingly named: it does not send mail. It only writes a record to mail-outbox.json.
3. Client/server split feasibility
Can the renderer be served as a normal web app?
Yes. It effectively already can.
Running npm run dev starts the renderer in a browser, where it falls back to local storage. The Vite build uses relative asset paths, so the compiled application can also be hosted as static files.
Can Electron and mobile browsers share the same API?
Yes. A sensible target architecture would be:
Electron shell ─┐
                ├── HTTPS API ── database / files / email
Browser app  ───┤
Mobile browser ─┘
Electron could continue using the locally bundled renderer or load the hosted web client. Both would call the same API.
What would break or require replacement?
Persistence and concurrency
The current renderer keeps the whole application database in React state and saves one complete snapshot after every mutation in [App.jsx (line 379)](C:/Users/matth/Downloads/Inven/src/App.jsx:379).
The current live snapshot is about 750 KB. With multiple clients, whole-document saving would create lost-update races:
Client A loads revision 1.
Client B loads revision 1.
Client A changes an asset and saves revision 2.
Client B changes a loan and saves its old copy as revision 2.
Client A’s asset change disappears.
For a quick prototype, the server could expose GET /api/world and versioned PUT /api/world with an ETag/revision check. That is not a good final production model.
The proper implementation needs domain endpoints such as:
/api/assets
/api/loans
/api/stocktakes
/api/maintenance
/api/disposals
/api/orders
/api/users
/api/audit-events
Authentication and authorization
This is the largest security change.
Currently:
Password hashes are embedded or stored in renderer-accessible state.
Password comparison happens in the browser in [App.jsx (line 653)](C:/Users/matth/Downloads/Inven/src/App.jsx:653).
The session is only a local/session-storage pointer.
Roles and page permissions are enforced in client code.
Audit entries are created and stored by the client.
A renderer can call saveStore with an arbitrary replacement snapshot.
That is acceptable only for a trusted single-workstation local app. It is not safe for a network service.
A server version must provide:
Server-side password or institutional SSO authentication
Secure HTTP-only sessions or access tokens
Server-side role validation on every mutation
Server-generated audit events
Rate limiting and login controls
HTTPS
Database constraints and transaction handling
PDF behavior
PDF generation itself is browser-compatible and can remain in the client.
What changes is output handling:
Browser: download the PDF or open a blob URL.
Electron: retain exact Documents-folder saving if desired.
Shared system: optionally upload the generated PDF to the API for permanent records or email attachments.
Email
Current Outlook integration only opens an Outlook Web draft. It cannot reliably attach the generated PDF.
A shared server could use Microsoft Graph with organization-approved OAuth permissions to:
Create/send drafts
Attach PDFs
Record delivery status
Avoid repeated interactive Outlook authentication
That is separate from simply serving the renderer.
Barcode scanning
USB keyboard-mode scanning should continue to work in desktop browsers.
On mobile:
A paired Bluetooth scanner acting as a keyboard may work.
Phone-camera barcode scanning is not implemented.
Adding phone scanning would require getUserMedia() plus BarcodeDetector or a barcode-decoding library.
HTTPS is generally required for camera access.
Mobile layout
The CSS contains responsive rules, but the overall application remains desktop-oriented:
Permanent 246-pixel sidebar
Desktop custom titlebar
Numerous wide tables
Some screens enforce widths around 850–1080 pixels
Dense controls and hover-focused interactions
Electron currently enforces a minimum 1080-pixel window
It could open on mobile, but it would not yet be a polished mobile application. A responsive navigation drawer and targeted table/card redesign would be needed.
Rework estimate
Target	Rough effort
Browser-only UI smoke test	15–30 minutes
Static browser deployment using local storage	Half a day
Shared whole-snapshot API proof of concept	1–3 days
Safe multi-user persistence with version conflicts handled	Several days to 1–2 weeks
Proper server-side auth, permissions, auditing, and domain APIs	Roughly 2–4 weeks
Email delivery with Microsoft Graph and attachments	Several additional days
Fully polished mobile experience with camera scanning	Approximately 1–2 additional weeks


Overall: renderer extraction is low effort; a production-quality shared system is medium-to-large rework.
4. Fastest path to test today
Fastest browser test with no code changes
From the project folder:
npm run dev
Then open:
http://localhost:5173
This immediately tests the renderer as a normal browser application.
Expected differences:
It uses browser localStorage, not the Electron JSON file.
Your current 703 desktop assets will not appear automatically.
Import the CSV again to test realistic browser data.
Window-control buttons will be no-ops.
Local helpdesk outbox recording will be skipped.
PDFs will open/download using browser behavior.
Outlook compose will use a browser popup/tab.
USB keyboard-mode barcode scanning should work.
Test from a phone on the same network
Run:
npm run dev -- --host 0.0.0.0
Then open http://<computer-LAN-IP>:5173 from the phone. Windows Firewall may request permission.
This is only a local development test—do not expose Vite directly to the internet.
Fastest client/server proof after that
The quickest credible spike would be:
Introduce a transport-neutral data service.
Preserve the existing world/snapshot format initially.
Add versioned GET/PUT API endpoints.
Point both browser and Electron at that service.
Prove that an asset edited in Electron appears in the browser.
Only then break the snapshot into secure domain endpoints.
My recommendation: run the browser-only smoke test first. It will demonstrate immediately that Electron is not the main obstacle; shared persistence, authentication, and server-side authorization are the real work.


