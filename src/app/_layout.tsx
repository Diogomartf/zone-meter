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
import { StatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 450, fade: true });

export default function RootLayout() {
  const [ready] = useFonts({
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
  });
  const [overlayVisible, setOverlayVisible] = useState(true);

  useEffect(() => {
    if (!ready) return;
    void SplashScreen.hideAsync().finally(() => {
      // Keep the matching full-bleed art up briefly so Android (no native
      // full-screen splash) and font load never flash a blank frame.
      requestAnimationFrame(() => setOverlayVisible(false));
    });
  }, [ready]);

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {ready ? <Stack screenOptions={{ headerShown: false, animation: 'fade' }} /> : null}
      {overlayVisible ? (
        <View style={styles.splash} pointerEvents="none">
          <Image
            source={require('@/assets/images/splash.png')}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#2B8FFF' },
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
});

