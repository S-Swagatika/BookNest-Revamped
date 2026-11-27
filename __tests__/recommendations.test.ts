import {
  BOOKS,
  CATEGORIES,
  MAX_PROFESSIONAL_INTERESTS,
  MAX_READING_GOALS,
  PROFESSIONAL_TOPICS,
  PROFESSIONS,
  READING_GOALS,
} from '@/data/seed';
import {
  recommendBooks,
  WEIGHTS,
  type RecommendationInput,
  type RecommendationResult,
} from '@/domain/recommendations';
import type { LibraryEntry } from '@/domain/types';

const base: RecommendationInput = {
  books: BOOKS,
  categories: CATEGORIES,
  professions: PROFESSIONS,
  topics: PROFESSIONAL_TOPICS,
  goals: READING_GOALS,
  professionId: null,
  professionalInterestIds: [],
  interestIds: [],
  goalIds: [],
  library: {},
  activeRentalBookIds: [],
};

const entry = (over: Partial<LibraryEntry> & { bookId: string }): LibraryEntry => ({
  status: 'wantToRead',
  owned: false,
  addedAt: '2025-01-01T00:00:00.000Z',
  source: 'manual',
  ...over,
});

const find = (result: RecommendationResult, id: string) =>
  result.items.find((item) => item.book.id === id);

describe('taxonomy integrity', () => {
  const tags = new Set(BOOKS.flatMap((book) => book.tags));
  const categoryIds = new Set(CATEGORIES.map((c) => c.id));

  it('gives every professional interest at least one tag that real books carry', () => {
    for (const topic of PROFESSIONAL_TOPICS) {
      expect(topic.tags.some((tag) => tags.has(tag))).toBe(true);
    }
  });

  it('gives every reading goal a rule that matches at least one real book', () => {
    for (const goal of READING_GOALS) {
      const matches = BOOKS.some(
        (book) =>
          goal.categoryIds.includes(book.categoryId) ||
          goal.tags.some((tag) => book.tags.includes(tag)) ||
          (goal.maxPages !== undefined && book.pages <= goal.maxPages),
      );
      expect(matches).toBe(true);
      for (const id of goal.categoryIds) expect(categoryIds.has(id)).toBe(true);
    }
  });

  it('uses unique ids', () => {
    for (const list of [PROFESSIONAL_TOPICS, READING_GOALS, PROFESSIONS]) {
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    }
  });
});

describe('recommendations: preference inputs', () => {
  it('falls back to bestsellers with no preferences, and says so', () => {
    const result = recommendBooks(base);
    expect(result.personalised).toBe(false);
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.book.bestseller).toBe(true);
      expect(item.reasons).toEqual(['Popular with readers']);
    }
  });

  it('treats the "Other" profession with nothing else as not personalised', () => {
    expect(recommendBooks({ ...base, professionId: 'other' }).personalised).toBe(false);
  });

  it('uses profession alone and names it in the reason', () => {
    const result = recommendBooks({ ...base, professionId: 'software-engineer', limit: 3 });
    expect(result.personalised).toBe(true);
    expect(result.items[0].book.categoryId).toBe('technology');
    expect(result.items[0].reasons[0]).toBe('Fits your profession: Software Engineer');
  });

  it('uses professional interests alone', () => {
    const result = recommendBooks({ ...base, professionalInterestIds: ['ai'] });
    expect(result.personalised).toBe(true);
    const top = result.items[0];
    expect(top.book.id).toBe('b18'); // the only book tagged "ai"
    expect(top.reasons).toContain('Matches your work interest: AI and machine learning');
    expect(top.score).toBe(WEIGHTS.professionalInterest);
  });

  it('uses personal interests alone', () => {
    const result = recommendBooks({ ...base, interestIds: ['history'], limit: 3 });
    expect(result.items.every((item) => item.book.categoryId === 'history')).toBe(true);
    expect(result.items[0].reasons[0]).toBe('Matches your interest in History');
  });

  it('uses reading goals alone', () => {
    const result = recommendBooks({ ...base, goalIds: ['stay-healthy'], limit: 24 });
    expect(result.personalised).toBe(true);
    const scored = result.items.filter((item) => item.score > 0);
    // Every health book supports the goal, and so do books carrying its tags (e.g. wellbeing).
    const healthIds = BOOKS.filter((book) => book.categoryId === 'health').map((book) => book.id);
    for (const id of healthIds) expect(scored.map((item) => item.book.id)).toContain(id);
    for (const item of scored) {
      expect(item.reasons[0]).toBe('Supports your goal: Look after my health');
      expect(item.score).toBe(WEIGHTS.goal);
    }
    const tagMatch = find(result, 'b14'); // self-help, tagged "wellbeing"
    expect(tagMatch?.breakdown[0].detail).toBe('tags wellbeing');
  });

  it('supports a length-based goal', () => {
    const result = recommendBooks({ ...base, goalIds: ['quick-reads'], limit: 24 });
    const scored = result.items.filter((item) => item.score > 0);
    expect(scored.length).toBeGreaterThan(0);
    for (const item of scored) expect(item.book.pages).toBeLessThanOrEqual(260);
    expect(scored.map((item) => item.book.id)).not.toContain('b07'); // 504 pages
    expect(scored[0].breakdown[0].detail).toMatch(/pages \(up to 260\)/);
  });

  it('combines every input and ranks the book matching most rules first', () => {
    const result = recommendBooks({
      ...base,
      professionId: 'software-engineer',
      professionalInterestIds: ['software'],
      interestIds: ['technology'],
      goalIds: ['career-growth'],
      limit: 3,
    });
    const top = result.items[0];
    expect(top.book.id).toBe('b16'); // technology, programming + systems tags
    const kinds = top.breakdown.map((b) => b.kind);
    expect(kinds).toEqual(
      expect.arrayContaining(['profession', 'professionalInterest', 'personalInterest', 'goal']),
    );
  });
});

