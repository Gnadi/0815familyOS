// Subscribed calendars are served stale-while-revalidate: a cache past its
// freshness window shows straight away and is refreshed in the background, so
// one slow provider no longer holds the family's calendar hostage.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/firebase', () => ({ authorizationHeader: async () => ({}) }));

const { clearFeedCache, loadFeed, onFeedRefreshed } = await import('../../src/services/calendarFeeds');

const subscription = { id: 'swr', url: 'https://calendar.example/swr.ics' };
const HOUR = 60 * 60 * 1000;

function ics(title) {
  const start = new Date(Date.now() + 2 * 24 * HOUR);
  const stamp = start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'BEGIN:VEVENT', 'UID:one@example', `DTSTART:${stamp}`, `SUMMARY:${title}`, 'END:VEVENT',
    'END:VCALENDAR', '',
  ].join('\r\n');
}

const ok = (body) => ({ ok: true, status: 200, json: async () => body });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

let fetchMock;
let now;

beforeEach(() => {
  clearFeedCache(subscription.id);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('loadFeed, stale-while-revalidate', () => {
  it('serves a stale cache at once and refreshes it in the background', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ics: ics('Old title') }));
    await loadFeed(subscription, { force: true });

    now += 2 * HOUR;
    let release;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => { release = resolve; }));
    const heard = vi.fn();
    const off = onFeedRefreshed(heard);

    // The network has not answered, yet the cached events are already here.
    const res = await loadFeed(subscription);
    expect(res.events.map((e) => e.title)).toEqual(['Old title']);
    expect(res.stale).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    release(ok({ ics: ics('New title') }));
    await flush();
    expect(heard).toHaveBeenCalledWith(subscription.id);

    const after = await loadFeed(subscription);
    expect(after.events.map((e) => e.title)).toEqual(['New title']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    off();
  });

  it('does not tell anyone when upstream is unchanged', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ics: ics('Same'), etag: '"v1"' }));
    await loadFeed(subscription, { force: true });

    now += 2 * HOUR;
    fetchMock.mockResolvedValueOnce(ok({ notModified: true, etag: '"v1"' }));
    const heard = vi.fn();
    const off = onFeedRefreshed(heard);
    await loadFeed(subscription);
    await flush();
    expect(heard).not.toHaveBeenCalled();

    // The freshness clock restarted: no further request.
    await loadFeed(subscription);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    off();
  });

  it('reports a failed refresh against the stale cache without retrying at once', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ics: ics('Cached') }));
    await loadFeed(subscription, { force: true });

    now += 2 * HOUR;
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const heard = vi.fn();
    const off = onFeedRefreshed(heard);
    await loadFeed(subscription);
    await flush();
    expect(heard).toHaveBeenCalledTimes(1);

    const res = await loadFeed(subscription);
    expect(res.stale).toBe(true);
    expect(res.error.message).toBe('offline');
    expect(res.events.map((e) => e.title)).toEqual(['Cached']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    off();
  });

  it('still waits for the network when there is no cache', async () => {
    fetchMock.mockResolvedValueOnce(ok({ ics: ics('First') }));
    const res = await loadFeed(subscription);
    expect(res.fromCache).toBe(false);
    expect(res.events.map((e) => e.title)).toEqual(['First']);
  });
});
