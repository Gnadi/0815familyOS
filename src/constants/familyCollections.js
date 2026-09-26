// Every Firestore collection that holds family data, keyed by a `familyId`
// field. The backup in src/utils/exportFamily.js dumps exactly these, so a new
// module's collection has to be added here or it silently goes missing from
// every export. tests/unit/familyCollections.spec.js checks this list against
// firestore.rules to catch that.
export const FAMILY_COLLECTIONS = [
  'events',
  'tasks',
  'gifts',
  'documents',
  'vaccinations',
  'shoppingItems',
  'recipes',
  'mealPlanEntries',
  'trackers',
  'trackerEntries',
];
