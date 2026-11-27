import { act, fireEvent, render, screen } from '@testing-library/react-native';

import CartScreen from '@/app/cart';
import { getBook } from '@/data/catalogue';
import { groupRentals } from '@/domain/rentals';
import { booksOnShelf, shelfCounts } from '@/domain/library';
import { useCartStore } from '@/store/cart';
import { useShelfStore } from '@/store/shelf';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { push: jest.fn(), setParams: jest.fn() },
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));

const START = new Date('2025-03-10T12:00:00.000Z');
const DAY = 86_400_000;

beforeEach(() => {
  useCartStore.setState({ lines: [] });
  useShelfStore.setState({ library: {}, rentals: [], orders: [] });
  jest.useFakeTimers({ now: START });
});

afterEach(() => {
  jest.useRealTimers();
});

const shelf = () => useShelfStore.getState();
const cart = () => useCartStore.getState();

describe('workflow: buy and rent through checkout', () => {
  it('turns a mixed cart into an order, a purchase and a rental, and empties the cart', () => {
    cart().addBuy('b01');
    cart().addBuy('b01');
    cart().addRent('b02', 30);

    const result = shelf().placeOrder();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(cart().lines).toEqual([]);
    expect(shelf().orders).toHaveLength(1);
    expect(shelf().orders[0].lines).toHaveLength(2);

    const counts = shelfCounts(shelf().library, shelf().rentals);
    expect(counts.owned).toBe(1);
    expect(counts.rented).toBe(1);

    const [rental] = shelf().rentals;
    expect(rental.bookId).toBe('b02');
    expect(new Date(rental.dueAt).getTime() - START.getTime()).toBe(30 * DAY);
  });

  it('keeps the cart and creates nothing when checkout fails', () => {
    cart().addBuy('b01');
    // Simulate stock disappearing after the line was added.
    useCartStore.setState({
      lines: [...cart().lines, { id: 'b21:buy', bookId: 'b21', mode: 'buy', quantity: 1 }],
    });
    const result = shelf().placeOrder();
    expect(result.ok).toBe(false);
    expect(cart().lines).toHaveLength(2);
    expect(shelf().orders).toEqual([]);
    expect(shelf().rentals).toEqual([]);
    expect(shelf().library).toEqual({});
  });

  it('does not create a second order if checkout is pressed twice', () => {
    cart().addRent('b02', 7);
    expect(shelf().placeOrder().ok).toBe(true);
    // The cart is now empty, so a repeat press must not create anything.
    const again = shelf().placeOrder();
    expect(again).toEqual({ ok: false, errors: ['Your cart is empty.'] });
    expect(shelf().orders).toHaveLength(1);
    expect(shelf().rentals).toHaveLength(1);
  });

  it('rejects renting the same book again while it is still out', () => {
    cart().addRent('b02', 7);
    shelf().placeOrder();
    cart().addRent('b02', 7);
    const again = shelf().placeOrder();
    expect(again.ok).toBe(false);
    expect(shelf().rentals).toHaveLength(1);
  });
});

