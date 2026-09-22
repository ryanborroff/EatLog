import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import ListeningIndicator from '../components/ListeningIndicator';
import { track } from '../services/analytics';
import { colors, spacing, radii, typography } from '../constants/theme';

const PAGE_COUNT = 3;
const LAST_PAGE = PAGE_COUNT - 1;

const EXAMPLE_CORRECTIONS = ['“make the eggs three”', '“remove the banana”'];
const EXAMPLE_MEAL = '“Two scrambled eggs on sourdough with butter and a flat white.”';

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const { accentColor } = useTheme();
  const { completeOnboarding } = useOnboarding();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const isLastPage = page === LAST_PAGE;

  const goToPage = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setPage(index);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const handleSkip = () => {
    track('onboarding_skipped', { page });
    completeOnboarding();
  };

  const handleStartSpeaking = () => {
    track('onboarding_completed');
    completeOnboarding({ launchVoiceLog: true });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        {!isLastPage && (
          <TouchableOpacity
            onPress={handleSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Skip introduction"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.pager}
      >
        <View style={[styles.page, { width }]}>
          <View style={styles.visual}>
            <ListeningIndicator active size={112} color={accentColor} showMicIcon />
          </View>
          <Image
            source={require('../assets/wordmark.png')}
            style={styles.wordmark}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="EatLog"
          />
          <Text style={styles.tagline}>The voice-first food journal</Text>
          <Text style={styles.title}>{'Tell EatLog\nwhat you ate.'}</Text>
          <Text style={styles.body}>
            Speak naturally. EatLog will turn it into a simple, editable nutrition record.
          </Text>
        </View>

        <View style={[styles.page, { width }]}>
          <Text style={styles.title}>A simple running record.</Text>
          <Text style={styles.body}>
            Start by telling me what you ate. You can correct me naturally too:
          </Text>
          <View style={styles.chipRow}>
            {EXAMPLE_CORRECTIONS.map((example) => (
              <View key={example} style={styles.chip}>
                <Text style={styles.chipText}>{example}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.caption}>Type what you ate or a correction</Text>
          <View
            style={styles.mockInput}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text style={styles.mockInputText}>Or type what you ate…</Text>
            <View style={[styles.mockAddButton, { backgroundColor: accentColor }]}>
              <Text style={styles.mockAddText}>Add</Text>
            </View>
          </View>
        </View>

        <View style={[styles.page, { width }]}>
          <View style={styles.visual}>
            <ListeningIndicator active={false} size={96} color={accentColor} showMicIcon />
          </View>
          <Text style={styles.title}>Ready when you are</Text>
          <View style={styles.exampleCard}>
            <Text style={styles.exampleLabel}>Try:</Text>
            <Text style={styles.exampleText}>{EXAMPLE_MEAL}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: PAGE_COUNT }, (_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === page && { backgroundColor: colors.textPrimary, width: 24 },
              ]}
            />
          ))}
        </View>

        {isLastPage ? (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleStartSpeaking}
              accessibilityRole="button"
            >
              <Ionicons name="mic" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Start speaking</Text>
            </TouchableOpacity>
            <Text style={styles.footnote}>EatLog will ask for microphone permission.</Text>
          </>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => goToPage(page + 1)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </TouchableOpacity>
        )}
        {!isLastPage && <View style={styles.footnoteSpacer} />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  visual: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  wordmark: {
    width: 96,
    height: 33,
    alignSelf: 'center',
  },
  tagline: {
    ...typography.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 17,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  chipRow: {
    marginTop: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xs,
  },
  mockInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.card,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
  },
  mockInputText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  mockAddButton: {
    borderRadius: radii.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  mockAddText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  exampleCard: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.md,
  },
  exampleLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  exampleText: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    minHeight: 148,
    justifyContent: 'flex-end',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs / 2,
    marginBottom: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.divider,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: '#000000',
    borderRadius: 30,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  footnoteSpacer: {
    height: 29,
  },
  footnote: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
