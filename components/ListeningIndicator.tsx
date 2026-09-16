import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface ListeningIndicatorProps {
  /** Whether the mic is actively capturing — drives the breathing animation. */
  active: boolean;
  /** Diameter of the core circle in px. */
  size?: number;
  color: string;
}

/**
 * Shared mic visual for the Listening and Transcribing states. Deliberately
 * restrained — a slow "breathing" scale plus one or two fading pulse rings,
 * not a nightclub equalizer. Scale variance is kept under ~10% (spec).
 */
const ListeningIndicator: React.FC<ListeningIndicatorProps> = ({ active, size = 96, color }) => {
  const breathe = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    breathe.setValue(0);
    ring.setValue(0);
    if (!active) return;

    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const ringLoop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    breatheLoop.start();
    ringLoop.start();

    return () => {
      breatheLoop.stop();
      ringLoop.stop();
    };
  }, [active, breathe, ring]);

  const coreScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.25, 0.1, 0] });

  return (
    <View style={[styles.container, { width: size * 1.8, height: size * 1.8 }]}>
      {active && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: color,
              opacity: ringOpacity,
              transform: [{ scale: ringScale }],
            },
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.core,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
            transform: [{ scale: active ? coreScale : 1 }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  core: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ListeningIndicator;
