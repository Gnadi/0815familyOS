// Maps the tagged errors thrown by services/families.js and services/invites.js
// onto i18n keys, so the join form and the join page report the same thing.
const KEYS = {
  'invite/not-found': 'familySetup.errInviteNotFound',
  'invite/revoked': 'familySetup.errInviteRevoked',
  'invite/expired': 'familySetup.errInviteExpired',
  'demo/unavailable': 'familySetup.errDemoUnavailable',
  'permission-denied': 'familySetup.errInviteNotFound',
};

export function joinErrorMessage(err, t) {
  const key = KEYS[err?.code];
  if (key) return t(key);
  return err?.message || t('familySetup.errJoinFailed');
}
