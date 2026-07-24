import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { GameColors, GameFonts } from '@/constants/gameTheme';

type HighscoreKind = 'normal' | 'today' | 'record';

const LOGO = require('../../assets/images/zone-meter-logo.png');

type MenuView = 'menu' | 'mode' | 'highscores' | 'settings';

type MenuSheetProps = {
  visible: boolean;
  soundOn: boolean;
  hapticsOn: boolean;
  /** Show go-back when a run is in progress or finished */
  canGoBack: boolean;
  dailyMode: boolean;
  highScore: number;
  bestLevel: number;
  dailyTodayScore: number;
  dailyTodayLevel: number;
  dailyRecordScore: number;
  dailyRecordLevel: number;
  dailyRecordDate: string;
  onClose: () => void;
  onToggleSound: () => void;
  onToggleHaptics: () => void;
  onGoBack: () => void;
  onStartMode: (daily: boolean) => void;
  onSendFeedback: () => void;
  onDeleteData: () => void;
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
  destructive,
}: {
  label: string;
  subtitle?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button">
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDanger]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.chevron, destructive && styles.rowLabelDanger]}>›</Text>
    </Pressable>
  );
}

function HighscoreCard({
  badge,
  accent,
  accentDeep,
  score,
  level,
  meta,
  emptyHint,
  hideShare,
  onShare,
}: {
  badge: string;
  accent: string;
  accentDeep: string;
  score: number;
  level: number;
  meta?: string;
  emptyHint: string;
  hideShare?: boolean;
  onShare?: () => void;
}) {
  const empty = score <= 0;
  return (
    <View style={[styles.hsShell, { backgroundColor: accentDeep }]}>
      <View style={[styles.hsFace, { backgroundColor: accent }]}>
        <View style={styles.hsShine} />
        <View style={styles.hsTopRow}>
          <View style={styles.hsBadge}>
            <Text style={styles.hsBadgeText}>{badge}</Text>
          </View>
          {!empty && onShare && !hideShare ? (
            <Pressable
              onPress={onShare}
              style={({ pressed }) => [
                styles.hsShareBtn,
                pressed && styles.closeBtnPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Share ${badge} highscore`}>
              <SymbolView
                name={{
                  ios: 'square.and.arrow.up',
                  android: 'share',
                  web: 'share',
                }}
                size={18}
                tintColor={GameColors.ink}
                weight="bold"
              />
            </Pressable>
          ) : null}
        </View>
        {empty ? (
          <View style={styles.hsEmptyBlock}>
            <Text style={styles.hsEmptyScore}>—</Text>
            <Text style={styles.hsEmptyHint}>{emptyHint}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.hsScore}>{score}</Text>
            <View style={styles.hsFooter}>
              <View style={styles.hsLevelPill}>
                <Text style={styles.hsLevelLabel}>LVL</Text>
                <Text style={styles.hsLevelValue}>{level}</Text>
              </View>
              {meta ? <Text style={styles.hsMeta}>{meta}</Text> : null}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

function ModeRow({
  label,
  subtitle,
  selected,
  onPress,
}: {
  label: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
      </View>
      {selected ? <Text style={styles.selectedMark}>✓</Text> : null}
    </Pressable>
  );
}

export function MenuSheet({
  visible,
  soundOn,
  hapticsOn,
  canGoBack,
  dailyMode,
  highScore,
  bestLevel,
  dailyTodayScore,
  dailyTodayLevel,
  dailyRecordScore,
  dailyRecordLevel,
  dailyRecordDate,
  onClose,
  onToggleSound,
  onToggleHaptics,
  onGoBack,
  onStartMode,
  onSendFeedback,
  onDeleteData,
}: MenuSheetProps) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const sheetH = Math.round(windowH * 0.78);
  const translateY = useSharedValue(sheetH);
  const overlayOpacity = useSharedValue(0);
  const [view, setView] = useState<MenuView>('menu');
  const [sharingKind, setSharingKind] = useState<HighscoreKind | null>(null);
  const normalShareRef = useRef<View>(null);
  const todayShareRef = useRef<View>(null);
  const recordShareRef = useRef<View>(null);
  const version =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  useEffect(() => {
    if (visible) {
      setView('menu');
      // Park off-screen + invisible before springing in so Modal mount can't flash.
      translateY.value = sheetH;
      overlayOpacity.value = 0;
      overlayOpacity.value = withTiming(1, { duration: 180 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 });
    } else {
      translateY.value = sheetH;
      overlayOpacity.value = 0;
    }
  }, [visible, sheetH, translateY, overlayOpacity]);

  const dismiss = () => {
    overlayOpacity.value = withTiming(0, { duration: 180 });
    translateY.value = withTiming(sheetH, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  };

  const confirmDeleteData = () => {
    Alert.alert(
      'Delete all data?',
      'This clears high score, best level, coins, and unlocks. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: onDeleteData,
        },
      ],
    );
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const title =
    view === 'menu'
      ? 'MENU'
      : view === 'mode'
        ? 'PLAY MODE'
        : view === 'highscores'
          ? 'HALL OF FAME'
          : 'SETTINGS';

  const formatDay = (iso: string) =>
    new Date(iso + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const recordMeta =
    dailyRecordDate.length > 0 ? formatDay(dailyRecordDate) : undefined;

  const shareCaption = 'Can you top that?';

  const shareHighscore = async (kind: HighscoreKind) => {
    if (sharingKind) return;
    const message = shareCaption;
    const target =
      kind === 'normal'
        ? normalShareRef.current
        : kind === 'today'
          ? todayShareRef.current
          : recordShareRef.current;

    setSharingKind(kind);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 60));
      if (!target) {
        await Share.share({ message });
        return;
      }
      const uri = await captureRef(target, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (Platform.OS === 'ios') {
        await Share.share({ message, url: uri });
        return;
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: message,
          UTI: 'public.png',
        });
        return;
      }
      await Share.share({ message });
    } catch {
      Alert.alert('Share failed', 'Could not create the share image.');
    } finally {
      setSharingKind(null);
    }
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
      overlayOpacity.value = Math.max(0, 1 - e.translationY / sheetH);
    })
    .onEnd((e) => {
      const shouldClose = e.translationY > 110 || e.velocityY > 900;
      if (shouldClose) {
        overlayOpacity.value = withTiming(0, { duration: 160 });
        translateY.value = withTiming(sheetH, { duration: 200 }, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        overlayOpacity.value = withTiming(1, { duration: 160 });
        translateY.value = withSpring(0, { damping: 22, stiffness: 240 });
      }
    });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={view === 'menu' ? dismiss : () => setView('menu')}
      statusBarTranslucent>
      <GestureHandlerRootView style={styles.overlayRoot}>
        <Animated.View style={[styles.overlay, styles.overlayHidden, overlayStyle]}>
          <Pressable
            style={styles.dismissArea}
            onPress={dismiss}
            accessibilityLabel="Dismiss menu"
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
              {view !== 'menu' ? (
                <Pressable
                  onPress={() => setView('menu')}
                  style={({ pressed }) => [styles.backBtn, pressed && styles.closeBtnPressed]}
                  hitSlop={10}
                  accessibilityLabel="Back">
                  <Text style={styles.backBtnText}>‹</Text>
                </Pressable>
              ) : null}
              <Text style={[styles.title, view === 'menu' && styles.titleRoot]}>{title}</Text>
              <Pressable
                onPress={dismiss}
                style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
                hitSlop={10}
                accessibilityLabel="Close">
                <Text style={styles.closeBtnText}>DONE</Text>
              </Pressable>
            </View>

            <View style={styles.body}>
              {view === 'menu' ? (
                <>
                  {canGoBack ? (
                    <Pressable
                      onPress={onGoBack}
                      style={({ pressed }) => [
                        styles.startOverBtn,
                        pressed && styles.closeBtnPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Go back">
                      <Text style={styles.startOverBtnText}>GO BACK</Text>
                    </Pressable>
                  ) : null}

                  <View style={styles.card}>
                    <ActionRow
                      label="Play mode"
                      subtitle={dailyMode ? 'Daily challenge' : 'Normal run'}
                      onPress={() => setView('mode')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label="Hall of fame"
                      subtitle="Normal, today & best daily"
                      onPress={() => setView('highscores')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label="Settings"
                      subtitle="Sound, haptics & data"
                      onPress={() => setView('settings')}
                    />
                    <View style={styles.divider} />
                    <ActionRow
                      label="Send feedback"
                      subtitle="Ideas, bugs, or love notes"
                      onPress={onSendFeedback}
                    />
                  </View>
                </>
              ) : null}

              {view === 'mode' ? (
                <View style={styles.card}>
                  <ModeRow
                    label="Normal"
                    subtitle="Classic endless run"
                    selected={!dailyMode}
                    onPress={() => onStartMode(false)}
                  />
                  <View style={styles.divider} />
                  <ModeRow
                    label="Daily"
                    subtitle="Same sequence for everyone · updates daily"
                    selected={dailyMode}
                    onPress={() => onStartMode(true)}
                  />
                </View>
              ) : null}

              {view === 'highscores' ? (
                <ScrollView
                  style={styles.hsScroll}
                  contentContainerStyle={styles.hsList}
                  showsVerticalScrollIndicator={false}>
                  <View
                    ref={normalShareRef}
                    collapsable={false}
                    style={[
                      styles.hsCapture,
                      sharingKind === 'normal' && styles.hsCaptureShot,
                    ]}>
                    {sharingKind === 'normal' ? (
                      <Image
                        source={LOGO}
                        style={styles.hsLogo}
                        contentFit="contain"
                      />
                    ) : null}
                    <HighscoreCard
                      badge="NORMAL"
                      accent={GameColors.xpGold}
                      accentDeep="#D97706"
                      score={highScore}
                      level={bestLevel}
                      emptyHint="Beat the meter. Own the board."
                      hideShare={sharingKind === 'normal'}
                      onShare={() => void shareHighscore('normal')}
                    />
                  </View>
                  <View
                    ref={todayShareRef}
                    collapsable={false}
                    style={[
                      styles.hsCapture,
                      sharingKind === 'today' && styles.hsCaptureShot,
                    ]}>
                    {sharingKind === 'today' ? (
                      <Image
                        source={LOGO}
                        style={styles.hsLogo}
                        contentFit="contain"
                      />
                    ) : null}
                    <HighscoreCard
                      badge="TODAY"
                      accent={GameColors.playBlue}
                      accentDeep={GameColors.playBlueDark}
                      score={dailyTodayScore}
                      level={dailyTodayLevel}
                      emptyHint="Same challenge for everyone. Go!"
                      hideShare={sharingKind === 'today'}
                      onShare={() => void shareHighscore('today')}
                    />
                  </View>
                  <View
                    ref={recordShareRef}
                    collapsable={false}
                    style={[
                      styles.hsCapture,
                      sharingKind === 'record' && styles.hsCaptureShot,
                    ]}>
                    {sharingKind === 'record' ? (
                      <Image
                        source={LOGO}
                        style={styles.hsLogo}
                        contentFit="contain"
                      />
                    ) : null}
                    <HighscoreCard
                      badge="BEST DAILY"
                      accent={GameColors.bubble}
                      accentDeep={GameColors.bubbleDark}
                      score={dailyRecordScore}
                      level={dailyRecordLevel}
                      meta={recordMeta}
                      emptyHint="Your greatest daily still awaits."
                      hideShare={sharingKind === 'record'}
                      onShare={() => void shareHighscore('record')}
                    />
                  </View>
                </ScrollView>
              ) : null}

              {view === 'settings' ? (
                <>
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
                      label="Delete data"
                      subtitle="High score, progress & unlocks"
                      onPress={confirmDeleteData}
                      destructive
                    />
                  </View>
                </>
              ) : null}
            </View>

            <Text style={styles.version}>Zone Meter · v{version}</Text>
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(26,28,44,0.5)',
  },
  // Static until Reanimated binds — prevents a one-frame fully-opaque flash.
  overlayHidden: {
    opacity: 0,
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
    gap: 8,
  },
  title: {
    flex: 1,
    fontFamily: GameFonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: GameColors.ink,
  },
  titleRoot: {
    fontSize: 34,
    lineHeight: 38,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: GameColors.white,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontFamily: GameFonts.display,
    fontSize: 32,
    lineHeight: 34,
    color: GameColors.ink,
    marginTop: -2,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: GameColors.playBlue,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
  },
  closeBtnPressed: {
    transform: [{ translateY: 2 }],
  },
  closeBtnText: {
    fontFamily: GameFonts.body,
    fontSize: 13,
    color: GameColors.white,
  },
  startOverBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: GameColors.playBlue,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
  },
  startOverBtnText: {
    fontFamily: GameFonts.body,
    fontSize: 18,
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
  rowSelected: {
    backgroundColor: 'rgba(28,176,246,0.14)',
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
  rowLabelDanger: {
    color: GameColors.scoreBad,
  },
  rowSub: {
    fontFamily: GameFonts.soft,
    fontSize: 14,
    lineHeight: 18,
    color: GameColors.panelInk,
  },
  hsScroll: {
    flex: 1,
  },
  hsList: {
    gap: 14,
    paddingBottom: 8,
  },
  hsCapture: {
    backgroundColor: '#E8F7FF',
    borderRadius: 24,
    gap: 12,
    alignItems: 'center',
  },
  hsCaptureShot: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  hsLogo: {
    width: 160,
    height: 72,
  },
  hsShell: {
    alignSelf: 'stretch',
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingBottom: 5,
  },
  hsFace: {
    borderRadius: 19,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 8,
    overflow: 'hidden',
  },
  hsShine: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 10,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  hsBadge: {
    alignSelf: 'flex-start',
    backgroundColor: GameColors.white,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hsTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  hsShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: GameColors.white,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hsBadgeText: {
    fontFamily: GameFonts.body,
    fontSize: 14,
    lineHeight: 18,
    color: GameColors.ink,
    letterSpacing: 0.6,
  },
  hsScore: {
    fontFamily: GameFonts.display,
    fontSize: 56,
    lineHeight: 60,
    color: GameColors.ink,
    marginTop: 2,
  },
  hsEmptyBlock: {
    gap: 4,
    paddingVertical: 4,
  },
  hsEmptyScore: {
    fontFamily: GameFonts.display,
    fontSize: 48,
    lineHeight: 52,
    color: 'rgba(26,28,44,0.35)',
  },
  hsEmptyHint: {
    fontFamily: GameFonts.soft,
    fontSize: 15,
    lineHeight: 20,
    color: GameColors.ink,
    maxWidth: '92%',
  },
  hsFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  hsLevelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: GameColors.white,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  hsLevelLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 12,
    lineHeight: 14,
    color: GameColors.panelInk,
  },
  hsLevelValue: {
    fontFamily: GameFonts.body,
    fontSize: 16,
    lineHeight: 18,
    color: GameColors.ink,
  },
  hsMeta: {
    fontFamily: GameFonts.body,
    fontSize: 15,
    lineHeight: 18,
    color: GameColors.ink,
  },
  selectedMark: {
    fontFamily: GameFonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: GameColors.playBlue,
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