describe('workflow: rental lifecycle over time', () => {
  function rentOnce(term: 7 | 30 = 7) {
    cart().addRent('b02', term);
    shelf().placeOrder();
    return shelf().rentals[0];
  }

  it('moves active, then due soon, then expired, then returned', () => {
    const { id } = rentOnce(7);
    const groupsAt = (days: number) => {
      jest.setSystemTime(new Date(START.getTime() + days * DAY));
      return groupRentals(shelf().rentals, new Date());
    };

    expect(groupsAt(1).active).toHaveLength(1);
    expect(groupsAt(6).active).toHaveLength(1); // due soon is still "active" for grouping
    expect(groupsAt(7.5).expired).toHaveLength(1);

    shelf().returnRental(id);
    const done = groupsAt(8);
    expect(done.history).toHaveLength(1);
    expect(done.expired).toEqual([]);
    expect(done.active).toEqual([]);
  });

  it('renews once from the current due date, then refuses a second renewal', () => {
    const { id, dueAt } = rentOnce(7);
    jest.setSystemTime(new Date(START.getTime() + 5 * DAY));

    const first = shelf().renewRental(id, 7);
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(new Date(first.rental.dueAt).getTime() - new Date(dueAt).getTime()).toBe(7 * DAY);
    }
    const second = shelf().renewRental(id, 30);
    expect(second.ok).toBe(false);
    expect(shelf().rentals[0].renewals).toHaveLength(1);
  });

  it('refuses to renew an expired or a returned rental', () => {
    const { id } = rentOnce(7);
    jest.setSystemTime(new Date(START.getTime() + 8 * DAY));
    expect(shelf().renewRental(id, 7).ok).toBe(false);

    shelf().returnRental(id);
    const result = shelf().renewRental(id, 7);
    expect(result.ok).toBe(false);
    expect(shelf().rentals[0].renewals).toBeUndefined();
  });

  it('refuses an invalid term and an unknown rental without changing anything', () => {
    const { id } = rentOnce(7);
    const before = shelf().rentals[0].dueAt;
    expect(shelf().renewRental(id, 14 as 7).ok).toBe(false);
    expect(shelf().renewRental('missing', 7).ok).toBe(false);
    expect(shelf().rentals[0].dueAt).toBe(before);
  });

  it('refuses to renew a book other readers are waiting for', () => {
    cart().addRent('b05', 7); // b05 has a waitlist in the seed data
    expect(shelf().placeOrder().ok).toBe(true);
    const result = shelf().renewRental(shelf().rentals[0].id, 7);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/waiting/);
  });

  it('keeps the returned date when a rental is returned twice', () => {
    const { id } = rentOnce(7);
    jest.setSystemTime(new Date(START.getTime() + 2 * DAY));
    shelf().returnRental(id);
    const first = shelf().rentals[0].returnedAt;
    jest.setSystemTime(new Date(START.getTime() + 4 * DAY));
    shelf().returnRental(id);
    expect(shelf().rentals[0].returnedAt).toBe(first);
  });

  it('frees a rental slot and allows renting the same book again after a return', () => {
    const { id } = rentOnce(7);
    shelf().returnRental(id);
    cart().addRent('b02', 7);
    expect(shelf().placeOrder().ok).toBe(true);
    expect(shelf().rentals.filter((r) => !r.returnedAt)).toHaveLength(1);
  });

  it('puts rented and bought books on the right library shelves', () => {
    cart().addBuy('b01');
    cart().addRent('b02', 7);
    shelf().placeOrder();
    const ids = (name: 'owned' | 'rented') =>
      booksOnShelf(name, shelf().library, shelf().rentals, getBook).map((book) => book.id);
    expect(ids('owned')).toEqual(['b01']);
    expect(ids('rented')).toEqual(['b02']);

    shelf().returnRental(shelf().rentals[0].id);
    expect(ids('rented')).toEqual([]);
  });
});

describe('workflow: cart screen', () => {
  it('links to the rentals page after an order is placed', () => {
    cart().addRent('b02', 7);
    render(<CartScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Place demo order' }));
    expect(screen.getByText('Order placed')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View my rentals' })).toBeTruthy();
  });

  it('tells the reader about items that left the catalogue and lets them remove them', () => {
    useCartStore.setState({
      lines: [
        { id: 'b01:buy', bookId: 'b01', mode: 'buy', quantity: 1 },
        { id: 'gone:buy', bookId: 'gone', mode: 'buy', quantity: 1 },
      ],
    });
    render(<CartScreen />);
    expect(screen.getByText('One item in your cart is no longer available.')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Remove unavailable items' }));
    expect(cart().lines.map((line) => line.id)).toEqual(['b01:buy']);
    expect(screen.queryByText(/no longer available/)).toBeNull();
  });

  it('shows a generic list of problems when checkout is refused, and keeps the cart', () => {
    useCartStore.setState({
      lines: [{ id: 'b21:buy', bookId: 'b21', mode: 'buy', quantity: 1 }],
    });
    render(<CartScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Place demo order' }));
    expect(screen.getByText(/not available in that quantity/)).toBeTruthy();
    expect(screen.queryByText('Order placed')).toBeNull();
    expect(cart().lines).toHaveLength(1);
  });

  it('shows the empty state for an empty cart', () => {
    render(<CartScreen />);
    expect(screen.getByText('Your cart is empty')).toBeTruthy();
  });

  it('shows the free-shipping hint from the shared constant', async () => {
    cart().addBuy('b01');
    render(<CartScreen />);
    await act(async () => undefined);
    expect(screen.getByText(/more for free shipping/)).toBeTruthy();
  });
});
