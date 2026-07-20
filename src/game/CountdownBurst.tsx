import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { GameColors, GameFonts } from '@/constants/gameTheme';

type Props = {
  value: number; // 3,2,1,0=GO
  visible: boolean;
};

/** Warm high-contrast colors — avoid blues that disappear on the sky bg */
const COLORS: Record<number, string> = {
  3: '#FFE14A',
  2: '#FF8A00',
  1: '#FF4B4B',
  0: '#FFFFFF',
};

export function CountdownBurst({ value, visible }: Props) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);
  const wobble = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      return;
    }
    scale.value = 0.35;
    opacity.value = 0;
    wobble.value = value === 0 ? -8 : 0;
    opacity.value = withTiming(1, { duration: 70 });
    scale.value = withSequence(
      withTiming(value === 0 ? 1.35 : 1.22, {
        duration: 160,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) }),
    );
    if (value === 0) {
      wobble.value = withSequence(
        withTiming(8, { duration: 70 }),
        withTiming(-6, { duration: 70 }),
        withTiming(0, { duration: 90 }),
      );
    }
  }, [opacity, scale, value, visible, wobble]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${wobble.value}deg` }],
  }));

  if (!visible) return null;

  const label = value > 0 ? String(value) : 'GO!';
  const color = COLORS[value] ?? GameColors.ink;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.burst, style]}>
        <Text style={[styles.text, value === 0 && styles.goText, { color }]}>{label}</Text>
        {value === 0 ? <Text style={styles.sub}>LET'S GO</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
  },
  burst: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  text: {
    fontFamily: GameFonts.display,
    fontSize: 96,
    lineHeight: 100,
    textAlign: 'center',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  goText: {
    fontSize: 84,
    lineHeight: 88,
  },
  sub: {
    marginTop: 2,
    fontFamily: GameFonts.body,
    fontSize: 18,
    color: GameColors.lemon,
    letterSpacing: 1,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
});
