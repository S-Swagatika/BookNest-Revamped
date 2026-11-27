import { Pressable, StyleSheet, View } from 'react-native';

import { formatMoney, rentalPrice } from '@/domain/pricing';
import { RENTAL_TERMS, type Book, type RentalTerm } from '@/domain/types';
import { colors, radius, spacing, TOUCH_TARGET } from '@/theme/tokens';

import { AppText } from '../ui/AppText';

/** The only two rental terms offered are 7 and 30 days. */
export function RentalTermPicker({
  book,
  value,
  onChange,
}: {
  book: Pick<Book, 'buyPrice'>;
  value: RentalTerm;
  onChange: (term: RentalTerm) => void;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Rental length" style={styles.row}>
      {RENTAL_TERMS.map((term) => {
        const selected = term === value;
        return (
          <Pressable
            key={term}
            accessibilityRole="radio"
            accessibilityLabel={`${term} day rental, ${formatMoney(rentalPrice(book, term))}`}
            accessibilityState={{ selected }}
            onPress={() => onChange(term)}
            style={[styles.option, selected && styles.selected]}
          >
            <AppText variant="small" bold color={selected ? 'primary' : 'ink'}>
              {term} days
            </AppText>
            <AppText variant="heading" color={selected ? 'primary' : 'ink'}>
              {formatMoney(rentalPrice(book, term))}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  option: {
    flex: 1,
    minHeight: TOUCH_TARGET + 24,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 2,
  },
  selected: { borderColor: colors.primary, backgroundColor: '#EEF4F1' },
});
