let counter = 0;

/** Non-cryptographic local ids for mock data only. */
export function makeId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function now(): Date {
  return new Date();
}
