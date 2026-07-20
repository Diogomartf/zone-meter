import Constants from 'expo-constants';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameColors, GameFonts } from '@/constants/gameTheme';

type SettingsSheetProps = {
  visible: boolean;
  soundOn: boolean;
  hapticsOn: boolean;
  onClose: () => void;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
  onSendFeedback: () => void;
};

function ToggleRow({
  label,
  subtitle,
  value,
  onPress,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <View style={[styles.toggle, value ? styles.toggleOn : styles.toggleOff]}>
        <Text style={styles.toggleText}>{value ? 'ON' : 'OFF'}</Text>
      </View>
    </Pressable>
  );
}

function ActionRow({
  label,
  subtitle,
  onPress,
}: {
  label: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button">
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function SettingsSheet({
  visible,
  soundOn,
  hapticsOn,
  onClose,
  onToggleSound,
  onToggleHaptics,
  onSendFeedback,
}: SettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const sheetH = Math.round(windowH * 0.78);
  const translateY = useSharedValue(sheetH);
  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 });
    } else {
      translateY.value = sheetH;
    }
  }, [visible, sheetH, translateY]);

  const dismiss = () => {
    translateY.value = withTiming(sheetH, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const shouldClose = e.translationY > 110 || e.velocityY > 900;
      if (shouldClose) {
        translateY.value = withTiming(sheetH, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 240 });
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent>
      <GestureHandlerRootView style={styles.overlay}>
        <Pressable
          style={styles.dismissArea}
          onPress={dismiss}
          accessibilityLabel="Dismiss settings"
        />
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              {
                height: sheetH,
                paddingBottom: Math.max(insets.bottom, 18) + 10,
              },
              sheetStyle,
            ]}>
            <View style={styles.handleHit}>
              <View style={styles.handle} />
            </View>

            <View style={styles.header}>
              <Text style={styles.title}>SETTINGS</Text>
              <Pressable
                onPress={dismiss}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                hitSlop={10}
                accessibilityLabel="Close">
                <Text style={styles.closeBtnText}>DONE</Text>
              </Pressable>
            </View>

            <View style={styles.body}>
              <View style={styles.card}>
                <ToggleRow
                  label="Sound"
                  subtitle="Effects & countdown ticks"
                  value={soundOn}
                  onPress={onToggleSound}
                />
                <View style={styles.divider} />
                <ToggleRow
                  label="Haptics"
                  subtitle="Vibration on taps & results"
                  value={hapticsOn}
                  onPress={onToggleHaptics}
                />
              </View>

              <View style={styles.card}>
                <ActionRow
                  label="Send feedback"
                  subtitle="Ideas, bugs, or love notes"
                  onPress={onSendFeedback}
                />
              </View>
            </View>

            <Text style={styles.version}>Zone Meter · v{version}</Text>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26,28,44,0.5)',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#E8F7FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: GameColors.ink,
    paddingHorizontal: 20,
    paddingTop: 6,
    gap: 18,
  },
  handleHit: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  handle: {
    width: 52,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(26,28,44,0.22)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: GameFonts.display,
    fontSize: 34,
    lineHeight: 38,
    color: GameColors.ink,
  },
  closeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: GameColors.playBlue,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
  },
  closeBtnPressed: {
    transform: [{ translateY: 2 }],
  },
  closeBtnText: {
    fontFamily: GameFonts.body,
    fontSize: 15,
    color: GameColors.white,
  },
  body: {
    flex: 1,
    gap: 16,
  },
  card: {
    backgroundColor: GameColors.white,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  rowPressed: {
    backgroundColor: 'rgba(28,176,246,0.12)',
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowLabel: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    lineHeight: 24,
    color: GameColors.ink,
  },
  rowSub: {
    fontFamily: GameFonts.soft,
    fontSize: 14,
    lineHeight: 18,
    color: GameColors.panelInk,
  },
  toggle: {
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    alignItems: 'center',
  },
  toggleOn: {
    backgroundColor: GameColors.bubble,
  },
  toggleOff: {
    backgroundColor: '#D1D5DB',
  },
  toggleText: {
    fontFamily: GameFonts.body,
    fontSize: 14,
    color: GameColors.ink,
  },
  chevron: {
    fontFamily: GameFonts.display,
    fontSize: 30,
    lineHeight: 32,
    color: GameColors.ink,
    marginTop: -2,
  },
  divider: {
    height: 2,
    backgroundColor: 'rgba(26,28,44,0.08)',
    marginHorizontal: 18,
  },
  version: {
    fontFamily: GameFonts.soft,
    fontSize: 13,
    textAlign: 'center',
    color: GameColors.panelInk,
    marginTop: 'auto',
  },
});
