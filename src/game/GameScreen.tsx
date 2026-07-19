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
import { gameHaptics } from '@/game/haptics';
import { createRng, makeRound } from '@/game/levels';
import { comboMultiplier, scoreFill, STARTING_LIVES } from '@/game/scoring';
import { DEFAULT_SKIN, SKINS } from '@/game/skins';
import {
  commitRunResult,
  dailySeed,
  equipSkin,
  loadPersist,
  setSoundMuted,
  todayKey,
  unlockSkin,
} from '@/game/storage';
import type { PersistState, RoundConfig, RoundOutcome, SessionStats, SkinId } from '@/game/types';
import { useSounds } from '@/game/useSounds';
import { VerticalMeter } from '@/game/VerticalMeter';

type Phase = 'ready' | 'countdown' | 'filling' | 'result' | 'gameover' | 'skins';

const emptyStats = (): SessionStats => ({
  attempts: 0,
  hits: 0,
  perfects: 0,
  misses: 0,
  bestCombo: 0,
  coinsEarned: 0,
});

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
  const [callout, setCallout] = useState<string | null>(null);

  const fill = useSharedValue(0);
  const zoneTarget = useSharedValue(round.target);
  const zoneHalf = useSharedValue(round.zoneHalf);
  const shakeX = useSharedValue(0);
  const meterX = useSharedValue(0);
  const calloutOpacity = useSharedValue(0);
  const flash = useSharedValue(0);
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

  const showCallout = (text: string) => {
    setCallout(text);
    calloutOpacity.value = withSequence(
      withTiming(1, { duration: 70 }),
      withDelay(420, withTiming(0, { duration: 280 })),
    );
  };

  const endRun = useCallback(
    async (finalScore: number, session: SessionStats) => {
      const next = await commitRunResult({
        score: finalScore,
        coinsEarned: session.coinsEarned,
        bestCombo: session.bestCombo,
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
      const result = scoreFill(value, current, comboRef.current);
      setOutcome(result);
      setCombo(result.combo);
      comboRef.current = result.combo;
      isFilling.value = 0;
      void gameHaptics.result(result.label === 'Close' ? 'Nice' : result.label);

      const labelText =
        result.points > 0 ? `${result.label.toUpperCase()}!  +${result.points}` : `${result.label.toUpperCase()}!`;
      showCallout(labelText);

      flash.value = withSequence(
        withTiming(0.2, { duration: 50 }),
        withTiming(0, { duration: 160 }),
      );

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
          shakeX.value = withSequence(
            withTiming(-8, { duration: 35 }),
            withTiming(8, { duration: 40 }),
            withTiming(0, { duration: 35 }),
          );
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
    [endRun, flash, isFilling, play, shakeX],
  );

  const startFill = useCallback(() => {
    const current = roundRef.current;
    setOutcome(null);
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
    setCallout(null);
    beginRound(makeRound(1, { rng: rngRef.current }), false);
  };

  const onTap = () => {
    if (lockingTap.current) return;
    const p = phaseRef.current;
    if (p === 'countdown' || p === 'skins' || p === 'ready' || p === 'result') return;

    if (p === 'filling') {
      lockingTap.current = true;
      cancelAnimation(fill);
      cancelAnimation(zoneTarget);
      cancelAnimation(zoneHalf);
      isFilling.value = 0;
      play('tap');
      void gameHaptics.stop();
      finishRound(fill.value);
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

  const onBuyOrEquip = async (id: SkinId) => {
    if (!persist) return;
    if (persist.unlockedSkins.includes(id)) {
      const next = await equipSkin(id);
      if (next) setPersist(next);
      return;
    }
    const next = await unlockSkin(id, SKINS[id].cost);
    if (next) setPersist(next);
  };

  const meterStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: meterX.value + shakeX.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value,
  }));
  const calloutStyle = useAnimatedStyle(() => ({
    opacity: calloutOpacity.value,
    transform: [{ translateY: (1 - calloutOpacity.value) * 8 }],
  }));

  const accuracy =
    stats.attempts > 0 ? Math.round((stats.hits / stats.attempts) * 100) : 0;

  const prompt =
    phase === 'countdown'
      ? countdown > 0
        ? String(countdown)
        : 'GO!'
      : phase === 'filling'
        ? 'TAP TO STOP'
        : phase === 'gameover'
          ? isNewBest
            ? 'NEW BEST!'
            : 'GAME OVER'
          : '';

  const hitEnabled = phase === 'filling' || phase === 'gameover';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...Gradients.sky]}
        locations={[...Gradients.skyStops]}
        style={styles.sky}
      />
      <View style={[styles.cloud, styles.cloudA]} />
      <View style={[styles.cloud, styles.cloudB]} />
      <View style={styles.hillBack} />
      <View style={styles.hillFront} />
      <View style={[styles.ground, { height: 44 + insets.bottom }]}>
        <View style={styles.hazard} />
      </View>
      <Animated.View style={[styles.flash, flashStyle]} />

      <View
        style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14 }]}
        pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <View pointerEvents="none">
            <Text style={styles.brand}>ZONE METER</Text>
            <Text style={styles.lives}>
              {'❤'.repeat(Math.max(0, lives))}
              <Text style={styles.livesEmpty}>
                {'♡'.repeat(Math.max(0, STARTING_LIVES - lives))}
              </Text>
            </Text>
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
            </View>
            <View style={styles.coinPill} pointerEvents="none">
              <Text style={styles.bestLabel}>COINS</Text>
              <Text style={styles.bestValue}>{persist?.coins ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsBlock} pointerEvents="none">
          <Text style={styles.bigScore}>{score}</Text>
          <Text style={styles.metaLine}>
            LVL {round.level}
            {combo > 0 ? `  ·  x${comboMultiplier(combo).toFixed(2)}` : ''}
          </Text>
        </View>

        <View style={styles.meterStage}>
          {/* Side callout — doesn't steal vertical space */}
          <Animated.View style={[styles.callout, calloutStyle]} pointerEvents="none">
            {callout ? <Text style={styles.calloutText}>{callout}</Text> : null}
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

        <Text style={styles.prompt} pointerEvents="none">
          {prompt}
          {phase === 'gameover'
            ? `\nAcc ${accuracy}% · Combo ${stats.bestCombo} · +${stats.coinsEarned} coins`
            : ''}
        </Text>

        {phase === 'ready' || phase === 'skins' || phase === 'gameover' ? (
          <View style={styles.menuCol} pointerEvents="auto">
            {phase !== 'skins' ? (
              <>
                <Pressable style={styles.ctaFace} onPress={() => startRun(false)}>
                  <Text style={styles.ctaText}>{phase === 'gameover' ? 'RETRY' : 'PLAY'}</Text>
                </Pressable>
                {phase === 'ready' ? (
                  <>
                    <Pressable
                      style={[styles.ctaFace, styles.ctaSecondary]}
                      onPress={() => startRun(true)}>
                      <Text style={styles.ctaText}>DAILY</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.ctaFace, styles.ctaSecondary]}
                      onPress={() => {
                        setPhase('skins');
                        phaseRef.current = 'skins';
                      }}>
                      <Text style={styles.ctaText}>SKINS</Text>
                    </Pressable>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {(Object.keys(SKINS) as SkinId[]).map((id) => {
                  const def = SKINS[id];
                  const owned = persist?.unlockedSkins.includes(id);
                  const equipped = persist?.equippedSkin === id;
                  return (
                    <Pressable
                      key={id}
                      style={[styles.ctaFace, styles.ctaSecondary, equipped && styles.ctaEquipped]}
                      onPress={() => void onBuyOrEquip(id)}>
                      <Text style={styles.ctaText}>
                        {def.name}
                        {owned ? (equipped ? ' ✓' : '') : ` · ${def.cost}`}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={styles.ctaFace}
                  onPress={() => {
                    setPhase('ready');
                    phaseRef.current = 'ready';
                  }}>
                  <Text style={styles.ctaText}>BACK</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}
      </View>

      {hitEnabled ? (
        <Pressable style={styles.hitLayer} onPressIn={onTap} accessibilityRole="button" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GameColors.skyTop },
  sky: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hitLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 10,
  },
  content: { flex: 1, paddingHorizontal: 20, zIndex: 1 },
  cloud: { position: 'absolute', backgroundColor: GameColors.cloud, borderRadius: 999 },
  cloudA: { top: 100, left: 28, width: 72, height: 26 },
  cloudB: { top: 160, right: 36, width: 88, height: 30 },
  hillBack: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: 58,
    height: 100,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    backgroundColor: GameColors.hillDark,
  },
  hillFront: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: 40,
    height: 78,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120,
    backgroundColor: GameColors.hill,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: GameColors.ground,
  },
  hazard: {
    height: 14,
    backgroundColor: GameColors.groundStripe,
    borderTopWidth: 3,
    borderColor: GameColors.ink,
  },
  flash: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#fff',
    pointerEvents: 'none',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topRight: { alignItems: 'flex-end', gap: 6 },
  brand: {
    fontFamily: GameFonts.display,
    fontSize: 26,
    color: GameColors.lemon,
  },
  lives: { marginTop: 2, fontSize: 18, color: GameColors.perfect, letterSpacing: 2 },
  livesEmpty: { color: 'rgba(0,0,0,0.22)' },
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GameColors.ink,
    backgroundColor: '#FFF4C2',
    alignItems: 'center',
    minWidth: 56,
  },
  coinPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GameColors.ink,
    backgroundColor: '#D9F99D',
    alignItems: 'center',
    minWidth: 56,
  },
  bestLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 10,
    color: GameColors.panelInk,
  },
  bestValue: {
    fontFamily: GameFonts.body,
    fontSize: 14,
    color: GameColors.ink,
  },
  statsBlock: { marginTop: 2, alignItems: 'center' },
  bigScore: {
    fontFamily: GameFonts.display,
    fontSize: 48,
    lineHeight: 52,
    color: GameColors.white,
  },
  metaLine: {
    fontFamily: GameFonts.body,
    fontSize: 15,
    color: GameColors.ink,
  },
  meterStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  callout: {
    position: 'absolute',
    right: 4,
    top: '28%',
    zIndex: 5,
    maxWidth: 130,
  },
  calloutText: {
    fontFamily: GameFonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: GameColors.ink,
    textAlign: 'right',
  },
  prompt: {
    fontFamily: GameFonts.body,
    fontSize: 16,
    color: GameColors.ink,
    textAlign: 'center',
    minHeight: 40,
    marginBottom: 6,
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
  ctaEquipped: { backgroundColor: GameColors.lemon },
  ctaText: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    color: GameColors.white,
  },
});
