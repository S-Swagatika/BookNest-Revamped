import { Link, type Href } from 'expo-router';
import { Children, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useBreakpoint } from '@/theme/breakpoints';
import { colors, MAX_CONTENT_WIDTH, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Centres content, caps its width and applies breakpoint-aware gutters. */
export function Container({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { breakpoint } = useBreakpoint();
  const gutter =
    breakpoint === 'compact' ? spacing.lg : breakpoint === 'medium' ? spacing.xl : spacing.xxl;
  return <View style={[styles.container, { paddingHorizontal: gutter }, style]}>{children}</View>;
}

export function Section({
  title,
  subtitle,
  actionLabel,
  actionHref,
  children,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: Href;
  children: ReactNode;
}) {
  return (
    <Container style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="body" color="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {actionLabel && actionHref ? (
          <Link href={actionHref} accessibilityRole="link">
            <AppText variant="small" bold color="primary">
              {actionLabel}
            </AppText>
          </Link>
        ) : null}
      </View>
      {children}
    </Container>
  );
}

/** Responsive equal-width grid without relying on CSS grid (works on native and web). */
export function Grid({
  columns,
  gap = spacing.lg,
  children,
}: {
  columns: number;
  gap?: number;
  children: ReactNode;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -gap / 2 }}>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={{ width: `${100 / columns}%`, padding: gap / 2 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function EmptyState({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText variant="body" color="muted" align="center">
        {message}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { paddingBottom: spacing.huge },
  container: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  section: { marginTop: spacing.xxxl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  sectionTitle: { flex: 1, gap: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
