import { getBook, getCategory } from '@/data/catalogue';
import { BOOKS, CATEGORIES, PROFESSIONS } from '@/data/seed';
import { buildOrder } from '@/domain/orders';
import {
  computeDueAt,
  daysOverdue,
  daysRemaining,
  isDueWithinDay,
  rentalStatus,
} from '@/domain/pricing';
import { recommendBooks, type RecommendationInput } from '@/domain/recommendations';
import { countNeedingAttention, dueLabel } from '@/domain/rentals';
import { DEFAULT_FILTERS, filterBooks, normaliseQuery } from '@/domain/search';
import type { CartLine, Rental } from '@/domain/types';
import { firstParam, parseAllowed } from '@/utils/params';

const at = (iso: string) => new Date(iso);

function rental(over: Partial<Rental> = {}): Rental {
  return {
    id: 'r1',
    orderId: 'o1',
    bookId: 'b01',
    termDays: 7,
    startAt: '2025-03-01T10:00:00.000Z',
    dueAt: '2025-03-08T10:00:00.000Z',
    price: 285,
    ...over,
  };
}

describe('rental dates: overdue and due-soon boundaries', () => {
  const due = rental({ dueAt: '2025-03-10T12:00:00.000Z' });

  it('never reports negative zero for a rental overdue by less than a day', () => {
    const days = daysRemaining(due, at('2025-03-10T18:00:00.000Z'));
    expect(Object.is(days, -0)).toBe(false);
    expect(days).toBe(0);
  });

  it('counts a started day as a day overdue and never says 0 days overdue', () => {
    expect(daysOverdue(due, at('2025-03-10T12:00:00.001Z'))).toBe(1);
    expect(daysOverdue(due, at('2025-03-11T12:00:00.000Z'))).toBe(1);
    expect(daysOverdue(due, at('2025-03-11T12:00:00.001Z'))).toBe(2);
    expect(daysOverdue(due, at('2025-03-20T12:00:00.000Z'))).toBe(10);
  });

  it('labels a rental overdue by a few hours as overdue, not "Due today"', () => {
    const now = at('2025-03-10T18:00:00.000Z');
    expect(rentalStatus(due, now)).toBe('overdue');
    expect(dueLabel(due, now)).toBe('1 day overdue');
  });

  it('labels the last 24 hours before the due date', () => {
    expect(dueLabel(due, at('2025-03-10T12:00:00.000Z'))).toBe('Due within 24 hours');
    expect(dueLabel(due, at('2025-03-09T12:00:01.000Z'))).toBe('Due within 24 hours');
    expect(isDueWithinDay(due, at('2025-03-09T12:00:00.000Z'))).toBe(false);
    expect(dueLabel(due, at('2025-03-09T12:00:00.000Z'))).toBe('1 day left');
  });

  it('pluralises days left and overdue', () => {
    expect(dueLabel(due, at('2025-03-07T12:00:00.000Z'))).toBe('3 days left');
    expect(dueLabel(due, at('2025-03-13T12:00:00.000Z'))).toBe('3 days overdue');
  });

  it('is not due-within-a-day once the due date has passed', () => {
    expect(isDueWithinDay(due, at('2025-03-10T12:00:00.001Z'))).toBe(false);
  });

  it('shows the return date for a returned rental, even if it was returned late', () => {
    const late = rental({
      dueAt: '2025-03-08T10:00:00.000Z',
      returnedAt: '2025-03-12T10:00:00.000Z',
    });
    expect(rentalStatus(late, at('2025-04-01T00:00:00.000Z'))).toBe('returned');
    expect(dueLabel(late, at('2025-04-01T00:00:00.000Z'))).toMatch(/^Returned /);
  });
});

