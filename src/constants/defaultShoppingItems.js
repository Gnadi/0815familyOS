// Starter products seeded into a brand-new family's shopping list so the page
// isn't empty on first use. They are created as "recently used" suggestions
// (done: true) — tapping a tile moves it into the "to buy" list — so a new
// family can assemble a list by picking from typical everyday/household items
// instead of typing every product from scratch.
//
// Each entry carries the title in every supported language plus an emoji icon
// (kept in sync with utils/productIcons guesses). `seedDefaultShoppingItems`
// picks the title for the family creator's active language.
export const DEFAULT_SHOPPING_ITEMS = [
  // Fridge / dairy
  { icon: '🥛', en: 'Milk', de: 'Milch' },
  { icon: '🧈', en: 'Butter', de: 'Butter' },
  { icon: '🥚', en: 'Eggs', de: 'Eier' },
  { icon: '🧀', en: 'Cheese', de: 'Käse' },
  { icon: '🥛', en: 'Yogurt', de: 'Joghurt' },
  // Bakery
  { icon: '🍞', en: 'Bread', de: 'Brot' },
  // Produce
  { icon: '🍎', en: 'Apples', de: 'Äpfel' },
  { icon: '🍌', en: 'Bananas', de: 'Bananen' },
  { icon: '🍅', en: 'Tomatoes', de: 'Tomaten' },
  { icon: '🥔', en: 'Potatoes', de: 'Kartoffeln' },
  { icon: '🧅', en: 'Onions', de: 'Zwiebeln' },
  { icon: '🥕', en: 'Carrots', de: 'Karotten' },
  { icon: '🥬', en: 'Salad', de: 'Salat' },
  // Meat / protein
  { icon: '🍗', en: 'Chicken', de: 'Hähnchen' },
  { icon: '🥩', en: 'Minced meat', de: 'Hackfleisch' },
  // Pantry / staples
  { icon: '🍝', en: 'Pasta', de: 'Nudeln' },
  { icon: '🍚', en: 'Rice', de: 'Reis' },
  { icon: '🌾', en: 'Flour', de: 'Mehl' },
  { icon: '🧂', en: 'Salt', de: 'Salz' },
  { icon: '☕', en: 'Coffee', de: 'Kaffee' },
  { icon: '🍵', en: 'Tea', de: 'Tee' },
  // Beverages
  { icon: '💧', en: 'Water', de: 'Wasser' },
  { icon: '🧃', en: 'Juice', de: 'Saft' },
  // Snacks
  { icon: '🍫', en: 'Chocolate', de: 'Schokolade' },
  // Household / hygiene
  { icon: '🧻', en: 'Toilet paper', de: 'Toilettenpapier' },
  { icon: '🧼', en: 'Dish soap', de: 'Spülmittel' },
  { icon: '🪥', en: 'Toothpaste', de: 'Zahnpasta' },
  { icon: '🧴', en: 'Shampoo', de: 'Shampoo' },
];
