import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.js'],
    // `npm test` targets tests/unit; the rules suite lives in tests/rules and
    // needs the emulator around it (`npm run test:rules`).
    // The rules suite talks to the Firestore emulator over the network and
    // seeds documents between assertions; the default 5 s is too tight on a
    // cold emulator.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
