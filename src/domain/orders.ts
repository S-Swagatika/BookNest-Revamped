import {
  MAX_CONCURRENT_RENTALS,
  computeCartTotals,
  computeDueAt,
  lineUnitPrice,
  maxBuyQuantity,
  rentalPrice,
} from './pricing';
import type { Book, CartLine, Order, OrderLine, Rental } from './types';

export type PlaceOrderResult =
  { ok: true; order: Order; rentals: Rental[] } | { ok: false; errors: string[] };

export interface PlaceOrderInput {
  lines: readonly CartLine[];
  existingRentals: readonly Rental[];
  getBook: (id: string) => Book | undefined;
  now: Date;
  makeId: (prefix: string) => string;
}

/**
 * Validates the cart against current catalogue rules and builds an order plus rentals.
 * Pure: the caller commits the result in one step, so placement is all-or-nothing.
 */
export function buildOrder(input: PlaceOrderInput): PlaceOrderResult {
  const { lines, existingRentals, getBook, now, makeId } = input;
  const errors: string[] = [];

  if (lines.length === 0) return { ok: false, errors: ['Your cart is empty.'] };

  const activeRentals = existingRentals.filter((rental) => !rental.returnedAt);
  const newRentalCount = lines.filter((line) => line.mode === 'rent').length;
  if (activeRentals.length + newRentalCount > MAX_CONCURRENT_RENTALS) {
    errors.push(`You can rent up to ${MAX_CONCURRENT_RENTALS} books at a time.`);
  }

  for (const line of lines) {
    const book = getBook(line.bookId);
    if (!book) {
      errors.push('A book in your cart is no longer available.');
      continue;
    }
    if (line.mode === 'buy') {
      if (line.quantity < 1 || line.quantity > maxBuyQuantity(book)) {
        errors.push(`“${book.title}” is not available in that quantity.`);
      }
    } else {
      if (!book.rentable || book.stockRent < 1) {
        errors.push(`“${book.title}” is not available to rent right now.`);
      }
      if (line.quantity !== 1) errors.push(`“${book.title}” can only be rented one at a time.`);
      if (activeRentals.some((rental) => rental.bookId === line.bookId)) {
        errors.push(`You are already renting “${book.title}”.`);
      }
      if (
        lines.filter((other) => other.mode === 'rent' && other.bookId === line.bookId).length > 1
      ) {
        errors.push(`“${book.title}” is in your cart more than once.`);
      }
      if (line.termDays !== 7 && line.termDays !== 30) {
        errors.push(`Choose a 7 or 30 day rental for “${book.title}”.`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] };

  const orderId = makeId('ord');
  const createdAt = now.toISOString();
  const totals = computeCartTotals(lines, getBook);
  const orderLines: OrderLine[] = [];
  const rentals: Rental[] = [];

  for (const line of lines) {
    const book = getBook(line.bookId) as Book;
    orderLines.push({
      bookId: book.id,
      title: book.title,
      mode: line.mode,
      quantity: line.quantity,
      termDays: line.termDays,
      unitPrice: lineUnitPrice(book, line),
    });
    if (line.mode === 'rent' && line.termDays) {
      rentals.push({
        id: makeId('rnt'),
        orderId,
        bookId: book.id,
        termDays: line.termDays,
        startAt: createdAt,
        dueAt: computeDueAt(now, line.termDays).toISOString(),
        price: rentalPrice(book, line.termDays),
      });
    }
  }

  return {
    ok: true,
    order: {
      id: orderId,
      createdAt,
      lines: orderLines,
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      total: totals.total,
    },
    rentals,
  };
}
