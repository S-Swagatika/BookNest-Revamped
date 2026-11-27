import { useContext } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 } as const;

/**
 * Notch and home-indicator insets. Unlike `useSafeAreaInsets`, this does not throw when there is
 * no provider (web static render, unit tests): it returns zeros instead.
 */
export function useInsets() {
  return useContext(SafeAreaInsetsContext) ?? NO_INSETS;
}
