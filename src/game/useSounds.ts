import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

type Sfx = 'tap' | 'perfect' | 'zone' | 'miss' | 'start' | 'tick';

const SOURCES: Record<Sfx, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  perfect: require('../../assets/sounds/perfect.wav'),
  zone: require('../../assets/sounds/zone.wav'),
  miss: require('../../assets/sounds/miss.wav'),
  start: require('../../assets/sounds/start.wav'),
  tick: require('../../assets/sounds/tick.wav'),
};

export function useSounds(muted: boolean) {
  const players = useRef<Partial<Record<Sfx, AudioPlayer>>>({});
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
      } catch {
        // best-effort
      }

      if (!alive) return;

      (Object.keys(SOURCES) as Sfx[]).forEach((key) => {
        const player = createAudioPlayer(SOURCES[key]);
        player.volume = key === 'tick' ? 0.35 : 0.85;
        players.current[key] = player;
      });
    })();

    return () => {
      alive = false;
      Object.values(players.current).forEach((player) => {
        try {
          player?.remove();
        } catch {
          // ignore
        }
      });
      players.current = {};
    };
  }, []);

  const play = useCallback((key: Sfx) => {
    if (mutedRef.current) return;
    const player = players.current[key];
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // ignore
    }
  }, []);

  return { play };
}