describe('rental dates: calendar edge cases', () => {
  it('adds 7 and 30 days across a month end', () => {
    expect(computeDueAt(at('2025-01-28T09:00:00.000Z'), 7).toISOString()).toBe(
      '2025-02-04T09:00:00.000Z',
    );
    expect(computeDueAt(at('2025-01-31T09:00:00.000Z'), 30).toISOString()).toBe(
      '2025-03-02T09:00:00.000Z',
    );
  });

  it('handles leap day in a leap year and a non-leap year', () => {
    expect(computeDueAt(at('2024-02-23T09:00:00.000Z'), 7).toISOString()).toBe(
      '2024-03-01T09:00:00.000Z',
    );
    expect(computeDueAt(at('2025-02-23T09:00:00.000Z'), 7).toISOString()).toBe(
      '2025-03-02T09:00:00.000Z',
    );
    expect(computeDueAt(at('2024-02-29T09:00:00.000Z'), 30).toISOString()).toBe(
      '2024-03-30T09:00:00.000Z',
    );
  });

  it('adds whole 24-hour UTC days across a daylight-saving change', () => {
    // US clocks go forward on 2025-03-09. The due time must not drift by an hour.
    expect(computeDueAt(at('2025-03-05T15:00:00.000Z'), 7).toISOString()).toBe(
      '2025-03-12T15:00:00.000Z',
    );
  });

  it('adds across a year end', () => {
    expect(computeDueAt(at('2024-12-28T00:00:00.000Z'), 7).toISOString()).toBe(
      '2025-01-04T00:00:00.000Z',
    );
  });
});

describe('needs-attention count', () => {
  const now = at('2025-03-10T12:00:00.000Z');

  it('counts due-soon and overdue rentals that are still out', () => {
    const rentals = [
      rental({ id: 'ok', dueAt: '2025-03-25T00:00:00.000Z' }),
      rental({ id: 'soon', dueAt: '2025-03-11T12:00:00.000Z' }),
      rental({ id: 'late', dueAt: '2025-03-05T12:00:00.000Z' }),
      rental({
        id: 'done',
        dueAt: '2025-03-05T12:00:00.000Z',
        returnedAt: '2025-03-06T00:00:00.000Z',
      }),
    ];
    expect(countNeedingAttention(rentals, now)).toBe(2);
  });

  it('is zero for no rentals', () => {
    expect(countNeedingAttention([], now)).toBe(0);
  });
});

describe('search: accents and category names', () => {
  const run = (query: string, extra = {}) =>
    filterBooks(BOOKS, { ...DEFAULT_FILTERS, query, ...extra }, (id) => getCategory(id)?.name).map(
      (book) => book.id,
    );

  it('finds an accented author with an unaccented query, and the reverse', () => {
    const tomas = BOOKS.find((book) => book.author === 'Tomás Reyes')!.id;
    expect(run('tomas reyes')).toEqual([tomas]);
    expect(run('Tomás')).toEqual([tomas]);
    expect(run('lucia')).toContain('b09');
    expect(run('VALDÉS')).toContain('b23');
  });

  it('normalises queries: case, accents, surrounding spaces and length', () => {
    expect(normaliseQuery('  TOMÁS  ')).toBe('tomas');
    expect(normaliseQuery('a'.repeat(500))).toHaveLength(80);
  });

  it('finds books by category name when a category lookup is supplied', () => {
    const science = BOOKS.filter((book) => book.categoryId === 'science').map((book) => book.id);
    expect(science.length).toBeGreaterThan(0);
    expect(run('science')).toEqual(expect.arrayContaining(science));
  });

  it('does not match category names without a lookup, so existing callers are unchanged', () => {
    const withoutLookup = filterBooks(BOOKS, { ...DEFAULT_FILTERS, query: 'self-help' }).map(
      (book) => book.id,
    );
    const selfHelp = BOOKS.filter((book) => book.categoryId === 'self-help').map((book) => book.id);
    expect(selfHelp.length).toBeGreaterThan(0);
    // Matching by title, author or tag only: at least one self-help book is not matched.
    expect(selfHelp.every((id) => withoutLookup.includes(id))).toBe(false);
  });

  it('requires every word to match, across fields', () => {
    expect(run('science zzzz')).toEqual([]);
    expect(run('tomas fiction').length).toBeLessThanOrEqual(1);
  });

  it('treats whitespace-only and empty queries as no query', () => {
    expect(run('   ')).toHaveLength(BOOKS.length);
    expect(run('')).toHaveLength(BOOKS.length);
  });

  it('does not treat query text as a pattern', () => {
    expect(() => run('.*(')).not.toThrow();
    expect(run('.*')).toEqual([]);
    expect(run('<script>')).toEqual([]);
  });

  it('combines category, availability and query filters', () => {
    const result = filterBooks(
      BOOKS,
      { ...DEFAULT_FILTERS, categoryId: 'art', availability: 'buyable', query: 'sketch' },
      (id) => getCategory(id)?.name,
    );
    expect(result.every((book) => book.categoryId === 'art' && book.stockBuy > 0)).toBe(true);
  });

  it('returns nothing for an unknown category id instead of everything', () => {
    expect(run('', { categoryId: 'nope' })).toEqual([]);
  });

  it('keeps sort order stable and deterministic for equal values', () => {
    const first = filterBooks(BOOKS, { ...DEFAULT_FILTERS, sort: 'priceAsc' }).map((b) => b.id);
    const second = filterBooks([...BOOKS].reverse(), { ...DEFAULT_FILTERS, sort: 'priceAsc' }).map(
      (b) => b.id,
    );
    expect(second).toEqual(first);
  });

  it('does not change the input array', () => {
    const copy = [...BOOKS];
    filterBooks(BOOKS, { ...DEFAULT_FILTERS, sort: 'priceDesc' });
    expect(BOOKS).toEqual(copy);
  });
});

