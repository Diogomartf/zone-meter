import { useEffect } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameColors, GameFonts } from '@/constants/gameTheme';

type Props = {
  visible: boolean;
  /** Bumps each Perfect so the swoosh restarts even on back-to-back hits */
  burstKey?: number;
  points?: number;
  combo?: number;
};

/**
 * Full-screen PERFECT callout — big Bauhaus yellow with a horizontal swoosh.
 */
export function PerfectSwoosh({ visible, burstKey = 0, points = 0, combo = 0 }: Props) {
  const { width } = useWindowDimensions();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.4);
  const slide = useSharedValue(-width * 0.55);
  const tilt = useSharedValue(-14);
  const streakX = useSharedValue(-width);
  const streakOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      return;
    }

    opacity.value = 0;
    scale.value = 0.75;
    slide.value = -width * 0.18;
    tilt.value = -5;
    streakX.value = -width * 0.4;
    streakOpacity.value = 0;

    opacity.value = withSequence(
      withTiming(1, { duration: 80 }),
      withDelay(640, withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) })),
    );

    // Light swoosh in, settle, soft fade — not a hard slash
    slide.value = withSequence(
      withTiming(6, { duration: 200, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 140, easing: Easing.inOut(Easing.quad) }),
      withDelay(380, withTiming(width * 0.12, { duration: 200, easing: Easing.in(Easing.quad) })),
    );

    scale.value = withSequence(
      withTiming(1.18, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(1.04, { duration: 160, easing: Easing.inOut(Easing.quad) }),
      withDelay(360, withTiming(0.96, { duration: 180, easing: Easing.in(Easing.quad) })),
    );

    tilt.value = withSequence(
      withTiming(1.5, { duration: 180, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 160 }),
    );

    streakOpacity.value = withSequence(
      withTiming(0.45, { duration: 70 }),
      withDelay(120, withTiming(0, { duration: 220 })),
    );
    streakX.value = withTiming(width * 0.35, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [burstKey, opacity, scale, slide, streakOpacity, streakX, tilt, visible, width]);

  const wordStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: slide.value },
      { scale: scale.value },
      { rotate: `${tilt.value}deg` },
    ],
  }));

  const streakStyle = useAnimatedStyle(() => ({
    opacity: streakOpacity.value,
    transform: [{ translateX: streakX.value }, { rotate: '-4deg' }],
  }));

  const metaStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: Math.min(1.08, scale.value) }],
  }));

  if (!visible) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.streak, { width: width * 1.2 }, streakStyle]} />
      <Animated.View style={[styles.wordWrap, wordStyle]}>
        <Text
          style={styles.word}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}>
          PERFECT!
        </Text>
      </Animated.View>
      <Animated.View style={[styles.meta, metaStyle]}>
        {points > 0 ? <Text style={styles.points}>+{points}</Text> : null}
        {combo > 1 ? <Text style={styles.combo}>COMBO x{combo}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streak: {
    position: 'absolute',
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFE14A',
    opacity: 0.55,
    shadowColor: '#FFE14A',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  wordWrap: {
    width: '100%',
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  word: {
    fontFamily: GameFonts.display,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: 0.5,
    color: '#FFE14A',
    textAlign: 'center',
    width: '100%',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 5 },
    textShadowRadius: 0,
  },
  meta: {
    marginTop: 8,
    alignItems: 'center',
    gap: 4,
  },
  points: {
    fontFamily: GameFonts.display,
    fontSize: 32,
    lineHeight: 36,
    color: GameColors.white,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  combo: {
    fontFamily: GameFonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: GameColors.lemon,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
