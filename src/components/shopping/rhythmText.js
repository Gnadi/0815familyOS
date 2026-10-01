import { daysBetween } from '../../utils/consumption';

// "every ~3 days · last bought yesterday" for a prediction from
// utils/consumption.js. Either half is left out when unknown.
export function rhythmText(prediction, { t, tn }, now = new Date()) {
  const parts = [];
  if (prediction?.intervalDays) {
    parts.push(tn('shopping.rhythm', Math.max(1, Math.round(prediction.intervalDays))));
  }
  if (prediction?.lastBought) {
    const days = daysBetween(prediction.lastBought, now);
    if (days <= 0) parts.push(t('shopping.lastToday'));
    else if (days === 1) parts.push(t('shopping.lastYesterday'));
    else parts.push(t('shopping.lastDaysAgo', { count: days }));
  }
  return parts.join(' · ');
}
