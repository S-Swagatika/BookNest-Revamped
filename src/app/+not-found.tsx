import Head from 'expo-router/head';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Container, EmptyState, Screen } from '@/components/ui/Layout';
import { spacing } from '@/theme/tokens';

export default function NotFoundScreen() {
  return (
    <Screen>
      <Head>
        <title>Page not found — BookNest</title>
      </Head>
      <Container style={styles.page}>
        <EmptyState
          title="Page not found"
          message="We could not find the page you were looking for."
        >
          <Button label="Back to home" href="/" />
        </EmptyState>
      </Container>
    </Screen>
  );
}

const styles = StyleSheet.create({ page: { paddingTop: spacing.xxxl } });
