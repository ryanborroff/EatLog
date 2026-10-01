import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import VoiceLogFlow from '../components/VoiceLogFlow';
import { ThemeColors } from '../constants/theme';
import { useThemedStyles } from '../contexts/ThemeContext';

export default function VoiceModalScreen() {
  const styles = useThemedStyles(makeStyles);
  // Populated when this screen is opened via the "Log food in EatLog" Siri
  // Shortcut / App Intent (eatlog://modal?transcript=...) instead of a
  // manual mic tap — see plugins/siri-shortcut.
  const { transcript } = useLocalSearchParams<{ transcript?: string }>();

  return (
    <View style={styles.container}>
      <VoiceLogFlow initialTranscript={transcript} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
  });
