// Icon fonts load asynchronously and update state inside @expo/vector-icons after render.
// That update is outside our control, so it is mocked with a plain component in tests.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const Icon = ({ name }: { name: string }) => <Text accessibilityElementsHidden>{name}</Text>;
  return { Ionicons: Icon };
});
