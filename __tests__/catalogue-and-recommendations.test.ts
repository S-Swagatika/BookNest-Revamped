import { BOOKS, CATEGORIES, PROFESSIONS } from '@/data/seed';
import { DEFAULT_FILTERS, filterBooks } from '@/domain/search';

describe('seed data', () => {
  it('has unique ids and valid categories', () => {
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(BOOKS.length);
    const categoryIds = new Set(CATEGORIES.map((c) => c.id));
    for (const book of BOOKS) expect(categoryIds.has(book.categoryId)).toBe(true);
  });

  it('stores prices as integer cents', () => {
    for (const book of BOOKS) expect(Number.isInteger(book.buyPrice)).toBe(true);
  });

  it('only references real categories in profession maps', () => {
    const categoryIds = new Set(CATEGORIES.map((c) => c.id));
    for (const profession of PROFESSIONS) {
      for (const id of profession.categoryIds) expect(categoryIds.has(id)).toBe(true);
    }
  });
});

describe('search and filters', () => {
  it('returns every book with default filters', () => {
    expect(filterBooks(BOOKS, DEFAULT_FILTERS)).toHaveLength(BOOKS.length);
  });

  it('matches title, author and tags case-insensitively', () => {
    expect(filterBooks(BOOKS, { ...DEFAULT_FILTERS, query: 'LANTERN' }).map((b) => b.id)).toEqual([
      'b01',
    ]);
    expect(filterBooks(BOOKS, { ...DEFAULT_FILTERS, query: 'okonkwo' }).map((b) => b.id)).toEqual([
      'b10',
    ]);
    expect(filterBooks(BOOKS, { ...DEFAULT_FILTERS, query: 'programming' }).length).toBeGreaterThan(
      1,
    );
  });

  it('requires every search word to match', () => {
    expect(filterBooks(BOOKS, { ...DEFAULT_FILTERS, query: 'lantern zzzz' })).toHaveLength(0);
  });

  it('filters by category', () => {
    const result = filterBooks(BOOKS, { ...DEFAULT_FILTERS, categoryId: 'art' });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((b) => b.categoryId === 'art')).toBe(true);
  });

  it('excludes out-of-stock and non-rentable books from availability filters', () => {
    const rentable = filterBooks(BOOKS, { ...DEFAULT_FILTERS, availability: 'rentable' });
    expect(rentable.every((b) => b.rentable && b.stockRent > 0)).toBe(true);
    const buyable = filterBooks(BOOKS, { ...DEFAULT_FILTERS, availability: 'buyable' });
    expect(buyable.some((b) => b.id === 'b21')).toBe(false);
  });

  it('sorts by price', () => {
    const asc = filterBooks(BOOKS, { ...DEFAULT_FILTERS, sort: 'priceAsc' });
    for (let i = 1; i < asc.length; i += 1)
      expect(asc[i].buyPrice).toBeGreaterThanOrEqual(asc[i - 1].buyPrice);
  });

  it('ignores very long input safely', () => {
    expect(() => filterBooks(BOOKS, { ...DEFAULT_FILTERS, query: 'a'.repeat(5000) })).not.toThrow();
  });
});
