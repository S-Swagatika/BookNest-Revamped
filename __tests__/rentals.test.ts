import { getBook } from '@/data/catalogue';
import { buildOrder } from '@/domain/orders';
import { MAX_RENEWALS, rentalPrice } from '@/domain/pricing';
import {
  applyRenewal,
  buildReminders,
  checkRenewal,
  groupRentals,
  renewalPrice,
  totalRenewalFees,
} from '@/domain/rentals';
import type { CartLine, Rental } from '@/domain/types';

const START = new Date('2025-03-01T10:00:00.000Z');
const book = getBook('b01')!; // 1899, rentable, no waitlist

function rental(over: Partial<Rental> = {}): Rental {
  return {
    id: 'r1',
    orderId: 'o1',
    bookId: 'b01',
    termDays: 7,
    startAt: START.toISOString(),
    dueAt: '2025-03-08T10:00:00.000Z',
    price: 285,
    ...over,
  };
}

const at = (iso: string) => new Date(iso);
const noWaitlist = () => 0;

describe('rental pricing', () => {
  it('prices 7 and 30 day rentals from the buy price', () => {
    expect(rentalPrice(book, 7)).toBe(285);
    expect(rentalPrice(book, 30)).toBe(570);
  });

  it('prices a renewal the same as renting for that term', () => {
    expect(renewalPrice(book, 7)).toBe(285);
    expect(renewalPrice(book, 30)).toBe(570);
  });
});

describe('renewal rules', () => {
  const mid = at('2025-03-04T10:00:00.000Z');

  it('allows renewing an active rental with no waitlist', () => {
    expect(checkRenewal(rental(), book, 0, mid)).toEqual({ ok: true });
  });

  it('allows renewing on the due date itself and while due soon', () => {
    expect(checkRenewal(rental(), book, 0, at('2025-03-08T10:00:00.000Z')).ok).toBe(true);
    expect(checkRenewal(rental(), book, 0, at('2025-03-07T10:00:00.000Z')).ok).toBe(true);
  });

  it('blocks an expired rental, one millisecond after the due date', () => {
    const result = checkRenewal(rental(), book, 0, at('2025-03-08T10:00:00.001Z'));
    expect(result).toMatchObject({ ok: false, code: 'overdue' });
  });

  it('blocks a returned rental', () => {
    const returned = rental({ returnedAt: '2025-03-05T10:00:00.000Z' });
    expect(checkRenewal(returned, book, 0, mid)).toMatchObject({ ok: false, code: 'returned' });
  });

  it('blocks renewal when another reader is waiting', () => {
    const result = checkRenewal(rental(), book, 2, mid);
    expect(result).toMatchObject({ ok: false, code: 'waitlist' });
    if (!result.ok) expect(result.message).toMatch(/2 other readers are waiting/);
  });

  it('uses the singular for one waiting reader', () => {
    const result = checkRenewal(rental(), book, 1, mid);
    if (!result.ok) expect(result.message).toMatch(/1 other reader is waiting/);
  });

  it('blocks a second renewal once the limit is reached', () => {
    let current = rental();
    for (let i = 0; i < MAX_RENEWALS; i += 1) {
      current = applyRenewal(current, 7, 285, mid);
    }
    expect(checkRenewal(current, book, 0, mid)).toMatchObject({ ok: false, code: 'limit' });
  });

  it('blocks renewal when the title is no longer rentable or no longer exists', () => {
    expect(checkRenewal(rental(), { ...book, rentable: false }, 0, mid)).toMatchObject({
      ok: false,
      code: 'unavailable',
    });
    expect(checkRenewal(rental(), undefined, 0, mid)).toMatchObject({
      ok: false,
      code: 'unavailable',
    });
  });

  it('checks expiry before the other rules so the reader is told to return the book', () => {
    const expired = at('2025-04-01T00:00:00.000Z');
    expect(checkRenewal(rental(), book, 3, expired)).toMatchObject({ code: 'overdue' });
  });
});

