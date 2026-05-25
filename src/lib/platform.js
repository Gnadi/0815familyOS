import { Capacitor } from '@capacitor/core';

export const platform = Capacitor.getPlatform();
export const isNative = Capacitor.isNativePlatform();
export const isIOS = platform === 'ios';
export const isAndroid = platform === 'android';
export const isWeb = platform === 'web';
