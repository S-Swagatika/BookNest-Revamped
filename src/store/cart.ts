import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { getBook } from '@/data/catalogue';
import { maxBuyQuantity } from '@/domain/pricing';
import { RENTAL_TERMS, type CartLine, type CartMode, type RentalTerm } from '@/domain/types';

import { persistStorage } from './storage';

export type AddResult = { ok: true } | { ok: false; reason: string };

interface CartState {
  lines: CartLine[];
  addBuy: (bookId: string) => AddResult;
  addRent: (bookId: string, term: RentalTerm) => AddResult;
  setQuantity: (lineId: string, quantity: number) => void;
  setTerm: (lineId: string, term: RentalTerm) => void;
  remove: (lineId: string) => void;
  clear: () => void;
}

export function lineId(bookId: string, mode: CartMode): string {
  return `${bookId}:${mode}`;
}

function isValidLine(value: unknown): value is CartLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as CartLine;
  if (typeof line.bookId !== 'string' || !getBook(line.bookId)) return false;
  if (line.mode !== 'buy' && line.mode !== 'rent') return false;
  if (!Number.isInteger(line.quantity) || line.quantity < 1) return false;
  if (line.mode === 'rent') return RENTAL_TERMS.includes(line.termDays as RentalTerm);
  return true;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      addBuy: (bookId) => {
        const book = getBook(bookId);
        if (!book) return { ok: false, reason: 'This book is no longer available.' };
        const max = maxBuyQuantity(book);
        if (max < 1) return { ok: false, reason: 'Out of stock.' };
        const id = lineId(bookId, 'buy');
        const existing = get().lines.find((line) => line.id === id);
        if (existing) {
          if (existing.quantity >= max) {
            return { ok: false, reason: `Only ${max} available.` };
          }
          set((state) => ({
            lines: state.lines.map((line) =>
              line.id === id ? { ...line, quantity: line.quantity + 1 } : line,
            ),
          }));
        } else {
          set((state) => ({
            lines: [...state.lines, { id, bookId, mode: 'buy', quantity: 1 }],
          }));
        }
        return { ok: true };
      },
      addRent: (bookId, term) => {
        const book = getBook(bookId);
        if (!book || !book.rentable || book.stockRent < 1) {
          return { ok: false, reason: 'This book is not available to rent right now.' };
        }
        if (!RENTAL_TERMS.includes(term)) return { ok: false, reason: 'Choose 7 or 30 days.' };
        const id = lineId(bookId, 'rent');
        set((state) => {
          const others = state.lines.filter((line) => line.id !== id);
          return {
            lines: [...others, { id, bookId, mode: 'rent', quantity: 1, termDays: term }],
          };
        });
        return { ok: true };
      },
      setQuantity: (id, quantity) =>
        set((state) => ({
          lines: state.lines.flatMap((line) => {
            if (line.id !== id || line.mode !== 'buy') return [line];
            const book = getBook(line.bookId);
            const max = book ? maxBuyQuantity(book) : 0;
            const next = Math.min(Math.floor(quantity), max);
            return next < 1 ? [] : [{ ...line, quantity: next }];
          }),
        })),
      setTerm: (id, term) =>
        set((state) => ({
          lines: state.lines.map((line) =>
            line.id === id && line.mode === 'rent' && RENTAL_TERMS.includes(term)
              ? { ...line, termDays: term }
              : line,
          ),
        })),
      remove: (id) => set((state) => ({ lines: state.lines.filter((line) => line.id !== id) })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: 'booknest.cart',
      version: 1,
      storage: persistStorage,
      partialize: ({ lines }) => ({ lines }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { lines?: unknown };
        const lines = Array.isArray(saved.lines) ? saved.lines.filter(isValidLine) : [];
        return { ...current, lines };
      },
    },
  ),
);
