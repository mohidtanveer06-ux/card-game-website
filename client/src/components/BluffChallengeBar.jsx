export default function BluffChallengeBar({ canChallenge, onCallBluff, onPass, lastPlay, playerNames }) {
  if (!canChallenge && !lastPlay) return null;

  const playerName = lastPlay ? playerNames?.[lastPlay.playerId] || 'Player' : '';

  return (
    <div className="bluff-bar">
      {lastPlay && (
        <span style={{ fontSize: '0.875rem' }}>
          {playerName} played {lastPlay.count} as <strong>{lastPlay.declaredRank}</strong>
        </span>
      )}
      {canChallenge && (
        <>
          <button type="button" className="btn-danger" onClick={onCallBluff}>
            BLUFF!
          </button>
          <button type="button" className="btn-secondary" onClick={onPass}>
            Pass
          </button>
        </>
      )}
    </div>
  );
}
