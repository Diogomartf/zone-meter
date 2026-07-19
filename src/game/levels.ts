import type { RoundConfig, RoundOutcome } from './types';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function makeRound(level: number): RoundConfig {
  const zoneHalf = clamp(0.11 - level * 0.006, 0.04, 0.11);
  const perfectHalf = clamp(zoneHalf * 0.28, 0.012, 0.03);
  const fillMs = clamp(1600 - level * 70, 650, 1600);
  // Keep targets playable — not glued to the floor/ceiling
  const min = zoneHalf + 0.08;
  const max = 1 - zoneHalf - 0.05;
  const target = min + Math.random() * (max - min);

  return { level, target, zoneHalf, perfectHalf, fillMs };
}

export function scoreFill(fill: number, round: RoundConfig): RoundOutcome {
  const distance = Math.abs(fill - round.target);

  if (distance <= round.perfectHalf) {
    return { result: 'perfect', fill, points: 100, distance };
  }

  if (distance <= round.zoneHalf) {
    const t = 1 - distance / round.zoneHalf;
    const points = Math.round(20 + t * 60);
    return { result: 'zone', fill, points, distance };
  }

  return { result: 'miss', fill, points: 0, distance };
}
