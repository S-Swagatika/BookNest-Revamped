import {
  FREE_SHIPPING_OVER,
  SHIPPING_FLAT,
  computeCartTotals,
  computeDueAt,
  daysRemaining,
  formatMoney,
  rentalPrice,
  rentalStatus,
} from '@/domain/pricing';
import type { Book, CartLine } from '@/domain/types';

const book = (over: Partial<Book> = {}): Book => ({
  id: 'x',
  title: 'T',
  author: 'A',
  categoryId: 'fiction',
  tags: [],
  description: '',
  pages: 1,
  year: 2024,
  rating: 4,
  reviewCount: 1,
  buyPrice: 2000,
  rentable: true,
  stockBuy: 5,
  stockRent: 2,
  coverColor: '#000',
  coverAccent: '#fff',
  ...over,
});

describe('rental pricing', () => {
  it('prices 7 and 30 day terms from the purchase price in whole cents', () => {
    expect(rentalPrice(book({ buyPrice: 2000 }), 7)).toBe(300);
    expect(rentalPrice(book({ buyPrice: 2000 }), 30)).toBe(600);
    expect(rentalPrice(book({ buyPrice: 1899 }), 7)).toBe(285);
    expect(Number.isInteger(rentalPrice(book({ buyPrice: 1899 }), 30))).toBe(true);
  });

  it('formats money from cents', () => {
    expect(formatMoney(1899)).toBe('$18.99');
    expect(formatMoney(0)).toBe('$0.00');
  });
});

describe('rental dates and status', () => {
  const start = new Date('2025-01-10T12:00:00.000Z');

  it('computes the due date for 7 and 30 day terms', () => {
    expect(computeDueAt(start, 7).toISOString()).toBe('2025-01-17T12:00:00.000Z');
    expect(computeDueAt(start, 30).toISOString()).toBe('2025-02-09T12:00:00.000Z');
  });

  it('does not mutate the start date', () => {
    computeDueAt(start, 30);
    expect(start.toISOString()).toBe('2025-01-10T12:00:00.000Z');
  });

  const dueAt = '2025-01-17T12:00:00.000Z';
  it.each([
    ['2025-01-10T12:00:00.000Z', 'active'],
    ['2025-01-14T12:00:00.000Z', 'active'],
    ['2025-01-15T12:00:00.000Z', 'dueSoon'],
    ['2025-01-17T12:00:00.000Z', 'dueSoon'],
    ['2025-01-17T12:00:00.001Z', 'overdue'],
    ['2025-02-01T00:00:00.000Z', 'overdue'],
  ])('at %s the status is %s', (now, expected) => {
    expect(rentalStatus({ dueAt }, new Date(now))).toBe(expected);
  });

  it('is returned whenever a return date exists, even after the due date', () => {
    expect(
      rentalStatus({ dueAt, returnedAt: '2025-03-01T00:00:00.000Z' }, new Date('2025-04-01')),
    ).toBe('returned');
  });

  it('counts remaining days and goes negative when overdue', () => {
    expect(daysRemaining({ dueAt }, new Date('2025-01-10T12:00:00.000Z'))).toBe(7);
    expect(daysRemaining({ dueAt }, new Date('2025-01-17T12:00:00.000Z'))).toBe(0);
    expect(daysRemaining({ dueAt }, new Date('2025-01-19T12:00:00.000Z'))).toBe(-2);
  });
});

describe('cart totals', () => {
  const catalogue: Record<string, Book> = {
    a: book({ id: 'a', buyPrice: 1500 }),
    b: book({ id: 'b', buyPrice: 3000 }),
  };
  const get = (id: string) => catalogue[id];
  const line = (over: Partial<CartLine>): CartLine => ({
    id: 'l',
    bookId: 'a',
    mode: 'buy',
    quantity: 1,
    ...over,
  });

  it('is empty with no shipping for an empty cart', () => {
    expect(computeCartTotals([], get)).toEqual({
      itemCount: 0,
      subtotal: 0,
      shipping: 0,
      total: 0,
    });
  });

  it('adds flat shipping below the free-shipping threshold', () => {
    const totals = computeCartTotals([line({ quantity: 2 })], get);
    expect(totals.subtotal).toBe(3000);
    expect(totals.shipping).toBe(SHIPPING_FLAT);
    expect(totals.total).toBe(3000 + SHIPPING_FLAT);
  });

  it('gives free shipping at exactly the threshold', () => {
    const totals = computeCartTotals(
      [line({ bookId: 'b', quantity: 1 }), line({ id: 'm', quantity: 1 })],
      get,
    );
    expect(totals.subtotal).toBe(4500);
    expect(totals.subtotal).toBeGreaterThanOrEqual(FREE_SHIPPING_OVER);
    expect(totals.shipping).toBe(0);
  });

  it('prices a mixed buy and rent cart and treats the same book as separate lines', () => {
    const totals = computeCartTotals(
      [
        line({ id: 'buy', bookId: 'a', mode: 'buy', quantity: 1 }),
        line({ id: 'rent', bookId: 'a', mode: 'rent', quantity: 1, termDays: 30 }),
      ],
      get,
    );
    expect(totals.itemCount).toBe(2);
    expect(totals.subtotal).toBe(1500 + 450);
  });

  it('ignores lines whose book no longer exists', () => {
    const totals = computeCartTotals([line({ bookId: 'gone' })], get);
    expect(totals.itemCount).toBe(0);
    expect(totals.total).toBe(0);
  });
});