describe('URL param parsing', () => {
  const allowed = ['a', 'b'] as const;

  it('takes the first value of a repeated param', () => {
    expect(firstParam(['x', 'y'])).toBe('x');
    expect(firstParam('x')).toBe('x');
    expect(firstParam(undefined)).toBeUndefined();
    expect(firstParam([])).toBeUndefined();
  });

  it('accepts only allowlisted values and falls back otherwise', () => {
    expect(parseAllowed('b', allowed, 'a')).toBe('b');
    expect(parseAllowed(['b', 'a'], allowed, 'a')).toBe('b');
    expect(parseAllowed('c', allowed, 'a')).toBe('a');
    expect(parseAllowed(undefined, allowed, 'a')).toBe('a');
    expect(parseAllowed('__proto__', allowed, 'a')).toBe('a');
    expect(parseAllowed('', allowed, 'a')).toBe('a');
  });
});

describe('recommendations: availability', () => {
  const base: RecommendationInput = {
    books: BOOKS,
    categories: CATEGORIES,
    professions: PROFESSIONS,
    professionId: null,
    interestIds: ['art'],
    library: {},
    activeRentalBookIds: [],
    limit: 50,
  };

  it('has a fully unavailable book in the catalogue to test with', () => {
    const b21 = getBook('b21')!;
    expect(b21.stockBuy).toBe(0);
    expect(b21.rentable).toBe(false);
  });

  it('never recommends a book that can be neither bought nor rented', () => {
    const result = recommendBooks(base);
    expect(result.items.some((item) => item.book.id === 'b21')).toBe(false);
    // It is in the Art category the reader picked, so it would otherwise rank.
    expect(result.items.some((item) => item.book.categoryId === 'art')).toBe(true);
  });

  it('still recommends a book that can only be bought, or only rented', () => {
    const buyOnly = BOOKS.find((book) => book.stockBuy > 0 && !book.rentable)!;
    const result = recommendBooks({ ...base, interestIds: [buyOnly.categoryId] });
    expect(result.items.some((item) => item.book.id === buyOnly.id)).toBe(true);
  });

  it('keeps unavailable books out of the popular fallback too', () => {
    const books = BOOKS.map((book) =>
      book.id === 'b21' ? { ...book, bestseller: true, rating: 5 } : book,
    );
    const result = recommendBooks({ ...base, books, interestIds: [], limit: 20 });
    expect(result.personalised).toBe(false);
    expect(result.items.some((item) => item.book.id === 'b21')).toBe(false);
  });

  it('is deterministic for the same input', () => {
    expect(recommendBooks(base)).toEqual(recommendBooks(base));
  });

  it('returns only popular books for an empty profile', () => {
    const result = recommendBooks({ ...base, interestIds: [] });
    expect(result.personalised).toBe(false);
    expect(result.items.every((item) => item.score === 0)).toBe(true);
  });
});

