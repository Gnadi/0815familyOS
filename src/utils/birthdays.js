const DAY = 24 * 60 * 60 * 1000;

/**
 * When someone's next birthday falls, and what age it makes them.
 *
 * Extracted from UpcomingBirthdays so the reminder centre can reuse it rather
 * than grow a second copy of the same date arithmetic — there were already three
 * widgets each computing their own idea of "due soon", which is what the
 * reminders hook exists to consolidate.
 *
 * `birthdayISO` is the `YYYY-MM-DD` string stored on kids and gift recipients.
 * Comparison is day-granular on purpose: a birthday today is 0 days away all
 * day, not "already passed" from one minute after midnight.
 *
 * @returns {{ next: Date, turning: number, daysUntil: number }|null}
 */
export function nextBirthday(birthdayISO, today = new Date()) {
  if (!birthdayISO) return null;
  const [y, m, d] = String(birthdayISO).split('-').map(Number);
  if (!y || !m || !d) return null;
  const thisYear = new Date(today.getFullYear(), m - 1, d);
  const cmp = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const next = thisYear < cmp ? new Date(today.getFullYear() + 1, m - 1, d) : thisYear;
  return {
    next,
    turning: next.getFullYear() - y,
    daysUntil: Math.round((next - cmp) / DAY),
  };
}

/**
 * Everyone in the family with a birthday on file, nearest first.
 *
 * Gift recipients — grandparents, godparents — carry a birthday too; it is the
 * whole reason one is stored, so they belong on this list next to the kids. Ids
 * are prefixed per list (kid_… / recip_…), so they never collide.
 */
export function upcomingBirthdays(family, { withinDays = 60, today = new Date() } = {}) {
  const people = [...(family?.kids || []), ...(family?.giftRecipients || [])];
  return people
    .map((person) => ({ person, info: nextBirthday(person.birthday, today) }))
    .filter((row) => row.info && row.info.daysUntil <= withinDays)
    .sort((a, b) => a.info.daysUntil - b.info.daysUntil);
}
