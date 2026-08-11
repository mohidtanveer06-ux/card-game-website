import { createDeck, shuffleDeck, dealEvenly, sortHand, formatCard, nextBluffRank, BLUFF_RANK_ORDER } from './deck.js';

const TURN_TIMEOUT_MS = 15000;
const CHALLENGE_WINDOW_MS = 5000;

export function createBluffGame(room, playerIds) {
  const deck = shuffleDeck(createDeck());
  const hands = dealEvenly(deck, playerIds);
  for (const id of playerIds) {
    hands[id] = sortHand(hands[id]);
  }

  const turnOrder = room.players.map((p) => p.id);

  return {
    mode: 'bluff',
    phase: 'playing',
    hands,
    centerPile: [],
    requiredRank: 'A',
    turnOrder,
    currentTurnIndex: 0,
    lastPlay: null,
    challengeWindowEnd: null,
    challengeCaller: null,
    revealCards: null,
    turnDeadline: Date.now() + TURN_TIMEOUT_MS,
    logs: [],
    winner: null,
    pendingRankAdvance: false,
  };
}

export function attachPlayerNames(game, room) {
  game.playerNames = room.players.map((p) => p.name);
}

function getPlayerName(room, playerId) {
  return room.players.find((p) => p.id === playerId)?.name || 'Player';
}

export function getCurrentPlayerId(game) {
  return game.turnOrder[game.currentTurnIndex];
}

export const bluffCurrentPlayer = getCurrentPlayerId;
export const playBluff = playBluffCards;

function advanceTurn(game) {
  game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  game.phase = 'playing';
  game.lastPlay = null;
  game.challengeWindowEnd = null;
}

export function playBluffCards(game, room, playerId, cardIds, declaredRank) {
  if (game.phase !== 'playing') return { error: 'Not in playing phase' };
  if (getCurrentPlayerId(game) !== playerId) return { error: 'Not your turn' };
  if (declaredRank !== game.requiredRank) return { error: `Must declare ${game.requiredRank}` };
  if (!cardIds || cardIds.length < 1 || cardIds.length > 4) return { error: 'Play 1 to 4 cards' };

  const hand = game.hands[playerId];
  const cards = [];
  for (const id of cardIds) {
    const idx = hand.findIndex((c) => c.id === id);
    if (idx === -1) return { error: 'Invalid card' };
    cards.push(hand.splice(idx, 1)[0]);
  }

  game.centerPile.push(...cards);
  game.lastPlay = {
    playerId,
    declaredRank,
    count: cards.length,
    cardIds: cards.map((c) => c.id),
    cards,
  };

  game.logs.push({
    message: `${getPlayerName(room, playerId)} claims ${cards.length} × ${declaredRank}`,
    type: 'info',
  });

  if (hand.length === 0) {
    game.phase = 'ended';
    game.winner = playerId;
    game.logs.push({
      message: `${getPlayerName(room, playerId)} wins!`,
      type: 'success',
    });
    return { success: true, won: true };
  }

  game.phase = 'challengeWindow';
  game.challengeWindowEnd = Date.now() + CHALLENGE_WINDOW_MS;
  return { success: true };
}

export function callBluff(game, room, callerId) {
  if (game.phase !== 'challengeWindow') return { error: 'Cannot call bluff now' };
  if (!game.lastPlay) return { error: 'No play to challenge' };
  if (callerId === game.lastPlay.playerId) return { error: 'Cannot challenge yourself' };

  const { playerId, declaredRank, cards, count } = game.lastPlay;
  const lied = cards.some((c) => c.rank !== declaredRank);
  const loserId = lied ? playerId : callerId;
  const winnerName = lied ? getPlayerName(room, callerId) : getPlayerName(room, playerId);
  const loserName = getPlayerName(room, loserId);

  game.hands[loserId].push(...game.centerPile);
  game.hands[loserId] = sortHand(game.hands[loserId]);
  game.centerPile = [];

  game.revealCards = cards;
  game.phase = 'reveal';
  game.challengeCaller = callerId;

  game.logs.push({
    message: lied
      ? `${getPlayerName(room, callerId)} called BLUFF on ${getPlayerName(room, playerId)} — caught lying! ${loserName} picks up the pile.`
      : `${getPlayerName(room, callerId)} called BLUFF on ${getPlayerName(room, playerId)} — wrong! ${loserName} picks up the pile.`,
    type: 'warning',
  });

  game.requiredRank = nextBluffRank(game.requiredRank);
  game.currentTurnIndex = game.turnOrder.indexOf(loserId);
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  game.lastPlay = null;
  game.challengeWindowEnd = null;

  setTimeout(() => {}, 0);
  game.phase = 'playing';

  return { success: true, lied, revealCards: cards };
}

