import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameColors, GameFonts } from '@/constants/gameTheme';
import { CountdownBurst } from '@/game/CountdownBurst';
import { Hearts } from '@/game/Hearts';
import { gameHaptics } from '@/game/haptics';
import { createRng, makeRound } from '@/game/levels';
import { comboMultiplier, scoreFill, STARTING_LIVES } from '@/game/scoring';
import { DEFAULT_SKIN, SKINS } from '@/game/skins';
import {
  commitRunResult,
  dailySeed,
  loadPersist,
  setSoundMuted,
  todayKey,
} from '@/game/storage';
import type {
  PersistState,
  RoundConfig,
  RoundLabel,
  RoundOutcome,
  SessionStats,
} from '@/game/types';
import { useSounds } from '@/game/useSounds';
import { VerticalMeter } from '@/game/VerticalMeter';

const LOGO = require('../../assets/images/zone-meter-logo.png');
const GAME_BG = require('../../assets/images/game-bg.png');

/** Yellow pad surface in game-bg.png (fraction of image height from top). */
const PAD_SURFACE_Y = 0.905;
const METER_BASE_H = 340;
const METER_WRAP_EXTRA = 28;

type Phase = 'ready' | 'countdown' | 'filling' | 'result' | 'gameover';

/** Callouts sit beside / near the meter top — never dead-center above it */
type FeedbackSlot = 'left' | 'right' | 'topLeft' | 'topRight';

type Feedback = {
  label: RoundLabel;
  points: number;
  combo: number;
  comboGrew: boolean;
  slot: FeedbackSlot;
};

const FEEDBACK_SLOTS: FeedbackSlot[] = ['left', 'right', 'topLeft', 'topRight'];

