const ISSUE_STATES = new Set(['Missing', 'Wrong location', 'Quantity mismatch']);

export default function StocktakeFlag({ item, label = false }) {
  const state = item?.stocktakeState;
  if (!ISSUE_STATES.has(state)) return null;
  const missing = state === 'Missing';
  const text = missing ? 'Missing from stocktake' : state === 'Wrong location' ? 'Incorrectly placed' : 'Stocktake quantity mismatch';
  const detail = [text, item.stocktakeSessionTitle, item.stocktakeNote].filter(Boolean).join(' · ');
  return <span className={`stocktake-global-flag ${missing ? 'missing' : 'warning'}${label ? ' labelled' : ''}`} title={detail} aria-label={detail}><b>!</b>{label && <span>{text}</span>}</span>;
}
