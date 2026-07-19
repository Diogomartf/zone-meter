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

import { GameColors, Gradients } from '@/constants/gameTheme';
import type { RoundConfig } from '@/game/types';

type Props = {
  fill: SharedValue<number>;
  round: RoundConfig;
};

const METER_H = 340;
const METER_W = 108;
const INNER_H = METER_H - 20;

function VerticalMeterComponent({ fill, round }: Props) {
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

  // One surface animation only — cheaper than multi-blob drivers
  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (wobble.value - 0.5) * 4 }],
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
          <LinearGradient
            colors={[...Gradients.zone]}
            locations={[...Gradients.zoneStops]}
            style={[styles.zone, { bottom: zoneBottom, height: zoneHeight }]}
          />

          <Animated.View style={[styles.liquidWrap, liquidStyle]}>
            <LinearGradient
              colors={[...Gradients.liquid]}
              locations={[...Gradients.liquidStops]}
              style={styles.fill}
            />
            <View style={styles.blobA} />
            <View style={styles.blobB} />
            <Animated.View style={[styles.surface, surfaceStyle]} />
          </Animated.View>
        </View>
      </View>
      <View style={styles.pipeBase} />
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
    backgroundColor: 'rgba(200,255,61,0.4)',
  },
  blobB: {
    position: 'absolute',
    right: 16,
    bottom: 72,
    width: 18,
    height: 22,
    borderRadius: 12,
    backgroundColor: 'rgba(0,194,168,0.35)',
  },
  surface: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 14,
    backgroundColor: 'rgba(233,255,224,0.75)',
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
    backgroundColor: GameColors.meterShellDark,
    borderWidth: 4,
    borderColor: GameColors.ink,
  },
});
