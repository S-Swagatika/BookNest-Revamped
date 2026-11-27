import { StyleSheet, View } from 'react-native';

import { STATUS_LABEL } from '@/domain/library';
import type { ReadingStatus } from '@/domain/types';
import { useShelfStore } from '@/store/shelf';
import { spacing } from '@/theme/tokens';

import { AppText } from '../ui/AppText';
import { Chip } from '../ui/Chip';

const ORDER: readonly ReadingStatus[] = ['wantToRead', 'reading', 'finished'];

/** Manual reading-status control. One status per book keeps shelves free of contradictions. */
export function ShelfPicker({ bookId }: { bookId: string }) {
  const current = useShelfStore((state) => state.library[bookId]?.status);
  const setStatus = useShelfStore((state) => state.setStatus);
  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="muted">
        MY LIBRARY
      </AppText>
      <View style={styles.row}>
        {ORDER.map((status) => (
          <Chip
            key={status}
            label={STATUS_LABEL[status]}
            selected={current === status}
            onPress={() => setStatus(bookId, status)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
