create table if not exists public.csv_import_runs (
  id text primary key,
  payload jsonb not null,
  imported_by uuid not null references public.profiles(id),
  imported_at timestamptz not null default now(),
  complete boolean not null default false
);

create table if not exists public.csv_import_records (
  import_key text primary key,
  record_type text not null check (record_type in ('asset', 'procurement')),
  payload jsonb not null,
  source_file text not null default '',
  source_row integer not null default 0,
  import_run_id text not null references public.csv_import_runs(id) on delete cascade,
  imported_by uuid not null references public.profiles(id),
  imported_at timestamptz not null default now()
);

create index if not exists csv_import_records_type_idx on public.csv_import_records(record_type);
create index if not exists csv_import_records_imported_at_idx on public.csv_import_records(imported_at);
create index if not exists csv_import_runs_imported_at_idx on public.csv_import_runs(imported_at desc);

alter table public.csv_import_runs enable row level security;
alter table public.csv_import_records enable row level security;

revoke all on public.csv_import_runs from anon;
revoke all on public.csv_import_records from anon;
grant select, insert, update, delete on public.csv_import_runs to authenticated;
grant select, insert, update, delete on public.csv_import_records to authenticated;

drop policy if exists "Authenticated users read CSV import runs" on public.csv_import_runs;
create policy "Authenticated users read CSV import runs"
on public.csv_import_runs for select to authenticated
using (true);

drop policy if exists "Administrators create CSV import runs" on public.csv_import_runs;
create policy "Administrators create CSV import runs"
on public.csv_import_runs for insert to authenticated
with check ((select public.current_user_is_admin()) and imported_by = (select auth.uid()));

drop policy if exists "Administrators update CSV import runs" on public.csv_import_runs;
create policy "Administrators update CSV import runs"
on public.csv_import_runs for update to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()) and imported_by = (select auth.uid()));

drop policy if exists "Administrators delete CSV import runs" on public.csv_import_runs;
create policy "Administrators delete CSV import runs"
on public.csv_import_runs for delete to authenticated
using ((select public.current_user_is_admin()));

drop policy if exists "Authenticated users read CSV import records" on public.csv_import_records;
create policy "Authenticated users read CSV import records"
on public.csv_import_records for select to authenticated
using (true);

drop policy if exists "Administrators create CSV import records" on public.csv_import_records;
create policy "Administrators create CSV import records"
on public.csv_import_records for insert to authenticated
with check ((select public.current_user_is_admin()) and imported_by = (select auth.uid()));

drop policy if exists "Administrators update CSV import records" on public.csv_import_records;
create policy "Administrators update CSV import records"
on public.csv_import_records for update to authenticated
using ((select public.current_user_is_admin()))
with check ((select public.current_user_is_admin()) and imported_by = (select auth.uid()));

drop policy if exists "Administrators delete CSV import records" on public.csv_import_records;
create policy "Administrators delete CSV import records"
on public.csv_import_records for delete to authenticated
using ((select public.current_user_is_admin()));
