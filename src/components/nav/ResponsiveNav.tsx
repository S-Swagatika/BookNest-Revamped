import { Ionicons } from '@expo/vector-icons';
import { Link, usePathname, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useBreakpoint } from '@/theme/breakpoints';
import { useInsets } from '@/theme/safe-area';
import { colors, MAX_CONTENT_WIDTH, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

import { AppText } from '../ui/AppText';

import type { IconName } from '../ui/Button';

export interface NavItem {
  href: Href;
  match: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  badge?: number;
  /** Spoken description of the badge, e.g. "2 rentals need attention". */
  badgeLabel?: string;
}

function isActive(pathname: string, match: string): boolean {
  if (match === '/') return pathname === '/';
  return pathname === match || pathname.startsWith(`${match}/`);
}

function Badge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <View style={styles.badge} accessibilityLabel={label ?? `${count} new`}>
      <AppText
        variant="caption"
        bold
        style={{ color: colors.primaryText, fontSize: 10, lineHeight: 12 }}
      >
        {count > 9 ? '9+' : count}
      </AppText>
    </View>
  );
}

function TopLink({ item, active }: { item: NavItem; active: boolean }) {
  // `Link asChild` goes through Radix Slot: pass one flattened style object, not a function.
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={item.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={
          item.badge ? `${item.label}, ${item.badgeLabel ?? item.badge}` : item.label
        }
        accessibilityState={{ selected: active }}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={StyleSheet.flatten([styles.topLink, (active || hovered) && styles.topLinkActive])}
      >
        <Ionicons
          name={active ? item.activeIcon : item.icon}
          size={18}
          color={active ? colors.accent : colors.heroText}
        />
        <AppText variant="small" bold style={{ color: active ? colors.accent : colors.heroText }}>
          {item.label}
        </AppText>
        {item.badge ? <Badge count={item.badge} label={item.badgeLabel} /> : null}
      </Pressable>
    </Link>
  );
}

/** Wide screens: brand + inline links in a top bar. */
function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const insets = useInsets();
  return (
    <View
      style={[
        styles.topWrap,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.topInner}>
        <Link href="/" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="BookNest home"
            style={styles.brand}
          >
            <Ionicons name="book" size={22} color={colors.accent} />
            <AppText variant="heading" style={{ color: colors.heroText }}>
              BookNest
            </AppText>
          </Pressable>
        </Link>
        <View style={styles.topLinks} role="navigation" aria-label="Main">
          {items.map((item) => (
            <TopLink key={item.label} item={item} active={isActive(pathname, item.match)} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** Phones: slim brand bar on top and tabs along the bottom. */
function CompactTopBar() {
  const insets = useInsets();
  return (
    <View
      style={[
        styles.compactTop,
        {
          paddingTop: styles.compactTop.paddingVertical + insets.top,
          paddingLeft: styles.compactTop.paddingHorizontal + insets.left,
          paddingRight: styles.compactTop.paddingHorizontal + insets.right,
        },
      ]}
    >
      <Link href="/" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="BookNest home" style={styles.brand}>
          <Ionicons name="book" size={20} color={colors.accent} />
          <AppText variant="heading" style={{ color: colors.heroText }}>
            BookNest
          </AppText>
        </Pressable>
      </Link>
    </View>
  );
}

function BottomTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const insets = useInsets();
  return (
    <View
      style={[
        styles.bottom,
        {
          paddingBottom: styles.bottom.paddingBottom + insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        },
      ]}
      accessibilityRole="tablist"
    >
      {items.map((item) => {
        const active = isActive(pathname, item.match);
        return (
          <Link key={item.label} href={item.href} asChild>
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={
                item.badge ? `${item.label}, ${item.badgeLabel ?? item.badge}` : item.label
              }
              accessibilityState={{ selected: active }}
              style={styles.bottomItem}
            >
              <View>
                <Ionicons
                  name={active ? item.activeIcon : item.icon}
                  size={22}
                  color={active ? colors.primary : colors.muted}
                />
                <Badge count={item.badge ?? 0} label={item.badgeLabel} />
              </View>
              <AppText
                variant="caption"
                bold={active}
                style={{
                  color: active ? colors.primary : colors.muted,
                  fontSize: 11,
                  lineHeight: 14,
                }}
              >
                {item.label}
              </AppText>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

/** Adaptive navigation: bottom tabs on phones, top bar on tablets and desktop. */
export function ResponsiveNav({ items }: { items: NavItem[] }) {
  const { isCompact } = useBreakpoint();
  return isCompact ? <CompactTopBar /> : <TopNav items={items} />;
}

export function ResponsiveBottomNav({ items }: { items: NavItem[] }) {
  const { isCompact } = useBreakpoint();
  return isCompact ? <BottomTabs items={items} /> : null;
}

const styles = StyleSheet.create({
  topWrap: { backgroundColor: colors.hero, width: '100%' },
  topInner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    gap: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET,
  },
  topLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  topLink: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  topLinkActive: { backgroundColor: 'rgba(255,255,255,0.08)' },
  compactTop: {
    backgroundColor: colors.hero,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  bottom: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: spacing.xs,
  },
  bottomItem: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
