import {
  BOOKS,
  CATEGORIES,
  PROFESSIONAL_TOPICS,
  PROFESSIONS,
  READING_GOALS,
  WAITLIST,
} from './seed';

import type { Book, Category, Profession, ReadingGoal, Topic } from '@/domain/types';

/**
 * Catalogue access point. Screens go through these functions and never import seed data
 * directly, so a real API can replace this module later without UI changes.
 */
const bookIndex = new Map<string, Book>(BOOKS.map((book) => [book.id, book]));
const categoryIndex = new Map<string, Category>(
  CATEGORIES.map((category) => [category.id, category]),
);

export function getBooks(): readonly Book[] {
  return BOOKS;
}

export function getBook(id: string | undefined): Book | undefined {
  return id ? bookIndex.get(id) : undefined;
}

export function getCategories(): readonly Category[] {
  return CATEGORIES;
}

export function getCategory(id: string | undefined | null): Category | undefined {
  return id ? categoryIndex.get(id) : undefined;
}

export function getProfessions(): readonly Profession[] {
  return PROFESSIONS;
}

export function getProfessionalTopics(): readonly Topic[] {
  return PROFESSIONAL_TOPICS;
}

export function getReadingGoals(): readonly ReadingGoal[] {
  return READING_GOALS;
}

/** Number of other readers queued for a title. Zero for unknown books. */
export function getWaitlistCount(bookId: string): number {
  return WAITLIST[bookId] ?? 0;
}

export function getFeaturedBooks(): Book[] {
  return BOOKS.filter((book) => book.featured);
}

export function getNewArrivals(): Book[] {
  return BOOKS.filter((book) => book.newArrival);
}

export function getBestsellers(): Book[] {
  return BOOKS.filter((book) => book.bestseller);
}

export function getRelatedBooks(book: Book, limit = 4): Book[] {
  return BOOKS.filter((other) => other.id !== book.id && other.categoryId === book.categoryId)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, limit);
}
