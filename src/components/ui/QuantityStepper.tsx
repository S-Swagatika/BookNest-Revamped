import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

import { AppText } from './AppText';

export function QuantityStepper({
  value,
  max,
  onChange,
  label,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={`${label} quantity ${value}`}
      style={styles.row}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease quantity of ${label}`}
        onPress={() => onChange(value - 1)}
        style={styles.button}
      >
        <Ionicons name="remove" size={18} color={colors.ink} />
      </Pressable>
      <AppText variant="small" bold style={styles.value} accessibilityLiveRegion="polite">
        {value}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase quantity of ${label}`}
        accessibilityState={{ disabled: value >= max }}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.button, value >= max && { opacity: 0.4 }]}
      >
        <Ionicons name="add" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  button: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: spacing.xl, textAlign: 'center' },
});
