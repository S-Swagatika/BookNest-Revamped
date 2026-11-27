import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  FREE_SHIPPING_OVER,
  LATE_FEE,
  MAX_CONCURRENT_RENTALS,
  formatMoney,
  maxBuyQuantity,
} from '@/domain/pricing';
import type { Book, RentalTerm } from '@/domain/types';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useCartStore } from '@/store/cart';
import { useShelfStore } from '@/store/shelf';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Badge, Chip } from '../ui/Chip';

import { RentalTermPicker } from './RentalTermPicker';

type Mode = 'buy' | 'rent';

export function PurchaseOptions({ book }: { book: Book }) {
  const canBuy = maxBuyQuantity(book) > 0;
  const canRent = book.rentable && book.stockRent > 0;
  const [mode, setMode] = useState<Mode>(canBuy ? 'buy' : 'rent');
  const [term, setTerm] = useState<RentalTerm>(7);
  const { message, notify } = useTransientMessage(4000);

  const addBuy = useCartStore((state) => state.addBuy);
  const addRent = useCartStore((state) => state.addRent);
  const rentals = useShelfStore((state) => state.rentals);

  const activeRentals = rentals.filter((rental) => !rental.returnedAt);
  const alreadyRenting = activeRentals.some((rental) => rental.bookId === book.id);
  const atRentalLimit = activeRentals.length >= MAX_CONCURRENT_RENTALS;

  function submit() {
    const result = mode === 'buy' ? addBuy(book.id) : addRent(book.id, term);
    if (result.ok) {
      notify(
        mode === 'buy' ? 'Added to your cart.' : `Added a ${term} day rental to your cart.`,
        'ok',
      );
    } else {
      notify(result.reason, 'error');
    }
  }

  if (!canBuy && !canRent) {
    return (
      <View style={styles.panel}>
        <Badge label="Currently unavailable" tone="danger" />
        <AppText variant="body" color="muted">
          This title is out of stock. Check back soon.
        </AppText>
      </View>
    );
  }

  const rentBlocked = alreadyRenting || atRentalLimit;

  return (
    <View style={styles.panel}>
      <View style={styles.modes}>
        <Chip label="Buy" selected={mode === 'buy'} onPress={() => setMode('buy')} />
        {book.rentable ? (
          <Chip label="Rent" selected={mode === 'rent'} onPress={() => setMode('rent')} />
        ) : null}
      </View>

      {mode === 'buy' ? (
        <View style={styles.block}>
          <AppText variant="display" style={styles.price}>
            {formatMoney(book.buyPrice)}
          </AppText>
          <AppText variant="small" color="muted">
            Physical copy. Free shipping on orders over {formatMoney(FREE_SHIPPING_OVER)}.
          </AppText>
          {canBuy ? (
            book.stockBuy <= 5 ? (
              <Badge label={`Only ${book.stockBuy} left`} tone="warning" />
            ) : null
          ) : (
            <Badge label="Out of stock" tone="danger" />
          )}
          <Button
            label="Add to cart"
            icon="cart-outline"
            onPress={submit}
            disabled={!canBuy}
            fullWidth
          />
        </View>
      ) : (
        <View style={styles.block}>
          {canRent ? (
            <>
              <RentalTermPicker book={book} value={term} onChange={setTerm} />
              <AppText variant="small" color="muted">
                Physical copy, delivered to you. Return by the due date to avoid a{' '}
                {formatMoney(LATE_FEE)} late fee. You can renew once for 7 or 30 more days if nobody
                else is waiting for the book.
              </AppText>
              {alreadyRenting ? (
                <Badge label="You are already renting this book" tone="accent" />
              ) : null}
              {atRentalLimit && !alreadyRenting ? (
                <Badge
                  label={`Limit of ${MAX_CONCURRENT_RENTALS} active rentals reached`}
                  tone="warning"
                />
              ) : null}
              <Button
                label={`Rent for ${term} days`}
                icon="time-outline"
                onPress={submit}
                disabled={rentBlocked}
                fullWidth
              />
            </>
          ) : (
            <>
              <Badge label="Not available to rent" tone="danger" />
              <AppText variant="body" color="muted">
                This title can only be bought right now.
              </AppText>
            </>
          )}
        </View>
      )}

      <View accessibilityLiveRegion="polite" style={styles.live}>
        {message ? (
          <AppText variant="small" bold color={message.tone === 'ok' ? 'success' : 'danger'}>
            {message.text}
          </AppText>
        ) : null}
      </View>
      {message?.tone === 'ok' ? (
        <Button label="View cart" variant="secondary" href="/cart" fullWidth />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modes: { flexDirection: 'row', gap: spacing.sm },
  block: { gap: spacing.md },
  price: { fontSize: 36, lineHeight: 42 },
  live: { minHeight: 20 },
});
