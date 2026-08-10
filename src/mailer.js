export async function sendHelpdeskMail(subject, body) {
  if (!window.api?.sendMail) { console.warn('Helpdesk email skipped: Electron mail bridge is unavailable.'); return { ok: false, skipped: true }; }
  try {
    const result = await window.api.sendMail({ to: 'helpdesk@msbm-uwi.org', subject, body });
    if (!result?.ok) console.warn('Helpdesk email failed:', result?.error || 'Unknown mail error');
    return result;
  } catch (error) { console.warn('Helpdesk email failed:', error); return { ok: false, error: error.message }; }
}
