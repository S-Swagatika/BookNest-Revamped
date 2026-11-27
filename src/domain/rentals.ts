import {
  LATE_FEE,
  MAX_RENEWALS,
  computeDueAt,
  daysOverdue,
  daysRemaining,
  formatMoney,
  formatShortDate,
  isDueWithinDay,
  rentalPrice,
  rentalStatus,
} from './pricing';
import type { Book, Rental, RentalTerm } from './types';

/** Why a rental cannot be renewed. */
export type RenewalBlock = 'returned' | 'overdue' | 'limit' | 'unavailable' | 'waitlist';

export type RenewalCheck = { ok: true } | { ok: false; code: RenewalBlock; message: string };

export function renewalCount(rental: Pick<Rental, 'renewals'>): number {
  return rental.renewals?.length ?? 0;
}

/** A renewal costs the same as renting the book again for that term. */
export function renewalPrice(book: Pick<Book, 'buyPrice'>, term: RentalTerm): number {
  return rentalPrice(book, term);
}

/**
 * Renewal rules:
 * - the rental must still be out and not expired (an expired rental has to be returned),
 * - it can be renewed at most `MAX_RENEWALS` times,
 * - the book must still be rentable and nobody else may be waiting for it.
 */
export function checkRenewal(
  rental: Rental,
  book: Book | undefined,
  waitlistCount: number,
  now: Date,
): RenewalCheck {
  if (rental.returnedAt) {
    return { ok: false, code: 'returned', message: 'This rental has already been returned.' };
  }
  if (rentalStatus(rental, now) === 'overdue') {
    return {
      ok: false,
      code: 'overdue',
      message: 'This rental has expired. Return the book first, then you can rent it again.',
    };
  }
  if (renewalCount(rental) >= MAX_RENEWALS) {
    return {
      ok: false,
      code: 'limit',
      message: `A rental can only be renewed ${MAX_RENEWALS === 1 ? 'once' : `${MAX_RENEWALS} times`}. Please return it by ${formatShortDate(rental.dueAt)}.`,
    };
  }
  if (!book || !book.rentable) {
    return {
      ok: false,
      code: 'unavailable',
      message: 'This title can no longer be rented, so it cannot be renewed.',
    };
  }
  if (waitlistCount > 0) {
    return {
      ok: false,
      code: 'waitlist',
      message: `${waitlistCount} other reader${waitlistCount === 1 ? ' is' : 's are'} waiting for this book, so it cannot be renewed.`,
    };
  }
  return { ok: true };
}

/** The new due date counts from the current due date, so no paid days are lost. */
export function applyRenewal(rental: Rental, term: RentalTerm, price: number, now: Date): Rental {
  const dueAt = computeDueAt(new Date(rental.dueAt), term).toISOString();
  return {
    ...rental,
    dueAt,
    renewals: [
      ...(rental.renewals ?? []),
      { renewedAt: now.toISOString(), termDays: term, previousDueAt: rental.dueAt, dueAt, price },
    ],
  };
}

/** Money paid for renewals. Original rental prices are already part of their orders. */
export function totalRenewalFees(rentals: readonly Rental[]): number {
  return rentals.reduce(
    (sum, rental) =>
      sum + (rental.renewals ?? []).reduce((inner, renewal) => inner + renewal.price, 0),
    0,
  );
}

export interface RentalGroups {
  /** Still out and not yet past the due date (including "due soon"). */
  active: Rental[];
  /** Past the due date and not returned. */
  expired: Rental[];
  /** Returned. Newest return first. */
  history: Rental[];
}

export function groupRentals(rentals: readonly Rental[], now: Date): RentalGroups {
  const active: Rental[] = [];
  const expired: Rental[] = [];
  const history: Rental[] = [];
  for (const rental of rentals) {
    const status = rentalStatus(rental, now);
    if (status === 'returned') history.push(rental);
    else if (status === 'overdue') expired.push(rental);
    else active.push(rental);
  }
  const byDue = (a: Rental, b: Rental) => a.dueAt.localeCompare(b.dueAt);
  active.sort(byDue);
  expired.sort(byDue);
  history.sort((a, b) => (b.returnedAt ?? '').localeCompare(a.returnedAt ?? ''));
  return { active, expired, history };
}

export type ReminderTone = 'warning' | 'danger';

export interface RentalReminder {
  rentalId: string;
  bookId: string;
  tone: ReminderTone;
  title: string;
  message: string;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

/** Rentals that are due soon or expired and still out. Drives the badge and the dashboard. */
export function countNeedingAttention(rentals: readonly Rental[], now: Date): number {
  return rentals.filter((rental) => {
    const status = rentalStatus(rental, now);
    return status === 'dueSoon' || status === 'overdue';
  }).length;
}

/** Short status line for a rental card, e.g. "3 days left" or "2 days overdue". */
export function dueLabel(rental: Rental, now: Date): string {
  const status = rentalStatus(rental, now);
  if (status === 'returned') return `Returned ${formatShortDate(rental.returnedAt as string)}`;
  if (status === 'overdue') return `${plural(daysOverdue(rental, now), 'day')} overdue`;
  if (isDueWithinDay(rental, now)) return 'Due within 24 hours';
  return `${plural(daysRemaining(rental, now), 'day')} left`;
}

/**
 * Reminders for rentals that are overdue or due within the due-soon window. Most urgent
 * first. Mock in Phase 1: shown in the app only, nothing is sent.
 */
export function buildReminders(
  rentals: readonly Rental[],
  now: Date,
  getBook: (id: string) => Book | undefined,
  getWaitlist: (bookId: string) => number,
): RentalReminder[] {
  const reminders: (RentalReminder & { dueAt: string })[] = [];
  for (const rental of rentals) {
    const status = rentalStatus(rental, now);
    if (status !== 'dueSoon' && status !== 'overdue') continue;
    const book = getBook(rental.bookId);
    if (!book) continue;
    if (status === 'overdue') {
      reminders.push({
        rentalId: rental.id,
        bookId: rental.bookId,
        tone: 'danger',
        dueAt: rental.dueAt,
        title: `“${book.title}” is ${plural(daysOverdue(rental, now), 'day')} overdue`,
        message: `Please return it as soon as you can. A flat ${formatMoney(LATE_FEE)} late fee applies. It is shown for information only and is not charged in this version.`,
      });
      continue;
    }

    const renewable = checkRenewal(rental, book, getWaitlist(book.id), now).ok;
    const when = isDueWithinDay(rental, now)
      ? 'due within 24 hours'
      : `due in ${plural(daysRemaining(rental, now), 'day')}`;
    reminders.push({
      rentalId: rental.id,
      bookId: rental.bookId,
      tone: 'warning',
      dueAt: rental.dueAt,
      title: `“${book.title}” is ${when}`,
      message: renewable
        ? `Return it by ${formatShortDate(rental.dueAt)}, or renew it for more time.`
        : `Return it by ${formatShortDate(rental.dueAt)}. It cannot be renewed.`,
    });
  }
  return reminders
    .sort((a, b) =>
      a.tone === b.tone ? a.dueAt.localeCompare(b.dueAt) : a.tone === 'danger' ? -1 : 1,
    )
    .map(({ dueAt: _dueAt, ...reminder }) => reminder);
}
