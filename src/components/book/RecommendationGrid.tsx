import { StyleSheet, View } from 'react-native';

import type { Recommendation } from '@/domain/recommendations';
import { colors, spacing } from '@/theme/tokens';

import { AppText } from '../ui/AppText';
import { EmptyState, Grid } from '../ui/Layout';
import { gridColumns, useBreakpoint } from '@/theme/breakpoints';

import { BookCard } from './BookCard';

/** The scoring rules a reader sees, in the same order the engine applies them. */
function Why({ item }: { item: Recommendation }) {
  return (
    <View style={styles.why} accessibilityLabel={`Why ${item.book.title} was recommended`}>
      <AppText variant="label" color="muted">
        WHY THIS BOOK
      </AppText>
      {item.breakdown.map((reason, index) => (
        <AppText key={`${reason.kind}-${index}`} variant="caption" color="ink">
          • {reason.text}
          {reason.points > 0 ? ` (+${reason.points})` : ''}
        </AppText>
      ))}
    </View>
  );
}

/** A grid of recommended books. Each card explains why the book was chosen. */
export function RecommendationGrid({
  items,
  detailed,
  emptyTitle = 'No recommendations yet',
  emptyMessage = 'Choose a profession, interests or goals to get picks made for you.',
}: {
  items: readonly Recommendation[];
  /** Show every scoring rule under the card, not just the strongest reason. */
  detailed?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const { breakpoint } = useBreakpoint();
  if (items.length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return (
    <Grid columns={gridColumns(breakpoint)} gap={spacing.lg}>
      {items.map((item) => (
        <View key={item.book.id} style={styles.cell}>
          <View style={detailed ? undefined : styles.card}>
            <BookCard book={item.book} reason={item.reasons[0]} />
          </View>
          {detailed ? <Why item={item} /> : null}
        </View>
      ))}
    </Grid>
  );
}

const styles = StyleSheet.create({
  cell: { gap: spacing.sm, flex: 1 },
  card: { flex: 1 },
  why: {
    flex: 1,
    gap: 2,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
  },
});
