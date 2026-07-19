import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'zone-meter:high-score';

export async function loadHighScore(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function saveHighScore(score: number): Promise<number> {
  const prev = await loadHighScore();
  const next = Math.max(prev, score);
  await AsyncStorage.setItem(KEY, String(next));
  return next;
}
