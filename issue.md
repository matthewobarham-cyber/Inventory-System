# MSBM IT Inventory — Issue backlog

How to use this file: work through the issues in numeric order unless a "Depends on" note
says otherwise. Each issue is self-contained — file paths, current behavior, the required
fix, and acceptance criteria are all included so it can be executed without outside context.
Check the box when an issue is done and verified against its acceptance criteria.

Sequencing note: ISSUE-01 (audit log) is first because several later issues should log to
it. ISSUE-17 and ISSUE-18 (the backend/auth migration) are last because they're the largest
lift and the domain-logic fixes above them are easier to get right first.

---

- [x] **ISSUE-01 — Add a central audit log**
  *Priority: High · Files: `src/App.jsx`*
  Problem: No single audit trail exists — changes are scattered in per-domain `activity`
  arrays, but asset edits, retirement, user role changes, suspensions, checkout edits, and
  receiving aren't logged anywhere central.
  Fix: Add an `auditLog` array to App state (persisted like other collections) and a
  `logAudit(action, details)` helper appending `{ id, at, by: session.name, byEmail:
  session.email, action, details }`. Call it from: `saveForm`, `deleteItem`/
  `permanentlyDeleteItem`, `toggleUser`, `updateUserProfile`, `confirmCheckIn`,
  `finalizeCheckout`, `receiveOrder`, `decideLifecycleAction`, `completeLifecycleAction`. Add
  an Admin-only read screen (new component, wired into `NAV.Admin` in `data.js`) listing the
  log newest-first with basic filtering by action/user.
  Acceptance: Every listed action produces one audit entry visible on the new screen;
  non-admins can't access it.

- [x] **ISSUE-02 — Block admin self-suspend/self-demote and last-admin lockout**
  *Priority: Medium · Files: `src/App.jsx` (`toggleUser`, `updateUserProfile`)*
  Problem: No check prevents an admin from suspending/demoting their own account, including
  the only seeded Admin.
  Fix: In `toggleUser`/`updateUserProfile`, if the target email matches `session.email` and
  the change would suspend the account or remove Admin role, block with a toast error.
  Separately, before allowing any suspend/demote, verify at least one other active Admin
  exists in `accounts`; block if not.
  Acceptance: An Admin cannot suspend/demote themself; the last remaining Admin cannot be
  suspended/demoted by anyone.

- [x] **ISSUE-03 — Require admin approval to retire an asset**
  *Priority: High · Files: `src/App.jsx` (`deleteItem`), `src/components/AssetFormModal.jsx`*
  Problem: `deleteItem` has no role guard; `AssetFormModal` always shows "Retire" during edit
  regardless of role, letting Student assistants bypass the lifecycle-approval flow.
  Fix: In `AssetFormModal.jsx`, only render Retire when `isAdmin` (thread it down like the
  existing `canEdit`/`canDelete` props). In `App.jsx`'s `deleteItem`, add `if (!isAdmin)
  return;`. For non-admins, route the retire affordance through `createLifecycleAction`
  (disposition draft) instead of removing it outright, so it goes through the existing
  Pending-approval path.
  Acceptance: Non-admin retirement attempts create a pending lifecycle action, not an
  immediate retirement; direct `deleteItem` calls from non-admins are no-ops.

- [x] **ISSUE-04 — Replace permanent deletion with reversible archiving**
  *Priority: High · Files: `src/App.jsx` (`permanentlyDeleteItem`)*
  Problem: Hard-deletes the item plus all loan history, orders, placements, repair tickets,
  maintenance schedules, and lifecycle actions — audit evidence is irreversibly destroyed,
  gated only by `window.confirm`.
  Fix: Replace array-filtering with an `archived`/`archivedAt`/`archivedBy` flag on the item;
  exclude archived items from normal views via that flag instead of removing records. Add an
  admin-only "Archived assets" view/filter on `Inventory.jsx` showing archived items with
  full retained history. Keep true hard-delete (if needed at all) as a separate, more
  heavily-gated action.
  Acceptance: "Deleting" an asset removes it from normal navigation but its history/orders/
  tickets/lifecycle records are still retrievable via the archived view.

- [x] **ISSUE-05 — Fix the staff borrow-request workflow (dead end, eligibility, duplicates, and landing in Loans)**
  *Priority: High · Files: `src/App.jsx` (`requestBorrow`, `approveRequest`), `src/components/Loans.jsx`*
  Problem: Requests have no `itemId`, so approval only relabels the request — no reservation/
  checkout happens, and the loan never shows up on the Loans screen. There's also no check
  blocking requests on items that are on-loan, retired, in maintenance, low/zero-stock, or
  consumable, nor blocking duplicate requests from the same user.
  Fix: Add `itemId` (and status snapshot) to the request record. In `requestBorrow`, reject
  with an error if `item.status !== 'In stock'`, item is consumable, or the user already has
  a Pending request for that item. In `approveRequest`, actually reserve the item on
  approval — either transition it straight into the checkout flow or add a "Reserved" state
  that blocks further requests/checkout until an admin completes checkout, extending
  `effStatus`/`STATUS_COLORS` in `data.js` and any places that branch on status
  (`Inventory.jsx`, `ItemDetail.jsx`). Once approval results in `status: 'On loan'`, it will
  automatically appear on the Loans screen (`Loans.jsx` already filters `status === 'On
  loan'`) — no separate change needed there once the status transition is correct.
  Acceptance: Approving a borrow request changes real item availability and the item
  immediately appears in the Loans tab; ineligible/duplicate requests are rejected with a
  clear message before submission.

