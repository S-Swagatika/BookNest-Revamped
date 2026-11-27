/** Route params can be a string, a repeated string (array) or missing. Take the first value. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Only accept values from a known allowlist, so URL params can never inject state.
 * Anything else falls back to the default.
 */
export function parseAllowed<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = firstParam(value);
  return allowed.find((item) => item === raw) ?? fallback;
}
