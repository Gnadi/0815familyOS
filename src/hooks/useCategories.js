import { useMemo } from 'react';
import useAuth from './useAuth';
import {
  DEFAULT_CATEGORY,
  getCategoryById,
  mergeCategories,
} from '../constants/eventCategories';

export default function useCategories() {
  const { family } = useAuth();
  const custom = family?.customCategories || [];
  const disabled = family?.disabledBuiltins || [];

  return useMemo(() => {
    const list = mergeCategories(custom, disabled);
    return {
      list,
      get: (id) => getCategoryById(id || DEFAULT_CATEGORY, custom),
    };
  }, [custom, disabled]);
}
