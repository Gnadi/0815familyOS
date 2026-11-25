import { useMemo } from 'react';
import useAuth from './useAuth';
import {
  mergeDocCategories,
  mergeTrophyCategories,
  getDocCategoryDynamic,
  getTrophyCategoryDynamic,
} from '../constants/documentCategories';

// Stable fallback: a fresh `[]` per render would defeat the useMemo below.
const NONE = [];

export default function useVaultCategories(vaultType) {
  const { family } = useAuth();
  const isTrophy = vaultType === 'trophy';

  const custom   = isTrophy ? (family?.customTrophyCategories   || NONE) : (family?.customDocCategories   || NONE);
  const disabled = isTrophy ? (family?.disabledTrophyCategories || NONE) : (family?.disabledDocCategories || NONE);

  return useMemo(() => {
    const list = isTrophy
      ? mergeTrophyCategories(custom, disabled)
      : mergeDocCategories(custom, disabled);
    return {
      list,
      get: (id) => isTrophy
        ? getTrophyCategoryDynamic(id, custom)
        : getDocCategoryDynamic(id, custom),
    };
  }, [isTrophy, custom, disabled]);
}
