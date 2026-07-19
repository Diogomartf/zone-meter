import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

import { GameColors, GameFonts, Gradients } from '@/constants/gameTheme';
import { Clouds } from '@/game/Clouds';
import { Hearts } from '@/game/Hearts';

const LOGO = require('@/assets/images/zone-meter-logo.png');
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

type Phase = 'ready' | 'countdown' | 'filling' | 'result' | 'gameover';

type Feedback = {
  label: RoundLabel;
  points: number;
  combo: number;
  comboGrew: boolean;
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

export function GameScreen() {
  const insets = useSafeAreaInsets();
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

  const showFeedback = (next: Feedback) => {
    setFeedback(next);
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
        let n = 3;
        const tick = () => {
          if (n <= 1) {
            setCountdown(0);
            startFill();
            return;
          }
          n -= 1;
          setCountdown(n);
          countTimer.current = setTimeout(tick, 400);
        };
        countTimer.current = setTimeout(tick, 400);
      } else {
        startFill();
      }
    },
    [fill, meterX, startFill, zoneHalf, zoneTarget],
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
      return;
    }

    if (p === 'gameover') {
      lockingTap.current = true;
      void gameHaptics.next();
      startRun(dailyMode);
      lockingTap.current = false;
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
    transform: [
      { scale: feedbackScale.value },
      { translateY: (1 - feedbackOpacity.value) * 12 },
    ],
  }));
  const comboBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: comboPulse.value }],
  }));

  const accuracy =
    stats.attempts > 0 ? Math.round((stats.hits / stats.attempts) * 100) : 0;

  // Only countdown / game-over copy — no persistent "TAP TO STOP"
  const prompt =
    phase === 'countdown'
      ? countdown > 0
        ? String(countdown)
        : 'GO!'
      : phase === 'gameover'
        ? isNewBest
          ? 'NEW BEST!'
          : 'GAME OVER'
        : '';

  const hitEnabled = phase === 'filling' || phase === 'gameover';

  const headerHeight = insets.top + 148;

  return (
    <View style={styles.root}>
      {/* Sky header only — logo / lives / best stay on blue */}
      <View style={[styles.headerBand, { height: headerHeight }]} pointerEvents="none">
        <LinearGradient
          colors={[...Gradients.sky]}
          locations={[...Gradients.skyStops]}
          style={StyleSheet.absoluteFill}
        />
        <Clouds />
      </View>

      {/* Tap / play field — zone green under the header */}
      <LinearGradient
        colors={[...Gradients.playZone]}
        locations={[...Gradients.playZoneStops]}
        style={[styles.playZone, { top: headerHeight - 28 }]}
        pointerEvents="none"
      />
      <View style={[styles.playZoneLip, { top: headerHeight - 28 }]} pointerEvents="none" />

      <View style={[styles.ground, { height: 44 + insets.bottom }]}>
        <View style={styles.hazard} />
      </View>

      <View
        style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14 }]}
        pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View pointerEvents="none">
            {phase !== 'ready' ? (
              <>
                <Image source={LOGO} style={styles.logoHud} contentFit="contain" />
                <Hearts lives={lives} max={STARTING_LIVES} />
              </>
            ) : (
              <View style={styles.logoHudPlaceholder} />
            )}
          </View>

          <View style={styles.topRight} pointerEvents="box-none">
            <Pressable style={styles.iconBtn} onPress={() => void toggleMute()} hitSlop={10}>
              <Text style={styles.iconBtnText}>{muted ? '🔇' : '🔊'}</Text>
            </Pressable>
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
        </View>

        <View style={styles.statsBlock} pointerEvents="none">
          {phase === 'ready' ? (
            <Image source={LOGO} style={styles.logoHero} contentFit="contain" />
          ) : (
            <>
              <Text style={styles.bigScore}>{score}</Text>
              <Text style={styles.metaLine}>LVL {round.level}</Text>
              {combo > 0 && phase !== 'gameover' ? (
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

        <View style={styles.meterStage}>
          <Animated.View style={[styles.feedback, feedbackStyle]} pointerEvents="none">
            {feedback ? (
              <>
                <Text style={[styles.feedbackLabel, { color: LABEL_COLORS[feedback.label] }]}>
                  {feedback.label.toUpperCase()}!
                </Text>
                {feedback.points > 0 ? (
                  <Text style={styles.feedbackPoints}>+{feedback.points}</Text>
                ) : null}
                {feedback.comboGrew && feedback.combo > 1 ? (
                  <Text style={styles.feedbackCombo}>COMBO x{feedback.combo}</Text>
                ) : feedback.comboGrew && feedback.combo === 1 ? (
                  <Text style={styles.feedbackCombo}>COMBO START</Text>
                ) : null}
              </>
            ) : null}
          </Animated.View>

          <Animated.View style={meterStyle}>
            <VerticalMeter
              fill={fill}
              zoneTarget={zoneTarget}
              zoneHalf={zoneHalf}
              skin={skin}
              scale={round.meterScale}
            />
          </Animated.View>
        </View>

        {prompt || phase === 'gameover' ? (
          <Text
            style={[styles.prompt, phase === 'countdown' && styles.promptCountdown, phase === 'gameover' && styles.promptOver]}
            pointerEvents="none">
            {prompt}
            {phase === 'gameover'
              ? `\nAcc ${accuracy}% · Combo ${stats.bestCombo} · LVL ${round.level}`
              : ''}
          </Text>
        ) : (
          <View style={styles.promptSpacer} pointerEvents="none" />
        )}

        {phase === 'ready' || phase === 'gameover' ? (
          <View style={styles.menuCol} pointerEvents="auto">
            <Pressable style={styles.ctaFace} onPress={() => startRun(false)}>
              <Text style={styles.ctaText}>{phase === 'gameover' ? 'RETRY' : 'PLAY'}</Text>
            </Pressable>
            {phase === 'ready' ? (
              <Pressable
                style={[styles.ctaFace, styles.ctaSecondary]}
                onPress={() => startRun(true)}>
                <Text style={styles.ctaText}>DAILY</Text>
              </Pressable>
            ) : null}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GameColors.skyTop },
  headerBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
    zIndex: 0,
  },
  playZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    zIndex: 0,
  },
  playZoneLip: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    backgroundColor: 'rgba(26,28,44,0.18)',
    zIndex: 0,
  },
  hitLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
  },
  content: { flex: 1, paddingHorizontal: 20, zIndex: 1 },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GameColors.ground,
    zIndex: 0,
  },
  hazard: {
    height: 14,
    backgroundColor: GameColors.groundStripe,
    borderTopWidth: 3,
    borderColor: GameColors.ink,
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topRight: { alignItems: 'flex-end', gap: 6 },
  logoHud: {
    width: 128,
    height: 70,
    marginLeft: -6,
  },
  logoHudPlaceholder: {
    width: 128,
    height: 8,
  },
  logoHero: {
    width: 280,
    height: 168,
    marginTop: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GameColors.playBlue,
    borderWidth: 2,
    borderColor: GameColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconBtnText: { fontSize: 16 },
  bestPill: {
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
    fontSize: 48,
    lineHeight: 52,
    color: GameColors.white,
    textShadowColor: 'rgba(26,28,44,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  metaLine: {
    fontFamily: GameFonts.body,
    fontSize: 15,
    color: GameColors.ink,
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
  meterStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  feedback: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: '18%',
    zIndex: 8,
    alignItems: 'center',
  },
  feedbackLabel: {
    fontFamily: GameFonts.display,
    fontSize: 44,
    lineHeight: 48,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  feedbackPoints: {
    marginTop: 2,
    fontFamily: GameFonts.body,
    fontSize: 22,
    color: GameColors.ink,
  },
  feedbackCombo: {
    marginTop: 4,
    fontFamily: GameFonts.display,
    fontSize: 24,
    lineHeight: 28,
    color: GameColors.lemon,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  prompt: {
    fontFamily: GameFonts.body,
    fontSize: 16,
    color: GameColors.ink,
    textAlign: 'center',
    minHeight: 40,
    marginBottom: 6,
  },
  promptCountdown: {
    fontFamily: GameFonts.display,
    fontSize: 42,
    lineHeight: 46,
    color: GameColors.ink,
    marginBottom: 18,
  },
  promptSpacer: {
    minHeight: 40,
    marginBottom: 22,
  },
  promptOver: {
    marginBottom: 10,
  },
  menuCol: { width: '90%', alignSelf: 'center', gap: 10, zIndex: 30 },
  ctaFace: {
    height: 52,
    borderRadius: 18,
    backgroundColor: GameColors.playBlue,
    borderWidth: 3,
    borderColor: GameColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaSecondary: { backgroundColor: GameColors.bubble },
  ctaText: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    color: GameColors.white,
  },
});

