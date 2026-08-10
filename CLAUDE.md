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
