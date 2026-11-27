import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

import { AppText } from './AppText';

export function Chip({
  label,
  selected,
  onPress,
  count,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  count?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={(state) => {
        const hovered = (state as { hovered?: boolean }).hovered;
        return [
          styles.chip,
          selected && styles.chipSelected,
          !selected && hovered && { backgroundColor: colors.surfaceAlt },
        ];
      }}
    >
      <AppText
        variant="small"
        bold={!!selected}
        style={{ color: selected ? colors.primaryText : colors.ink }}
      >
        {label}
        {count !== undefined ? `  ${count}` : ''}
      </AppText>
    </Pressable>
  );
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const tones: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceAlt, fg: colors.ink },
  success: { bg: colors.successSoft, fg: colors.success },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  accent: { bg: colors.accentSoft, fg: colors.accentText },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.badge, { backgroundColor: tones[tone].bg }]}>
      <AppText variant="caption" bold style={{ color: tones[tone].fg }}>
        {label}
      </AppText>
    </View>
  );
}

export function Rating({ value, count }: { value: number; count?: number }) {
  const label = `Rated ${value.toFixed(1)} out of 5${count ? ` from ${count.toLocaleString('en-US')} reviews` : ''}`;
  return (
    <View accessible accessibilityLabel={label} style={styles.rating}>
      <Ionicons name="star" size={14} color={colors.accent} />
      <AppText variant="caption" bold>
        {value.toFixed(1)}
      </AppText>
      {count ? (
        <AppText variant="caption" color="muted">
          ({count.toLocaleString('en-US')})
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
