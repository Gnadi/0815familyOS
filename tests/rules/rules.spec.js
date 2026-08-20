// Firestore security-rules tests. Run with `npm run test:rules`, which starts
// the emulator around them (see package.json / firebase.json).
//
// These exist because two holes shipped in the previous rules and neither was
// visible from the app: /families was readable — and therefore listable — by
// any signed-in account, exposing every family's `encryptionKeyJwk` (the
// document vault's AES key); and the join rule's hasOnly(['memberIds']) let a
// non-member REPLACE the member list and evict everyone. Both are asserted
// against below so they cannot come back.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

const FAMILY = 'fam1';
const OTHER_FAMILY = 'fam2';
const MEMBER = 'member-uid';
const OUTSIDER = 'outsider-uid';
const GOOD = 'GoodToken0123456789ab';
const REVOKED = 'RevokedToken0123456789';
const EXPIRED = 'ExpiredToken0123456789';
const OTHER_FAM_TOKEN = 'OtherFamToken012345678';

const DAY = 24 * 60 * 60 * 1000;

let testEnv;

function invite(overrides = {}) {
  return {
    familyId: FAMILY,
    familyName: 'The Testers',
    createdBy: MEMBER,
    createdByName: 'Member',
    revoked: false,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 7 * DAY),
    createdAt: new Date(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'faos-rules-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'families', FAMILY), {
      name: 'The Testers',
      createdBy: MEMBER,
      memberIds: [MEMBER],
      encryptionKeyJwk: { k: 'super-secret-vault-key' },
      activeInvites: [],
    });
    await setDoc(doc(db, 'families', OTHER_FAMILY), {
      name: 'Someone Else',
      createdBy: 'stranger',
      memberIds: ['stranger'],
      encryptionKeyJwk: { k: 'other-secret' },
      activeInvites: [],
    });
    await setDoc(doc(db, 'invites', GOOD), invite());
    await setDoc(doc(db, 'invites', REVOKED), invite({ revoked: true }));
    await setDoc(doc(db, 'invites', EXPIRED), invite({ expiresAt: new Date(Date.now() - DAY) }));
    await setDoc(doc(db, 'invites', OTHER_FAM_TOKEN), invite({ familyId: OTHER_FAMILY }));
  });
});

const asMember = () => testEnv.authenticatedContext(MEMBER).firestore();
const asOutsider = () => testEnv.authenticatedContext(OUTSIDER).firestore();
const asAnon = () => testEnv.unauthenticatedContext().firestore();

describe('families: reading', () => {
  it('lets a member read their own family', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'families', FAMILY)));
  });

  it('denies a non-member reading a family document', async () => {
    await assertFails(getDoc(doc(asOutsider(), 'families', FAMILY)));
  });

  it('denies enumerating families — this is how the vault key leaked', async () => {
    await assertFails(getDocs(collection(asOutsider(), 'families')));
    await assertFails(getDocs(collection(asMember(), 'families')));
  });

  it('denies anonymous reads', async () => {
    await assertFails(getDoc(doc(asAnon(), 'families', FAMILY)));
  });
});

