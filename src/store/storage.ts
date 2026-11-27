import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/** No-op storage used during web static rendering, where `window` does not exist. */
const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

const isServer = typeof window === 'undefined';

/**
 * Storage can fail at runtime: the browser quota is full, private mode blocks writes, or the
 * device is out of space. The app must keep working from memory instead of crashing, so every
 * call is guarded. Error details are not logged because the values can hold personal data.
 */
export const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // Keep the in-memory state; the change just will not survive a restart.
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // Nothing to clean up.
    }
  },
};

/**
 * AsyncStorage on native, localStorage-backed on web. Only non-sensitive app data is
 * stored here; never tokens or card details.
 */
export const persistStorage = createJSONStorage(() => (isServer ? memoryStorage : safeStorage));
