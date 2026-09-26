import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAMILY_COLLECTIONS } from '../../src/constants/familyCollections';

// Collections in firestore.rules that are not family data: account and
// membership plumbing, which the export writes separately (or, for invites,
// deliberately leaves out).
const NOT_FAMILY_DATA = ['users', 'families', 'invites'];

function ruleCollections() {
  const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');
  return [...rules.matchAll(/match \/(\w+)\/\{\w+\}/g)]
    .map((m) => m[1])
    .filter((name) => name !== 'databases');
}

describe('FAMILY_COLLECTIONS', () => {
  it('covers every family-scoped collection in firestore.rules', () => {
    const expected = ruleCollections().filter((name) => !NOT_FAMILY_DATA.includes(name));
    expect([...FAMILY_COLLECTIONS].sort()).toEqual([...expected].sort());
  });

  it('includes the meal planner, which the backup used to skip', () => {
    expect(FAMILY_COLLECTIONS).toContain('recipes');
    expect(FAMILY_COLLECTIONS).toContain('mealPlanEntries');
  });
});
