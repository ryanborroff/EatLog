import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { colors } from '../../constants/theme';
import { useIntakeChartMode } from '../../utils/useIntakeChartMode';

export default function TabLayout() {
  const { accentTextColor } = useTheme();
  const showIntakeChart = useIntakeChartMode();

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
            <Ionicons name={focused ? 'today' : 'today-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarLabel: 'Insights',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={size}
              color={color}
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
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}