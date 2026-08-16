import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

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

const pdfText = (value: unknown) => clean(value).normalize('NFKD').replace(/[^\x20-\x7E]/g, ' ');

function wrappedLines(text: unknown, maxCharacters = 72) {
  const words = pdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxCharacters && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines.length ? lines : ['Not recorded'];
}

async function fetchBrandPng(filename: string) {
  const baseUrl = clean(Deno.env.get('MSBM_BRAND_BASE_URL')) || 'https://inventory-system-neon-two.vercel.app/brand';
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${filename}`);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function createLoanRequestPdf(details: Array<[string, unknown]>, ticketNumber: string, requestId: string) {
  const document = await PDFDocument.create();
  document.setTitle(`MSBM equipment borrowing agreement ${requestId}`);
  document.setAuthor('Mona School of Business & Management');
  document.setSubject('Equipment borrowing request and electronic signature agreement');
  const page = document.addPage([595.28, 841.89]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const mono = await document.embedFont(StandardFonts.Courier);
  const [lockupBytes, crestBytes] = await Promise.all([fetchBrandPng('msbm-lockup.png'), fetchBrandPng('msbm-crest.png')]);
  const lockup = lockupBytes ? await document.embedPng(lockupBytes) : null;
  const crest = crestBytes ? await document.embedPng(crestBytes) : null;
  const form = document.getForm();
  const values = new Map(details.map(([label, value]) => [label, pdfText(value)]));
  const navy = rgb(0.045, 0.20, 0.31);
  const blue = rgb(0.03, 0.31, 0.55);
  const red = rgb(0.74, 0.08, 0.12);
  const ink = rgb(0.10, 0.15, 0.19);
  const muted = rgb(0.38, 0.45, 0.50);
  const pale = rgb(0.965, 0.976, 0.984);
  const line = rgb(0.81, 0.85, 0.88);

  if (crest) page.drawImage(crest, { x: 211, y: 277, width: 110, height: 151, opacity: 0.045 });
  else page.drawText('MSBM', { x: 117, y: 305, size: 112, font: bold, color: navy, opacity: 0.035 });
  page.drawRectangle({ x: 0, y: 738, width: 595.28, height: 103.89, color: navy });
  page.drawRectangle({ x: 0, y: 738, width: 8, height: 103.89, color: red });
  page.drawRectangle({ x: 34, y: 761, width: 76, height: 56, color: rgb(1, 1, 1), borderColor: rgb(0.78, 0.84, 0.88), borderWidth: 0.8 });
  if (lockup) page.drawImage(lockup, { x: 37, y: 770, width: 70, height: 36.4 });
  else {
    page.drawText('MSBM', { x: 45, y: 786, size: 20, font: bold, color: blue });
    page.drawText('UWI MONA', { x: 49, y: 774, size: 7, font: bold, color: red });
  }
  page.drawText('MONA SCHOOL OF BUSINESS & MANAGEMENT', { x: 126, y: 805, size: 8.2, font: bold, color: rgb(0.58, 0.82, 0.88) });
  page.drawText('EQUIPMENT BORROWING AGREEMENT', { x: 126, y: 779, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText('REQUEST ACKNOWLEDGEMENT & E-SIGNATURE FORM', { x: 126, y: 762, size: 8, font: regular, color: rgb(0.78, 0.87, 0.91) });
  page.drawText(`ZOHO #${pdfText(ticketNumber)}`, { x: 468, y: 808, size: 8.5, font: bold, color: rgb(1, 1, 1), maxWidth: 89 });
  page.drawText(pdfText(requestId), { x: 452, y: 793, size: 7.5, font: mono, color: rgb(0.72, 0.84, 0.89), maxWidth: 105 });

  page.drawRectangle({ x: 38, y: 687, width: 519, height: 31, color: pale, borderColor: line, borderWidth: 0.7 });
  page.drawText('REQUEST RECEIVED', { x: 51, y: 706, size: 7.4, font: bold, color: blue });
  page.drawText('Pending IT review — this form does not authorize collection until approved.', { x: 51, y: 694, size: 8.2, font: regular, color: ink });

  page.drawText(values.get('Requested equipment') || 'Inventory item', { x: 38, y: 654, size: 17, font: bold, color: ink });
  page.drawText(`${values.get('Asset tag') || 'Asset tag not recorded'}  |  ${values.get('Model') || 'Model not recorded'}`, { x: 38, y: 638, size: 8.5, font: mono, color: blue });
  page.drawLine({ start: { x: 38, y: 626 }, end: { x: 557, y: 626 }, thickness: 1.5, color: blue });

  const fieldRows: Array<[string, string, string, string]> = [
    ['Borrower', values.get('Requester') || 'Not recorded', 'Requester email', values.get('Requester email') || 'Not recorded'],
    ['Submitted', values.get('Submitted') || 'Not recorded', 'Request status', values.get('Request status') || 'Pending review'],
    ['Location of record', values.get('Location') || 'Not recorded', 'Inventory request', requestId],
    ['Reason / need', values.get('Request purpose') || 'Borrowing request', 'Condition at request', values.get('Current status') || 'Not recorded']
  ];
  fieldRows.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (columnIndex % 2) return;
      const x = columnIndex === 0 ? 38 : 303;
      const y = 576 - rowIndex * 50;
      page.drawRectangle({ x, y, width: 254, height: 39, color: pale, borderColor: line, borderWidth: 0.55 });
      page.drawText(row[columnIndex].toUpperCase(), { x: x + 11, y: y + 25, size: 6.8, font: bold, color: muted });
      const display = wrappedLines(row[columnIndex + 1], 40)[0];
      page.drawText(display, { x: x + 11, y: y + 10, size: 9, font: regular, color: ink, maxWidth: 232 });
    });
  });

  page.drawText('BORROWER RESPONSIBILITIES', { x: 38, y: 396, size: 9, font: bold, color: ink });
  const responsibilities = [
    'I accept responsibility for this equipment while it is issued to me.',
    'I will protect it from loss, theft, damage, and unauthorized use.',
    'I will not transfer it to another person and will return all accessories by the agreed date.',
    'I understand that the equipment remains the property of The University of the West Indies.'
  ];
  responsibilities.forEach((text, index) => {
    page.drawCircle({ x: 44, y: 376 - index * 18, size: 2.2, color: blue });
    page.drawText(text, { x: 53, y: 372.5 - index * 18, size: 8.1, font: regular, color: ink });
  });

  page.drawLine({ start: { x: 38, y: 299 }, end: { x: 557, y: 299 }, thickness: 0.8, color: line });
  page.drawText('ELECTRONIC SIGNATURES', { x: 38, y: 279, size: 9, font: bold, color: ink });
  page.drawText('Type your full name in the applicable field. The completed document may be saved and returned electronically.', { x: 38, y: 265, size: 7.6, font: regular, color: muted });

  const addSignatureField = (name: string, label: string, x: number) => {
    page.drawText(label, { x, y: 239, size: 7.1, font: bold, color: muted });
    const field = form.createTextField(name);
    field.addToPage(page, { x, y: 193, width: 236, height: 38, font: regular, textColor: ink, backgroundColor: rgb(1, 1, 1), borderColor: line, borderWidth: 0.8 });
    page.drawText('Electronic signature / full legal name', { x: x + 8, y: 181, size: 6.6, font: regular, color: muted });
  };
  addSignatureField('borrower_esignature', 'BORROWER E-SIGNATURE', 38);
  addSignatureField('it_approval_esignature', 'IT SERVICES APPROVAL E-SIGNATURE', 303);

  page.drawText('DATE', { x: 38, y: 158, size: 7.1, font: bold, color: muted });
  const borrowerDate = form.createTextField('borrower_signature_date');
  borrowerDate.addToPage(page, { x: 38, y: 124, width: 120, height: 27, font: regular, textColor: ink, backgroundColor: pale, borderColor: line, borderWidth: 0.7 });
  page.drawText('DATE', { x: 303, y: 158, size: 7.1, font: bold, color: muted });
  const approvalDate = form.createTextField('it_approval_date');
  approvalDate.addToPage(page, { x: 303, y: 124, width: 120, height: 27, font: regular, textColor: ink, backgroundColor: pale, borderColor: line, borderWidth: 0.7 });

  page.drawRectangle({ x: 38, y: 69, width: 519, height: 38, color: navy });
  page.drawText('NEXT STEP', { x: 51, y: 92, size: 7, font: bold, color: rgb(0.50, 0.89, 0.84) });
  page.drawText('Retain this PDF and quote the request or Zoho ticket number when contacting MSBM IT Services.', { x: 51, y: 78, size: 7.9, font: regular, color: rgb(1, 1, 1) });
  page.drawText('MSBM IT Inventory System  |  The University of the West Indies, Mona', { x: 38, y: 38, size: 7, font: regular, color: muted });
  page.drawText(`Generated ${new Date().toISOString().slice(0, 10)}`, { x: 454, y: 38, size: 7, font: regular, color: muted, maxWidth: 103 });
  form.updateFieldAppearances(regular);
  return document.save();
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
    let requestPayload = { ...loanRequest };
    const ownerEmail = clean(loanRequest.byEmail).toLowerCase();
    if (profile.role !== 'Admin' && ownerEmail !== clean(profile.email).toLowerCase()) {
      return json({ error: 'You may only submit your own borrowing request.' }, 403);
    }
    if (loanRequest.type === 'Requisition') return json({ error: 'Purchase requisitions do not use the loan helpdesk workflow.' }, 400);
    const hasVerifiedPdfEmail = clean(loanRequest.helpdeskPdfAttachmentKind) === 'email-upload'
      && Number(loanRequest.helpdeskEmailAttachmentCount || 0) > 0;
    if (clean(loanRequest.helpdeskTicketId) && clean(loanRequest.helpdeskEmailStatus) === 'Sent' && hasVerifiedPdfEmail) {
      console.info(JSON.stringify({ event: 'zoho_duplicate_prevented', requestId: recordId, ticketNumber: clean(loanRequest.helpdeskTicketNumber) }));
      return json({ ticketCreated: true, emailSent: true, duplicatePrevented: true, request: loanRequest });
    }

    const { data: itemRow } = await adminClient.from('workspace_records')
      .select('payload').eq('workspace_id', 'msbm').eq('entity_type', 'items')
      .eq('record_id', clean(loanRequest.itemId)).maybeSingle();
    const item = (itemRow?.payload || {}) as Record<string, unknown>;
    const now = new Date().toISOString();

    const updateRequest = async (changes: Record<string, unknown>) => {
      const payload = { ...requestPayload, ...changes };
      const { error } = await adminClient.from('workspace_records').update({
        payload, updated_by: user.id, updated_at: new Date().toISOString()
      }).eq('workspace_id', 'msbm').eq('entity_type', 'requests').eq('record_id', recordId);
      if (error) throw error;
      requestPayload = payload;
      return payload;
    };

    const requiredSecrets = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'ZOHO_ORG_ID'];
    const missing = requiredSecrets.filter((name) => !Deno.env.get(name));
    const inventoryDepartmentId = clean(Deno.env.get('ZOHO_INVENTORY_DEPARTMENT_ID') || Deno.env.get('ZOHO_DEPARTMENT_ID'));
    if (!inventoryDepartmentId) missing.push('ZOHO_INVENTORY_DEPARTMENT_ID');
    if (missing.length) {
      const message = `Zoho Desk is not configured (${missing.join(', ')}).`;
      console.warn(JSON.stringify({ event: 'zoho_configuration_missing', requestId: recordId, missing }));
      const payload = await updateRequest({ helpdeskStatus: 'Failed', helpdeskError: message, helpdeskLastAttemptAt: now });
      return json({ ticketCreated: false, warning: message, request: payload });
    }

    let ticketId = clean(requestPayload.helpdeskTicketId);
    let ticketNumber = clean(requestPayload.helpdeskTicketNumber);
    let ticketUrl = clean(requestPayload.helpdeskTicketUrl);
    try {
      if (!ticketId) await updateRequest({ helpdeskStatus: 'Sending', helpdeskError: '', helpdeskLastAttemptAt: now });
      else await updateRequest({ helpdeskEmailStatus: 'Sending', helpdeskEmailError: '', helpdeskEmailLastAttemptAt: now });
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
      const zohoHeaders = {
        Authorization: `Zoho-oauthtoken ${clean(tokenData.access_token)}`,
        orgId: Deno.env.get('ZOHO_ORG_ID')!
      };

      if (!ticketId) {
        const ticketResponse = await fetch(`${deskUrl.replace(/\/$/, '')}/api/v1/tickets`, {
          method: 'POST',
          headers: { ...zohoHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: `[Equipment loan] ${itemName} — ${requesterName}`,
            departmentId: inventoryDepartmentId,
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
        ticketId = clean(ticket.id);
        ticketNumber = clean(ticket.ticketNumber) || ticketId;
        ticketUrl = urlTemplate ? urlTemplate.replaceAll('{ticketId}', encodeURIComponent(ticketId)).replaceAll('{ticketNumber}', encodeURIComponent(ticketNumber)) : '';
        await updateRequest({
          helpdeskStatus: 'Created', helpdeskTicketId: ticketId, helpdeskTicketNumber: ticketNumber,
          helpdeskTicketUrl: ticketUrl, helpdeskCreatedAt: now, helpdeskError: '', helpdeskEmailStatus: 'Sending',
          helpdeskEmailError: '', helpdeskEmailLastAttemptAt: now
        });
        console.info(JSON.stringify({ event: 'zoho_ticket_created', requestId: recordId, ticketNumber }));
      } else {
        console.info(JSON.stringify({ event: 'zoho_ticket_reused_for_email', requestId: recordId, ticketNumber }));
      }

      const fromEmail = clean(Deno.env.get('ZOHO_FROM_EMAIL'));
      if (!fromEmail) throw new Error('Zoho PDF email is not configured (ZOHO_FROM_EMAIL).');
      if (!requesterEmail || !requesterEmail.includes('@')) throw new Error('The requester does not have a valid email address.');

      const filename = `MSBM-loan-request-${pdfText(recordId).replace(/[^A-Za-z0-9_-]/g, '-')}.pdf`;
        const pdfDetails: Array<[string, unknown]> = [
          ['Requester', requesterName], ['Requester email', requesterEmail], ['Requested equipment', itemName],
          ['Asset tag', itemTag], ['Model', clean(item.modelNumber || item.model) || 'Not recorded'],
          ['Location', [clean(item.location), clean(item.room)].filter(Boolean).join(' - ') || 'Not recorded'],
          ['Request purpose', clean(loanRequest.need) || 'Borrowing request'], ['Request status', clean(loanRequest.state) || 'Pending review'],
          ['Current status', clean(item.status || loanRequest.statusSnapshot) || 'Not recorded'],
          ['Submitted', clean(loanRequest.submittedOn || loanRequest.when) || now]
        ];
      const pdfBytes = await createLoanRequestPdf(pdfDetails, ticketNumber, recordId);
      const uploadForm = new FormData();
      uploadForm.append('file', new Blob([pdfBytes], { type: 'application/pdf' }), filename);

      // sendReply accepts temporary IDs returned by /uploads. A permanent ticket
      // attachment ID is a different resource and Zoho silently omits it from mail.
      // Upload afresh for every retry because upload IDs can be consumed/expire.
      const uploadResponse = await fetch(`${deskUrl.replace(/\/$/, '')}/api/v1/uploads`, {
        method: 'POST', headers: zohoHeaders, body: uploadForm
      });
      const upload = await responseBody(uploadResponse) as Record<string, unknown>;
      const attachmentId = clean(upload.id);
      if (!uploadResponse.ok || !attachmentId) {
        const reason = zohoErrorMessage(upload, uploadResponse.statusText);
        const scopeHelp = uploadResponse.status === 401 || uploadResponse.status === 403
          ? ' Reauthorize Zoho with both Desk.tickets.ALL and Desk.basic.CREATE, then update ZOHO_REFRESH_TOKEN.'
          : '';
        throw new Error(`Zoho email attachment upload failed: ${reason}.${scopeHelp}`);
      }
      await updateRequest({
        helpdeskPdfAttachmentId: attachmentId,
        helpdeskPdfAttachmentKind: 'email-upload',
        helpdeskPdfFilename: filename
      });
      console.info(JSON.stringify({ event: 'zoho_email_pdf_uploaded', requestId: recordId, ticketNumber }));

      const emailContent = `<div style="font-family:Arial,sans-serif;color:#243540;line-height:1.55"><h2 style="color:#123f5c">Your MSBM equipment request was received</h2><p>Hello ${escapeHtml(requesterName)},</p><p>IT Services received your request for <strong>${escapeHtml(itemName)}</strong>${itemTag !== 'Not recorded' ? ` (${escapeHtml(itemTag)})` : ''}.</p><p>Your Zoho Desk reference is <strong>#${escapeHtml(ticketNumber)}</strong>. The attached PDF contains your request details. Please retain it for your records.</p><p>This message confirms receipt only; IT Services will contact you after reviewing availability and borrowing eligibility.</p><p>Regards,<br><strong>MSBM IT Services</strong><br>Mona School of Business &amp; Management</p></div>`;
      const replyResponse = await fetch(`${deskUrl.replace(/\/$/, '')}/api/v1/tickets/${encodeURIComponent(ticketId)}/sendReply?sendImmediately=true`, {
        method: 'POST',
        headers: { ...zohoHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'EMAIL', to: requesterEmail, fromEmailAddress: fromEmail, contentType: 'html',
          content: emailContent, isForward: false, attachmentIds: [attachmentId]
        })
      });
      const reply = await responseBody(replyResponse) as Record<string, unknown>;
      if (!replyResponse.ok) throw new Error(`Zoho PDF email failed: ${zohoErrorMessage(reply, replyResponse.statusText)}`);

      const replyAttachments = Array.isArray(reply.attachments) ? reply.attachments : [];
      const attachmentCount = Number(reply.attachmentCount || replyAttachments.length || 0);
      const replyStatus = clean(reply.status).toUpperCase();
      if (replyStatus === 'FAILED') throw new Error('Zoho accepted the reply request but reported that delivery failed.');
      if (!reply.hasAttach && attachmentCount < 1 && replyAttachments.length < 1) {
        throw new Error('Zoho created the email reply but omitted the PDF attachment. The message was not marked as successfully sent.');
      }

      const payload = await updateRequest({
        helpdeskStatus: 'Created', helpdeskEmailStatus: 'Sent', helpdeskEmailSentAt: new Date().toISOString(),
        helpdeskEmailThreadId: clean(reply.id), helpdeskEmailZohoStatus: replyStatus || 'SUCCESS',
        helpdeskEmailAttachmentCount: Math.max(attachmentCount, replyAttachments.length),
        helpdeskEmailError: '', helpdeskError: ''
      });
      console.info(JSON.stringify({ event: 'zoho_pdf_email_sent', requestId: recordId, ticketNumber }));
      return json({ ticketCreated: true, emailSent: true, ticketId, ticketNumber, ticketUrl, request: payload });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Zoho Desk could not create the ticket.';
      const ticketExists = !!ticketId;
      console.error(JSON.stringify({ event: ticketExists ? 'zoho_pdf_email_failed' : 'zoho_ticket_failed', requestId: recordId, ticketNumber, message }));
      const payload = ticketExists
        ? await updateRequest({ helpdeskStatus: 'Created', helpdeskEmailStatus: 'Failed', helpdeskEmailError: message, helpdeskEmailLastAttemptAt: now })
        : await updateRequest({ helpdeskStatus: 'Failed', helpdeskError: message, helpdeskLastAttemptAt: now });
      return json({ ticketCreated: ticketExists, emailSent: false, ticketId, ticketNumber, warning: message, request: payload });
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'zoho_function_failed', message: error instanceof Error ? error.message : String(error) }));
    return json({ error: error instanceof Error ? error.message : 'Unable to create the Zoho Desk ticket.' }, 400);
  }
});
