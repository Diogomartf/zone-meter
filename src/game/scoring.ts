import { zoneAt } from '@/game/levels';
import type { RoundConfig, RoundLabel, RoundOutcome } from '@/game/types';

export const STARTING_LIVES = 3;
export const MAX_COMBO_MULT = 5;
/** Barely under the zone = survive as Close */
export const NEAR_MISS_SLACK = 0.045;
/** Depth scaling on base points — a bit more reward for going further */
export const LEVEL_BONUS_PER_LEVEL = 0.055;

export function comboMultiplier(combo: number) {
  return Math.min(MAX_COMBO_MULT, 1 + Math.max(0, combo) * 0.25);
}

export function nextCombo(prev: number, label: RoundLabel) {
  if (label === 'Perfect' || label === 'Great') return prev + 1;
  if (label === 'Good') return prev;
  if (label === 'Nice' || label === 'Close') return Math.max(0, prev - 1);
  return 0;
}

/** Flat bonus for clearing milestone levels (hit only — misses don't pay). */
export function milestoneClearBonus(level: number): number {
  if (level < 5) return 0;
  if (level % 10 === 0) return 220;
  if (level % 5 === 0) return 90;
  return 0;
}

export function scoreFill(
  fill: number,
  round: RoundConfig,
  comboBefore: number,
): RoundOutcome {
  // Judge against the zone at the moment they stopped
  const live = zoneAt(round, fill);
  const distance = Math.abs(fill - live.target);
  const levelBonus = 1 + (round.level - 1) * LEVEL_BONUS_PER_LEVEL;
  const milestone = milestoneClearBonus(round.level);
  // Level 1 teaches the tap — combo kicks in from level 2
  const comboActive = round.level > 1;
  const streak = comboActive ? comboBefore : 0;
  const mult = comboMultiplier(streak);

  if (distance <= live.perfectHalf) {
    const basePoints = Math.round(100 * levelBonus);
    const points = Math.round(basePoints * mult) + milestone;
    return {
      result: 'perfect',
      label: 'Perfect',
      fill,
      basePoints,
      points,
      distance,
      combo: comboActive ? streak + 1 : 0,
      multiplier: mult,
      coins: 5 + Math.floor(streak / 2) + (milestone > 0 ? 2 : 0),
      costsLife: false,
    };
  }

  if (distance <= live.zoneHalf) {
    const t = 1 - distance / live.zoneHalf;
    const label: RoundLabel = t >= 0.66 ? 'Great' : t >= 0.33 ? 'Good' : 'Nice';
    const basePoints = Math.round((20 + t * 60) * levelBonus);
    const points = Math.round(basePoints * mult) + milestone;
    const combo = comboActive ? nextCombo(streak, label) : 0;
    return {
      result: 'zone',
      label,
      fill,
      basePoints,
      points,
      distance,
      combo,
      multiplier: mult,
      coins: (label === 'Great' ? 3 : label === 'Good' ? 2 : 1) + (milestone > 0 ? 1 : 0),
      costsLife: false,
    };
  }

  // Hold-your-nerve: barely UNDER the zone survives; overshoot does not
  const zoneLow = live.target - live.zoneHalf;
  const underBy = zoneLow - fill;
  if (underBy > 0 && underBy <= NEAR_MISS_SLACK) {
    const basePoints = Math.round(12 * levelBonus);
    const points = Math.round(basePoints * Math.max(1, mult * 0.5)) + milestone;
    return {
      result: 'near',
      label: 'Close',
      fill,
      basePoints,
      points,
      distance,
      combo: comboActive ? nextCombo(streak, 'Close') : 0,
      multiplier: mult,
      coins: 1 + (milestone > 0 ? 1 : 0),
      costsLife: false,
    };
  }

  return {
    result: 'miss',
    label: 'Miss',
    fill,
    basePoints: 0,
    points: 0,
    distance,
    combo: 0,
    multiplier: 1,
    coins: 0,
    costsLife: true,
  };
}
