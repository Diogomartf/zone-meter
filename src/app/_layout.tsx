import {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

/** How long the branded splash art stays after fonts are ready (Expo Go / Dev Client). */
const SPLASH_HOLD_MS = 1100;
const SPLASH_FADE_MS = 380;

export default function RootLayout() {
  const [ready] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const [overlayMounted, setOverlayMounted] = useState(true);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    if (!ready) return;

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    void SplashScreen.hideAsync().finally(() => {
      if (cancelled) return;
      // Hold the full splash art so Expo Go still shows branding
      // (native custom splash only works in preview/production builds).
      fadeTimer = setTimeout(() => {
        overlayOpacity.value = withTiming(0, { duration: SPLASH_FADE_MS }, (finished) => {
          if (finished) runOnJS(setOverlayMounted)(false);
        });
      }, SPLASH_HOLD_MS);
    });

    return () => {
      cancelled = true;
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [overlayOpacity, ready]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {ready ? <Stack screenOptions={{ headerShown: false, animation: 'fade' }} /> : null}
      {overlayMounted ? (
        <Animated.View style={[styles.splash, overlayStyle]} pointerEvents="none">
          <Image
            source={require('@/assets/images/splash.png')}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            priority="high"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0290FC' },
  splash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 100,
  },
});
