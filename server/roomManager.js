const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BOT_NAMES = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta', 'Bot Epsilon', 'Bot Zeta'];
const DISCONNECT_GRACE_MS = 60000;
const ROOM_IDLE_MS = 5 * 60 * 1000;

const rooms = new Map();
const codeIndex = new Map();

let botCounter = 0;

function generateCode() {
  return Array.from({ length: 4 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('');
}

function uniqueCode() {
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    if (!codeIndex.has(code)) return code;
  }
  throw new Error('Could not generate room code');
}

function sanitizeRoom(room) {
  return {
    roomId: room.id,
    code: room.code,
    gameMode: room.gameMode,
    maxPlayers: room.maxPlayers,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      isBot: p.isBot,
      isHost: p.id === room.hostId,
      disconnected: !!p.disconnected,
      seatIndex: p.seatIndex,
    })),
  };
}

function scheduleRoomCleanup(room) {
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  room.cleanupTimer = setTimeout(() => {
    if (rooms.get(room.id) === room && room.players.length === 0) {
      codeIndex.delete(room.code);
      rooms.delete(room.id);
    }
  }, ROOM_IDLE_MS);
}

export function getRoom(roomId) {
  return rooms.get(roomId);
}

export function getRoomByCode(code) {
  const id = codeIndex.get(code?.toUpperCase());
  return id ? rooms.get(id) : null;
}

export function createRoom({ gameMode, maxPlayers, creator }) {
  const code = uniqueCode();
  const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const room = {
    id: roomId,
    code,
    gameMode,
    maxPlayers: Math.min(6, Math.max(3, maxPlayers || 6)),
    phase: 'waiting',
    hostId: creator.id,
    players: [],
    game: null,
    cleanupTimer: null,
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  codeIndex.set(code, roomId);
  addPlayerToRoom(room, creator);
  return { room, snapshot: sanitizeRoom(room) };
}

function addPlayerToRoom(room, player) {
  const seatIndex = room.players.length;
  room.players.push({
    id: player.id,
    socketId: player.socketId,
    name: player.name,
    avatarId: player.avatarId,
    isBot: false,
    disconnected: false,
    disconnectTimer: null,
    seatIndex,
  });
}

export function joinRoom(code, player) {
  const room = getRoomByCode(code);
  if (!room) return { error: 'Invalid room code' };
  if (room.phase !== 'waiting') return { error: 'Game already in progress' };
  if (room.players.length >= room.maxPlayers) return { error: 'Room is full' };

  const existing = room.players.find(
    (p) => !p.isBot && p.name.toLowerCase() === player.name.toLowerCase()
  );
  if (existing) {
    if (existing.disconnected) {
      existing.socketId = player.socketId;
      existing.disconnected = false;
      if (existing.disconnectTimer) {
        clearTimeout(existing.disconnectTimer);
        existing.disconnectTimer = null;
      }
      return { room, snapshot: sanitizeRoom(room), playerId: existing.id };
    }
    return { error: 'Name already taken in this room' };
  }

  addPlayerToRoom(room, player);
  return { room, snapshot: sanitizeRoom(room), playerId: player.id };
}

export function leaveRoom(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  const idx = room.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return null;

  const wasHost = room.hostId === playerId;
  room.players.splice(idx, 1);
  room.players.forEach((p, i) => {
    p.seatIndex = i;
  });

  if (room.players.length === 0) {
    codeIndex.delete(room.code);
    rooms.delete(room.id);
    return { destroyed: true };
  }

  if (wasHost) {
    const nextHuman = room.players.find((p) => !p.isBot && !p.disconnected);
    room.hostId = (nextHuman || room.players[0]).id;
  }

  if (room.phase === 'waiting') {
    scheduleRoomCleanup(room);
  }

  return { room, snapshot: sanitizeRoom(room), wasHost };
}

export function markDisconnected(roomId, playerId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player || player.isBot) return null;

  player.disconnected = true;
  player.socketId = null;

  player.disconnectTimer = setTimeout(() => {
    leaveRoom(roomId, playerId);
  }, DISCONNECT_GRACE_MS);

  return sanitizeRoom(room);
}

export function reconnectPlayer(roomId, playerId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  player.socketId = socketId;
  player.disconnected = false;
  if (player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }
  return sanitizeRoom(room);
}

export function addBot(roomId, requesterId) {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== requesterId) return { error: 'Only host can add bots' };
  if (room.phase !== 'waiting') return { error: 'Game already started' };
  if (room.players.length >= room.maxPlayers) return { error: 'Room is full' };

  botCounter += 1;
  const botId = `bot_${botCounter}`;
  const nameIdx = room.players.filter((p) => p.isBot).length;
  room.players.push({
    id: botId,
    socketId: null,
    name: BOT_NAMES[nameIdx % BOT_NAMES.length],
    avatarId: 'bot',
    isBot: true,
    disconnected: false,
    disconnectTimer: null,
    seatIndex: room.players.length,
  });

  return { room, snapshot: sanitizeRoom(room) };
}

export function setRoomGame(room, game) {
  room.game = game;
  room.phase = 'playing';
}

export function resetRoomForRematch(room) {
  room.phase = 'waiting';
  room.game = null;
  room.players = room.players.filter((p) => !p.disconnected || p.isBot);
  room.players.forEach((p, i) => {
    p.seatIndex = i;
    p.disconnected = false;
  });
  return sanitizeRoom(room);
}

export function endRoomGame(room) {
  room.phase = 'ended';
}

export { sanitizeRoom };
