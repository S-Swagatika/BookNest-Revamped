import Head from 'expo-router/head';
import { Slot, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';

import { ResponsiveBottomNav, ResponsiveNav, type NavItem } from '@/components/nav/ResponsiveNav';
import { ErrorFallback } from '@/components/ui/ErrorFallback';
import { getBook } from '@/data/catalogue';
import { computeCartTotals } from '@/domain/pricing';
import { countNeedingAttention } from '@/domain/rentals';
import { useNow } from '@/hooks/use-time';
import { useCartStore } from '@/store/cart';
import { useShelfStore } from '@/store/shelf';
import { colors } from '@/theme/tokens';

/** Expo Router renders this when any screen throws. Never shows the error itself. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ErrorFallback onRetry={() => void retry()} />;
}

export default function RootLayout() {
  const lines = useCartStore((state) => state.lines);
  const rentals = useShelfStore((state) => state.rentals);
  const now = useNow();

  const cartCount = computeCartTotals(lines, getBook).itemCount;
  const attention = countNeedingAttention(rentals, now);

  const items: NavItem[] = [
    { href: '/', match: '/', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
    {
      href: '/browse',
      match: '/browse',
      label: 'Browse',
      icon: 'search-outline',
      activeIcon: 'search',
    },
    {
      href: '/recommendations',
      match: '/recommendations',
      label: 'For you',
      icon: 'sparkles-outline',
      activeIcon: 'sparkles',
    },
    {
      href: '/library',
      match: '/library',
      label: 'Library',
      icon: 'library-outline',
      activeIcon: 'library',
    },
    {
      href: '/profile',
      match: '/profile',
      label: 'Profile',
      icon: 'person-outline',
      activeIcon: 'person',
      badge: attention,
      badgeLabel: `${attention} ${attention === 1 ? 'rental needs' : 'rentals need'} attention`,
    },
    {
      href: '/cart',
      match: '/cart',
      label: 'Cart',
      icon: 'cart-outline',
      activeIcon: 'cart',
      badge: cartCount,
      badgeLabel: `${cartCount} ${cartCount === 1 ? 'item' : 'items'} in cart`,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Head>
        <title>BookNest — Buy, Rent and Discover Books</title>
        <meta
          name="description"
          content="Buy or rent physical books and get recommendations based on your profession and interests."
        />
      </Head>
      <StatusBar style="light" />
      <ResponsiveNav items={items} />
      <View style={{ flex: 1 }}>
        <Slot />
      </View>
      <ResponsiveBottomNav items={items} />
    </View>
  );
}
