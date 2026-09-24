import { Platform, useWindowDimensions } from 'react-native';

/**
 * True when Insights should swap to its full-screen landscape intake chart: a
 * phone turned sideways. iPad ignores the app's portrait lock and is routinely
 * used in landscape, so it keeps the regular Insights layout and tab bar.
 */
export const useIntakeChartMode = (): boolean => {
  const { width, height } = useWindowDimensions();
  return width > height && !(Platform.OS === 'ios' && Platform.isPad);
};
