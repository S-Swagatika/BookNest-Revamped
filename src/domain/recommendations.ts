import type { Book, Category, LibraryEntry, Profession, ReadingGoal, Topic } from './types';

/**
 * Every rule awards a fixed number of points. Weights live in one place so the scorer can be
 * tuned, explained to the user and tested deterministically.
 */
export const WEIGHTS = {
  /** Book is in one of the profession's categories. */
  professionCategory: 3,
  /** Per tag shared between the book and the profession. */
  professionTag: 1.5,
  /** Per selected professional interest (work topic) whose tags the book carries. */
  professionalInterest: 2,
  /** Book is in a category the reader chose as a personal interest. */
  personalInterest: 2.5,
  /** Per reading goal the book supports. */
  goal: 2,
  /** Book is in a category the reader already owns, is reading or has finished. */
  libraryCategory: 1,
} as const;

export type ReasonKind =
  'profession' | 'professionalInterest' | 'personalInterest' | 'goal' | 'library' | 'popular';

/** One rule that fired for one book. `reasons` on a recommendation are the `text` of these. */
export interface ScoreContribution {
  kind: ReasonKind;
  points: number;
  /** Short, user-facing explanation. */
  text: string;
  /** What exactly matched, for the "why" detail view. */
  detail?: string;
}

export interface Recommendation {
  book: Book;
  score: number;
  /** Strongest reason first. */
  reasons: string[];
  breakdown: ScoreContribution[];
}

export interface RecommendationResult {
  personalised: boolean;
  items: Recommendation[];
}

export interface RecommendationInput {
  books: readonly Book[];
  categories: readonly Category[];
  professions: readonly Profession[];
  professionId: string | null;
  /** Personal interests: category ids. */
  interestIds: readonly string[];
  library: Readonly<Record<string, LibraryEntry>>;
  activeRentalBookIds: readonly string[];
  limit?: number;
  topics?: readonly Topic[];
  professionalInterestIds?: readonly string[];
  goals?: readonly ReadingGoal[];
  goalIds?: readonly string[];
}

/** A book the reader can neither buy nor rent is not worth recommending. */
function isObtainable(book: Book): boolean {
  return book.stockBuy > 0 || (book.rentable && book.stockRent > 0);
}

function byRatingThenTitle(a: Book, b: Book): number {
  return b.rating - a.rating || a.title.localeCompare(b.title);
}

function overlap(a: readonly string[], b: readonly string[]): string[] {
  return a.filter((value) => b.includes(value));
}

function goalMatches(goal: ReadingGoal, book: Book): string[] {
  const matched: string[] = [];
  if (goal.categoryIds.includes(book.categoryId)) matched.push(`category ${book.categoryId}`);
  const tags = overlap(book.tags, goal.tags);
  if (tags.length > 0) matched.push(`tags ${tags.join(', ')}`);
  if (goal.maxPages !== undefined && book.pages <= goal.maxPages) {
    matched.push(`${book.pages} pages (up to ${goal.maxPages})`);
  }
  return matched;
}

export function recommendBooks(input: RecommendationInput): RecommendationResult {
  const { books, categories, professions, library, limit = 8 } = input;
  const profession = professions.find((p) => p.id === input.professionId);
  const interestIds = new Set(input.interestIds);
  const selectedTopics = (input.topics ?? []).filter((topic) =>
    (input.professionalInterestIds ?? []).includes(topic.id),
  );
  const selectedGoals = (input.goals ?? []).filter((goal) =>
    (input.goalIds ?? []).includes(goal.id),
  );
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const bookById = new Map(books.map((b) => [b.id, b]));
  const personalised =
    interestIds.size > 0 ||
    selectedTopics.length > 0 ||
    selectedGoals.length > 0 ||
    (!!profession && profession.categoryIds.length > 0);

  const excluded = new Set<string>(input.activeRentalBookIds);
  for (const book of books) {
    if (!isObtainable(book)) excluded.add(book.id);
  }
  const libraryCategories = new Set<string>();
  for (const entry of Object.values(library)) {
    if (entry.owned || entry.status === 'finished') excluded.add(entry.bookId);
    if (entry.owned || entry.status === 'finished' || entry.status === 'reading') {
      const book = bookById.get(entry.bookId);
      if (book) libraryCategories.add(book.categoryId);
    }
  }

  const scored: Recommendation[] = [];
  if (personalised) {
    for (const book of books) {
      if (excluded.has(book.id)) continue;
      const breakdown: ScoreContribution[] = [];
      const name = categoryName.get(book.categoryId) ?? book.categoryId;

      if (profession) {
        const inCategory = profession.categoryIds.includes(book.categoryId);
        const tags = overlap(book.tags, profession.tags);
        const points =
          (inCategory ? WEIGHTS.professionCategory : 0) + tags.length * WEIGHTS.professionTag;
        if (points > 0) {
          breakdown.push({
            kind: 'profession',
            points,
            text: `Fits your profession: ${profession.label}`,
            detail: [
              inCategory ? `category ${name}` : '',
              tags.length ? `tags ${tags.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join('; '),
          });
        }
      }

      for (const topic of selectedTopics) {
        const tags = overlap(book.tags, topic.tags);
        if (tags.length > 0) {
          breakdown.push({
            kind: 'professionalInterest',
            points: WEIGHTS.professionalInterest,
            text: `Matches your work interest: ${topic.label}`,
            detail: `tags ${tags.join(', ')}`,
          });
        }
      }

      if (interestIds.has(book.categoryId)) {
        breakdown.push({
          kind: 'personalInterest',
          points: WEIGHTS.personalInterest,
          text: `Matches your interest in ${name}`,
          detail: `category ${name}`,
        });
      }

      for (const goal of selectedGoals) {
        const matched = goalMatches(goal, book);
        if (matched.length > 0) {
          breakdown.push({
            kind: 'goal',
            points: WEIGHTS.goal,
            text: `Supports your goal: ${goal.label}`,
            detail: matched.join('; '),
          });
        }
      }

      if (libraryCategories.has(book.categoryId)) {
        breakdown.push({
          kind: 'library',
          points: WEIGHTS.libraryCategory,
          text: 'Similar to books in your library',
          detail: `category ${name}`,
        });
      }

      const score = breakdown.reduce((sum, item) => sum + item.points, 0);
      if (score > 0) {
        // Array.prototype.sort is stable, so equal-point reasons keep their rule order.
        breakdown.sort((a, b) => b.points - a.points);
        scored.push({ book, score, reasons: breakdown.map((item) => item.text), breakdown });
      }
    }
    scored.sort((a, b) => b.score - a.score || byRatingThenTitle(a.book, b.book));
  }

  const items = scored.slice(0, limit);
  if (items.length < limit) {
    const chosen = new Set(items.map((item) => item.book.id));
    const fallback = books
      .filter((book) => !!book.bestseller && !excluded.has(book.id) && !chosen.has(book.id))
      .sort(byRatingThenTitle);
    for (const book of fallback) {
      if (items.length >= limit) break;
      items.push({
        book,
        score: 0,
        reasons: ['Popular with readers'],
        breakdown: [{ kind: 'popular', points: 0, text: 'Popular with readers' }],
      });
    }
  }
  return { personalised, items };
}
