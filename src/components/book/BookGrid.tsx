import type { Book } from '@/domain/types';
import { gridColumns, useBreakpoint } from '@/theme/breakpoints';
import { spacing } from '@/theme/tokens';

import { EmptyState, Grid } from '../ui/Layout';

import { BookCard } from './BookCard';

/** Responsive book grid: 2 columns on phones, 3 on tablets, 4 on desktop (3 with a sidebar). */
export function BookGrid({
  books,
  hasSidebar,
  reasons,
  emptyTitle = 'No books found',
  emptyMessage = 'Try a different search or clear your filters.',
}: {
  books: readonly Book[];
  hasSidebar?: boolean;
  reasons?: Readonly<Record<string, string>>;
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const { breakpoint } = useBreakpoint();
  if (books.length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} />;
  return (
    <Grid columns={gridColumns(breakpoint, hasSidebar)} gap={spacing.lg}>
      {books.map((book) => (
        <BookCard key={book.id} book={book} reason={reasons?.[book.id]} />
      ))}
    </Grid>
  );
}
