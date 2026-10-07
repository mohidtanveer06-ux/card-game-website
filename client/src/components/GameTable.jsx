import { useState, useEffect, useCallback, useMemo } from 'react';
import OvalTable from './OvalTable';
import Card from './Card';
import ActionLog from './ActionLog';
import BluffChallengeBar from './BluffChallengeBar';

const RANK_LABELS = {
  A: 'Ace (A)',
  K: 'King (K)',
  Q: 'Queen (Q)',
  J: 'Jack (J)',
  '10': '10',
  '9': '9',
  '8': '8',
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};

export default function GameTable({
  gameState,
  gameLog,
  myId,
  onPlayCard,
  onPlayBluff,
  onPlayBluffDeclareRank,
  onPlayBluffMatching,
  onSkipBluffTurn,
  onCallBluff,
  onPassBluff,
  onCallThullaBluff,
  onLeave,
  muted,
  onToggleMute,
  playSound,
}) {
  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedRank, setSelectedRank] = useState('A');
  const [prevLogLen, setPrevLogLen] = useState(0);

  const playerNames = useMemo(
    () => Object.fromEntries((gameState.players || []).map((p) => [p.id, p.name])),
    [gameState.players]
  );

  useEffect(() => {
    if (gameLog.length > prevLogLen) {
      const last = gameLog[gameLog.length - 1];
      if (last?.type === 'play') playSound?.('cardPlay');
      if (last?.type === 'thulla') playSound?.('thullaSweep');
      if (last?.type === 'bluff') playSound?.('bluffCall');
      if (last?.type === 'info' && last.message?.includes('Dealing')) playSound?.('shuffle');
      if (last?.type === 'info' && last.message?.includes('cleared')) playSound?.('shuffle');
      if (last?.type === 'success') playSound?.('win');
      if (last?.type === 'danger') playSound?.('lose');
    }
    setPrevLogLen(gameLog.length);
  }, [gameLog, prevLogLen, playSound]);

  useEffect(() => {
    if (gameState.isMyTurn) playSound?.('notification');
    setSelectedCards([]);
  }, [gameState.currentTurnPlayerId, gameState.isMyTurn, playSound, gameState.phase, gameState.currentDeclaredRank]);

  useEffect(() => {
    if (gameState.availableRanks?.[0] && !gameState.currentDeclaredRank) {
      setSelectedRank((r) => (gameState.availableRanks?.includes(r) ? r : gameState.availableRanks[0]));
    }
  }, [gameState.availableRanks, gameState.currentDeclaredRank]);

  const toggleSelect = useCallback(
    (cardId) => {
      if (gameState.type === 'bhabhi') {
        if (!gameState.playableCardIds?.includes(cardId)) return;
        onPlayCard(cardId);
        return;
      }

      if (!gameState.isMyTurn || gameState.phase !== 'playing') return;
      playSound?.('select');
      setSelectedCards((prev) => {
        if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
        if (prev.length >= 4) return prev;
        return [...prev, cardId];
      });
    },
    [gameState, onPlayCard, playSound]
  );

  const handleDeclareAndPlay = useCallback(() => {
    if (selectedCards.length < 1 || !selectedRank) return;
    onPlayBluffDeclareRank?.(selectedCards, selectedRank);
    setSelectedCards([]);
  }, [selectedCards, selectedRank, onPlayBluffDeclareRank]);

  const handlePlayMatching = useCallback(() => {
    if (selectedCards.length < 1) return;
    onPlayBluffMatching?.(selectedCards);
    setSelectedCards([]);
  }, [selectedCards, onPlayBluffMatching]);

  const handleSkip = useCallback(() => {
    onSkipBluffTurn?.();
  }, [onSkipBluffTurn]);

  const sortedHand = [...(gameState.myHand || [])].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
    return a.value - b.value;
  });

  const currentPlayerName = playerNames[gameState.currentPlayerId] || 'Player';
  const isMyTurn = gameState.isMyTurn;
  const turnStatus = isMyTurn ? 'Your turn' : `Waiting for ${currentPlayerName}`;
  const hintMessage = gameState.type === 'bhabhi' && isMyTurn
    ? `Only ${gameState.playableCardIds?.length || 0} card(s) are playable now.`
    : '';

  const openRules = () => window.dispatchEvent(new CustomEvent('openRules'));

  return (
    <div className="game-layout">
      <header className="game-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontFamily: 'Cinzel, serif', color: '#c9a227' }}>
            {gameState.type === 'bhabhi' ? 'Bhabhi Thulla' : 'Bluff'}
          </span>
          {gameState.type === 'bluff' && (
            <span style={{ fontSize: '0.875rem', opacity: 0.95 }}>
              {gameState.currentDeclaredRank ? (
                <>Active rank: <strong style={{ color: '#f9d949', fontSize: '1rem' }}>{gameState.currentDeclaredRank}</strong></>
              ) : (
                <>Status: <strong style={{ color: '#27ae60' }}>Fresh round — declare a rank!</strong></>
              )}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
            onClick={openRules}
          >
            📖 Rules
          </button>
          <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={onToggleMute}>
            {muted ? '🔇' : '🔊'}
          </button>
          <button type="button" className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }} onClick={onLeave}>
            Leave
          </button>
        </div>
      </header>

      <div style={{ padding: '0.5rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10, 18, 34, 0.9)', borderBottom: '1px solid rgba(201, 162, 39, 0.15)', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span style={{ color: '#fff', fontSize: '0.95rem' }}>{turnStatus}</span>
        {gameState.type === 'bhabhi' && isMyTurn ? (
          <span style={{ color: gameState.playableCardIds?.length > 0 ? '#f9d949' : '#e74c3c', fontSize: '0.85rem' }}>
            Playable: {gameState.playableCardIds?.length || 0} card(s)
          </span>
        ) : hintMessage ? (
          <span style={{ color: '#f9d949', fontSize: '0.85rem' }}>{hintMessage}</span>
        ) : null}
        {gameState.type === 'bluff' && (
          <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>
            Pile: <strong style={{ color: '#c9a227' }}>{gameState.centerPileCount || 0}</strong> cards
            {(gameState.consecutiveSkips ?? 0) > 0 && (
              <> · Skips: <strong style={{ color: (gameState.consecutiveSkips || 0) > 2 ? '#e74c3c' : '#f9d949' }}>{gameState.consecutiveSkips}</strong></>
            )}
            {(gameState.totalCleared || 0) > 0 && (
              <> · Cleared: <strong style={{ color: '#7f8c8d' }}>{gameState.totalCleared}</strong>
              </>
            )}
          </span>
        )}
      </div>

      {gameState.type === 'bluff' && (gameState.finishedOrder?.length > 0 || gameState.loser) && (
        <div style={{ padding: '0.35rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(13, 74, 46, 0.55)', borderBottom: '1px solid rgba(201, 162, 39, 0.15)', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#c9a227' }}>🏅 Rankings:</span>
          {(gameState.finishedNames || []).map((nm, idx) => (
            <span key={idx} style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(201, 162, 39, 0.18)', border: '1px solid rgba(201, 162, 39, 0.35)' }}>
              {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`} {nm}
            </span>
          ))}
          {gameState.loser && (
            <span style={{ fontSize: '0.78rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: 'rgba(192, 57, 43, 0.22)', border: '1px solid rgba(192, 57, 43, 0.45)', color: '#e74c3c', fontWeight: 600 }}>
              💸 Loser: {gameState.loserName || playerNames[gameState.loser] || 'Player'}
            </span>
          )}
        </div>
      )}

      <div className="game-main">
        <ActionLog entries={gameLog} />

        <OvalTable
          players={gameState.players}
          myId={myId}
          handCounts={gameState.handCounts}
          gotAway={gameState.gotAway}
          currentTurnPlayerId={gameState.currentTurnPlayerId}
          currentTrick={gameState.currentTrick}
          turnDeadline={gameState.turnDeadline}
          turnTimeoutMs={gameState.turnTimeoutMs}
          centerPileCount={gameState.centerPileCount}
          gameType={gameState.type}
        />

        {gameState.type === 'bluff' && gameState.lastPlay && (
          <div className="bluff-announcement">
            <div className="bluff-announcement-main">
              <span className="bluff-announcement-player">
                {playerNames[gameState.lastPlay.playerId] || 'Player'}
              </span>
              {' played '}
              <span className="bluff-announcement-count">
                <span className="bluff-announcement-count-badge">{gameState.lastPlay.count}</span>
              </span>
              {' card(s) as '}
              <span className="bluff-announcement-rank">{gameState.lastPlay.declaredRank}</span>
            </div>
            {gameState.canCallBluff && isMyTurn && (
              <div className="bluff-announcement-challenge">
                🎭 You can Call Bluff (if it's not your turn you must wait to Call Bluff).
              </div>
            )}
          </div>
        )}

        {gameState.type === 'bluff' && gameState.lastChallengeResult && gameState.phase === 'reveal' && (
          <div className="bluff-challenge-result">
            <h4>
              {gameState.lastChallengeResult.lied ? (
                <span className="lied">🚫 CAUGHT LYING!</span>
              ) : (
                <span className="truth">✅ HONEST PLAY!</span>
              )}
            </h4>
            <div className="bluff-challenge-result-pile">
              {playerNames[gameState.lastChallengeResult.loserId] || 'Player'} receives{' '}
              <strong>{gameState.lastChallengeResult.pileSize}</strong> card(s) from the pile.
            </div>
            {gameState.revealCards && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', padding: '0.25rem', alignItems: 'center', flexDirection: 'column' }}>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.85rem', color: '#c9a227' }}>🔍 Revealed Cards (claimed {gameState.lastChallengeResult.claimedCount} × {gameState.lastChallengeResult.declaredRank}):</p>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {gameState.revealCards.map((c) => (
                    <Card key={c.id} card={c} small dealing />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {gameState.type === 'bluff' && (
          <BluffChallengeBar
            canChallenge={gameState.canCallBluff && !isMyTurn}
            onCallBluff={() => {
              playSound?.('bluffCall');
              onCallBluff?.();
            }}
            onPass={onPassBluff}
            lastPlay={gameState.lastPlay}
            playerNames={playerNames}
            isBluffGame
          />
        )}

        {gameState.type === 'bhabhi' && gameState.canChallenge && (
          <div className="thulla-challenge-bar">
            <span style={{ fontSize: '0.875rem' }}>
              💥 Think <strong>{playerNames[gameState.lastPlay?.playerId] || 'Player'}</strong> had suit but threw Thulla?
            </span>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                playSound?.('bluffCall');
                onCallThullaBluff?.();
              }}
            >
              Challenge Thulla
            </button>
          </div>
        )}

        {gameState.type === 'bhabhi' && gameState.revealCards && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', padding: '0.5rem', alignItems: 'center', flexDirection: 'column' }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', color: '#c9a227' }}>🔍 Challenged Card:</p>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {gameState.revealCards.map((c) => (
                <Card key={c.id} card={c} small dealing />
              ))}
            </div>
          </div>
        )}

        {isMyTurn && gameState.type === 'bluff' && gameState.phase === 'playing' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.65rem 0.5rem 0.35rem', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            {gameState.canDeclareRank && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <label style={{ fontSize: '0.85rem', color: '#f5f0e1' }}>
                  Declare rank:
                  <select
                    value={selectedRank}
                    onChange={(e) => setSelectedRank(e.target.value)}
                    style={{
                      marginLeft: '0.5rem',
                      padding: '0.45rem 0.6rem',
                      background: 'rgba(0,0,0,0.4)',
                      color: '#f9d949',
                      border: '1px solid rgba(201, 162, 39, 0.4)',
                      borderRadius: '0.375rem',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                    }}
                  >
                    {(gameState.availableRanks || ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']).map((r) => (
                      <option key={r} value={r}>{RANK_LABELS[r] || r}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={selectedCards.length < 1}
                  onClick={handleDeclareAndPlay}
                >
                  Play {selectedCards.length || '0'} & Declare {selectedRank}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSkip}
                >
                  ⏭ Skip
                </button>
              </div>
            )}
            {gameState.canPlayMatching && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#f5f0e1' }}>
                  Add cards matching <strong style={{ color: '#f9d949' }}>{gameState.currentDeclaredRank}</strong>:
                </span>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={selectedCards.length < 1}
                  onClick={handlePlayMatching}
                >
                  Play {selectedCards.length || '0'} as {gameState.currentDeclaredRank}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSkip}
                >
                  ⏭ Skip
                </button>
                {gameState.canCallBluff && (
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => {
                      playSound?.('bluffCall');
                      onCallBluff?.();
                    }}
                  >
                    🎭 Call Bluff
                  </button>
                )}
              </div>
            )}
            {gameState.canSkip && !gameState.canDeclareRank && !gameState.canPlayMatching && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSkip}
                >
                  ⏭ Skip Turn
                </button>
              </div>
            )}
          </div>
        )}

        <div className="my-hand">
          {sortedHand.map((card) => (
            <Card
              key={card.id}
              card={card}
              playable={
                gameState.type === 'bhabhi'
                  ? gameState.playableCardIds?.includes(card.id)
                  : gameState.isMyTurn && gameState.phase === 'playing'
              }
              selected={selectedCards.includes(card.id)}
              onClick={() => toggleSelect(card.id)}
              dealing
            />
          ))}
        </div>
      </div>
    </div>
  );
}