- [x] **ISSUE-06 — Fix consumable receiving so it increments quantity instead of creating per-unit records**
  *Priority: High · Files: `src/App.jsx` (`saveForm`, `openPlacementAsset`), `src/components/AssetFormModal.jsx`*
  Problem: Every received consumable unit becomes its own qty:1 record with a unique tag —
  receiving 100 toner cartridges requires 100 records.
  Fix: Branch intake on `model.cons`/`item.consumable`. For consumables, look up an existing
  stock record for that model+location; if found, increment its `qty`; if not, create one
  record with `qty = received amount`. Update `AssetFormModal.jsx` to show an editable
  quantity field for consumables and skip the per-unit "continue with next unit" placement
  loop for them entirely (that loop stays serialized-equipment-only).
  Acceptance: Receiving N consumable units updates one record's quantity; serialized
  equipment intake is unchanged.

- [x] **ISSUE-07 — Add partial/damaged-quantity handling to order receiving**
  *Priority: High · Files: `src/App.jsx` (`receiveOrder`), `src/components/PendingOrders.jsx`, `src/components/OrderDetailsModal.jsx`*
  Problem: Receiving is all-or-nothing — one click marks the full order quantity Received
  with no way to record partial delivery or damaged units.
  Fix: Turn "Receive" into a confirmation modal (pattern-match `ReorderModal.jsx`/
  `CheckInModal.jsx`) capturing: quantity received (default to ordered qty, editable),
  quantity damaged/rejected, and a note. If `receivedQty < order.qty`, set the order to a
  `'Partially received'` status with a `remainingQty` for a follow-up receipt instead of
  forcing full completion. Only create a Placement for received-minus-damaged quantity.
  Surface damaged qty/notes in `OrderDetailsModal.jsx`.
  Acceptance: Receiving fewer units than ordered leaves the order in a partial state with
  correct remaining quantity; damaged units don't become placements.

- [x] **ISSUE-08 — Make completed/approved orders reachable, and auto-route received stock into inventory**
  *Priority: High · Files: `src/App.jsx`, `src/components/PendingOrders.jsx`, `src/components/PlacementQueue.jsx`*
  Problem: Only pending orders/placements are passed to these screens — once an order is
  approved and moves past a bare "Pending" label, or once a placement is fully placed, the
  record disappears from normal navigation. Separately, once an order is received, there's
  no single obvious path that carries it straight into inventory (serialized) or a quantity
  bump (consumable) — the user has to know to go find it in the Placement queue.
  Fix: Add a status filter/tab to `PendingOrders.jsx` (All / Pending / Partially received /
  Received) and to `PlacementQueue.jsx` (Pending / Placed) so nothing drops out of view after
  its status changes. Then make the received → placed → in-inventory path an explicit,
  guided flow: after `receiveOrder` (ISSUE-07) creates a Placement, the UI should prompt the
  user directly into "set up this asset" (serialized, via `openPlacementAsset` →
  `AssetFormModal`) or, for consumables, apply the ISSUE-06 quantity-increment immediately
  with no separate per-unit setup step required.
  Acceptance: A user can view a fully received order and a fully placed placement without
  leaving the normal screens; receiving a consumable order updates stock quantity without
  extra manual steps, and receiving serialized equipment walks the user straight into asset
  setup.

- [x] **ISSUE-09 — Surface persistence failures instead of swallowing them**
  *Priority: High · Files: `src/store.js`, `electron/main.js`, `src/App.jsx`*
  Problem: `savePersisted()` swallows `saveStore` failures via `.catch(() => {})`; `writeStore`'s
  success/failure boolean never reaches the renderer; toasts fire on state change, not on
  confirmed save, so users see success even when the write failed.
  Fix: Propagate `writeStore`'s boolean result back through `saveStore`/`savePersisted`
  (return a promise or accept an `onError` callback). In `App.jsx`, track a "last save
  failed" state; on failure show a persistent (non-auto-dismissing) error banner distinct
  from normal action toasts, and retry with backoff.
  Acceptance: A forced write failure (e.g. read-only disk in testing) produces a visible,
  non-dismissing error instead of a normal success toast.

