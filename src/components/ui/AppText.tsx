import { Text, type TextProps, type TextStyle } from 'react-native';

import { useBreakpoint, type Breakpoint } from '@/theme/breakpoints';
import { colors, fonts, type ColorName } from '@/theme/tokens';

export type TextVariant =
  'display' | 'title' | 'heading' | 'subheading' | 'body' | 'small' | 'caption' | 'label';

const sizes: Record<TextVariant, Record<Breakpoint, number>> = {
  display: { compact: 34, medium: 44, expanded: 56 },
  title: { compact: 26, medium: 30, expanded: 34 },
  heading: { compact: 20, medium: 22, expanded: 24 },
  subheading: { compact: 17, medium: 17, expanded: 18 },
  body: { compact: 15, medium: 16, expanded: 16 },
  small: { compact: 14, medium: 14, expanded: 14 },
  caption: { compact: 12, medium: 12, expanded: 13 },
  label: { compact: 13, medium: 13, expanded: 13 },
};

const serifVariants: readonly TextVariant[] = ['display', 'title', 'heading'];

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: ColorName;
  bold?: boolean;
  align?: TextStyle['textAlign'];
}

export function AppText({
  variant = 'body',
  color = 'ink',
  bold,
  align,
  style,
  ...rest
}: AppTextProps) {
  const { breakpoint } = useBreakpoint();
  const size = sizes[variant][breakpoint];
  const serif = serifVariants.includes(variant);
  const base: TextStyle = {
    color: colors[color],
    fontSize: size,
    lineHeight: Math.round(size * (serif ? 1.2 : 1.5)),
    fontFamily: serif ? fonts?.serif : fonts?.sans,
    fontWeight: bold || serif || variant === 'label' ? '700' : '400',
    textAlign: align,
  };
  if (variant === 'label') base.letterSpacing = 0.4;
  // Allow text to grow with the system font size, but cap it so fixed-height controls such as
  // tabs, chips and badges do not clip. Callers can still override the cap.
  return <Text maxFontSizeMultiplier={1.6} {...rest} style={[base, style]} />;
}
