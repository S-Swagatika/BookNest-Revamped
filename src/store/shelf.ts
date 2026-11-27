import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { getBook, getWaitlistCount } from '@/data/catalogue';
import {
  applyPurchase,
  applyRental,
  applyStatus,
  canRemoveFromLibrary,
  removeFromLibrary,
  type Library,
} from '@/domain/library';
import { buildOrder } from '@/domain/orders';
import { checkRenewal, applyRenewal, renewalPrice } from '@/domain/rentals';
import { RENTAL_TERMS } from '@/domain/types';
import type {
  LibraryEntry,
  Order,
  ReadingStatus,
  Renewal,
  Rental,
  RentalTerm,
} from '@/domain/types';
import { makeId } from '@/utils/clock';

import { useCartStore } from './cart';
import { persistStorage } from './storage';

export type CheckoutResult = { ok: true; order: Order } | { ok: false; errors: string[] };
export type RenewResult = { ok: true; rental: Rental } | { ok: false; reason: string };

interface ShelfState {
  library: Library;
  rentals: Rental[];
  orders: Order[];
  setStatus: (bookId: string, status: ReadingStatus) => void;
  removeBook: (bookId: string) => boolean;
  returnRental: (rentalId: string) => void;
  /** Extends an active rental by 7 or 30 days if the renewal rules allow it. */
  renewRental: (rentalId: string, term: RentalTerm) => RenewResult;
  placeOrder: () => CheckoutResult;
}

const STATUSES: readonly ReadingStatus[] = ['wantToRead', 'reading', 'finished'];

function isValidEntry(value: unknown): value is LibraryEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as LibraryEntry;
  return (
    typeof entry.bookId === 'string' &&
    !!getBook(entry.bookId) &&
    STATUSES.includes(entry.status) &&
    typeof entry.owned === 'boolean'
  );
}

function isValidRenewal(value: unknown): value is Renewal {
  if (!value || typeof value !== 'object') return false;
  const renewal = value as Renewal;
  return (
    RENTAL_TERMS.includes(renewal.termDays) &&
    !Number.isNaN(Date.parse(renewal.dueAt)) &&
    !Number.isNaN(Date.parse(renewal.renewedAt)) &&
    typeof renewal.price === 'number'
  );
}

function isValidRental(value: unknown): value is Rental {
  if (!value || typeof value !== 'object') return false;
  const rental = value as Rental;
  return (
    typeof rental.id === 'string' &&
    !!getBook(rental.bookId) &&
    (rental.termDays === 7 || rental.termDays === 30) &&
    !Number.isNaN(Date.parse(rental.dueAt)) &&
    (rental.renewals === undefined ||
      (Array.isArray(rental.renewals) && rental.renewals.every(isValidRenewal)))
  );
}

function isValidOrder(value: unknown): value is Order {
  if (!value || typeof value !== 'object') return false;
  const order = value as Order;
  return (
    typeof order.id === 'string' && Array.isArray(order.lines) && typeof order.total === 'number'
  );
}

export const useShelfStore = create<ShelfState>()(
  persist(
    (set, get) => ({
      library: {},
      rentals: [],
      orders: [],
      setStatus: (bookId, status) => {
        if (!getBook(bookId) || !STATUSES.includes(status)) return;
        set((state) => ({
          library: applyStatus(state.library, bookId, status, new Date().toISOString()),
        }));
      },
      removeBook: (bookId) => {
        const { library, rentals } = get();
        if (!canRemoveFromLibrary(library, rentals, bookId)) return false;
        set({ library: removeFromLibrary(library, bookId) });
        return true;
      },
      returnRental: (rentalId) =>
        set((state) => ({
          rentals: state.rentals.map((rental) =>
            rental.id === rentalId && !rental.returnedAt
              ? { ...rental, returnedAt: new Date().toISOString() }
              : rental,
          ),
        })),
      renewRental: (rentalId, term) => {
        const rental = get().rentals.find((item) => item.id === rentalId);
        if (!rental) return { ok: false, reason: 'We could not find that rental.' };
        if (!RENTAL_TERMS.includes(term)) return { ok: false, reason: 'Choose 7 or 30 days.' };
        const book = getBook(rental.bookId);
        const now = new Date();
        const check = checkRenewal(rental, book, getWaitlistCount(rental.bookId), now);
        if (!check.ok || !book) {
          return {
            ok: false,
            reason: check.ok ? 'This title is no longer available.' : check.message,
          };
        }
        const renewed = applyRenewal(rental, term, renewalPrice(book, term), now);
        set((state) => ({
          rentals: state.rentals.map((item) => (item.id === rentalId ? renewed : item)),
        }));
        return { ok: true, rental: renewed };
      },
      /**
       * Order, rentals and library entries are computed first and committed together,
       * so a failed validation never leaves a half-created order behind.
       */
      placeOrder: () => {
        const cart = useCartStore.getState();
        const now = new Date();
        const result = buildOrder({
          lines: cart.lines,
          existingRentals: get().rentals,
          getBook,
          now,
          makeId,
        });
        if (!result.ok) return result;

        const nowIso = now.toISOString();
        let library = get().library;
        for (const line of result.order.lines) {
          library =
            line.mode === 'buy'
              ? applyPurchase(library, line.bookId, nowIso)
              : applyRental(library, line.bookId, nowIso);
        }
        set((state) => ({
          library,
          rentals: [...result.rentals, ...state.rentals],
          orders: [result.order, ...state.orders],
        }));
        cart.clear();
        return { ok: true, order: result.order };
      },
    }),
    {
      name: 'booknest.shelf',
      version: 1,
      storage: persistStorage,
      partialize: ({ library, rentals, orders }) => ({ library, rentals, orders }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<
          Pick<ShelfState, 'library' | 'rentals' | 'orders'>
        >;
        const library: Library = {};
        if (saved.library && typeof saved.library === 'object') {
          for (const entry of Object.values(saved.library)) {
            if (isValidEntry(entry)) library[entry.bookId] = entry;
          }
        }
        return {
          ...current,
          library,
          rentals: Array.isArray(saved.rentals) ? saved.rentals.filter(isValidRental) : [],
          orders: Array.isArray(saved.orders) ? saved.orders.filter(isValidOrder) : [],
        };
      },
    },
  ),
);
