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

/* The families update rule used to be unconditional for members, and the comment
   above it in firestore.rules said what that cost: "a *member* can still
   overwrite encryptionKeyJwk or remove other members."

   Both are now closed, anchored on `createdBy` alone rather than a full role
   model. MEMBER is the family's creator in this fixture, so these add a second,
   non-owner member to test against. */
describe('families: the vault key', () => {
  const SECOND = 'second-uid';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'families', FAMILY), {
        memberIds: [MEMBER, SECOND],
      });
    });
  });

  const asSecond = () => testEnv.authenticatedContext(SECOND).firestore();

  it('cannot be replaced by a member', async () => {
    // Not a leak — it would make every encrypted document in the family
    // permanently unreadable, which is worse.
    await assertFails(
      updateDoc(doc(asSecond(), 'families', FAMILY), { encryptionKeyJwk: { k: 'mine-now' } }),
    );
  });

  it('cannot be replaced by the owner either', async () => {
    await assertFails(
      updateDoc(doc(asMember(), 'families', FAMILY), { encryptionKeyJwk: { k: 'mine-now' } }),
    );
  });

  it('can still be filled in when absent, by any member', async () => {
    // services/families.js backfills this for families predating the vault, and
    // any member may trigger it — so the rule must allow first write.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'families', 'fam-nokey'), {
        name: 'No Key Yet',
        createdBy: MEMBER,
        memberIds: [MEMBER, SECOND],
        activeInvites: [],
      });
    });

    await assertSucceeds(
      updateDoc(doc(asSecond(), 'families', 'fam-nokey'), { encryptionKeyJwk: { k: 'fresh' } }),
    );
  });

  it('does not block unrelated edits', async () => {
    await assertSucceeds(updateDoc(doc(asSecond(), 'families', FAMILY), { name: 'Renamed' }));
  });
});

describe('families: removing members', () => {
  const SECOND = 'second-uid';
  const THIRD = 'third-uid';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'families', FAMILY), {
        memberIds: [MEMBER, SECOND, THIRD],
      });
    });
  });

  const asSecond = () => testEnv.authenticatedContext(SECOND).firestore();

  it('lets the owner remove someone', async () => {
    await assertSucceeds(
      updateDoc(doc(asMember(), 'families', FAMILY), { memberIds: [MEMBER, THIRD] }),
    );
  });

  it('does not let a member remove anyone', async () => {
    await assertFails(
      updateDoc(doc(asSecond(), 'families', FAMILY), { memberIds: [MEMBER, SECOND] }),
    );
  });

  it('does not let a member remove the owner', async () => {
    await assertFails(
      updateDoc(doc(asSecond(), 'families', FAMILY), { memberIds: [SECOND, THIRD] }),
    );
  });

  it('does not let the owner remove themselves', async () => {
    // A family with no owner could never remove anyone again.
    await assertFails(
      updateDoc(doc(asMember(), 'families', FAMILY), { memberIds: [SECOND, THIRD] }),
    );
  });

  it('does not let the owner add someone without an invite', async () => {
    // Growth goes through the join rule, which requires a live token.
    await assertFails(
      updateDoc(doc(asMember(), 'families', FAMILY), {
        memberIds: [MEMBER, SECOND, THIRD, OUTSIDER],
      }),
    );
  });

  it('does not let an outsider remove anyone', async () => {
    await assertFails(
      updateDoc(doc(asOutsider(), 'families', FAMILY), { memberIds: [MEMBER] }),
    );
  });
});

describe('families: ownership', () => {
  const SECOND = 'second-uid';

  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'families', FAMILY), {
        memberIds: [MEMBER, SECOND],
      });
    });
  });

  it('cannot be taken by a member', async () => {
    // Without this, everything above is one write away from being bypassed.
    const asSecond = () => testEnv.authenticatedContext(SECOND).firestore();
    await assertFails(updateDoc(doc(asSecond(), 'families', FAMILY), { createdBy: SECOND }));
  });

  it('cannot be handed over by the owner', async () => {
    await assertFails(updateDoc(doc(asMember(), 'families', FAMILY), { createdBy: SECOND }));
  });
});
