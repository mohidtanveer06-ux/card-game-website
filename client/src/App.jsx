import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket';
import { useSounds } from './hooks/useSounds';
import { loadProfile, saveProfile } from './utils/profile';
import ProfileScreen from './components/ProfileScreen';
import GameSelectScreen from './components/GameSelectScreen';
import LobbyScreen from './components/LobbyScreen';
import WaitingRoom from './components/WaitingRoom';
import GameTable from './components/GameTable';
import ToastStack from './components/ToastStack';

const SCREENS = {
  SPLASH: 'splash',
  PROFILE: 'profile',
  MODE: 'mode',
  LOBBY: 'lobby',
  WAITING: 'waiting',
  GAME: 'game',
};

function EndGameModal({ gameEnded, gameState, myId, isHost, onRematch, onLeave }) {
  if (!gameEnded) return null;

  const names = gameEnded.playerNames || {};
  const isBhabhi = gameEnded.gameMode === 'bhabhi';
  const iAmBhabhi = gameEnded.bhabhi === myId;
  const iWon = gameEnded.winner === myId;

  return (
    <div className="end-modal-overlay">
      <div className="end-modal">
        {isBhabhi ? (
          <>
            <h2>Game Over</h2>
            {gameEnded.bhabhi && (
              <>
                <div className="bhabhi-crown">👑</div>
                <p>
                  <strong>{names[gameEnded.bhabhi]}</strong> is the Bhabhi!
                </p>
              </>
            )}
            {gameEnded.escapeOrder?.length > 0 && (
              <p style={{ fontSize: '0.875rem', opacity: 0.85 }}>
                First away: {names[gameEnded.escapeOrder[0]]}
              </p>
            )}
            {iAmBhabhi && <p style={{ color: '#e74c3c' }}>Better luck next time!</p>}
            {!iAmBhabhi && gameEnded.escapeOrder?.includes(myId) && (
              <p style={{ color: '#27ae60' }}>You got away!</p>
            )}
          </>
        ) : (
          <>
            <h2>{iWon ? 'You Win!' : 'Game Over'}</h2>
            {gameEnded.winner && (
              <p>
                Winner: <strong>{names[gameEnded.winner]}</strong>
              </p>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'center' }}>
          {isHost && (
            <button type="button" className="btn-primary" onClick={onRematch}>
              Rematch
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onLeave}>
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SPLASH);
  const [profile, setProfile] = useState(loadProfile);
  const [gameMode, setGameMode] = useState('bhabhi');
  const [loading, setLoading] = useState(false);
  const [lobbyError, setLobbyError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [toasts, setToasts] = useState([]);
  const socket = useSocket();
  const { play, muted, toggleMute } = useSounds();

  const addToast = useCallback((message, type = 'info') => {
    setToasts((prev) => [...prev, { id: Date.now() + Math.random(), message, type }]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    if (socket.lastError) {
      addToast(socket.lastError, 'error');
      socket.clearError();
    }
  }, [socket.lastError, addToast, socket]);

  useEffect(() => {
    if (socket.roomState && screen !== SCREENS.GAME) {
      if (socket.roomState.phase === 'waiting' || socket.roomState.phase === 'ended') {
        setScreen(SCREENS.WAITING);
      }
    }
  }, [socket.roomState, screen]);

  useEffect(() => {
    if (socket.gameState) {
      setScreen(SCREENS.GAME);
    }
  }, [socket.gameState]);

  useEffect(() => {
    if (socket.gameEnded && socket.playerId) {
      const pid = socket.playerId;
      if (socket.gameEnded.winner === pid || socket.gameEnded.escapeOrder?.includes(pid)) {
        play('win');
      } else if (socket.gameEnded.bhabhi === pid) {
        play('lose');
      } else {
        play('win');
      }
    }
  }, [socket.gameEnded, socket.playerId, play]);

  const handleProfileContinue = async () => {
    saveProfile(profile);
    await socket.setProfile(profile);
    setScreen(SCREENS.MODE);
  };

  const handleCreate = async (opts) => {
    setLoading(true);
    setLobbyError(null);
    await socket.setProfile(profile);
    const res = await socket.createRoom(opts);
    setLoading(false);
    if (res?.error) {
      setLobbyError(res.error);
    } else if (res?.roomId) {
      setScreen(SCREENS.WAITING);
    }
  };

  const handleJoin = async (code) => {
    setLoading(true);
    setLobbyError(null);
    await socket.setProfile(profile);
    const res = await socket.joinRoom(code);
    setLoading(false);
    if (res?.error) {
      setLobbyError(res.error);
    } else {
      setScreen(SCREENS.WAITING);
    }
  };

  const handleCopyCode = () => {
    const text = `Join MT Cards Online — Code: ${socket.roomState?.code}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast('Room code copied!', 'success');
  };

  const handleLeave = async () => {
    await socket.leaveRoom();
    setScreen(SCREENS.MODE);
    setLobbyError(null);
  };

  const handleStart = async () => {
    setLoading(true);
    play('shuffle');
    await socket.startGame();
    setLoading(false);
  };

  const handleRematch = async () => {
    await socket.rematch();
    play('shuffle');
  };

  if (screen === SCREENS.SPLASH) {
    return (
      <div className="screen-container">
        <div className="card-panel" style={{ textAlign: 'center' }}>
          <h1 className="splash-title">MT Cards Online</h1>
          <p style={{ opacity: 0.8, marginBottom: '2rem' }}>Bhabhi Thulla & Bluff — play with friends online</p>
          <button type="button" className="btn-primary" style={{ width: '100%' }} onClick={() => setScreen(SCREENS.PROFILE)}>
            Play Now
          </button>
          {!socket.connected && (
            <p style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '1rem' }}>Connecting to server...</p>
          )}
        </div>
      </div>
    );
  }

  if (screen === SCREENS.PROFILE) {
    return (
      <ProfileScreen
        profile={profile}
        onChange={setProfile}
        onContinue={handleProfileContinue}
      />
    );
  }

  if (screen === SCREENS.MODE) {
    return (
      <GameSelectScreen
        selected={gameMode}
        onSelect={setGameMode}
        onContinue={() => setScreen(SCREENS.LOBBY)}
        onBack={() => setScreen(SCREENS.PROFILE)}
      />
    );
  }

  if (screen === SCREENS.LOBBY) {
    return (
      <LobbyScreen
        gameMode={gameMode}
        onCreate={handleCreate}
        onJoin={handleJoin}
        onBack={() => setScreen(SCREENS.MODE)}
        loading={loading}
        error={lobbyError}
      />
    );
  }

  if (screen === SCREENS.WAITING && socket.roomState) {
    const effectiveMyId =
      socket.playerId ||
      socket.roomState.players.find((p) => p.name === profile.name && !p.isBot)?.id;

    return (
      <>
        <WaitingRoom
          roomState={socket.roomState}
          myId={effectiveMyId}
          onStart={handleStart}
          onAddBot={socket.addBot}
          onLeave={handleLeave}
          onCopyCode={handleCopyCode}
          copied={copied}
          loading={loading}
        />
        <EndGameModal
          gameEnded={socket.gameEnded}
          gameState={socket.gameState}
          myId={effectiveMyId}
          isHost={socket.roomState.hostId === effectiveMyId}
          onRematch={handleRematch}
          onLeave={handleLeave}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  if (screen === SCREENS.GAME && socket.gameState) {
    const effectiveMyId =
      socket.playerId ||
      socket.gameState.players.find((p) => p.name === profile.name && !p.isBot)?.id;

    return (
      <>
        <GameTable
          gameState={socket.gameState}
          gameLog={socket.gameLog}
          myId={effectiveMyId}
          onPlayCard={socket.playCard}
          onPlayBluff={socket.playBluff}
          onCallBluff={socket.callBluff}
          onPassBluff={socket.passBluff}
          onLeave={handleLeave}
          muted={muted}
          onToggleMute={toggleMute}
          playSound={play}
        />
        <EndGameModal
          gameEnded={socket.gameEnded}
          gameState={socket.gameState}
          myId={effectiveMyId}
          isHost={socket.roomState?.hostId === effectiveMyId}
          onRematch={handleRematch}
          onLeave={handleLeave}
        />
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="screen-container">
      <p>Loading...</p>
    </div>
  );
}
