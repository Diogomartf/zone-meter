import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { RoundLabel } from '@/game/types';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

async function safe(run: () => Promise<unknown>) {
  if (!enabled) return;
  try {
    await run();
  } catch {
    // Simulators / web can reject haptics — ignore.
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const gameHaptics = {
  /** Big punch when the player taps to stop */
  stop() {
    return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },

  /** Soft kick when a round starts filling */
  start() {
    return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },

  /** Countdown beat — ramps up into GO */
  countdownTick(n: number) {
    if (n <= 0) {
      return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
    }
    if (n === 1) {
      return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    }
    return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /** Advance / retry */
  next() {
    return safe(() => Haptics.selectionAsync());
  },

  /** Light tick when liquid crosses into the zone */
  zoneEnter() {
    return safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /** Graded result buzz */
  async result(label: RoundLabel) {
    if (!enabled) return;

    switch (label) {
      case 'Perfect':
        await safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        await sleep(40);
        await safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
        await sleep(50);
        await safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
        break;
      case 'Great':
        await safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        await sleep(30);
        await safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
        break;
      case 'Good':
        await safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
        break;
      case 'Nice':
        await safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
        break;
      case 'Miss':
        await safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
        await sleep(35);
        await safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
        break;
    }
  },
};
