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
  zoneTarget: SharedValue<number>;
  zoneHalf: SharedValue<number>;
  skin: SkinDef;
  /** Visual scale of the meter tube */
  scale?: number;
};

const BASE_H = 340;
const BASE_W = 100;

function VerticalMeterComponent({
  fill,
  zoneTarget,
  zoneHalf,
  skin,
  scale = 1,
}: Props) {
  const meterH = BASE_H * scale;
  const meterW = BASE_W * scale;
  const innerH = meterH - 20;
  const wobble = useSharedValue(0);

  useEffect(() => {
    wobble.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [wobble]);

  const liquidStyle = useAnimatedStyle(() => ({
    height: Math.max(12, fill.value * innerH),
  }));

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (wobble.value - 0.5) * 3 }],
  }));

  const zoneStyle = useAnimatedStyle(() => {
    const half = zoneHalf.value;
    return {
      bottom: (zoneTarget.value - half) * innerH,
      height: Math.max(8, half * 2 * innerH),
    };
  });

  return (
    <View style={[styles.wrap, { width: meterW + 24, height: meterH + 28 }]}>
      <View
        style={[
          styles.pipeCap,
          {
            width: meterW + 16,
            backgroundColor: skin.shell,
            borderRadius: 12 * scale,
          },
        ]}
      />
      <View
        style={[
          styles.shell,
          {
            width: meterW,
            height: meterH,
            borderRadius: 24 * scale,
            backgroundColor: skin.shell,
            padding: 9 * scale,
          },
        ]}>
        <View style={styles.shellLip} />
        <View style={[styles.glass, { borderRadius: 18 * scale }]}>
          {/* Target zone only — no arrow / stop line clutter */}
          <Animated.View style={[styles.zoneWrap, zoneStyle]}>
            <LinearGradient
              colors={[
                'rgba(255,75,75,0)',
                'rgba(255,75,75,0.5)',
                'rgba(255,40,40,0.95)',
                'rgba(255,75,75,0.5)',
                'rgba(255,75,75,0)',
              ]}
              locations={[0, 0.22, 0.5, 0.78, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View style={[styles.liquidWrap, liquidStyle]}>
            <LinearGradient
              colors={[...skin.liquid]}
              locations={[0, 0.12, 0.4, 0.72, 1]}
              style={styles.fill}
            />
            <Animated.View style={[styles.surface, surfaceStyle]} />
          </Animated.View>
        </View>
      </View>
      <View
        style={[
          styles.pipeBase,
          {
            width: meterW + 22,
            backgroundColor: skin.shellDark,
            borderRadius: 10 * scale,
          },
        ]}
      />
    </View>
  );
}

export const VerticalMeter = memo(VerticalMeterComponent);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pipeCap: {
    height: 20,
    borderWidth: 4,
    borderColor: GameColors.ink,
    marginBottom: -8,
    zIndex: 2,
  },
  shell: {
    borderWidth: 4,
    borderColor: GameColors.ink,
    overflow: 'hidden',
  },
  shellLip: {
    position: 'absolute',
    left: 10,
    top: 16,
    bottom: 16,
    width: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  glass: {
    flex: 1,
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
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  pipeBase: {
    height: 16,
    marginTop: -6,
    borderWidth: 4,
    borderColor: GameColors.ink,
  },
});
