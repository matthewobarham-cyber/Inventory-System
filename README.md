# MSBM IT Inventory

Desktop inventory console for MSBM IT Services (The University of the West Indies, Mona) — 3D-referenced equipment tracking, loans, requests, low-stock alerts, scan lookup, reports and role-based access.

This is a real Electron + React implementation of the `IT Inventory System.dc.html` design (see `../project/` and `../chats/` in the repo root for the original design bundle and design chat transcript).

## Run it

```
npm install
npm run dev:electron
```

The application is fully local. Electron stores inventory data in `inventory-store.json` under the current Windows user's application-data directory. Browser-only development uses that browser profile's `localStorage`. No API server, listening port, JWT, or network database is required. `npm run dev:full` remains as a compatibility alias for `npm run dev:electron`.

All six seeded demo accounts appear on the sign-in screen and support one-click local sign-in.

Helpdesk and preventive-maintenance messages are recorded locally in `mail-outbox.json` beside the inventory store. The application does not send SMTP mail or require an internet connection.

This starts the Vite dev server and an Electron window pointed at it, with hot reload.

For a production-like run (built bundle, no dev server):

```
npm run build
npm start
```

## Sign in

The local application includes these demo accounts. Manual sign-in compares locally stored password hashes; the clickable demo cards do not require a password:

| Email | Password | Role |
|---|---|---|
| a.hosein@uwi.edu | admin123 | Admin |
| k.ramnarine@uwi.edu | student123 | Student assistant |
| j.mohammed@uwi.edu | staff123 | Staff |
| audit@uwi.edu | audit123 | Auditor |
| s.baptiste@uwi.edu | staff123 | Staff |
| r.khan@uwi.edu | student123 | Student assistant |

Roles gate the nav: Admin sees everything; Student assistants lose Reports/Users; Auditors are read-only; Staff only browse and request borrows.

## Data

Seeded equipment records cover 8 buildings and 39 equipment classes (two bundled 3D model packs — see `public/uploads/`). The Electron JSON store is the source of truth for the desktop installation. Data is not shared between computers or uploaded to a server.

## Project layout

- `electron/main.js` — main process: window, local JSON persistence, local mail outbox, custom titlebar IPC, and printing
- `electron/preload.cjs` — contextBridge API exposed to the renderer as `window.api`
- `src/App.jsx` — app state and screen composition
- `src/components/` — one file per screen/modal
- `src/three-engine.js` — shared-renderer 3D engine (one WebGL context renders every rotating card + the big detail viewer)
- `src/data.js` — equipment catalogue, seed-data builders, formatting helpers
- `public/brand/`, `public/uploads/` — MSBM branding and the two GLB model packs
