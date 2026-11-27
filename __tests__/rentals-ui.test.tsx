import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { RentalCard } from '@/components/rentals/RentalCard';
import { RentalReminders } from '@/components/rentals/RentalReminders';
import type { Rental } from '@/domain/types';
import { useShelfStore } from '@/store/shelf';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { push: jest.fn(), setParams: jest.fn() },
  usePathname: () => '/',
}));

const DAY = 86_400_000;
const NOW = new Date('2025-03-10T12:00:00.000Z');
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

function rental(over: Partial<Rental> = {}): Rental {
  return {
    id: 'r1',
    orderId: 'o1',
    bookId: 'b01',
    termDays: 7,
    startAt: inDays(-4),
    dueAt: inDays(3),
    price: 285,
    ...over,
  };
}

beforeEach(() => {
  useShelfStore.setState({ library: {}, rentals: [], orders: [] });
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RentalCard', () => {
  it('shows the price, due date and days left for an active rental', () => {
    render(<RentalCard rental={rental()} now={NOW} />);
    expect(screen.getByText('Active')).toBeTruthy();
    expect(screen.getByText('7 day rental · $2.85')).toBeTruthy();
    expect(screen.getByText(/3 days left/)).toBeTruthy();
  });

  it('shows an expired rental with the late fee notice and no renewal buttons', () => {
    render(
      <RentalCard
        rental={rental({ dueAt: inDays(-2) })}
        now={NOW}
        onRenew={jest.fn()}
        onReturn={jest.fn()}
      />,
    );
    expect(screen.getByText('Expired')).toBeTruthy();
    expect(screen.getByText(/2 days overdue/)).toBeTruthy();
    expect(screen.getByText(/not charged/)).toBeTruthy();
    expect(screen.queryByText(/Renew 7 days/)).toBeNull();
    expect(
      screen.getByRole('button', { name: /Mark The Lantern Archive as returned/ }),
    ).toBeTruthy();
  });

  it('shows returned rentals as history with no actions', () => {
    render(
      <RentalCard
        rental={rental({ returnedAt: inDays(-1) })}
        now={NOW}
        onRenew={jest.fn()}
        onReturn={jest.fn()}
      />,
    );
    expect(screen.getByText('Returned')).toBeTruthy();
    expect(screen.queryByText(/Renew/)).toBeNull();
    expect(screen.queryByRole('button', { name: /returned$/ })).toBeNull();
  });

  it('offers 7 and 30 day renewals with their prices', () => {
    render(<RentalCard rental={rental()} now={NOW} onRenew={jest.fn()} />);
    expect(screen.getByText('Renew 7 days · $2.85')).toBeTruthy();
    expect(screen.getByText('Renew 30 days · $5.70')).toBeTruthy();
  });

  it('renews through the store and shows the new due date', () => {
    useShelfStore.setState({ rentals: [rental()] });
    const onRenew = (id: string, term: 7 | 30) => useShelfStore.getState().renewRental(id, term);
    render(<RentalCard rental={rental()} now={NOW} onRenew={onRenew} />);
    fireEvent.press(screen.getByRole('button', { name: /Renew The Lantern Archive for 7 days/ }));
    expect(screen.getByText(/Renewed\. New due date/)).toBeTruthy();
    expect(useShelfStore.getState().rentals[0].renewals).toHaveLength(1);
  });

  it('shows the reason instead of buttons when the title has a waitlist', () => {
    render(<RentalCard rental={rental({ bookId: 'b05' })} now={NOW} onRenew={jest.fn()} />);
    expect(screen.queryByText(/Renew 7 days/)).toBeNull();
    expect(screen.getByText(/2 other readers are waiting/)).toBeTruthy();
  });

  it('explains that a rental that was already renewed cannot be renewed again', () => {
    const renewed = rental({
      dueAt: inDays(10),
      renewals: [
        {
          renewedAt: inDays(-1),
          termDays: 7,
          previousDueAt: inDays(3),
          dueAt: inDays(10),
          price: 285,
        },
      ],
    });
    render(<RentalCard rental={renewed} now={NOW} onRenew={jest.fn()} />);
    expect(screen.getByText('Renewed once (+7 days)')).toBeTruthy();
    expect(screen.queryByText(/Renew 7 days/)).toBeNull();
    expect(screen.getByText(/can only be renewed once/)).toBeTruthy();
  });

  it('shows the store message if a renewal is refused after the card was drawn', () => {
    // The card thinks it can renew, but the store has no such rental.
    useShelfStore.setState({ rentals: [] });
    const onRenew = (id: string, term: 7 | 30) => useShelfStore.getState().renewRental(id, term);
    render(<RentalCard rental={rental()} now={NOW} onRenew={onRenew} />);
    fireEvent.press(screen.getByRole('button', { name: /Renew The Lantern Archive for 30 days/ }));
    expect(screen.getByText('We could not find that rental.')).toBeTruthy();
  });

  it('clears the confirmation after a few seconds', () => {
    useShelfStore.setState({ rentals: [rental()] });
    const onRenew = (id: string, term: 7 | 30) => useShelfStore.getState().renewRental(id, term);
    render(<RentalCard rental={rental()} now={NOW} onRenew={onRenew} />);
    fireEvent.press(screen.getByRole('button', { name: /Renew The Lantern Archive for 7 days/ }));
    expect(screen.getByText(/Renewed\./)).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByText(/Renewed\./)).toBeNull();
  });
});

describe('RentalReminders', () => {
  it('renders nothing when there are no rentals', () => {
    render(<RentalReminders />);
    expect(screen.queryByLabelText('Rental reminders')).toBeNull();
  });

  it('renders nothing when every rental is comfortably active or returned', () => {
    useShelfStore.setState({
      rentals: [rental({ dueAt: inDays(20) }), rental({ id: 'r2', returnedAt: inDays(-1) })],
    });
    render(<RentalReminders />);
    expect(screen.queryByLabelText('Rental reminders')).toBeNull();
  });

  it('shows due-soon and overdue reminders, overdue first', () => {
    useShelfStore.setState({
      rentals: [
        rental({ id: 'soon', dueAt: inDays(1) }),
        rental({ id: 'late', bookId: 'b02', dueAt: inDays(-2) }),
      ],
    });
    render(<RentalReminders />);
    expect(screen.getByLabelText('Rental reminders')).toBeTruthy();
    const late = screen.getByText('“Salt and Ember” is 2 days overdue');
    const soon = screen.getByText('“The Lantern Archive” is due in 1 day');
    expect(late).toBeTruthy();
    expect(soon).toBeTruthy();
    const text = JSON.stringify(screen.toJSON());
    expect(text.indexOf('Salt and Ember')).toBeLessThan(text.indexOf('The Lantern Archive'));
  });

  it('links to the rentals page unless told not to', () => {
    useShelfStore.setState({ rentals: [rental({ dueAt: inDays(1) })] });
    const { unmount } = render(<RentalReminders />);
    expect(screen.getByRole('link', { name: 'Manage rentals' })).toBeTruthy();
    unmount();
    render(<RentalReminders showLink={false} />);
    expect(screen.queryByRole('link', { name: 'Manage rentals' })).toBeNull();
  });
});