describe('families: joining', () => {
  const join = (db, token, memberIds = [MEMBER, OUTSIDER]) =>
    updateDoc(doc(db, 'families', FAMILY), { memberIds, lastJoinToken: token });

  it('allows a non-member holding a live token to add themselves', async () => {
    await assertSucceeds(join(asOutsider(), GOOD));
  });

  it('denies joining without a token', async () => {
    await assertFails(
      updateDoc(doc(asOutsider(), 'families', FAMILY), { memberIds: [MEMBER, OUTSIDER] }),
    );
  });

  it('denies a revoked token', async () => {
    await assertFails(join(asOutsider(), REVOKED));
  });

  it('denies an expired token', async () => {
    await assertFails(join(asOutsider(), EXPIRED));
  });

  it('denies a token minted for a different family', async () => {
    await assertFails(join(asOutsider(), OTHER_FAM_TOKEN));
  });

  it('denies a token that does not exist', async () => {
    await assertFails(join(asOutsider(), 'NoSuchToken01234567890'));
  });

  // The regression that matters most: the old rule checked only
  // hasOnly(['memberIds']), which permitted wholesale replacement.
  it('denies evicting existing members while joining', async () => {
    await assertFails(join(asOutsider(), GOOD, [OUTSIDER]));
  });

  it('denies adding somebody else alongside yourself', async () => {
    await assertFails(join(asOutsider(), GOOD, [MEMBER, OUTSIDER, 'third-party']));
  });

  it('denies smuggling a path traversal through the token field', async () => {
    await assertFails(join(asOutsider(), 'a/../../families/fam2'));
  });

  it('denies changing any other field while joining', async () => {
    await assertFails(
      updateDoc(doc(asOutsider(), 'families', FAMILY), {
        memberIds: [MEMBER, OUTSIDER],
        lastJoinToken: GOOD,
        encryptionKeyJwk: { k: 'attacker-controlled' },
      }),
    );
  });
});

describe('invites', () => {
  it('lets any signed-in user read an invite by its exact id', async () => {
    await assertSucceeds(getDoc(doc(asOutsider(), 'invites', GOOD)));
  });

  it('denies enumerating invites', async () => {
    await assertFails(getDocs(collection(asOutsider(), 'invites')));
  });

  it('denies anonymous invite reads', async () => {
    await assertFails(getDoc(doc(asAnon(), 'invites', GOOD)));
  });

  it('lets a family member mint an invite', async () => {
    await assertSucceeds(
      setDoc(doc(asMember(), 'invites', 'FreshToken01234567890a'), invite()),
    );
  });

  it('denies a non-member minting an invite for that family', async () => {
    await assertFails(
      setDoc(doc(asOutsider(), 'invites', 'FreshToken01234567890a'), invite({ createdBy: OUTSIDER })),
    );
  });

  it('denies minting an invite that never expires within a month', async () => {
    await assertFails(
      setDoc(
        doc(asMember(), 'invites', 'FreshToken01234567890a'),
        invite({ expiresAt: new Date(Date.now() + 400 * DAY) }),
      ),
    );
  });

  it('denies minting an already-expired invite', async () => {
    await assertFails(
      setDoc(
        doc(asMember(), 'invites', 'FreshToken01234567890a'),
        invite({ expiresAt: new Date(Date.now() - DAY) }),
      ),
    );
  });

  it('lets a member revoke an invite', async () => {
    await assertSucceeds(
      updateDoc(doc(asMember(), 'invites', GOOD), { revoked: true, revokedAt: new Date() }),
    );
  });

  it('denies re-pointing an invite at another family', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'invites', GOOD), { familyId: OTHER_FAMILY }),
    );
  });

  it('denies extending an invite', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'invites', GOOD), {
        expiresAt: new Date(Date.now() + 20 * DAY),
      }),
    );
  });

  it('denies un-revoking an invite', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'invites', REVOKED), { revoked: false }),
    );
  });

  it('denies a non-member deleting an invite', async () => {
    await assertFails(deleteDoc(doc(asOutsider(), 'invites', GOOD)));
  });
});

