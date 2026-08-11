import { useEffect, useRef, useCallback, useState } from 'react';

const SOUNDS = {
  shuffle: '/sounds/shuffle.mp3',
  deal: '/sounds/deal.mp3',
  cardPlay: '/sounds/card-play.mp3',
  thullaSweep: '/sounds/thulla-sweep.mp3',
  bluffCall: '/sounds/bluff-call.mp3',
  win: '/sounds/win.mp3',
  lose: '/sounds/lose.mp3',
  tick: '/sounds/tick.mp3',
  notification: '/sounds/notification.mp3',
};

export function useSounds() {
  const audioRef = useRef({});
  const [muted, setMuted] = useState(() => {
    return localStorage.getItem('mt-cards-muted') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('mt-cards-muted', String(muted));
  }, [muted]);

  useEffect(() => {
    Object.entries(SOUNDS).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.volume = 0.5;
      audio.preload = 'auto';
      audioRef.current[key] = audio;
    });
  }, []);

  const play = useCallback(
    (name) => {
      if (muted) return;
      const audio = audioRef.current[name];
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    },
    [muted]
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { play, muted, toggleMute };
}

export { SOUNDS };
