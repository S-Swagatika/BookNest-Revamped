import { getBook } from '@/data/catalogue';
import {
  applyPurchase,
  applyRental,
  applyStatus,
  booksOnShelf,
  canRemoveFromLibrary,
  shelfCounts,
  type Library,
} from '@/domain/library';
import { buildOrder } from '@/domain/orders';
import { MAX_CONCURRENT_RENTALS } from '@/domain/pricing';
import type { CartLine, Rental } from '@/domain/types';

const NOW = new Date('2025-03-01T10:00:00.000Z');
const nowIso = NOW.toISOString();
let n = 0;
const makeId = (prefix: string) => `${prefix}_${(n += 1)}`;

const buy = (bookId: string, quantity = 1): CartLine => ({
  id: `${bookId}:buy`,
  bookId,
  mode: 'buy',
  quantity,
});
const rent = (bookId: string, termDays: 7 | 30 = 7): CartLine => ({
  id: `${bookId}:rent`,
  bookId,
  mode: 'rent',
  quantity: 1,
  termDays,
});
const activeRental = (bookId: string): Rental => ({
  id: `r_${bookId}`,
  orderId: 'o',
  bookId,
  termDays: 7,
  startAt: nowIso,
  dueAt: '2025-03-08T10:00:00.000Z',
  price: 100,
});

describe('library rules', () => {
  it('adds a purchased book as owned on the Want to read shelf', () => {
    const lib = applyPurchase({}, 'b01', nowIso);
    expect(lib.b01).toMatchObject({ owned: true, status: 'wantToRead', source: 'purchase' });
  });

  it('keeps the reading status when a book you already track is purchased', () => {
    let lib: Library = applyStatus({}, 'b01', 'reading', nowIso);
    lib = applyPurchase(lib, 'b01', nowIso);
    expect(lib.b01).toMatchObject({ owned: true, status: 'reading', source: 'manual' });
  });

  it('adds a rented book without marking it owned and never overwrites an entry', () => {
    const lib = applyRental({}, 'b02', nowIso);
    expect(lib.b02).toMatchObject({ owned: false, source: 'rental' });
    const finished = applyStatus(lib, 'b02', 'finished', nowIso);
    expect(applyRental(finished, 'b02', nowIso)).toBe(finished);
  });

  it('keeps exactly one status per book and stamps the finish date', () => {
    let lib = applyStatus({}, 'b03', 'reading', nowIso);
    lib = applyStatus(lib, 'b03', 'finished', nowIso);
    expect(lib.b03.status).toBe('finished');
    expect(lib.b03.finishedAt).toBe(nowIso);
    lib = applyStatus(lib, 'b03', 'reading', nowIso);
    expect(lib.b03.finishedAt).toBeUndefined();
  });

  it('derives the Owned and Rented shelves instead of storing them', () => {
    const lib = applyPurchase(applyRental({}, 'b02', nowIso), 'b01', nowIso);
    const rentals = [activeRental('b02')];
    expect(booksOnShelf('owned', lib, rentals, getBook).map((b) => b.id)).toEqual(['b01']);
    expect(booksOnShelf('rented', lib, rentals, getBook).map((b) => b.id)).toEqual(['b02']);
    const counts = shelfCounts(lib, rentals);
    expect(counts.owned).toBe(1);
    expect(counts.rented).toBe(1);
    expect(counts.wantToRead).toBe(2);
  });

  it('drops a returned rental from the Rented shelf', () => {
    const returned = { ...activeRental('b02'), returnedAt: nowIso };
    expect(booksOnShelf('rented', {}, [returned], getBook)).toHaveLength(0);
  });

  it('blocks removing owned books and books with an active rental', () => {
    const lib = applyRental(applyPurchase({}, 'b01', nowIso), 'b02', nowIso);
    expect(canRemoveFromLibrary(lib, [], 'b01')).toBe(false);
    expect(canRemoveFromLibrary(lib, [activeRental('b02')], 'b02')).toBe(false);
    expect(canRemoveFromLibrary(lib, [], 'b02')).toBe(true);
    expect(canRemoveFromLibrary(lib, [], 'nope')).toBe(false);
  });
});

describe('order validation', () => {
  const place = (lines: CartLine[], existingRentals: Rental[] = []) =>
    buildOrder({ lines, existingRentals, getBook, now: NOW, makeId });

  it('rejects an empty cart', () => {
    expect(place([])).toEqual({ ok: false, errors: ['Your cart is empty.'] });
  });

  it('creates an order, and a dated rental for each rented line', () => {
    const result = place([buy('b01', 2), rent('b02', 30)]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.lines).toHaveLength(2);
    expect(result.rentals).toHaveLength(1);
    expect(result.rentals[0]).toMatchObject({
      bookId: 'b02',
      termDays: 30,
      startAt: nowIso,
      dueAt: '2025-03-31T10:00:00.000Z',
    });
    expect(result.order.total).toBe(result.order.subtotal + result.order.shipping);
  });

  it('snapshots prices on the order lines', () => {
    const result = place([buy('b01')]);
    if (!result.ok) throw new Error('expected success');
    expect(result.order.lines[0]).toMatchObject({ title: 'The Lantern Archive', unitPrice: 1899 });
  });

  it('rejects quantities above stock', () => {
    const result = place([buy('b05', 99)]);
    expect(result.ok).toBe(false);
  });

  it('rejects out-of-stock and non-rentable books', () => {
    expect(place([buy('b21')]).ok).toBe(false);
    expect(place([rent('b09')]).ok).toBe(false);
    expect(place([rent('b21')]).ok).toBe(false);
  });

  it('rejects renting a book that is already being rented', () => {
    const result = place([rent('b02')], [activeRental('b02')]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(/already renting/);
  });

  it('enforces the concurrent rental limit', () => {
    const existing = ['b01', 'b02', 'b03', 'b04', 'b05'].map(activeRental);
    expect(existing).toHaveLength(MAX_CONCURRENT_RENTALS);
    expect(place([rent('b06')], existing).ok).toBe(false);
  });

  it('rejects rental terms other than 7 or 30 days', () => {
    const bad = { ...rent('b01'), termDays: 14 } as unknown as CartLine;
    expect(place([bad]).ok).toBe(false);
  });

  it('rejects unknown books', () => {
    expect(place([buy('missing')]).ok).toBe(false);
  });
});
