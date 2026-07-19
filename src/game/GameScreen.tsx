import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GameColors, GameFonts } from '@/constants/gameTheme';
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
  const phaseRef = useRef<Phase>('ready');
  const roundRef = useRef(round);
  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    highScoreRef.current = highScore;
  }, [highScore]);

  useEffect(() => {
    loadHighScore().then(setHighScore);
  }, []);

  const bumpPop = () => {
    pop.value = withSequence(
      withSpring(1.18, { damping: 8, stiffness: 220 }),
      withSpring(1, { damping: 12, stiffness: 180 }),
    );
  };

  const shake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 40 }),
      withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 45 }),
      withTiming(6, { duration: 40 }),
      withTiming(0, { duration: 40 }),
    );
  };

  const finishRound = useCallback(
    (value: number) => {
      const current = roundRef.current;
      const result = scoreFill(value, current);
      setOutcome(result);
      bumpPop();
      flash.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 220 }),
      );

      if (result.result === 'miss') {
        play('miss');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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

      if (result.result === 'perfect') {
        play('perfect');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        play('zone');
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }

      setScore((s) => s + result.points);
      setPhase('result');
      phaseRef.current = 'result';
    },
    [flash, play],
  );

  const startFill = useCallback(() => {
    const current = roundRef.current;
    setOutcome(null);
    setPhase('filling');
    phaseRef.current = 'filling';
    fill.value = 0;
    play('start');

    fill.value = withTiming(
      1,
      { duration: current.fillMs, easing: Easing.linear },
      (finished) => {
        if (finished) {
          runOnJS(finishRound)(1);
        }
      },
    );
  }, [fill, finishRound, play]);

  const onTap = () => {
    if (phaseRef.current === 'ready') {
      startFill();
      return;
    }

    if (phaseRef.current === 'filling') {
      cancelAnimation(fill);
      play('tap');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      finishRound(fill.value);
      return;
    }

    if (phaseRef.current === 'result') {
      const nextLevel = roundRef.current.level + 1;
      const next = makeRound(nextLevel);
      setRound(next);
      roundRef.current = next;
      fill.value = 0;
      setOutcome(null);
      startFill();
      return;
    }

    if (phaseRef.current === 'gameover') {
      const next = makeRound(1);
      setRound(next);
      roundRef.current = next;
      setScore(0);
      scoreRef.current = 0;
      setOutcome(null);
      setIsNewBest(false);
      fill.value = 0;
      startFill();
    }
  };

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.35,
  }));

  const feedback =
    outcome && (phase === 'result' || phase === 'gameover')
      ? `${outcome.label.toUpperCase()}!`
      : phase === 'ready'
        ? 'TAP TO START'
        : phase === 'filling'
          ? 'TAP TO STOP'
          : 'TAP FOR NEXT';

  const feedbackColor =
    phase === 'gameover' || outcome?.result === 'miss'
      ? GameColors.scoreBad
      : outcome?.label === 'Perfect'
        ? GameColors.perfect
        : outcome?.label === 'Great'
          ? '#EA580C'
          : outcome?.result === 'zone'
            ? GameColors.scoreGood
            : GameColors.ink;

  return (
    <Pressable style={styles.root} onPress={onTap}>
      <LinearGradient
        colors={[GameColors.skyTop, GameColors.skyMid, GameColors.skyBottom]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.stripe, styles.stripeA]} />
      <View style={[styles.stripe, styles.stripeB]} />
      <View style={[styles.stripe, styles.stripeC]} />

      <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />

      <View style={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brand}>ZONE</Text>
            <Text style={styles.brandAccent}>METER</Text>
          </View>
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>BEST</Text>
            <Text style={styles.scoreValue}>{highScore}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.stat}>LVL {round.level}</Text>
          <Text style={styles.stat}>SCORE {score}</Text>
        </View>

        <Animated.View style={[styles.meterStage, shakeStyle]}>
          <VerticalMeter fill={fill} round={round} />
        </Animated.View>

        <Animated.View style={[styles.feedbackWrap, popStyle]}>
          <Text style={[styles.feedback, { color: feedbackColor }]}>{feedback}</Text>
          {outcome && outcome.result !== 'miss' ? (
            <Text style={styles.points}>+{outcome.points}</Text>
          ) : null}
          {phase === 'gameover' ? (
            <Text style={styles.gameOverSub}>
              {isNewBest ? 'NEW BEST!' : `Final ${score}`}
            </Text>
          ) : null}
        </Animated.View>

        <Text style={styles.hint}>
          {phase === 'gameover' ? 'tap to retry' : 'one tap. nail the red line.'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: GameColors.skyTop,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stripe: {
    position: 'absolute',
    width: 180,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{ rotate: '-18deg' }],
  },
  stripeA: { top: 120, left: -40 },
  stripeB: { top: 280, right: -50 },
  stripeC: { bottom: 160, left: 20 },
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  brand: {
    fontFamily: GameFonts.display,
    fontSize: 34,
    color: GameColors.ink,
    lineHeight: 36,
    letterSpacing: 1,
  },
  brandAccent: {
    fontFamily: GameFonts.display,
    fontSize: 34,
    color: GameColors.cream,
    lineHeight: 36,
    marginTop: -2,
    textShadowColor: GameColors.ink,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  scoreBox: {
    backgroundColor: GameColors.panel,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 88,
    alignItems: 'center',
  },
  scoreLabel: {
    fontFamily: GameFonts.soft,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    letterSpacing: 1,
  },
  scoreValue: {
    fontFamily: GameFonts.display,
    color: GameColors.white,
    fontSize: 22,
    marginTop: 2,
  },
  statsRow: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontFamily: GameFonts.body,
    fontSize: 18,
    color: GameColors.ink,
  },
  meterStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackWrap: {
    alignItems: 'center',
    minHeight: 88,
    justifyContent: 'center',
    gap: 4,
  },
  feedback: {
    fontFamily: GameFonts.display,
    fontSize: 28,
    textAlign: 'center',
  },
  points: {
    fontFamily: GameFonts.body,
    fontSize: 28,
    color: GameColors.ink,
  },
  gameOverSub: {
    fontFamily: GameFonts.body,
    fontSize: 20,
    color: GameColors.ink,
  },
  hint: {
    fontFamily: GameFonts.soft,
    textAlign: 'center',
    color: 'rgba(15,23,42,0.7)',
    fontSize: 14,
    marginTop: 8,
  },
});