function nextFeedbackSlot(prev: FeedbackSlot | null): FeedbackSlot {
  const pool = prev ? FEEDBACK_SLOTS.filter((s) => s !== prev) : FEEDBACK_SLOTS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

const FEEDBACK_SLOT_STYLE: Record<
  FeedbackSlot,
  { top: `${number}%`; left?: number; right?: number; alignItems: 'flex-start' | 'flex-end' }
> = {
  left: { top: '44%', left: 10, alignItems: 'flex-start' },
  right: { top: '44%', right: 10, alignItems: 'flex-end' },
  topLeft: { top: '30%', left: 10, alignItems: 'flex-start' },
  topRight: { top: '30%', right: 10, alignItems: 'flex-end' },
};

const emptyStats = (): SessionStats => ({
  attempts: 0,
  hits: 0,
  perfects: 0,
  misses: 0,
  bestCombo: 0,
  coinsEarned: 0,
});

const LABEL_COLORS: Record<RoundLabel, string> = {
  Perfect: '#FF3B4A',
  Great: '#FF8A00',
  Good: '#58CC02',
  Nice: '#1CB0F6',
  Close: '#FFC800',
  Miss: '#6B7280',
};

type GameCtaProps = {
  label: string;
  subtitle?: string;
  face: string;
  depth: string;
  onPress: () => void;
};

/** Chunky casual-game CTA — 3D lip + press squash */
function GameCta({ label, subtitle, face, depth, onPress }: GameCtaProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ctaPressable, pressed && styles.ctaPressableDown]}>
      {({ pressed }) => (
        <View style={[styles.ctaShell, { backgroundColor: depth }]}>
          <View
            style={[
              styles.ctaFace,
              { backgroundColor: face },
              pressed ? styles.ctaFaceDown : styles.ctaFaceUp,
            ]}>
            <View style={styles.ctaShine} />
            <Text style={styles.ctaText}>{label}</Text>
            {subtitle ? <Text style={styles.ctaSub}>{subtitle}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const [persist, setPersist] = useState<PersistState | null>(null);
  const muted = Boolean(persist?.soundMuted);
  const { play } = useSounds(muted);

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState<RoundConfig>(() => makeRound(1));
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [combo, setCombo] = useState(0);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [dailyMode, setDailyMode] = useState(false);
  const [stats, setStats] = useState<SessionStats>(emptyStats);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackSlotRef = useRef<FeedbackSlot | null>(null);

  const fill = useSharedValue(0);
  const zoneTarget = useSharedValue(round.target);
  const zoneHalf = useSharedValue(round.zoneHalf);
  const meterX = useSharedValue(0);
  const feedbackOpacity = useSharedValue(0);
  const feedbackScale = useSharedValue(0.7);
  const comboPulse = useSharedValue(1);
  const isFilling = useSharedValue(0);

  const phaseRef = useRef<Phase>('ready');
  const roundRef = useRef(round);
  const scoreRef = useRef(0);
  const livesRef = useRef(STARTING_LIVES);
  const comboRef = useRef(0);
  const lockingTap = useRef(false);
  const rngRef = useRef<() => number>(Math.random);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceRef = useRef<() => void>(() => {});

  const skin = SKINS[persist?.equippedSkin ?? DEFAULT_SKIN];

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    roundRef.current = round;
    zoneTarget.value = round.target;
    zoneHalf.value = round.zoneHalf;
  }, [round, zoneHalf, zoneTarget]);
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    livesRef.current = lives;
  }, [lives]);
  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    void loadPersist().then(setPersist);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
      if (countTimer.current) clearTimeout(countTimer.current);
    };
  }, []);

  const showFeedback = (next: Omit<Feedback, 'slot'>) => {
    const slot = nextFeedbackSlot(feedbackSlotRef.current);
    feedbackSlotRef.current = slot;
    setFeedback({ ...next, slot });
    feedbackOpacity.value = 0;
    feedbackScale.value = 0.55;
    feedbackOpacity.value = withSequence(
      withTiming(1, { duration: 90 }),
      withDelay(520, withTiming(0, { duration: 260 })),
    );
    feedbackScale.value = withSequence(
      withTiming(1.18, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 160, easing: Easing.inOut(Easing.quad) }),
    );
    if (next.comboGrew && next.combo > 0) {
      comboPulse.value = withSequence(
        withTiming(1.22, { duration: 120, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) }),
      );
    }
  };

  const endRun = useCallback(
    async (finalScore: number, session: SessionStats) => {
      const next = await commitRunResult({
        score: finalScore,
        coinsEarned: session.coinsEarned,
        bestCombo: session.bestCombo,
        bestLevel: roundRef.current.level,
        isDaily: dailyMode,
      });
      setPersist(next);
      setIsNewBest(finalScore > 0 && finalScore >= next.highScore);
      setPhase('gameover');
      phaseRef.current = 'gameover';
    },
    [dailyMode],
  );

  const finishRound = useCallback(
    (value: number) => {
      const current = roundRef.current;
      const prevCombo = comboRef.current;
      const result = scoreFill(value, current, prevCombo);
      setOutcome(result);
      setCombo(result.combo);
      comboRef.current = result.combo;
      isFilling.value = 0;
      void gameHaptics.result(result.label === 'Close' ? 'Nice' : result.label);

      showFeedback({
        label: result.label,
        points: result.points,
        combo: result.combo,
        comboGrew: result.combo > prevCombo,
      });

      setStats((s) => {
        const next: SessionStats = {
          ...s,
          attempts: s.attempts + 1,
          hits: result.result === 'miss' ? s.hits : s.hits + 1,
          perfects: result.result === 'perfect' ? s.perfects + 1 : s.perfects,
          misses: result.costsLife ? s.misses + 1 : s.misses,
          bestCombo: Math.max(s.bestCombo, result.combo),
          coinsEarned: s.coinsEarned + result.coins,
        };

        if (result.costsLife) {
          play('miss');
          const livesLeft = livesRef.current - 1;
          setLives(livesLeft);
          livesRef.current = livesLeft;
          setPhase('result');
          phaseRef.current = 'result';
          if (livesLeft <= 0) {
            void endRun(scoreRef.current, next);
          } else {
            // Continue run — next meter, no retry UI
            if (autoTimer.current) clearTimeout(autoTimer.current);
            autoTimer.current = setTimeout(() => advanceRef.current(), 420);
          }
          return next;
        }

        play(result.result === 'perfect' ? 'perfect' : 'zone');
        setScore((sc) => sc + result.points);
        scoreRef.current += result.points;
        setPhase('result');
        phaseRef.current = 'result';

        if (autoTimer.current) clearTimeout(autoTimer.current);
        autoTimer.current = setTimeout(() => advanceRef.current(), result.result === 'perfect' ? 380 : 480);
        return next;
      });
    },
    [endRun, isFilling, play],
  );

  const startFill = useCallback(() => {
    const current = roundRef.current;
    setOutcome(null);
    setFeedback(null);
    feedbackOpacity.value = 0;
    setPhase('filling');
    phaseRef.current = 'filling';
    isFilling.value = 1;
    zoneTarget.value = current.target;
    zoneHalf.value = current.zoneHalf;
    fill.value = 0;
    play('start');
    void gameHaptics.start();

    if (current.moving && current.targetEnd != null) {
      zoneTarget.value = withTiming(current.targetEnd, {
        duration: current.fillMs,
        easing: Easing.inOut(Easing.sin),
      });
    }
    if (current.shrinking && current.zoneHalfEnd != null) {
      zoneHalf.value = withTiming(current.zoneHalfEnd, {
        duration: current.fillMs,
        easing: Easing.linear,
      });
    }

    fill.value = withTiming(
      1,
      { duration: current.fillMs, easing: Easing.bezier(0.2, 0.05, 0.35, 1) },
      (finished) => {
        if (finished) runOnJS(finishRound)(1);
      },
    );
  }, [fill, finishRound, isFilling, play, zoneHalf, zoneTarget]);

  const beginRound = useCallback(
    (next: RoundConfig, animateIn: boolean) => {
      setRound(next);
      roundRef.current = next;
      fill.value = 0;
      zoneTarget.value = next.target;
      zoneHalf.value = next.zoneHalf;
      setOutcome(null);

      if (animateIn) {
        meterX.value = 340;
        meterX.value = withTiming(0, {
          duration: 340,
          easing: Easing.out(Easing.cubic),
        });
      } else {
        meterX.value = 0;
      }

      // Only countdown on the very first meter of a run
      if (next.level === 1) {
        setPhase('countdown');
        phaseRef.current = 'countdown';
        setCountdown(3);
        play('tick');
        void gameHaptics.countdownTick(3);

        // 3 → 2 → 1 → GO! with rising energy
        const beats = [2, 1, 0] as const;
        let i = 0;
        const tick = () => {
          const n = beats[i];
          i += 1;
          setCountdown(n);
          if (n > 0) {
            play('tick');
            void gameHaptics.countdownTick(n);
            countTimer.current = setTimeout(tick, 560);
            return;
          }
          // GO!
          play('start');
          void gameHaptics.countdownTick(0);
          countTimer.current = setTimeout(() => {
            startFill();
          }, 520);
        };
        countTimer.current = setTimeout(tick, 560);
      } else {
        startFill();
      }
    },
    [fill, meterX, play, startFill, zoneHalf, zoneTarget],
  );

  const spawnNextLevel = useCallback(() => {
    const next = makeRound(roundRef.current.level + 1, {
      previousTarget: roundRef.current.target,
      rng: rngRef.current,
    });
    beginRound(next, true);
  }, [beginRound]);

  const advanceLevel = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    // Slide current meter out, then bring next in
    meterX.value = withTiming(-360, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) {
        runOnJS(spawnNextLevel)();
      }
    });
  }, [meterX, spawnNextLevel]);

  useEffect(() => {
    advanceRef.current = advanceLevel;
  }, [advanceLevel]);

  const onZoneEnter = useCallback(() => {
    void gameHaptics.zoneEnter();
  }, []);

  useAnimatedReaction(
    () => fill.value,
    (value, prev) => {
      if (isFilling.value !== 1 || prev == null) return;
      const low = zoneTarget.value - zoneHalf.value;
      if (prev < low && value >= low) runOnJS(onZoneEnter)();
    },
    [onZoneEnter],
  );

  const startRun = (daily: boolean) => {
    if (countTimer.current) clearTimeout(countTimer.current);
    if (autoTimer.current) clearTimeout(autoTimer.current);
    setDailyMode(daily);
    rngRef.current = daily ? createRng(dailySeed()) : Math.random;
    setScore(0);
    scoreRef.current = 0;
    setLives(STARTING_LIVES);
    livesRef.current = STARTING_LIVES;
    setCombo(0);
    comboRef.current = 0;
    setStats(emptyStats());
    setIsNewBest(false);
    setFeedback(null);
    feedbackOpacity.value = 0;
    beginRound(makeRound(1, { rng: rngRef.current }), false);
  };

  const onTap = () => {
    if (lockingTap.current) return;
    const p = phaseRef.current;
    if (p === 'countdown' || p === 'ready' || p === 'result') return;

    if (p === 'filling') {
      lockingTap.current = true;
      // Freeze fill exactly where it is — no cancel jump / meter flick
      const stoppedAt = fill.value;
      cancelAnimation(fill);
      cancelAnimation(zoneTarget);
      cancelAnimation(zoneHalf);
      fill.value = stoppedAt;
      isFilling.value = 0;
      play('tap');
      void gameHaptics.stop();
      finishRound(stoppedAt);
      requestAnimationFrame(() => {
        lockingTap.current = false;
      });
    }
  };

  const toggleMute = async () => {
    const next = await setSoundMuted(!muted);
    setPersist(next);
  };

  const meterStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: meterX.value }],
  }));
  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: feedbackOpacity.value,
    transform: [{ scale: feedbackScale.value }],
  }));
  const comboBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: comboPulse.value }],
  }));

  const accuracy =
    stats.attempts > 0 ? Math.round((stats.hits / stats.attempts) * 100) : 0;

  const hitEnabled = phase === 'filling';
  const meterScale = round.meterScale;
  const meterWrapH = METER_BASE_H * meterScale + METER_WRAP_EXTRA;
  // Pin meter base to the yellow pad in the background art
  const meterBottom = Math.max(insets.bottom + 4, windowH * (1 - PAD_SURFACE_Y));
  const menuBottom = meterBottom + meterWrapH * 0.42;

  return (
    <View style={styles.root}>
      <View style={styles.backdrop} pointerEvents="none">
        <Image
          source={GAME_BG}
          style={styles.backdropImage}
          contentFit="cover"
          contentPosition="center"
          priority="high"
          cachePolicy="memory-disk"
          recyclingKey="game-bg-v2"
        />
      </View>

      <View
        style={[
          styles.meterAnchor,
          {
            bottom: meterBottom,
            height: meterWrapH,
          },
          phase === 'gameover' && styles.meterDimmed,
        ]}
        pointerEvents="none">
        <Animated.View style={meterStyle}>
          <VerticalMeter
            fill={fill}
            zoneTarget={zoneTarget}
            zoneHalf={zoneHalf}
            skin={skin}
            scale={meterScale}
          />
        </Animated.View>
      </View>

      <View
        style={[styles.content, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
        collapsable={false}>
        <View style={styles.topBlock} pointerEvents="box-none">
          <View style={styles.topRow} pointerEvents="box-none">
            <View style={styles.topLeft} pointerEvents="none">
              <Image source={LOGO} style={styles.logoHud} contentFit="contain" />
              {phase !== 'ready' && phase !== 'gameover' ? (
                <Hearts lives={lives} max={STARTING_LIVES} />
              ) : null}
            </View>

            <Pressable style={styles.iconBtn} onPress={() => void toggleMute()} hitSlop={10}>
              <Text style={styles.iconBtnText}>{muted ? '🔇' : '🔊'}</Text>
            </Pressable>
          </View>

          <View style={styles.bestPill} pointerEvents="none">
            <Text style={styles.bestLabel}>{dailyMode ? 'DAILY' : 'BEST'}</Text>
            <Text style={styles.bestValue}>
              {dailyMode
                ? persist?.dailyBest.date === todayKey()
                  ? persist.dailyBest.score
                  : 0
                : (persist?.highScore ?? 0)}
            </Text>
            {!dailyMode ? (
              <Text style={styles.bestSub}>LVL {persist?.bestLevel ?? 0}</Text>
            ) : null}
          </View>
        </View>

        {phase !== 'ready' ? (
          <View style={styles.statsBlock} pointerEvents="none">
            <Text style={styles.bigScore}>{score}</Text>
            {phase === 'gameover' ? (
              <View style={styles.runStats}>
                <View style={styles.runStat}>
                  <Text style={styles.runStatLabel}>ACC</Text>
                  <Text style={styles.runStatValue}>{accuracy}%</Text>
                </View>
                <View style={styles.runStatDivider} />
                <View style={styles.runStat}>
                  <Text style={styles.runStatLabel}>COMBO</Text>
                  <Text style={styles.runStatValue}>{stats.bestCombo}</Text>
                </View>
                <View style={styles.runStatDivider} />
                <View style={styles.runStat}>
                  <Text style={styles.runStatLabel}>LVL</Text>
                  <Text style={styles.runStatValue}>{round.level}</Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.metaLine}>LVL {round.level}</Text>
                {combo > 1 ? (
                  <Animated.View style={[styles.comboBadge, comboBadgeStyle]}>
                    <Text style={styles.comboBadgeLabel}>COMBO</Text>
                    <Text style={styles.comboBadgeValue}>
                      x{combo} · {comboMultiplier(combo).toFixed(2)}
                    </Text>
                  </Animated.View>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        <Animated.View
          style={[
            styles.feedback,
            feedback ? FEEDBACK_SLOT_STYLE[feedback.slot] : null,
            feedbackStyle,
            phase === 'gameover' && styles.hidden,
          ]}
          pointerEvents="none">
          {feedback ? (
            <>
              <Text
                style={[
                  styles.feedbackLabel,
                  { color: LABEL_COLORS[feedback.label] },
                  (feedback.slot === 'left' || feedback.slot === 'topLeft') && styles.feedbackAlignStart,
                  (feedback.slot === 'right' || feedback.slot === 'topRight') && styles.feedbackAlignEnd,
                ]}>
                {feedback.label.toUpperCase()}!
              </Text>
              {feedback.points > 0 ? (
                <Text
                  style={[
                    styles.feedbackPoints,
                    (feedback.slot === 'left' || feedback.slot === 'topLeft') && styles.feedbackAlignStart,
                    (feedback.slot === 'right' || feedback.slot === 'topRight') && styles.feedbackAlignEnd,
                  ]}>
                  +{feedback.points}
                </Text>
              ) : null}
              {feedback.comboGrew && feedback.combo > 1 ? (
                <Text
                  style={[
                    styles.feedbackCombo,
                    (feedback.slot === 'left' || feedback.slot === 'topLeft') && styles.feedbackAlignStart,
                    (feedback.slot === 'right' || feedback.slot === 'topRight') && styles.feedbackAlignEnd,
                  ]}>
                  COMBO x{feedback.combo}
                </Text>
              ) : null}
            </>
          ) : null}
        </Animated.View>

        <CountdownBurst value={countdown} visible={phase === 'countdown'} />

        {phase === 'gameover' ? (
          <View style={styles.gameOverPanel} pointerEvents="box-none">
            <Text
              style={[styles.gameOverTitle, isNewBest && styles.gameOverTitleBest]}
              pointerEvents="none">
              {isNewBest ? 'NEW BEST!' : 'GAME OVER'}
            </Text>
            <GameCta
              label="RETRY"
              face={isNewBest ? GameColors.bubble : GameColors.playBlue}
              depth={isNewBest ? GameColors.bubbleDark : GameColors.playBlueDark}
              onPress={() => {
                void gameHaptics.next();
                startRun(dailyMode);
              }}
            />
          </View>
        ) : null}

        {phase === 'ready' ? (
          <View style={[styles.menuCol, { bottom: menuBottom }]} pointerEvents="box-none">
            <GameCta
              label="PLAY"
              subtitle="TAP THE ZONE"
              face="#FFC800"
              depth="#D97706"
              onPress={() => startRun(false)}
            />
            <GameCta
              label="DAILY"
              subtitle="ONE RUN · SHARED SEED"
              face={GameColors.bubble}
              depth={GameColors.bubbleDark}
              onPress={() => startRun(true)}
            />
          </View>
        ) : null}
      </View>

      {hitEnabled ? (
        <Pressable
          style={styles.hitLayer}
          onPressIn={onTap}
          accessibilityRole="button"
          android_ripple={{ color: 'transparent' }}
        />
      ) : null}
    </View>
  );
}

const fillParent = {
  position: 'absolute' as const,
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E8CFF' },
  backdrop: {
    ...fillParent,
    zIndex: 0,
  },
  backdropImage: {
    width: '100%',
    height: '100%',
  },
  hitLayer: {
    ...fillParent,
    zIndex: 20,
  },
  content: {
    ...fillParent,
    paddingHorizontal: 20,
    zIndex: 30,
    elevation: 30,
  },
  topBlock: {
    width: '100%',
    gap: 6,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 40,
  },
  topLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
  logoHud: {
    width: 148,
    height: 78,
    marginLeft: -6,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GameColors.playBlue,
    borderWidth: 2,
    borderColor: GameColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: { fontSize: 16 },
  bestPill: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    backgroundColor: '#FFF4C2',
    alignItems: 'center',
    minWidth: 72,
  },
  bestLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 12,
    color: GameColors.panelInk,
  },
  bestValue: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    lineHeight: 24,
    color: GameColors.ink,
  },
  bestSub: {
    fontFamily: GameFonts.soft,
    fontSize: 11,
    color: GameColors.panelInk,
    marginTop: 1,
  },
  statsBlock: { marginTop: 2, alignItems: 'center' },
  bigScore: {
    fontFamily: GameFonts.display,
    fontSize: 52,
    lineHeight: 56,
    color: GameColors.white,
    textShadowColor: 'rgba(26,28,44,0.4)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 0,
  },
  metaLine: {
    fontFamily: GameFonts.body,
    fontSize: 15,
    color: GameColors.ink,
  },
  runStats: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 12,
  },
  runStat: {
    alignItems: 'center',
    minWidth: 52,
  },
  runStatLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 11,
    color: GameColors.panelInk,
    letterSpacing: 0.6,
  },
  runStatValue: {
    fontFamily: GameFonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: GameColors.ink,
  },
  runStatDivider: {
    width: 2,
    height: 28,
    borderRadius: 1,
    backgroundColor: 'rgba(26,28,44,0.15)',
  },
  comboBadge: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: GameColors.ink,
    backgroundColor: GameColors.lemon,
    alignItems: 'center',
    minWidth: 110,
  },
  comboBadgeLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 11,
    color: GameColors.panelInk,
    letterSpacing: 0.5,
  },
  comboBadgeValue: {
    fontFamily: GameFonts.display,
    fontSize: 18,
    lineHeight: 22,
    color: GameColors.ink,
  },
  meterAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  meterDimmed: {
    opacity: 0.28,
  },
  hidden: { opacity: 0 },
  gameOverPanel: {
    ...fillParent,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 40,
    gap: 18,
    paddingHorizontal: 24,
  },
  gameOverTitle: {
    fontFamily: GameFonts.display,
    fontSize: 52,
    lineHeight: 56,
    textAlign: 'center',
    color: '#FF4B4B',
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 0,
  },
  gameOverTitleBest: {
    color: GameColors.lemon,
  },
  feedback: {
    position: 'absolute',
    zIndex: 35,
    maxWidth: '46%',
  },
  feedbackAlignStart: { textAlign: 'left' },
  feedbackAlignEnd: { textAlign: 'right' },
  feedbackLabel: {
    fontFamily: GameFonts.display,
    fontSize: 28,
    lineHeight: 32,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  feedbackPoints: {
    marginTop: 2,
    fontFamily: GameFonts.body,
    fontSize: 18,
    color: GameColors.white,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  feedbackCombo: {
    marginTop: 3,
    fontFamily: GameFonts.display,
    fontSize: 18,
    lineHeight: 22,
    color: GameColors.lemon,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  menuCol: {
    position: 'absolute',
    left: 28,
    right: 28,
    gap: 14,
    zIndex: 40,
    alignItems: 'center',
  },
  ctaPressable: {
    width: '100%',
    maxWidth: 320,
  },
  ctaPressableDown: {
    transform: [{ scale: 0.97 }],
  },
  ctaShell: {
    borderRadius: 22,
    borderWidth: 4,
    borderColor: GameColors.ink,
    overflow: 'hidden',
  },
  ctaFace: {
    minHeight: 64,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ctaFaceUp: {
    marginBottom: 5,
    borderBottomWidth: 0,
  },
  ctaFaceDown: {
    marginBottom: 0,
    marginTop: 5,
  },
  ctaShine: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 6,
    height: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  ctaText: {
    fontFamily: GameFonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: GameColors.white,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(26,28,44,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  ctaSub: {
    marginTop: 1,
    fontFamily: GameFonts.soft,
    fontSize: 12,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.8,
  },
});

