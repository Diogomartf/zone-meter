import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

function CloudBlob({
  top,
  left,
  scale = 1,
  drift = 10,
  duration = 9000,
  opacity = 0.95,
}: {
  top: number;
  left: number;
  scale?: number;
  drift?: number;
  duration?: number;
  opacity?: number;
}) {
  const x = useSharedValue(0);

  useEffect(() => {
    x.value = withRepeat(
      withTiming(drift, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift, duration, x]);

  const style = useAnimatedStyle(() => ({
    opacity,
    transform: [{ translateX: x.value }, { scale }],
  }));

  return (
    <Animated.View style={[styles.cloud, { top, left }, style]}>
      <View style={[styles.puff, styles.puffShade, styles.shadeA]} />
      <View style={[styles.puff, styles.puffShade, styles.shadeB]} />
      <View style={[styles.puff, styles.puffA]} />
      <View style={[styles.puff, styles.puffB]} />
      <View style={[styles.puff, styles.puffC]} />
      <View style={[styles.puff, styles.puffD]} />
      <View style={styles.base} />
    </Animated.View>
  );
}

export function Clouds() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <CloudBlob top={78} left={-8} scale={1.05} drift={16} duration={14000} opacity={0.9} />
      <CloudBlob top={118} left={200} scale={1.25} drift={22} duration={16000} opacity={0.95} />
      <CloudBlob top={168} left={54} scale={0.78} drift={14} duration={12000} opacity={0.85} />
      <CloudBlob top={210} left={250} scale={0.7} drift={12} duration={15000} opacity={0.8} />
    </View>
  );
}

const styles = StyleSheet.create({
  cloud: {
    position: 'absolute',
    width: 110,
    height: 52,
  },
  base: {
    position: 'absolute',
    left: 12,
    right: 14,
    bottom: 8,
    height: 24,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  puff: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },
  puffShade: {
    backgroundColor: 'rgba(210,235,245,0.85)',
  },
  shadeA: { left: 18, top: 18, width: 34, height: 28 },
  shadeB: { left: 48, top: 14, width: 40, height: 30 },
  puffA: { left: 10, top: 12, width: 32, height: 32 },
  puffB: { left: 34, top: 2, width: 42, height: 42 },
  puffC: { left: 66, top: 10, width: 30, height: 30 },
  puffD: { left: 84, top: 16, width: 22, height: 22 },
});
