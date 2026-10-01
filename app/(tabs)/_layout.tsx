import { Tabs } from 'expo-router';
import { BowlFood, ChartLineUp, ClockCounterClockwise, GearSix } from 'phosphor-react-native';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { useIntakeChartMode } from '../../utils/useIntakeChartMode';
import { useReminderResponses } from '../../utils/useReminderResponses';

export default function TabLayout() {
  const { accentTextColor } = useTheme();
  const showIntakeChart = useIntakeChartMode();
  useReminderResponses();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        // Insights' landscape intake chart takes the full screen.
        tabBarStyle:
          showIntakeChart && route.name === 'insights'
            ? { display: 'none' }
            : {
                backgroundColor: colors.background,
                borderTopWidth: 1,
                borderTopColor: '#E0E0E0',
                paddingTop: 10,
                paddingBottom: 8,
              },
        // Darkened variant, not the raw accent swatch: the active tab's icon
        // AND its label text share this color, and the label needs WCAG AA
        // 4.5:1 against the white tab bar (see docs/accessibility-audit.md).
        tabBarActiveTintColor: accentTextColor,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIconStyle: {
          width: 24,
          height: 24,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontWeight: '500',
          marginTop: 4,
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarLabel: 'Today',
          tabBarIcon: ({ color, focused, size }) => (
            <BowlFood
              size={size}
              color={color as string}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, focused, size }) => (
            <ClockCounterClockwise
              size={size}
              color={color as string}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarLabel: 'Insights',
          tabBarIcon: ({ color, focused, size }) => (
            <ChartLineUp
              size={size}
              color={color as string}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused, size }) => (
            <GearSix
              size={size}
              color={color as string}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  );
}