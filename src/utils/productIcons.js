// Lightweight emoji-based product icons. We have no hand-drawn asset library,
// so emojis give every tile a recognizable picture that renders the same on
// every platform, with no network or bundle cost.

// Curated set shown in the icon picker. Ordered roughly by how common each
// category is in a household shopping list.
export const PRODUCT_ICONS = [
  '🛒', '🍞', '🥐', '🥖', '🧀', '🥚', '🥛', '🧈', '🥩', '🍗',
  '🐟', '🦐', '🍤', '🥓', '🌭', '🍖', '🍝', '🍚', '🥫', '🫙',
  '🥔', '🥕', '🧅', '🧄', '🍅', '🥬', '🥦', '🌽', '🥒', '🫑',
  '🍎', '🍌', '🍇', '🍓', '🍊', '🍋', '🍐', '🍑', '🍒', '🥝',
  '🍉', '🍈', '🥥', '🥑', '🍄', '🌶️', '🫛', '🥜', '🌰', '🍯',
  '☕', '🍵', '🧃', '🥤', '🍷', '🍺', '🧉', '💧', '🧊', '🍫',
  '🍪', '🍰', '🧁', '🍩', '🍬', '🍿', '🥨', '🧂', '🌿', '🧊',
  '🧻', '🧼', '🧴', '🪥', '🧽', '🪒', '🧺', '🔋', '💊', '🐾',
];

// Keyword → emoji. Keys are matched as substrings against the lowercased name,
// so "Bio Vollmilch" still resolves to 🥛 via "milch". German and English
// keywords both included since the app is bilingual.
const KEYWORD_ICONS = [
  [['brot', 'bread', 'toast', 'semmel', 'brötchen', 'baguette'], '🍞'],
  [['croissant', 'gipfel'], '🥐'],
  [['käse', 'kase', 'cheese', 'philadelphia', 'gouda', 'feta'], '🧀'],
  [['ei', 'egg'], '🥚'],
  [['milch', 'milk'], '🥛'],
  [['joghurt', 'jogurt', 'yogurt', 'yoghurt', 'quark'], '🥛'],
  [['butter'], '🧈'],
  [['rind', 'steak', 'hack', 'beef', 'fleisch', 'meat'], '🥩'],
  [['hähnchen', 'haehnchen', 'huhn', 'chicken', 'pute'], '🍗'],
  [['fisch', 'fish', 'lachs', 'salmon', 'thunfisch', 'tuna'], '🐟'],
  [['garnel', 'shrimp', 'prawn'], '🦐'],
  [['speck', 'bacon'], '🥓'],
  [['wurst', 'würstchen', 'sausage', 'salami'], '🌭'],
  [['nudel', 'pasta', 'spaghetti', 'fusilli', 'penne', 'noodle'], '🍝'],
  [['reis', 'rice'], '🍚'],
  [['mehl', 'flour', 'dinkel'], '🌾'],
  [['kartoffel', 'potato', 'erdäpfel', 'erdapfel'], '🥔'],
  [['karotte', 'möhre', 'mohre', 'carrot'], '🥕'],
  [['zwiebel', 'onion'], '🧅'],
  [['knoblauch', 'garlic'], '🧄'],
  [['tomate', 'tomato'], '🍅'],
  [['salat', 'lettuce', 'spinat', 'spinach'], '🥬'],
  [['brokkoli', 'broccoli'], '🥦'],
  [['mais', 'corn'], '🌽'],
  [['gurke', 'cucumber', 'essiggurk'], '🥒'],
  [['paprika', 'pepper'], '🫑'],
  [['apfel', 'äpfel', 'apple'], '🍎'],
  [['banane', 'banana'], '🍌'],
  [['traube', 'grape', 'weintrauben'], '🍇'],
  [['erdbeere', 'strawberry'], '🍓'],
  [['orange', 'apfelsine'], '🍊'],
  [['zitrone', 'lemon', 'limette', 'lime'], '🍋'],
  [['birne', 'pear'], '🍐'],
  [['pfirsich', 'peach'], '🍑'],
  [['kirsche', 'cherry'], '🍒'],
  [['kiwi'], '🥝'],
  [['melone', 'melon'], '🍉'],
  [['avocado'], '🥑'],
  [['pilz', 'champignon', 'mushroom'], '🍄'],
  [['nuss', 'nut', 'mandel', 'almond'], '🥜'],
  [['honig', 'honey'], '🍯'],
  [['kaffee', 'coffee'], '☕'],
  [['tee', 'tea'], '🍵'],
  [['saft', 'juice'], '🧃'],
  [['cola', 'limo', 'soda', 'sprudel'], '🥤'],
  [['wein', 'wine'], '🍷'],
  [['bier', 'beer'], '🍺'],
  [['wasser', 'water'], '💧'],
  [['schoko', 'chocolate', 'kakao'], '🍫'],
  [['keks', 'cookie', 'biscuit'], '🍪'],
  [['kuchen', 'cake', 'torte'], '🍰'],
  [['muffin', 'cupcake'], '🧁'],
  [['donut', 'krapfen'], '🍩'],
  [['bonbon', 'candy', 'süßigkeit', 'gummi'], '🍬'],
  [['chips', 'popcorn'], '🍿'],
  [['brezel', 'pretzel', 'salzstang'], '🥨'],
  [['salz', 'salt', 'pfeffer', 'gewürz', 'spice'], '🧂'],
  [['vanille', 'vanilla'], '🌿'],
  [['klopapier', 'toilettenpapier', 'toilet', 'küchenrolle', 'taschentuch', 'tissue'], '🧻'],
  [['seife', 'soap', 'spülmittel', 'waschmittel', 'detergent'], '🧼'],
  [['shampoo', 'duschgel', 'lotion'], '🧴'],
  [['zahnbürste', 'toothbrush', 'zahnpasta', 'toothpaste'], '🪥'],
  [['schwamm', 'sponge'], '🧽'],
  [['rasier', 'razor', 'shave'], '🪒'],
  [['batterie', 'battery', 'akku'], '🔋'],
  [['medikament', 'tablette', 'pille', 'medicine', 'pill'], '💊'],
  [['hund', 'katze', 'tierfutter', 'dog', 'cat', 'pet'], '🐾'],
];

// Sentinel stored in an item's `icon` field to mean "show the product's first
// letter instead of an emoji". Resolved at render time so it tracks the title
// if the name is edited.
export const LETTER_ICON = '__letter__';

// First letter of a product name, uppercased, for the letter-icon style.
export function productInitial(name) {
  const ch = (name || '').trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

export function guessProductIcon(name) {
  const lower = (name || '').toLowerCase();
  if (!lower.trim()) return '🛒';
  for (const [keywords, icon] of KEYWORD_ICONS) {
    if (keywords.some((kw) => lower.includes(kw))) return icon;
  }
  return '🛒';
}
