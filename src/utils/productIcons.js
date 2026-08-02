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
  // 🌾 replaces a second, duplicate 🧊 — flour resolves to it below, so
  // without it the picker could never show a flour tile as selected.
  '🍪', '🍰', '🧁', '🍩', '🍬', '🍿', '🥨', '🧂', '🌿', '🌾',
  '🧻', '🧼', '🧴', '🪥', '🧽', '🪒', '🧺', '🔋', '💊', '🐾',
];

// Keyword → emoji. Keys are matched as substrings against the lowercased name,
// so "Bio Vollmilch" still resolves to 🥛 via "milch". German and English
// keywords both included since the app is bilingual.
const KEYWORD_ICONS = [
  [['brot', 'bread', 'toast', 'semmel', 'brötchen', 'baguette'], '🍞'],
  [['croissant', 'gipfel'], '🥐'],
  [['käse', 'kase', 'cheese', 'philadelphia', 'gouda', 'feta', 'parmesan', 'mozzarella'], '🧀'],
  [['ei', 'eier', 'egg', 'eggs'], '🥚'],
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
  [['schoko', 'chocolate', 'kakao', 'nutella', 'nougat'], '🍫'],
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

// Substring matching is load-bearing for German compounds ("Bio Vollmilch" →
// "milch" → 🥛), but it wrecks very short keywords: "ei" sits near the top of
// the list and first match wins, so Reis, Fleisch and Weintrauben all came out
// as 🥚, and "nut" claimed Nutella. Keywords of three characters or fewer
// therefore have to match as whole words.
//
// \b is unusable here: it treats ä/ö/ü as word boundaries, so "Öl" and
// "Müsli" would break. The boundary is spelled out as "not a letter or digit"
// with the Unicode flag instead.
const SHORT_KEYWORD_MAX = 3;

const WORD_MATCHERS = new Map(
  KEYWORD_ICONS.flatMap(([keywords]) =>
    keywords
      .filter((kw) => kw.length <= SHORT_KEYWORD_MAX)
      .map((kw) => [kw, new RegExp(`(^|[^\\p{L}\\p{N}])${kw}([^\\p{L}\\p{N}]|$)`, 'u')]),
  ),
);

function keywordMatches(keyword, haystack) {
  const wordRe = WORD_MATCHERS.get(keyword);
  return wordRe ? wordRe.test(haystack) : haystack.includes(keyword);
}

export function guessProductIcon(name) {
  const lower = (name || '').toLowerCase();
  if (!lower.trim()) return '🛒';
  for (const [keywords, icon] of KEYWORD_ICONS) {
    if (keywords.some((kw) => keywordMatches(kw, lower))) return icon;
  }
  return '🛒';
}
