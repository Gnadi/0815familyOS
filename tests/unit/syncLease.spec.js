// The sync lease. Every member's browser tries to re-sync stale calendar
// subscriptions when the app opens (AppShell), and `syncedThisSession` is a ref
// per tab — so it only ever stopped *one device* syncing twice. Three members
// opening the app in the same hour each ran a full sync: three ICS fetches,
// three reads of the family's events, three write batches, racing on the same
// documents. On the free tier that is also a quota problem.
//
// The lease is the only thing that makes "at most once an hour" true across a
// family rather than per device, so the contested case is what these cover.
//
// Runs without the emulator (`npm test`); the rules suite needs `npm run test:rules`.

import { beforeEach, describe, expect, it, vi } from 'vitest';

// One shared fake family document, and a runTransaction that is genuinely
// serialised — which is the property under test.
let familyDoc;
let txQueue;

// A snapshot is the document as it was when it was read — NOT a live view. This
// matters: a lazy `data: () => familyDoc` would let even a naive read-then-write
// implementation look atomic, because by the time the second caller inspected it
// the first caller's write would already be visible. That made the contested
// test pass against an implementation with no transaction at all, which is
// exactly the kind of test that proves nothing.
function snapshotOf(value) {
  const captured = value === null ? null : { ...value, calendarSubscriptions: [...(value.calendarSubscriptions || [])] };
  return { exists: () => captured !== null, data: () => captured };
}

const runTransaction = vi.fn(async (_db, fn) => {
  // Serialise: each transaction body runs to completion before the next starts,
  // which is the guarantee Firestore's optimistic retry loop provides and the
  // property the lease depends on.
  const run = txQueue.then(() =>
    fn({
      get: async () => snapshotOf(familyDoc),
      update: (_ref, patch) => {
        familyDoc = { ...familyDoc, ...patch };
      },
    }),
  );
  txQueue = run.catch(() => {});
  return run;
});

const updateDoc = vi.fn(async (_ref, patch) => {
  familyDoc = { ...familyDoc, ...patch };
});

vi.mock('firebase/firestore', () => ({
  addDoc: vi.fn(),
  arrayUnion: vi.fn(),
  collection: vi.fn(() => ({})),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  getDoc: vi.fn(async () => snapshotOf(familyDoc)),
  getDocs: vi.fn(async () => ({ docs: [] })),
  query: vi.fn(),
  runTransaction: (...args) => runTransaction(...args),
  serverTimestamp: vi.fn(),
  Timestamp: { fromDate: (d) => d },
  updateDoc: (...args) => updateDoc(...args),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));
vi.mock('../../src/lib/firebase', () => ({ db: {} }));
vi.mock('../../src/lib/demoMode', () => ({ isDemoMode: () => false }));
vi.mock('../../src/services/demoStore', () => ({
  demoAdd: vi.fn(),
  demoDocs: vi.fn(),
  demoUpdate: vi.fn(),
}));
vi.mock('../../src/utils/icsParser', () => ({ parseICS: vi.fn() }));

const {
  claimSyncLease,
  releaseSyncLease,
  SYNC_LEASE_MS,
} = await import('../../src/services/calendarSubscriptions');

const SUB = 'sub_1';
const subscription = (extra = {}) => ({ id: SUB, url: 'https://x/c.ics', ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  txQueue = Promise.resolve();
  familyDoc = { calendarSubscriptions: [subscription()] };
});

const leaseOf = () =>
  familyDoc.calendarSubscriptions.find((s) => s.id === SUB).syncLeaseUntil;

describe('claimSyncLease', () => {
  it('grants an unheld lease and records when it expires', async () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);

    expect(await claimSyncLease('fam1', SUB, now)).toBe(true);
    expect(new Date(leaseOf()).getTime()).toBe(now + SYNC_LEASE_MS);
  });

  it('refuses a second claimant while the lease is held', async () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    await claimSyncLease('fam1', SUB, now);

    // A minute later, another member's device opens the app.
    expect(await claimSyncLease('fam1', SUB, now + 60_000)).toBe(false);
  });

  it('gives it to exactly one of several devices claiming at once', async () => {
    // The case the lease exists for: three members opening the app together.
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    const results = await Promise.all([
      claimSyncLease('fam1', SUB, now),
      claimSyncLease('fam1', SUB, now),
      claimSyncLease('fam1', SUB, now),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('grants it again once an abandoned lease has expired', async () => {
    // A tab closed mid-sync leaves the lease behind; it must not block forever.
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    await claimSyncLease('fam1', SUB, now);

    expect(await claimSyncLease('fam1', SUB, now + SYNC_LEASE_MS + 1)).toBe(true);
  });

  it('treats the boundary as still held', async () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    await claimSyncLease('fam1', SUB, now);

    expect(await claimSyncLease('fam1', SUB, now + SYNC_LEASE_MS)).toBe(true);
  });

  it('refuses when the subscription is gone', async () => {
    familyDoc = { calendarSubscriptions: [] };
    expect(await claimSyncLease('fam1', SUB)).toBe(false);
  });

  it('refuses when the family is gone', async () => {
    familyDoc = null;
    expect(await claimSyncLease('fam1', SUB)).toBe(false);
  });

  it('leaves other subscriptions untouched', async () => {
    familyDoc = { calendarSubscriptions: [subscription(), { id: 'sub_2', url: 'https://y' }] };
    await claimSyncLease('fam1', SUB, 1000);

    const other = familyDoc.calendarSubscriptions.find((s) => s.id === 'sub_2');
    expect(other.syncLeaseUntil).toBeUndefined();
  });

  it('keeps the subscription\'s other fields', async () => {
    familyDoc = { calendarSubscriptions: [subscription({ label: 'School', lastSyncAt: 'x' })] };
    await claimSyncLease('fam1', SUB, 1000);

    const sub = familyDoc.calendarSubscriptions.find((s) => s.id === SUB);
    expect(sub).toMatchObject({ label: 'School', lastSyncAt: 'x', url: 'https://x/c.ics' });
  });
});

describe('releaseSyncLease', () => {
  it('clears the lease so another device need not wait it out', async () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0);
    await claimSyncLease('fam1', SUB, now);
    await releaseSyncLease('fam1', SUB);

    expect(leaseOf()).toBeNull();
    expect(await claimSyncLease('fam1', SUB, now + 1)).toBe(true);
  });

  it('carries an error through in the same write', async () => {
    await claimSyncLease('fam1', SUB, 1000);
    await releaseSyncLease('fam1', SUB, { lastError: 'Feed unreachable.' });

    const sub = familyDoc.calendarSubscriptions.find((s) => s.id === SUB);
    expect(sub).toMatchObject({ lastError: 'Feed unreachable.', syncLeaseUntil: null });
  });
});
