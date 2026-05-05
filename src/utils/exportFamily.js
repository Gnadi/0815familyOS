import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const COLLECTIONS = ['events', 'tasks', 'gifts', 'documents', 'vaccinations', 'shoppingItems'];

function toPlain(value) {
  if (value === null || value === undefined) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = toPlain(value[k]);
    return out;
  }
  return value;
}

async function fetchCollection(name, familyId) {
  const q = query(collection(db, name), where('familyId', '==', familyId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...toPlain(d.data()) }));
}

export async function exportFamilyData({ family, user, userDoc }) {
  const familyId = family?.id;
  if (!familyId) throw new Error('No family to export.');

  const dumps = await Promise.all(
    COLLECTIONS.map((name) => fetchCollection(name, familyId).then((rows) => [name, rows])),
  );

  const payload = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user: { uid: user?.uid, email: user?.email, displayName: userDoc?.displayName },
    family: toPlain({ ...family, encryptionKeyJwk: undefined }),
    collections: Object.fromEntries(dumps),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `familyos-${(family?.name || 'family').toLowerCase().replace(/\s+/g, '-')}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
