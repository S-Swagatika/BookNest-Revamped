import type { Book, LibraryEntry, ReadingStatus, Rental } from './types';

export type Shelf = ReadingStatus | 'owned' | 'rented';

export const SHELVES: readonly { id: Shelf; label: string }[] = [
  { id: 'wantToRead', label: 'Want to read' },
  { id: 'reading', label: 'Reading' },
  { id: 'finished', label: 'Finished' },
  { id: 'owned', label: 'Owned' },
  { id: 'rented', label: 'Rented' },
];

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  wantToRead: 'Want to read',
  reading: 'Reading',
  finished: 'Finished',
};

export type Library = Record<string, LibraryEntry>;

/** Purchase marks the book as owned and keeps any reading status the user already set. */
export function applyPurchase(library: Library, bookId: string, nowIso: string): Library {
  const existing = library[bookId];
  const entry: LibraryEntry = existing
    ? { ...existing, owned: true }
    : { bookId, status: 'wantToRead', owned: true, addedAt: nowIso, source: 'purchase' };
  return { ...library, [bookId]: entry };
}

export function applyRental(library: Library, bookId: string, nowIso: string): Library {
  if (library[bookId]) return library;
  return {
    ...library,
    [bookId]: { bookId, status: 'wantToRead', owned: false, addedAt: nowIso, source: 'rental' },
  };
}

export function applyStatus(
  library: Library,
  bookId: string,
  status: ReadingStatus,
  nowIso: string,
): Library {
  const existing = library[bookId];
  const base: LibraryEntry = existing ?? {
    bookId,
    status,
    owned: false,
    addedAt: nowIso,
    source: 'manual',
  };
  const next: LibraryEntry = { ...base, status };
  if (status === 'finished') next.finishedAt = nowIso;
  else delete next.finishedAt;
  return { ...library, [bookId]: next };
}

/** Removal is not allowed for owned books or books with an active rental. */
export function canRemoveFromLibrary(
  library: Library,
  rentals: readonly Rental[],
  bookId: string,
): boolean {
  const entry = library[bookId];
  if (!entry || entry.owned) return false;
  return !rentals.some((rental) => rental.bookId === bookId && !rental.returnedAt);
}

export function removeFromLibrary(library: Library, bookId: string): Library {
  const next = { ...library };
  delete next[bookId];
  return next;
}

export function activeRentalBookIds(rentals: readonly Rental[]): string[] {
  return rentals.filter((rental) => !rental.returnedAt).map((rental) => rental.bookId);
}

/** Owned and Rented are derived views; the other shelves come from the reading status. */
export function booksOnShelf(
  shelf: Shelf,
  library: Library,
  rentals: readonly Rental[],
  getBook: (id: string) => Book | undefined,
): Book[] {
  let ids: string[];
  if (shelf === 'owned') {
    ids = Object.values(library)
      .filter((entry) => entry.owned)
      .map((entry) => entry.bookId);
  } else if (shelf === 'rented') {
    ids = activeRentalBookIds(rentals);
  } else {
    ids = Object.values(library)
      .filter((entry) => entry.status === shelf)
      .map((entry) => entry.bookId);
  }
  return [...new Set(ids)]
    .map(getBook)
    .filter((book): book is Book => book !== undefined)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function shelfCounts(library: Library, rentals: readonly Rental[]): Record<Shelf, number> {
  const counts: Record<Shelf, number> = {
    wantToRead: 0,
    reading: 0,
    finished: 0,
    owned: 0,
    rented: new Set(activeRentalBookIds(rentals)).size,
  };
  for (const entry of Object.values(library)) {
    counts[entry.status] += 1;
    if (entry.owned) counts.owned += 1;
  }
  return counts;
}
