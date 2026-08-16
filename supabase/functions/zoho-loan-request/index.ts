import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
});

const clean = (value: unknown) => String(value ?? '').trim();
const escapeHtml = (value: unknown) => clean(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function environmentKey(name: string, legacyName: string) {
  const direct = Deno.env.get(legacyName);
  if (direct) return direct;
  try {
    const values = JSON.parse(Deno.env.get(name) || '{}');
    return values.default || Object.values(values)[0] || '';
  } catch {
    return '';
  }
}

async function responseBody(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

function zohoErrorMessage(payload: Record<string, unknown>, fallback: string) {
  const details = Array.isArray(payload.errors)
    ? payload.errors.map((entry) => {
      const error = (entry || {}) as Record<string, unknown>;
      const field = clean(error.fieldName).replace(/^\//, '') || 'request';
      const reason = clean(error.errorMessage || error.message || error.errorType) || 'invalid';
      return `${field}: ${reason}`;
    }).filter(Boolean).join('; ')
    : '';
  const summary = clean(payload.message || payload.errorCode || payload.error) || fallback;
  return details ? `${summary} (${details})` : summary;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication is required.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const publishableKey = environmentKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');
    const serviceKey = environmentKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !publishableKey || !serviceKey) throw new Error('Supabase function credentials are unavailable.');

    const callerClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } } });
    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: 'Your session is invalid or expired.' }, 401);

    const { requestId } = await request.json();
    const recordId = clean(requestId);
    if (!recordId) return json({ error: 'A borrowing request reference is required.' }, 400);
    console.info(JSON.stringify({ event: 'loan_request_received', requestId: recordId }));

    const [{ data: profile }, { data: row, error: rowError }] = await Promise.all([
      adminClient.from('profiles').select('email,name,role,active').eq('id', user.id).single(),
      adminClient.from('workspace_records').select('payload,sort_index').eq('workspace_id', 'msbm').eq('entity_type', 'requests').eq('record_id', recordId).single()
    ]);
    if (!profile?.active) return json({ error: 'This account is not active.' }, 403);
    if (rowError || !row?.payload) return json({ error: 'The borrowing request was not found.' }, 404);

    const loanRequest = row.payload as Record<string, unknown>;
    const ownerEmail = clean(loanRequest.byEmail).toLowerCase();
    if (profile.role !== 'Admin' && ownerEmail !== clean(profile.email).toLowerCase()) {
      return json({ error: 'You may only submit your own borrowing request.' }, 403);
    }
    if (loanRequest.type === 'Requisition') return json({ error: 'Purchase requisitions do not use the loan helpdesk workflow.' }, 400);
    if (clean(loanRequest.helpdeskTicketId)) {
      console.info(JSON.stringify({ event: 'zoho_duplicate_prevented', requestId: recordId, ticketNumber: clean(loanRequest.helpdeskTicketNumber) }));
      return json({ ticketCreated: true, duplicatePrevented: true, request: loanRequest });
    }

    const { data: itemRow } = await adminClient.from('workspace_records')
      .select('payload').eq('workspace_id', 'msbm').eq('entity_type', 'items')
      .eq('record_id', clean(loanRequest.itemId)).maybeSingle();
    const item = (itemRow?.payload || {}) as Record<string, unknown>;
    const now = new Date().toISOString();

    const updateRequest = async (changes: Record<string, unknown>) => {
      const payload = { ...loanRequest, ...changes };
      const { error } = await adminClient.from('workspace_records').update({
        payload, updated_by: user.id, updated_at: new Date().toISOString()
      }).eq('workspace_id', 'msbm').eq('entity_type', 'requests').eq('record_id', recordId);
      if (error) throw error;
      return payload;
    };

    const requiredSecrets = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ORG_ID', 'ZOHO_DEPARTMENT_ID'];
    const missing = requiredSecrets.filter((name) => !Deno.env.get(name));
    if (missing.length) {
      const message = `Zoho Desk is not configured (${missing.join(', ')}).`;
      console.warn(JSON.stringify({ event: 'zoho_configuration_missing', requestId: recordId, missing }));
      const payload = await updateRequest({ helpdeskStatus: 'Failed', helpdeskError: message, helpdeskLastAttemptAt: now });
      return json({ ticketCreated: false, warning: message, request: payload });
    }

    try {
      await updateRequest({ helpdeskStatus: 'Sending', helpdeskError: '', helpdeskLastAttemptAt: now });
      const accountsUrl = clean(Deno.env.get('ZOHO_ACCOUNTS_URL')) || 'https://accounts.zoho.com';
      const deskUrl = clean(Deno.env.get('ZOHO_DESK_URL')) || 'https://desk.zoho.com';
      const tokenForm = new URLSearchParams({
        refresh_token: Deno.env.get('ZOHO_REFRESH_TOKEN')!,
        client_id: Deno.env.get('ZOHO_CLIENT_ID')!,
        client_secret: Deno.env.get('ZOHO_CLIENT_SECRET')!,
        grant_type: 'refresh_token'
      });
      const tokenResponse = await fetch(`${accountsUrl.replace(/\/$/, '')}/oauth/v2/token`, { method: 'POST', body: tokenForm });
      const tokenData = await responseBody(tokenResponse) as Record<string, unknown>;
      if (!tokenResponse.ok || !clean(tokenData.access_token)) {
        throw new Error(`Zoho authorization failed: ${clean(tokenData.error || tokenData.message) || tokenResponse.statusText}`);
      }

      const requesterName = clean(loanRequest.by || profile.name) || 'MSBM staff member';
      const requesterEmail = ownerEmail || clean(profile.email);
      const requesterNameParts = requesterName.split(/\s+/).filter(Boolean);
      const requesterLastName = requesterNameParts.pop() || 'MSBM staff member';
      const requesterFirstName = requesterNameParts.join(' ');
      const itemName = clean(loanRequest.itemName || item.name) || 'Inventory item';
      const itemTag = clean(loanRequest.itemTag || item.tag) || 'Not recorded';
      const detailRows = [
        ['Requester', requesterName], ['Requester email', requesterEmail],
        ['Inventory item', itemName], ['Asset tag', itemTag],
        ['Model', clean(item.modelNumber || item.model) || 'Not recorded'],
        ['Location', [clean(item.location), clean(item.room)].filter(Boolean).join(' · ') || 'Not recorded'],
        ['Current status', clean(item.status || loanRequest.statusSnapshot) || 'Not recorded'],
        ['Reason / need', clean(loanRequest.need) || 'Borrowing request'],
        ['Inventory request', recordId], ['Submitted', clean(loanRequest.submittedOn || loanRequest.when) || now]
      ];
      const description = `<h2>MSBM equipment borrowing request</h2><p>A staff member submitted this request through the MSBM IT Inventory System.</p><table>${detailRows.map(([label, value]) => `<tr><th style="text-align:left;padding:5px 14px 5px 0">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table><p>Please review availability, borrowing eligibility, and collection arrangements in the inventory system.</p>`;
      const ticketResponse = await fetch(`${deskUrl.replace(/\/$/, '')}/api/v1/tickets`, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${clean(tokenData.access_token)}`,
          orgId: Deno.env.get('ZOHO_ORG_ID')!,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: `[Equipment loan] ${itemName} — ${requesterName}`,
          departmentId: Deno.env.get('ZOHO_DEPARTMENT_ID'),
          email: requesterEmail,
          contact: {
            email: requesterEmail,
            firstName: requesterFirstName || undefined,
            lastName: requesterLastName
          },
          description,
          status: clean(Deno.env.get('ZOHO_TICKET_STATUS')) || 'Open',
          priority: clean(Deno.env.get('ZOHO_TICKET_PRIORITY')) || 'Medium',
          channel: clean(Deno.env.get('ZOHO_TICKET_CHANNEL')) || 'Web'
        })
      });
      const ticket = await responseBody(ticketResponse) as Record<string, unknown>;
      if (!ticketResponse.ok || !clean(ticket.id)) {
        throw new Error(`Zoho ticket creation failed: ${zohoErrorMessage(ticket, ticketResponse.statusText)}`);
      }

      const urlTemplate = clean(Deno.env.get('ZOHO_TICKET_URL_TEMPLATE'));
      const ticketId = clean(ticket.id);
      const ticketNumber = clean(ticket.ticketNumber) || ticketId;
      const ticketUrl = urlTemplate ? urlTemplate.replaceAll('{ticketId}', encodeURIComponent(ticketId)).replaceAll('{ticketNumber}', encodeURIComponent(ticketNumber)) : '';
      const payload = await updateRequest({
        helpdeskStatus: 'Created', helpdeskTicketId: ticketId, helpdeskTicketNumber: ticketNumber,
        helpdeskTicketUrl: ticketUrl, helpdeskCreatedAt: now, helpdeskError: ''
      });
      console.info(JSON.stringify({ event: 'zoho_ticket_created', requestId: recordId, ticketNumber }));
      return json({ ticketCreated: true, ticketId, ticketNumber, ticketUrl, request: payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Zoho Desk could not create the ticket.';
      console.error(JSON.stringify({ event: 'zoho_ticket_failed', requestId: recordId, message }));
      const payload = await updateRequest({ helpdeskStatus: 'Failed', helpdeskError: message, helpdeskLastAttemptAt: now });
      return json({ ticketCreated: false, warning: message, request: payload });
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'zoho_function_failed', message: error instanceof Error ? error.message : String(error) }));
    return json({ error: error instanceof Error ? error.message : 'Unable to create the Zoho Desk ticket.' }, 400);
  }
});
