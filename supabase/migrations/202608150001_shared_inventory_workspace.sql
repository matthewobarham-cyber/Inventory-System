-- Shared operational inventory state. Each application entity remains an
-- independently addressable row so concurrent edits to unrelated records do
-- not overwrite one giant JSON document.

create table if not exists public.workspace_records (
  workspace_id text not null default 'msbm',
  entity_type text not null check (entity_type in (
    'items', 'history', 'requests', 'orders', 'placements', 'stocktakes',
    'repair_tickets', 'maintenance_schedules', 'lifecycle_actions',
    'procurement_records', 'import_runs', 'audit_log', 'reserved_barcodes',
    'approved_vendors', 'approval_contacts', 'maintenance_contacts',
    'loan_contacts', 'consumable_usage', 'nav_overrides',
    'borrow_category_access'
  )),
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  sort_index bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  primary key (workspace_id, entity_type, record_id)
);

create table if not exists public.workspace_registry (
  workspace_id text primary key,
  initialized boolean not null default false,
  initialized_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create index if not exists workspace_records_entity_idx
  on public.workspace_records(workspace_id, entity_type, sort_index);
create index if not exists workspace_records_updated_idx
  on public.workspace_records(updated_at desc);
alter table public.workspace_records replica identity full;
alter table public.workspace_records enable row level security;
alter table public.workspace_registry enable row level security;

create or replace function public.stamp_workspace_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = (select auth.uid());
  return new;
end;
$$;

drop trigger if exists stamp_workspace_record on public.workspace_records;
create trigger stamp_workspace_record
before insert or update on public.workspace_records
for each row execute function public.stamp_workspace_record();

revoke all on public.workspace_records from anon;
grant select, insert, update, delete on public.workspace_records to authenticated;
revoke all on public.workspace_registry from anon;
grant select, insert, update on public.workspace_registry to authenticated;

create or replace function public.current_workspace_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid()) and active = true
  limit 1;
$$;

revoke all on function public.current_workspace_role() from public;
grant execute on function public.current_workspace_role() to authenticated;

create or replace function public.can_write_workspace_record(
  requested_entity_type text,
  requested_payload jsonb
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and active = true
    ) then false
    when (select public.current_workspace_role()) = 'Admin' then true
    when (select public.current_workspace_role()) = 'Student assistant' then
      (
        requested_entity_type not in ('nav_overrides', 'borrow_category_access', 'audit_log')
        or (
          requested_entity_type = 'audit_log'
          and lower(coalesce(requested_payload ->> 'byEmail', '')) = lower(coalesce((
            select email from public.profiles where id = (select auth.uid())
          ), ''))
        )
      )
    when (select public.current_workspace_role()) = 'Staff' then
      requested_entity_type in ('requests', 'audit_log')
      and lower(coalesce(requested_payload ->> 'byEmail', '')) = lower(coalesce((
        select email from public.profiles where id = (select auth.uid())
      ), ''))
    else false
  end;
$$;

revoke all on function public.can_write_workspace_record(text, jsonb) from public;
grant execute on function public.can_write_workspace_record(text, jsonb) to authenticated;

drop policy if exists "Active users read the shared workspace" on public.workspace_records;
create policy "Active users read the shared workspace"
on public.workspace_records for select to authenticated
using ((select public.current_workspace_role()) is not null);

drop policy if exists "Authorized users create workspace records" on public.workspace_records;
create policy "Authorized users create workspace records"
on public.workspace_records for insert to authenticated
with check (
  workspace_id = 'msbm'
  and updated_by = (select auth.uid())
  and (select public.can_write_workspace_record(entity_type, payload))
);

drop policy if exists "Authorized users update workspace records" on public.workspace_records;
create policy "Authorized users update workspace records"
on public.workspace_records for update to authenticated
using (
  (select public.can_write_workspace_record(entity_type, payload))
  and (entity_type <> 'audit_log' or (select public.current_workspace_role()) = 'Admin')
)
with check (
  workspace_id = 'msbm'
  and updated_by = (select auth.uid())
  and (select public.can_write_workspace_record(entity_type, payload))
  and (entity_type <> 'audit_log' or (select public.current_workspace_role()) = 'Admin')
);

drop policy if exists "Managers delete workspace records" on public.workspace_records;
create policy "Managers delete workspace records"
on public.workspace_records for delete to authenticated
using (
  (select public.current_workspace_role()) = 'Admin'
  or (
    (select public.current_workspace_role()) = 'Student assistant'
    and entity_type not in ('nav_overrides', 'borrow_category_access', 'audit_log')
  )
);

drop policy if exists "Active users read workspace initialization" on public.workspace_registry;
create policy "Active users read workspace initialization"
on public.workspace_registry for select to authenticated
using ((select public.current_workspace_role()) is not null);

drop policy if exists "Administrators initialize workspaces" on public.workspace_registry;
create policy "Administrators initialize workspaces"
on public.workspace_registry for insert to authenticated
with check (
  workspace_id = 'msbm'
  and updated_by = (select auth.uid())
  and (select public.current_workspace_role()) = 'Admin'
);

drop policy if exists "Administrators update workspace initialization" on public.workspace_registry;
create policy "Administrators update workspace initialization"
on public.workspace_registry for update to authenticated
using ((select public.current_workspace_role()) = 'Admin')
with check (
  workspace_id = 'msbm'
  and updated_by = (select auth.uid())
  and (select public.current_workspace_role()) = 'Admin'
);

-- Private documents attached to disposal workflows.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-attachments',
  'workspace-attachments',
  false,
  20971520,
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Active users read workspace attachments" on storage.objects;
create policy "Active users read workspace attachments"
on storage.objects for select to authenticated
using (
  bucket_id = 'workspace-attachments'
  and (select public.current_workspace_role()) is not null
);

drop policy if exists "Operational users upload workspace attachments" on storage.objects;
create policy "Operational users upload workspace attachments"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'workspace-attachments'
  and (select public.current_workspace_role()) in ('Admin', 'Student assistant')
);

drop policy if exists "Operational users update workspace attachments" on storage.objects;
create policy "Operational users update workspace attachments"
on storage.objects for update to authenticated
using (
  bucket_id = 'workspace-attachments'
  and (select public.current_workspace_role()) in ('Admin', 'Student assistant')
)
with check (
  bucket_id = 'workspace-attachments'
  and (select public.current_workspace_role()) in ('Admin', 'Student assistant')
);

drop policy if exists "Operational users delete workspace attachments" on storage.objects;
create policy "Operational users delete workspace attachments"
on storage.objects for delete to authenticated
using (
  bucket_id = 'workspace-attachments'
  and (select public.current_workspace_role()) in ('Admin', 'Student assistant')
);

-- Postgres Changes is used for lightweight cross-device invalidation. The
-- client reloads canonical rows after a remote commit.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_records'
  ) then
    alter publication supabase_realtime add table public.workspace_records;
  end if;
end $$;
