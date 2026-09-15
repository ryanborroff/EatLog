import React from 'react';
import { View, StyleSheet } from 'react-native';
import VoiceModal from '../components/VoiceModal';

export default function VoiceModalScreen() {
  return (
    <View style={styles.container}>
      <VoiceModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
