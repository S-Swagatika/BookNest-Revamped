export type RentalTerm = 7 | 30;
export const RENTAL_TERMS: readonly RentalTerm[] = [7, 30];

export type CartMode = 'buy' | 'rent';
export type ReadingStatus = 'wantToRead' | 'reading' | 'finished';
export type RentalStatus = 'active' | 'dueSoon' | 'overdue' | 'returned';

export interface Category {
  id: string;
  name: string;
  blurb: string;
}

/** All money is stored as integer minor units (cents). */
export interface Book {
  id: string;
  title: string;
  author: string;
  categoryId: string;
  tags: string[];
  description: string;
  pages: number;
  year: number;
  rating: number;
  reviewCount: number;
  buyPrice: number;
  rentable: boolean;
  stockBuy: number;
  stockRent: number;
  coverColor: string;
  coverAccent: string;
  featured?: boolean;
  bestseller?: boolean;
  newArrival?: boolean;
}

export interface Profession {
  id: string;
  label: string;
  categoryIds: string[];
  tags: string[];
}

/** A work-related topic (a "professional interest"). Matched against book tags. */
export interface Topic {
  id: string;
  label: string;
  tags: string[];
}

/**
 * Something the reader wants out of their reading. A book supports a goal when it is in one of
 * the goal's categories, carries one of its tags, or (for length goals) is short enough.
 */
export interface ReadingGoal {
  id: string;
  label: string;
  categoryIds: string[];
  tags: string[];
  maxPages?: number;
}

export interface CartLine {
  id: string;
  bookId: string;
  mode: CartMode;
  quantity: number;
  termDays?: RentalTerm;
}

export interface OrderLine {
  bookId: string;
  title: string;
  mode: CartMode;
  quantity: number;
  termDays?: RentalTerm;
  unitPrice: number;
}

export interface Order {
  id: string;
  createdAt: string;
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
}

/** One paid extension of a rental. `dueAt` is the due date after this renewal. */
export interface Renewal {
  renewedAt: string;
  termDays: RentalTerm;
  previousDueAt: string;
  dueAt: string;
  price: number;
}

export interface Rental {
  id: string;
  orderId: string;
  bookId: string;
  termDays: RentalTerm;
  startAt: string;
  /** Current due date. Moves forward when the rental is renewed. */
  dueAt: string;
  returnedAt?: string;
  /** Price of the original term. Renewal fees are recorded on each renewal. */
  price: number;
  /** Absent on rentals saved before renewals existed. */
  renewals?: Renewal[];
}

export interface LibraryEntry {
  bookId: string;
  status: ReadingStatus;
  owned: boolean;
  addedAt: string;
  source: 'manual' | 'purchase' | 'rental';
  finishedAt?: string;
}
