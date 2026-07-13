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
import { isDemoMode } from '../lib/demoMode';
import { demoAdd, demoDelete, demoSubscribe, demoUpdate } from './demoStore';

const docsRef = collection(db, 'documents');

const nowVal = () => (isDemoMode() ? new Date() : serverTimestamp());
const dateVal = (d) => (isDemoMode() ? d : Timestamp.fromDate(d));

function normalizeCategory(type, category) {
  const defaultId = type === 'trophy' ? DEFAULT_TROPHY_CATEGORY : DEFAULT_DOC_CATEGORY;
  return typeof category === 'string' && category.trim() ? category : defaultId;
}

function toDate(value) {
  if (!value) return null;
  return value?.toDate ? value.toDate() : value;
}

function mapDocumentDocs(docs) {
  return docs
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
}

export function subscribeDocuments(familyId, cb) {
  if (isDemoMode()) return demoSubscribe('documents', (docs) => cb(mapDocumentDocs(docs)));
  const q = query(docsRef, where('familyId', '==', familyId));
  return onSnapshot(q, (snap) => cb(mapDocumentDocs(snap.docs)));
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
  fileName,
  awardedTo,
}) {
  const payload = {
    familyId,
    userId,
    type: type === 'trophy' ? 'trophy' : 'document',
    title: title.trim(),
    category: normalizeCategory(type, category),
    notes: notes?.trim() || '',
    date: dateVal(date),
    fileUrl: fileUrl || null,
    filePublicId: filePublicId || null,
    fileName: fileName || null,
    awardedTo: awardedTo?.trim() || null,
    createdAt: nowVal(),
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoAdd('documents', payload);
  return addDoc(docsRef, payload);
}

export function updateDocument(id, fields) {
  const { type, title, category, notes, date, fileUrl, filePublicId, fileName, awardedTo } = fields;
  const payload = {
    title: title.trim(),
    category: normalizeCategory(type, category),
    notes: notes?.trim() || '',
    date: dateVal(date),
    fileUrl: fileUrl || null,
    filePublicId: filePublicId || null,
    fileName: fileName || null,
    awardedTo: awardedTo?.trim() || null,
    updatedAt: nowVal(),
  };
  if (isDemoMode()) return demoUpdate('documents', id, payload);
  return updateDoc(doc(db, 'documents', id), payload);
}

// Note: does not delete the file from Cloudinary — a server-side function
// would be needed for that. The Cloudinary file remains accessible via its URL.
export function deleteDocument(id) {
  if (isDemoMode()) return demoDelete('documents', id);
  return deleteDoc(doc(db, 'documents', id));
}
