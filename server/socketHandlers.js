import {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoom,
  addBot,
  markDisconnected,
  reconnectPlayer,
  resetRoomForRematch,
  sanitizeRoom,
  setRoomGame,
} from './roomManager.js';
import { playCard, callThullaBluff } from './games/bhabhiEngine.js';
import { playBluff, callBluff, passBluff, finishReveal } from './games/bluffEngine.js';
import {
  startGame,
  broadcastGame,
  emitLog,
  handleGameEnd,
  scheduleBotTurn,
  scheduleTurnTimeout,
  clearBotTimer,
  clearTurnTimeout,
  scheduleRevealFinish,
} from './bots/botPlayer.js';

const profiles = new Map();

export function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    let playerId = socket.id;
    let roomId = null;

    socket.on('profile:set', ({ name, avatarId }, cb) => {
      profiles.set(socket.id, {
        id: socket.id,
        name: (name || '').trim().slice(0, 16),
        avatarId: avatarId || '0',
      });
      cb?.({ ok: true });
    });

    socket.on('room:create', ({ gameMode, maxPlayers }, cb) => {
      const profile = profiles.get(socket.id);
      if (!profile?.name || profile.name.length < 2) {
        cb?.({ error: 'Name required (2–16 characters)' });
        return;
      }

      const { room, snapshot } = createRoom({
        gameMode: gameMode || 'bhabhi',
        maxPlayers: maxPlayers || 6,
        creator: { ...profile, socketId: socket.id },
      });

      roomId = room.id;
      playerId = profile.id;
      socket.join(room.id);
      cb?.({ code: room.code, roomId: room.id, playerId: profile.id });
      io.to(room.id).emit('room:state', snapshot);
    });

    socket.on('room:join', ({ code }, cb) => {
      const profile = profiles.get(socket.id);
      if (!profile?.name || profile.name.length < 2) {
        cb?.({ error: 'Name required (2–16 characters)' });
        return;
      }

      const result = joinRoom(code, { ...profile, socketId: socket.id });
      if (result.error) {
        cb?.({ error: result.error });
        return;
      }

      roomId = result.room.id;
      playerId = result.playerId || profile.id;
      socket.join(result.room.id);
      cb?.({ code: result.room.code, roomId: result.room.id, playerId: result.playerId || profile.id });
      io.to(result.room.id).emit('room:state', result.snapshot);
    });

    socket.on('room:leave', (_payload, cb) => {
      if (!roomId) {
        cb?.({ error: 'Not in a room' });
        return;
      }
      const result = leaveRoom(roomId, playerId);
      socket.leave(roomId);
      if (result?.snapshot) {
        io.to(roomId).emit('room:state', result.snapshot);
      }
      clearBotTimer(roomId);
      clearTurnTimeout(roomId);
      roomId = null;
      cb?.({ ok: true, snapshot: result?.snapshot || null });
    });

    socket.on('room:addBot', (_payload, cb) => {
      if (!roomId) {
        cb?.({ error: 'Not in a room' });
        return;
      }
      const result = addBot(roomId, playerId);
      if (result.error) {
        cb?.({ error: result.error });
        return;
      }
      cb?.({ ok: true });
      io.to(roomId).emit('room:state', result.snapshot);
    });

    socket.on('room:start', (_payload, cb) => {
      try {
        const room = getRoom(roomId);
        if (!room) {
          cb?.({ error: 'Room not found' });
          return;
        }
        if (room.hostId !== playerId) {
          cb?.({ error: 'Only host can start' });
          return;
        }
        if (room.players.length < 3) {
          cb?.({ error: 'Need at least 3 players' });
          return;
        }
        if (room.phase !== 'waiting') {
          cb?.({ error: 'Game already started' });
          return;
        }

        setRoomGame(room, null);
        startGame(io, room);
        io.to(room.id).emit('room:state', sanitizeRoom(room));
        cb?.({ ok: true });
      } catch (error) {
        console.error('Error starting room:', error);
        cb?.({ error: 'Failed to start game' });
      }
    });

    socket.on('room:rematch', (_payload, cb) => {
      const room = getRoom(roomId);
      if (!room) {
        cb?.({ error: 'Room not found' });
        return;
      }
      if (room.hostId !== playerId) {
        cb?.({ error: 'Only host can rematch' });
        return;
      }
      clearBotTimer(roomId);
      clearTurnTimeout(roomId);
      const snapshot = resetRoomForRematch(room);
      io.to(roomId).emit('room:state', snapshot);
      cb?.({ ok: true });
    });

    socket.on('game:playCard', ({ cardId }, cb) => {
      const room = getRoom(roomId);
      if (!room?.game || room.game.type !== 'bhabhi') {
        cb?.({ error: 'Invalid game state' });
        return;
      }
      const result = playCard(room.game, room, playerId, cardId);
      if (result.error) {
        cb?.({ error: result.error });
        socket.emit('game:log', { message: result.error, type: 'error' });
        return;
      }
      cb?.({ ok: true });
      broadcastGame(io, room);
      emitLog(io, room, room.game);
      if (room.game.phase === 'ended') {
        handleGameEnd(io, room);
      } else {
        scheduleBotTurn(io, room, room.game, 300);
      }
    });

    socket.on('game:callThullaBluff', (_payload, cb) => {
      const room = getRoom(roomId);
      if (!room?.game || room.game.type !== 'bhabhi') {
        cb?.({ error: 'Invalid game state' });
        return;
      }
      const result = callThullaBluff(room.game, room, playerId);
      if (result.error) {
        cb?.({ error: result.error });
        socket.emit('game:log', { message: result.error, type: 'error' });
        return;
      }
      cb?.({ ok: true, lied: result.lied });
      broadcastGame(io, room);
      emitLog(io, room, room.game);
      if (room.game.phase === 'ended') {
        handleGameEnd(io, room);
      } else {
        scheduleBotTurn(io, room, room.game, 500);
      }
    });

    socket.on('game:playBluff', ({ cardIds, declaredRank }, cb) => {
      const room = getRoom(roomId);
      if (!room?.game || room.game.type !== 'bluff') {
        cb?.({ error: 'Invalid game state' });
        return;
      }
      const result = playBluff(room.game, room, playerId, cardIds, declaredRank);
      if (result.error) {
        cb?.({ error: result.error });
        socket.emit('game:log', { message: result.error, type: 'error' });
        return;
      }
      cb?.({ ok: true });
      broadcastGame(io, room);
      emitLog(io, room, room.game);
      if (room.game.phase === 'ended') {
        handleGameEnd(io, room);
      } else {
        scheduleBotTurn(io, room, room.game, 300);
      }
    });

    socket.on('game:callBluff', (_payload, cb) => {
      const room = getRoom(roomId);
      if (!room?.game || room.game.type !== 'bluff') {
        cb?.({ error: 'Invalid game state' });
        return;
      }
      const result = callBluff(room.game, room, playerId);
      if (result.error) {
        cb?.({ error: result.error });
        return;
      }
      cb?.({ ok: true });
      broadcastGame(io, room);
      emitLog(io, room, room.game);
      if (room.game.phase === 'ended') {
        handleGameEnd(io, room);
      } else {
        scheduleRevealFinish(io, room, room.game);
        scheduleBotTurn(io, room, room.game, Math.max(1800, room.game.revealEndsAt ? room.game.revealEndsAt - Date.now() + 200 : 800));
      }
    });

    socket.on('game:passBluff', (_payload, cb) => {
      const room = getRoom(roomId);
      if (!room?.game || room.game.type !== 'bluff') {
        cb?.({ error: 'Invalid game state' });
        return;
      }
      const result = passBluff(room.game);
      if (result.error) {
        cb?.({ error: result.error });
        return;
      }
      cb?.({ ok: true });
      broadcastGame(io, room);
      emitLog(io, room, room.game);
      scheduleBotTurn(io, room, room.game, 300);
    });

    socket.on('game:finishReveal', (_payload, cb) => {
      const room = getRoom(roomId);
      if (!room?.game) {
        cb?.({ error: 'Invalid game state' });
        return;
      }
      if (room.game.type === 'bluff') {
        const result = finishReveal(room.game);
        if (!result.error) {
          broadcastGame(io, room);
          scheduleBotTurn(io, room, room.game, 300);
        }
      }
      cb?.({ ok: true });
    });

    socket.on('disconnect', () => {
      profiles.delete(socket.id);
      if (!roomId) return;

      const room = getRoom(roomId);
      if (!room) return;

      const player = room.players.find((p) => p.id === playerId);
      if (player?.isBot) return;

      if (room.phase === 'waiting') {
        const result = leaveRoom(roomId, playerId);
        if (result?.snapshot) {
          io.to(roomId).emit('room:state', result.snapshot);
        }
      } else {
        const snapshot = markDisconnected(roomId, playerId);
        if (snapshot) {
          io.to(roomId).emit('room:state', snapshot);
          io.to(roomId).emit('player:disconnect', { playerId, name: player?.name });
        }
      }
    });
  });
}
