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
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameColors, GameFonts, Gradients } from '@/constants/gameTheme';
import { gameHaptics } from '@/game/haptics';
import { createRng, makeRound, zoneAt } from '@/game/levels';
import { comboMultiplier, scoreFill, STARTING_LIVES } from '@/game/scoring';
import { DEFAULT_SKIN, SKINS, type SkinDef } from '@/game/skins';
import {
  commitRunResult,
  dailySeed,
  equipSkin,
  loadPersist,
  todayKey,
  unlockSkin,
} from '@/game/storage';
import type { PersistState, RoundConfig, RoundOutcome, SessionStats, SkinId } from '@/game/types';
import { useSounds } from '@/game/useSounds';
import { VerticalMeter } from '@/game/VerticalMeter';

type Phase =
  | 'ready'
  | 'countdown'
  | 'filling'
  | 'result'
  | 'risk'
  | 'gameover'
  | 'skins';

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
  const { play } = useSounds();

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState<RoundConfig>(() => makeRound(1));
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(STARTING_LIVES);
  const [combo, setCombo] = useState(0);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [ghostStop, setGhostStop] = useState<number | null>(null);
  const [dailyMode, setDailyMode] = useState(false);
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [stats, setStats] = useState<SessionStats>(emptyStats);
  const [lastGain, setLastGain] = useState(0);
  const [riskArmed, setRiskArmed] = useState(false);

  const fill = useSharedValue(0);
  const zoneTarget = useSharedValue(round.target);
  const zoneHalf = useSharedValue(round.zoneHalf);
  const shakeX = useSharedValue(0);
  const pop = useSharedValue(1);
  const flash = useSharedValue(0);
  const zoneLow = useSharedValue(round.target - round.zoneHalf);
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
  const riskRoundRef = useRef(false);
  const lastGainRef = useRef(0);
  const advanceRef = useRef<() => void>(() => {});

  const skin: SkinDef = SKINS[persist?.equippedSkin ?? DEFAULT_SKIN];

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    roundRef.current = round;
    zoneTarget.value = round.target;
    zoneHalf.value = round.zoneHalf;
    zoneLow.value = round.target - round.zoneHalf;
  }, [round, zoneHalf, zoneLow, zoneTarget]);

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

  const bumpPop = () => {
    pop.value = withSequence(
      withSpring(1.14, { damping: 10, stiffness: 220 }),
      withSpring(1, { damping: 14, stiffness: 180 }),
    );
  };

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(-8, { duration: 35 }),
      withTiming(8, { duration: 40 }),
      withTiming(-5, { duration: 35 }),
      withTiming(0, { duration: 35 }),
    );
  };

  const syncZoneLow = (target: number, half: number) => {
    zoneLow.value = target - half;
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
      setGhostStop(value);
      setCombo(result.combo);
      comboRef.current = result.combo;
      bumpPop();
      flash.value = withSequence(
        withTiming(1, { duration: 70 }),
        withTiming(0, { duration: 180 }),
      );
      isFilling.value = 0;
      void gameHaptics.result(result.label === 'Close' ? 'Nice' : result.label);

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
          shake();
          // Risk miss only loses the staked points (already subtracted), not a life
          if (riskRoundRef.current) {
            riskRoundRef.current = false;
            setPhase('result');
            phaseRef.current = 'result';
            return next;
          }
          const livesLeft = livesRef.current - 1;
          setLives(livesLeft);
          livesRef.current = livesLeft;
          if (livesLeft <= 0) {
            void endRun(scoreRef.current, next);
          } else {
            setPhase('result');
            phaseRef.current = 'result';
          }
          return next;
        }

        play(result.result === 'perfect' ? 'perfect' : 'zone');

        const wasRisk = riskRoundRef.current;
        riskRoundRef.current = false;
        const gained = wasRisk ? lastGainRef.current * 2 : result.points;
        if (!wasRisk) {
          setLastGain(result.points);
          lastGainRef.current = result.points;
        }
        setScore((sc) => sc + gained);
        scoreRef.current += gained;

        const canRisk = !wasRisk && (result.result === 'zone' || result.result === 'near');
        setRiskArmed(canRisk);
        setPhase(canRisk ? 'risk' : 'result');
        phaseRef.current = canRisk ? 'risk' : 'result';

        if (result.result === 'perfect' && !wasRisk) {
          if (autoTimer.current) clearTimeout(autoTimer.current);
          autoTimer.current = setTimeout(() => {
            if (phaseRef.current === 'result' || phaseRef.current === 'risk') {
              advanceRef.current();
            }
          }, 750);
        }

        return next;
      });
    },
    [endRun, flash, isFilling, play],
  );

  const startFill = useCallback(() => {
    const current = roundRef.current;
    setOutcome(null);
    setRiskArmed(false);
    setPhase('filling');
    phaseRef.current = 'filling';
    isFilling.value = 1;
    zoneTarget.value = current.target;
    zoneHalf.value = current.zoneHalf;
    syncZoneLow(current.target, current.zoneHalf);
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

    // Non-linear fill: slow start, surges toward the top
    fill.value = withTiming(
      1,
      { duration: current.fillMs, easing: Easing.bezier(0.2, 0.05, 0.35, 1) },
      (finished) => {
        if (finished) {
          runOnJS(finishRound)(1);
        }
      },
    );
  }, [fill, finishRound, isFilling, play, zoneHalf, zoneTarget]);

  const beginRound = useCallback(
    (next: RoundConfig) => {
      setRound(next);
      roundRef.current = next;
      fill.value = 0;
      zoneTarget.value = next.target;
      zoneHalf.value = next.zoneHalf;
      setOutcome(null);

      if (next.level <= 3 && !riskRoundRef.current) {
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
          countTimer.current = setTimeout(tick, 450);
        };
        countTimer.current = setTimeout(tick, 450);
      } else {
        startFill();
      }
    },
    [fill, startFill, zoneHalf, zoneTarget],
  );

  const advanceLevel = useCallback(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    const prevTarget = roundRef.current.target;
    const next = makeRound(roundRef.current.level + 1, {
      previousTarget: prevTarget,
      rng: rngRef.current,
    });
    beginRound(next);
  }, [beginRound]);

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
      const live = {
        target: zoneTarget.value,
        half: zoneHalf.value,
      };
      const low = live.target - live.half;
      if (prev < low && value >= low) {
        runOnJS(onZoneEnter)();
      }
    },
    [onZoneEnter],
  );

  // Keep zoneLow roughly tracked for debug/legacy
  useAnimatedReaction(
    () => ({ t: zoneTarget.value, h: zoneHalf.value }),
    (v) => {
      zoneLow.value = v.t - v.h;
    },
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
    setGhostStop(null);
    setIsNewBest(false);
    setLastGain(0);
    riskRoundRef.current = false;
    beginRound(makeRound(1, { rng: rngRef.current }));
  };

  const startRiskRound = () => {
    if (!riskArmed || lastGain <= 0) {
      advanceLevel();
      return;
    }
    riskRoundRef.current = true;
    setRiskArmed(false);
    const base = roundRef.current;
    const live = zoneAt(base, base.target);
    const riskRound: RoundConfig = {
      level: base.level,
      target: live.target,
      zoneHalf: Math.max(0.014, live.zoneHalf * 0.55),
      zoneHalfEnd: Math.max(0.01, live.zoneHalf * 0.35),
      perfectHalf: Math.max(0.005, base.perfectHalf * 0.7),
      fillMs: Math.max(280, Math.round(base.fillMs * 0.75)),
      moving: false,
      shrinking: true,
    };
    setRound(riskRound);
    roundRef.current = riskRound;
    startFill();
  };

  const onTap = () => {
    if (lockingTap.current) return;
    const p = phaseRef.current;

    if (p === 'countdown' || p === 'skins') return;

    if (p === 'ready') return; // use menu buttons

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

    if (p === 'risk') {
      // Default tap = skip risk, go next
      lockingTap.current = true;
      void gameHaptics.next();
      advanceLevel();
      lockingTap.current = false;
      return;
    }

    if (p === 'result') {
      lockingTap.current = true;
      void gameHaptics.next();
      if (outcome?.costsLife && livesRef.current > 0) {
        // Continue after losing a life on same level-ish
        beginRound(
          makeRound(roundRef.current.level, {
            previousTarget: roundRef.current.target,
            rng: rngRef.current,
          }),
        );
      } else {
        advanceLevel();
      }
      lockingTap.current = false;
      return;
    }

    if (p === 'gameover') {
      lockingTap.current = true;
      void gameHaptics.next();
      startRun(dailyMode);
      lockingTap.current = false;
    }
  };

  const onBuyOrEquip = async (id: SkinId) => {
    const def = SKINS[id];
    if (!persist) return;
    if (persist.unlockedSkins.includes(id)) {
      const next = await equipSkin(id);
      if (next) setPersist(next);
      return;
    }
    const next = await unlockSkin(id, def.cost);
    if (next) setPersist(next);
  };

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.22,
  }));

  const showingResult = Boolean(
    outcome && (phase === 'result' || phase === 'risk' || phase === 'gameover'),
  );
  const accuracy =
    stats.attempts > 0 ? Math.round((stats.hits / stats.attempts) * 100) : 0;

  const feedback = showingResult
    ? `${outcome!.label.toUpperCase()}!`
    : phase === 'countdown'
      ? countdown > 0
        ? String(countdown)
        : 'GO!'
      : phase === 'filling'
        ? 'TAP ANYWHERE TO STOP'
        : phase === 'risk'
          ? 'RISK IT?'
          : 'TAP ANYWHERE';

  const feedbackColor =
    outcome?.result === 'miss'
      ? GameColors.scoreBad
      : outcome?.label === 'Perfect'
        ? GameColors.lemon
        : outcome?.label === 'Great'
          ? GameColors.zoneHot
          : GameColors.white;

  const ctaLabel =
    phase === 'gameover'
      ? 'RETRY'
      : phase === 'ready'
        ? 'PLAY'
        : phase === 'risk'
          ? 'SKIP'
          : phase === 'result'
            ? 'NEXT'
            : phase === 'countdown'
              ? '...'
              : 'STOP';

  // Menu / risk use explicit buttons — only cover full screen for fill/result/retry
  const hitEnabled = phase === 'filling' || phase === 'result' || phase === 'gameover';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[...Gradients.sky]}
        locations={[...Gradients.skyStops]}
        style={styles.sky}
      />
      <View style={[styles.cloud, styles.cloudA]} />
      <View style={[styles.cloud, styles.cloudB]} />
      <View style={[styles.cloud, styles.cloudC]} />
      <View style={styles.hillBack} />
      <View style={styles.hillFront} />
      <View style={[styles.ground, { height: 48 + insets.bottom }]}>
        <View style={styles.hazard} />
      </View>
      <Animated.View style={[styles.flash, flashStyle]} />

      <View
        style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}
        pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="none">
          <View>
            <Text style={styles.brand}>ZONE METER</Text>
            <Text style={styles.lives}>
              {'❤'.repeat(Math.max(0, lives))}
              <Text style={styles.livesEmpty}>{'♡'.repeat(Math.max(0, STARTING_LIVES - lives))}</Text>
            </Text>
          </View>
          <View style={styles.topRight}>
            <View style={styles.bestPill}>
              <Text style={styles.bestLabel}>{dailyMode ? 'DAILY' : 'BEST'}</Text>
              <Text style={styles.bestValue}>
                {dailyMode
                  ? persist?.dailyBest.date === todayKey()
                    ? persist.dailyBest.score
                    : 0
                  : (persist?.highScore ?? 0)}
              </Text>
            </View>
            <View style={styles.coinPill}>
              <Text style={styles.bestLabel}>COINS</Text>
              <Text style={styles.bestValue}>{persist?.coins ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsBlock} pointerEvents="none">
          <Text style={styles.bigScore}>{score}</Text>
          <Text style={styles.ptsLabel}>
            PTS
            {combo > 0 ? `  ·  x${comboMultiplier(combo).toFixed(2)}` : ''}
          </Text>
          <Text style={styles.levelText}>
            {`LEVEL ${round.level}`}
            {combo > 0 ? `  ·  COMBO ${combo}` : ''}
          </Text>
        </View>

        <Animated.View style={[styles.meterStage, shakeStyle]} pointerEvents="none">
          <VerticalMeter
            fill={fill}
            zoneTarget={zoneTarget}
            zoneHalf={zoneHalf}
            ghostStop={ghostStop}
            skin={skin}
          />
        </Animated.View>

        <Animated.View style={[styles.bannerWrap, popStyle]} pointerEvents="none">
          {showingResult ? (
            <View
              style={[
                styles.banner,
                outcome?.result === 'miss' ? styles.bannerBad : styles.bannerGood,
              ]}>
              <Text style={[styles.feedback, { color: feedbackColor }]}>{feedback}</Text>
              {outcome && outcome.points > 0 ? (
                <Text style={styles.points}>
                  +{outcome.points}
                  {outcome.multiplier > 1 ? `  (x${outcome.multiplier.toFixed(2)})` : ''}
                </Text>
              ) : null}
              {phase === 'gameover' ? (
                <>
                  <Text style={styles.gameOverSub}>
                    {isNewBest ? 'NEW BEST!' : `Final ${score}`}
                  </Text>
                  <Text style={styles.gameOverSub}>
                    Acc {accuracy}% · Best combo {stats.bestCombo} · +{stats.coinsEarned} coins
                  </Text>
                </>
              ) : null}
              {phase === 'risk' ? (
                <Text style={styles.gameOverSub}>Double last gain or skip</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.prompt}>{feedback}</Text>
          )}
        </Animated.View>

        {phase === 'ready' || phase === 'skins' || phase === 'gameover' ? (
          <View style={styles.menuCol} pointerEvents="auto">
            {phase !== 'skins' ? (
              <>
                <Pressable style={styles.ctaFace} onPress={() => startRun(false)}>
                  <Text style={styles.ctaText}>PLAY</Text>
                </Pressable>
                <Pressable
                  style={[styles.ctaFace, styles.ctaSecondary]}
                  onPress={() => startRun(true)}>
                  <Text style={styles.ctaText}>DAILY {todayKey().slice(5)}</Text>
                </Pressable>
                <Pressable
                  style={[styles.ctaFace, styles.ctaSecondary]}
                  onPress={() => {
                    setPhase('skins');
                    phaseRef.current = 'skins';
                  }}>
                  <Text style={styles.ctaText}>SKINS · {skin.name}</Text>
                </Pressable>
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
        ) : phase === 'risk' ? (
          <View style={styles.menuCol} pointerEvents="auto">
            <Pressable
              style={[styles.ctaFace, styles.ctaRisk]}
              onPress={() => {
                void gameHaptics.next();
                // Undo last gain then risk for double
                setScore((s) => s - lastGainRef.current);
                scoreRef.current -= lastGainRef.current;
                startRiskRound();
              }}>
              <Text style={styles.ctaText}>RISK IT x2</Text>
            </Pressable>
            <Pressable style={[styles.ctaFace, styles.ctaSecondary]} onPress={onTap}>
              <Text style={styles.ctaText}>SAFE NEXT</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cta} pointerEvents="none">
            <View style={styles.ctaShadow} />
            <View style={styles.ctaFace}>
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </View>
          </View>
        )}
      </View>

      {hitEnabled ? (
        <Pressable
          style={styles.hitLayer}
          onPressIn={onTap}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        />
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 1,
  },
  cloud: { position: 'absolute', backgroundColor: GameColors.cloud, borderRadius: 999 },
  cloudA: { top: 90, left: 24, width: 78, height: 28 },
  cloudB: { top: 140, right: 30, width: 96, height: 34 },
  cloudC: { top: 210, left: 48, width: 64, height: 24 },
  hillBack: {
    position: 'absolute',
    left: -40,
    right: -40,
    bottom: 64,
    height: 110,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    backgroundColor: GameColors.hillDark,
  },
  hillFront: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: 44,
    height: 84,
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
    overflow: 'hidden',
  },
  hazard: {
    height: 16,
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
    backgroundColor: '#FFFFFF',
    pointerEvents: 'none',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  topRight: { alignItems: 'flex-end', gap: 6 },
  brand: {
    fontFamily: GameFonts.display,
    fontSize: 26,
    color: GameColors.lemon,
  },
  lives: {
    marginTop: 2,
    fontSize: 18,
    color: GameColors.perfect,
    letterSpacing: 2,
  },
  livesEmpty: { color: 'rgba(0,0,0,0.25)' },
  bestPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GameColors.ink,
    backgroundColor: '#FFF4C2',
    alignItems: 'center',
    minWidth: 58,
  },
  coinPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GameColors.ink,
    backgroundColor: '#D9F99D',
    alignItems: 'center',
    minWidth: 58,
  },
  bestLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 10,
    letterSpacing: 0.8,
    color: GameColors.panelInk,
  },
  bestValue: {
    fontFamily: GameFonts.body,
    fontSize: 15,
    color: GameColors.ink,
    lineHeight: 17,
  },
  statsBlock: { marginTop: 4, alignItems: 'center' },
  bigScore: {
    fontFamily: GameFonts.display,
    fontSize: 52,
    lineHeight: 56,
    color: GameColors.white,
  },
  ptsLabel: {
    fontFamily: GameFonts.body,
    fontSize: 15,
    letterSpacing: 1,
    color: GameColors.ink,
  },
  levelText: {
    marginTop: 2,
    fontFamily: GameFonts.body,
    fontSize: 16,
    color: GameColors.ink,
  },
  meterStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  bannerWrap: {
    minHeight: 78,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  banner: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: GameColors.ink,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  bannerGood: { backgroundColor: GameColors.bubble },
  bannerBad: { backgroundColor: '#FF8B8B' },
  feedback: {
    fontFamily: GameFonts.display,
    fontSize: 30,
    lineHeight: 34,
    textAlign: 'center',
  },
  points: {
    marginTop: 2,
    fontFamily: GameFonts.display,
    fontSize: 22,
    color: GameColors.lemon,
  },
  gameOverSub: {
    marginTop: 3,
    fontFamily: GameFonts.body,
    fontSize: 14,
    color: GameColors.ink,
    textAlign: 'center',
  },
  prompt: {
    fontFamily: GameFonts.display,
    fontSize: 22,
    color: GameColors.white,
    textAlign: 'center',
  },
  menuCol: {
    width: '90%',
    gap: 10,
    marginBottom: 4,
    zIndex: 30,
  },
  cta: { width: '86%', height: 56, marginBottom: 4 },
  ctaShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 5,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: GameColors.playBlueDark,
    borderWidth: 3,
    borderColor: GameColors.ink,
  },
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
  ctaRisk: { backgroundColor: GameColors.zoneHot },
  ctaEquipped: { backgroundColor: GameColors.lemon },
  ctaText: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    color: GameColors.white,
    letterSpacing: 0.5,
  },
});
