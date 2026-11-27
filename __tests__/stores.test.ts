import type { Rental } from '@/domain/types';
import { useCartStore } from '@/store/cart';
import { useProfileStore } from '@/store/profile';
import { useShelfStore } from '@/store/shelf';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => {
  useCartStore.setState({ lines: [] });
  useShelfStore.setState({ library: {}, rentals: [], orders: [] });
  useProfileStore.getState().reset();
});

describe('cart store', () => {
  it('adds a purchase and increments its quantity up to the stock limit', () => {
    const { addBuy } = useCartStore.getState();
    expect(addBuy('b05').ok).toBe(true);
    expect(addBuy('b05').ok).toBe(true);
    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0].quantity).toBe(2);
    // b05 has 9 in stock
    for (let i = 0; i < 20; i += 1) addBuy('b05');
    expect(useCartStore.getState().lines[0].quantity).toBe(9);
    expect(addBuy('b05')).toEqual({ ok: false, reason: 'Only 9 available.' });
  });

  it('refuses out-of-stock, unknown and non-rentable books', () => {
    const { addBuy, addRent } = useCartStore.getState();
    expect(addBuy('b21').ok).toBe(false);
    expect(addBuy('nope').ok).toBe(false);
    expect(addRent('b09', 7).ok).toBe(false);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('keeps buy and rent lines for the same book separate', () => {
    const { addBuy, addRent } = useCartStore.getState();
    addBuy('b01');
    addRent('b01', 30);
    expect(useCartStore.getState().lines).toHaveLength(2);
  });

  it('replaces the rental term instead of adding a second rental line', () => {
    const { addRent } = useCartStore.getState();
    addRent('b01', 7);
    addRent('b01', 30);
    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].termDays).toBe(30);
  });

  it('rejects rental terms other than 7 or 30', () => {
    expect(useCartStore.getState().addRent('b01', 14 as 7).ok).toBe(false);
  });

  it('removes a line when its quantity drops to zero and clamps to stock', () => {
    const { addBuy, setQuantity } = useCartStore.getState();
    addBuy('b05');
    const id = useCartStore.getState().lines[0].id;
    setQuantity(id, 500);
    expect(useCartStore.getState().lines[0].quantity).toBe(9);
    setQuantity(id, 0);
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('changes a rental term only on rental lines', () => {
    const { addBuy, addRent, setTerm } = useCartStore.getState();
    addBuy('b01');
    addRent('b02', 7);
    const [buyLine, rentLine] = useCartStore.getState().lines;
    setTerm(buyLine.id, 30);
    setTerm(rentLine.id, 30);
    const lines = useCartStore.getState().lines;
    expect(lines[0].termDays).toBeUndefined();
    expect(lines[1].termDays).toBe(30);
  });
});

