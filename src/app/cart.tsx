import Head from 'expo-router/head';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book/BookCover';
import { RentalTermPicker } from '@/components/book/RentalTermPicker';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Chip';
import { Card, Container, EmptyState, Screen } from '@/components/ui/Layout';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { getBook } from '@/data/catalogue';
import {
  FREE_SHIPPING_OVER,
  LATE_FEE,
  computeCartTotals,
  formatMoney,
  lineUnitPrice,
  maxBuyQuantity,
} from '@/domain/pricing';
import type { CartLine } from '@/domain/types';
import { useCartStore } from '@/store/cart';
import { useShelfStore } from '@/store/shelf';
import { useBreakpoint } from '@/theme/breakpoints';
import { colors, spacing } from '@/theme/tokens';

function CartLineRow({ line }: { line: CartLine }) {
  const book = getBook(line.bookId);
  const setQuantity = useCartStore((state) => state.setQuantity);
  const setTerm = useCartStore((state) => state.setTerm);
  const remove = useCartStore((state) => state.remove);
  if (!book) return null;

  const unit = lineUnitPrice(book, line);
  return (
    <Card style={styles.line}>
      <View style={styles.lineCover}>
        <BookCover book={book} size="sm" />
      </View>
      <View style={styles.lineBody}>
        <View style={styles.lineHead}>
          <View style={{ flex: 1, gap: 2 }}>
            <Badge
              label={line.mode === 'buy' ? 'Buy' : `Rent · ${line.termDays} days`}
              tone={line.mode === 'buy' ? 'neutral' : 'accent'}
            />
            <Link
              href={{ pathname: '/book/[id]', params: { id: book.id } }}
              accessibilityRole="link"
            >
              <AppText variant="subheading" bold numberOfLines={2}>
                {book.title}
              </AppText>
            </Link>
            <AppText variant="small" color="muted">
              {book.author}
            </AppText>
          </View>
          <AppText variant="body" bold>
            {formatMoney(unit * line.quantity)}
          </AppText>
        </View>

        {line.mode === 'buy' ? (
          <QuantityStepper
            label={book.title}
            value={line.quantity}
            max={maxBuyQuantity(book)}
            onChange={(next) => setQuantity(line.id, next)}
          />
        ) : (
          <RentalTermPicker
            book={book}
            value={line.termDays ?? 7}
            onChange={(term) => setTerm(line.id, term)}
          />
        )}

        <Button
          label="Remove"
          variant="ghost"
          icon="trash-outline"
          onPress={() => remove(line.id)}
          accessibilityLabel={`Remove ${book.title} from cart`}
          style={styles.remove}
        />
      </View>
    </Card>
  );
}

export default function CartScreen() {
  const lines = useCartStore((state) => state.lines);
  const placeOrder = useShelfStore((state) => state.placeOrder);
  const removeLine = useCartStore((state) => state.remove);
  const { isExpanded } = useBreakpoint();
  const [errors, setErrors] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<{ id: string; total: number } | null>(null);

  const visible = lines.filter((line) => getBook(line.bookId));
  // Lines for books that left the catalogue are hidden above but would still fail checkout,
  // so tell the reader and let them clear those lines.
  const staleLines = lines.filter((line) => !getBook(line.bookId));
  const totals = computeCartTotals(visible, getBook);
  const toFree = Math.max(0, FREE_SHIPPING_OVER - totals.subtotal);
  const hasRentals = visible.some((line) => line.mode === 'rent');

  function checkout() {
    const result = placeOrder();
    if (result.ok) {
      setErrors([]);
      setConfirmed({ id: result.order.id, total: result.order.total });
    } else {
      setErrors(result.errors);
    }
  }

  if (confirmed) {
    return (
      <Screen>
        <Container style={styles.page}>
          <EmptyState
            title="Order placed"
            message={`Thank you. Your demo order total was ${formatMoney(confirmed.total)}. No payment was taken. Books and rentals are now in your library.`}
          >
            <View style={styles.row}>
              <Button label="View my rentals" href="/rentals" />
              <Button label="Keep browsing" variant="secondary" href="/browse" />
            </View>
          </EmptyState>
        </Container>
      </Screen>
    );
  }

  return (
    <Screen>
      <Head>
        <title>Your cart — BookNest</title>
      </Head>
      <Container style={styles.page}>
        <AppText variant="display" accessibilityRole="header">
          Your cart
        </AppText>

        {staleLines.length > 0 ? (
          <View accessibilityRole="alert" style={styles.errors}>
            <AppText variant="small" color="danger">
              {staleLines.length === 1
                ? 'One item in your cart is no longer available.'
                : `${staleLines.length} items in your cart are no longer available.`}
            </AppText>
            <Button
              label="Remove unavailable items"
              variant="secondary"
              onPress={() => staleLines.forEach((line) => removeLine(line.id))}
            />
          </View>
        ) : null}

        {visible.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            message="Add a book to buy it, or rent it for 7 or 30 days."
          >
            <Button label="Browse books" href="/browse" />
          </EmptyState>
        ) : (
          <View style={[styles.layout, isExpanded && styles.layoutRow]}>
            <View style={styles.lines}>
              {visible.map((line) => (
                <CartLineRow key={line.id} line={line} />
              ))}
            </View>

            <Card style={[styles.summary, isExpanded && styles.summaryWide]}>
              <AppText variant="heading">Order summary</AppText>
              <View style={styles.sumRow}>
                <AppText variant="body" color="muted">
                  Subtotal ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'})
                </AppText>
                <AppText variant="body">{formatMoney(totals.subtotal)}</AppText>
              </View>
              <View style={styles.sumRow}>
                <AppText variant="body" color="muted">
                  Shipping
                </AppText>
                <AppText variant="body">
                  {totals.shipping === 0 ? 'Free' : formatMoney(totals.shipping)}
                </AppText>
              </View>
              {toFree > 0 ? (
                <AppText variant="caption" color="muted">
                  Add {formatMoney(toFree)} more for free shipping.
                </AppText>
              ) : null}
              <View style={[styles.sumRow, styles.total]}>
                <AppText variant="heading">Total</AppText>
                <AppText variant="heading">{formatMoney(totals.total)}</AppText>
              </View>
              {hasRentals ? (
                <AppText variant="caption" color="muted">
                  Rentals are due back after the chosen term. A flat {formatMoney(LATE_FEE)} late
                  fee is shown if you are overdue, but is not charged in this version.
                </AppText>
              ) : null}
              {errors.length > 0 ? (
                <View accessibilityRole="alert" style={styles.errors}>
                  {errors.map((error) => (
                    <AppText key={error} variant="small" color="danger">
                      {error}
                    </AppText>
                  ))}
                </View>
              ) : null}
              <Button
                label="Place demo order"
                icon="lock-closed-outline"
                onPress={checkout}
                fullWidth
              />
              <AppText variant="caption" color="muted" align="center">
                Demo checkout. No payment details are collected.
              </AppText>
            </Card>
          </View>
        )}
      </Container>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.xxl, gap: spacing.xl },
  layout: { gap: spacing.xl },
  layoutRow: { flexDirection: 'row', alignItems: 'flex-start' },
  lines: { flex: 1, gap: spacing.lg, width: '100%' },
  line: { flexDirection: 'row', gap: spacing.lg },
  lineCover: { width: 72 },
  lineBody: { flex: 1, gap: spacing.md },
  lineHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  remove: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  summary: { gap: spacing.md, width: '100%' },
  summaryWide: { width: 360 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  total: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  errors: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.dangerSoft,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'center' },
});
