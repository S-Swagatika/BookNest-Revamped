import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';

import { RecommendationGrid } from '@/components/book/RecommendationGrid';
import { PreferencesEditor } from '@/components/profile/PreferencesEditor';
import { BOOKS, CATEGORIES, PROFESSIONAL_TOPICS, PROFESSIONS, READING_GOALS } from '@/data/seed';
import { recommendBooks } from '@/domain/recommendations';
import { useRecommendations } from '@/hooks/use-recommendations';
import { useProfileStore } from '@/store/profile';
import { useShelfStore } from '@/store/shelf';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { push: jest.fn(), setParams: jest.fn() },
  usePathname: () => '/',
}));

beforeEach(() => {
  useProfileStore.getState().reset();
  useShelfStore.setState({ library: {}, rentals: [], orders: [] });
});

const selected = (name: string | RegExp) =>
  screen.getByRole('button', { name }).props.accessibilityState.selected;

describe('PreferencesEditor', () => {
  it('shows all four preference groups with their options', () => {
    render(<PreferencesEditor />);
    for (const heading of [
      'Your profession',
      'Professional interests',
      'Personal interests',
      'Reading goals',
    ]) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
    for (const item of [...PROFESSIONS, ...PROFESSIONAL_TOPICS, ...READING_GOALS]) {
      expect(screen.getByRole('button', { name: item.label })).toBeTruthy();
    }
    for (const category of CATEGORIES) {
      expect(screen.getByRole('button', { name: category.name })).toBeTruthy();
    }
  });

  it('saves a choice in each group and marks it selected', () => {
    render(<PreferencesEditor />);
    fireEvent.press(screen.getByRole('button', { name: 'Doctor' }));
    fireEvent.press(screen.getByRole('button', { name: 'Medicine and biology' }));
    fireEvent.press(screen.getByRole('button', { name: 'Health' }));
    fireEvent.press(screen.getByRole('button', { name: 'Look after my health' }));

    expect(useProfileStore.getState()).toMatchObject({
      professionId: 'doctor',
      professionalInterestIds: ['medicine'],
      interestIds: ['health'],
      goalIds: ['stay-healthy'],
      onboarded: true,
    });
    expect(selected('Doctor')).toBe(true);
    expect(selected('Look after my health')).toBe(true);
  });

  it('lets the reader change and remove a choice', () => {
    render(<PreferencesEditor />);
    fireEvent.press(screen.getByRole('button', { name: 'Doctor' }));
    fireEvent.press(screen.getByRole('button', { name: 'Teacher' }));
    expect(useProfileStore.getState().professionId).toBe('teacher');
    fireEvent.press(screen.getByRole('button', { name: 'Teacher' }));
    expect(useProfileStore.getState().professionId).toBeNull();
  });

  it('tells the reader when a limit is reached', () => {
    render(<PreferencesEditor />);
    expect(screen.getByText('Choose up to 3. 0 selected.')).toBeTruthy();
    for (const label of ['Grow in my career', 'Learn something new', 'Build better habits']) {
      fireEvent.press(screen.getByRole('button', { name: label }));
    }
    expect(screen.getByText('3 of 3 selected. Remove one to choose another.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Relax and unwind' }));
    expect(useProfileStore.getState().goalIds).toHaveLength(3);
  });

  it('offers "Clear preferences" only when something is set, and clears everything', () => {
    render(<PreferencesEditor />);
    expect(screen.queryByRole('button', { name: 'Clear preferences' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Designer' }));
    fireEvent.press(screen.getByRole('button', { name: 'Clear preferences' }));
    expect(useProfileStore.getState().professionId).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear preferences' })).toBeNull();
  });
});

describe('useRecommendations', () => {
  it('falls back to popular books until preferences are set, then updates immediately', async () => {
    const { result } = renderHook(() => useRecommendations(4));
    expect(result.current.personalised).toBe(false);

    await act(async () => {
      useProfileStore.getState().toggleGoal('stay-healthy');
    });
    expect(result.current.personalised).toBe(true);
    expect(result.current.items[0].reasons[0]).toBe('Supports your goal: Look after my health');

    await act(async () => {
      useProfileStore.getState().toggleGoal('stay-healthy');
    });
    expect(result.current.personalised).toBe(false);
  });

  it('matches the engine called directly with the same preferences', async () => {
    await act(async () => {
      const state = useProfileStore.getState();
      state.setProfession('manager');
      state.toggleProfessionalInterest('leadership');
      state.toggleInterest('business');
    });
    const { result } = renderHook(() => useRecommendations(5));
    const direct = recommendBooks({
      books: BOOKS,
      categories: CATEGORIES,
      professions: PROFESSIONS,
      topics: PROFESSIONAL_TOPICS,
      goals: READING_GOALS,
      professionId: 'manager',
      professionalInterestIds: ['leadership'],
      interestIds: ['business'],
      goalIds: [],
      library: {},
      activeRentalBookIds: [],
      limit: 5,
    });
    expect(result.current.items.map((i) => i.book.id)).toEqual(direct.items.map((i) => i.book.id));
  });

  it('stops recommending a book once the reader buys it', async () => {
    await act(async () => {
      useProfileStore.getState().toggleInterest('technology');
    });
    const { result } = renderHook(() => useRecommendations(24));
    const first = result.current.items[0].book.id;
    await act(async () => {
      useShelfStore.setState({
        library: {
          [first]: {
            bookId: first,
            status: 'wantToRead',
            owned: true,
            addedAt: '2025-01-01T00:00:00.000Z',
            source: 'purchase',
          },
        },
      });
    });
    expect(result.current.items.map((i) => i.book.id)).not.toContain(first);
  });
});

describe('RecommendationGrid', () => {
  const personalised = recommendBooks({
    books: BOOKS,
    categories: CATEGORIES,
    professions: PROFESSIONS,
    topics: PROFESSIONAL_TOPICS,
    goals: READING_GOALS,
    professionId: 'software-engineer',
    professionalInterestIds: ['software'],
    interestIds: ['technology'],
    goalIds: ['career-growth'],
    library: {},
    activeRentalBookIds: [],
    limit: 3,
  });

  it('shows the strongest reason on each card', () => {
    render(<RecommendationGrid items={personalised.items} />);
    for (const item of personalised.items) {
      expect(screen.getAllByText(item.reasons[0]).length).toBeGreaterThan(0);
    }
    expect(screen.queryByText('WHY THIS BOOK')).toBeNull();
  });

  it('labels every card in detailed mode', () => {
    render(<RecommendationGrid items={personalised.items} detailed />);
    expect(screen.getAllByText('WHY THIS BOOK')).toHaveLength(personalised.items.length);
  });

  it('shows every rule that fired, with its points, in detailed mode', () => {
    const top = personalised.items[0];
    render(<RecommendationGrid items={[top]} detailed />);
    expect(top.breakdown.length).toBeGreaterThan(1);
    for (const part of top.breakdown) {
      expect(screen.getByText(`• ${part.text} (+${part.points})`)).toBeTruthy();
    }
  });

  it('shows a helpful empty state when there is nothing to recommend', () => {
    render(<RecommendationGrid items={[]} />);
    expect(screen.getByText('No recommendations yet')).toBeTruthy();
  });
});
