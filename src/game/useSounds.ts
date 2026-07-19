import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef } from 'react';

type Sfx = 'tap' | 'perfect' | 'zone' | 'miss' | 'start' | 'tick';

const SOURCES: Record<Sfx, number> = {
  tap: require('../../assets/sounds/tap.wav'),
  perfect: require('../../assets/sounds/perfect.wav'),
  zone: require('../../assets/sounds/zone.wav'),
  miss: require('../../assets/sounds/miss.wav'),
  start: require('../../assets/sounds/start.wav'),
  tick: require('../../assets/sounds/tick.wav'),
};

export function useSounds() {
  const players = useRef<Partial<Record<Sfx, AudioPlayer>>>({});

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          interruptionMode: 'mixWithOthers',
        });
      } catch {
        // Audio mode is best-effort on web/simulators.
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
          // ignore cleanup races
        }
      });
      players.current = {};
    };
  }, []);

  const play = (key: Sfx) => {
    const player = players.current[key];
    if (!player) return;
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // ignore playback races
    }
  };

  return { play };
}
