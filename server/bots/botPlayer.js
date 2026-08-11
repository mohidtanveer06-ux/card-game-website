import {
  createBhabhiGame,
  attachPlayerNames as attachBhabhiNames,
  playCard,
  autoPlayBhabhi,
  chooseBhabhiBotMove,
  sanitizeBhabhiState,
  bhabhiCurrentPlayer,
} from '../games/bhabhiEngine.js';
import {
  createBluffGame,
  attachPlayerNames as attachBluffNames,
  playBluff,
  callBluff,
  passBluff,
  autoPlayBluff,
  chooseBluffBotPlay,
  shouldBotCallBluff,
  sanitizeBluffState,
  bluffCurrentPlayer,
} from '../games/bluffEngine.js';

const botTimers = new Map();

function clearBotTimer(roomId) {
  const t = botTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    botTimers.delete(roomId);
  }
}

function scheduleBotTurn(io, room, game, delayMs = 800) {
  clearBotTimer(room.id);

  const run = () => {
    if (!room.game || room.phase !== 'playing') return;

    if (game.type === 'bhabhi') {
      handleBhabhiBot(io, room, game);
    } else if (game.type === 'bluff') {
      handleBluffBot(io, room, game);
    }
  };

  const timer = setTimeout(run, delayMs);
  botTimers.set(room.id, timer);
}

function handleBhabhiBot(io, room, game) {
  const currentId = bhabhiCurrentPlayer(game);
  const player = room.players.find((p) => p.id === currentId);
  if (!player?.isBot) {
    scheduleTurnTimeout(io, room, game);
    return;
  }

  const move = chooseBhabhiBotMove(game, currentId);
  if (move) {
    playCard(game, currentId, move.id);
    broadcastGame(io, room);
    emitLog(io, room, game);
    if (game.phase === 'ended') {
      handleGameEnd(io, room);
      return;
    }
  }
  scheduleBotTurn(io, room, game, 600);
}

function handleBluffBot(io, room, game) {
  if (game.phase === 'challengeWindow') {
    const candidates = room.players.filter(
      (p) =>
        p.isBot &&
        p.id !== game.lastPlay?.playerId &&
        (game.hands[p.id]?.length || 0) > 0
    );
    if (candidates.length > 0 && shouldBotCallBluff(game)) {
      const bot = candidates[Math.floor(Math.random() * candidates.length)];
      callBluff(game, bot.id);
      broadcastGame(io, room);
      emitLog(io, room, game);
      if (game.phase === 'ended') {
        handleGameEnd(io, room);
        return;
      }
      scheduleBotTurn(io, room, game, 1000);
      return;
    }
    passBluff(game);
    broadcastGame(io, room);
    emitLog(io, room, game);
    scheduleBotTurn(io, room, game, 600);
    return;
  }

  const currentId = bluffCurrentPlayer(game);
  const player = room.players.find((p) => p.id === currentId);
  if (!player?.isBot) {
    scheduleTurnTimeout(io, room, game);
    return;
  }

  const move = chooseBluffBotPlay(game, currentId);
  if (move) {
    playBluff(game, currentId, move.cardIds, move.declaredRank);
    broadcastGame(io, room);
    emitLog(io, room, game);
    if (game.phase === 'ended') {
      handleGameEnd(io, room);
      return;
    }
  }
  scheduleBotTurn(io, room, game, 800);
}

const turnTimeouts = new Map();

function clearTurnTimeout(roomId) {
  const t = turnTimeouts.get(roomId);
  if (t) {
    clearTimeout(t);
    turnTimeouts.delete(roomId);
  }
}

function scheduleTurnTimeout(io, room, game) {
  clearTurnTimeout(room.id);
  const deadline = game.turnDeadline || game.challengeDeadline;
  if (!deadline) return;

  const ms = Math.max(0, deadline - Date.now());
  const timer = setTimeout(() => {
    if (!room.game || room.phase !== 'playing') return;

    if (game.type === 'bhabhi') {
      const pid = bhabhiCurrentPlayer(game);
      autoPlayBhabhi(game, pid);
    } else if (game.type === 'bluff') {
      if (game.phase === 'challengeWindow') {
        passBluff(game);
      } else {
        const pid = bluffCurrentPlayer(game);
        autoPlayBluff(game, pid);
      }
    }

    broadcastGame(io, room);
    emitLog(io, room, game);

    if (game.phase === 'ended') {
      handleGameEnd(io, room);
      return;
    }
    scheduleBotTurn(io, room, game, 400);
  }, ms + 50);

  turnTimeouts.set(room.id, timer);
}

function sanitizeGame(game, viewerId, room) {
  const type = game.type || game.mode;
  if (type === 'bhabhi') return sanitizeBhabhiState(game, room, viewerId);
  return sanitizeBluffState(game, room, viewerId);
}

function broadcastGame(io, room) {
  const game = room.game;
  if (!game) return;

  for (const player of room.players) {
    if (player.socketId && !player.disconnected) {
      io.to(player.socketId).emit('game:state', sanitizeGame(game, player.id, room));
    }
  }
}

function emitLog(io, room, game) {
  const logs = game.logs || game.log || [];
  const last = logs[logs.length - 1];
  if (last) {
    io.to(room.id).emit('game:log', last);
  }
}

function handleGameEnd(io, room) {
  clearBotTimer(room.id);
  clearTurnTimeout(room.id);
  const game = room.game;
  room.phase = 'ended';

  io.to(room.id).emit('game:ended', {
    gameMode: room.gameMode,
    winner: game.winner,
    bhabhi: game.bhabhi,
    escapeOrder: game.escapeOrder || [],
    playerNames: game.playerNames,
  });
}

function startGame(io, room) {
  const playerIds = room.players.map((p) => p.id);
  let game;
  if (room.gameMode === 'bhabhi') {
    game = createBhabhiGame(room, playerIds);
    attachBhabhiNames(game, room);
  } else {
    game = createBluffGame(room, playerIds);
    attachBluffNames(game, room);
  }

  room.game = game;
  room.phase = 'playing';

  io.to(room.id).emit('game:log', { message: 'Dealing cards...', type: 'info' });
  broadcastGame(io, room);
  scheduleBotTurn(io, room, game, 1200);
}

export {
  scheduleBotTurn,
  scheduleTurnTimeout,
  broadcastGame,
  emitLog,
  handleGameEnd,
  startGame,
  clearBotTimer,
  clearTurnTimeout,
  sanitizeGame,
};
