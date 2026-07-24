import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { GameColors } from "@/constants/gameTheme";
import type { SkinDef } from "@/game/skins";

type Props = {
  fill: SharedValue<number>;
  zoneTarget: SharedValue<number>;
  zoneHalf: SharedValue<number>;
  /** Perfect band as fraction of zoneHalf (0–1) */
  perfectRatio: number;
  /** Great band outer edge as fraction of zoneHalf (0–1) */
  greatRatio: number;
  skin: SkinDef;
  /** Visual scale of the meter tube */
  scale?: number;
  /** Drive liquid surface wobble only while filling */
  active?: boolean;
};

const BASE_H = 340;
const BASE_W = 100;
const TICK_COUNT = 7;
const MIN_LIQUID_PX = 14;
const MIN_ZONE_PX = 12;

/** Glossy toy bullseye — Nice, red Great, yellow Perfect line */
const EYE = {
  nice: "#6a219bc9",
  great: "#f15c2e",
  /** Soft mid-tone for Great → Nice falloff */
  greatFade: "#c44a5a",
  niceFade: "#6a3a8a",
  perfect: "#FFE44A",
} as const;

function VerticalMeterComponent({
  fill,
  zoneTarget,
  zoneHalf,
  perfectRatio,
  greatRatio,
  skin,
  scale = 1,
  active = false,
}: Props) {
  const meterH = BASE_H * scale;
  const meterW = BASE_W * scale;
  const innerH = meterH - 20;
  const wobble = useSharedValue(0.5);

  const pRatio = Math.min(Math.max(perfectRatio, 0.06), 0.28);
  const gRatio = Math.min(Math.max(greatRatio, pRatio * 1.8), 0.5);

  // Symmetric Nice / Great / Nice — Perfect is the yellow strike line at center
  const eyeGradient = useMemo(() => {
    const greatTop = 0.5 - gRatio / 2;
    const feather = Math.min(
      0.11,
      Math.max(0.04, (gRatio / 2) * 0.9, greatTop * 0.65),
    );

    // Top half only — bottom is the exact mirror
    const topHalf = [
      0,
      greatTop - feather,
      greatTop - feather * 0.55,
      greatTop - feather * 0.2,
      greatTop + feather * 0.15,
      greatTop + feather * 0.45,
      0.5,
    ];
    const topColors = [
      EYE.nice,
      EYE.nice,
      EYE.niceFade,
      EYE.greatFade,
      EYE.great,
      EYE.great,
      EYE.great,
    ] as const;

    const raw = [
      ...topHalf,
      ...topHalf
        .slice(0, -1)
        .reverse()
        .map((v) => 1 - v),
    ];
    const colors = [...topColors, ...topColors.slice(0, -1).reverse()] as const;

    let prev = 0;
    const locations = raw.map((v, i) => {
      if (i === 0) return 0;
      if (i === raw.length - 1) return 1;
      const next = Math.max(prev + 0.001, Math.min(0.999, v));
      prev = next;
      return next;
    }) as [number, number, ...number[]];

    return { colors, locations };
  }, [gRatio]);

  useEffect(() => {
    if (active) {
      wobble.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      );
      return;
    }
    cancelAnimation(wobble);
    wobble.value = withTiming(0.5, { duration: 180 });
  }, [active, wobble]);

  const ticks = useMemo(
    () =>
      Array.from({ length: TICK_COUNT }, (_, i) => (i + 1) / (TICK_COUNT + 1)),
    [],
  );

  // Fixed-height liquid slides up via translateY — avoids layout thrash on fill.
  const liquidStyle = useAnimatedStyle(() => {
    const t = Math.max(MIN_LIQUID_PX / innerH, fill.value);
    return {
      transform: [{ translateY: (1 - t) * innerH }],
    };
  });

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (wobble.value - 0.5) * 2.5 }],
  }));

  // Full-height zone band scaled + translated — no bottom/height layout updates.
  const zoneStyle = useAnimatedStyle(() => {
    const band = Math.max(MIN_ZONE_PX / innerH, zoneHalf.value * 2);
    // Applied right-to-left: scale around center, then translate into place.
    return {
      transform: [
        { translateY: (0.5 - zoneTarget.value) * innerH },
        { scaleY: band },
      ],
    };
  });

  const strikeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: 5 - zoneTarget.value * innerH }],
    opacity: 0.95,
  }));

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
        ]}
      >
        <View style={styles.shellLip} />
        <View style={[styles.glass, { borderRadius: 18 * scale }]}>
          {/* Glossy toy bullseye — single gradient (depth/sheen baked into colors) */}
          <Animated.View style={[styles.zoneWrap, { height: innerH }, zoneStyle]}>
            <LinearGradient
              colors={eyeGradient.colors}
              locations={eyeGradient.locations}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.zoneSheen} pointerEvents="none" />
          </Animated.View>

          {/* Perfect = soft yellow center line */}
          <Animated.View
            style={[styles.strikeLine, strikeStyle]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[
                "rgba(255,228,74,0)",
                "rgba(255,228,74,0.55)",
                EYE.perfect,
                "rgba(255,228,74,0.55)",
                "rgba(255,228,74,0)",
              ]}
              locations={[0, 0.28, 0.5, 0.72, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          <Animated.View
            style={[styles.liquidWrap, { height: innerH }, liquidStyle]}
          >
            <LinearGradient
              colors={[
                "rgba(255,176,32,0)",
                "rgba(255,176,32,0.55)",
                "rgba(255,240,120,0.9)",
              ]}
              locations={[0, 0.55, 1]}
              style={styles.surfaceGlow}
              pointerEvents="none"
            />

            <LinearGradient
              colors={[...skin.liquid]}
              locations={[0, 0.18, 0.42, 0.7, 1]}
              style={styles.fill}
            />

            <View style={styles.liquidSheen} pointerEvents="none" />

            <Animated.View style={[styles.surface, surfaceStyle]}>
              <LinearGradient
                colors={["#FFFFFF", "#FFF6A0", "#FFC94A"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>

          <View style={styles.ticks} pointerEvents="none">
            {ticks.map((t) => (
              <View
                key={t}
                style={[
                  styles.tick,
                  {
                    bottom: t * innerH,
                    width: 10 * scale,
                    height: Math.max(2, 2.5 * scale),
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.glassShine} pointerEvents="none" />
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
    alignItems: "center",
    justifyContent: "flex-end",
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
    overflow: "hidden",
  },
  shellLip: {
    position: "absolute",
    left: 10,
    top: 16,
    bottom: 16,
    width: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  glass: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: GameColors.meterInner,
    borderWidth: 3,
    borderColor: GameColors.ink,
  },
  zoneWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    overflow: "hidden",
    borderRadius: 2,
  },
  /** Flat specular strip — cheaper than a LinearGradient layer */
  zoneSheen: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  strikeLine: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 10,
    zIndex: 5,
    overflow: "hidden",
    shadowColor: EYE.perfect,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  liquidWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "visible",
    zIndex: 3,
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  liquidSheen: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "42%",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  surfaceGlow: {
    position: "absolute",
    left: -2,
    right: -2,
    top: -20,
    height: 25,
  },
  surface: {
    position: "absolute",
    left: 0,
    right: 0,
    top: -1,
    height: 5,
    borderRadius: 2,
    overflow: "hidden",
    shadowColor: "#FFB020",
    shadowOpacity: 0.95,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  ticks: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 3,
  },
  tick: {
    position: "absolute",
    right: 5,
    marginBottom: -1,
    borderRadius: 1,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  glassShine: {
    position: "absolute",
    left: 5,
    top: 10,
    bottom: 10,
    width: 9,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    zIndex: 4,
  },
  pipeBase: {
    height: 16,
    marginTop: -6,
    borderWidth: 4,
    borderColor: GameColors.ink,
  },
});
