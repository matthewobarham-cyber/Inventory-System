# Supabase setup and database upload

This version uses Supabase for authentication, shared operational records,
realtime cross-device refresh, the CSV archive, and private disposal-document
storage. The desktop application retains a local cache for responsiveness and
offline recovery, but Supabase is the canonical shared workspace after a cloud
account signs in.

## What is synchronized

- Inventory assets and every edit made after import
- Loans, loan history, borrowing requests, and extensions
- Consumable quantities and usage records
- Maintenance tickets and preventive-maintenance schedules
- Stocktakes and discrepancy results
- Pending orders, procurement records, and assignment/placement queues
- Lifecycle and disposal records
- Vendors and approval, maintenance, and loan contacts
- Reserved/generated barcodes
- Navigation access configuration and borrowing-category rules
- Audit activity
- CSV import records and import history
- Disposal supporting documents through the private `workspace-attachments` bucket
- User accounts and profiles through Supabase Auth and `public.profiles`

Per-user interface state, such as whether alert sound is muted or which alerts a
particular person has already viewed, intentionally remains on that device.
Passwords remain exclusively in Supabase Auth.

## Recommended deployment: Supabase CLI

### 1. Create the project

Create a project at <https://supabase.com/dashboard>. Keep its project reference,
database password, project URL, and publishable key available. Do not expose the
service-role key in Vercel, Vite, GitHub, or the Electron renderer.

### 2. Install and authenticate the CLI

From PowerShell in this repository:

```powershell
npm install --save-dev supabase
npx supabase login
if (-not (Test-Path supabase/config.toml)) { npx supabase init }
npx supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Preview and upload the database schema

```powershell
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

The migrations run in filename order:

1. `202608110001_auth_profiles.sql`
2. `202608110002_csv_import_storage.sql`
3. `202608150001_shared_inventory_workspace.sql`

The third migration creates the shared entity table, indexes, RLS policies,
private attachment bucket, and Realtime publication membership.

### 4. Deploy the administrator functions

```powershell
npx supabase functions deploy admin-create-user
npx supabase functions deploy admin-reset-password
```

These functions perform privileged Auth operations server-side. The
service-role key is never shipped in the application.

### 5. Create the first administrator

In Supabase Dashboard, open **Authentication > Users > Add user** and create the
first account. Then open **SQL Editor**, replace the email below, and run:

```sql
update public.profiles
set role = 'Admin', active = true, updated_at = now()
where email = lower('your.admin@uwi.edu');
```

Confirm it worked:

```sql
select email, name, role, active
from public.profiles
order by email;
```

### 6. Configure local environment variables

Copy `.env.example` to `.env` and fill in the browser-safe values:

```powershell
Copy-Item .env.example .env
```

Use the project URL and **publishable key** from **Project Settings > API**.
Do not use the service-role key in any `VITE_` variable.

### 7. Configure authentication URLs

In **Authentication > URL Configuration**:

1. Set **Site URL** to the deployed web application URL.
2. Add the exact `VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL` value to
   **Redirect URLs**.
3. For local web testing, also add `http://localhost:5173/web.html`.

### 8. Configure Vercel

In the Vercel project, open **Settings > Environment Variables** and add:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL`

Apply them to Production, Preview, and Development as appropriate, then redeploy.
The browser receives only the publishable key; RLS remains the security boundary.

### 9. Upload the existing local inventory

1. Back up the current local inventory first.
2. Start this updated application with the same Windows/browser profile that
   contains the local inventory.
3. Sign in with the Supabase administrator created above.
4. If `workspace_records` is empty, the app automatically publishes the complete
   local workspace to Supabase during the login loading screen.
5. Keep the app open until the loading screen finishes and no synchronization
   warning is displayed.

Only an administrator can perform this first initialization. After rows exist,
every cloud user downloads the shared workspace at sign-in and receives remote
changes while the app remains open.

### 10. Verify the upload

Run these read-only queries in the SQL Editor:

```sql
select entity_type, count(*) as records, max(updated_at) as last_change
from public.workspace_records
where workspace_id = 'msbm'
group by entity_type
order by entity_type;
```

```sql
select count(*) as users from public.profiles;
select count(*) as imported_rows from public.csv_import_records;
select count(*) as uploaded_documents
from storage.objects
where bucket_id = 'workspace-attachments';
```

Then sign in from a second browser or device, edit a harmless test asset, and
confirm that the first device refreshes to the same value.

## Dashboard-only alternative

If the CLI cannot be installed, open each migration file in filename order,
paste its full contents into **Supabase Dashboard > SQL Editor**, and run it.
Then deploy the two Edge Functions with the CLI. The CLI workflow is preferred
because it tracks applied migrations and makes future upgrades repeatable.

## Updating Supabase later

For future versions:

```powershell
git pull
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --dry-run
npx supabase db push
```

Never run `supabase db reset --linked` against production; it destroys remote
data before rebuilding the schema.
