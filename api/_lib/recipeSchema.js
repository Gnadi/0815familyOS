// Reading a recipe out of a web page, for the "import from link" button.
//
// Recipe sites -- Cookidoo, Chefkoch and most others -- describe their recipes
// for search engines as schema.org/Recipe in a <script type="application/ld+json">
// block. That is what this reads; no site gets its own scraper. What a page
// keeps behind a login is not in that block either: Cookidoo publishes title,
// ingredients and yield, but its steps only to subscribers, so a Cookidoo
// import comes without steps. (Vercel serves no file under api/_lib, so this
// one is a module, not an endpoint.)

const LD_JSON = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;

const MAX_ITEMS = 200;
const MAX_TEXT = 2000;

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔', frac18: '⅛',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', deg: '°', ndash: '–', mdash: '—',
  hellip: '…', times: '×', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', bdquo: '„',
};

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X'
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[name] ?? match;
  });
}

// Plain text of a schema.org string: entities decoded, any markup and runs of
// whitespace dropped, length capped.
function clean(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return decodeEntities(String(value))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:!?])/g, '$1')
    .trim()
    .slice(0, MAX_TEXT);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function isType(node, type) {
  return asArray(node?.['@type']).some((t) => t === type || t === `schema:${type}`);
}

// Every object in the parsed JSON-LD, depth first: recipes sit at the top, in
// an array, in @graph, or under mainEntity.
function* walk(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 8) return;
  if (Array.isArray(node)) {
    for (const item of node) yield* walk(item, depth + 1);
    return;
  }
  yield node;
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') yield* walk(value, depth + 1);
  }
}

function findRecipe(html) {
  for (const [, body] of html.matchAll(LD_JSON)) {
    let data;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    for (const node of walk(data)) {
      if (isType(node, 'Recipe')) return node;
    }
  }
  return null;
}

// recipeInstructions comes as one string, a list of strings, HowToSteps, or
// HowToSections of HowToSteps.
function instructionsOf(value, out = []) {
  for (const item of asArray(value)) {
    if (out.length >= MAX_ITEMS) break;
    if (typeof item === 'string') {
      // A single block of text: one step per line.
      for (const line of decodeEntities(item).split(/\r?\n|<br\s*\/?>/i)) {
        const step = clean(line);
        if (step) out.push(step);
      }
    } else if (item && typeof item === 'object') {
      if (item.itemListElement) instructionsOf(item.itemListElement, out);
      else {
        const step = clean(item.text || item.name);
        if (step) out.push(step);
      }
    }
  }
  return out.slice(0, MAX_ITEMS);
}

// recipeYield is "4", 4, "4 Portionen", "12 Stück" or a list of those.
function servingsOf(value) {
  for (const item of asArray(value)) {
    const n = Number.parseInt(String(item).match(/\d+/)?.[0] ?? '', 10);
    if (Number.isInteger(n) && n > 0 && n <= 100) return n;
  }
  return null;
}

// The site's own category words, matched against the ids in
// src/constants/recipeCategories.js, first match wins. Nothing that matches
// leaves the choice to the form.
const CATEGORY_WORDS = {
  breakfast: ['frühstück', 'breakfast', 'brunch'],
  dessert: ['dessert', 'nachspeise', 'nachtisch', 'süßspeise', 'kuchen', 'torte', 'gebäck', 'cake', 'baking'],
  drinks: ['getränk', 'drink', 'beverage', 'smoothie', 'cocktail'],
  snack: ['snack', 'fingerfood', 'vorspeise', 'appetizer', 'starter'],
  lunch: ['mittag', 'lunch'],
  dinner: ['hauptgericht', 'hauptspeise', 'abendessen', 'main course', 'main dish', 'dinner'],
};

function categoryOf(value) {
  const words = asArray(value).map((v) => clean(v).toLowerCase()).filter(Boolean);
  for (const [id, keys] of Object.entries(CATEGORY_WORDS)) {
    if (words.some((w) => keys.some((k) => w.includes(k)))) return id;
  }
  return null;
}

// The recipe on the page, in the fields of the recipe form, or null when the
// page describes none.
export function parseRecipeFromHtml(html) {
  if (typeof html !== 'string') return null;
  const recipe = findRecipe(html);
  if (!recipe) return null;
  const title = clean(recipe.name || recipe.headline);
  const ingredients = asArray(recipe.recipeIngredient || recipe.ingredients)
    .map(clean)
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
  const instructions = instructionsOf(recipe.recipeInstructions);
  if (!title && ingredients.length === 0 && instructions.length === 0) return null;
  return {
    title,
    ingredients,
    instructions,
    servings: servingsOf(recipe.recipeYield),
    category: categoryOf([...asArray(recipe.recipeCategory), ...asArray(recipe.recipeCourse)]),
  };
}
