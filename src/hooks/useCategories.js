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

  return useMemo(() => {
    const list = mergeCategories(custom);
    return {
      list,
      get: (id) => getCategoryById(id || DEFAULT_CATEGORY, custom),
    };
  }, [custom]);
}
