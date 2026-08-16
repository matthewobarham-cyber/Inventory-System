-- Keep Page Access authoritative at the data layer. When Consumables is
-- removed from Staff, Staff sessions cannot read consumable inventory or its
-- usage ledger through the generated API, even if they bypass the renderer.

create or replace function public.staff_can_access_consumables()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select coalesce(payload -> 'Staff', '[]'::jsonb) ? 'consumables'
    from public.workspace_records
    where workspace_id = 'msbm'
      and entity_type = 'nav_overrides'
      and record_id = 'current'
    limit 1
  ), true);
$$;

revoke all on function public.staff_can_access_consumables() from public;
grant execute on function public.staff_can_access_consumables() to authenticated;

drop policy if exists "Active users read the shared workspace" on public.workspace_records;
create policy "Active users read the shared workspace"
on public.workspace_records for select to authenticated
using (
  (select public.current_workspace_role()) is not null
  and (
    (select public.current_workspace_role()) <> 'Staff'
    or entity_type not in ('items', 'consumable_usage')
    or (
      entity_type = 'items'
      and lower(coalesce(payload ->> 'consumable', 'false')) not in ('true', '1')
    )
    or (select public.staff_can_access_consumables())
  )
);
