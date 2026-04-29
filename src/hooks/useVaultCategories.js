import { useMemo } from 'react';
import useAuth from './useAuth';
import {
  mergeDocCategories,
  mergeTrophyCategories,
  getDocCategoryDynamic,
  getTrophyCategoryDynamic,
} from '../constants/documentCategories';

export default function useVaultCategories(vaultType) {
  const { family } = useAuth();
  const isTrophy = vaultType === 'trophy';

  const custom   = isTrophy ? (family?.customTrophyCategories   || []) : (family?.customDocCategories   || []);
  const disabled = isTrophy ? (family?.disabledTrophyCategories || []) : (family?.disabledDocCategories || []);

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
