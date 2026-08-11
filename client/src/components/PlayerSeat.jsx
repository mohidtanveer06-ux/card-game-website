import { getAvatar } from '../utils/profile';
import TurnTimer from './TurnTimer';

export default function PlayerSeat({
  player,
  cardCount,
  isActive,
  isLocal,
  gotAway,
  turnDeadline,
  turnTimeoutMs,
}) {
  const avatar = getAvatar(player.avatarId);

  return (
    <div className={`player-seat ${isActive ? 'active-turn' : ''}`}>
      {isActive && turnDeadline && (
        <TurnTimer deadline={turnDeadline} totalMs={turnTimeoutMs} />
      )}
      <div
        className="seat-avatar"
        style={{
          background: avatar.bg,
          opacity: player.disconnected ? 0.5 : 1,
          width: isLocal ? 56 : 48,
          height: isLocal ? 56 : 48,
        }}
      >
        {avatar.emoji}
      </div>
      <span className="seat-name">
        {player.name}
        {isLocal && ' (You)'}
      </span>
      {gotAway ? (
        <span className="seat-cards-count" style={{ color: '#27ae60' }}>Got away!</span>
      ) : (
        <span className="seat-cards-count">{cardCount ?? 0} cards</span>
      )}
      {player.disconnected && (
        <span className="seat-cards-count" style={{ color: '#e74c3c' }}>Offline</span>
      )}
    </div>
  );
}
