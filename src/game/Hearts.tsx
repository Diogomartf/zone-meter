import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { GameColors } from '@/constants/gameTheme';

type Props = {
  lives: number;
  max?: number;
};

const HEART_FILLED = require('../../assets/images/heart-filled.png');
const HEART_EMPTY = require('../../assets/images/heart-empty.png');

function Heart({ filled }: { filled: boolean }) {
  const wasFilled = useRef(filled);
  const [popping, setPopping] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (wasFilled.current && !filled) {
      setPopping(true);
      scale.value = 1;
      opacity.value = 1;
      rotate.value = 0;

      scale.value = withSequence(
        withTiming(1.55, { duration: 100, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) }),
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 200 }, (finished) => {
          if (finished) runOnJS(setPopping)(false);
        }),
      );
      rotate.value = withSequence(
        withTiming(-14, { duration: 100, easing: Easing.out(Easing.quad) }),
        withTiming(22, { duration: 240, easing: Easing.in(Easing.quad) }),
      );
    }

    wasFilled.current = filled;
  }, [filled, opacity, rotate, scale]);

  const popStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <View style={styles.slot}>
      <Image
        source={filled ? HEART_FILLED : HEART_EMPTY}
        style={styles.heart}
        contentFit="contain"
      />
      {popping ? (
        <Animated.View style={[styles.popLayer, popStyle]} pointerEvents="none">
          <Image source={HEART_FILLED} style={styles.heart} contentFit="contain" />
        </Animated.View>
      ) : null}
    </View>
  );
}

export function Hearts({ lives, max = 3 }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }, (_, i) => (
        <Heart key={i} filled={i < lives} />
      ))}
    </View>
  );
}

const SIZE = 26;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: 'visible',
  },
  slot: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heart: {
    width: SIZE,
    height: SIZE,
  },
  popLayer: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
