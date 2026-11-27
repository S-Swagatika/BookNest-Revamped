import Head from 'expo-router/head';
import { Link, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BookCover } from '@/components/book/BookCover';
import { BookGrid } from '@/components/book/BookGrid';
import { PurchaseOptions } from '@/components/book/PurchaseOptions';
import { ShelfPicker } from '@/components/book/ShelfPicker';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Badge, Rating } from '@/components/ui/Chip';
import { Container, EmptyState, Screen, Section } from '@/components/ui/Layout';
import { getBook, getBooks, getCategory, getRelatedBooks } from '@/data/catalogue';
import { useBreakpoint } from '@/theme/breakpoints';
import { colors, spacing } from '@/theme/tokens';

/** Pre-render every book page for the static web export. */
export function generateStaticParams(): { id: string }[] {
  return getBooks().map((book) => ({ id: book.id }));
}

export default function BookDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const book = getBook(id);
  const { isCompact, isExpanded } = useBreakpoint();

  if (!book) {
    return (
      <Screen>
        <Container style={styles.notFound}>
          <EmptyState
            title="Book not found"
            message="This book may have been removed from the catalogue."
          >
            <Button label="Browse books" href="/browse" />
          </EmptyState>
        </Container>
      </Screen>
    );
  }

  const category = getCategory(book.categoryId);
  const related = getRelatedBooks(book);

  return (
    <Screen>
      <Head>
        <title>{`${book.title} by ${book.author} — BookNest`}</title>
        <meta name="description" content={book.description.slice(0, 155)} />
      </Head>
      <Container style={styles.top}>
        <Link href="/browse" accessibilityRole="link">
          <AppText variant="small" bold color="primary">
            ← Back to browse
          </AppText>
        </Link>

        <View style={[styles.layout, !isCompact && styles.layoutRow]}>
          <View style={[styles.coverCol, !isCompact && { width: isExpanded ? 320 : 240 }]}>
            <BookCover book={book} size="lg" />
          </View>

          <View style={styles.info}>
            {category ? (
              <Link
                href={{ pathname: '/browse', params: { category: category.id } }}
                accessibilityRole="link"
              >
                <AppText variant="label" color="accentText">
                  {category.name.toUpperCase()}
                </AppText>
              </Link>
            ) : null}
            <AppText variant="display" accessibilityRole="header">
              {book.title}
            </AppText>
            <AppText variant="subheading" color="muted">
              by {book.author}
            </AppText>
            <Rating value={book.rating} count={book.reviewCount} />
            <View style={styles.meta}>
              <Badge label={`${book.pages} pages`} />
              <Badge label={`${book.year}`} />
              {book.bestseller ? <Badge label="Bestseller" tone="accent" /> : null}
              {book.newArrival ? <Badge label="New" tone="success" /> : null}
            </View>
            <AppText variant="body" style={styles.description}>
              {book.description}
            </AppText>
            <ShelfPicker bookId={book.id} />
          </View>

          <View style={[styles.buy, !isCompact && { width: isExpanded ? 360 : 300 }]}>
            <PurchaseOptions book={book} />
          </View>
        </View>
      </Container>

      {related.length > 0 ? (
        <Section title="More in this category">
          <BookGrid books={related} />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingTop: spacing.xl, gap: spacing.xl },
  notFound: { paddingTop: spacing.xxxl },
  layout: { gap: spacing.xxl },
  layoutRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap' },
  coverCol: { width: '60%', maxWidth: 320, alignSelf: 'center' },
  info: { flex: 1, minWidth: 280, gap: spacing.md },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  description: { color: colors.ink, maxWidth: 640 },
  buy: { width: '100%' },
});
