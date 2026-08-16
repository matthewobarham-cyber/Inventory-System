-- Mark requests stranded by the former service-role stamping bug as retryable.
-- No inventory request is deleted and no Zoho ticket reference is overwritten.

update public.workspace_records
set payload = payload || jsonb_build_object(
      'helpdeskStatus', 'Failed',
      'helpdeskError', 'Previous Zoho delivery was interrupted before completion. Use Retry Zoho.'
    ),
    updated_at = now()
where workspace_id = 'msbm'
  and entity_type = 'requests'
  and payload ->> 'helpdeskStatus' = 'Sending'
  and coalesce(payload ->> 'helpdeskTicketId', '') = ''
  and updated_at < now() - interval '30 seconds';
