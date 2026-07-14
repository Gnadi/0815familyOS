// Demo mode: the whole app runs on seeded in-memory data (src/services/
// demoStore.js) and never contacts Firebase. The flag lives in sessionStorage
// so it is per-tab (a real login in another tab is unaffected), disappears
// when the tab closes, and survives a reload within the tab (the data simply
// re-seeds).
//
// IMPORTANT: enterDemo/exitDemo MUST stay hard navigations. AuthProvider and
// the service guards read the flag once per page load, so flipping it without
// a full reload would leave live Firebase or demo listeners from the previous
// state behind.

const KEY = 'faos:demo';

// Fallback for environments where sessionStorage throws (some private modes).
let memFlag = false;

export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(KEY) === '1';
  } catch {
    return memFlag;
  }
}

export function enterDemo() {
  try {
    window.sessionStorage.setItem(KEY, '1');
  } catch {
    memFlag = true;
  }
  window.location.assign('/dashboard');
}

export function exitDemo(target = '/') {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    memFlag = false;
  }
  window.location.assign(target);
}
