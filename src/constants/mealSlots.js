// The three meal slots planned for each day of the week. Order here is the
// order they render top-to-bottom in the weekly plan.
export const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
];

export const MEAL_SLOT_IDS = MEAL_SLOTS.map((s) => s.id);

export function getSlotLabel(id) {
  return MEAL_SLOTS.find((s) => s.id === id)?.label || id;
}
