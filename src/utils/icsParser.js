// Minimal ICS (iCalendar / RFC 5545) parser. We only consume what myFAOS
// needs: VEVENT with SUMMARY, DESCRIPTION, DTSTART, DTEND/DURATION, UID, EXDATE and
// (limited) RRULE → mapped to our { freq, interval, until, byDay, count }
// recurrence shape. Time zones are read as local-floating; UTC ("Z" suffix) is
// honoured.

import { DAY_CODES, occurrenceKey } from './recurrence';

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

// Is this property written in the DATE form (an all-day event)? Either the
// value is a bare YYYYMMDD or the property says so with VALUE=DATE.
function isDateOnly(prop) {
  if (!prop) return false;
  if (String(prop.params?.VALUE || '').toUpperCase() === 'DATE') return true;
  return /^\d{8}$/.test(String(prop.value || '').trim());
}

// DURATION, which feeds write instead of DTEND (Google does it for events
// created from a template): P[n]W or P[n]DT[n]H[n]M[n]S. A VEVENT's length is
// always positive, so a negative or empty duration is no duration at all.
function parseDuration(value) {
  const match = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/
    .exec(String(value || '').trim().toUpperCase());
  if (!match) return null;
  const [, w, d, h, min, s] = match;
  if (!w && !d && !h && !min && !s) return null;
  const seconds = (+w || 0) * 604800 + (+d || 0) * 86400
    + (+h || 0) * 3600 + (+min || 0) * 60 + (+s || 0);
  return seconds > 0 ? seconds * 1000 : null;
}

// When the event ends, from DTEND or DURATION.
//
// All-day events land on a synthetic 09:00 (their DATE form carries no clock
// time) and are flagged `allDay`, so nothing renders that 09:00. Their end is
// the exclusive end *day* at midnight, the way DTEND;VALUE=DATE writes it --
// and only when it lies beyond the first day: a plain one-day birthday keeps no
// end at all.
function parseAllDayEnd(current, startDate) {
  const firstDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  let end = null;
  if (current.DTEND) {
    const d = parseICalDate(current.DTEND.value, current.DTEND.params);
    if (d) end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  } else if (current.DURATION) {
    const ms = parseDuration(current.DURATION.value);
    if (ms) {
      end = new Date(firstDay);
      end.setDate(end.getDate() + Math.round(ms / 86400000));
    }
  }
  if (!end) return null;
  const nextDay = new Date(firstDay);
  nextDay.setDate(nextDay.getDate() + 1);
  return end > nextDay ? end : null;
}

function parseEventEnd(current, startDate) {
  if (isDateOnly(current.DTSTART)) return parseAllDayEnd(current, startDate);
  if (current.DTEND) {
    const end = parseICalDate(current.DTEND.value, current.DTEND.params);
    return end && end > startDate ? end : null;
  }
  if (current.DURATION) {
    const ms = parseDuration(current.DURATION.value);
    return ms ? new Date(startDate.getTime() + ms) : null;
  }
  return null;
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

  // BYDAY is what makes "Mon, Wed and Fri" a single weekly series. Ordinal
  // forms (2TU = every second Tuesday of the month) belong to monthly rules we
  // do not expand; dropping them leaves the plain monthly walk, which is closer
  // to the truth than treating "2TU" as "every Tuesday".
  let byDay = null;
  if (parts.BYDAY && freq === 'weekly') {
    const codes = [...new Set(
      String(parts.BYDAY)
        .split(',')
        .map((code) => code.trim().toUpperCase())
        .filter((code) => DAY_CODES.includes(code)),
    )];
    if (codes.length) byDay = codes;
  }

  // COUNT ends a series after N occurrences. Without it a six-session course
  // imported from Google repeated forever.
  const countRaw = parseInt(parts.COUNT, 10);
  const count = Number.isFinite(countRaw) && countRaw > 0 ? countRaw : null;

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
  return { freq, interval, until, byDay, count };
}

// EXDATE lines list occurrences the organiser cancelled. A VEVENT may carry
// several of them and each may hold a comma-separated list, so they accumulate
// instead of overwriting one another the way single-valued properties do.
function collectExDates(prop, into) {
  for (const raw of String(prop.value || '').split(',')) {
    const date = parseICalDate(raw.trim(), prop.params);
    const key = occurrenceKey(date);
    if (key) into.push(key);
  }
}

export function parseICS(text) {
  if (!text || typeof text !== 'string') return { calendarName: null, events: [] };
  const unfolded = unfoldLines(text);
  const lines = unfolded.split(/\r?\n/);

  let calendarName = null;
  const events = [];
  let current = null;
  // Components nested inside a VEVENT (VALARM, and in tolerant feeds VTIMEZONE
  // sub-components). Their properties must not leak into the event: a VALARM
  // carries its own DESCRIPTION -- and sometimes SUMMARY -- which used to
  // overwrite the event's title and description with the reminder text.
  let nested = 0;
  // Multi-valued, so it cannot live in `current` next to the single-valued
  // properties: a second EXDATE line would overwrite the first.
  let exdates = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === 'BEGIN:VEVENT') {
      current = {};
      exdates = [];
      nested = 0;
      continue;
    }
    if (current && nested === 0 && line === 'END:VEVENT') {
      // STATUS:CANCELLED marks an event the organiser withdrew; iCloud keeps
      // shipping it in the feed, but it must not show up in the calendar.
      const cancelled = current.STATUS?.value?.toUpperCase() === 'CANCELLED';
      if (!cancelled && current.SUMMARY && current.DTSTART) {
        const startDate = parseICalDate(current.DTSTART.value, current.DTSTART.params);
        if (startDate) {
          const recurrence = current.RRULE ? parseRRule(current.RRULE.value) : null;
          // Cancelled occurrences only mean anything alongside a rule that
          // would otherwise generate them.
          if (recurrence && exdates.length) recurrence.exdates = [...new Set(exdates)];
          events.push({
            uid: current.UID?.value || null,
            // Set on VEVENTs that override a single occurrence of a recurring
            // series. They share the series UID, so callers need this to tell
            // an override apart from the master.
            recurrenceId: current['RECURRENCE-ID']?.value || null,
            title: unescapeText(current.SUMMARY.value),
            description: current.DESCRIPTION ? unescapeText(current.DESCRIPTION.value) : '',
            date: startDate,
            endDate: parseEventEnd(current, startDate),
            allDay: isDateOnly(current.DTSTART),
            recurrence,
            location: current.LOCATION ? unescapeText(current.LOCATION.value) : '',
          });
        }
      }
      current = null;
      continue;
    }
    if (current && line.startsWith('BEGIN:')) {
      nested += 1;
      continue;
    }
    if (current && nested > 0) {
      if (line.startsWith('END:')) nested -= 1;
      continue;
    }
    const prop = parseProperty(line);
    if (!prop) continue;
    if (!current) {
      if (prop.name === 'X-WR-CALNAME') calendarName = unescapeText(prop.value);
      continue;
    }
    if (prop.name === 'EXDATE') {
      collectExDates(prop, exdates);
      continue;
    }
    current[prop.name] = { value: prop.value, params: prop.params };
  }

  return { calendarName, events };
}