describe('placing an order', () => {
  it('creates the order and rentals, adds books to the library and empties the cart', () => {
    const cart = useCartStore.getState();
    cart.addBuy('b01');
    cart.addRent('b02', 30);
    const result = useShelfStore.getState().placeOrder();

    expect(result.ok).toBe(true);
    const state = useShelfStore.getState();
    expect(state.orders).toHaveLength(1);
    expect(state.rentals).toHaveLength(1);
    expect(state.rentals[0]).toMatchObject({ bookId: 'b02', termDays: 30 });
    expect(state.library.b01).toMatchObject({ owned: true });
    expect(state.library.b02).toMatchObject({ owned: false, source: 'rental' });
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it('changes nothing when validation fails, so the cart is preserved', () => {
    useCartStore.setState({
      lines: [{ id: 'b21:buy', bookId: 'b21', mode: 'buy', quantity: 1 }],
    });
    const result = useShelfStore.getState().placeOrder();
    expect(result.ok).toBe(false);
    expect(useShelfStore.getState().orders).toHaveLength(0);
    expect(useShelfStore.getState().library).toEqual({});
    expect(useCartStore.getState().lines).toHaveLength(1);
  });

  it('does not create a duplicate order when placed twice', () => {
    useCartStore.getState().addBuy('b01');
    useShelfStore.getState().placeOrder();
    const second = useShelfStore.getState().placeOrder();
    expect(second.ok).toBe(false);
    expect(useShelfStore.getState().orders).toHaveLength(1);
  });

  it('returns a rental once and frees the book to be rented again', () => {
    useCartStore.getState().addRent('b02', 7);
    useShelfStore.getState().placeOrder();
    const rentalId = useShelfStore.getState().rentals[0].id;
    useShelfStore.getState().returnRental(rentalId);
    const returnedAt = useShelfStore.getState().rentals[0].returnedAt;
    expect(returnedAt).toBeDefined();
    useShelfStore.getState().returnRental(rentalId);
    expect(useShelfStore.getState().rentals[0].returnedAt).toBe(returnedAt);

    useCartStore.getState().addRent('b02', 7);
    expect(useShelfStore.getState().placeOrder().ok).toBe(true);
  });

  it('refuses to remove owned books or books with an active rental from the library', () => {
    useCartStore.getState().addBuy('b01');
    useCartStore.getState().addRent('b02', 7);
    useShelfStore.getState().placeOrder();
    expect(useShelfStore.getState().removeBook('b01')).toBe(false);
    expect(useShelfStore.getState().removeBook('b02')).toBe(false);
  });
});

describe('renewing a rental', () => {
  const baseRental = (over: Partial<Rental> = {}): Rental => ({
    id: 'r1',
    orderId: 'o1',
    bookId: 'b01',
    termDays: 7,
    startAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    price: 285,
    ...over,
  });

  it('extends the due date from the current due date and records the fee', () => {
    const rental = baseRental();
    useShelfStore.setState({ rentals: [rental] });
    const result = useShelfStore.getState().renewRental('r1', 7);
    expect(result.ok).toBe(true);
    const saved = useShelfStore.getState().rentals[0];
    expect(new Date(saved.dueAt).getTime() - new Date(rental.dueAt).getTime()).toBe(7 * 86_400_000);
    expect(saved.renewals).toHaveLength(1);
    expect(saved.renewals?.[0]).toMatchObject({ termDays: 7, price: 285 });
    expect(saved.price).toBe(285);
  });

  it('supports a 30 day renewal at the 30 day price', () => {
    useShelfStore.setState({ rentals: [baseRental()] });
    useShelfStore.getState().renewRental('r1', 30);
    expect(useShelfStore.getState().rentals[0].renewals?.[0]).toMatchObject({
      termDays: 30,
      price: 570,
    });
  });

  it('refuses a second renewal and leaves the rental unchanged', () => {
    useShelfStore.setState({ rentals: [baseRental()] });
    expect(useShelfStore.getState().renewRental('r1', 7).ok).toBe(true);
    const afterFirst = useShelfStore.getState().rentals[0];
    const second = useShelfStore.getState().renewRental('r1', 7);
    expect(second).toMatchObject({ ok: false });
    expect(useShelfStore.getState().rentals[0]).toEqual(afterFirst);
  });

  it('refuses to renew an expired rental', () => {
    useShelfStore.setState({
      rentals: [baseRental({ dueAt: new Date(Date.now() - 86_400_000).toISOString() })],
    });
    const result = useShelfStore.getState().renewRental('r1', 7);
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toMatch(/expired/);
    expect(useShelfStore.getState().rentals[0].renewals).toBeUndefined();
  });

  it('refuses to renew a returned rental', () => {
    useShelfStore.setState({ rentals: [baseRental({ returnedAt: new Date().toISOString() })] });
    expect(useShelfStore.getState().renewRental('r1', 7).ok).toBe(false);
  });

  it('refuses to renew a title that has a waitlist', () => {
    useShelfStore.setState({ rentals: [baseRental({ bookId: 'b05' })] }); // 2 waiting
    const result = useShelfStore.getState().renewRental('r1', 7);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/waiting/);
  });

  it('rejects unknown rentals and terms other than 7 or 30', () => {
    useShelfStore.setState({ rentals: [baseRental()] });
    expect(useShelfStore.getState().renewRental('nope', 7).ok).toBe(false);
    expect(useShelfStore.getState().renewRental('r1', 14 as 7).ok).toBe(false);
    expect(useShelfStore.getState().rentals[0].renewals).toBeUndefined();
  });

  it('only renews the rental that was asked for', () => {
    useShelfStore.setState({
      rentals: [baseRental(), baseRental({ id: 'r2', bookId: 'b02' })],
    });
    useShelfStore.getState().renewRental('r1', 7);
    expect(useShelfStore.getState().rentals[1].renewals).toBeUndefined();
  });

  it('keeps the renewal history after the book is returned', () => {
    useShelfStore.setState({ rentals: [baseRental()] });
    useShelfStore.getState().renewRental('r1', 7);
    useShelfStore.getState().returnRental('r1');
    const saved = useShelfStore.getState().rentals[0];
    expect(saved.returnedAt).toBeDefined();
    expect(saved.renewals).toHaveLength(1);
  });
});

describe('profile store', () => {
  it('accepts only known professions', () => {
    const { setProfession } = useProfileStore.getState();
    setProfession('teacher');
    expect(useProfileStore.getState().professionId).toBe('teacher');
    setProfession('<script>alert(1)</script>');
    expect(useProfileStore.getState().professionId).toBeNull();
  });

  it('toggles interests, ignores unknown ids and caps the total at five', () => {
    const { toggleInterest } = useProfileStore.getState();
    toggleInterest('art');
    toggleInterest('art');
    expect(useProfileStore.getState().interestIds).toEqual([]);
    toggleInterest('bogus');
    expect(useProfileStore.getState().interestIds).toEqual([]);
    for (const id of ['fiction', 'science', 'history', 'business', 'self-help', 'technology']) {
      toggleInterest(id);
    }
    expect(useProfileStore.getState().interestIds).toHaveLength(5);
  });

  it('limits the display name length', () => {
    useProfileStore.getState().setName('x'.repeat(500));
    expect(useProfileStore.getState().name.length).toBeLessThanOrEqual(40);
  });

  it('toggles professional interests, ignores unknown ids and caps them at five', () => {
    const { toggleProfessionalInterest } = useProfileStore.getState();
    toggleProfessionalInterest('ai');
    toggleProfessionalInterest('ai');
    expect(useProfileStore.getState().professionalInterestIds).toEqual([]);
    toggleProfessionalInterest('not-a-topic');
    expect(useProfileStore.getState().professionalInterestIds).toEqual([]);
    for (const id of ['software', 'ai', 'leadership', 'startups', 'design', 'medicine']) {
      toggleProfessionalInterest(id);
    }
    expect(useProfileStore.getState().professionalInterestIds).toEqual([
      'software',
      'ai',
      'leadership',
      'startups',
      'design',
    ]);
  });

  it('toggles reading goals, ignores unknown ids and caps them at three', () => {
    const { toggleGoal } = useProfileStore.getState();
    toggleGoal('unwind');
    toggleGoal('unwind');
    expect(useProfileStore.getState().goalIds).toEqual([]);
    toggleGoal('<img src=x onerror=alert(1)>');
    expect(useProfileStore.getState().goalIds).toEqual([]);
    for (const id of ['career-growth', 'learn-something-new', 'build-habits', 'unwind']) {
      toggleGoal(id);
    }
    expect(useProfileStore.getState().goalIds).toEqual([
      'career-growth',
      'learn-something-new',
      'build-habits',
    ]);
  });

  it('frees a slot when a selection is removed at the cap', () => {
    const { toggleGoal } = useProfileStore.getState();
    for (const id of ['career-growth', 'learn-something-new', 'build-habits']) toggleGoal(id);
    toggleGoal('unwind');
    expect(useProfileStore.getState().goalIds).not.toContain('unwind');
    toggleGoal('build-habits');
    toggleGoal('unwind');
    expect(useProfileStore.getState().goalIds).toContain('unwind');
  });

  it('clears preferences but keeps the display name', () => {
    const state = useProfileStore.getState();
    state.setName('Priya');
    state.setProfession('doctor');
    state.toggleProfessionalInterest('medicine');
    state.toggleInterest('health');
    state.toggleGoal('stay-healthy');
    state.clearPreferences();
    expect(useProfileStore.getState()).toMatchObject({
      name: 'Priya',
      professionId: null,
      professionalInterestIds: [],
      interestIds: [],
      goalIds: [],
    });
  });
});

describe('persisted state recovery', () => {
  it('drops corrupt or tampered cart lines on load', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(
      'booknest.cart',
      JSON.stringify({
        state: {
          lines: [
            { id: 'ok', bookId: 'b01', mode: 'buy', quantity: 1 },
            { id: 'bad1', bookId: 'ghost', mode: 'buy', quantity: 1 },
            { id: 'bad2', bookId: 'b01', mode: 'rent', quantity: 1, termDays: 99 },
            { id: 'bad3', bookId: 'b01', mode: 'buy', quantity: -4 },
            'garbage',
          ],
        },
        version: 1,
      }),
    );
    await useCartStore.persist.rehydrate();
    expect(useCartStore.getState().lines.map((l) => l.id)).toEqual(['ok']);
  });

  it('keeps a version 1 profile and defaults the new fields when upgrading', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(
      'booknest.profile',
      JSON.stringify({
        state: { name: 'Sam', professionId: 'teacher', interestIds: ['history'], onboarded: true },
        version: 1,
      }),
    );
    await useProfileStore.persist.rehydrate();
    expect(useProfileStore.getState()).toMatchObject({
      name: 'Sam',
      professionId: 'teacher',
      interestIds: ['history'],
      professionalInterestIds: [],
      goalIds: [],
      onboarded: true,
    });
  });

  it('drops tampered or wrongly typed preference values on load', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem(
      'booknest.profile',
      JSON.stringify({
        state: {
          name: 'Sam',
          professionId: { $ne: null },
          professionalInterestIds: ['ai', 'ai', '<script>', 42, 'leadership'],
          interestIds: 'art',
          goalIds: ['unwind', 'x', 'quick-reads', 'build-habits', 'career-growth'],
        },
        version: 2,
      }),
    );
    await useProfileStore.persist.rehydrate();
    const state = useProfileStore.getState();
    expect(state.professionId).toBeNull();
    expect(state.professionalInterestIds).toEqual(['ai', 'leadership']);
    expect(state.interestIds).toEqual([]);
    expect(state.goalIds).toEqual(['unwind', 'quick-reads', 'build-habits']);
  });

  it('falls back to defaults when stored data is not valid JSON', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('booknest.shelf', '{not json');
    await expect(useShelfStore.persist.rehydrate()).resolves.not.toThrow();
    expect(useShelfStore.getState().rentals).toEqual([]);
  });

  it('loads rentals saved before renewals existed', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const old = {
      id: 'r1',
      orderId: 'o1',
      bookId: 'b01',
      termDays: 7,
      startAt: '2025-03-01T00:00:00.000Z',
      dueAt: '2025-03-08T00:00:00.000Z',
      price: 285,
    };
    await AsyncStorage.setItem(
      'booknest.shelf',
      JSON.stringify({ state: { library: {}, rentals: [old], orders: [] }, version: 1 }),
    );
    await useShelfStore.persist.rehydrate();
    expect(useShelfStore.getState().rentals).toEqual([old]);
  });

  it('keeps valid renewals and drops rentals with tampered renewal data', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const base = {
      orderId: 'o1',
      bookId: 'b01',
      termDays: 7,
      startAt: '2025-03-01T00:00:00.000Z',
      dueAt: '2025-03-15T00:00:00.000Z',
      price: 285,
    };
    const good = {
      ...base,
      id: 'good',
      renewals: [
        {
          renewedAt: '2025-03-05T00:00:00.000Z',
          termDays: 7,
          previousDueAt: '2025-03-08T00:00:00.000Z',
          dueAt: '2025-03-15T00:00:00.000Z',
          price: 285,
        },
      ],
    };
    const badTerm = { ...base, id: 'bad1', renewals: [{ ...good.renewals[0], termDays: 99 }] };
    const notAList = { ...base, id: 'bad2', renewals: 'lots' };
    const badDate = { ...base, id: 'bad3', renewals: [{ ...good.renewals[0], dueAt: 'soon' }] };
    await AsyncStorage.setItem(
      'booknest.shelf',
      JSON.stringify({
        state: { library: {}, rentals: [good, badTerm, notAList, badDate], orders: [] },
        version: 1,
      }),
    );
    await useShelfStore.persist.rehydrate();
    expect(useShelfStore.getState().rentals.map((rental) => rental.id)).toEqual(['good']);
  });
});
