import { createRoom } from './server/roomManager.js';
import { startGame } from './server/bots/botPlayer.js';
import { sanitizeBhabhiState } from './server/games/bhabhiEngine.js';

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

startGame({ to: () => ({ emit: () => {} }) }, room);
const viewerId = room.players[0].id;
const state = sanitizeBhabhiState(room.game, room, viewerId);
console.log('currentPlayerId', state.currentPlayerId);
console.log('isMyTurn', state.isMyTurn);
console.log('playableCardIds', state.playableCardIds);
console.log('myHand', state.myHand.map((c) => c.id));
console.log('handCounts', state.handCounts);
console.log('gameType', state.type, state.mode);
console.log('roomPlayers', room.players.map((p) => p.id));
