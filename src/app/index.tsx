import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book/BookCover';
import { BookGrid } from '@/components/book/BookGrid';
import { RecommendationGrid } from '@/components/book/RecommendationGrid';
import { RentalReminders } from '@/components/rentals/RentalReminders';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Container, Screen, Section } from '@/components/ui/Layout';
import {
  getBestsellers,
  getBook,
  getCategories,
  getFeaturedBooks,
  getNewArrivals,
} from '@/data/catalogue';
import { useRecommendations } from '@/hooks/use-recommendations';
import { useBreakpoint } from '@/theme/breakpoints';
import { colors, radius, spacing } from '@/theme/tokens';
import { useRouter } from 'expo-router';

function Hero() {
  const { isCompact, isExpanded } = useBreakpoint();
  const featured = getBook('b01');
  return (
    <View style={styles.hero}>
      <Container style={[styles.heroInner, !isCompact && styles.heroRow]}>
        <View style={styles.heroText}>
          <AppText variant="label" color="accent">
            BUY · RENT · DISCOVER
          </AppText>
          <AppText variant="display" style={{ color: colors.heroText }}>
            Your next favourite book is waiting.
          </AppText>
          <AppText variant="body" style={{ color: colors.heroMuted }}>
            Buy a copy to keep, or rent for 7 or 30 days. Get recommendations shaped by your work
            and your interests.
          </AppText>
          <View style={styles.heroActions}>
            <Button
              label="Browse the collection"
              variant="accent"
              href="/browse"
              icon="arrow-forward"
            />
            <Button label="Personalise my picks" variant="onDark" href="/recommendations" />
          </View>
        </View>
        {featured && !isCompact ? (
          <View style={[styles.heroCover, isExpanded && { width: 240 }]}>
            <BookCover book={featured} size="lg" />
          </View>
        ) : null}
      </Container>
    </View>
  );
}

function CategoryRow() {
  const router = useRouter();
  return (
    <Section title="Browse by category" subtitle="Find your next read by subject.">
      <View style={styles.chips}>
        {getCategories().map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            onPress={() => router.push({ pathname: '/browse', params: { category: category.id } })}
            accessibilityLabel={`Browse ${category.name}`}
          />
        ))}
      </View>
    </Section>
  );
}

function Recommended() {
  const result = useRecommendations(4);
  return (
    <Section
      title={result.personalised ? 'Recommended for you' : 'Popular with readers'}
      subtitle={
        result.personalised
          ? 'Picked from your profession, interests, goals and reading library.'
          : 'Tell us about your work, interests and goals to get picks made for you.'
      }
      actionLabel={result.personalised ? 'See why and edit' : 'Personalise'}
      actionHref="/recommendations"
    >
      <RecommendationGrid items={result.items} />
    </Section>
  );
}

export default function HomeScreen() {
  return (
    <Screen>
      <Hero />
      <RentalReminders />
      <Section title="Featured books" subtitle="Editors’ picks this month.">
        <BookGrid books={getFeaturedBooks()} />
      </Section>
      <Recommended />
      <CategoryRow />
      <Section title="New arrivals" actionLabel="See all" actionHref="/browse">
        <BookGrid books={getNewArrivals()} />
      </Section>
      <Section title="Bestsellers">
        <BookGrid books={getBestsellers().slice(0, 4)} />
      </Section>
      <Container style={styles.trust}>
        <View style={styles.trustItem}>
          <Ionicons name="calendar-outline" size={22} color={colors.primary} />
          <AppText variant="small" bold>
            Rent for 7 or 30 days
          </AppText>
        </View>
        <View style={styles.trustItem}>
          <Ionicons name="cube-outline" size={22} color={colors.primary} />
          <AppText variant="small" bold>
            Free shipping over $40
          </AppText>
        </View>
        <View style={styles.trustItem}>
          <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
          <AppText variant="small" bold>
            Picks made for you
          </AppText>
        </View>
      </Container>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.hero, paddingVertical: spacing.xxxl },
  heroInner: { gap: spacing.xxl },
  heroRow: { flexDirection: 'row', alignItems: 'center' },
  heroText: { flex: 1, gap: spacing.lg },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  heroCover: { width: 200, transform: [{ rotate: '3deg' }], borderRadius: radius.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  trust: {
    marginTop: spacing.xxxl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    justifyContent: 'center',
  },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
