import { useState, useEffect, useCallback, useMemo } from 'react';
import OvalTable from './OvalTable';
import Card from './Card';
import ActionLog from './ActionLog';
import BluffChallengeBar from './BluffChallengeBar';

export default function GameTable({
  gameState,
  gameLog,
  myId,
  onPlayCard,
  onPlayBluff,
  onCallBluff,
  onPassBluff,
  onCallThullaBluff,
  onLeave,
  muted,
  onToggleMute,
  playSound,
}) {
  const [selectedCards, setSelectedCards] = useState([]);
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
    }
    setPrevLogLen(gameLog.length);
  }, [gameLog, prevLogLen, playSound]);

  useEffect(() => {
    if (gameState.isMyTurn) playSound?.('notification');
    setSelectedCards([]);
  }, [gameState.currentTurnPlayerId, gameState.isMyTurn, playSound]);

  const toggleSelect = useCallback(
    (cardId) => {
      if (gameState.type === 'bhabhi') {
        if (!gameState.playableCardIds?.includes(cardId)) return;
        onPlayCard(cardId);
        return;
      }

      if (!gameState.isMyTurn || gameState.phase !== 'playing') return;
      setSelectedCards((prev) => {
        if (prev.includes(cardId)) return prev.filter((id) => id !== cardId);
        if (prev.length >= 4) return prev;
        return [...prev, cardId];
      });
    },
    [gameState, onPlayCard]
  );

  const handleBluffPlay = () => {
    if (selectedCards.length < 1) return;
    onPlayBluff(selectedCards, gameState.requiredRank);
    setSelectedCards([]);
  };

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
            <span style={{ fontSize: '0.875rem', opacity: 0.85 }}>
              Required: <strong>{gameState.requiredRank}</strong>
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
      <div style={{ padding: '0.75rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10, 18, 34, 0.9)', borderBottom: '1px solid rgba(201, 162, 39, 0.15)' }}>
        <span style={{ color: '#fff', fontSize: '0.95rem' }}>{turnStatus}</span>
        {gameState.type === 'bhabhi' && isMyTurn ? (
          <span style={{ color: gameState.playableCardIds?.length > 0 ? '#f9d949' : '#e74c3c', fontSize: '0.85rem' }}>
            Playable: {gameState.playableCardIds?.length || 0} card(s)
          </span>
        ) : hintMessage ? (
          <span style={{ color: '#f9d949', fontSize: '0.85rem' }}>{hintMessage}</span>
        ) : null}
      </div>

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

        {gameState.type === 'bluff' && (
          <BluffChallengeBar
            canChallenge={gameState.canChallenge}
            onCallBluff={onCallBluff}
            onPass={onPassBluff}
            lastPlay={gameState.lastPlay}
            playerNames={playerNames}
          />
        )}

        {gameState.type === 'bhabhi' && gameState.canChallenge && (
          <div className="bluff-bar">
            <span style={{ fontSize: '0.875rem' }}>
              🎭 Think <strong>{playerNames[gameState.lastPlay?.playerId] || 'Player'}</strong> lied about their suit?
            </span>
            <button
              type="button"
              className="btn-danger"
              onClick={() => {
                playSound?.('bluffCall');
                onCallThullaBluff?.();
              }}
            >
              Call Bluff
            </button>
          </div>
        )}

        {gameState.revealCards && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', padding: '0.5rem', alignItems: 'center', flexDirection: 'column' }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.85rem', color: '#c9a227' }}>🔍 Revealed Cards:</p>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {gameState.revealCards.map((c) => (
                <Card key={c.id} card={c} small dealing />
              ))}
            </div>
          </div>
        )}

        {gameState.isMyTurn && gameState.type === 'bluff' && gameState.phase === 'playing' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0.5rem' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={selectedCards.length < 1}
              onClick={handleBluffPlay}
            >
              Play {selectedCards.length || '0'} as {gameState.requiredRank}
            </button>
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
