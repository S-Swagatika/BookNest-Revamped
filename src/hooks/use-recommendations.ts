import { useMemo } from 'react';

import {
  getBooks,
  getCategories,
  getProfessionalTopics,
  getProfessions,
  getReadingGoals,
} from '@/data/catalogue';
import { activeRentalBookIds } from '@/domain/library';
import { recommendBooks, type RecommendationResult } from '@/domain/recommendations';
import { useProfileStore } from '@/store/profile';
import { useShelfStore } from '@/store/shelf';

/** Recomputes whenever the reader edits their preferences, library or rentals. */
export function useRecommendations(limit: number): RecommendationResult {
  const professionId = useProfileStore((state) => state.professionId);
  const professionalInterestIds = useProfileStore((state) => state.professionalInterestIds);
  const interestIds = useProfileStore((state) => state.interestIds);
  const goalIds = useProfileStore((state) => state.goalIds);
  const library = useShelfStore((state) => state.library);
  const rentals = useShelfStore((state) => state.rentals);

  return useMemo(
    () =>
      recommendBooks({
        books: getBooks(),
        categories: getCategories(),
        professions: getProfessions(),
        topics: getProfessionalTopics(),
        goals: getReadingGoals(),
        professionId,
        professionalInterestIds,
        interestIds,
        goalIds,
        library,
        activeRentalBookIds: activeRentalBookIds(rentals),
        limit,
      }),
    [professionId, professionalInterestIds, interestIds, goalIds, library, rentals, limit],
  );
}
