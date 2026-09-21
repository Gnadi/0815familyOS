import { generateKeyPairSync, createVerify } from 'crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { fromFields, toFields, toValue } from '../../api/_assistant/firestore.js';
import {
  ServiceAccountError,
  buildAssertion,
  hasServiceAccount,
  resetCredentialCache,
  serviceAccount,
} from '../../api/_assistant/googleAuth.js';

// The voice interface writes through the Firestore REST API with a
// service-account token, so two things have to be exactly right: the typed
// value encoding (a wrong shape silently stores the wrong type) and the signed
// assertion (a wrong claim means no token at all).

afterEach(() => {
  resetCredentialCache();
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
});

describe('Firestore value codec', () => {
  it('encodes every type this app stores', () => {
    expect(toValue('x')).toEqual({ stringValue: 'x' });
    expect(toValue(true)).toEqual({ booleanValue: true });
    expect(toValue(3)).toEqual({ integerValue: '3' });
    expect(toValue(2.5)).toEqual({ doubleValue: 2.5 });
    expect(toValue(null)).toEqual({ nullValue: null });
    expect(toValue(undefined)).toEqual({ nullValue: null });
    expect(toValue(new Date('2026-09-25T14:00:00.000Z'))).toEqual({
      timestampValue: '2026-09-25T14:00:00.000Z',
    });
  });

  // Firestore rejects { arrayValue: { values: [] } } for an empty array.
  it('encodes an empty array without a values key', () => {
    expect(toValue([])).toEqual({ arrayValue: {} });
  });

  it('round-trips a document the way the app writes one', () => {
    const original = {
      title: 'Friseur Carlo',
      kids: ['kid-1'],
      points: 3,
      done: false,
      date: new Date('2026-09-25T14:00:00.000Z'),
      endDate: null,
      recurrence: { freq: 'weekly', interval: 2, until: null },
      assigneeIds: [],
    };
    const back = fromFields(toFields(original));
    expect(back).toEqual(original);
    // Nested nulls must survive as null, not as the string "null".
    expect(back.recurrence.until).toBeNull();
    expect(back.date).toBeInstanceOf(Date);
  });
});

describe('service account', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const account = {
    client_email: 'voice@faos.iam.gserviceaccount.com',
    private_key: pem,
    project_id: 'faos-test',
  };

  it('accepts the credentials JSON raw or base64-encoded', () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(account);
    expect(serviceAccount()).toMatchObject({ projectId: 'faos-test' });

    resetCredentialCache();
    process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(account)).toString('base64');
    expect(serviceAccount()).toMatchObject({
      clientEmail: 'voice@faos.iam.gserviceaccount.com',
      projectId: 'faos-test',
    });
  });

  it('says what is wrong instead of failing deep inside a request', () => {
    expect(() => serviceAccount({})).toThrow(ServiceAccountError);
    resetCredentialCache();
    expect(() => serviceAccount({ FIREBASE_SERVICE_ACCOUNT: 'nonsense' })).toThrow(/not valid JSON/);
    resetCredentialCache();
    expect(() => serviceAccount({ FIREBASE_SERVICE_ACCOUNT: '{"client_email":"a"}' })).toThrow(
      /missing client_email, private_key or project_id/,
    );
    expect(hasServiceAccount({})).toBe(false);
  });

  it('signs an assertion Google can verify, with the claims it requires', () => {
    const assertion = buildAssertion(
      { clientEmail: account.client_email, privateKey: pem },
      1_800_000_000,
    );
    const [header, claims, signature] = assertion.split('.');
    const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf-8'));

    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(decode(claims)).toEqual({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
    const verified = createVerify('RSA-SHA256')
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature, 'base64url'));
    expect(verified).toBe(true);
  });
});
