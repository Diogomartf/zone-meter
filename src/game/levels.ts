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
 * Levels 1–10 are intentionally wide / hard to miss, then the grind starts.
 */
export function makeRound(level: number, opts: MakeRoundOptions = {}): RoundConfig {
  const n = Math.max(1, level);
  const rand = opts.rng ?? Math.random;
  const easy = n <= 10;
  const easyT = easy ? (n - 1) / 9 : 1; // 0 at lvl1 → 1 at lvl10

  // Difficulty ramps from level 11 onward so the easy stretch doesn't cliff
  const hardLevel = Math.max(1, n - 10);
  const speedR = ramp(hardLevel, 16);
  const zoneR = ramp(hardLevel, 18);
  const placeR = ramp(hardLevel, 20);
  const g = grind(hardLevel);

  let fillMs: number;
  let zoneHalf: number;

  if (easy) {
    // Huge hit windows early — ~48% of the meter at lvl1, still generous at lvl10
    fillMs = Math.round(lerp(2100, 1550, easyT));
    zoneHalf = lerp(0.24, 0.13, easyT);
  } else {
    // Pick up from the end of the easy stretch and tighten gradually
    fillMs = Math.round(clamp(lerp(1550, 420, speedR) - g * 22, 240, 1600));
    zoneHalf = clamp(lerp(0.13, 0.03, zoneR) - g * 0.0028, 0.012, 0.13);
  }

  const perfectRatio = easy ? lerp(0.42, 0.34, easyT) : lerp(0.32, 0.16, ramp(n, 17));
  const perfectHalf = clamp(zoneHalf * perfectRatio, 0.005, easy ? 0.09 : 0.04);

  const edgePad = easy
    ? lerp(0.08, 0.12, easyT)
    : clamp(lerp(0.12, 0.035, placeR) - g * 0.003, 0.02, 0.12);
  const min = zoneHalf + edgePad;
  const max = 1 - zoneHalf - edgePad * 0.7;

  let target = min + rand() * Math.max(0.01, max - min);
  if (easy) {
    // Keep early targets near the middle so the fat zone covers most taps
    const mid = 0.5;
    const spread = lerp(0.08, 0.18, easyT);
    target = clamp(mid + (rand() - 0.5) * 2 * spread, min, max);
  } else if (opts.previousTarget != null) {
    let tries = 0;
    while (Math.abs(target - opts.previousTarget) < 0.09 && tries < 6) {
      target = min + rand() * Math.max(0.01, max - min);
      tries += 1;
    }
  }

  // Moving / shrinking only after the easy stretch
  const moving = !easy && n >= 12 && rand() < clamp(0.2 + (n - 12) * 0.02, 0.2, 0.7);
  const shrinking = !easy && n >= 14 && rand() < clamp(0.15 + (n - 14) * 0.015, 0.15, 0.55);

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
  const meterScale = easy
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
