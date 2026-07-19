export type RoundResult = 'perfect' | 'zone' | 'near' | 'miss';
export type RoundLabel = 'Perfect' | 'Great' | 'Good' | 'Nice' | 'Close' | 'Miss';

export type RoundConfig = {
  level: number;
  /** Target center as 0–1 from bottom */
  target: number;
  /** Optional second target for moving zone */
  targetEnd?: number;
  /** Half-width of the passable zone at start (0–1) */
  zoneHalf: number;
  /** Half-width at end of fill if shrinking */
  zoneHalfEnd?: number;
  /** Perfect half-width (0–1) */
  perfectHalf: number;
  /** Fill duration in ms */
  fillMs: number;
  /** Whether zone moves during the fill */
  moving: boolean;
  /** Whether zone shrinks during the fill */
  shrinking: boolean;
  /** Visual meter scale (height/width), ~0.72–1.15 */
  meterScale: number;
};

export type RoundOutcome = {
  result: RoundResult;
  label: RoundLabel;
  fill: number;
  /** Points before combo */
  basePoints: number;
  /** Points after combo */
  points: number;
  distance: number;
  combo: number;
  multiplier: number;
  coins: number;
  /** True when this miss/near should cost a life */
  costsLife: boolean;
};

export type SessionStats = {
  attempts: number;
  hits: number;
  perfects: number;
  misses: number;
  bestCombo: number;
  coinsEarned: number;
};

export type SkinId = 'toxic' | 'lava' | 'ice' | 'gold';

export type PersistState = {
  highScore: number;
  coins: number;
  unlockedSkins: SkinId[];
  equippedSkin: SkinId;
  bestComboAllTime: number;
  dailyBest: { date: string; score: number };
  soundMuted: boolean;
};
