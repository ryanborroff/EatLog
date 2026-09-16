import React from 'react';
import { View, StyleSheet } from 'react-native';
import VoiceLogFlow from '../components/VoiceLogFlow';

export default function VoiceModalScreen() {
  return (
    <View style={styles.container}>
      <VoiceLogFlow />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
