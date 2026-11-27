import type { Book, CartLine, Rental, RentalStatus, RentalTerm } from './types';

/**
 * Placeholder business rules (see plan section 11a). Replace with business-approved
 * values; nothing else in the app hard-codes these numbers.
 */
export const RENTAL_RATES: Record<RentalTerm, number> = { 7: 0.15, 30: 0.3 };
export const LATE_FEE = 500;
export const DUE_SOON_DAYS = 2;
export const SHIPPING_FLAT = 400;
export const FREE_SHIPPING_OVER = 4000;
export const MAX_CONCURRENT_RENTALS = 5;
/** A rental can be renewed this many times, and only while nobody is waiting for the book. */
export const MAX_RENEWALS = 1;
export const MAX_BUY_QUANTITY = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function rentalPrice(book: Pick<Book, 'buyPrice'>, term: RentalTerm): number {
  return Math.round(book.buyPrice * RENTAL_RATES[term]);
}

export function lineUnitPrice(book: Book, line: Pick<CartLine, 'mode' | 'termDays'>): number {
  if (line.mode === 'rent') return rentalPrice(book, line.termDays ?? 7);
  return book.buyPrice;
}

export function maxBuyQuantity(book: Pick<Book, 'stockBuy'>): number {
  return Math.max(0, Math.min(book.stockBuy, MAX_BUY_QUANTITY));
}

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  shipping: number;
  total: number;
}

export function computeCartTotals(
  lines: readonly CartLine[],
  getBook: (id: string) => Book | undefined,
): CartTotals {
  let itemCount = 0;
  let subtotal = 0;
  for (const line of lines) {
    const book = getBook(line.bookId);
    if (!book) continue;
    itemCount += line.quantity;
    subtotal += lineUnitPrice(book, line) * line.quantity;
  }
  const shipping = itemCount === 0 || subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
  return { itemCount, subtotal, shipping, total: subtotal + shipping };
}

export function computeDueAt(start: Date, term: RentalTerm): Date {
  const due = new Date(start.getTime());
  due.setUTCDate(due.getUTCDate() + term);
  return due;
}

export function rentalStatus(
  rental: Pick<Rental, 'dueAt' | 'returnedAt'>,
  now: Date,
): RentalStatus {
  if (rental.returnedAt) return 'returned';
  const msLeft = new Date(rental.dueAt).getTime() - now.getTime();
  if (msLeft < 0) return 'overdue';
  if (msLeft <= DUE_SOON_DAYS * DAY_MS) return 'dueSoon';
  return 'active';
}

/** Whole days until due (negative once overdue). */
export function daysRemaining(rental: Pick<Rental, 'dueAt'>, now: Date): number {
  // `|| 0` turns -0 (overdue by under a day, after ceil) into a plain 0.
  return Math.ceil((new Date(rental.dueAt).getTime() - now.getTime()) / DAY_MS) || 0;
}

/**
 * Days past the due date, counting a started day as a day. Always at least 1, so an
 * expired rental never reads "0 days overdue" or "due today".
 */
export function daysOverdue(rental: Pick<Rental, 'dueAt'>, now: Date): number {
  return Math.max(1, Math.ceil((now.getTime() - new Date(rental.dueAt).getTime()) / DAY_MS));
}

/** True when the rental is still out and falls due within the next 24 hours. */
export function isDueWithinDay(rental: Pick<Rental, 'dueAt'>, now: Date): boolean {
  const msLeft = new Date(rental.dueAt).getTime() - now.getTime();
  return msLeft >= 0 && msLeft < DAY_MS;
}

export function formatShortDate(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
