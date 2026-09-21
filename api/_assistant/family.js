// What a chatbot needs to know about one family before it can fill in an
// entry: the children's names, the adults' names, and the categories this
// family actually uses.
//
// Read with the service account, scoped to the familyId that came off the
// pairing token -- never from the request.

import { getDocument } from './firestore.js';
import { mergeCategories } from '../../src/constants/eventCategories.js';
import { TASK_CATEGORY_LIST } from '../../src/constants/taskCategories.js';

// Labels here are the English source labels, not the user's UI language: they
// are read by a model, and the ids are what travels back.
const TASK_CATEGORIES = TASK_CATEGORY_LIST.map((c) => ({ id: c.id, label: c.label }));

export class FamilyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FamilyError';
  }
}

export async function loadFamilyContext(familyId) {
  const family = await getDocument(`families/${familyId}`);
  if (!family) throw new FamilyError('The family this token belongs to no longer exists.');

  const kids = (Array.isArray(family.kids) ? family.kids : [])
    .filter((kid) => kid && kid.id && kid.name)
    .map((kid) => ({ id: kid.id, name: String(kid.name) }));

  const memberIds = (Array.isArray(family.memberIds) ? family.memberIds : []).slice(0, 16);
  const memberDocs = await Promise.all(
    memberIds.map((uid) => getDocument(`users/${uid}`).catch(() => null)),
  );
  const members = memberDocs
    .map((doc, index) => ({
      id: memberIds[index],
      name: String(doc?.displayName || '').trim(),
    }))
    .filter((member) => member.name);

  const categories = mergeCategories(
    Array.isArray(family.customCategories) ? family.customCategories : [],
    Array.isArray(family.disabledBuiltins) ? family.disabledBuiltins : [],
  ).map((c) => ({ id: c.id, label: c.label }));

  return { familyId, name: family.name || '', kids, members, categories, taskCategories: TASK_CATEGORIES };
}
