const outlookUrl = ({ to, cc, subject, body }) => {
  const params = new URLSearchParams({ to, subject });
  if (cc) params.set('cc', cc);
  if (body) params.set('body', body);
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString().replace(/\+/g, '%20')}`;
};

export async function openOutlookCompose(draft) {
  const normalized = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, String(value || '').trim()]));
  const url = outlookUrl(normalized);
  if (window.api?.openExternal) return window.api.openExternal(url);
  const opened = window.open(url, '_blank');
  if (opened) opened.opener = null;
  return opened ? { ok: true, bodyCopied: false } : { ok: false, error: 'The browser blocked the Outlook window. Allow pop-ups and try again.' };
}
