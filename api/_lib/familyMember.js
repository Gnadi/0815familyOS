// Who may call the endpoints in api/: a signed-in member of a family.
//
// They sign Cloudinary uploads and fetch calendar feeds on the server's behalf,
// and both used to answer anyone who found the URL -- which made the Cloudinary
// account a free file host and the feed proxy an open one. (Vercel serves no
// file under api/_lib, so this one is a module, not an endpoint.)
//
// Membership is Firestore's answer, asked as the caller. The caller's ID token
// goes to Firestore's REST API, which verifies it -- signature, expiry, project
// -- and applies firestore.rules to two reads the app makes itself: the
// caller's own user document, for the family it names, and that family's
// document, which the rules let only its members get. users.familyId on its own
// would prove nothing, since anyone may write it on their own document;
// memberIds is what the rules trust, so it is what this trusts.
//
// That needs no service account and no firebase-admin, only the project id.
// The masks keep the family's encryptionKeyJwk out of the response.

// Firebase uids and Firestore auto-ids both fit this; it also keeps whatever a
// token or a document says out of the request paths built from it.
const ID = /^[A-Za-z0-9_-]{1,128}$/;

export function firebaseProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || null;
}

function bearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') return null;
  return /^Bearer ([A-Za-z0-9._-]+)$/.exec(header)?.[1] || null;
}

// The uid the token names. Read, not trusted: it only says which user document
// to ask for. Whether the token is genuine is Firestore's call, and so is
// whether that uid is a member.
function uidOf(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.sub === 'string' && ID.test(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

// The document's masked fields, or 'bad-token', 'denied' (refused by the rules
// or not there -- a family that does not exist is denied as well) or
// 'unavailable' (Firestore could not be asked, which is never read as a yes).
async function readAsCaller(idToken, path, field) {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST;
  const base = emulator ? `http://${emulator}` : 'https://firestore.googleapis.com';
  const url = `${base}/v1/projects/${firebaseProjectId()}/databases/(default)/documents/${path}`
    + `?mask.fieldPaths=${field}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${idToken}` },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response) return 'unavailable';
  if (response.status === 401) return 'bad-token';
  if (response.status === 403 || response.status === 404) return 'denied';
  if (!response.ok) return 'unavailable';
  const document = await response.json().catch(() => null);
  return document ? document.fields || {} : 'unavailable';
}

const REFUSED = {
  'bad-token': { status: 401, error: 'Sign in first.' },
  denied: { status: 403, error: 'Only members of a family can use this.' },
  unavailable: { status: 503, error: 'Could not check your family right now.' },
};

// { ok: true, uid, familyId } for a member of a family; otherwise
// { ok: false, status, error }, ready to send.
export async function verifyFamilyMember(req) {
  if (!firebaseProjectId()) {
    return { ok: false, status: 500, error: 'The Firebase project is not configured.' };
  }
  const idToken = bearerToken(req);
  const uid = idToken ? uidOf(idToken) : null;
  if (!uid) return { ok: false, ...REFUSED['bad-token'] };

  const user = await readAsCaller(idToken, `users/${uid}`, 'familyId');
  if (typeof user === 'string') return { ok: false, ...REFUSED[user] };
  const familyId = user.familyId?.stringValue;
  if (!familyId || !ID.test(familyId)) return { ok: false, ...REFUSED.denied };

  const family = await readAsCaller(idToken, `families/${familyId}`, 'memberIds');
  if (typeof family === 'string') return { ok: false, ...REFUSED[family] };
  // The rules have already said yes; this is the same test, read back.
  const memberIds = (family.memberIds?.arrayValue?.values || []).map((v) => v.stringValue);
  if (!memberIds.includes(uid)) return { ok: false, ...REFUSED.denied };

  return { ok: true, uid, familyId };
}