export const passBluff = passBluffChallenge;

export function passBluffChallenge(game) {
  if (game.phase !== 'challengeWindow') return { error: 'No challenge window' };
  game.requiredRank = nextBluffRank(game.requiredRank);
  advanceTurn(game);
  return { success: true };
}

export function autoPlayBluff(game, room, playerId) {
  const hand = game.hands[playerId] || [];
  if (hand.length === 0) return { error: 'No cards' };

  const matching = hand.filter((c) => c.rank === game.requiredRank);
  const count = Math.min(Math.max(1, Math.floor(Math.random() * 4) + 1), hand.length);
  let cardIds;

  if (matching.length > 0 && Math.random() < 0.6) {
    cardIds = matching.slice(0, Math.min(count, matching.length)).map((c) => c.id);
    while (cardIds.length < count && hand.length > cardIds.length) {
      const extra = hand.find((c) => !cardIds.includes(c.id));
      if (extra) cardIds.push(extra.id);
    }
  } else {
    cardIds = hand.slice(0, count).map((c) => c.id);
  }

  return playBluffCards(game, room, playerId, cardIds, game.requiredRank);
}

export function sanitizeBluffState(game, room, viewerId) {
  const players = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatarId: p.avatarId,
    isBot: p.isBot,
    disconnected: p.disconnected,
    cardCount: (game.hands[p.id] || []).length,
    isHost: p.isHost,
  }));

  return {
    mode: 'bluff',
    phase: game.phase,
    players,
    myHand: game.hands[viewerId] || [],
    currentPlayerId: getCurrentPlayerId(game),
    requiredRank: game.requiredRank,
    centerPileCount: game.centerPile.length,
    lastPlay: game.lastPlay
      ? {
          playerId: game.lastPlay.playerId,
          declaredRank: game.lastPlay.declaredRank,
          count: game.lastPlay.count,
        }
      : null,
    challengeWindowEnd: game.challengeWindowEnd,
    challengeWindowMs: CHALLENGE_WINDOW_MS,
    revealCards: game.revealCards,
    turnDeadline: game.turnDeadline,
    turnTimeoutMs: TURN_TIMEOUT_MS,
    logs: game.logs.slice(-20),
    winner: game.winner,
    winnerName: game.winner ? room.players.find((p) => p.id === game.winner)?.name : null,
    rankOrder: BLUFF_RANK_ORDER,
  };
}

export const chooseBluffBotPlay = getBluffBotPlay;

export function getBluffBotPlay(game, playerId) {
  const hand = game.hands[playerId] || [];
  if (hand.length === 0) return null;

  const matching = hand.filter((c) => c.rank === game.requiredRank);
  const count = Math.min(Math.floor(Math.random() * 4) + 1, hand.length);

  if (matching.length > 0 && Math.random() < 0.65) {
    const ids = matching.slice(0, Math.min(count, matching.length)).map((c) => c.id);
    return { cardIds: ids, declaredRank: game.requiredRank };
  }

  return {
    cardIds: hand.slice(0, count).map((c) => c.id),
    declaredRank: game.requiredRank,
  };
}

export function shouldBotCallBluff(game) {
  if (game.phase !== 'challengeWindow' || !game.lastPlay) return false;
  const pileSize = game.centerPile.length;
  if (pileSize > 8) return Math.random() < 0.5;
  return Math.random() < 0.15;
}

export { CHALLENGE_WINDOW_MS, TURN_TIMEOUT_MS as BLUFF_TURN_TIMEOUT_MS };
