import { useMemo } from 'react';
import useAuth from './useAuth';
import useUIPreferences from './useUIPreferences';
import { updateNavLayout } from '../services/families';
import { resolveNavLayout, sanitizeBottomNav } from '../utils/navLayout';
import { sanitizeQuickAccess } from '../utils/quickAccess';
import {
  BOTTOM_NAV_IDS,
  BOTTOM_NAV_MAX,
  BOTTOM_NAV_MIN,
  BOTTOM_NAV_REQUIRED,
  DEFAULT_BOTTOM_NAV,
} from '../constants/bottomNavEntries';
import { DEFAULT_QUICK_ACCESS, QUICK_ACCESS_IDS } from '../constants/quickAccessEntries';

const BOTTOM_NAV_RULES = {
  allIds: BOTTOM_NAV_IDS,
  min: BOTTOM_NAV_MIN,
  max: BOTTOM_NAV_MAX,
  required: BOTTOM_NAV_REQUIRED,
  defaults: DEFAULT_BOTTOM_NAV,
};
const QUICK_ACCESS_RULES = { allIds: QUICK_ACCESS_IDS, defaults: DEFAULT_QUICK_ACCESS };

// The bottom navigation and the Dashboard's Quick Access, as this family set
// them up. Both are stored on the family document, so a change made on one
// phone shows up for every member on every device.
//
// Without a family (or before anyone customised Quick Access) the device-local
// Quick Access preference is used, which is what the app did before.
export default function useNavLayout() {
  const { family } = useAuth();
  const { quickAccess: localQuickAccess, setQuickAccess: setLocalQuickAccess } = useUIPreferences();
  const familyId = family?.id;
  const stored = family?.navLayout;

  const layout = useMemo(
    () =>
      resolveNavLayout({
        stored,
        fallbackQuickAccess: localQuickAccess,
        quickAccess: QUICK_ACCESS_RULES,
        bottomNav: BOTTOM_NAV_RULES,
      }),
    [stored, localQuickAccess],
  );

  function setBottomNav(next) {
    const clean = sanitizeBottomNav(next, BOTTOM_NAV_RULES);
    if (!clean || !familyId) return Promise.resolve();
    return updateNavLayout(familyId, { bottomNav: clean });
  }

  function setQuickAccess(next) {
    const clean = sanitizeQuickAccess(next, QUICK_ACCESS_IDS);
    if (!clean) return Promise.resolve();
    if (!familyId) {
      setLocalQuickAccess(clean);
      return Promise.resolve();
    }
    return updateNavLayout(familyId, { quickAccess: clean, quickAccessSeen: QUICK_ACCESS_IDS });
  }

  function resetNavLayout() {
    if (!familyId) {
      setLocalQuickAccess(DEFAULT_QUICK_ACCESS);
      return Promise.resolve();
    }
    return updateNavLayout(familyId, {
      bottomNav: null,
      quickAccess: DEFAULT_QUICK_ACCESS,
      quickAccessSeen: QUICK_ACCESS_IDS,
    });
  }

  return { ...layout, canEdit: Boolean(familyId), setBottomNav, setQuickAccess, resetNavLayout };
}
