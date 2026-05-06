// Minimal ICS (iCalendar) builder. Produces a single VCALENDAR with one
// VEVENT per input event. Assumes events are date-only or have a JS Date in
// `event.date`. Output uses local-floating times (no TZID/UTC conversion) —
// most consumer calendars import them at the user's local time.

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmt(date) {
  return (
    date.getFullYear().toString() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    '00'
  );
}

function escape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function fold(line) {
  // RFC 5545 line folding at 75 octets — simple char-based approximation.
  if (line.length <= 75) return line;
  const chunks = [];
  let i = 0;
  while (i < line.length) {
    chunks.push((i === 0 ? '' : ' ') + line.slice(i, i + 73));
    i += 73;
  }
  return chunks.join('\r\n');
}

export function buildICS(events, { calendarName = 'FamilyOS' } = {}) {
  const stamp = fmt(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FamilyOS//EN',
    `X-WR-CALNAME:${escape(calendarName)}`,
    'CALSCALE:GREGORIAN',
  ];

  events.forEach((evt) => {
    const start = evt.date instanceof Date ? evt.date : new Date(evt.date);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    lines.push(
      'BEGIN:VEVENT',
      fold(`UID:${evt.id || `${stamp}-${Math.random().toString(36).slice(2)}`}@familyos`),
      `DTSTAMP:${stamp}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      fold(`SUMMARY:${escape(evt.title || 'Untitled')}`),
    );
    if (evt.description) lines.push(fold(`DESCRIPTION:${escape(evt.description)}`));
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadICS(events, filename = 'family-calendar.ics', opts) {
  const ics = buildICS(events, opts);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
