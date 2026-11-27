import Head from 'expo-router/head';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { BookGrid } from '@/components/book/BookGrid';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Container, Screen } from '@/components/ui/Layout';
import { getBooks, getCategories, getCategory } from '@/data/catalogue';
import {
  DEFAULT_FILTERS,
  MAX_QUERY_LENGTH,
  filterBooks,
  type Availability,
  type SortKey,
} from '@/domain/search';
import { useBreakpoint } from '@/theme/breakpoints';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';
import { firstParam, parseAllowed } from '@/utils/params';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'rating', label: 'Top rated' },
  { id: 'newest', label: 'Newest' },
  { id: 'priceAsc', label: 'Price: low to high' },
  { id: 'priceDesc', label: 'Price: high to low' },
];

const AVAILABILITY: { id: Availability; label: string }[] = [
  { id: 'all', label: 'All books' },
  { id: 'buyable', label: 'Available to buy' },
  { id: 'rentable', label: 'Available to rent' },
];

const SORT_IDS = SORTS.map((sort) => sort.id);
const AVAILABILITY_IDS = AVAILABILITY.map((item) => item.id);
const categoryNameOf = (id: string) => getCategory(id)?.name;

export default function BrowseScreen() {
  const params = useLocalSearchParams<{
    q?: string;
    category?: string;
    availability?: string;
    sort?: string;
  }>();
  const { isExpanded } = useBreakpoint();
  const categories = getCategories();

  const categoryParam = firstParam(params.category);
  const categoryId = categories.some((c) => c.id === categoryParam)
    ? (categoryParam as string)
    : null;
  const availability = parseAllowed(
    params.availability,
    AVAILABILITY_IDS,
    DEFAULT_FILTERS.availability,
  );
  const sort = parseAllowed(params.sort, SORT_IDS, DEFAULT_FILTERS.sort);
  const urlQuery = (firstParam(params.q) ?? '').slice(0, MAX_QUERY_LENGTH);

  const [text, setText] = useState(urlQuery);
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery);

  // Follow the address bar: back/forward and links such as "/browse?q=art" change the URL while
  // this screen stays mounted. State is adjusted during render (not in an effect) so there is no
  // extra paint. While the reader types the URL is unchanged, so this does not fight their typing.
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery);
    setText(urlQuery);
  }

  function update(next: Record<string, string | undefined>) {
    router.setParams({
      q: text || undefined,
      category: categoryId ?? undefined,
      availability: availability === 'all' ? undefined : availability,
      sort: sort === 'featured' ? undefined : sort,
      ...next,
    });
  }

  const results = useMemo(
    () => filterBooks(getBooks(), { query: text, categoryId, availability, sort }, categoryNameOf),
    [text, categoryId, availability, sort],
  );

  const filtersActive = !!text || !!categoryId || availability !== 'all' || sort !== 'featured';
  const activeCategory = categories.find((c) => c.id === categoryId);

  const filters = (
    <View style={styles.filters}>
      <View style={styles.group}>
        <AppText variant="label" color="muted">
          CATEGORY
        </AppText>
        <View style={styles.chips}>
          <Chip
            label="All"
            selected={!categoryId}
            onPress={() => update({ category: undefined })}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              selected={category.id === categoryId}
              onPress={() => update({ category: category.id })}
            />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <AppText variant="label" color="muted">
          AVAILABILITY
        </AppText>
        <View style={styles.chips}>
          {AVAILABILITY.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={item.id === availability}
              onPress={() => update({ availability: item.id === 'all' ? undefined : item.id })}
            />
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <AppText variant="label" color="muted">
          SORT BY
        </AppText>
        <View style={styles.chips}>
          {SORTS.map((item) => (
            <Chip
              key={item.id}
              label={item.label}
              selected={item.id === sort}
              onPress={() => update({ sort: item.id === 'featured' ? undefined : item.id })}
            />
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <Screen>
      <Head>
        <title>{activeCategory ? `${activeCategory.name} books` : 'Browse books'} — BookNest</title>
      </Head>
      <Container style={styles.top}>
        <AppText variant="display" accessibilityRole="header">
          {activeCategory ? activeCategory.name : 'Browse books'}
        </AppText>
        {activeCategory ? (
          <AppText variant="body" color="muted">
            {activeCategory.blurb}
          </AppText>
        ) : null}

        <View style={styles.search}>
          <Ionicons name="search" size={20} color={colors.muted} />
          <TextInput
            value={text}
            onChangeText={(value) => setText(value.slice(0, MAX_QUERY_LENGTH))}
            onEndEditing={() => update({ q: text || undefined })}
            onSubmitEditing={() => update({ q: text || undefined })}
            placeholder="Search by title, author, category or topic"
            placeholderTextColor={colors.muted}
            accessibilityLabel="Search books"
            returnKeyType="search"
            maxLength={MAX_QUERY_LENGTH}
            autoCorrect={false}
            style={styles.input}
          />
          {text ? (
            <Button
              label="Clear"
              variant="ghost"
              onPress={() => {
                setText('');
                update({ q: undefined });
              }}
              accessibilityLabel="Clear search"
            />
          ) : null}
        </View>

        <View style={[styles.layout, isExpanded && styles.layoutRow]}>
          <View style={isExpanded ? styles.sidebar : undefined}>{filters}</View>
          <View style={styles.results}>
            <View style={styles.resultsHeader}>
              <AppText variant="small" color="muted" accessibilityLiveRegion="polite">
                {results.length} {results.length === 1 ? 'book' : 'books'}
              </AppText>
              {filtersActive ? (
                <Button
                  label="Reset filters"
                  variant="ghost"
                  onPress={() => {
                    setText('');
                    router.setParams({
                      q: undefined,
                      category: undefined,
                      availability: undefined,
                      sort: undefined,
                    });
                  }}
                />
              ) : null}
            </View>
            <BookGrid books={results} hasSidebar={isExpanded} />
          </View>
        </View>
      </Container>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.xxl, gap: spacing.lg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: TOUCH_TARGET + 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: { flex: 1, minHeight: TOUCH_TARGET, fontSize: 16, color: colors.ink },
  layout: { gap: spacing.xl, marginTop: spacing.md },
  layoutRow: { flexDirection: 'row', alignItems: 'flex-start' },
  sidebar: { width: 280 },
  filters: { gap: spacing.lg },
  group: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  results: { flex: 1, width: '100%', gap: spacing.md },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
