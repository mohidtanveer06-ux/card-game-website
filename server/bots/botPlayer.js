import {
  createBhabhiGame,
  attachPlayerNames as attachBhabhiNames,
  playCard,
  autoPlayBhabhi,
  chooseBhabhiBotMove,
  sanitizeBhabhiState,
  bhabhiCurrentPlayer,
  buildBhabhiStandings,
  shouldBotCallBhabhiBluff,
  callThullaBluff,
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
  finishReveal,
} from '../games/bluffEngine.js';
import { sanitizeRoom } from '../roomManager.js';

const botTimers = new Map();
const revealTimers = new Map();

function clearBotTimer(roomId) {
  const t = botTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    botTimers.delete(roomId);
  }
}

function clearRevealTimer(roomId) {
  const t = revealTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    revealTimers.delete(roomId);
  }
}

function scheduleRevealFinish(io, room, game) {
  clearRevealTimer(room.id);
  if (game.type !== 'bluff' || game.phase !== 'reveal') return;

  const duration = Math.max(0, (game.revealEndsAt || Date.now() + 1500) - Date.now());
  const timer = setTimeout(() => {
    if (room.game && room.game.phase === 'reveal' && room.game.type === 'bluff') {
      finishReveal(room.game);
      broadcastGame(io, room);
      if (room.game.phase === 'ended') {
        handleGameEnd(io, room);
        return;
      }
      scheduleBotTurn(io, room, room.game, 300);
    }
  }, duration + 50);
  revealTimers.set(room.id, timer);
}

function scheduleBotTurn(io, room, game, delayMs = 800) {
  clearBotTimer(room.id);
  clearRevealTimer(room.id);

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
  const currentPlayer = room.players.find((p) => p.id === currentId);

  const botChallengers = room.players.filter(
    (p) =>
      p.isBot &&
      !!game.lastPlay &&
      game.lastPlay.playerId !== p.id &&
      !game.gotAway.includes(p.id)
  );
  for (const bot of botChallengers) {
    if (shouldBotCallBhabhiBluff(game, bot.id)) {
      callThullaBluff(game, room, bot.id);
      broadcastGame(io, room);
      emitLog(io, room, game);
      if (game.phase === 'ended') {
        handleGameEnd(io, room);
        return;
      }
      scheduleBotTurn(io, room, game, 700);
      return;
    }
  }

  if (!currentPlayer?.isBot) {
    scheduleTurnTimeout(io, room, game);
    return;
  }

  const move = chooseBhabhiBotMove(game, currentId);
  if (move) {
    const cardId = move.id || move;
    playCard(game, room, currentId, cardId);
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
  if (game.phase === 'reveal') {
    scheduleRevealFinish(io, room, game);
    return;
  }

  if (game.phase === 'challengeWindow') {
    const candidates = room.players.filter(
      (p) =>
        p.isBot &&
        p.id !== game.lastPlay?.playerId &&
        (game.hands[p.id]?.length || 0) > 0
    );
    if (candidates.length > 0 && shouldBotCallBluff(game)) {
      const bot = candidates[Math.floor(Math.random() * candidates.length)];
      callBluff(game, room, bot.id);
      broadcastGame(io, room);
      emitLog(io, room, game);
      if (game.phase === 'ended') {
        handleGameEnd(io, room);
        return;
      }
      scheduleRevealFinish(io, room, game);
      scheduleBotTurn(io, room, game, Math.max(1800, (game.revealEndsAt || Date.now() + 1500) - Date.now() + 300));
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
    playBluff(game, room, currentId, move.cardIds, move.declaredRank);
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
  const deadline = game.turnDeadline || game.challengeDeadline || game.revealEndsAt;
  if (!deadline) return;

  const ms = Math.max(0, deadline - Date.now());
  const timer = setTimeout(() => {
    if (!room.game || room.phase !== 'playing') return;

    if (game.type === 'bhabhi') {
      const pid = bhabhiCurrentPlayer(game);
      autoPlayBhabhi(game, room, pid);
    } else if (game.type === 'bluff') {
      if (game.phase === 'challengeWindow') {
        passBluff(game);
      } else if (game.phase === 'reveal') {
        finishReveal(game);
      } else {
        const pid = bluffCurrentPlayer(game);
        autoPlayBluff(game, room, pid);
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
  clearRevealTimer(room.id);
  const game = room.game;
  room.phase = 'ended';

  const payload = {
    gameMode: room.gameMode,
    winner: game.winner,
    bhabhi: game.bhabhi,
    escapeOrder: game.escapeOrder || [],
    playerNames: game.playerNames,
    standings: room.gameMode === 'bhabhi' ? buildBhabhiStandings(game, room) : [],
  };

  io.to(room.id).emit('room:state', sanitizeRoom(room));
  io.to(room.id).emit('game:ended', payload);
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
  scheduleRevealFinish,
  broadcastGame,
  emitLog,
  handleGameEnd,
  startGame,
  clearBotTimer,
  clearTurnTimeout,
  clearRevealTimer,
  sanitizeGame,
};