- [x] **ISSUE-10 — Validate checkout borrower/authorizer/dates**
  *Priority: High · Files: `src/App.jsx` (`previewCheckoutAgreement`), `src/components/CheckoutModal.jsx`*
  Problem: `coLoanedBy` and `coBorrower` are free text; `coDue` isn't checked against today or
  cross-validated against `coPeriod`.
  Fix: Change `coLoanedBy` from free text to a select constrained to `checkoutTsrs`. Keep/
  tighten `coBorrower` validation (flag as a product decision if it should be constrained to
  known accounts). In `previewCheckoutAgreement`, reject if `coDue` is empty, before today,
  or doesn't match `today + coPeriod` days.
  Acceptance: Checkout cannot be completed with an unrecognized authorizer, or with a due
  date that's empty, in the past, or inconsistent with the stated loan period.

- [x] **ISSUE-11 — Create a repair ticket (and maintenance history) when check-in disposition is "Send to maintenance"**
  *Priority: Medium · Files: `src/App.jsx` (`confirmCheckIn`)*
  Problem: Setting disposition to "Send to maintenance" during loan check-in only flips item
  status to `Maintenance` — no ticket, and therefore no maintenance history entry, is
  created, unlike the normal repair-ticket entry path in `Maintenance.jsx`.
  Fix: When disposition is "Send to maintenance", call `createRepairTicket` with a draft
  built from the check-in form (notes as fault description, condition, etc.) instead of
  setting status directly. This both fixes the missing ticket and produces the maintenance
  history entry that should exist whenever a loaned item is retrieved into maintenance.
  Acceptance: Every item that enters Maintenance via loan check-in has a corresponding
  repair ticket with a maintenance history entry, same as via the dedicated Maintenance
  screen.

- [x] **ISSUE-12 — Fix Reports value/status accuracy**
  *Priority: Medium · Files: `src/components/Reports.jsx`*
  Problem: Total value includes retired items and uses `Math.max(1, qty)`, valuing
  zero-stock consumables as 1 unit; the status split omits Retired.
  Fix: Exclude `status === 'Retired'` from value totals (or compute a separately-labeled
  "disposed value"). Replace `Math.max(1, qty)` with the real `qty` (guard NaN with
  `Number.isFinite(qty) ? qty : 0`, not a floor of 1). Add Retired as an explicit bucket in
  the status split.
  Acceptance: A retired item with cost doesn't inflate "current asset value"; a zero-stock
  consumable reports $0, not 1-unit value; Retired count is visible in the status breakdown.

- [x] **ISSUE-13 — Wire up or hide the non-functional global search**
  *Priority: Medium · Files: `src/components/TopBar.jsx`, `src/App.jsx`, and `Dashboard.jsx`,
  `Stocktakes.jsx`, `Requests.jsx`, `Alerts.jsx`, `CsvImport.jsx`, `Reports.jsx`, `Users.jsx`*
  Problem: The search box renders on every screen but only a few screens actually consume
  `filters.query`.
  Fix: For each of the listed screens, either wire `filters.query` into that screen's own
  filtering (matching the existing pattern already used for Maintenance/LoanHistory/
  PendingOrders/PlacementQueue), or — where search genuinely doesn't apply (Reports,
  CsvImport) — hide the search box via a `showSearch` prop on `TopBar` gated by `screen` in
  `App.jsx`.
  Acceptance: No screen shows an enabled search box that silently does nothing when typed
  into.

- [x] **ISSUE-14 — Prevent overlapping stocktakes and self-signed sign-off**
  *Priority: Medium · Files: `src/App.jsx` (`createStocktake`, `completeStocktake`),
  `src/components/Stocktakes.jsx`*
  Problem: Multiple `'In progress'` stocktakes can be created for the same building/room;
  sign-off accepts arbitrary typed text as `signedBy`.
  Fix: In `createStocktake`, reject (with a toast naming the conflict) if an `'In progress'`
  stocktake already exists for the same scopeType/building/room. In `completeStocktake`/
  `Stocktakes.jsx`, use `session.name`/`session.email` for sign-off instead of a free-text
  field.
  Acceptance: Starting a second stocktake on an already-in-progress room/building is
  blocked; sign-off always reflects the authenticated user, not typed text.

- [x] **ISSUE-15 — Make clickable cards/rows keyboard accessible**
  *Priority: Low · Files: `src/components/Inventory.jsx`, `src/components/Dashboard.jsx`, and
  any other clickable-`<div>` patterns in `src/components/`*
  Problem: Cards/rows use `onClick` on plain `<div>`s with no keyboard affordance.
  Fix: Add `role="button"`, `tabIndex={0}`, and an `onKeyDown` handler firing the same
  action on Enter/Space (preventDefault on Space) to every such element. Add/confirm a
  visible `:focus-visible` style in `src/styles.css`. Prioritize `Inventory.jsx` grid cards
  and `Dashboard.jsx` summary tiles/notifications first.
  Acceptance: Every previously-mouse-only clickable card/row is operable and visibly
  focusable via Tab + Enter/Space.

