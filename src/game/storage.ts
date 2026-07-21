import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SKIN } from '@/game/skins';
import type { PersistState, SkinId } from '@/game/types';

const KEY = 'zone-meter:persist-v1';

const DEFAULT_STATE: PersistState = {
  highScore: 0,
  coins: 0,
  unlockedSkins: ['toxic'],
  equippedSkin: DEFAULT_SKIN,
  bestComboAllTime: 0,
  bestLevel: 0,
  dailyBest: { date: '', score: 0 },
  soundMuted: false,
  hapticsEnabled: true,
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function loadPersist(): Promise<PersistState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE, unlockedSkins: [...DEFAULT_STATE.unlockedSkins] };
    const parsed = JSON.parse(raw) as Partial<PersistState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      unlockedSkins: parsed.unlockedSkins?.length
        ? (parsed.unlockedSkins as SkinId[])
        : ['toxic'],
      equippedSkin: parsed.equippedSkin ?? DEFAULT_SKIN,
      dailyBest: parsed.dailyBest
        ? { date: parsed.dailyBest.date ?? '', score: Number(parsed.dailyBest.score) || 0 }
        : { date: '', score: 0 },
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
  const next: PersistState = {
    ...prev,
    highScore: Math.max(prev.highScore, input.score),
    // Coins kept in save data but not surfaced in UI for now
    coins: prev.coins + input.coinsEarned,
    bestComboAllTime: Math.max(prev.bestComboAllTime, input.bestCombo),
    bestLevel: Math.max(prev.bestLevel, input.bestLevel),
    dailyBest:
      input.isDaily
        ? {
            date: todayKey(),
            score:
              prev.dailyBest.date === todayKey()
                ? Math.max(prev.dailyBest.score, input.score)
                : input.score,
          }
        : prev.dailyBest,
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
