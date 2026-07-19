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
import { loadHighScore, saveHighScore } from '@/game/highScore';
import { makeRound, scoreFill } from '@/game/levels';
import type { RoundConfig, RoundOutcome } from '@/game/types';
import { useSounds } from '@/game/useSounds';
import { VerticalMeter } from '@/game/VerticalMeter';

type Phase = 'ready' | 'filling' | 'result' | 'gameover';

export function GameScreen() {
  const insets = useSafeAreaInsets();
  const { play } = useSounds();

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState<RoundConfig>(() => makeRound(1));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [outcome, setOutcome] = useState<RoundOutcome | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const fill = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const pop = useSharedValue(1);
  const flash = useSharedValue(0);
  const zoneLow = useSharedValue(round.target - round.zoneHalf);
  const isFilling = useSharedValue(0);
  const phaseRef = useRef<Phase>('ready');
  const roundRef = useRef(round);
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);
  const lockingTap = useRef(false);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    roundRef.current = round;
    zoneLow.value = round.target - round.zoneHalf;
  }, [round, zoneLow]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);

  useEffect(() => {
    void loadHighScore().then(setHighScore);
  }, []);

  const bumpPop = () => {
    pop.value = withSequence(
      withSpring(1.16, { damping: 10, stiffness: 220 }),
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

  const finishRound = useCallback(
    (value: number) => {
      const current = roundRef.current;
      const result = scoreFill(value, current);
      setOutcome(result);
      bumpPop();
      flash.value = withSequence(
        withTiming(1, { duration: 70 }),
        withTiming(0, { duration: 180 }),
      );

      isFilling.value = 0;
      void gameHaptics.result(result.label);

      if (result.result === 'miss') {
        play('miss');
        shake();
        const finalScore = scoreRef.current;
        const previousBest = highScoreRef.current;
        void saveHighScore(finalScore).then((best) => {
          setIsNewBest(finalScore > previousBest);
          setHighScore(best);
        });
        setPhase('gameover');
        phaseRef.current = 'gameover';
        return;
      }

      play(result.result === 'perfect' ? 'perfect' : 'zone');
      setScore((s) => s + result.points);
      setPhase('result');
      phaseRef.current = 'result';
    },
    [flash, isFilling, play],
  );

  const startFill = useCallback(() => {
    const current = roundRef.current;
    setOutcome(null);
    setPhase('filling');
    phaseRef.current = 'filling';
    isFilling.value = 1;
    zoneLow.value = current.target - current.zoneHalf;
    fill.value = 0;
    play('start');
    void gameHaptics.start();

    fill.value = withTiming(
      1,
      { duration: current.fillMs, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(finishRound)(1);
        }
      },
    );
  }, [fill, finishRound, isFilling, play, zoneLow]);

  const onZoneEnter = useCallback(() => {
    void gameHaptics.zoneEnter();
  }, []);

  useAnimatedReaction(
    () => fill.value,
    (value, prev) => {
      if (isFilling.value !== 1 || prev == null) return;
      if (prev < zoneLow.value && value >= zoneLow.value) {
        runOnJS(onZoneEnter)();
      }
    },
    [onZoneEnter],
  );

  const onTap = () => {
    // Ignore double-fires while a stop/start is resolving
    if (lockingTap.current) return;

    if (phaseRef.current === 'ready') {
      lockingTap.current = true;
      void gameHaptics.next();
      startFill();
      lockingTap.current = false;
      return;
    }

    if (phaseRef.current === 'filling') {
      lockingTap.current = true;
      cancelAnimation(fill);
      isFilling.value = 0;
      play('tap');
      void gameHaptics.stop();
      finishRound(fill.value);
      // Unlock on next frame so result-phase taps still work
      requestAnimationFrame(() => {
        lockingTap.current = false;
      });
      return;
    }

    if (phaseRef.current === 'result') {
      lockingTap.current = true;
      void gameHaptics.next();
      const prevTarget = roundRef.current.target;
      const next = makeRound(roundRef.current.level + 1, prevTarget);
      setRound(next);
      roundRef.current = next;
      fill.value = 0;
      setOutcome(null);
      startFill();
      lockingTap.current = false;
      return;
    }

    if (phaseRef.current === 'gameover') {
      lockingTap.current = true;
      void gameHaptics.next();
      const next = makeRound(1);
      setRound(next);
      roundRef.current = next;
      setScore(0);
      scoreRef.current = 0;
      setOutcome(null);
      setIsNewBest(false);
      fill.value = 0;
      startFill();
      lockingTap.current = false;
    }
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

  const showingResult = Boolean(outcome && (phase === 'result' || phase === 'gameover'));
  const feedback = showingResult
    ? `${outcome!.label.toUpperCase()}!`
    : phase === 'ready'
      ? 'TAP ANYWHERE'
      : phase === 'filling'
        ? 'TAP ANYWHERE TO STOP'
        : 'KEEP GOING';

  const feedbackColor =
    phase === 'gameover' || outcome?.result === 'miss'
      ? GameColors.scoreBad
      : outcome?.label === 'Perfect'
        ? GameColors.lemon
        : outcome?.label === 'Great'
          ? GameColors.zoneHot
          : GameColors.white;

  const ctaLabel =
    phase === 'gameover' ? 'RETRY' : phase === 'ready' ? 'PLAY' : phase === 'result' ? 'NEXT' : 'STOP';

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
        pointerEvents="none">
        <View style={styles.topRow}>
          <Text style={styles.brand}>ZONE METER</Text>
          <View style={styles.bestPill}>
            <Text style={styles.bestLabel}>BEST</Text>
            <Text style={styles.bestValue}>{highScore}</Text>
          </View>
        </View>

        <View style={styles.statsBlock}>
          <Text style={styles.bigScore}>{score}</Text>
          <Text style={styles.ptsLabel}>PTS</Text>
          <Text style={styles.levelText}>{`LEVEL ${round.level}`}</Text>
        </View>

        <Animated.View style={[styles.meterStage, shakeStyle]}>
          <VerticalMeter fill={fill} round={round} />
        </Animated.View>

        <Animated.View style={[styles.bannerWrap, popStyle]}>
          {showingResult ? (
            <View style={[styles.banner, phase === 'gameover' ? styles.bannerBad : styles.bannerGood]}>
              <Text style={[styles.feedback, { color: feedbackColor }]}>{feedback}</Text>
              {outcome && outcome.result !== 'miss' ? (
                <Text style={styles.points}>{`+${outcome.points}`}</Text>
              ) : null}
              {phase === 'gameover' ? (
                <Text style={styles.gameOverSub}>
                  {isNewBest ? 'NEW BEST!' : `Final ${score}`}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.prompt}>{feedback}</Text>
          )}
        </Animated.View>

        <View style={styles.cta}>
          <View style={styles.ctaShadow} />
          <View style={styles.ctaFace}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </View>
        </View>
      </View>

      {/* Full-screen hit target — tap anywhere (meter, sky, button) to stop/start */}
      <Pressable
        style={styles.hitLayer}
        onPressIn={onTap}
        accessibilityRole="button"
        accessibilityLabel={
          phase === 'filling' ? 'Tap anywhere to stop the meter' : ctaLabel
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GameColors.skyTop,
  },
  sky: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  hitLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 1,
  },
  cloud: {
    position: 'absolute',
    backgroundColor: GameColors.cloud,
    borderRadius: 999,
  },
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  brand: {
    fontFamily: GameFonts.display,
    fontSize: 28,
    letterSpacing: 0.5,
    color: GameColors.lemon,
    flexShrink: 1,
  },
  bestPill: {
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GameColors.ink,
    backgroundColor: '#FFF4C2',
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
  statsBlock: {
    marginTop: 6,
    alignItems: 'center',
  },
  bigScore: {
    fontFamily: GameFonts.display,
    fontSize: 56,
    lineHeight: 60,
    color: GameColors.white,
  },
  ptsLabel: {
    marginTop: -2,
    fontFamily: GameFonts.body,
    fontSize: 16,
    letterSpacing: 2,
    color: GameColors.ink,
  },
  levelText: {
    marginTop: 4,
    fontFamily: GameFonts.body,
    fontSize: 18,
    letterSpacing: 1,
    color: GameColors.ink,
  },
  meterStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  bannerWrap: {
    minHeight: 84,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  banner: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: GameColors.ink,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  bannerGood: {
    backgroundColor: GameColors.bubble,
  },
  bannerBad: {
    backgroundColor: '#FF8B8B',
  },
  feedback: {
    fontFamily: GameFonts.display,
    fontSize: 32,
    lineHeight: 36,
    textAlign: 'center',
  },
  points: {
    marginTop: 2,
    fontFamily: GameFonts.display,
    fontSize: 24,
    color: GameColors.lemon,
  },
  gameOverSub: {
    marginTop: 4,
    fontFamily: GameFonts.body,
    fontSize: 17,
    color: GameColors.ink,
  },
  prompt: {
    fontFamily: GameFonts.display,
    fontSize: 24,
    color: GameColors.white,
    textAlign: 'center',
  },
  cta: {
    width: '86%',
    height: 56,
    marginBottom: 4,
  },
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
  ctaText: {
    fontFamily: GameFonts.body,
    fontSize: 22,
    color: GameColors.white,
    letterSpacing: 1,
  },
});
