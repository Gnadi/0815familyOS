// Reading a recipe out of a page (api/_lib/recipeSchema.js). What the endpoint
// does around it -- membership, which URLs -- is tests/unit/apiEndpoints.spec.js.

import { describe, expect, it } from 'vitest';
import { parseRecipeFromHtml } from '../../api/_lib/recipeSchema.js';

const page = (...blocks) => `<!doctype html><html><head>${blocks
  .map((b) => `<script type="application/ld+json">${typeof b === 'string' ? b : JSON.stringify(b)}</script>`)
  .join('')}</head><body><h1>Rezept</h1></body></html>`;

// As cookidoo.de publishes it: no recipeInstructions, entities in the text.
const COOKIDOO = {
  '@context': 'http://schema.org/',
  '@type': 'Recipe',
  name: 'Vollwert-Brötchen/Baguettes',
  totalTime: 'PT40M',
  recipeYield: '12 Stück',
  recipeCategory: ['Brot und Brötchen'],
  recipeIngredient: ['100 g Weizenkörner', '400 g Weizenmehl', '1 &frac12; TL Salz', '220 g Wasser'],
  author: { '@type': 'Organization', name: 'Vorwerk', url: 'https://cookidoo.de' },
  aggregateRating: { '@id': 'AggregatedRating' },
};

describe('parseRecipeFromHtml', () => {
  it('reads a Cookidoo page: ingredients and yield, no steps', () => {
    const html = page(COOKIDOO, { '@context': 'http://schema.org', '@type': 'AggregateRating', ratingValue: 4.3 });
    expect(parseRecipeFromHtml(html)).toEqual({
      title: 'Vollwert-Brötchen/Baguettes',
      ingredients: ['100 g Weizenkörner', '400 g Weizenmehl', '1 ½ TL Salz', '220 g Wasser'],
      instructions: [],
      servings: 12,
      category: null,
    });
  });

  it('finds the recipe inside @graph and reads HowToSteps and HowToSections', () => {
    const html = page({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Seite' },
        {
          '@type': ['Recipe', 'Thing'],
          name: 'Kaiserschmarrn',
          recipeYield: ['4', '4 Portionen'],
          recipeCategory: 'Dessert',
          recipeIngredient: ['200 g Mehl', ' ', '4 Eier'],
          recipeInstructions: [
            { '@type': 'HowToStep', text: 'Eier <b>trennen</b>.' },
            {
              '@type': 'HowToSection',
              name: 'Backen',
              itemListElement: [{ '@type': 'HowToStep', text: 'In der Pfanne  backen.' }],
            },
          ],
        },
      ],
    });
    expect(parseRecipeFromHtml(html)).toEqual({
      title: 'Kaiserschmarrn',
      ingredients: ['200 g Mehl', '4 Eier'],
      instructions: ['Eier trennen.', 'In der Pfanne backen.'],
      servings: 4,
      category: 'dessert',
    });
  });

  it('splits steps given as one block of text, one per line', () => {
    const html = page({ '@type': 'Recipe', name: 'Tee', recipeYield: 2, recipeInstructions: 'Wasser kochen.\nTee ziehen lassen.' });
    const recipe = parseRecipeFromHtml(html);
    expect(recipe.instructions).toEqual(['Wasser kochen.', 'Tee ziehen lassen.']);
    expect(recipe.servings).toBe(2);
  });

  it('maps the site category to ours where it can', () => {
    const withCategory = (recipeCategory) => parseRecipeFromHtml(page({ '@type': 'Recipe', name: 'x', recipeCategory })).category;
    expect(withCategory('Hauptgerichte mit Fleisch')).toBe('dinner');
    expect(withCategory(['Frühstück'])).toBe('breakfast');
    expect(withCategory('Getränke')).toBe('drinks');
    expect(withCategory('Saucen')).toBeNull();
  });

  it('skips blocks that are not JSON and finds the recipe after them', () => {
    expect(parseRecipeFromHtml(page('{ not json', COOKIDOO)).title).toBe('Vollwert-Brötchen/Baguettes');
  });

  it.each([
    ['a page without structured data', '<html><body>Lasagne</body></html>'],
    ['structured data that is no recipe', page({ '@type': 'Article', name: 'News' })],
    ['a recipe with nothing in it', page({ '@type': 'Recipe' })],
    ['no text at all', undefined],
  ])('returns null for %s', (_, html) => {
    expect(parseRecipeFromHtml(html)).toBeNull();
  });
});
