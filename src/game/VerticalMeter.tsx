import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { GameColors } from '@/constants/gameTheme';
import type { RoundConfig } from '@/game/types';

type Props = {
  fill: SharedValue<number>;
  round: RoundConfig;
  frozen?: boolean;
};

const METER_H = 360;
const METER_W = 92;

export function VerticalMeter({ fill, round }: Props) {
  const liquidStyle = useAnimatedStyle(() => ({
    height: Math.max(8, fill.value * METER_H),
  }));

  const zoneBottom = (round.target - round.zoneHalf) * METER_H;
  const zoneHeight = round.zoneHalf * 2 * METER_H;
  const perfectBottom = (round.target - round.perfectHalf) * METER_H;
  const perfectHeight = Math.max(6, round.perfectHalf * 2 * METER_H);
  const markerBottom = round.target * METER_H;

  return (
    <View style={styles.wrap}>
      <View style={[styles.markerRow, { bottom: markerBottom - 10 }]}>
        <View style={styles.triangle} />
        <View style={styles.markerLine} />
      </View>

      <View style={styles.shell}>
        <View style={styles.glass}>
          <View
            style={[
              styles.zone,
              {
                bottom: zoneBottom,
                height: zoneHeight,
              },
            ]}
          />
          <View
            style={[
              styles.perfect,
              {
                bottom: perfectBottom,
                height: perfectHeight,
              },
            ]}
          />

          <Animated.View style={[styles.liquidWrap, liquidStyle]}>
            <LinearGradient
              colors={[GameColors.liquidHigh, GameColors.liquidMid, GameColors.liquidLow]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.liquidShine} />
            <View style={styles.liquidTop} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: METER_W + 48,
    height: METER_H + 24,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  shell: {
    width: METER_W,
    height: METER_H,
    borderRadius: METER_W / 2,
    backgroundColor: GameColors.meterShell,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  glass: {
    flex: 1,
    borderRadius: (METER_W - 16) / 2,
    overflow: 'hidden',
    backgroundColor: GameColors.meterGlass,
  },
  liquidWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  liquidShine: {
    position: 'absolute',
    left: 10,
    top: 8,
    bottom: 8,
    width: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  liquidTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  zone: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(250, 204, 21, 0.45)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: GameColors.zoneEdge,
  },
  perfect: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: GameColors.perfect,
    opacity: 0.95,
  },
  markerRow: {
    position: 'absolute',
    right: 0,
    width: 40,
    height: 20,
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 2,
  },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: 4,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: GameColors.ink,
  },
  markerLine: {
    position: 'absolute',
    left: 16,
    width: 18,
    height: 3,
    backgroundColor: GameColors.ink,
    borderRadius: 2,
  },
});
