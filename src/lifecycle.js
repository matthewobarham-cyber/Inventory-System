export function expectedReplacementFor(item) {
  if (item.expectedReplacementDate) return item.expectedReplacementDate;
  const purchased = new Date(item.purchased || Date.now());
  if (Number.isNaN(purchased.getTime())) return '';
  purchased.setFullYear(purchased.getFullYear() + Math.max(1, Number(item.usefulLifeYears) || 5));
  return purchased.toISOString().slice(0, 10);
}

export function bookValueFor(item, at = new Date()) {
  const cost = Math.max(0, Number(item.cost) || 0);
  if ((item.depreciationMethod || 'Straight-line') === 'None') return cost;
  const salvage = Math.min(cost, Math.max(0, Number(item.salvageValue) || 0));
  const purchased = new Date(item.purchased || at);
  if (Number.isNaN(purchased.getTime())) return cost;
  const life = Math.max(1, Number(item.usefulLifeYears) || 5);
  const elapsedYears = Math.max(0, (at.getTime() - purchased.getTime()) / 31557600000);
  return Math.max(salvage, cost - ((cost - salvage) / life) * elapsedYears);
}

export function lifecycleFlags(item, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const within90 = new Date(now.getTime() + 90 * 864e5).toISOString().slice(0, 10);
  const replacement = expectedReplacementFor(item);
  return {
    replacement,
    replacementDue: !!replacement && replacement <= today,
    replacementSoon: !!replacement && replacement > today && replacement <= within90,
    warrantyExpired: !!item.warranty && item.warranty < today,
    warrantySoon: !!item.warranty && item.warranty >= today && item.warranty <= within90
  };
}
