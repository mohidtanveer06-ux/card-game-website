import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3000' : undefined;

export function useSocket() {
  const socketRef = useRef(null);
  const connectPromiseRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [gameLog, setGameLog] = useState([]);
  const [gameEnded, setGameEnded] = useState(null);
  const [lastError, setLastError] = useState(null);

  const waitForConnection = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return Promise.resolve(false);
    if (socket.connected) return Promise.resolve(true);
    if (connectPromiseRef.current) return connectPromiseRef.current;

    connectPromiseRef.current = new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
      };
      const finish = (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
        connectPromiseRef.current = null;
      };
      const onConnect = () => finish(true);
      const onConnectError = () => finish(false);

      socket.once('connect', onConnect);
      socket.once('connect_error', onConnectError);
      if (socket.disconnected) {
        socket.connect();
      }
    });

    return connectPromiseRef.current;
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setPlayerId(socket.id);
      connectPromiseRef.current = null;
    });
    socket.on('disconnect', () => {
      setConnected(false);
      connectPromiseRef.current = null;
    });

    socket.on('room:state', (state) => {
      setRoomState(state);
      if (state.phase === 'waiting') {
        setGameState(null);
        setGameEnded(null);
      }
    });

    socket.on('game:state', (state) => {
      setGameState(state);
      if (state.log) {
        setGameLog(state.log);
      }
    });

    socket.on('game:log', (entry) => {
      setGameLog((prev) => [...prev.slice(-19), entry]);
      if (entry.type === 'error') {
        setLastError(entry.message);
      }
    });

    socket.on('game:ended', (payload) => {
      setGameEnded(payload);
    });

    socket.on('player:disconnect', (payload) => {
      setGameLog((prev) => [
        ...prev.slice(-19),
        { message: `${payload.name} disconnected`, type: 'info' },
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback(async (event, data, cb) => {
    const socket = socketRef.current;
    if (!socket) {
      const response = { error: 'Socket not connected' };
      cb?.(response);
      setLastError(response.error);
      return response;
    }

    if (!socket.connected) {
      const connected = await waitForConnection();
      if (!connected) {
        const response = { error: 'Socket not connected' };
        cb?.(response);
        setLastError(response.error);
        return response;
      }
    }

    return new Promise((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        const response = { error: 'Socket request timed out' };
        cb?.(response);
        setLastError(response.error);
        resolve(response);
      }, 5000);

      socket.emit(event, data, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        cb?.(response);
        if (response?.error) setLastError(response.error);
        resolve(response);
      });
    });
  }, [waitForConnection]);

  const setProfile = useCallback(
    (profile) => emit('profile:set', profile),
    [emit]
  );

  const createRoom = useCallback(
    (opts) => emit('room:create', opts),
    [emit]
  );

  const joinRoom = useCallback(
    (code) => emit('room:join', { code }),
    [emit]
  );

  const leaveRoom = useCallback(async () => {
    const response = await emit('room:leave');
    if (!response?.error) {
      setRoomState(null);
      setGameState(null);
      setGameEnded(null);
      setGameLog([]);
    }
    return response;
  }, [emit]);

  const addBot = useCallback(() => emit('room:addBot'), [emit]);

  const startGame = useCallback(() => emit('room:start'), [emit]);

  const rematch = useCallback(() => emit('room:rematch'), [emit]);

  const playCard = useCallback(
    (cardId) => emit('game:playCard', { cardId }),
    [emit]
  );

  const playBluff = useCallback(
    (cardIds, declaredRank) => emit('game:playBluffDeclareRank', { cardIds, declaredRank }),
    [emit]
  );

  const playBluffDeclareRank = useCallback(
    (cardIds, declaredRank) => emit('game:playBluffDeclareRank', { cardIds, declaredRank }),
    [emit]
  );

  const playBluffMatching = useCallback(
    (cardIds) => emit('game:playBluffMatching', { cardIds }),
    [emit]
  );

  const skipBluffTurn = useCallback(
    () => emit('game:skipBluffTurn'),
    [emit]
  );

  const callBluff = useCallback(() => emit('game:callBluff'), [emit]);

  const passBluff = useCallback(() => emit('game:skipBluffTurn'), [emit]);

  const callThullaBluff = useCallback(() => emit('game:callThullaBluff'), [emit]);

  const finishReveal = useCallback(() => emit('game:finishReveal'), [emit]);

  const clearError = useCallback(() => setLastError(null), []);

  return {
    connected,
    playerId,
    roomState,
    gameState,
    gameLog,
    gameEnded,
    lastError,
    clearError,
    setProfile,
    createRoom,
    joinRoom,
    leaveRoom,
    addBot,
    startGame,
    rematch,
    playCard,
    playBluff,
    playBluffDeclareRank,
    playBluffMatching,
    skipBluffTurn,
    callBluff,
    passBluff,
    callThullaBluff,
    finishReveal,
  };
}
