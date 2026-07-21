import type { RoundConfig } from "./types";

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
 * Infinite increasing difficulty — a focus / timing game, not a reaction game.
 * Pace stays deliberate; challenge comes from a tighter aim window.
 */
export function makeRound(
  level: number,
  opts: MakeRoundOptions = {},
): RoundConfig {
  const n = Math.max(1, level);
  const rand = opts.rng ?? Math.random;
  const easy = n <= 10;
  const easyT = easy ? (n - 1) / 9 : 1; // 0 at lvl1 → 1 at lvl10

  // Zone width carries the grind; speed barely moves so taps stay considered
  const hardLevel = Math.max(1, n - 10);
  const speedR = ramp(hardLevel, 160);
  const zoneR = ramp(hardLevel, 75);
  const placeR = ramp(hardLevel, 120);
  const g = grind(hardLevel);

  let fillMs: number;
  let zoneHalf: number;

  if (easy) {
    // Slow, watchable fills — teach the commit, not reflexes
    fillMs = Math.round(lerp(4600, 3800, easyT));
    // Readable early, then a modest shrink into the midgame
    zoneHalf = lerp(0.082, 0.048, easyT);
  } else {
    // Still deliberate deep in a run — never races the player
    fillMs = Math.round(clamp(lerp(3800, 3000, speedR) - g * 12, 2600, 4000));
    // Precision pressure: outer Nice tightens first
    zoneHalf = clamp(lerp(0.048, 0.022, zoneR) - g * 0.001, 0.014, 0.055);
  }
  // +30% fill velocity
  fillMs = Math.round(fillMs / 1.469);

  // Slim Perfect strike; Great is a modest ring — aim, don't spam
  const coreR = easy ? easyT * 0.4 : ramp(hardLevel, 95);
  const perfectHalf = clamp(
    lerp(0.013, easy ? 0.011 : 0.0055, coreR) - (easy ? 0 : g * 0.0003),
    0.0045,
    easy ? 0.015 : 0.013,
  );
  let greatHalf = Math.max(perfectHalf * 1.6, perfectHalf + 0.0025);

  // Nice margin outside Great — eaten before the core shrinks
  const niceMargin = easy
    ? lerp(0.026, 0.015, easyT)
    : clamp(lerp(0.015, 0.004, zoneR) - g * 0.00045, 0.0035, 0.02);
  zoneHalf = Math.max(zoneHalf, greatHalf + niceMargin);
  greatHalf = Math.min(greatHalf, zoneHalf - 0.003);

  const edgePad = easy
    ? lerp(0.08, 0.12, easyT)
    : clamp(lerp(0.12, 0.06, placeR) - g * 0.0007, 0.035, 0.12);
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

  // Moving / shrinking are rare extras — they add focus, not panic
  const moving =
    !easy && n >= 35 && rand() < clamp(0.05 + (n - 35) * 0.0025, 0.05, 0.28);
  const shrinking =
    !easy && n >= 45 && rand() < clamp(0.04 + (n - 45) * 0.002, 0.04, 0.22);

  let targetEnd: number | undefined;
  if (moving) {
    targetEnd = min + rand() * Math.max(0.01, max - min);
    if (Math.abs(targetEnd - target) < 0.12) {
      targetEnd = clamp(target + (rand() > 0.5 ? 0.16 : -0.16), min, max);
    }
  }

  const zoneHalfEnd = shrinking
    ? clamp(
        Math.max(greatHalf + 0.004, zoneHalf * lerp(0.85, 0.7, ramp(n, 100))),
        greatHalf + 0.004,
        zoneHalf,
      )
    : undefined;

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
  // Mid-fill shrink only eats the Nice outer ring — Great / Perfect stay put
  const zoneHalf =
    round.shrinking && round.zoneHalfEnd != null
      ? Math.max(
          round.greatHalf + 0.003,
          lerp(round.zoneHalf, round.zoneHalfEnd, t),
        )
      : round.zoneHalf;
  return {
    target,
    zoneHalf,
    greatHalf: round.greatHalf,
    perfectHalf: round.perfectHalf,
  };
}
