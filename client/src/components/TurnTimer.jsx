import { useEffect, useState } from 'react';

export default function TurnTimer({ deadline, totalMs = 15000, onTick }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const ms = Math.max(0, deadline - Date.now());
      setRemaining(ms);
      if (ms <= 5000 && ms > 4900) onTick?.();
    };
    update();
    const id = setInterval(update, 100);
    return () => clearInterval(id);
  }, [deadline, onTick]);

  const pct = Math.min(1, remaining / totalMs);
  const r = 16;
  const circ = 2 * Math.PI * r;
  const secs = Math.ceil(remaining / 1000);

  return (
    <div className="turn-timer">
      <svg width="36" height="36" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={secs <= 5 ? '#e74c3c' : '#c9a227'}
          strokeWidth="3"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
        />
      </svg>
      <span className="turn-timer-text">{secs}</span>
    </div>
  );
}
