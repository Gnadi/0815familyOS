import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import Spinner from '../common/Spinner';
import EmptyState from '../common/EmptyState';
import RecipeCard from './RecipeCard';

export default function RecipeList({ recipes, loading, onSelect }) {
  const [query, setQuery] = useState('');

  if (loading) return <Spinner />;

  const q = query.trim().toLowerCase();
  const filtered = q
    ? recipes.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.ingredients.toLowerCase().includes(q),
      )
    : recipes;

  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No recipes yet"
        description="Add a recipe by link or enter your own. Everyone in the family can contribute."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-400">
          No recipes match "{query}".
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} onClick={() => onSelect(recipe)} />
          ))}
        </div>
      )}
    </div>
  );
}
