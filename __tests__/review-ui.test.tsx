import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { ResponsiveBottomNav, ResponsiveNav, type NavItem } from '@/components/nav/ResponsiveNav';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { RentalCard } from '@/components/rentals/RentalCard';
import { PurchaseOptions } from '@/components/book/PurchaseOptions';
import { getBook } from '@/data/catalogue';
import { FREE_SHIPPING_OVER, LATE_FEE, formatMoney } from '@/domain/pricing';
import type { Rental } from '@/domain/types';
import { useNow } from '@/hooks/use-time';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useCartStore } from '@/store/cart';
import { useShelfStore } from '@/store/shelf';
import { safeStorage } from '@/store/storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { push: jest.fn(), setParams: jest.fn() },
  usePathname: () => '/',
}));

const NOW = new Date('2025-03-10T12:00:00.000Z');

function setWindowWidth(width: number) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

function rental(over: Partial<Rental> = {}): Rental {
  return {
    id: 'r1',
    orderId: 'o1',
    bookId: 'b01',
    termDays: 7,
    startAt: '2025-03-03T12:00:00.000Z',
    dueAt: '2025-03-13T12:00:00.000Z',
    price: 285,
    ...over,
  };
}

const items: NavItem[] = [
  { href: '/', match: '/', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  {
    href: '/profile',
    match: '/profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
    badge: 2,
    badgeLabel: '2 rentals need attention',
  },
  {
    href: '/cart',
    match: '/cart',
    label: 'Cart',
    icon: 'cart-outline',
    activeIcon: 'cart',
    badge: 1,
    badgeLabel: '1 item in cart',
  },
];

beforeEach(() => {
  useCartStore.setState({ lines: [] });
  useShelfStore.setState({ library: {}, rentals: [], orders: [] });
  jest.useFakeTimers({ now: NOW });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('error fallback', () => {
  it('shows a generic message with retry, and never any error details', () => {
    const retry = jest.fn();
    render(<ErrorFallback onRetry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText(/stack|undefined|TypeError|at /i)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Back to home' })).toBeTruthy();
  });
});

describe('navigation accessibility and responsiveness', () => {
  it('shows bottom tabs on a phone, with meaningful badge labels', () => {
    setWindowWidth(390);
    render(<ResponsiveBottomNav items={items} />);
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'tablist' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Profile, 2 rentals need attention' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Cart, 1 item in cart' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Home' })).toBeTruthy();
    expect(screen.getByLabelText('2 rentals need attention')).toBeTruthy();
  });

  it('shows the top bar on wide screens, as a navigation landmark and not a menu', () => {
    setWindowWidth(1280);
    render(
      <>
        <ResponsiveNav items={items} />
        <ResponsiveBottomNav items={items} />
      </>,
    );
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'tablist' })).toBeNull();
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'menu' })).toBeNull();
    expect(screen.UNSAFE_queryByProps({ role: 'navigation' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Profile, 2 rentals need attention' })).toBeTruthy();
  });

  it('shows the compact brand bar and no inline links on a phone', () => {
    setWindowWidth(390);
    render(<ResponsiveNav items={items} />);
    expect(screen.getByRole('link', { name: 'BookNest home' })).toBeTruthy();
    expect(screen.UNSAFE_queryByProps({ role: 'navigation' })).toBeNull();
  });

  it('hides badges at zero and caps large counts', () => {
    setWindowWidth(390);
    render(
      <ResponsiveBottomNav
        items={[
          { ...items[0], badge: 0 },
          { ...items[2], badge: 25, badgeLabel: '25 items in cart' },
        ]}
      />,
    );
    expect(screen.getByText('9+')).toBeTruthy();
    expect(screen.queryByLabelText(/^0 /)).toBeNull();
  });

  it('switches layout when the window size changes (breakpoint boundaries)', () => {
    setWindowWidth(599);
    const { unmount } = render(<ResponsiveBottomNav items={items} />);
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'tablist' })).toBeTruthy();
    unmount();
    setWindowWidth(600);
    render(<ResponsiveBottomNav items={items} />);
    expect(screen.UNSAFE_queryByProps({ accessibilityRole: 'tablist' })).toBeNull();
  });
});

