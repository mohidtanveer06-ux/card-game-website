import { getAvatar } from '../utils/profile';

export default function WaitingRoom({
  roomState,
  myId,
  onStart,
  onAddBot,
  onLeave,
  onCopyCode,
  copied,
  loading,
}) {
  const isHost = roomState.hostId === myId;
  const canStart = roomState.players.length >= 3;

  return (
    <div className="screen-container">
      <div className="card-panel" style={{ maxWidth: '440px' }}>
        <h2 style={{ textAlign: 'center', color: '#c9a227', marginTop: 0 }}>Waiting Room</h2>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', opacity: 0.7, margin: '0 0 0.25rem' }}>
          Room Code
        </p>
        <div className="room-code">{roomState.code}</div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <button type="button" className="btn-secondary" onClick={onCopyCode}>
            {copied ? 'Copied!' : 'Copy Code'}
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Players ({roomState.players.length}/{roomState.maxPlayers})
        </p>

        {roomState.players.map((player) => {
          const avatar = getAvatar(player.avatarId);
          return (
            <div key={player.id} className="player-list-item">
              <div
                className="seat-avatar"
                style={{ width: 36, height: 36, fontSize: '1rem', background: avatar.bg }}
              >
                {avatar.emoji}
              </div>
              <span style={{ flex: 1 }}>{player.name}</span>
              {player.isHost && <span className="host-badge">Host</span>}
              {player.isBot && (
                <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>BOT</span>
              )}
            </div>
          );
        })}

        {isHost && (
          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={!canStart || loading}
              onClick={onStart}
            >
              {loading ? 'Starting...' : `Start Game (${roomState.players.length}/3+)`}
            </button>
            {roomState.players.length < roomState.maxPlayers && (
              <button type="button" className="btn-secondary" onClick={onAddBot}>
                Add Bot
              </button>
            )}
          </div>
        )}

        {!isHost && (
          <p style={{ textAlign: 'center', opacity: 0.7, marginTop: '1.5rem', fontSize: '0.875rem' }}>
            Waiting for host to start...
          </p>
        )}

        <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={onLeave}>
          Leave Room
        </button>
      </div>
    </div>
  );
}
