# MSBM IT Inventory

Desktop inventory console for MSBM IT Services (The University of the West Indies, Mona) — 3D-referenced equipment tracking, loans, requests, low-stock alerts, scan lookup, reports and role-based access.

This is a real Electron + React implementation of the `IT Inventory System.dc.html` design (see `../project/` and `../chats/` in the repo root for the original design bundle and design chat transcript).

## Run it

```
npm install
npm run dev:electron
```

The application remains local by default. Electron stores inventory data in `inventory-store.json` under the current Windows user's application-data directory, while browser-only development uses that browser profile's `localStorage`. When Supabase is configured, authentication, operational inventory entities, CSV imports, and disposal attachments synchronize through the shared cloud workspace while the local copy remains a performance/offline cache. `npm run dev:full` remains as a compatibility alias for `npm run dev:electron`.

The seeded administrator demo account appears on the sign-in screen when Supabase is not configured. Demo sign-in is intentionally disabled in cloud mode.

Helpdesk and preventive-maintenance messages are recorded locally in `mail-outbox.json` beside the inventory store. The application does not send SMTP mail or require an internet connection.

This starts the Vite dev server and an Electron window pointed at it, with hot reload.

### Browser version

The browser entry is `web.html`. It shares the same React screens and base styles as Electron, then applies the responsive rules in `src/web-styles.css`.

For browser development:

```
npm run dev:web
```

For a production preview:

```
npm run build
npm run preview:web
```

The build produces both `dist/index.html` for Electron and `dist/web.html` for web hosting. Without Supabase, records remain in that browser profile's `localStorage`. With Supabase configured, authenticated devices share the same operational inventory workspace.

For a production-like run (built bundle, no dev server):

```
npm run build
npm start
```

## Sign in

The unconfigured local application includes this demo account. Manual sign-in compares a locally stored password hash, while the clickable demo card does not require a password:

| Email | Password | Role |
|---|---|---|
| a.hosein@uwi.edu | admin123 | Admin |

Roles gate the nav: Admin sees everything; Student assistants lose Reports/Users; Auditors are read-only; Staff only browse and request borrows.

## Supabase accounts and password recovery

When configured, passwords are handled by Supabase Auth and account details are stored in `public.profiles`. Passwords are never placed in the inventory JSON or the `profiles` table.

1. Create a Supabase project.
2. Run all migrations in order in the Supabase SQL Editor, or apply them with the Supabase CLI:
   - `supabase/migrations/202608110001_auth_profiles.sql`
   - `supabase/migrations/202608110002_csv_import_storage.sql`
   - `supabase/migrations/202608150001_shared_inventory_workspace.sql`
3. Deploy the administrator functions with `supabase functions deploy admin-create-user` and `supabase functions deploy admin-reset-password`.
4. Create the first administrator in Authentication > Users. The database trigger creates its profile as Staff; promote it once in the SQL Editor:

```sql
update public.profiles
set role = 'Admin', active = true
where email = 'your.admin@uwi.edu';
```

5. Copy `.env.example` to `.env` and enter the project URL, publishable key, and deployed browser reset URL. Never put a Supabase secret or service-role key in a `VITE_` variable.
6. In Authentication > URL Configuration, set the site URL and add the exact `VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL` value to the allowed redirect URLs.
7. Restart Vite or Electron after changing `.env`.

The complete database upload and verification procedure is in [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md).

Once enabled, users can request recovery from the login screen. Administrators can also open Settings > Users, select an account, and send its recovery email. The recovery link opens the web entry, verifies the Supabase recovery session, and asks the user to choose a new password.

## Data

Seeded equipment records cover 8 buildings and 39 equipment classes (two bundled 3D model packs — see `public/uploads/`). Electron and the browser keep a durable local cache, so navigation never waits on a network query. With Supabase enabled, the app hydrates the canonical shared workspace at sign-in, publishes record-level changes in the background, and listens for changes made by other devices.

## Project layout

- `electron/main.js` — main process: window, local JSON persistence, local mail outbox, custom titlebar IPC, and printing
- `electron/preload.cjs` — contextBridge API exposed to the renderer as `window.api`
- `src/App.jsx` — app state and screen composition
- `src/components/` — one file per screen/modal
- `src/three-engine.js` — shared-renderer 3D engine (one WebGL context renders every rotating card + the big detail viewer)
- `src/data.js` — equipment catalogue, seed-data builders, formatting helpers
- `public/brand/`, `public/uploads/` — MSBM branding and the two GLB model packs
