import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { DailyGoals, UserProfile } from '../../types';
import { getUserGoals, getUserProfile } from '../../services/storageService';
import { signOut } from '../../services/authService';
import { ACCENT_COLORS, WeekStartDay, useTheme } from '../../contexts/ThemeContext';
import { colors as theme, spacing, radii } from '../../constants/theme';
import { getAppleHealthSyncEnabled, setAppleHealthSyncEnabled } from '../../services/healthSyncPreference';
import { requestHealthKitAuthorization } from '../../services/healthKitService';
import { SettingsGroup, SettingsRow, settingsFooterTextStyle } from '../../components/SettingsList';

const OGL_URL = 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/';

const WEEK_START_OPTIONS: { value: WeekStartDay; label: string }[] = [
  { value: 'sunday', label: 'Sunday' },
  { value: 'monday', label: 'Monday' },
];

// "Sam · 34 · 178 cm" — whatever parts of the profile are filled in.
const profileSummary = (profile: UserProfile | null): string => {
  if (!profile) return '';
  const parts = [
    profile.name ?? null,
    profile.birthYear ? `${new Date().getFullYear() - profile.birthYear}` : null,
    profile.heightCm ? `${profile.heightCm} cm` : null,
    profile.weightKg ? `${profile.weightKg} kg` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Not set';
};

export default function SettingsScreen() {
  const router = useRouter();
  const { accentColor, accentTextColor, accentColorId, setAccentColorId, weekStartsOn, setWeekStartsOn } = useTheme();
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthSyncEnabled, setHealthSyncEnabled] = useState(false);
  const [healthSyncBusy, setHealthSyncBusy] = useState(false);

  useEffect(() => {
    getAppleHealthSyncEnabled().then(setHealthSyncEnabled);
  }, []);

  // Reload on focus so the Profile and Daily targets summaries reflect edits
  // made on their own screens.
  useFocusEffect(
    useCallback(() => {
      Promise.all([getUserGoals(), getUserProfile()])
        .then(([userGoals, userProfile]) => {
          setGoals(userGoals);
          setProfile(userProfile);
        })
        .catch((error) => console.error('Error loading settings:', error))
        .finally(() => setLoading(false));
    }, [])
  );

  const handleToggleHealthSync = async (value: boolean) => {
    if (value) {
      setHealthSyncBusy(true);
      try {
        const granted = await requestHealthKitAuthorization();
        if (!granted) {
          Alert.alert(
            'Apple Health access needed',
            'EatLog needs permission to write to Apple Health. You can grant it in Settings → Privacy & Security → Health → EatLog.'
          );
          return;
        }
        await setAppleHealthSyncEnabled(true);
        setHealthSyncEnabled(true);
      } catch (error) {
        console.error('Error enabling Apple Health sync:', error);
        Alert.alert('Error', 'Could not connect to Apple Health.');
      } finally {
        setHealthSyncBusy(false);
      }
    } else {
      await setAppleHealthSyncEnabled(false);
      setHealthSyncEnabled(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error) {
            Alert.alert('Error', 'Failed to sign out.');
          }
        },
      },
    ]);
  };

  if (loading || !goals) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <SettingsGroup title="You">
          <SettingsRow label="Profile" value={profileSummary(profile)} onPress={() => router.push('/settings/profile')} />
          <SettingsRow
            label="Daily targets"
            value={`${goals.calories} kcal · ${goals.protein}g protein`}
            onPress={() => router.push('/settings/targets')}
          />
        </SettingsGroup>

        <SettingsGroup
          title="Logging"
          footer="My foods are exact nutrition you've saved from a barcode or typed in, used instead of an estimate whenever EatLog recognises the food. Shortcuts log a set of them when you say a name like “my usual breakfast”."
        >
          <SettingsRow label="My foods" onPress={() => router.push('/settings/personal-foods')} />
          <SettingsRow label="Quick-log shortcuts" onPress={() => router.push('/settings/usual-foods')} />
        </SettingsGroup>

        {Platform.OS === 'ios' && (
          <SettingsGroup
            title="Apple Health"
            footer="When on, EatLog writes the calories and macros you log to Apple Health. EatLog never reads data from Apple Health."
          >
            <SettingsRow
              label="Sync to Apple Health"
              accessory={
                <Switch value={healthSyncEnabled} onValueChange={handleToggleHealthSync} disabled={healthSyncBusy} />
              }
            />
          </SettingsGroup>
        )}

        <SettingsGroup title="Appearance">
          <View style={styles.appearanceRow}>
            <Text style={styles.appearanceLabel}>Accent colour</Text>
            <View style={styles.colorSwatchRow}>
              {ACCENT_COLORS.map((color) => {
                const selected = accentColorId === color.id;
                return (
                  <TouchableOpacity
                    key={color.id}
                    style={styles.colorSwatchWrapper}
                    onPress={() => setAccentColorId(color.id)}
                    accessibilityLabel={`${color.label} accent colour`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[styles.colorSwatch, { backgroundColor: color.value }, selected && styles.colorSwatchSelected]}
                    />
                    <Text style={styles.colorSwatchLabel}>{color.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.appearanceRow}>
            <Text style={styles.appearanceLabel}>Week begins on</Text>
            <View style={styles.weekStartRow}>
              {WEEK_START_OPTIONS.map((option) => {
                const selected = option.value === weekStartsOn;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.weekStartChip, selected && { backgroundColor: accentColor, borderColor: accentColor }]}
                    onPress={() => setWeekStartsOn(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.weekStartChipText}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </SettingsGroup>

        <SettingsGroup
          title="About"
          footer={
            <>
              <Text style={settingsFooterTextStyle}>
                Nutrition data for standard foods comes from McCance and Widdowson's Composition of Foods Integrated
                Dataset (CoFID), published by the UK government.
              </Text>
              <Text style={settingsFooterTextStyle}>
                Contains public sector information licensed under the{' '}
                <Text
                  style={[styles.footerLink, { color: accentTextColor }]}
                  onPress={() => Linking.openURL(OGL_URL)}
                  accessibilityRole="link"
                >
                  Open Government Licence v3.0
                </Text>
                .
              </Text>
            </>
          }
        >
          <SettingsRow label="Privacy" onPress={() => router.push('/settings/privacy')} />
        </SettingsGroup>

        {/* Low-use, so deliberately quiet: the confirmation alert carries the destructive styling. */}
        <TouchableOpacity style={styles.signOut} onPress={handleSignOut} accessibilityRole="button">
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 38,
    color: theme.textPrimary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: theme.textSecondary,
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
  appearanceRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  appearanceLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    marginBottom: spacing.sm,
  },
  colorSwatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  colorSwatchWrapper: {
    alignItems: 'center',
    minWidth: 44,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSwatchSelected: {
    borderColor: theme.textPrimary,
  },
  colorSwatchLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 6,
  },
  weekStartRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  weekStartChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: theme.background,
    borderWidth: 1.5,
    borderColor: theme.cardBorder,
  },
  // Black in both states: when selected the chip is filled with the accent
  // colour, where white text fails WCAG AA.
  weekStartChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  signOut: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  signOutText: {
    fontSize: 15,
    color: theme.textSecondary,
  },
});
