import { StyleSheet, View } from 'react-native';

import type { Book } from '@/domain/types';
import { fonts } from '@/theme/tokens';

import { AppText } from '../ui/AppText';

/** Generated cover art, so the catalogue needs no external images. */
export function BookCover({
  book,
  size = 'md',
}: {
  book: Pick<Book, 'title' | 'author' | 'coverColor' | 'coverAccent'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const pad = size === 'sm' ? 8 : size === 'md' ? 12 : 20;
  const titleSize = size === 'sm' ? 11 : size === 'md' ? 15 : 24;
  const authorSize = size === 'sm' ? 8 : size === 'md' ? 10 : 13;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Cover of ${book.title} by ${book.author}`}
      style={[styles.cover, { backgroundColor: book.coverColor, padding: pad }]}
    >
      <View style={[styles.spine, { backgroundColor: book.coverAccent }]} />
      <View style={[styles.rule, { backgroundColor: book.coverAccent }]} />
      <AppText
        numberOfLines={4}
        style={{
          color: book.coverAccent,
          fontFamily: fonts?.serif,
          fontWeight: '700',
          fontSize: titleSize,
          lineHeight: titleSize * 1.15,
        }}
      >
        {book.title}
      </AppText>
      <View style={styles.spacer} />
      <AppText
        numberOfLines={2}
        style={{
          color: book.coverAccent,
          fontSize: authorSize,
          lineHeight: authorSize * 1.3,
          letterSpacing: 1,
          textTransform: 'uppercase',
          opacity: 0.9,
        }}
      >
        {book.author}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-start',
    paddingLeft: 18,
  },
  spine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, opacity: 0.5 },
  rule: { width: 28, height: 3, marginBottom: 10, opacity: 0.9 },
  spacer: { flex: 1 },
});
