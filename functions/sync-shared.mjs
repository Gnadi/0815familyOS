// Copies the app's reminder rules and texts into ./shared.
//
// `firebase deploy` uploads only this folder, so the function cannot import
// from ../src. Instead of a second copy kept by hand, the files are copied
// fresh before every deploy (the predeploy hook in firebase.json) and before
// the integration tests; ./shared is ignored by git.

import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');
const out = join(here, 'shared');

const FILES = {
  'utils/reminders.js': 'reminders.js',
  'utils/recurrence.js': 'recurrence.js',
  'utils/tracker.js': 'tracker.js',
  'i18n/locales/en.js': 'locales/en.js',
  'i18n/locales/de.js': 'locales/de.js',
};

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'locales'), { recursive: true });
for (const [from, to] of Object.entries(FILES)) cpSync(join(src, from), join(out, to));
console.log(`Copied ${Object.keys(FILES).length} files into functions/shared.`);
