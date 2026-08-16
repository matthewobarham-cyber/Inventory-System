-- Staff may submit new requests and audit evidence, but completed rows are
-- immutable from the public client. Administrative decisions are performed by
-- Admin/Student assistant accounts and then delivered to Staff through
-- Realtime. This prevents a stale Staff renderer from overwriting a decision.

drop policy if exists "Authorized users update workspace records" on public.workspace_records;
create policy "Authorized users update workspace records"
on public.workspace_records for update to authenticated
using (
  (select public.current_workspace_role()) in ('Admin', 'Student assistant')
  and (select public.can_write_workspace_record(entity_type, payload))
  and (entity_type <> 'audit_log' or (select public.current_workspace_role()) = 'Admin')
)
with check (
  workspace_id = 'msbm'
  and updated_by = (select auth.uid())
  and (select public.current_workspace_role()) in ('Admin', 'Student assistant')
  and (select public.can_write_workspace_record(entity_type, payload))
  and (entity_type <> 'audit_log' or (select public.current_workspace_role()) = 'Admin')
);