- [x] **ISSUE-16 — Reduce production bundle size**
  *Priority: Low · Files: `src/three-engine.js`, `src/components/CheckoutAgreementModal.jsx`,
  `src/components/BarcodeLabelModal.jsx`, `src/components/BulkBarcodeModal.jsx`*
  Problem: `npm run build` warns about a ~1.44MB chunk, mainly three.js/GLTFLoader and
  jspdf/jsbarcode loaded eagerly.
  Fix: Dynamic-import `three-engine.js`/`GLTFLoader` so three.js isn't in the main entry
  chunk. Dynamic-import `jspdf`/`jsbarcode` inside the specific modals that use them instead
  of top-level imports.
  Acceptance: `npm run build` no longer warns about the oversized chunk, or the large chunk
  is confirmed deferred (not just renamed) via network waterfall.

- [ ] **ISSUE-17 — [Superseded / not implemented] Real server-side auth and shared data**
  *Priority: Critical · Files: new backend, `src/App.jsx`, `src/store.js`, `electron/main.js`*
  Problem: Accounts/passwords live in client-bundled `src/data.js`; all state persists to one
  local JSON file per workstation — no cross-installation visibility, no real credential
  security.
  Fix: Stand up a minimal backend (Node/Express + SQLite, structured for a later Postgres
  swap) with bcrypt/argon2-hashed passwords, a real login endpoint issuing signed session
  tokens, and server-side role re-validation on every mutating endpoint. Migrate all domain
  collections (items, history, requests, orders, placements, stocktakes, repairTickets,
  maintenanceSchedules, lifecycleActions, procurementRecords, importRuns, userState,
  profileState, customAccounts, auditLog from ISSUE-01) to server-owned tables accessed via
  API. Keep component props/callbacks in `src/components/*` as close to unchanged as
  possible — App.jsx's handlers call the API and update local state from the response. Local
  JSON persistence becomes an offline cache, not the source of truth.
  Acceptance: Credentials are never present in client-shipped code; two installations
  pointed at the same server see the same inventory/requests/state.

