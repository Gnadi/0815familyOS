import { useMemo } from 'react';
import useAuth from './useAuth';
import {
  DEFAULT_CATEGORY,
  getCategoryById,
  mergeCategories,
} from '../constants/eventCategories';

// Stable fallback, so a family without custom categories does not hand the memo
// below a brand-new array on every render. Every EventCard calls this hook, and
// with a fresh `[]` the memo never hit and mergeCategories ran once per card
// per render.
const NONE = [];

export default function useCategories() {
  const { family } = useAuth();
  const custom = family?.customCategories || NONE;
  const disabled = family?.disabledBuiltins || NONE;

  return useMemo(() => {
    const list = mergeCategories(custom, disabled);
    return {
      list,
      get: (id) => getCategoryById(id || DEFAULT_CATEGORY, custom),
    };
  }, [custom, disabled]);
}
