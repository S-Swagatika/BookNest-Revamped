import Head from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BookGrid } from '@/components/book/BookGrid';
import { RentalCard } from '@/components/rentals/RentalCard';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Container, EmptyState, Screen } from '@/components/ui/Layout';
import { getBook } from '@/data/catalogue';
import { SHELVES, booksOnShelf, shelfCounts, type Shelf } from '@/domain/library';
import { useNow } from '@/hooks/use-time';
import { useShelfStore } from '@/store/shelf';
import { spacing } from '@/theme/tokens';
import { parseAllowed } from '@/utils/params';

const EMPTY: Record<Shelf, string> = {
  wantToRead: 'Save books you want to read later from any book page.',
  reading: 'Mark a book as Reading and it will show up here.',
  finished: 'Books you have finished will appear here.',
  owned: 'Books you buy are added here automatically.',
  rented: 'Books you are renting right now appear here.',
};

const SHELF_IDS = SHELVES.map((item) => item.id);

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ shelf?: string }>();
  const shelf = parseAllowed<Shelf>(params.shelf, SHELF_IDS, 'wantToRead');
  const library = useShelfStore((state) => state.library);
  const rentals = useShelfStore((state) => state.rentals);
  const returnRental = useShelfStore((state) => state.returnRental);
  const renewRental = useShelfStore((state) => state.renewRental);
  const now = useNow();

  const counts = useMemo(() => shelfCounts(library, rentals), [library, rentals]);
  const books = useMemo(
    () => booksOnShelf(shelf, library, rentals, getBook),
    [shelf, library, rentals],
  );
  const activeRentals = rentals.filter((rental) => !rental.returnedAt);

  return (
    <Screen>
      <Head>
        <title>My library — BookNest</title>
      </Head>
      <Container style={styles.page}>
        <AppText variant="display" accessibilityRole="header">
          My library
        </AppText>
        <View style={styles.tabs} accessibilityRole="tablist">
          {SHELVES.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              count={counts[item.id]}
              selected={item.id === shelf}
              onPress={() => router.setParams({ shelf: item.id })}
              accessibilityLabel={`${item.label}, ${counts[item.id]} books`}
            />
          ))}
        </View>

        {shelf === 'rented' && activeRentals.length > 0 ? (
          <View style={styles.list}>
            {activeRentals.map((rental) => (
              <RentalCard
                key={rental.id}
                rental={rental}
                now={now}
                onReturn={returnRental}
                onRenew={renewRental}
              />
            ))}
          </View>
        ) : (
          <BookGrid books={books} emptyTitle="Nothing here yet" emptyMessage={EMPTY[shelf]} />
        )}

        {books.length === 0 && shelf !== 'rented' ? (
          <View style={styles.cta}>
            <Button label="Browse books" href="/browse" />
          </View>
        ) : null}
        {shelf === 'rented' && activeRentals.length === 0 ? (
          <EmptyState title="No active rentals" message={EMPTY.rented}>
            <Button
              label="Find a book to rent"
              href={{ pathname: '/browse', params: { availability: 'rentable' } }}
            />
          </EmptyState>
        ) : null}
      </Container>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: spacing.xxl, gap: spacing.xl },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  list: { gap: spacing.lg },
  cta: { alignItems: 'center' },
});
