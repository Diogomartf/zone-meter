import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameColors, GameFonts } from '@/constants/gameTheme';

const HEART = require('../../assets/images/heart-filled.png');

type Props = {
  visible: boolean;
  /** Bumps each miss so the break restarts */
  burstKey?: number;
  /** Lives remaining after this miss */
  livesLeft?: number;
};

/**
 * Sad miss callout beside the meter — heart snaps away so you feel the loss
 * without hunting the HUD before the next fill.
 */
export function MissBreak({ visible, burstKey = 0, livesLeft = 0 }: Props) {
  const opacity = useSharedValue(0);
  const wordY = useSharedValue(-8);
  const wordScale = useSharedValue(0.7);
  const heartScale = useSharedValue(0.4);
  const heartY = useSharedValue(0);
  const heartTilt = useSharedValue(0);
  const heartOpacity = useSharedValue(1);
  const minusOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      return;
    }

    opacity.value = 0;
    wordY.value = -10;
    wordScale.value = 0.65;
    heartScale.value = 0.35;
    heartY.value = 0;
    heartTilt.value = 0;
    heartOpacity.value = 1;
    minusOpacity.value = 0;

    opacity.value = withSequence(
      withTiming(1, { duration: 80 }),
      withDelay(700, withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) })),
    );

    // Soft sad droop — not a victory punch
    wordScale.value = withSequence(
      withTiming(1.12, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
    );
    wordY.value = withSequence(
      withTiming(4, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(18, { duration: 640, easing: Easing.in(Easing.quad) }),
    );

    // Heart pops, then breaks away downward
    heartScale.value = withSequence(
      withTiming(1.55, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1.05, { duration: 100 }),
      withTiming(0.55, { duration: 420, easing: Easing.in(Easing.cubic) }),
    );
    heartY.value = withSequence(
      withTiming(-12, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(42, { duration: 520, easing: Easing.in(Easing.quad) }),
    );
    heartTilt.value = withSequence(
      withTiming(-12, { duration: 120 }),
      withTiming(28, { duration: 480, easing: Easing.in(Easing.quad) }),
    );
    heartOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(280, withTiming(0, { duration: 320 })),
    );
    minusOpacity.value = withSequence(
      withDelay(80, withTiming(1, { duration: 100 })),
      withDelay(480, withTiming(0, { duration: 240 })),
    );
  }, [
    burstKey,
    heartOpacity,
    heartScale,
    heartTilt,
    heartY,
    minusOpacity,
    opacity,
    visible,
    wordScale,
    wordY,
  ]);

  const wrapStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const wordStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: wordY.value }, { scale: wordScale.value }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [
      { translateY: heartY.value },
      { scale: heartScale.value },
      { rotate: `${heartTilt.value}deg` },
    ],
  }));

  const minusStyle = useAnimatedStyle(() => ({
    opacity: minusOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.anchor} pointerEvents="none">
      <Animated.View style={[styles.card, wrapStyle]}>
        <Animated.View style={[styles.heartWrap, heartStyle]}>
          <Image source={HEART} style={styles.heart} contentFit="contain" />
          <Animated.Text style={[styles.minus, minusStyle]}>-1</Animated.Text>
        </Animated.View>
        <Animated.View style={wordStyle}>
          <Text style={styles.word}>MISS</Text>
          <Text style={styles.sub}>
            {livesLeft <= 0 ? 'no hearts left' : `${livesLeft} heart${livesLeft === 1 ? '' : 's'} left`}
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  card: {
    alignItems: 'center',
    gap: 6,
  },
  heartWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    width: 56,
    height: 56,
  },
  minus: {
    position: 'absolute',
    right: -6,
    top: 2,
    fontFamily: GameFonts.display,
    fontSize: 22,
    lineHeight: 24,
    color: '#FF4B4B',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  word: {
    fontFamily: GameFonts.display,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: 2,
    color: '#6B7280',
    textAlign: 'center',
    textShadowColor: 'rgba(26,28,44,0.35)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  sub: {
    marginTop: 2,
    fontFamily: GameFonts.body,
    fontSize: 16,
    lineHeight: 20,
    color: '#FF4B4B',
    textAlign: 'center',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
});
