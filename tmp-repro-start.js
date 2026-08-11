import { createRoom } from './server/roomManager.js';
import { startGame } from './server/bots/botPlayer.js';

const { room } = createRoom({
  gameMode: 'bhabhi',
  maxPlayers: 4,
  creator: { id: 'p1', socketId: 's1', name: 'Host', avatarId: '0' },
});

room.players.push({
  id: 'p2',
  socketId: 's2',
  name: 'P2',
  avatarId: '1',
  isBot: false,
  disconnected: false,
  disconnectTimer: null,
  seatIndex: 1,
});
room.players.push({
  id: 'p3',
  socketId: 's3',
  name: 'P3',
  avatarId: '2',
  isBot: false,
  disconnected: false,
  disconnectTimer: null,
  seatIndex: 2,
});

try {
  startGame({ to: () => ({ emit: () => {} }) }, room);
  console.log('start successful', room.phase, room.game?.mode, room.game?.turnOrder.length, Object.keys(room.game?.hands || {}));
} catch (err) {
  console.error('start failed', err);
}
