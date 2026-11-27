import { fireEvent, render, screen } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { BookCard } from '@/components/book/BookCard';
import { BookGrid } from '@/components/book/BookGrid';
import { PurchaseOptions } from '@/components/book/PurchaseOptions';
import { RentalTermPicker } from '@/components/book/RentalTermPicker';
import { getBook } from '@/data/catalogue';
import { BOOKS } from '@/data/seed';
import { useCartStore } from '@/store/cart';
import { useShelfStore } from '@/store/shelf';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-router', () => {
  return {
    Link: ({ children }: { children: React.ReactNode }) => children,
    router: { push: jest.fn(), setParams: jest.fn() },
    usePathname: () => '/',
  };
});

function setWindowWidth(width: number) {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

const book = getBook('b01')!;

beforeEach(() => {
  useCartStore.setState({ lines: [] });
  useShelfStore.setState({ library: {}, rentals: [], orders: [] });
});

afterEach(() => jest.restoreAllMocks());

describe('BookCard', () => {
  it('shows title, author, buy price and the cheapest rental price', () => {
    render(<BookCard book={book} />);
    expect(screen.getAllByText('The Lantern Archive').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Maren Solvik/i).length).toBeGreaterThan(0);
    expect(screen.getByText('$18.99')).toBeTruthy();
    expect(screen.getByText(/rent from \$2\.85/)).toBeTruthy();
  });

  it('flags out-of-stock titles', () => {
    render(<BookCard book={getBook('b21')!} />);
    expect(screen.getByText('Out of stock')).toBeTruthy();
  });

  it('shows the recommendation reason when provided', () => {
    render(<BookCard book={book} reason="Matches your interest in Fiction" />);
    expect(screen.getByText('Matches your interest in Fiction')).toBeTruthy();
  });
});

describe('BookGrid', () => {
  it('shows an empty state when there are no books', () => {
    render(<BookGrid books={[]} />);
    expect(screen.getByText('No books found')).toBeTruthy();
  });

  it.each([
    [390, 'phone', '50%'],
    [820, 'tablet', `${100 / 3}%`],
    [1440, 'desktop', '25%'],
  ])('renders every book at a %ipx %s width with %s wide cells', (width, _device, cell) => {
    setWindowWidth(width);
    render(<BookGrid books={BOOKS.slice(0, 6)} />);
    for (const item of BOOKS.slice(0, 6)) {
      expect(screen.getAllByText(item.title).length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(screen.toJSON())).toContain(`"width":"${cell}"`);
  });
});

describe('RentalTermPicker', () => {
  it('offers exactly 7 and 30 day terms with their prices', () => {
    render(<RentalTermPicker book={book} value={7} onChange={() => undefined} />);
    expect(screen.getByText('7 days')).toBeTruthy();
    expect(screen.getByText('30 days')).toBeTruthy();
    expect(screen.queryByText('14 days')).toBeNull();
    expect(screen.getByText('$2.85')).toBeTruthy();
    expect(screen.getByText('$5.70')).toBeTruthy();
  });

  it('reports the selected term and marks it as selected', () => {
    const onChange = jest.fn();
    render(<RentalTermPicker book={book} value={7} onChange={onChange} />);
    fireEvent.press(screen.getByRole('radio', { name: /30 day rental/ }));
    expect(onChange).toHaveBeenCalledWith(30);
    expect(
      screen.getByRole('radio', { name: /7 day rental/ }).props.accessibilityState.selected,
    ).toBe(true);
  });
});

describe('PurchaseOptions', () => {
  it('adds a purchase to the cart', () => {
    render(<PurchaseOptions book={book} />);
    fireEvent.press(screen.getByRole('button', { name: 'Add to cart' }));
    expect(useCartStore.getState().lines).toEqual([
      expect.objectContaining({ bookId: 'b01', mode: 'buy', quantity: 1 }),
    ]);
    expect(screen.getByText('Added to your cart.')).toBeTruthy();
  });

  it('rents for 7 days by default and for 30 days when selected', () => {
    render(<PurchaseOptions book={book} />);
    fireEvent.press(screen.getByRole('button', { name: 'Rent' }));
    fireEvent.press(screen.getByRole('button', { name: 'Rent for 7 days' }));
    expect(useCartStore.getState().lines[0]).toMatchObject({ mode: 'rent', termDays: 7 });

    fireEvent.press(screen.getByRole('radio', { name: /30 day rental/ }));
    fireEvent.press(screen.getByRole('button', { name: 'Rent for 30 days' }));
    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ mode: 'rent', termDays: 30 });
  });

  it('hides renting for a book that cannot be rented', () => {
    render(<PurchaseOptions book={getBook('b09')!} />);
    expect(screen.queryByRole('button', { name: 'Rent' })).toBeNull();
  });

  it('shows an unavailable message when a book is out of stock', () => {
    render(<PurchaseOptions book={getBook('b21')!} />);
    expect(screen.getByText('Currently unavailable')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to cart' })).toBeNull();
  });

  it('blocks a second rental of a book that is already being rented', () => {
    useShelfStore.setState({
      rentals: [
        {
          id: 'r1',
          orderId: 'o1',
          bookId: 'b01',
          termDays: 7,
          startAt: '2025-01-01T00:00:00.000Z',
          dueAt: '2099-01-08T00:00:00.000Z',
          price: 285,
        },
      ],
    });
    render(<PurchaseOptions book={book} />);
    fireEvent.press(screen.getByRole('button', { name: 'Rent' }));
    expect(screen.getByText('You are already renting this book')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Rent for 7 days' }).props.accessibilityState.disabled,
    ).toBe(true);
  });
});