describe('rental card due labels', () => {
  it('shows "1 day overdue" next to the Expired badge for a rental overdue by hours', () => {
    render(<RentalCard rental={rental({ dueAt: '2025-03-10T06:00:00.000Z' })} now={NOW} />);
    expect(screen.getByText('Expired')).toBeTruthy();
    expect(screen.getByText(/1 day overdue/)).toBeTruthy();
    expect(screen.queryByText(/Due today/i)).toBeNull();
  });

  it('shows "Due within 24 hours" for a rental due in a few hours', () => {
    render(<RentalCard rental={rental({ dueAt: '2025-03-10T18:00:00.000Z' })} now={NOW} />);
    expect(screen.getByText(/Due within 24 hours/)).toBeTruthy();
  });
});

describe('copy comes from the pricing constants', () => {
  it('shows the configured late fee and free-shipping threshold on the book page', () => {
    render(<PurchaseOptions book={getBook('b01')!} />);
    expect(
      screen.getByText(new RegExp(`over ${formatMoney(FREE_SHIPPING_OVER).replace('$', '\\$')}`)),
    ).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Rent' }));
    expect(
      screen.getByText(new RegExp(`${formatMoney(LATE_FEE).replace('$', '\\$')} late fee`)),
    ).toBeTruthy();
  });
});

describe('shared clock', () => {
  it('gives every caller the same time and updates them together once a minute', () => {
    const a = renderHook(() => useNow());
    const b = renderHook(() => useNow());
    expect(a.result.current.getTime()).toBe(b.result.current.getTime());
    const before = a.result.current.getTime();

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(a.result.current.getTime()).toBe(before + 60_000);
    expect(b.result.current.getTime()).toBe(a.result.current.getTime());
    a.unmount();
    b.unmount();
  });

  it('runs one interval for many subscribers and stops it when the last one leaves', () => {
    const setSpy = jest.spyOn(globalThis, 'setInterval');
    const clearSpy = jest.spyOn(globalThis, 'clearInterval');
    const one = renderHook(() => useNow());
    const two = renderHook(() => useNow());
    const three = renderHook(() => useNow());
    expect(setSpy).toHaveBeenCalledTimes(1);
    one.unmount();
    two.unmount();
    expect(clearSpy).not.toHaveBeenCalled();
    three.unmount();
    expect(clearSpy).toHaveBeenCalledTimes(1);
  });
});

describe('transient message', () => {
  it('shows a message, clears it after the delay and restarts the timer on a new one', () => {
    const { result } = renderHook(() => useTransientMessage(1000));
    act(() => result.current.notify('first', 'ok'));
    expect(result.current.message).toEqual({ text: 'first', tone: 'ok' });

    act(() => {
      jest.advanceTimersByTime(800);
    });
    act(() => result.current.notify('second', 'error'));
    act(() => {
      jest.advanceTimersByTime(800);
    });
    // The first timer would have fired by now. The second message must still be showing.
    expect(result.current.message).toEqual({ text: 'second', tone: 'error' });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current.message).toBeNull();
  });

  it('does not update state after unmount', () => {
    const { result, unmount } = renderHook(() => useTransientMessage(1000));
    act(() => result.current.notify('bye', 'ok'));
    unmount();
    expect(() => jest.advanceTimersByTime(2000)).not.toThrow();
  });
});
describe('storage failures', () => {
  it('swallows a failed write (quota full, private mode) instead of throwing', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('QuotaExceededError'));
    await expect(safeStorage.setItem('k', 'v')).resolves.toBeUndefined();
  });

  it('treats a failed read as "nothing saved" so the app starts fresh', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('denied'));
    await expect(safeStorage.getItem('k')).resolves.toBeNull();
  });

  it('swallows a failed delete', async () => {
    jest.spyOn(AsyncStorage, 'removeItem').mockRejectedValueOnce(new Error('denied'));
    await expect(safeStorage.removeItem('k')).resolves.toBeUndefined();
  });

  it('still reads and writes normally when storage works', async () => {
    await safeStorage.setItem('booknest.test', 'hello');
    await expect(safeStorage.getItem('booknest.test')).resolves.toBe('hello');
    await safeStorage.removeItem('booknest.test');
    await expect(safeStorage.getItem('booknest.test')).resolves.toBeNull();
  });

  it('keeps the cart usable in memory when saving fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('QuotaExceededError'));
    expect(useCartStore.getState().addBuy('b01').ok).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(useCartStore.getState().lines).toHaveLength(1);
  });
});
