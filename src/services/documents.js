import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_DOC_CATEGORY, DEFAULT_TROPHY_CATEGORY } from '../constants/documentCategories';

const docsRef = collection(db, 'documents');

function normalizeCategory(type, category) {
  const defaultId = type === 'trophy' ? DEFAULT_TROPHY_CATEGORY : DEFAULT_DOC_CATEGORY;
  return typeof category === 'string' && category.trim() ? category : defaultId;
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

export function subscribeDocuments(familyId, cb) {
  const q = query(docsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => {
    const list = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          category: normalizeCategory(data.type, data.category),
          date: toDate(data.date),
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      })
      .sort((a, b) => {
        const ta = a.createdAt ? a.createdAt.getTime() : 0;
        const tb = b.createdAt ? b.createdAt.getTime() : 0;
        return tb - ta;
      });
    cb(list);
  });
}

export function createDocument({
  familyId,
  userId,
  type,
  title,
  category,
  notes,
  date,
  fileUrl,
  filePublicId,
  awardedTo,
}) {
  return addDoc(docsRef, {
    familyId,
    userId,
    type: type === 'trophy' ? 'trophy' : 'document',
    title: title.trim(),
    category: normalizeCategory(type, category),
    notes: notes?.trim() || '',
    date: Timestamp.fromDate(date),
    fileUrl: fileUrl || null,
    filePublicId: filePublicId || null,
    awardedTo: awardedTo?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateDocument(id, fields) {
  const { type, title, category, notes, date, fileUrl, filePublicId, awardedTo } = fields;
  return updateDoc(doc(db, 'documents', id), {
    title: title.trim(),
    category: normalizeCategory(type, category),
    notes: notes?.trim() || '',
    date: Timestamp.fromDate(date),
    fileUrl: fileUrl || null,
    filePublicId: filePublicId || null,
    awardedTo: awardedTo?.trim() || null,
    updatedAt: serverTimestamp(),
  });
}

// Note: does not delete the file from Cloudinary — a server-side function
// would be needed for that. The Cloudinary file remains accessible via its URL.
export function deleteDocument(id) {
  return deleteDoc(doc(db, 'documents', id));
}