describe('applying a renewal', () => {
  const when = at('2025-03-05T09:00:00.000Z');

  it('adds the term to the current due date, not to today', () => {
    expect(applyRenewal(rental(), 7, 285, when).dueAt).toBe('2025-03-15T10:00:00.000Z');
    expect(applyRenewal(rental(), 30, 570, when).dueAt).toBe('2025-04-07T10:00:00.000Z');
  });

  it('records the renewal and does not change the original term, start or price', () => {
    const original = rental();
    const renewed = applyRenewal(original, 30, 570, when);
    expect(renewed).toMatchObject({ termDays: 7, price: 285, startAt: original.startAt });
    expect(renewed.renewals).toEqual([
      {
        renewedAt: when.toISOString(),
        termDays: 30,
        previousDueAt: '2025-03-08T10:00:00.000Z',
        dueAt: '2025-04-07T10:00:00.000Z',
        price: 570,
      },
    ]);
  });

  it('does not mutate the rental it was given', () => {
    const original = rental();
    applyRenewal(original, 7, 285, when);
    expect(original.dueAt).toBe('2025-03-08T10:00:00.000Z');
    expect(original.renewals).toBeUndefined();
  });

  it('adds up renewal fees across rentals, ignoring rentals that were never renewed', () => {
    const renewed = applyRenewal(rental(), 30, 570, when);
    expect(totalRenewalFees([renewed, rental({ id: 'r2' })])).toBe(570);
    expect(totalRenewalFees([])).toBe(0);
  });
});

describe('grouping rentals', () => {
  const now = at('2025-03-10T00:00:00.000Z');
  const active = rental({ id: 'a', dueAt: '2025-03-20T00:00:00.000Z' });
  const dueSoon = rental({ id: 's', dueAt: '2025-03-11T00:00:00.000Z' });
  const expired = rental({ id: 'e', dueAt: '2025-03-05T00:00:00.000Z' });
  const older = rental({ id: 'o', dueAt: '2025-03-02T00:00:00.000Z' });
  const returnedEarly = rental({ id: 'h1', returnedAt: '2025-03-03T00:00:00.000Z' });
  const returnedLate = rental({ id: 'h2', returnedAt: '2025-03-09T00:00:00.000Z' });

  it('splits rentals into active, expired and history', () => {
    const groups = groupRentals(
      [active, expired, returnedEarly, dueSoon, older, returnedLate],
      now,
    );
    expect(groups.active.map((r) => r.id)).toEqual(['s', 'a']);
    expect(groups.expired.map((r) => r.id)).toEqual(['o', 'e']);
    expect(groups.history.map((r) => r.id)).toEqual(['h2', 'h1']);
  });

  it('treats a returned rental as history even when it was returned late', () => {
    const lateReturn = rental({
      dueAt: '2025-03-05T00:00:00.000Z',
      returnedAt: '2025-03-09T00:00:00.000Z',
    });
    const groups = groupRentals([lateReturn], now);
    expect(groups.history).toHaveLength(1);
    expect(groups.expired).toHaveLength(0);
  });

  it('returns empty groups for no rentals', () => {
    expect(groupRentals([], now)).toEqual({ active: [], expired: [], history: [] });
  });
});

