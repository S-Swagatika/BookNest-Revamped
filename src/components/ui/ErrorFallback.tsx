import { StyleSheet } from 'react-native';

import { spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Container, EmptyState, Screen } from './Layout';

/**
 * Shown when a screen throws while rendering. The message is always generic: error text and
 * stack traces can reveal internals, so they are never shown to the reader.
 */
export function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen>
      <Container style={styles.page}>
        <EmptyState
          title="Something went wrong"
          message="We could not show this page. Please try again. Your cart and library are safe."
        >
          <Button label="Try again" icon="refresh-outline" onPress={onRetry} />
          <Button label="Back to home" variant="secondary" href="/" />
        </EmptyState>
      </Container>
    </Screen>
  );
}

const styles = StyleSheet.create({ page: { paddingTop: spacing.xxxl } });
