import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
import { OutlineText } from '@/game/OutlineText';
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
      withSpring(1.22, { damping: 7, stiffness: 240 }),
      withSpring(1, { damping: 11, stiffness: 180 }),
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
    opacity: flash.value * 0.28,
  }));

  const showingResult = Boolean(outcome && (phase === 'result' || phase === 'gameover'));
  const feedback = showingResult
    ? `${outcome!.label.toUpperCase()}!`
    : phase === 'ready'
      ? 'TAP TO START'
      : phase === 'filling'
        ? 'TAP TO STOP'
        : 'KEEP GOING';

  const feedbackColor =
    phase === 'gameover' || outcome?.result === 'miss'
      ? GameColors.scoreBad
      : outcome?.label === 'Perfect'
        ? GameColors.lemon
        : outcome?.label === 'Great'
          ? GameColors.liquidHigh
          : outcome?.result === 'zone'
            ? GameColors.white
            : GameColors.white;

  const ctaLabel =
    phase === 'gameover' ? 'RETRY' : phase === 'ready' ? 'PLAY' : phase === 'result' ? 'NEXT' : 'STOP';

  return (
    <Pressable style={styles.root} onPress={onTap}>
      <LinearGradient
        colors={[GameColors.skyTop, GameColors.skyMid, GameColors.skyBottom]}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.cloud, styles.cloudA]} />
      <View style={[styles.cloud, styles.cloudB]} />
      <View style={[styles.cloud, styles.cloudC]} />

      <View style={styles.hillBack} />
      <View style={styles.hillFront} />

      <View style={[styles.ground, { height: 54 + insets.bottom }]}>
        <View style={styles.hazard} />
        <View style={[styles.hazardStripe, { left: 0 }]} />
        <View style={[styles.hazardStripe, { left: 48 }]} />
        <View style={[styles.hazardStripe, { left: 96 }]} />
        <View style={[styles.hazardStripe, { left: 144 }]} />
        <View style={[styles.hazardStripe, { left: 192 }]} />
        <View style={[styles.hazardStripe, { left: 240 }]} />
        <View style={[styles.hazardStripe, { left: 288 }]} />
        <View style={[styles.hazardStripe, { left: 336 }]} />
      </View>

      <Animated.View style={[styles.flash, flashStyle]} pointerEvents="none" />

      <View style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 }]}>
        <OutlineText style={styles.brand} color={GameColors.lemon} outlineWidth={3}>
          ZONE METER
        </OutlineText>

        <OutlineText style={styles.bigScore} outlineWidth={4}>
          {String(score)}
        </OutlineText>

        <View style={styles.hudRow}>
          <View style={[styles.chip, styles.chipGreen]}>
            <Text style={styles.chipLabel}>LVL</Text>
            <Text style={styles.chipValue}>{round.level}</Text>
          </View>
          <View style={[styles.chip, styles.chipGold]}>
            <Text style={styles.chipLabel}>BEST</Text>
            <Text style={styles.chipValue}>{highScore}</Text>
          </View>
        </View>

        <Animated.View style={[styles.meterStage, shakeStyle]}>
          <VerticalMeter fill={fill} round={round} />
        </Animated.View>

        <Animated.View style={[styles.bannerWrap, popStyle]}>
          {showingResult ? (
            <View
              style={[
                styles.banner,
                phase === 'gameover' ? styles.bannerBad : styles.bannerGood,
              ]}>
              <View style={[styles.speedLine, styles.speedLeft]} />
              <View style={[styles.speedLine, styles.speedRight]} />
              <Text style={styles.sparkleLeft}>✦</Text>
              <Text style={styles.sparkleRight}>✦</Text>
              <OutlineText style={styles.feedback} color={feedbackColor} outlineWidth={3}>
                {feedback}
              </OutlineText>
              {outcome && outcome.result !== 'miss' ? (
                <OutlineText style={styles.points} color={GameColors.lemon} outlineWidth={2}>
                  {`+${outcome.points}`}
                </OutlineText>
              ) : null}
              {phase === 'gameover' ? (
                <Text style={styles.gameOverSub}>
                  {isNewBest ? 'NEW BEST!' : `Final ${score}`}
                </Text>
              ) : null}
            </View>
          ) : (
            <OutlineText style={styles.prompt} color={GameColors.white} outlineWidth={2}>
              {feedback}
            </OutlineText>
          )}
        </Animated.View>

        <View style={styles.cta}>
          <View style={styles.ctaShadow} />
          <View style={styles.ctaFace}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </View>
        </View>
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
    paddingHorizontal: 20,
    alignItems: 'center',
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
    bottom: 70,
    height: 120,
    borderTopLeftRadius: 140,
    borderTopRightRadius: 140,
    backgroundColor: GameColors.hillDark,
  },
  hillFront: {
    position: 'absolute',
    left: -20,
    right: -20,
    bottom: 48,
    height: 90,
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
    height: 18,
    backgroundColor: GameColors.groundStripe,
    borderTopWidth: 3,
    borderColor: GameColors.ink,
  },
  hazardStripe: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 18,
    backgroundColor: GameColors.ink,
    transform: [{ skewX: '-28deg' }],
    opacity: 0.85,
  },
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
  },
  brand: {
    fontSize: 28,
    letterSpacing: 1,
  },
  bigScore: {
    marginTop: 6,
    fontSize: 56,
    lineHeight: 60,
  },
  hudRow: {
    marginTop: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  chip: {
    minWidth: 96,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: GameColors.ink,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: GameColors.panel,
  },
  chipGreen: {
    borderBottomWidth: 6,
    borderColor: GameColors.bubbleDark,
    backgroundColor: '#E8FFD9',
  },
  chipGold: {
    borderBottomWidth: 6,
    borderColor: '#E0A800',
    backgroundColor: '#FFF4C2',
  },
  chipLabel: {
    fontFamily: GameFonts.soft,
    fontSize: 11,
    letterSpacing: 1,
    color: GameColors.panelInk,
  },
  chipValue: {
    fontFamily: GameFonts.body,
    fontSize: 22,
    color: GameColors.ink,
    marginTop: 1,
  },
  meterStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  bannerWrap: {
    minHeight: 92,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  banner: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 4,
    borderColor: GameColors.ink,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerGood: {
    backgroundColor: GameColors.bubble,
  },
  bannerBad: {
    backgroundColor: '#FF8B8B',
  },
  speedLine: {
    position: 'absolute',
    top: 18,
    width: 34,
    height: 5,
    borderRadius: 4,
    backgroundColor: GameColors.speedLine,
  },
  speedLeft: { left: 16, transform: [{ rotate: '-18deg' }] },
  speedRight: { right: 16, transform: [{ rotate: '18deg' }] },
  sparkleLeft: {
    position: 'absolute',
    left: 18,
    bottom: 12,
    color: GameColors.white,
    fontSize: 16,
  },
  sparkleRight: {
    position: 'absolute',
    right: 18,
    bottom: 12,
    color: GameColors.white,
    fontSize: 16,
  },
  feedback: {
    fontSize: 34,
    lineHeight: 38,
  },
  points: {
    marginTop: 2,
    fontSize: 26,
  },
  gameOverSub: {
    marginTop: 4,
    fontFamily: GameFonts.body,
    fontSize: 18,
    color: GameColors.ink,
  },
  prompt: {
    fontSize: 26,
  },
  cta: {
    width: '86%',
    height: 58,
    marginBottom: 4,
  },
  ctaShadow: {
    ...StyleSheet.absoluteFill,
    top: 5,
    borderRadius: 18,
    backgroundColor: GameColors.playBlueDark,
    borderWidth: 3,
    borderColor: GameColors.ink,
  },
  ctaFace: {
    height: 54,
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
