import type { Book } from './types';

export type SortKey = 'featured' | 'priceAsc' | 'priceDesc' | 'rating' | 'newest';
export type Availability = 'all' | 'rentable' | 'buyable';

export interface BookFilters {
  query: string;
  categoryId: string | null;
  availability: Availability;
  sort: SortKey;
}

export const DEFAULT_FILTERS: BookFilters = {
  query: '',
  categoryId: null,
  availability: 'all',
  sort: 'featured',
};

export const MAX_QUERY_LENGTH = 80;

/** Lower-case and strip accents, so "tomas" finds "Tomás" and "CAFÉ" finds "cafe". */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normaliseQuery(query: string): string {
  return fold(query.slice(0, MAX_QUERY_LENGTH).trim());
}

/** Optional lookup so a search for "science" also finds books in the Science category. */
export type CategoryNameOf = (categoryId: string) => string | undefined;

function matchesQuery(book: Book, tokens: string[], categoryNameOf?: CategoryNameOf): boolean {
  const haystack = fold(
    [book.title, book.author, categoryNameOf?.(book.categoryId) ?? '', ...book.tags].join(' '),
  );
  return tokens.every((token) => haystack.includes(token));
}

function compare(sort: SortKey): (a: Book, b: Book) => number {
  switch (sort) {
    case 'priceAsc':
      return (a, b) => a.buyPrice - b.buyPrice || a.title.localeCompare(b.title);
    case 'priceDesc':
      return (a, b) => b.buyPrice - a.buyPrice || a.title.localeCompare(b.title);
    case 'rating':
      return (a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount;
    case 'newest':
      return (a, b) => b.year - a.year || Number(!!b.newArrival) - Number(!!a.newArrival);
    default:
      return (a, b) =>
        Number(!!b.featured) - Number(!!a.featured) ||
        Number(!!b.bestseller) - Number(!!a.bestseller) ||
        b.rating - a.rating;
  }
}

export function filterBooks(
  books: readonly Book[],
  filters: BookFilters,
  categoryNameOf?: CategoryNameOf,
): Book[] {
  const tokens = normaliseQuery(filters.query).split(/\s+/).filter(Boolean);
  return books
    .filter((book) => !filters.categoryId || book.categoryId === filters.categoryId)
    .filter((book) => {
      if (filters.availability === 'rentable') return book.rentable && book.stockRent > 0;
      if (filters.availability === 'buyable') return book.stockBuy > 0;
      return true;
    })
    .filter((book) => tokens.length === 0 || matchesQuery(book, tokens, categoryNameOf))
    .sort(compare(filters.sort));
}
