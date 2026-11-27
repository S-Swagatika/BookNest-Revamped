import Head from 'expo-router/head';
import { StyleSheet, View } from 'react-native';

import { RentalCard } from '@/components/rentals/RentalCard';
import { RentalReminders } from '@/components/rentals/RentalReminders';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, Container, EmptyState, Screen, Section } from '@/components/ui/Layout';
import {
  DUE_SOON_DAYS,
  LATE_FEE,
  MAX_CONCURRENT_RENTALS,
  MAX_RENEWALS,
  RENTAL_RATES,
  formatMoney,
} from '@/domain/pricing';
import { groupRentals, totalRenewalFees } from '@/domain/rentals';
import { RENTAL_TERMS } from '@/domain/types';
import { useNow } from '@/hooks/use-time';
import { useShelfStore } from '@/store/shelf';
import { spacing } from '@/theme/tokens';

function Rules() {
  return (
    <Container style={styles.flush}>
      <Card style={styles.rules}>
        <AppText variant="small" bold>
          Pricing
        </AppText>
        {RENTAL_TERMS.map((term) => (
          <AppText key={term} variant="small" color="muted">
            {term} days: {Math.round(RENTAL_RATES[term] * 100)}% of the book’s price.
          </AppText>
        ))}
        <AppText variant="small" bold>
          Due dates and renewals
        </AppText>
        <AppText variant="small" color="muted">
          The due date is the day you rent plus 7 or 30 days. You are reminded in the app{' '}
          {DUE_SOON_DAYS} days before it is due. You can renew{' '}
          {MAX_RENEWALS === 1 ? 'once' : `up to ${MAX_RENEWALS} times`} for 7 or 30 more days at the
          same price, as long as the rental has not expired and no one else is waiting for the book.
          Time is added to your current due date.
        </AppText>
        <AppText variant="small" bold>
          Limits
        </AppText>
        <AppText variant="small" color="muted">
          Up to {MAX_CONCURRENT_RENTALS} books at a time, one copy of each title. An expired rental
          must be returned before you can rent that book again. A flat {formatMoney(LATE_FEE)} late
          fee is shown for expired rentals but is not charged in this version.
        </AppText>
      </Card>
    </Container>
  );
}

export default function RentalsScreen() {
  const rentals = useShelfStore((state) => state.rentals);
  const returnRental = useShelfStore((state) => state.returnRental);
  const renewRental = useShelfStore((state) => state.renewRental);
  const now = useNow();

  const { active, expired, history } = groupRentals(rentals, now);
  const renewalFees = totalRenewalFees(rentals);

  return (
    <Screen>
      <Head>
        <title>My rentals — BookNest</title>
      </Head>
      <Container style={styles.page}>
        <AppText variant="display" accessibilityRole="header">
          My rentals
        </AppText>
        <AppText variant="body" color="muted">
          {active.length} active · {expired.length} expired · {history.length} returned
          {renewalFees > 0 ? ` · ${formatMoney(renewalFees)} spent on renewals` : ''}
        </AppText>
      </Container>

      <RentalReminders showLink={false} />

      {expired.length > 0 ? (
        <Section
          title="Expired rentals"
          subtitle="These are past their due date. Return them as soon as you can."
        >
          <View style={styles.list}>
            {expired.map((rental) => (
              <RentalCard
                key={rental.id}
                rental={rental}
                now={now}
                onReturn={returnRental}
                onRenew={renewRental}
              />
            ))}
          </View>
        </Section>
      ) : null}

      <Section title="Active rentals" subtitle="Soonest due date first.">
        {active.length === 0 ? (
          <EmptyState
            title="No active rentals"
            message="Rent any book for 7 or 30 days and track its due date here."
          >
            <Button
              label="Find a book to rent"
              href={{ pathname: '/browse', params: { availability: 'rentable' } }}
            />
          </EmptyState>
        ) : (
          <View style={styles.list}>
            {active.map((rental) => (
              <RentalCard
                key={rental.id}
                rental={rental}
                now={now}
                onReturn={returnRental}
                onRenew={renewRental}
              />
            ))}
          </View>
        )}
      </Section>

      <Section title="Rental history" subtitle="Books you have returned, newest first.">
        {history.length === 0 ? (
          <AppText variant="body" color="muted">
            Returned rentals will appear here.
          </AppText>
        ) : (
          <View style={styles.list}>
            {history.map((rental) => (
              <RentalCard key={rental.id} rental={rental} now={now} />
            ))}
          </View>
        )}
      </Section>

      <Section title="How rentals work">
        <Rules />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.xxl, gap: spacing.sm },
  flush: { paddingHorizontal: 0 },
  list: { gap: spacing.lg },
  rules: { gap: spacing.sm },
});
