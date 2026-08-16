-- Staff access is deny-by-default. The renderer also excludes this page from
-- Staff navigation, while this function prevents direct API access to the
-- underlying consumable records.

create or replace function public.staff_can_access_consumables()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select false; $$;

revoke all on function public.staff_can_access_consumables() from public;
grant execute on function public.staff_can_access_consumables() to authenticated;
