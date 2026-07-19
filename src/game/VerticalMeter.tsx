import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import { GameColors } from '@/constants/gameTheme';
import type { RoundConfig } from '@/game/types';

type Props = {
  fill: SharedValue<number>;
  round: RoundConfig;
};

const METER_H = 340;
const METER_W = 108;
const INNER_H = METER_H - 20;

export function VerticalMeter({ fill, round }: Props) {
  const wobble = useSharedValue(0);

  useEffect(() => {
    wobble.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [wobble]);

  const liquidStyle = useAnimatedStyle(() => ({
    height: Math.max(14, fill.value * INNER_H),
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (wobble.value - 0.5) * 5 }, { scaleX: 1 + wobble.value * 0.04 }],
  }));

  const blobAStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -wobble.value * 8 }, { translateX: wobble.value * 3 }],
    opacity: 0.35 + wobble.value * 0.25,
  }));

  const blobBStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: wobble.value * 6 }, { translateX: -wobble.value * 4 }],
    opacity: 0.25 + (1 - wobble.value) * 0.2,
  }));

  const zoneBottom = (round.target - round.zoneHalf) * INNER_H;
  const zoneHeight = Math.max(10, round.zoneHalf * 2 * INNER_H);
  const markerBottom = 10 + round.target * INNER_H;

  return (
    <View style={styles.wrap}>
      <View style={[styles.markerRow, { bottom: markerBottom - 12 }]}>
        <View style={styles.flagTip} />
      </View>

      <View style={styles.pipeCap} />
      <View style={styles.shell}>
        <View style={styles.shellLip} />
        <View style={styles.glass}>
          {/* Single soft gradient zone band — one line, hot center */}
          <LinearGradient
            colors={[
              'rgba(255,225,74,0)',
              'rgba(255,225,74,0.55)',
              'rgba(255,106,61,0.95)',
              'rgba(255,225,74,0.55)',
              'rgba(255,225,74,0)',
            ]}
            locations={[0, 0.22, 0.5, 0.78, 1]}
            style={[
              styles.zone,
              {
                bottom: zoneBottom,
                height: zoneHeight,
              },
            ]}
          />

          <Animated.View style={[styles.liquidWrap, liquidStyle]}>
            <LinearGradient
              colors={[
                GameColors.liquidFoam,
                GameColors.liquidCore,
                GameColors.liquidMid,
                GameColors.liquidDeep,
                GameColors.liquidShade,
              ]}
              locations={[0, 0.12, 0.4, 0.72, 1]}
              style={StyleSheet.absoluteFill}
            />

            {/* Alien goo sheen */}
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(57,255,20,0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sheen}
            />

            <Animated.View style={[styles.blobA, blobAStyle]} />
            <Animated.View style={[styles.blobB, blobBStyle]} />
            <View style={styles.blobC} />

            {/* Wobbly alien surface */}
            <Animated.View style={[styles.surface, surfaceStyle]}>
              <LinearGradient
                colors={['rgba(233,255,224,0.95)', 'rgba(200,255,61,0.85)', 'rgba(57,255,20,0.4)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.surfaceFill}
              />
              <View style={styles.surfaceBumpL} />
              <View style={styles.surfaceBumpR} />
            </Animated.View>
          </Animated.View>
        </View>
      </View>
      <View style={styles.pipeBase} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: METER_W + 56,
    height: METER_H + 36,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pipeCap: {
    width: METER_W + 18,
    height: 22,
    borderRadius: 14,
    backgroundColor: GameColors.meterShell,
    borderWidth: 4,
    borderColor: GameColors.ink,
    marginBottom: -8,
    zIndex: 2,
  },
  shell: {
    width: METER_W,
    height: METER_H,
    borderRadius: 28,
    backgroundColor: GameColors.meterShell,
    borderWidth: 4,
    borderColor: GameColors.ink,
    padding: 10,
    overflow: 'hidden',
  },
  shellLip: {
    position: 'absolute',
    left: 10,
    top: 18,
    bottom: 18,
    width: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  glass: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: GameColors.meterInner,
    borderWidth: 3,
    borderColor: GameColors.ink,
  },
  zone: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  liquidWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  sheen: {
    ...StyleSheet.absoluteFill,
  },
  blobA: {
    position: 'absolute',
    left: 18,
    bottom: 40,
    width: 28,
    height: 34,
    borderRadius: 18,
    backgroundColor: 'rgba(200,255,61,0.45)',
  },
  blobB: {
    position: 'absolute',
    right: 14,
    bottom: 70,
    width: 20,
    height: 26,
    borderRadius: 14,
    backgroundColor: 'rgba(0,194,168,0.4)',
  },
  blobC: {
    position: 'absolute',
    left: 34,
    bottom: 110,
    width: 12,
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(233,255,224,0.55)',
  },
  surface: {
    position: 'absolute',
    left: -6,
    right: -6,
    top: -6,
    height: 22,
  },
  surfaceFill: {
    ...StyleSheet.absoluteFill,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  surfaceBumpL: {
    position: 'absolute',
    left: 18,
    top: -4,
    width: 22,
    height: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(233,255,224,0.85)',
  },
  surfaceBumpR: {
    position: 'absolute',
    right: 26,
    top: -2,
    width: 16,
    height: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(57,255,20,0.7)',
  },
  markerRow: {
    position: 'absolute',
    right: 2,
    width: 40,
    height: 24,
    zIndex: 3,
    justifyContent: 'center',
  },
  flagTip: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderRightWidth: 16,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: GameColors.zoneHot,
    alignSelf: 'flex-end',
  },
  pipeBase: {
    width: METER_W + 26,
    height: 18,
    marginTop: -6,
    borderRadius: 10,
    backgroundColor: GameColors.meterShellDark,
    borderWidth: 4,
    borderColor: GameColors.ink,
  },
});