- [ ] **ISSUE-18 — Replace email-only "keep me signed in" with bounded local sessions**
  *Priority: Critical · Files: `src/store.js`, `src/App.jsx`*
  Problem: The remembered-session pointer stores only an email and resumes login with no
  reauthentication; the checkbox defaults on.
  Fix (do immediately, doesn't require ISSUE-17): Default "keep me signed in" to off in
  `LoginScreen.jsx`; give the pointer an expiry (12–24h), clearing it and requiring login if
  expired.
  Fix (after ISSUE-17 backend exists): Replace the email-only pointer with a signed session
  token issued at login, verified server-side on resume, and revoked server-side on logout/
  suspension.
  Acceptance: Reopening the app without ISSUE-17 either requires fresh login or resumes only
  within a bounded, expiring window; after ISSUE-17, resume is impossible without a valid,
  unrevoked server-verified token.

---

## New issues

- [x] **ISSUE-19 — Add a requisition number slot to the Pending Orders page**
  *Priority: Low · Files: `src/components/PendingOrders.jsx`*
  Problem: `order.requisitionNumber` is generated in `App.jsx`'s `approveRequest` and already
  shown in `OrderDetailsModal.jsx`'s detail grid ("Requisition" row), but the Pending Orders
  list itself has no slot for it — a user has to open "Vendor details" just to see which
  requisition an order came from.
  Fix: Add the requisition number to each order row in `PendingOrders.jsx`, e.g. beneath the
  existing `order.reference` line in the supplier cell, showing `order.requisitionNumber ||
  'Direct order'`.
  Acceptance: The requisition number is visible directly on the Pending Orders list without
  opening the order details modal.

- [x] **ISSUE-20 — Rename "Assigned technician" to "Assigned Systems administrator" on the New Repair Ticket form**
  *Priority: Low · Files: `src/components/Maintenance.jsx`*
  Problem: The New/Edit Repair Ticket modal labels the technician field "Assigned
  technician".
  Fix: Change that label's text to "Assigned Systems administrator" in the repair-ticket
  form section (the `<label>` wrapping `ticketForm.technician`'s `<select>`). Leave the
  underlying `technician` field name, the `technicians` prop, and the dropdown options
  unchanged. Note: the Preventive-maintenance schedule form has a separate "Preferred
  technician" label using the same underlying concept — leave it as-is unless the user asks
  for it renamed too, since only the repair-ticket form was specified.
  Acceptance: The New/Edit repair ticket modal reads "Assigned Systems administrator";
  nothing else about the field's behavior changes.

- [x] **ISSUE-21 — New-alert notification indicator (dot + optional sound)**
  *Priority: Medium · Files: `src/App.jsx`, `src/components/Sidebar.jsx`*
  Problem: `navCounts.alerts` already shows a static badge count next to the "Low stock" nav
  item, but nothing distinguishes "a new alert just appeared" from "the count is still the
  same as last time you looked" — no visual ping and no sound.
  Fix:
  1. In `App.jsx`, persist a `seenAlertIds` set (low-stock item ids the user has already
     acknowledged), following the same persist pattern as other collections.
  2. On each recompute of `low` (the low-stock item list), diff against `seenAlertIds`; if
     any id is new, set a `hasNewAlert` flag.
  3. When `hasNewAlert` newly becomes true, optionally play a short bundled sound (add e.g.
     `public/sounds/alert.mp3`, play via `new Audio(...).play()`), gated behind a simple
     mute preference so it's not intrusive by default.
  4. In `Sidebar.jsx`, render a small dot on the "Low stock" nav button when `hasNewAlert` is
     true, in addition to the existing count badge.
  5. Clear `hasNewAlert` and merge current ids into `seenAlertIds` when the user opens the
     Alerts screen (hook into the existing `goScreen('alerts')` path).
  Acceptance: A new low-stock item produces a visible dot (and sound, if unmuted) that
  clears once the user visits the Alerts screen; revisiting with no new alerts shows nothing
  extra.
  Flag for the user: confirm whether "alert" should cover only low stock, or also overdue
  loans / high-priority open repair tickets — implemented here for low stock first since
  that's the app's existing "Alerts" concept.

- [x] **ISSUE-22 — Role-based page-access editor for IT Manager / Systems Administrator**
  *Priority: Medium · Files: `src/data.js` (`NAV`), `src/App.jsx`, `src/components/Users.jsx`
  (or a new settings component), `src/components/Sidebar.jsx`*
  Problem: `NAV` in `data.js` is a hardcoded object mapping each of the four fixed roles
  (Admin, Student assistant, Auditor, Staff) to a fixed list of accessible screens. There's
  no UI to change which pages a role can see.
  Fix:
  1. Move `NAV` from a build-time constant into persisted App state (`navOverrides`, seeded
     from the current `NAV` object) so it can be edited at runtime and survives restarts,
     following the same hydrate/persist pattern as the app's other collections.
  2. Add an Admin-only settings panel (new component, or a new tab in `Users.jsx`) listing
     each role with a checkbox grid of every screen key from `LABELS` in `data.js`, so an
     Admin can add/remove which screens each role can access.
  3. Everywhere `NAV[role]` is read today (`App.jsx` guards, `Sidebar.jsx`'s nav list,
     `Users.jsx`'s access display) should read the merged/overridden value instead of the
     static import, so edits take effect immediately.
  Acceptance: An Admin can remove a page from a role's nav and add it back from within the
  running app, and the change is reflected in that role's Sidebar immediately and after an
  app restart.
  Flag for the user: this app currently only has one full-access role (Admin) — "IT manager
  or systems administrator" is treated here as that existing Admin role gaining this new
  editor screen. If a distinct new role name is actually wanted (as opposed to just calling
  Admin by this name), that also touches `ACCOUNTS`/login and `Users.jsx`'s `ROLE_SUMMARY`
  copy — confirm before adding a new named role.

- [ ] **ISSUE-23 — Automated helpdesk email workflow (partially implemented as a local outbox only)**
  *Priority: Medium · Files: `electron/main.js`, `electron/preload.cjs`, new `src/mailer.js`,
  `src/App.jsx` (`createRepairTicket`, `createMaintenanceSchedule`, `finalizeCheckout`,
  `confirmCheckIn`), `package.json`*
  Problem: There is no outbound email capability anywhere in the app. The request is for
  automatic emails to `helpdesk@msbm-uwi.org` triggered by: (a) repair ticket creation, (b) a
  day-before reminder for each preventive-maintenance schedule's next-due date, and (c) loan
  activity.
  Fix:
  1. Add `nodemailer` as a dependency. In `electron/main.js`, add an IPC handler
     `mail:send` accepting `{ to, subject, body }` and sending via SMTP configured through
     environment variables (host/port/user/pass) — never hardcode credentials in source;
     document the required env vars in `README.md`. Expose it via `preload.cjs` as
     `window.api.sendMail(...)`, following the existing narrow-IPC-surface pattern used for
     `store:load`/`store:save`.
  2. In `createRepairTicket` (`App.jsx`), after the ticket is created, send an email to
     helpdesk summarizing the ticket id, asset, fault description, priority, and creator.
  3. For preventive-maintenance schedules: add a check (e.g. alongside the app's existing
     periodic sync interval, or a once-a-day check) that scans `maintenanceSchedules` for any
     `active` schedule whose `nextDue` is exactly tomorrow, and hasn't already had a reminder
     sent for that due date (track a `lastReminderSentFor` field to avoid duplicate sends).
     Email helpdesk with the schedule's asset, title, instructions, and due date. Note in
     code/README that since this app has no always-on background process, this reminder only
     fires while the app happens to be open at the right time on some workstation — a
     guaranteed day-before reminder needs the real backend from ISSUE-17; treat this as
     best-effort until then.
  4. For loans: send helpdesk a short notification email on both checkout
     (`finalizeCheckout`) and check-in (`confirmCheckIn`), including item, borrower, and
     dates. Confirm with the user once this is in use whether they'd rather narrow it to only
     overdue loans instead of every checkout/check-in.
  5. Make outbound mail failures non-blocking and logged only (don't fail the underlying
     action or show an alarming error if the helpdesk email doesn't send) — optionally record
     the failure in the audit log from ISSUE-01.
  Acceptance: Creating a repair ticket, checking an item in/out, and a PM schedule reaching
  "due tomorrow" each produce one outbound email to `helpdesk@msbm-uwi.org`; missing/invalid
  SMTP configuration doesn't crash the app or block the underlying action.

---

## Current QA assessment — 2026-08-07

This section is the current source of truth for release readiness. Earlier checked issues
describe work completed during development, but they do not override regressions or changed
architecture recorded below.

### Assessment scope and result

- Result: **Not ready for trusted production data or unrestricted campus deployment.** The
  local demo is usable, but authentication and data-integrity controls are not production
  grade.
- Method: static user-flow review of every role, state-transition review in `src/App.jsx`,
  Electron/preload/persistence review, asset-link verification, `npm run build`, and
  `npm audit`. There is no automated test suite, so scanner hardware, native print dialogs,
  PDF viewers, crash recovery, and multi-instance behavior still require manual execution.
- Links/assets: **262/262 model links and 3/3 branding links resolve locally.** No missing
  GLB, preview, or brand files were found. No conventional application routes or external
  hyperlinks exist; navigation is React state driven.
- Dependency scan: production dependencies report **1 moderate vulnerability**. The full
  development/packaging tree reports **17 vulnerabilities: 1 critical, 14 high, and 2
  moderate**, including the installed Electron and electron-builder lines.

### Current role-flow status

| Flow | Current state | Risk |
|---|---|---|
| Login / resume | Manual passwords work locally, but every seeded account—including Admin—also has passwordless one-click login. Remembered sessions never expire. | Critical |
| Admin | All main pages and the consolidated Settings sections are reachable. Administrator authorization exists mainly as renderer UI checks. | High |
| Student assistant | Inventory, stocktake, maintenance, lifecycle request, loan, receiving, placement, and scanner paths are connected. | Medium |
| Auditor | Inventory, history, reports, orders, placements, and read-only CSV archive are exposed; editing controls are normally hidden. | Medium |
| Staff | Inventory browsing, borrow requests, request status, and personal history are connected. | Medium |
| Asset intake | Manual intake, CSV intake, reserved barcodes, and serialized receiving are connected; stock-ledger and zero-balance handling remain incomplete. | High |
| Checkout / return | Availability checks, TSR selection, agreements, check-in inspection, history, and maintenance disposition are connected. | Medium |
| Orders / placement | Direct orders, requisition approval, partial receipt, damaged quantity, consumable increment, and serialized setup are connected. | Medium |
| Reports / PDFs | Report filters, accounting estimates, selectable PDF sections, repair PDFs, and lifecycle PDFs are connected; input and viewer edge cases remain. | Medium |

### Open findings, ranked by severity

- [ ] **ISSUE-24 — Remove passwordless administrator/demo sign-in from production builds**
  *Severity: Critical · Security / accounts · Files: `src/components/LoginScreen.jsx`,
  `src/App.jsx`, `README.md`*
  Problem: the login screen lists all six seeded accounts and `demoLogin()` creates a
  session without a password. This includes `a.hosein@uwi.edu`, the full administrator.
  Anyone who can open the application can obtain full control and read local inventory,
  user, audit, procurement, and maintenance data.
  Required fix: put demo cards behind an explicit development/demo build flag and never
  include them in production packaging. Production must require credentials for every role.
  Acceptance: a production build has no one-click account cards and cannot create any
  session without valid credentials.

- [ ] **ISSUE-25 — Expire, bind, and revalidate remembered sessions**
  *Severity: Critical · Security / accounts · Files: `src/store.js`, `src/App.jsx`*
  Problem: `saveSessionPointer()` stores only `{ email }`; startup trusts it indefinitely
  and recreates the account's current role without a password. There is no issued time,
  expiry, random token, workstation binding, or revocation identifier. This also means the
  old ISSUE-18 acceptance criteria are not met.
  Required fix: for local-only operation, store an opaque random session identifier with
  issued/expiry timestamps (maximum 12–24 hours), validate it against a protected local
  session record, and rotate/delete it on logout, suspension, role change, and password
  change. Default remains unchecked.
  Acceptance: copied, expired, suspended, or revoked session pointers cannot resume access.

- [ ] **ISSUE-26 — Protect the local source of truth from account, role, and audit tampering**
  *Severity: High · Security / privacy · Files: `electron/main.js`, `electron/preload.cjs`,
  `src/store.js`, `src/App.jsx`*
  Problem: `inventory-store.json` contains the complete inventory, PII, account hashes,
  profile photographs, attachments, role overrides, and audit entries as readable/editable
  JSON. The renderer can submit an arbitrary replacement object through `store:save`; the
  main process performs no schema, role, or state-transition validation. Anyone with local
  file access—or a compromised renderer—can grant Admin, alter assets, or rewrite the audit
  trail.
  Required fix: separate credentials/session material from domain data, protect secrets with
  Windows DPAPI/OS credential storage, validate a strict schema in the main process, and
  move privileged state transitions behind narrow IPC handlers that re-check the active
  role. Document the local threat model and filesystem permissions.
  Acceptance: editing renderer state or invoking generic save cannot create an Admin,
  change protected records, or rewrite audit history.

- [ ] **ISSUE-27 — Make persistence atomic, recoverable, and safe across app instances**
  *Severity: High · Data integrity · Files: `electron/main.js`, `src/store.js`, `src/App.jsx`*
  Problem: the whole database is synchronously overwritten in place with `writeFileSync`.
  There is no temporary-file + rename transaction, checksum, rolling backup, file lock, or
  single-instance lock. A crash or full disk can truncate the file; parse failure returns
  `null`, after which the app loads seed data and can overwrite the damaged source. Two app
  instances can silently apply last-writer-wins data loss.
  Required fix: use atomic write/rename with validation, retain known-good backups, surface a
  recovery screen instead of seeding over a corrupt store, and enforce `app.requestSingleInstanceLock()`
  or real record-level concurrency.
  Acceptance: forced termination during save and a deliberately corrupted current file both
  recover the last valid snapshot without silently resetting inventory.

- [ ] **ISSUE-28 — Upgrade vulnerable runtime and packaging dependencies**
  *Severity: High · Supply chain / runtime · Files: `package.json`, `package-lock.json`*
  Problem: `npm audit` reports 17 findings in the full tree. Electron 33 is directly affected
  by multiple current advisories, electron-builder 25 pulls vulnerable packaging utilities,
  and the production tree includes a moderate DOMPurify advisory through PDF tooling.
  Required fix: upgrade Electron to a supported patched release, electron-builder to a
  patched 26.x or later release, Vite/tooling as compatibility permits, and resolve the
  production DOMPurify chain. Regression-test PDF generation, printing, 3D, preload IPC,
  packaging, and Windows launch behavior after the major upgrades.
  Acceptance: `npm audit --omit=dev` reports zero known production vulnerabilities and all
  remaining development findings are documented/accepted or removed.

- [ ] **ISSUE-29 — Revalidate authorization inside every mutation handler**
  *Severity: High · Security / authorization · File: `src/App.jsx`*
  Problem: many state-changing callbacks rely on buttons being hidden rather than checking
  the role themselves. Examples include `saveForm`, order receipt, request approval/decline,
  stocktake create/record/complete/cancel, lifecycle configuration/request creation, repair
  ticket updates, and maintenance schedule changes. `openCheckIn`/`confirmCheckIn` also lack
  a role guard. UI gating is not an authorization boundary.
  Required fix: add a centralized permission function and enforce it at the start of every
  mutating handler, then repeat validation in the main-process IPC boundary from ISSUE-26.
  Acceptance: direct invocation of every privileged callback under Staff/Auditor produces no
  state change and records a denied attempt where appropriate.

- [ ] **ISSUE-30 — Revoke active access immediately after suspension, demotion, or role-page changes**
  *Severity: High · Accounts / authorization · Files: `src/App.jsx`, `src/store.js`*
  Problem: account activity is checked at login/startup only. Suspending or demoting a user
  does not terminate an already open session in another process, and local app instances do
  not synchronize. Page access is also not rechecked before `goScreen()` changes state.
  Required fix: revalidate the current account and role permissions before navigation and
  mutation, invalidate matching session records on account changes, and add local state
  synchronization or enforce a single instance.
  Acceptance: a suspended/demoted user loses protected access without restarting or signing
  out manually.

- [ ] **ISSUE-31 — Add a real consumable stock-movement ledger and allow zero on hand**
  *Severity: High · Inventory accuracy · Files: `src/App.jsx`, `src/components/AssetFormModal.jsx`,
  reports and audit views*
  Problem: editing a consumable uses `Math.max(1, ...)`, so stock cannot be recorded as zero.
  There is no controlled issue/consume/adjustment transaction with reason, user, date, and
  before/after quantities. Users must overwrite quantity, and the central audit entry only
  says the asset was updated. This can materially misstate low stock and accounting values.
  Required fix: allow zero, prevent negative stock, and add receive/issue/count-adjustment
  movements with a reason and immutable history. Reports should reconcile opening + receipts
  - issues + adjustments to on-hand quantity.
  Acceptance: stock can reach exactly zero, every quantity change has a traceable movement,
  and reports reconcile to the displayed balance.

- [ ] **ISSUE-32 — Complete and protect the audit trail**
  *Severity: Medium · Audit / compliance · Files: `src/App.jsx`, `src/components/AuditLog.jsx`,
  persistence layer*
  Problem: important actions are not centrally logged, including login/logout/failure,
  account creation, password operations, request submission/decline, CSV import, invoice
  generation, lifecycle request creation/configuration, repair updates/completion,
  maintenance schedule changes, and failed/denied operations. The log shares the editable
  JSON store and has no sequence/checksum/export/retention control.
  Required fix: define an audit event catalogue, log success and sensitive failure paths,
  append events through a protected persistence boundary, add monotonic sequencing and
  tamper evidence, and support controlled export/retention.
  Acceptance: every security- or inventory-relevant transition produces an attributable,
  ordered, tamper-evident event.

- [ ] **ISSUE-33 — Validate manual identity fields and prevent duplicate serial numbers**
  *Severity: Medium · Data quality · Files: `src/App.jsx`, `src/components/AssetFormModal.jsx`*
  Problem: manual intake checks duplicate asset tags but permits duplicate non-empty serial
  numbers. CSV intake treats duplicate serials as duplicates, so manual and CSV rules are
  inconsistent. Supplier/location/room and warranty/purchase relationships also receive
  limited cross-field validation.
  Required fix: normalize and uniquely validate non-empty serials across active and archived
  records, define an explicit exception process, and validate purchase/warranty/date fields.
  Acceptance: duplicate serials and invalid date relationships are blocked with actionable
  messages before storage.

- [ ] **ISSUE-34 — Add bounded CSV import and attachment storage controls**
  *Severity: Medium · Availability / data integrity · Files: `src/components/CsvImport.jsx`,
  `src/csv-import.js`, attachment components, persistence layer*
  Problem: CSV files have no file-count, per-file-size, row-count, or total-import limit and
  are read fully into renderer memory before synchronous parsing. Images/documents are stored
  as base64 inside the single JSON database; current per-file limits can still add tens of
  megabytes per record and make every full-store save slower and less reliable.
  Required fix: enforce explicit import limits, parse incrementally or in a worker, reject
  excessive rows safely, and store attachments as separately checksummed files with quotas.
  Acceptance: oversized inputs fail before allocation, the UI stays responsive, and large
  attachments do not inflate every inventory save.

- [ ] **ISSUE-35 — Clarify local helpdesk outbox versus actual email delivery**
  *Severity: Medium · Workflow / communications · Files: `src/mailer.js`, `electron/main.js`,
  Settings, `README.md`*
  Problem: repair, loan, and PM actions call `sendHelpdeskMail`, but `mail:send` only writes
  `mail-outbox.json`; it never sends email. The app does not expose the outbox, delivery
  state, retry, export, or a prominent “recorded locally—not sent” result. Operators can
  reasonably assume helpdesk was notified when it was not.
  Required fix: either rename the workflow everywhere to “local notification record” and add
  an outbox screen/export, or implement authenticated delivery with visible queued/sent/
  failed status and retry.
  Acceptance: the user can tell, from the application, whether a notification was merely
  recorded or actually delivered.

- [ ] **ISSUE-36 — Validate report date ranges and explain accounting limitations before generation**
  *Severity: Medium · Reporting · Files: `src/components/Reports.jsx`, `src/report-pdf.js`*
  Problem: users can select a reporting start after the end date and generate a formally
  branded report. The report is an operational estimate without general-ledger integration,
  approval status, opening balances, tax, invoice posting, or reconciliation, yet can look
  authoritative outside the app.
  Required fix: block invalid ranges, mark draft/management-report status prominently on
  every page, include preparer/filter metadata, and add a review/approval step if reports are
  used for financial decisions.
  Acceptance: invalid periods cannot generate; every PDF visibly identifies its accounting
  basis, limitations, preparer, and approval state.

- [ ] **ISSUE-37 — Align archive/retirement language and states**
  *Severity: Low · UX / records management · Files: `src/components/ItemDetail.jsx`,
  `src/App.jsx`, `src/components/Inventory.jsx`*
  Problem: the button says “Delete permanently,” but the handler asks to archive and performs
  a reversible archive. Separately, Retired is a lifecycle status rather than the archived
  view. The two concepts can confuse users about whether a record was destroyed, disposed,
  or merely hidden.
  Required fix: rename the action to “Archive record,” explain Retired versus Archived, and
  provide a restore action with audit logging.
  Acceptance: UI language matches actual behavior and an administrator can restore an
  archived record without editing storage.

- [ ] **ISSUE-38 — Correct placement summary counts after items are placed**
  *Severity: Low · Functional / reporting · File: `src/components/PlacementQueue.jsx`*
  Problem: the “Awaiting setup” tile uses `placements.length`, which includes records already
  marked Placed, while the other tiles use pending records. The headline therefore overstates
  work remaining.
  Required fix: use `pending.length` and add a separate placed-history count if useful.
  Acceptance: “Awaiting setup” equals the visible pending workload.

- [ ] **ISSUE-39 — Add automated regression coverage for role and state-transition workflows**
  *Severity: Medium · Quality engineering · Files: `package.json`, new test files/fixtures*
  Problem: there is no `test`, integration, end-to-end, lint, or type-check script. Current
  validation proves the bundle compiles, not that role access, persistence recovery, barcode
  input, order quantities, PDFs, or accounting totals behave correctly.
  Required fix: add unit tests for pure calculations/parsers, integration tests for every
  mutation and role guard, and Electron end-to-end tests for login, inventory, checkout/
  return, receiving, stocktake, Settings, printing/PDF preview, and restart persistence.
  Acceptance: CI runs the matrix on every change and blocks regressions in critical flows.
