-- Browser writes are always stamped with auth.uid(). Trusted service-role
-- Edge Functions have no auth.uid(), so preserve the verified caller UUID
-- supplied by the function instead of replacing it with NULL.

create or replace function public.stamp_workspace_record()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = coalesce((select auth.uid()), new.updated_by, old.updated_by);
  return new;
end;
$$;