describe('orders: validation edge cases', () => {
  const NOW = at('2025-03-10T12:00:00.000Z');
  let n = 0;
  const makeId = (prefix: string) => `${prefix}_${(n += 1)}`;
  const rent = (bookId: string, termDays: 7 | 30 = 7): CartLine => ({
    id: `${bookId}:rent`,
    bookId,
    mode: 'rent',
    quantity: 1,
    termDays,
  });
  const buy = (bookId: string, quantity = 1): CartLine => ({
    id: `${bookId}:buy`,
    bookId,
    mode: 'buy',
    quantity,
  });
  const place = (lines: CartLine[], existingRentals: Rental[] = []) =>
    buildOrder({ lines, existingRentals, getBook, now: NOW, makeId });

  it('rejects an empty cart', () => {
    expect(place([])).toEqual({ ok: false, errors: ['Your cart is empty.'] });
  });

  it('rejects a book that is already rented and not yet returned', () => {
    const result = place([rent('b01')], [rental({ bookId: 'b01' })]);
    expect(result.ok).toBe(false);
  });

  it('allows renting a book again after it was returned', () => {
    const returned = rental({ bookId: 'b01', returnedAt: '2025-03-09T00:00:00.000Z' });
    expect(place([rent('b01')], [returned]).ok).toBe(true);
  });

  it('allows renting a book again when its earlier rental is expired but was returned', () => {
    const returned = rental({
      bookId: 'b01',
      dueAt: '2025-03-01T00:00:00.000Z',
      returnedAt: '2025-03-08T00:00:00.000Z',
    });
    expect(place([rent('b01')], [returned]).ok).toBe(true);
  });

  it('blocks a new rental while an expired one has not been returned', () => {
    const expired = rental({ bookId: 'b01', dueAt: '2025-03-01T00:00:00.000Z' });
    expect(place([rent('b01')], [expired]).ok).toBe(false);
  });

  it('enforces the concurrent rental limit exactly at the boundary', () => {
    const rentable = BOOKS.filter((book) => book.rentable && book.stockRent > 0);
    const held = rentable.slice(0, 4).map((book, i) => rental({ id: `h${i}`, bookId: book.id }));
    // 4 held + 1 new = 5: allowed.
    expect(place([rent(rentable[4].id)], held).ok).toBe(true);
    // 4 held + 2 new = 6: rejected.
    expect(place([rent(rentable[4].id), rent(rentable[5].id)], held).ok).toBe(false);
  });

  it('does not count returned rentals toward the limit', () => {
    const rentable = BOOKS.filter((book) => book.rentable && book.stockRent > 0);
    const held = rentable
      .slice(0, 5)
      .map((book, i) =>
        rental({ id: `h${i}`, bookId: book.id, returnedAt: '2025-03-09T00:00:00.000Z' }),
      );
    expect(place([rent(rentable[5].id)], held).ok).toBe(true);
  });

  it('rejects out-of-stock, non-rentable and over-quantity lines', () => {
    expect(place([buy('b21')]).ok).toBe(false);
    expect(place([rent('b21')]).ok).toBe(false);
    expect(place([rent('b09')]).ok).toBe(false);
    expect(place([buy('b01', 999)]).ok).toBe(false);
    expect(place([buy('b01', 0)]).ok).toBe(false);
  });

  it('rejects an unknown book and a rental term outside 7 or 30', () => {
    expect(place([buy('does-not-exist')]).ok).toBe(false);
    expect(place([{ ...rent('b01'), termDays: 14 as 7 }]).ok).toBe(false);
  });

  it('is all-or-nothing: one bad line rejects the whole order', () => {
    const result = place([buy('b01'), buy('b21')]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.length).toBeGreaterThan(0);
  });

  it('does not repeat the same error twice', () => {
    const result = place([buy('x1'), buy('x2')]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(new Set(result.errors).size).toBe(result.errors.length);
  });

  it('builds the due date from the order time for each term', () => {
    const result = place([rent('b01', 7), rent('b02', 30)]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const byBook = Object.fromEntries(result.rentals.map((r) => [r.bookId, r.dueAt]));
      expect(byBook.b01).toBe('2025-03-17T12:00:00.000Z');
      expect(byBook.b02).toBe('2025-04-09T12:00:00.000Z');
    }
  });
});
