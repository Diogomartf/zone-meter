import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { GameColors } from '@/constants/gameTheme';
import type { RoundConfig } from '@/game/types';

type Props = {
  fill: SharedValue<number>;
  round: RoundConfig;
};

const METER_H = 340;
const METER_W = 108;

export function VerticalMeter({ fill, round }: Props) {
  const liquidStyle = useAnimatedStyle(() => ({
    height: Math.max(10, fill.value * (METER_H - 20)),
  }));

  const zoneBottom = (round.target - round.zoneHalf) * (METER_H - 20);
  const zoneHeight = round.zoneHalf * 2 * (METER_H - 20);
  const perfectBottom = (round.target - round.perfectHalf) * (METER_H - 20);
  const perfectHeight = Math.max(8, round.perfectHalf * 2 * (METER_H - 20));
  const markerBottom = 10 + round.target * (METER_H - 20);

  return (
    <View style={styles.wrap}>
      <View style={[styles.markerRow, { bottom: markerBottom - 14 }]}>
        <View style={styles.flag}>
          <View style={styles.flagPole} />
          <View style={styles.flagTip} />
        </View>
      </View>

      <View style={styles.pipeCap} />
      <View style={styles.shell}>
        <View style={styles.shellLip} />
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
              locations={[0, 0.4, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.liquidShine} />
            <View style={styles.liquidBubbleA} />
            <View style={styles.liquidBubbleB} />
            <View style={styles.liquidTop} />
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
    top: 10,
    bottom: 10,
    width: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  liquidBubbleA: {
    position: 'absolute',
    right: 16,
    bottom: 28,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  liquidBubbleB: {
    position: 'absolute',
    right: 28,
    bottom: 54,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  liquidTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  zone: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 225, 74, 0.55)',
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: GameColors.white,
  },
  perfect: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: GameColors.perfect,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: GameColors.ink,
  },
  markerRow: {
    position: 'absolute',
    right: 0,
    width: 46,
    height: 28,
    zIndex: 3,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagPole: {
    width: 5,
    height: 28,
    backgroundColor: GameColors.ink,
    borderRadius: 2,
  },
  flagTip: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 18,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: GameColors.perfect,
    marginLeft: -1,
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