describe('recommendations: explanations', () => {
  const result = recommendBooks({
    ...base,
    professionId: 'designer',
    professionalInterestIds: ['design'],
    interestIds: ['art'],
    goalIds: ['be-creative'],
    limit: 8,
  });

  it('gives every item at least one reason', () => {
    for (const item of result.items) expect(item.reasons.length).toBeGreaterThan(0);
  });

  it('adds up: the score equals the sum of the points shown', () => {
    for (const item of result.items) {
      const total = item.breakdown.reduce((sum, part) => sum + part.points, 0);
      expect(item.score).toBeCloseTo(total, 10);
    }
  });

  it('lists the strongest reason first and keeps reasons aligned with the breakdown', () => {
    for (const item of result.items) {
      const points = item.breakdown.map((b) => b.points);
      expect(points).toEqual([...points].sort((a, b) => b - a));
      expect(item.reasons).toEqual(item.breakdown.map((b) => b.text));
    }
  });

  it('records what matched in each breakdown line', () => {
    const colour = find(result, 'b19'); // Seeing in Color: art, design + color tags
    expect(colour).toBeDefined();
    const topic = colour!.breakdown.find((b) => b.kind === 'professionalInterest');
    expect(topic?.detail).toContain('design');
    expect(topic?.detail).toContain('color');
    expect(colour!.breakdown.find((b) => b.kind === 'goal')?.detail).toContain('category art');
  });

  it('never explains a book with a rule that did not fire', () => {
    const result = recommendBooks({ ...base, interestIds: ['technology'], limit: 24 });
    const scored = result.items.filter((item) => item.score > 0);
    expect(scored.length).toBeGreaterThan(0);
    for (const item of scored) {
      expect(item.book.categoryId).toBe('technology');
      expect(item.reasons).toEqual(['Matches your interest in Technology']);
    }
  });

  it('pads with popular books, clearly labelled, when few books match', () => {
    const result = recommendBooks({ ...base, professionalInterestIds: ['ai'], limit: 4 });
    expect(result.items[0].book.id).toBe('b18');
    const padding = result.items.slice(1);
    expect(padding.length).toBe(3);
    for (const item of padding) expect(item.reasons).toEqual(['Popular with readers']);
  });
});

describe('recommendations: exclusions, ordering and safety', () => {
  it('never recommends owned, finished or currently rented books', () => {
    const result = recommendBooks({
      ...base,
      interestIds: ['technology'],
      library: {
        b16: entry({ bookId: 'b16', owned: true }),
        b17: entry({ bookId: 'b17', status: 'finished' }),
      },
      activeRentalBookIds: ['b18'],
      limit: 8,
    });
    const ids = result.items.map((item) => item.book.id);
    for (const excluded of ['b16', 'b17', 'b18']) expect(ids).not.toContain(excluded);
  });

  it('adds a library boost for categories the reader already owns', () => {
    const without = recommendBooks({ ...base, interestIds: ['fiction'] });
    const withLibrary = recommendBooks({
      ...base,
      interestIds: ['fiction'],
      library: { b01: entry({ bookId: 'b01', owned: true }) },
    });
    const before = find(without, 'b02')!.score;
    const after = find(withLibrary, 'b02')!;
    expect(after.score).toBe(before + WEIGHTS.libraryCategory);
    expect(after.reasons).toContain('Similar to books in your library');
  });

  it('is deterministic for identical input', () => {
    const input = {
      ...base,
      professionId: 'manager',
      professionalInterestIds: ['leadership'],
      interestIds: ['business', 'self-help'],
      goalIds: ['career-growth', 'build-habits'],
    };
    expect(recommendBooks(input)).toEqual(recommendBooks(input));
  });

  it('breaks score ties by rating, then title', () => {
    const result = recommendBooks({ ...base, interestIds: ['fiction'], limit: 24 });
    for (let i = 1; i < result.items.length; i += 1) {
      const a = result.items[i - 1];
      const b = result.items[i];
      if (a.score === b.score) expect(a.book.rating).toBeGreaterThanOrEqual(b.book.rating);
    }
  });

  it('respects the limit and never repeats a book', () => {
    const result = recommendBooks({
      ...base,
      professionId: 'student',
      interestIds: ['science'],
      limit: 5,
    });
    const ids = result.items.map((item) => item.book.id);
    expect(ids.length).toBeLessThanOrEqual(5);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('ignores unknown preference ids instead of throwing', () => {
    const result = recommendBooks({
      ...base,
      professionId: 'nope',
      professionalInterestIds: ['nope'],
      interestIds: ['nope'],
      goalIds: ['nope'],
    });
    // An unknown category id still counts as a selection but matches no book, so nothing scores.
    expect(result.items.every((item) => item.score === 0)).toBe(true);
    expect(() => recommendBooks({ ...base, goalIds: ['nope'] })).not.toThrow();
  });

  it('still works with an empty catalogue', () => {
    expect(recommendBooks({ ...base, books: [], interestIds: ['art'] }).items).toEqual([]);
  });

  it('handles the maximum selections', () => {
    const result = recommendBooks({
      ...base,
      professionalInterestIds: PROFESSIONAL_TOPICS.slice(0, MAX_PROFESSIONAL_INTERESTS).map(
        (t) => t.id,
      ),
      goalIds: READING_GOALS.slice(0, MAX_READING_GOALS).map((g) => g.id),
      interestIds: CATEGORIES.slice(0, 5).map((c) => c.id),
      limit: 24,
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(new Set(result.items.map((i) => i.book.id)).size).toBe(result.items.length);
  });
});
