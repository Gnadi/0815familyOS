import { useCallback, useEffect, useState } from 'react';

const KEY = 'faos:remindersSeen';
// Ids carry the date they refer to, so yesterday's entries can never match
// today's. Trimming keeps one device's list from growing without bound.
const MAX_ENTRIES = 200;

function read() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY));
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Which reminders this device has already been shown.
 *
 * Per device on purpose, in localStorage rather than on the family document.
 * "I have seen this" is not a family-wide fact — one parent reading a reminder
 * on their phone should not clear the badge on the other's, and writing it to
 * Firestore would mean a shared document write on every glance.
 */
export default function useSeenReminders() {
  const [seen, setSeen] = useState(read);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(seen.slice(-MAX_ENTRIES)));
    } catch {
      // A full or blocked store is not worth breaking the bell over.
    }
  }, [seen]);

  const markSeen = useCallback((ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setSeen((prev) => {
      const fresh = list.filter((id) => id && !prev.includes(id));
      return fresh.length === 0 ? prev : [...prev, ...fresh];
    });
  }, []);

  const isSeen = useCallback((id) => seen.includes(id), [seen]);

  return { seen, isSeen, markSeen };
}
