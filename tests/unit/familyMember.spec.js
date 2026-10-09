// Who may call the endpoints in api/. Firestore is stubbed here; that the real
// REST API and firestore.rules answer the way these stubs do is checked against
// the emulator in tests/rules/rules.spec.js.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyFamilyMember } from '../../api/_lib/familyMember.js';

function token(payload) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'RS256' })}.${part(payload)}.signature`;
}

const MEMBER_TOKEN = token({ sub: 'member-uid' });
const asCaller = (authorization) => ({ headers: authorization ? { authorization } : {} });

function reply(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const userDoc = (familyId) => reply(200, familyId ? { fields: { familyId: { stringValue: familyId } } } : {});
const familyDoc = (...memberIds) => reply(200, {
  fields: { memberIds: { arrayValue: { values: memberIds.map((stringValue) => ({ stringValue })) } } },
});

let fetchMock;

beforeEach(() => {
  vi.stubEnv('FIREBASE_PROJECT_ID', 'faos-test');
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', '');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('verifyFamilyMember', () => {
  it('admits a member of the family their user document names', async () => {
    fetchMock.mockResolvedValueOnce(userDoc('fam1')).mockResolvedValueOnce(familyDoc('member-uid', 'other'));

    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`)))
      .resolves.toEqual({ ok: true, uid: 'member-uid', familyId: 'fam1' });
  });

  it('asks Firestore as the caller, and only for the fields it needs', async () => {
    fetchMock.mockResolvedValueOnce(userDoc('fam1')).mockResolvedValueOnce(familyDoc('member-uid'));
    await verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`));

    const [[userUrl, userInit], [familyUrl, familyInit]] = fetchMock.mock.calls;
    expect(userUrl).toBe('https://firestore.googleapis.com/v1/projects/faos-test/databases/(default)/documents/users/member-uid?mask.fieldPaths=familyId');
    // The mask keeps the family's encryptionKeyJwk out of the answer.
    expect(familyUrl).toBe('https://firestore.googleapis.com/v1/projects/faos-test/databases/(default)/documents/families/fam1?mask.fieldPaths=memberIds');
    expect(userInit.headers.Authorization).toBe(`Bearer ${MEMBER_TOKEN}`);
    expect(familyInit.headers.Authorization).toBe(`Bearer ${MEMBER_TOKEN}`);
  });

  it('turns away a caller without a token, without asking Firestore', async () => {
    for (const authorization of [undefined, 'Basic abc', `Bearer ${token({})}`, 'Bearer not-a-jwt']) {
      await expect(verifyFamilyMember(asCaller(authorization))).resolves.toMatchObject({ ok: false, status: 401 });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps a uid that is no plain id out of the request path', async () => {
    const sneaky = token({ sub: '../families/fam1' });
    await expect(verifyFamilyMember(asCaller(`Bearer ${sneaky}`))).resolves.toMatchObject({ ok: false, status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns away a token Firestore does not accept', async () => {
    fetchMock.mockResolvedValueOnce(reply(401));
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 401 });
  });

  it('turns away a user who is in no family', async () => {
    fetchMock.mockResolvedValueOnce(userDoc(null));
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns away a user without a user document', async () => {
    fetchMock.mockResolvedValueOnce(reply(404));
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 403 });
  });

  // users.familyId is the caller's own to write: naming a family there must
  // not be enough. The rules refuse the family read to a non-member.
  it('turns away a user whose document names a family they are not in', async () => {
    fetchMock.mockResolvedValueOnce(userDoc('fam1')).mockResolvedValueOnce(reply(403));
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it('does not take a family document that leaves the caller out', async () => {
    fetchMock.mockResolvedValueOnce(userDoc('fam1')).mockResolvedValueOnce(familyDoc('someone-else'));
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it('does not build a path out of a familyId that is no plain id', async () => {
    fetchMock.mockResolvedValueOnce(userDoc('fam1/../../users/x'));
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('never reads an unreachable Firestore as a yes', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 503 });

    fetchMock.mockResolvedValueOnce(userDoc('fam1')).mockResolvedValueOnce(reply(500));
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 503 });
  });

  it('refuses everyone while no Firebase project is configured', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', '');
    await expect(verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`))).resolves.toMatchObject({ ok: false, status: 500 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to the project id the app is built with', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', '');
    vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'faos-app');
    fetchMock.mockResolvedValueOnce(userDoc('fam1')).mockResolvedValueOnce(familyDoc('member-uid'));
    await verifyFamilyMember(asCaller(`Bearer ${MEMBER_TOKEN}`));
    expect(fetchMock.mock.calls[0][0]).toContain('/projects/faos-app/');
  });
});
