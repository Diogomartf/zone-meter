import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SKIN } from '@/game/skins';
import type { PersistState, SkinId } from '@/game/types';

const KEY = 'zone-meter:persist-v1';

type DailyScore = PersistState['dailyBest'];

const EMPTY_DAILY: DailyScore = { date: '', score: 0, level: 0 };

const DEFAULT_STATE: PersistState = {
  highScore: 0,
  coins: 0,
  unlockedSkins: ['toxic'],
  equippedSkin: DEFAULT_SKIN,
  bestComboAllTime: 0,
  bestLevel: 0,
  dailyBest: { ...EMPTY_DAILY },
  dailyRecord: { ...EMPTY_DAILY },
  soundMuted: false,
  hapticsEnabled: true,
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function parseDailyScore(value: Partial<DailyScore> | undefined): DailyScore {
  if (!value) return { ...EMPTY_DAILY };
  return {
    date: value.date ?? '',
    score: Number(value.score) || 0,
    level: Number(value.level) || 0,
  };
}

function betterDaily(a: DailyScore, b: DailyScore): DailyScore {
  if (b.score > a.score) return b;
  if (b.score === a.score && b.level > a.level) return b;
  return a;
}

export async function loadPersist(): Promise<PersistState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE, unlockedSkins: [...DEFAULT_STATE.unlockedSkins] };
    const parsed = JSON.parse(raw) as Partial<PersistState>;
    const dailyBest = parseDailyScore(parsed.dailyBest);
    // Migrate older saves that only had dailyBest
    const dailyRecord = parsed.dailyRecord
      ? parseDailyScore(parsed.dailyRecord)
      : dailyBest.score > 0
        ? { ...dailyBest }
        : { ...EMPTY_DAILY };
    return {
      ...DEFAULT_STATE,
      ...parsed,
      unlockedSkins: parsed.unlockedSkins?.length
        ? (parsed.unlockedSkins as SkinId[])
        : ['toxic'],
      equippedSkin: parsed.equippedSkin ?? DEFAULT_SKIN,
      dailyBest,
      dailyRecord: betterDaily(dailyRecord, dailyBest),
      soundMuted: Boolean(parsed.soundMuted),
      hapticsEnabled: parsed.hapticsEnabled !== false,
      bestLevel: Number.isFinite(parsed.bestLevel) ? Number(parsed.bestLevel) : 0,
    };
  } catch {
    return { ...DEFAULT_STATE, unlockedSkins: [...DEFAULT_STATE.unlockedSkins] };
  }
}

export async function setSoundMuted(muted: boolean): Promise<PersistState> {
  const prev = await loadPersist();
  const next = { ...prev, soundMuted: muted };
  await savePersist(next);
  return next;
}

export async function setHapticsEnabled(enabled: boolean): Promise<PersistState> {
  const prev = await loadPersist();
  const next = { ...prev, hapticsEnabled: enabled };
  await savePersist(next);
  return next;
}

export async function savePersist(state: PersistState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

/** Wipe all saved progress and return fresh defaults. */
export async function clearPersist(): Promise<PersistState> {
  await AsyncStorage.removeItem(KEY);
  return {
    ...DEFAULT_STATE,
    unlockedSkins: [...DEFAULT_STATE.unlockedSkins],
  };
}

export async function commitRunResult(input: {
  score: number;
  coinsEarned: number;
  bestCombo: number;
  bestLevel: number;
  isDaily: boolean;
}): Promise<PersistState> {
  const prev = await loadPersist();
  const today = todayKey();
  const sameDailyDay = prev.dailyBest.date === today;

  let dailyBest = prev.dailyBest;
  let dailyRecord = prev.dailyRecord;

  if (input.isDaily) {
    dailyBest = {
      date: today,
      score: sameDailyDay
        ? Math.max(prev.dailyBest.score, input.score)
        : input.score,
      level: sameDailyDay
        ? Math.max(prev.dailyBest.level, input.bestLevel)
        : input.bestLevel,
    };
    dailyRecord = betterDaily(prev.dailyRecord, dailyBest);
  }

  const next: PersistState = {
    ...prev,
    // Coins kept in save data but not surfaced in UI for now
    coins: prev.coins + input.coinsEarned,
    bestComboAllTime: Math.max(prev.bestComboAllTime, input.bestCombo),
    // Normal and daily bests are tracked separately
    highScore: input.isDaily
      ? prev.highScore
      : Math.max(prev.highScore, input.score),
    bestLevel: input.isDaily
      ? prev.bestLevel
      : Math.max(prev.bestLevel, input.bestLevel),
    dailyBest,
    dailyRecord,
  };
  await savePersist(next);
  return next;
}

export async function unlockSkin(skin: SkinId, cost: number): Promise<PersistState | null> {
  const prev = await loadPersist();
  if (prev.unlockedSkins.includes(skin)) return prev;
  if (prev.coins < cost) return null;
  const next: PersistState = {
    ...prev,
    coins: prev.coins - cost,
    unlockedSkins: [...prev.unlockedSkins, skin],
    equippedSkin: skin,
  };
  await savePersist(next);
  return next;
}

export async function equipSkin(skin: SkinId): Promise<PersistState | null> {
  const prev = await loadPersist();
  if (!prev.unlockedSkins.includes(skin)) return null;
  const next = { ...prev, equippedSkin: skin };
  await savePersist(next);
  return next;
}

export function dailySeed(): number {
  const d = todayKey();
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) {
    h ^= d.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export { todayKey };
