import { Link, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

import { AppText } from './AppText';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'onDark';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  href?: Href;
  variant?: Variant;
  icon?: IconName;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const palette: Record<Variant, { bg: string; hover: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, hover: '#173B30', fg: colors.primaryText, border: colors.primary },
  accent: { bg: colors.accent, hover: '#A07830', fg: '#1C1917', border: colors.accent },
  secondary: {
    bg: 'transparent',
    hover: colors.surfaceAlt,
    fg: colors.primary,
    border: colors.primary,
  },
  ghost: { bg: 'transparent', hover: colors.surfaceAlt, fg: colors.ink, border: 'transparent' },
  onDark: {
    bg: 'transparent',
    hover: 'rgba(255,255,255,0.12)',
    fg: colors.heroText,
    border: colors.heroMuted,
  },
};

export function Button({
  label,
  onPress,
  href,
  variant = 'primary',
  icon,
  disabled,
  fullWidth,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const tone = palette[variant];
  // `Link asChild` merges props through Radix Slot, which spreads `style` into an
  // object: array styles crash on web and function styles are dropped. Pass one
  // flattened object instead.
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const content = (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={StyleSheet.flatten([
        styles.base,
        {
          backgroundColor: hovered || pressed ? tone.hover : tone.bg,
          borderColor: tone.border,
          opacity: disabled ? 0.45 : 1,
        },
        fullWidth && styles.full,
        style,
      ])}
    >
      {icon ? <Ionicons name={icon} size={18} color={tone.fg} /> : null}
      <AppText variant="small" bold style={{ color: tone.fg }}>
        {label}
      </AppText>
    </Pressable>
  );

  if (href && !disabled) {
    return (
      <Link href={href} asChild>
        {content}
      </Link>
    );
  }
  return content;
}

export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.icon}
    >
      <Ionicons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}

export const buttonRow: ViewStyle = { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm };

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  full: { alignSelf: 'stretch' },
  icon: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export { View };
