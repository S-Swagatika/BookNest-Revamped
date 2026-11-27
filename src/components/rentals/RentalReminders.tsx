import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { getBook, getWaitlistCount } from '@/data/catalogue';
import { buildReminders } from '@/domain/rentals';
import { useNow } from '@/hooks/use-time';
import { useShelfStore } from '@/store/shelf';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Container } from '../ui/Layout';

/**
 * Due-soon and expired reminders. Shown in the app only: no email or push in this version.
 * Renders nothing when there is nothing to remind about.
 */
export function RentalReminders({ showLink = true }: { showLink?: boolean }) {
  const rentals = useShelfStore((state) => state.rentals);
  const now = useNow();
  const reminders = buildReminders(rentals, now, getBook, getWaitlistCount);
  if (reminders.length === 0) return null;

  return (
    <Container style={styles.wrap}>
      <View accessibilityRole="alert" accessibilityLabel="Rental reminders" style={styles.list}>
        {reminders.map((reminder) => {
          const danger = reminder.tone === 'danger';
          return (
            <View
              key={reminder.rentalId}
              style={[styles.item, danger ? styles.danger : styles.warning]}
            >
              <Ionicons
                name={danger ? 'alert-circle' : 'time'}
                size={22}
                color={danger ? colors.danger : colors.warning}
              />
              <View style={styles.text}>
                <AppText variant="small" bold color={danger ? 'danger' : 'warning'}>
                  {reminder.title}
                </AppText>
                <AppText variant="caption" color="ink">
                  {reminder.message}
                </AppText>
              </View>
            </View>
          );
        })}
        {showLink ? <Button label="Manage rentals" variant="secondary" href="/rentals" /> : null}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: spacing.lg },
  list: { gap: spacing.sm, alignItems: 'flex-start' },
  item: {
    flexDirection: 'row',
    gap: spacing.md,
    alignSelf: 'stretch',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  warning: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  text: { flex: 1, gap: 2 },
});
