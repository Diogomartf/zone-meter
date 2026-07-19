import type { RoundConfig } from './types';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function ramp(level: number, halfLife: number) {
  return 1 - Math.exp(-(Math.max(1, level) - 1) / halfLife);
}

function grind(level: number) {
  return Math.log2(1 + Math.max(0, level - 1) * 0.15);
}

/** Tiny seeded RNG for daily challenge reproducibility */
export function createRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export type MakeRoundOptions = {
  previousTarget?: number;
  rng?: () => number;
};

/**
 * Infinite increasing difficulty.
 * Levels 1–3 are intentionally gentler (tutorial pacing).
 */
export function makeRound(level: number, opts: MakeRoundOptions = {}): RoundConfig {
  const n = Math.max(1, level);
  const rand = opts.rng ?? Math.random;
  const tutorial = n <= 3;

  const speedR = ramp(n, tutorial ? 20 : 13);
  const zoneR = ramp(n, tutorial ? 22 : 15);
  const placeR = ramp(n, tutorial ? 28 : 18);
  const g = grind(n);

  let fillMs = Math.round(clamp(lerp(1700, 420, speedR) - g * 22, 240, 1900));
  let zoneHalf = clamp(lerp(0.12, 0.03, zoneR) - g * 0.0028, 0.012, 0.14);

  if (tutorial) {
    fillMs = Math.round(lerp(1900, 1500, (n - 1) / 2));
    zoneHalf = lerp(0.14, 0.11, (n - 1) / 2);
  }

  const perfectRatio = tutorial ? 0.36 : lerp(0.32, 0.16, ramp(n, 17));
  const perfectHalf = clamp(zoneHalf * perfectRatio, 0.005, 0.04);

  const edgePad = tutorial
    ? 0.14
    : clamp(lerp(0.12, 0.035, placeR) - g * 0.003, 0.02, 0.12);
  const min = zoneHalf + edgePad;
  const max = 1 - zoneHalf - edgePad * 0.7;

  let target = min + rand() * Math.max(0.01, max - min);
  if (opts.previousTarget != null) {
    let tries = 0;
    while (Math.abs(target - opts.previousTarget) < 0.09 && tries < 6) {
      target = min + rand() * Math.max(0.01, max - min);
      tries += 1;
    }
  }

  // Moving / shrinking unlock after early levels
  const moving = !tutorial && n >= 6 && rand() < clamp(0.2 + n * 0.02, 0.2, 0.7);
  const shrinking = !tutorial && n >= 8 && rand() < clamp(0.15 + n * 0.015, 0.15, 0.55);

  let targetEnd: number | undefined;
  if (moving) {
    targetEnd = min + rand() * Math.max(0.01, max - min);
    if (Math.abs(targetEnd - target) < 0.12) {
      targetEnd = clamp(target + (rand() > 0.5 ? 0.16 : -0.16), min, max);
    }
  }

  const zoneHalfEnd = shrinking ? clamp(zoneHalf * lerp(0.72, 0.55, ramp(n, 20)), 0.01, zoneHalf) : undefined;

  // Vary meter size for visual variety (still readable)
  const sizeRoll = rand();
  const meterScale = tutorial
    ? 1
    : sizeRoll < 0.25
      ? 0.78
      : sizeRoll < 0.5
        ? 0.9
        : sizeRoll < 0.8
          ? 1
          : 1.12;

  return {
    level: n,
    target,
    targetEnd,
    zoneHalf,
    zoneHalfEnd,
    perfectHalf,
    fillMs,
    moving,
    shrinking,
    meterScale,
  };
}

/** Resolve live zone position/size at fill progress t (0–1). */
export function zoneAt(round: RoundConfig, t: number) {
  const target =
    round.moving && round.targetEnd != null
      ? lerp(round.target, round.targetEnd, t)
      : round.target;
  const zoneHalf =
    round.shrinking && round.zoneHalfEnd != null
      ? lerp(round.zoneHalf, round.zoneHalfEnd, t)
      : round.zoneHalf;
  return { target, zoneHalf, perfectHalf: round.perfectHalf };
}
