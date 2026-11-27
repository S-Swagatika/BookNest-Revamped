import Head from 'expo-router/head';
import { StyleSheet, View } from 'react-native';

import { RecommendationGrid } from '@/components/book/RecommendationGrid';
import { PreferencesEditor } from '@/components/profile/PreferencesEditor';
import { AppText } from '@/components/ui/AppText';
import { Card, Container, Screen, Section } from '@/components/ui/Layout';
import { WEIGHTS } from '@/domain/recommendations';
import { useRecommendations } from '@/hooks/use-recommendations';
import { spacing } from '@/theme/tokens';

const RULES: { label: string; points: string }[] = [
  {
    label: 'Book is in a category linked to your profession',
    points: `+${WEIGHTS.professionCategory}`,
  },
  { label: 'Book shares a tag with your profession (each)', points: `+${WEIGHTS.professionTag}` },
  {
    label: 'Book matches a professional interest (each)',
    points: `+${WEIGHTS.professionalInterest}`,
  },
  { label: 'Book is in a personal-interest category', points: `+${WEIGHTS.personalInterest}` },
  { label: 'Book supports a reading goal (each)', points: `+${WEIGHTS.goal}` },
  { label: 'Book is in a category you already read or own', points: `+${WEIGHTS.libraryCategory}` },
];

export default function RecommendationsScreen() {
  const result = useRecommendations(12);

  return (
    <Screen>
      <Head>
        <title>Recommended for you — BookNest</title>
      </Head>
      <Section
        title={result.personalised ? 'Recommended for you' : 'Popular with readers'}
        subtitle={
          result.personalised
            ? 'Each pick shows exactly why it was chosen. Change your preferences below and the list updates straight away.'
            : 'Tell us about your work, interests and goals below to get picks made for you.'
        }
      >
        <RecommendationGrid items={result.items} detailed />
      </Section>

      <Section
        title="Your preferences"
        subtitle="Profession, work and personal interests, and what you want from your reading."
      >
        <PreferencesEditor />
      </Section>

      <Section title="How picks are scored">
        <Container style={styles.flush}>
          <Card style={styles.rules}>
            <AppText variant="body" color="muted">
              Picks come from simple rules, not a hidden model. A book earns points for every rule
              it matches. Books you own, have finished or are renting are never suggested. Ties are
              broken by rating.
            </AppText>
            {RULES.map((rule) => (
              <View key={rule.label} style={styles.rule}>
                <AppText variant="small" style={styles.ruleLabel}>
                  {rule.label}
                </AppText>
                <AppText variant="small" bold color="primary">
                  {rule.points}
                </AppText>
              </View>
            ))}
          </Card>
        </Container>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flush: { paddingHorizontal: 0 },
  rules: { gap: spacing.md },
  rule: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg },
  ruleLabel: { flex: 1 },
});
