const OUTLOOK_COMPOSE_URL = 'https://outlook.office.com/mail/0/deeplink/compose';
const SAFE_EXTERNAL_URL_LENGTH = 1800;

const outlookUrl = ({ to, cc, subject, body }) => {
  const params = new URLSearchParams({ to, subject });
  if (cc) params.set('cc', cc);
  if (body) params.set('body', body);
  return `${OUTLOOK_COMPOSE_URL}?${params.toString().replace(/\+/g, '%20')}`;
};

const copyText = async (text) => {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.cssText = 'position:fixed;left:-10000px;top:-10000px;opacity:0';
    document.body.appendChild(input);
    input.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* clipboard unavailable */ }
    input.remove();
    return copied;
  }
};

export async function openOutlookCompose(draft) {
  const normalized = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, String(value || '').trim()]));
  let url = outlookUrl(normalized);
  let bodyCopied = false;

  // Windows external URL handlers and Outlook's authentication redirects can
  // truncate a detailed message. Keep the compose route short and preserve the
  // full body on the clipboard when the encoded URL is too large to be safe.
  if (url.length > SAFE_EXTERNAL_URL_LENGTH && normalized.body) {
    bodyCopied = await copyText(normalized.body);
    if (bodyCopied) url = outlookUrl({ ...normalized, body: '' });
  }

  if (window.api?.openExternal) {
    const result = await window.api.openExternal(url);
    return { ...result, bodyCopied };
  }
  const opened = window.open(url, '_blank');
  if (opened) opened.opener = null;
  return opened ? { ok: true, bodyCopied } : { ok: false, bodyCopied, error: 'The browser blocked the Outlook window. Allow pop-ups and try again.' };
}
