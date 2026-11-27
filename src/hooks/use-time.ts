import { useSyncExternalStore } from 'react';

const subscribeNever = () => () => undefined;

/** False during server render and hydration, true afterwards. Avoids clock/locale mismatches. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
}

/**
 * One shared minute clock for the whole app. Every `useNow` caller reads the same value from a
 * single interval, so five screens do not each run their own timer, and they all update together.
 */
export const CLOCK_INTERVAL_MS = 60_000;

let current = new Date();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  current = new Date();
  listeners.forEach((listener) => listener());
}

function subscribeClock(listener: () => void): () => void {
  if (listeners.size === 0) {
    current = new Date();
    timer = setInterval(tick, CLOCK_INTERVAL_MS);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getClockSnapshot(): Date {
  // With nobody subscribed the value can be stale (for example after a long idle period).
  // Refresh it, but only when it is clearly old, so repeated reads in one render stay equal.
  if (listeners.size === 0 && Math.abs(Date.now() - current.getTime()) > CLOCK_INTERVAL_MS) {
    current = new Date();
  }
  return current;
}

/** Current time, refreshed once a minute from the shared clock. */
export function useNow(): Date {
  return useSyncExternalStore(subscribeClock, getClockSnapshot, getClockSnapshot);
}
