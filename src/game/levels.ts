import type { RoundConfig, RoundOutcome } from './types';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Fast early ramp that approaches 1, never quite finishes. */
function ramp(level: number, halfLife: number) {
  return 1 - Math.exp(-(Math.max(1, level) - 1) / halfLife);
}

/** Slow forever-growth used after the main ramp softens. */
function grind(level: number) {
  return Math.log2(1 + Math.max(0, level - 1) * 0.15);
}

/**
 * Infinite increasing difficulty for Zone Meter.
 *
 * Early levels: big jumps in speed + tighter zones.
 * Deep runs: keeps getting harder via a log grind (never flatlines).
 */
export function makeRound(level: number, previousTarget?: number): RoundConfig {
  const n = Math.max(1, level);

  const speedR = ramp(n, 13);
  const zoneR = ramp(n, 15);
  const placeR = ramp(n, 18);
  const g = grind(n);

  // Speed: 1700ms → ~420ms on the main ramp, then keeps shedding ms forever
  const fillMs = Math.round(clamp(lerp(1700, 420, speedR) - g * 22, 240, 1700));

  // Zone band: ~24% → ~6% on the main ramp, then slowly narrower forever
  const zoneHalf = clamp(lerp(0.12, 0.03, zoneR) - g * 0.0028, 0.012, 0.12);

  // Perfect window stays a fraction of the zone, tightening with level
  const perfectRatio = lerp(0.32, 0.16, ramp(n, 17));
  const perfectHalf = clamp(zoneHalf * perfectRatio, 0.005, 0.035);

  // Targets drift toward edges as levels climb (harder timing reads)
  const edgePad = clamp(lerp(0.12, 0.035, placeR) - g * 0.003, 0.02, 0.12);
  const min = zoneHalf + edgePad;
  const max = 1 - zoneHalf - edgePad * 0.7;

  let target = min + Math.random() * Math.max(0.01, max - min);

  if (previousTarget != null) {
    let tries = 0;
    while (Math.abs(target - previousTarget) < 0.09 && tries < 6) {
      target = min + Math.random() * Math.max(0.01, max - min);
      tries += 1;
    }
  }

  return { level: n, target, zoneHalf, perfectHalf, fillMs };
}

/** Points scale with level so deep runs feel rewarding. */
export function scoreFill(fill: number, round: RoundConfig): RoundOutcome {
  const distance = Math.abs(fill - round.target);
  const levelBonus = 1 + (round.level - 1) * 0.045;

  if (distance <= round.perfectHalf) {
    return {
      result: 'perfect',
      label: 'Perfect',
      fill,
      points: Math.round(100 * levelBonus),
      distance,
    };
  }

  if (distance <= round.zoneHalf) {
    const t = 1 - distance / round.zoneHalf;
    const points = Math.round((20 + t * 60) * levelBonus);
    const label = t >= 0.66 ? 'Great' : t >= 0.33 ? 'Good' : 'Nice';
    return { result: 'zone', label, fill, points, distance };
  }

  return { result: 'miss', label: 'Miss', fill, points: 0, distance };
}
