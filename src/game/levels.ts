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
  // Extremely slow long-term pressure
  return Math.log2(1 + Math.max(0, level - 1) * 0.02);
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
 * Levels 1–10 are intentionally wide / hard to miss, then a long slow grind.
 */
export function makeRound(level: number, opts: MakeRoundOptions = {}): RoundConfig {
  const n = Math.max(1, level);
  const rand = opts.rng ?? Math.random;
  const easy = n <= 10;
  const easyT = easy ? (n - 1) / 9 : 1; // 0 at lvl1 → 1 at lvl10

  // Difficulty ramps from level 11 onward — very long half-lives, barely tightens for a long stretch
  const hardLevel = Math.max(1, n - 10);
  const speedR = ramp(hardLevel, 90);
  const zoneR = ramp(hardLevel, 100);
  const placeR = ramp(hardLevel, 110);
  const g = grind(hardLevel);

  let fillMs: number;
  let zoneHalf: number;

  if (easy) {
    // Slow fills — focus / timing, not reaction
    // Compact bullseye early — ~24% of the meter at lvl1
    fillMs = Math.round(lerp(4200, 3400, easyT));
    zoneHalf = lerp(0.12, 0.08, easyT);
  } else {
    // Pick up from the end of the easy stretch; stays deliberate even deep
    fillMs = Math.round(clamp(lerp(3400, 2000, speedR) - g * 20, 1600, 3600));
    zoneHalf = clamp(lerp(0.08, 0.035, zoneR) - g * 0.0008, 0.014, 0.08);
  }
  // +15% fill velocity
  fillMs = Math.round(fillMs / 1.15);

  // Bullseye: Perfect (center) → Great → Nice (to markers / zoneHalf)
  const perfectRatio = easy ? lerp(0.14, 0.12, easyT) : lerp(0.12, 0.09, ramp(n, 90));
  const greatRatio = easy ? lerp(0.62, 0.58, easyT) : lerp(0.58, 0.52, ramp(n, 90));
  const perfectHalf = clamp(zoneHalf * perfectRatio, 0.005, easy ? 0.032 : 0.02);
  const greatHalf = clamp(zoneHalf * greatRatio, perfectHalf + 0.008, zoneHalf - 0.008);

  const edgePad = easy
    ? lerp(0.08, 0.12, easyT)
    : clamp(lerp(0.12, 0.055, placeR) - g * 0.0008, 0.03, 0.12);
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

  // Moving / shrinking arrive much later and stay uncommon for a long time
  const moving = !easy && n >= 28 && rand() < clamp(0.08 + (n - 28) * 0.004, 0.08, 0.4);
  const shrinking = !easy && n >= 35 && rand() < clamp(0.06 + (n - 35) * 0.003, 0.06, 0.3);

  let targetEnd: number | undefined;
  if (moving) {
    targetEnd = min + rand() * Math.max(0.01, max - min);
    if (Math.abs(targetEnd - target) < 0.12) {
      targetEnd = clamp(target + (rand() > 0.5 ? 0.16 : -0.16), min, max);
    }
  }

  const zoneHalfEnd = shrinking ? clamp(zoneHalf * lerp(0.85, 0.7, ramp(n, 100)), 0.016, zoneHalf) : undefined;

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
    greatHalf,
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
  const scale = round.zoneHalf > 0 ? zoneHalf / round.zoneHalf : 1;
  return {
    target,
    zoneHalf,
    greatHalf: round.greatHalf * scale,
    perfectHalf: round.perfectHalf * scale,
  };
}
