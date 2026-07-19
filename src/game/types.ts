export type RoundResult = 'perfect' | 'zone' | 'miss';

export type RoundConfig = {
  level: number;
  /** Target center as 0–1 from bottom */
  target: number;
  /** Half-width of the passable zone (0–1) */
  zoneHalf: number;
  /** Perfect half-width (0–1) */
  perfectHalf: number;
  /** Fill duration in ms */
  fillMs: number;
};

export type RoundLabel = 'Perfect' | 'Great' | 'Good' | 'Nice' | 'Miss';

export type RoundOutcome = {
  result: RoundResult;
  label: RoundLabel;
  fill: number;
  points: number;
  distance: number;
};
