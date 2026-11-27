import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { getBook, getWaitlistCount } from '@/data/catalogue';
import { formatMoney, formatShortDate, LATE_FEE, rentalStatus } from '@/domain/pricing';
import { checkRenewal, dueLabel, renewalCount, renewalPrice } from '@/domain/rentals';
import { RENTAL_TERMS, type Rental, type RentalStatus, type RentalTerm } from '@/domain/types';
import { useHydrated } from '@/hooks/use-time';
import { useTransientMessage } from '@/hooks/use-transient-message';
import type { RenewResult } from '@/store/shelf';
import { colors, radius, spacing } from '@/theme/tokens';

import { BookCover } from '../book/BookCover';
import { AppText } from '../ui/AppText';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Chip';

const STATUS_BADGE: Record<
  RentalStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  active: { label: 'Active', tone: 'success' },
  dueSoon: { label: 'Due soon', tone: 'warning' },
  overdue: { label: 'Expired', tone: 'danger' },
  returned: { label: 'Returned', tone: 'neutral' },
};

function renewalSummary(rental: Rental): string | null {
  const count = renewalCount(rental);
  if (count === 0) return null;
  const days = (rental.renewals ?? []).reduce((sum, renewal) => sum + renewal.termDays, 0);
  return `Renewed ${count === 1 ? 'once' : `${count} times`} (+${days} days)`;
}

export function RentalCard({
  rental,
  now,
  onReturn,
  onRenew,
}: {
  rental: Rental;
  now: Date;
  onReturn?: (rentalId: string) => void;
  /** When provided, eligible rentals show renewal buttons. */
  onRenew?: (rentalId: string, term: RentalTerm) => RenewResult;
}) {
  const hydrated = useHydrated();
  const { message: notice, notify } = useTransientMessage(5000);

  const book = getBook(rental.bookId);
  if (!book) return null;
  const status = rentalStatus(rental, now);
  const badge = STATUS_BADGE[status];
  const summary = renewalSummary(rental);
  const renewal = checkRenewal(rental, book, getWaitlistCount(book.id), now);
  const showRenewal = !!onRenew && status !== 'returned';

  function renew(term: RentalTerm) {
    if (!onRenew) return;
    const result = onRenew(rental.id, term);
    if (result.ok) notify(`Renewed. New due date ${formatShortDate(result.rental.dueAt)}.`, 'ok');
    else notify(result.reason, 'error');
  }

  return (
    <View style={styles.card}>
      <View style={styles.cover}>
        <BookCover book={book} size="sm" />
      </View>
      <View style={styles.body}>
        <Badge label={badge.label} tone={badge.tone} />
        <Link href={{ pathname: '/book/[id]', params: { id: book.id } }} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={`Open ${book.title}`}>
            <AppText variant="subheading" bold numberOfLines={2}>
              {book.title}
            </AppText>
          </Pressable>
        </Link>
        <AppText variant="small" color="muted">
          {rental.termDays} day rental · {formatMoney(rental.price)}
        </AppText>
        <AppText variant="small" bold color={status === 'overdue' ? 'danger' : 'ink'}>
          {hydrated ? dueLabel(rental, now) : ' '}
          {status === 'returned' ? '' : ` · due ${formatShortDate(rental.dueAt)}`}
        </AppText>
        {summary ? (
          <AppText variant="caption" color="muted">
            {summary}
          </AppText>
        ) : null}
        {status === 'overdue' ? (
          <AppText variant="caption" color="muted">
            This rental has expired. Please return the book. A flat late fee of{' '}
            {formatMoney(LATE_FEE)} applies. It is shown for information only and is not charged in
            this version.
          </AppText>
        ) : null}

        {showRenewal && renewal.ok ? (
          <View style={styles.actions}>
            {RENTAL_TERMS.map((term) => (
              <Button
                key={term}
                label={`Renew ${term} days · ${formatMoney(renewalPrice(book, term))}`}
                variant="accent"
                icon="refresh-outline"
                onPress={() => renew(term)}
                accessibilityLabel={`Renew ${book.title} for ${term} days, ${formatMoney(renewalPrice(book, term))}`}
              />
            ))}
          </View>
        ) : null}
        {showRenewal && !renewal.ok && status !== 'overdue' ? (
          <AppText variant="caption" color="muted">
            {renewal.message}
          </AppText>
        ) : null}

        <View accessibilityLiveRegion="polite">
          {notice ? (
            <AppText variant="small" bold color={notice.tone === 'ok' ? 'success' : 'danger'}>
              {notice.text}
            </AppText>
          ) : null}
        </View>

        {status !== 'returned' && onReturn ? (
          <Button
            label="Mark as returned"
            variant="secondary"
            icon="return-down-back-outline"
            onPress={() => onReturn(rental.id)}
            accessibilityLabel={`Mark ${book.title} as returned`}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cover: { width: 84 },
  body: { flex: 1, gap: 6, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
