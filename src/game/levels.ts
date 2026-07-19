import type { RoundConfig, RoundOutcome } from './types';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Smooth 0→1 curve that never fully finishes.
 * Early levels ramp hard; later levels keep inching forever.
 */
function difficulty(level: number, halfLife: number) {
  const n = Math.max(1, level);
  // Primary ramp (most of the feel in the first ~2–3 half-lives)
  const primary = 1 - Math.exp(-(n - 1) / halfLife);
  // Slow infinite grind so it never plateaus flat
  const grind = Math.log2(1 + (n - 1) * 0.12) / 10;
  return clamp(primary + grind, 0, 1.35);
}

/**
 * Infinite increasing difficulty for Zone Meter.
 *
 * Axes that get harder forever (with soft floors so it's still human-playable):
 * - fill speed (faster)
 * - zone size (smaller)
 * - perfect window (tighter)
 * - target placement (more extreme / less center-biased)
 */
export function makeRound(level: number, previousTarget?: number): RoundConfig {
  const n = Math.max(1, level);

  const speedT = difficulty(n, 14);
  const zoneT = difficulty(n, 16);
  const perfectT = difficulty(n, 18);
  const placeT = difficulty(n, 20);

  // ~1700ms → approaches ~380ms, still slowly dropping via grind
  const fillMs = Math.round(clamp(lerp(1700, 380, Math.min(speedT, 1)) - Math.max(0, speedT - 1) * 40, 300, 1700));

  // Zone half-width ~0.12 → ~0.025 (full band ~24% → ~5%)
  const zoneHalf = clamp(lerp(0.12, 0.025, Math.min(zoneT, 1)) - Math.max(0, zoneT - 1) * 0.004, 0.018, 0.12);

  // Perfect window scales with zone, but tightens a bit faster
  const perfectHalf = clamp(
    lerp(zoneHalf * 0.32, zoneHalf * 0.18, Math.min(perfectT, 1)),
    0.006,
    0.035,
  );

  // Early: bias toward mid meter. Late: allow near edges (harder reads)
  const edgePad = lerp(0.12, 0.04, Math.min(placeT, 1));
  const min = zoneHalf + edgePad;
  const max = 1 - zoneHalf - edgePad * 0.75;

  let target = min + Math.random() * Math.max(0.01, max - min);

  // Avoid nearly-identical targets back-to-back
  if (previousTarget != null) {
    let tries = 0;
    while (Math.abs(target - previousTarget) < 0.08 && tries < 6) {
      target = min + Math.random() * Math.max(0.01, max - min);
      tries += 1;
    }
  }

  return { level: n, target, zoneHalf, perfectHalf, fillMs };
}

/** Points scale gently with level so deep runs feel rewarding. */
export function scoreFill(fill: number, round: RoundConfig): RoundOutcome {
  const distance = Math.abs(fill - round.target);
  const levelBonus = 1 + (round.level - 1) * 0.04;

  if (distance <= round.perfectHalf) {
    const points = Math.round(100 * levelBonus);
    return { result: 'perfect', label: 'Perfect', fill, points, distance };
  }

  if (distance <= round.zoneHalf) {
    const t = 1 - distance / round.zoneHalf;
    const base = 20 + t * 60;
    const points = Math.round(base * levelBonus);
    const label = t >= 0.66 ? 'Great' : t >= 0.33 ? 'Good' : 'Nice';
    return { result: 'zone', label, fill, points, distance };
  }

  return { result: 'miss', label: 'Miss', fill, points: 0, distance };
}
