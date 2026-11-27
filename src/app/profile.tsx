import Head from 'expo-router/head';
import { useMemo } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { RecommendationGrid } from '@/components/book/RecommendationGrid';
import { PreferencesEditor } from '@/components/profile/PreferencesEditor';
import { RentalCard } from '@/components/rentals/RentalCard';
import { RentalReminders } from '@/components/rentals/RentalReminders';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card, Container, EmptyState, Grid, Screen, Section } from '@/components/ui/Layout';
import { getProfessions } from '@/data/catalogue';
import { shelfCounts } from '@/domain/library';
import { formatMoney } from '@/domain/pricing';
import { countNeedingAttention } from '@/domain/rentals';
import { useRecommendations } from '@/hooks/use-recommendations';
import { useNow } from '@/hooks/use-time';
import { MAX_NAME_LENGTH, useProfileStore } from '@/store/profile';
import { useShelfStore } from '@/store/shelf';
import { useBreakpoint } from '@/theme/breakpoints';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card style={styles.stat}>
      <AppText variant="label" color="muted">
        {label.toUpperCase()}
      </AppText>
      <AppText variant="title">{value}</AppText>
      {hint ? (
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
}

export default function ProfileScreen() {
  const { isCompact } = useBreakpoint();
  const name = useProfileStore((state) => state.name);
  const setName = useProfileStore((state) => state.setName);
  const professionId = useProfileStore((state) => state.professionId);
  const library = useShelfStore((state) => state.library);
  const rentals = useShelfStore((state) => state.rentals);
  const orders = useShelfStore((state) => state.orders);
  const returnRental = useShelfStore((state) => state.returnRental);
  const renewRental = useShelfStore((state) => state.renewRental);
  const now = useNow();

  const counts = useMemo(() => shelfCounts(library, rentals), [library, rentals]);
  const active = rentals.filter((rental) => !rental.returnedAt);
  const needAttention = countNeedingAttention(active, now);
  const sortedActive = [...active].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const history = rentals.filter((rental) => rental.returnedAt);
  const spent = orders.reduce((sum, order) => sum + order.total, 0);

  const recommendations = useRecommendations(4);

  const profession = getProfessions().find((p) => p.id === professionId);

  return (
    <Screen>
      <Head>
        <title>Profile and reading dashboard — BookNest</title>
      </Head>
      <Container style={styles.page}>
        <View style={styles.header}>
          <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no">
            <AppText variant="title" style={{ color: colors.primaryText }}>
              {(name.trim()[0] ?? 'R').toUpperCase()}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="label" color="muted">
              YOUR NAME
            </AppText>
            <TextInput
              value={name}
              onChangeText={setName}
              maxLength={MAX_NAME_LENGTH}
              accessibilityLabel="Your name"
              style={styles.nameInput}
            />
            <AppText variant="small" color="muted">
              {profession ? profession.label : 'No profession chosen yet'}
            </AppText>
          </View>
        </View>

        <AppText variant="title" accessibilityRole="header">
          Reading dashboard
        </AppText>
        <Grid columns={isCompact ? 2 : 4} gap={spacing.md}>
          <Stat label="Reading now" value={String(counts.reading)} />
          <Stat label="Finished" value={String(counts.finished)} />
          <Stat
            label="Active rentals"
            value={String(active.length)}
            hint={needAttention > 0 ? `${needAttention} need attention` : 'All on track'}
          />
          <Stat label="Total spent" value={formatMoney(spent)} hint={`${orders.length} orders`} />
        </Grid>
      </Container>

      <RentalReminders />

      <Section
        title="Active rentals"
        subtitle="Return books by their due date to avoid a late fee."
        actionLabel="All rentals"
        actionHref="/rentals"
      >
        {sortedActive.length === 0 ? (
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
            {sortedActive.map((rental) => (
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

      <Section
        title={recommendations.personalised ? 'Recommended for you' : 'Popular with readers'}
        subtitle={
          recommendations.personalised
            ? 'Based on your profession, interests, goals and library.'
            : 'Choose your profession, interests and goals below to personalise this list.'
        }
        actionLabel="See why"
        actionHref="/recommendations"
      >
        <RecommendationGrid items={recommendations.items} />
      </Section>

      <Section title="Personalise your picks">
        <PreferencesEditor />
      </Section>

      {history.length > 0 ? (
        <Section title="Rental history" actionLabel="All rentals" actionHref="/rentals">
          <View style={styles.list}>
            {history.map((rental) => (
              <RentalCard key={rental.id} rental={rental} now={now} />
            ))}
          </View>
        </Section>
      ) : null}

      {orders.length > 0 ? (
        <Section title="Order history">
          <View style={styles.list}>
            {orders.map((order) => (
              <Card key={order.id} style={styles.order}>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="small" bold>
                    {new Date(order.createdAt).toLocaleDateString('en-US')}
                  </AppText>
                  <AppText variant="small" color="muted" numberOfLines={2}>
                    {order.lines
                      .map((line) =>
                        line.mode === 'rent'
                          ? `${line.title} (${line.termDays} day rental)`
                          : `${line.title} × ${line.quantity}`,
                      )
                      .join(', ')}
                  </AppText>
                </View>
                <AppText variant="body" bold>
                  {formatMoney(order.total)}
                </AppText>
              </Card>
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.xxl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    minHeight: TOUCH_TARGET,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stat: { gap: 4, height: '100%' },
  list: { gap: spacing.lg },
  order: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
});
