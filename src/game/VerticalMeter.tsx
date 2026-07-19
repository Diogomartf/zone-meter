import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { GameColors } from '@/constants/gameTheme';
import type { SkinDef } from '@/game/skins';

type Props = {
  fill: SharedValue<number>;
  /** Live zone center 0–1 */
  zoneTarget: SharedValue<number>;
  /** Live zone half-width 0–1 */
  zoneHalf: SharedValue<number>;
  ghostStop?: number | null;
  skin: SkinDef;
};

export const METER_H = 340;
export const METER_W = 108;
export const INNER_H = METER_H - 20;

function VerticalMeterComponent({ fill, zoneTarget, zoneHalf, ghostStop, skin }: Props) {
  const wobble = useSharedValue(0);

  useEffect(() => {
    wobble.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [wobble]);

  const liquidStyle = useAnimatedStyle(() => ({
    height: Math.max(14, fill.value * INNER_H),
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (wobble.value - 0.5) * 4 }],
  }));

  const zoneStyle = useAnimatedStyle(() => {
    const half = zoneHalf.value;
    const bottom = (zoneTarget.value - half) * INNER_H;
    const height = Math.max(10, half * 2 * INNER_H);
    return { bottom, height };
  });

  const markerStyle = useAnimatedStyle(() => ({
    bottom: 10 + zoneTarget.value * INNER_H - 12,
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.markerRow, markerStyle]}>
        <View style={styles.flagTip} />
      </Animated.View>

      <View style={[styles.pipeCap, { backgroundColor: skin.shell }]} />
      <View style={[styles.shell, { backgroundColor: skin.shell }]}>
        <View style={styles.shellLip} />
        <View style={styles.glass}>
          <Animated.View style={[styles.zoneWrap, zoneStyle]}>
            <LinearGradient
              colors={[
                'rgba(255,75,75,0)',
                'rgba(255,75,75,0.45)',
                'rgba(255,45,45,0.95)',
                'rgba(255,75,75,0.45)',
                'rgba(255,75,75,0)',
              ]}
              locations={[0, 0.22, 0.5, 0.78, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {ghostStop != null ? (
            <View
              style={[
                styles.ghost,
                { bottom: Math.max(0, ghostStop * INNER_H - 2) },
              ]}
            />
          ) : null}

          <Animated.View style={[styles.liquidWrap, liquidStyle]}>
            <LinearGradient
              colors={[...skin.liquid]}
              locations={[0, 0.12, 0.4, 0.72, 1]}
              style={styles.fill}
            />
            <View style={styles.blobA} />
            <View style={styles.blobB} />
            <Animated.View style={[styles.surface, surfaceStyle]} />
          </Animated.View>
        </View>
      </View>
      <View style={[styles.pipeBase, { backgroundColor: skin.shellDark }]} />
    </View>
  );
}

export const VerticalMeter = memo(VerticalMeterComponent);

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
    borderWidth: 4,
    borderColor: GameColors.ink,
    marginBottom: -8,
    zIndex: 2,
  },
  shell: {
    width: METER_W,
    height: METER_H,
    borderRadius: 28,
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
  zoneWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  ghost: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: GameColors.ink,
    zIndex: 4,
  },
  liquidWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  blobA: {
    position: 'absolute',
    left: 18,
    bottom: 40,
    width: 26,
    height: 30,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  blobB: {
    position: 'absolute',
    right: 16,
    bottom: 72,
    width: 18,
    height: 22,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    borderRightColor: GameColors.perfect,
    alignSelf: 'flex-end',
  },
  pipeBase: {
    width: METER_W + 26,
    height: 18,
    marginTop: -6,
    borderRadius: 10,
    borderWidth: 4,
    borderColor: GameColors.ink,
  },
});
