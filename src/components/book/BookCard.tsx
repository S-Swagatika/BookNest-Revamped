import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getCategory } from '@/data/catalogue';
import { formatMoney, rentalPrice } from '@/domain/pricing';
import type { Book } from '@/domain/types';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from '../ui/AppText';
import { Badge, Rating } from '../ui/Chip';

import { BookCover } from './BookCover';

export function BookCard({ book, reason }: { book: Book; reason?: string }) {
  const outOfStock = book.stockBuy < 1 && !(book.rentable && book.stockRent > 0);
  const category = getCategory(book.categoryId);
  // `Link asChild` goes through Radix Slot: pass one flattened style object, not a function.
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <Link href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${book.title} by ${book.author}, ${formatMoney(book.buyPrice)}`}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.flatten([
          styles.card,
          hovered && styles.hovered,
          pressed && { opacity: 0.85 },
        ])}
      >
        <BookCover book={book} />
        <View style={styles.body}>
          <AppText variant="label" color="accentText" numberOfLines={1}>
            {(category?.name ?? '').toUpperCase()}
          </AppText>
          <AppText variant="subheading" bold numberOfLines={2}>
            {book.title}
          </AppText>
          <AppText variant="small" color="muted" numberOfLines={1}>
            {book.author}
          </AppText>
          <Rating value={book.rating} />
          <View style={styles.prices}>
            <AppText variant="body" bold>
              {formatMoney(book.buyPrice)}
            </AppText>
            {book.rentable && book.stockRent > 0 ? (
              <AppText variant="caption" color="muted">
                or rent from {formatMoney(rentalPrice(book, 7))}
              </AppText>
            ) : null}
          </View>
          {outOfStock ? <Badge label="Out of stock" tone="danger" /> : null}
          {reason ? (
            <AppText variant="caption" color="primary" bold numberOfLines={2}>
              {reason}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    height: '100%',
  },
  hovered: { borderColor: colors.accent },
  body: { gap: 4, flex: 1 },
  prices: { gap: 2, marginTop: 2 },
});
