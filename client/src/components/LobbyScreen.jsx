import { useState } from 'react';

export default function LobbyScreen({
  gameMode,
  onCreate,
  onJoin,
  onBack,
  loading,
  error,
}) {
  const [tab, setTab] = useState('create');
  const [maxPlayers, setMaxPlayers] = useState(6);
  const [code, setCode] = useState('');

  const handleJoin = () => {
    onJoin(code.toUpperCase().trim());
  };

  return (
    <div className="screen-container">
      <div className="card-panel">
        <h2 style={{ textAlign: 'center', color: '#c9a227', marginTop: 0 }}>Lobby</h2>
        <p style={{ textAlign: 'center', opacity: 0.75, fontSize: '0.875rem' }}>
          {gameMode === 'bhabhi' ? 'Bhabhi Thulla' : 'Bluff'}
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', margin: '1.25rem 0' }}>
          <button
            type="button"
            className={tab === 'create' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => setTab('create')}
          >
            Create Room
          </button>
          <button
            type="button"
            className={tab === 'join' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1 }}
            onClick={() => setTab('join')}
          >
            Join Room
          </button>
        </div>

        {tab === 'create' ? (
          <div>
            <label htmlFor="maxPlayers" style={{ fontSize: '0.875rem' }}>
              Max players (3–6)
            </label>
            <select
              id="maxPlayers"
              className="input-field"
              style={{ marginTop: '0.5rem' }}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            >
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', marginTop: '1.25rem' }}
              disabled={loading}
              onClick={() => onCreate({ gameMode, maxPlayers })}
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        ) : (
          <div>
            <label htmlFor="code" style={{ fontSize: '0.875rem' }}>
              Room code (4 letters)
            </label>
            <input
              id="code"
              className="input-field"
              style={{ marginTop: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}
              maxLength={4}
              placeholder="XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            />
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%', marginTop: '1.25rem' }}
              disabled={loading || code.length !== 4}
              onClick={handleJoin}
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
          </div>
        )}

        {error && (
          <p style={{ color: '#e74c3c', textAlign: 'center', marginTop: '1rem', fontSize: '0.875rem' }}>
            {error}
          </p>
        )}

        <button type="button" className="btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
