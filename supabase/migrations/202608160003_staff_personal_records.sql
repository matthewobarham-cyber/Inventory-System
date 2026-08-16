-- Staff-facing personal pages must be private at the database boundary, not
-- merely filtered in React. Staff can read only their own requests, completed
-- loan history, and audit evidence.

drop policy if exists "Active users read the shared workspace" on public.workspace_records;
create policy "Active users read the shared workspace"
on public.workspace_records for select to authenticated
using (
  (select public.current_workspace_role()) is not null
  and (
    (select public.current_workspace_role()) <> 'Staff'
    or (
      entity_type = 'requests'
      and lower(coalesce(payload ->> 'byEmail', '')) = lower(coalesce((
        select email from public.profiles where id = (select auth.uid())
      ), ''))
    )
    or (
      entity_type = 'history'
      and (
        lower(coalesce(payload ->> 'borrowerEmail', '')) = lower(coalesce((
          select email from public.profiles where id = (select auth.uid())
        ), ''))
        or (
          coalesce(payload ->> 'borrowerEmail', '') = ''
          and lower(coalesce(payload ->> 'borrower', '')) = lower(coalesce((
            select name from public.profiles where id = (select auth.uid())
          ), ''))
        )
      )
    )
    or (
      entity_type = 'audit_log'
      and lower(coalesce(payload ->> 'byEmail', '')) = lower(coalesce((
        select email from public.profiles where id = (select auth.uid())
      ), ''))
    )
    or (
      entity_type not in ('requests', 'history', 'audit_log', 'consumable_usage')
      and (
        entity_type <> 'items'
        or lower(coalesce(payload ->> 'consumable', 'false')) not in ('true', '1')
        or (select public.staff_can_access_consumables())
      )
    )
    or (
      entity_type = 'consumable_usage'
      and (select public.staff_can_access_consumables())
    )
  )
);
