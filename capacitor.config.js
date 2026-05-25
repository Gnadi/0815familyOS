/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'com.familyos.app',
  appName: 'Family OS',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