describe('reminders', () => {
  const now = at('2025-03-10T12:00:00.000Z');
  const get = (id: string) => getBook(id);

  it('has no reminders when rentals are comfortably active or returned', () => {
    const rentals = [
      rental({ dueAt: '2025-03-25T00:00:00.000Z' }),
      rental({ id: 'x', returnedAt: '2025-03-09T00:00:00.000Z' }),
    ];
    expect(buildReminders(rentals, now, get, noWaitlist)).toEqual([]);
  });

  it('warns when a rental is due soon and says it can be renewed', () => {
    const [reminder] = buildReminders(
      [rental({ dueAt: '2025-03-12T12:00:00.000Z' })],
      now,
      get,
      noWaitlist,
    );
    expect(reminder).toMatchObject({ tone: 'warning', rentalId: 'r1' });
    expect(reminder.title).toBe('“The Lantern Archive” is due in 2 days');
    expect(reminder.message).toMatch(/or renew it/);
  });

  it('says due within 24 hours when less than a day is left', () => {
    const [reminder] = buildReminders(
      [rental({ dueAt: '2025-03-10T12:00:00.000Z' })],
      now,
      get,
      noWaitlist,
    );
    expect(reminder.title).toMatch(/is due within 24 hours/);
  });

  it('says a due-soon rental cannot be renewed when someone is waiting', () => {
    const [reminder] = buildReminders(
      [rental({ dueAt: '2025-03-11T12:00:00.000Z' })],
      now,
      get,
      () => 1,
    );
    expect(reminder.message).toMatch(/cannot be renewed/);
  });

  it('flags an expired rental as urgent and states the late fee is not charged', () => {
    const [reminder] = buildReminders(
      [rental({ dueAt: '2025-03-07T12:00:00.000Z' })],
      now,
      get,
      noWaitlist,
    );
    expect(reminder).toMatchObject({ tone: 'danger' });
    expect(reminder.title).toBe('“The Lantern Archive” is 3 days overdue');
    expect(reminder.message).toMatch(/not charged/);
  });

  it('uses the singular for one day overdue and never says 0 days', () => {
    const [reminder] = buildReminders(
      [rental({ dueAt: '2025-03-10T11:59:00.000Z' })],
      now,
      get,
      noWaitlist,
    );
    expect(reminder.title).toMatch(/is 1 day overdue/);
  });

  it('lists expired rentals before due-soon ones, each soonest first', () => {
    const reminders = buildReminders(
      [
        rental({ id: 'soon', dueAt: '2025-03-11T12:00:00.000Z' }),
        rental({ id: 'late2', dueAt: '2025-03-09T12:00:00.000Z' }),
        rental({ id: 'late1', dueAt: '2025-03-05T12:00:00.000Z' }),
      ],
      now,
      get,
      noWaitlist,
    );
    expect(reminders.map((r) => r.rentalId)).toEqual(['late1', 'late2', 'soon']);
  });

  it('skips rentals for books that no longer exist', () => {
    const gone = rental({ bookId: 'ghost', dueAt: '2025-03-01T00:00:00.000Z' });
    expect(buildReminders([gone], now, get, noWaitlist)).toEqual([]);
  });
});

describe('duplicate and unavailable rental requests', () => {
  const rent = (bookId: string, termDays: 7 | 30 = 7): CartLine => ({
    id: `${bookId}:rent:${termDays}`,
    bookId,
    mode: 'rent',
    quantity: 1,
    termDays,
  });
  const place = (lines: CartLine[], existingRentals: Rental[] = []) =>
    buildOrder({ lines, existingRentals, getBook, now: START, makeId: (p) => `${p}_1` });

  it('rejects the same book twice in one order, with one message', () => {
    const result = place([rent('b01', 7), rent('b01', 30)]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(['“The Lantern Archive” is in your cart more than once.']);
    }
  });

  it('rejects renting a book whose earlier rental has expired but was not returned', () => {
    const expired = rental({ dueAt: '2025-02-01T00:00:00.000Z' });
    const result = place([rent('b01')], [expired]);
    expect(result.ok).toBe(false);
  });

  it('allows renting again once the earlier rental is returned', () => {
    const returned = rental({ returnedAt: '2025-03-02T00:00:00.000Z' });
    expect(place([rent('b01')], [returned]).ok).toBe(true);
  });

  it('rejects books that are not rentable or have no rental stock', () => {
    expect(place([rent('b09')]).ok).toBe(false);
    expect(place([rent('b21')]).ok).toBe(false);
  });
});