// The tracker (src/pages/TrackerPage) writes two collections rather than one:
// a definition and a document per logged moment. Both carry a familyId, and
// the logs in particular are the kind of thing a family expects to stay
// private, so the family-scoping is pinned down here alongside the create-time
// shape checks that keep malformed rows out of a child's history.
describe('trackers', () => {
  const tracker = (overrides = {}) => ({
    familyId: FAMILY,
    userId: MEMBER,
    name: 'Vitamin D',
    emoji: '☀️',
    color: 'amber',
    kidIds: ['kid_a'],
    unit: '',
    trackValue: false,
    dailyGoal: 1,
    minIntervalHours: null,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const entry = (overrides = {}) => ({
    familyId: FAMILY,
    userId: MEMBER,
    trackerId: 'tracker1',
    kidId: 'kid_a',
    at: new Date(),
    value: null,
    note: '',
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'trackers', 'tracker1'), tracker());
      await setDoc(doc(db, 'trackerEntries', 'entry1'), entry());
    });
  });

  it('lets a family member create a tracker', async () => {
    await assertSucceeds(setDoc(doc(asMember(), 'trackers', 'new1'), tracker()));
  });

  it('denies a non-member creating a tracker in that family', async () => {
    await assertFails(
      setDoc(doc(asOutsider(), 'trackers', 'new1'), { ...tracker(), userId: OUTSIDER }),
    );
  });

  it('denies creating a tracker attributed to somebody else', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'trackers', 'new1'), { ...tracker(), userId: OUTSIDER }),
    );
  });

  it('denies a nameless tracker', async () => {
    await assertFails(setDoc(doc(asMember(), 'trackers', 'new1'), { ...tracker(), name: '' }));
  });

  it('denies a tracker that belongs to no child', async () => {
    await assertFails(setDoc(doc(asMember(), 'trackers', 'new1'), { ...tracker(), kidIds: [] }));
  });

  it('lets a member read, edit and delete a tracker', async () => {
    await assertSucceeds(getDoc(doc(asMember(), 'trackers', 'tracker1')));
    await assertSucceeds(updateDoc(doc(asMember(), 'trackers', 'tracker1'), { name: 'Renamed' }));
    await assertSucceeds(deleteDoc(doc(asMember(), 'trackers', 'tracker1')));
  });

  it('denies a non-member reading or mutating a tracker', async () => {
    await assertFails(getDoc(doc(asOutsider(), 'trackers', 'tracker1')));
    await assertFails(updateDoc(doc(asOutsider(), 'trackers', 'tracker1'), { name: 'Renamed' }));
    await assertFails(deleteDoc(doc(asOutsider(), 'trackers', 'tracker1')));
  });

  it('denies anonymous access to trackers', async () => {
    await assertFails(getDoc(doc(asAnon(), 'trackers', 'tracker1')));
  });

  it('lets a family member log an entry', async () => {
    await assertSucceeds(setDoc(doc(asMember(), 'trackerEntries', 'new1'), entry()));
  });

  it('denies an entry without a timestamp', async () => {
    await assertFails(setDoc(doc(asMember(), 'trackerEntries', 'new1'), entry({ at: null })));
  });

  it('denies an entry that names no tracker or no child', async () => {
    await assertFails(
      setDoc(doc(asMember(), 'trackerEntries', 'new1'), entry({ trackerId: null })),
    );
    await assertFails(setDoc(doc(asMember(), 'trackerEntries', 'new1'), entry({ kidId: null })));
  });

  it('denies logging an entry into another family', async () => {
    await assertFails(
      setDoc(doc(asOutsider(), 'trackerEntries', 'new1'), entry({ userId: OUTSIDER })),
    );
  });

  it('denies a non-member reading a logged entry', async () => {
    await assertFails(getDoc(doc(asOutsider(), 'trackerEntries', 'entry1')));
  });

  it('lets a member correct or remove a logged entry', async () => {
    await assertSucceeds(
      updateDoc(doc(asMember(), 'trackerEntries', 'entry1'), { note: 'corrected' }),
    );
    await assertSucceeds(deleteDoc(doc(asMember(), 'trackerEntries', 'entry1')));
  });

  it('denies a non-member editing or deleting a logged entry', async () => {
    await assertFails(
      updateDoc(doc(asOutsider(), 'trackerEntries', 'entry1'), { note: 'tampered' }),
    );
    await assertFails(deleteDoc(doc(asOutsider(), 'trackerEntries', 'entry1')));
  });
});
