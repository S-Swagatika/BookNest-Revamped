import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  getCategories,
  getProfessionalTopics,
  getProfessions,
  getReadingGoals,
} from '@/data/catalogue';
import { MAX_INTERESTS, MAX_PROFESSIONAL_INTERESTS, MAX_READING_GOALS } from '@/data/seed';

import { persistStorage } from './storage';

export const MAX_NAME_LENGTH = 40;

interface ProfileState {
  name: string;
  professionId: string | null;
  /** Work topics (professional interests). */
  professionalInterestIds: string[];
  /** Personal interests: category ids. */
  interestIds: string[];
  goalIds: string[];
  onboarded: boolean;
  setName: (name: string) => void;
  setProfession: (professionId: string | null) => void;
  toggleProfessionalInterest: (topicId: string) => void;
  toggleInterest: (categoryId: string) => void;
  toggleGoal: (goalId: string) => void;
  completeOnboarding: () => void;
  /** Clears profession, interests and goals but keeps the display name. */
  clearPreferences: () => void;
  reset: () => void;
}

const initial = {
  name: 'Reader',
  professionId: null,
  professionalInterestIds: [] as string[],
  interestIds: [] as string[],
  goalIds: [] as string[],
  onboarded: false,
};

/** Allowlist-validate ids so corrupt or tampered persisted data cannot inject values. */
function validProfession(id: unknown): string | null {
  return typeof id === 'string' && getProfessions().some((profession) => profession.id === id)
    ? id
    : null;
}

function validIds(ids: unknown, allowed: readonly { id: string }[], max: number): string[] {
  if (!Array.isArray(ids)) return [];
  const allowedIds = new Set(allowed.map((item) => item.id));
  return [...new Set(ids)]
    .filter((id): id is string => typeof id === 'string' && allowedIds.has(id))
    .slice(0, max);
}

const validInterests = (ids: unknown) => validIds(ids, getCategories(), MAX_INTERESTS);
const validTopics = (ids: unknown) =>
  validIds(ids, getProfessionalTopics(), MAX_PROFESSIONAL_INTERESTS);
const validGoals = (ids: unknown) => validIds(ids, getReadingGoals(), MAX_READING_GOALS);

function toggled(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((existing) => existing !== id) : [...list, id];
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      ...initial,
      setName: (name) => set({ name: name.slice(0, MAX_NAME_LENGTH) }),
      setProfession: (professionId) => set({ professionId: validProfession(professionId) }),
      toggleProfessionalInterest: (topicId) =>
        set((state) => ({
          professionalInterestIds: validTopics(toggled(state.professionalInterestIds, topicId)),
        })),
      toggleInterest: (categoryId) =>
        set((state) => ({ interestIds: validInterests(toggled(state.interestIds, categoryId)) })),
      toggleGoal: (goalId) =>
        set((state) => ({ goalIds: validGoals(toggled(state.goalIds, goalId)) })),
      completeOnboarding: () => set({ onboarded: true }),
      clearPreferences: () =>
        set({
          professionId: null,
          professionalInterestIds: [],
          interestIds: [],
          goalIds: [],
        }),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'booknest.profile',
      // v2 added professionalInterestIds and goalIds. Older data is kept and the new fields
      // default to empty in `merge`.
      version: 2,
      migrate: (persisted) => persisted as ProfileState,
      storage: persistStorage,
      partialize: ({
        name,
        professionId,
        professionalInterestIds,
        interestIds,
        goalIds,
        onboarded,
      }) => ({ name, professionId, professionalInterestIds, interestIds, goalIds, onboarded }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Record<string, unknown>;
        return {
          ...current,
          name:
            typeof saved.name === 'string' ? saved.name.slice(0, MAX_NAME_LENGTH) : current.name,
          professionId: validProfession(saved.professionId),
          professionalInterestIds: validTopics(saved.professionalInterestIds),
          interestIds: validInterests(saved.interestIds),
          goalIds: validGoals(saved.goalIds),
          onboarded: saved.onboarded === true,
        };
      },
    },
  ),
);
