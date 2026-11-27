import { StyleSheet, View } from 'react-native';

import {
  getCategories,
  getProfessionalTopics,
  getProfessions,
  getReadingGoals,
} from '@/data/catalogue';
import { MAX_INTERESTS, MAX_PROFESSIONAL_INTERESTS, MAX_READING_GOALS } from '@/data/seed';
import { useProfileStore } from '@/store/profile';
import { spacing } from '@/theme/tokens';

import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Card } from '../ui/Layout';

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <AppText variant="subheading" bold accessibilityRole="header">
        {title}
      </AppText>
      {hint ? (
        <AppText variant="small" color="muted" accessibilityLiveRegion="polite">
          {hint}
        </AppText>
      ) : null}
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function limitHint(count: number, max: number): string {
  return count >= max
    ? `${count} of ${max} selected. Remove one to choose another.`
    : `Choose up to ${max}. ${count} selected.`;
}

/** Edits profession, professional interests, personal interests and reading goals. */
export function PreferencesEditor() {
  const professionId = useProfileStore((state) => state.professionId);
  const professionalInterestIds = useProfileStore((state) => state.professionalInterestIds);
  const interestIds = useProfileStore((state) => state.interestIds);
  const goalIds = useProfileStore((state) => state.goalIds);
  const setProfession = useProfileStore((state) => state.setProfession);
  const toggleProfessionalInterest = useProfileStore((state) => state.toggleProfessionalInterest);
  const toggleInterest = useProfileStore((state) => state.toggleInterest);
  const toggleGoal = useProfileStore((state) => state.toggleGoal);
  const completeOnboarding = useProfileStore((state) => state.completeOnboarding);
  const clearPreferences = useProfileStore((state) => state.clearPreferences);

  const hasAny =
    professionId !== null ||
    professionalInterestIds.length > 0 ||
    interestIds.length > 0 ||
    goalIds.length > 0;

  const edit = (action: () => void) => () => {
    action();
    completeOnboarding();
  };

  return (
    <Card style={styles.card}>
      <Group title="Your profession">
        {getProfessions().map((profession) => (
          <Chip
            key={profession.id}
            label={profession.label}
            selected={profession.id === professionId}
            onPress={edit(() =>
              setProfession(profession.id === professionId ? null : profession.id),
            )}
          />
        ))}
      </Group>

      <Group
        title="Professional interests"
        hint={limitHint(professionalInterestIds.length, MAX_PROFESSIONAL_INTERESTS)}
      >
        {getProfessionalTopics().map((topic) => (
          <Chip
            key={topic.id}
            label={topic.label}
            selected={professionalInterestIds.includes(topic.id)}
            onPress={edit(() => toggleProfessionalInterest(topic.id))}
          />
        ))}
      </Group>

      <Group title="Personal interests" hint={limitHint(interestIds.length, MAX_INTERESTS)}>
        {getCategories().map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            selected={interestIds.includes(category.id)}
            onPress={edit(() => toggleInterest(category.id))}
          />
        ))}
      </Group>

      <Group title="Reading goals" hint={limitHint(goalIds.length, MAX_READING_GOALS)}>
        {getReadingGoals().map((goal) => (
          <Chip
            key={goal.id}
            label={goal.label}
            selected={goalIds.includes(goal.id)}
            onPress={edit(() => toggleGoal(goal.id))}
          />
        ))}
      </Group>

      <View style={styles.footer}>
        <AppText variant="caption" color="muted" style={styles.privacy}>
          Your preferences stay on this device and are only used to choose which books we suggest.
          Changes apply straight away.
        </AppText>
        {hasAny ? (
          <Button label="Clear preferences" variant="secondary" onPress={clearPreferences} />
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xl },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { gap: spacing.md, alignItems: 'flex-start' },
  privacy: { alignSelf: 'stretch' },
});
