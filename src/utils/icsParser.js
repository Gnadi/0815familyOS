// Minimal ICS (iCalendar / RFC 5545) parser. We only consume what FamilyOS
// needs: VEVENT with SUMMARY, DESCRIPTION, DTSTART, DTEND, UID, and (limited)
// RRULE → mapped to our { freq, interval, until } recurrence shape. Time zones
// are read as local-floating; UTC ("Z" suffix) is honoured.

const FREQ_MAP = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

function unfoldLines(text) {
  // RFC 5545 line folding: a CRLF/LF followed by a single space or tab
  // continues the previous line.
  return text.replace(/\r?\n[ \t]/g, '');
}

function unescapeText(value) {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseProperty(line) {
  // KEY[;PARAM=VAL[;PARAM2=VAL2...]]:VALUE
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramPairs] = head.split(';');
  const params = {};
  for (const pair of paramPairs) {
    const eq = pair.indexOf('=');
    if (eq > 0) params[pair.slice(0, eq).toUpperCase()] = pair.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value };
}

function parseICalDate(value, params = {}) {
  if (!value) return null;
  // DATE form: YYYYMMDD (all-day event)
  if (/^\d{8}$/.test(value)) {
    const y = +value.slice(0, 4);
    const m = +value.slice(4, 6);
    const d = +value.slice(6, 8);
    return new Date(y, m - 1, d, 9, 0, 0);
  }
  // DATETIME form: YYYYMMDDTHHMMSS[Z]
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) return null;
  const [, Y, M, D, h, m, s, z] = match;
  if (z === 'Z') {
    return new Date(Date.UTC(+Y, +M - 1, +D, +h, +m, +s));
  }
  // Local-floating (or specified TZID we don't honour) — treat as local time.
  return new Date(+Y, +M - 1, +D, +h, +m, +s);
}

function parseRRule(value) {
  if (!value) return null;
  const parts = {};
  for (const seg of value.split(';')) {
    const eq = seg.indexOf('=');
    if (eq < 0) continue;
    parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }
  const freq = FREQ_MAP[(parts.FREQ || '').toUpperCase()];
  if (!freq) return null;
  const interval = Math.max(1, Math.min(99, parseInt(parts.INTERVAL, 10) || 1));
  let until = null;
  if (parts.UNTIL) {
    const d = parseICalDate(parts.UNTIL);
    if (d) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      until = `${yyyy}-${mm}-${dd}`;
    }
  }
  return { freq, interval, until };
}

export function parseICS(text) {
  if (!text || typeof text !== 'string') return { calendarName: null, events: [] };
  const unfolded = unfoldLines(text);
  const lines = unfolded.split(/\r?\n/);

  let calendarName = null;
  const events = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current && current.SUMMARY && current.DTSTART) {
        const startDate = parseICalDate(current.DTSTART.value, current.DTSTART.params);
        if (startDate) {
          events.push({
            uid: current.UID?.value || null,
            title: unescapeText(current.SUMMARY.value),
            description: current.DESCRIPTION ? unescapeText(current.DESCRIPTION.value) : '',
            date: startDate,
            recurrence: current.RRULE ? parseRRule(current.RRULE.value) : null,
            location: current.LOCATION ? unescapeText(current.LOCATION.value) : '',
          });
        }
      }
      current = null;
      continue;
    }
    const prop = parseProperty(line);
    if (!prop) continue;
    if (!current) {
      if (prop.name === 'X-WR-CALNAME') calendarName = unescapeText(prop.value);
      continue;
    }
    current[prop.name] = { value: prop.value, params: prop.params };
  }

  return { calendarName, events };
}
