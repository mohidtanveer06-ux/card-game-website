import { useMemo } from 'react';
import PlayerSeat from './PlayerSeat';
import Card from './Card';

function seatPosition(index, total, isLocal) {
  if (isLocal) {
    return { left: '50%', top: '88%' };
  }

  const others = total - 1;
  const arcIndex = index;
  const startAngle = Math.PI * 0.15;
  const endAngle = Math.PI * 0.85;
  const angle = startAngle + (arcIndex / Math.max(others - 1, 1)) * (endAngle - startAngle);
  const rx = 42;
  const ry = 38;
  const cx = 50;
  const cy = 45;

  return {
    left: `${cx + rx * Math.cos(Math.PI - angle)}%`,
    top: `${cy - ry * Math.sin(angle)}%`,
  };
}

export default function OvalTable({
  players,
  myId,
  handCounts,
  gotAway,
  currentTurnPlayerId,
  currentTrick,
  turnDeadline,
  turnTimeoutMs,
  centerPileCount,
  gameType,
}) {
  const ordered = useMemo(() => {
    const me = players.find((p) => p.id === myId);
    const others = players.filter((p) => p.id !== myId);
    return me ? [...others, me] : players;
  }, [players, myId]);

  let otherIdx = 0;

  return (
    <div className="oval-table-wrap">
      <div className="oval-table">
        {gameType === 'bhabhi' && currentTrick?.plays?.length > 0 && (
          <div className="trick-center">
            {currentTrick.plays.map((play, i) => (
              <Card key={`${play.playerId}-${i}`} card={play.card} small dealing />
            ))}
          </div>
        )}

        {gameType === 'bluff' && centerPileCount > 0 && (
          <div className="bluff-pile">
            <Card faceDown small />
            <span style={{ fontSize: '0.65rem', display: 'block', textAlign: 'center', marginTop: 4 }}>
              {centerPileCount} in pile
            </span>
          </div>
        )}

        {ordered.map((player) => {
          const isLocal = player.id === myId;
          const pos = isLocal
            ? seatPosition(0, ordered.length, true)
            : seatPosition(otherIdx++, ordered.length - 1, false);

          return (
            <div key={player.id} style={{ position: 'absolute', ...pos }}>
              <PlayerSeat
                player={player}
                cardCount={handCounts?.[player.id]}
                isActive={currentTurnPlayerId === player.id}
                isLocal={isLocal}
                gotAway={gotAway?.includes(player.id)}
                turnDeadline={currentTurnPlayerId === player.id ? turnDeadline : null}
                turnTimeoutMs={turnTimeoutMs}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
