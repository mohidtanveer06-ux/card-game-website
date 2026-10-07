import { useEffect, useRef, useCallback, useState } from 'react';

const SOUND_PATTERNS = {
  intro: [
    { frequency: 523.25, delay: 0, duration: 0.2, type: 'sine' },
    { frequency: 659.25, delay: 0.13, duration: 0.22, type: 'sine' },
    { frequency: 783.99, delay: 0.27, duration: 0.38, type: 'sine' },
  ],
  shuffle: [
    { frequency: 380, delay: 0, duration: 0.07, type: 'triangle' },
    { frequency: 510, delay: 0.08, duration: 0.07, type: 'triangle' },
    { frequency: 430, delay: 0.16, duration: 0.09, type: 'triangle' },
  ],
  deal: [{ frequency: 520, delay: 0, duration: 0.09, type: 'triangle' }],
  cardPlay: [
    { frequency: 220, delay: 0, duration: 0.07, type: 'triangle' },
    { frequency: 620, delay: 0.035, duration: 0.09, type: 'sine' },
  ],
  select: [{ frequency: 740, delay: 0, duration: 0.055, type: 'sine' }],
  thullaSweep: [
    { frequency: 740, delay: 0, duration: 0.13, type: 'sawtooth' },
    { frequency: 520, delay: 0.1, duration: 0.15, type: 'sawtooth' },
    { frequency: 310, delay: 0.21, duration: 0.25, type: 'triangle' },
  ],
  bluffCall: [
    { frequency: 330, delay: 0, duration: 0.13, type: 'square' },
    { frequency: 247, delay: 0.13, duration: 0.2, type: 'triangle' },
  ],
  win: [
    { frequency: 523.25, delay: 0, duration: 0.16, type: 'sine' },
    { frequency: 659.25, delay: 0.13, duration: 0.16, type: 'sine' },
    { frequency: 783.99, delay: 0.26, duration: 0.16, type: 'sine' },
    { frequency: 1046.5, delay: 0.39, duration: 0.35, type: 'sine' },
  ],
  lose: [
    { frequency: 392, delay: 0, duration: 0.2, type: 'triangle' },
    { frequency: 293.66, delay: 0.18, duration: 0.24, type: 'triangle' },
    { frequency: 196, delay: 0.4, duration: 0.38, type: 'sine' },
  ],
  tick: [{ frequency: 880, delay: 0, duration: 0.04, type: 'sine' }],
  notification: [
    { frequency: 660, delay: 0, duration: 0.11, type: 'sine' },
    { frequency: 880, delay: 0.12, duration: 0.16, type: 'sine' },
  ],
};

function loadMutedPreference() {
  try {
    return localStorage.getItem('mt-cards-muted') === 'true';
  } catch (error) {
    console.error('Unable to read the game audio preference.', error);
    return false;
  }
}

export function useSounds() {
  const audioContextRef = useRef(null);
  const [muted, setMuted] = useState(loadMutedPreference);

  useEffect(() => {
    try {
      localStorage.setItem('mt-cards-muted', String(muted));
    } catch (error) {
      console.error('Unable to save the game audio preference.', error);
    }
  }, [muted]);

  const play = useCallback(
    (name) => {
      if (muted) return;
      const pattern = SOUND_PATTERNS[name];
      if (!pattern) return;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        console.error('Web Audio is not supported in this browser.');
        return;
      }

      const context = audioContextRef.current || new AudioContextClass();
      audioContextRef.current = context;

      const playPattern = () => {
        pattern.forEach(({ frequency, delay, duration, type }) => {
          const oscillator = context.createOscillator();
          const volume = context.createGain();
          const startTime = context.currentTime + delay;
          const endTime = startTime + duration;

          oscillator.type = type;
          oscillator.frequency.setValueAtTime(frequency, startTime);
          volume.gain.setValueAtTime(0.0001, startTime);
          volume.gain.exponentialRampToValueAtTime(0.16, startTime + 0.015);
          volume.gain.exponentialRampToValueAtTime(0.0001, endTime);
          oscillator.connect(volume);
          volume.connect(context.destination);
          oscillator.start(startTime);
          oscillator.stop(endTime);
        });
      };

      if (context.state === 'suspended') {
        context.resume().then(playPattern).catch((error) => {
          console.error('Unable to resume game audio.', error);
        });
      } else {
        playPattern();
      }
    },
    [muted]
  );

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return { play, muted, toggleMute };
}
