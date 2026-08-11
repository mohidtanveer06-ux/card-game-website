import { createDeck, shuffleDeck, dealEvenly, sortHand, formatCard, findAceOfSpades } from './deck.js';

const TURN_TIMEOUT_MS = 15000;

export function createBhabhiGame(room, playerIds) {
  const deck = shuffleDeck(createDeck());
  const hands = dealEvenly(deck, playerIds);
  for (const id of playerIds) {
    hands[id] = sortHand(hands[id]);
  }

  const aceHolder = findAceOfSpades(hands);
  const turnOrder = [...room.players.map((p) => p.id)];
  const aceIndex = turnOrder.indexOf(aceHolder);

  return {
    mode: 'bhabhi',
    phase: 'playing',
    hands,
    discardPile: [],
    currentTrick: { leaderId: aceHolder, ledSuit: null, plays: [] },
    turnOrder,
    currentTurnIndex: aceIndex,
    gotAway: [],
    escapeOrder: [],
    isFirstTrick: true,
    turnDeadline: Date.now() + TURN_TIMEOUT_MS,
    logs: [],
    winner: null,
    bhabhi: null,
  };
}

export function attachPlayerNames(game, room) {
  game.playerNames = room.players.map((p) => p.name);
}

function activePlayers(game) {
  return game.turnOrder.filter((id) => !game.gotAway.includes(id));
}

function playerHasCards(game, playerId) {
  return (game.hands[playerId] || []).length > 0;
}

function advanceTurnIndex(game, fromIndex) {
  const active = activePlayers(game);
  if (active.length <= 1) return fromIndex;
  let idx = fromIndex;
  for (let i = 0; i < game.turnOrder.length; i++) {
    idx = (idx + 1) % game.turnOrder.length;
    const pid = game.turnOrder[idx];
    if (!game.gotAway.includes(pid) && playerHasCards(game, pid)) return idx;
  }
  return fromIndex;
}

function checkGotAway(game, playerId) {
  if (game.hands[playerId].length === 0 && !game.gotAway.includes(playerId)) {
    game.gotAway.push(playerId);
    game.escapeOrder.push(playerId);
    game.logs.push({ message: `${playerId} got away safely!`, type: 'success' });
  }
}

function endGameIfNeeded(game, room) {
  const remaining = activePlayers(game).filter((id) => playerHasCards(game, id));
  if (remaining.length <= 1) {
    game.phase = 'ended';
    if (remaining.length === 1) {
      game.bhabhi = remaining[0];
      const bhabhiName = room.players.find((p) => p.id === game.bhabhi)?.name || 'Unknown';
      game.logs.push({ message: `${bhabhiName} is the BHABHI (loser)!`, type: 'danger' });
    }
    return true;
  }
  return false;
}

function drawFromDiscardForLeader(game, leaderId) {
  while (game.hands[leaderId].length === 0 && game.discardPile.length > 0) {
    const idx = Math.floor(Math.random() * game.discardPile.length);
    const card = game.discardPile.splice(idx, 1)[0];
    game.hands[leaderId].push(card);
    game.hands[leaderId] = sortHand(game.hands[leaderId]);
  }
}

function resolveCleanTrick(game, room) {
  const { ledSuit, plays } = game.currentTrick;
  let highest = plays[0];
  for (const play of plays) {
    if (play.card.suit === ledSuit && play.card.value > highest.card.value) {
      highest = play;
    }
  }
  game.discardPile.push(...plays.map((p) => p.card));
  game.logs.push({
    message: `${getPlayerName(room, highest.playerId)} wins the trick with ${formatCard(highest.card)}`,
    type: 'info',
  });
  checkGotAway(game, highest.playerId);
  if (endGameIfNeeded(game, room)) return;

  let leaderId = highest.playerId;
  drawFromDiscardForLeader(game, leaderId);
  if (!playerHasCards(game, leaderId)) {
    const remaining = activePlayers(game).filter((id) => playerHasCards(game, id));
    leaderId = remaining[0];
  }

  game.currentTrick = { leaderId, ledSuit: null, plays: [] };
  game.currentTurnIndex = game.turnOrder.indexOf(leaderId);
  game.isFirstTrick = false;
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
}

function resolveThullaTrick(game, room, thullaPlayerId) {
  const { ledSuit, plays } = game.currentTrick;
  const suitPlays = plays.filter((p) => p.card.suit === ledSuit);
  let pickupPlayerId = suitPlays[0]?.playerId;
  let highestVal = suitPlays[0]?.card.value ?? 0;
  for (const play of suitPlays) {
    if (play.card.value > highestVal) {
      highestVal = play.card.value;
      pickupPlayerId = play.playerId;
    }
  }

  const trickCards = plays.map((p) => p.card);
  game.hands[pickupPlayerId].push(...trickCards);
  game.hands[pickupPlayerId] = sortHand(game.hands[pickupPlayerId]);

  const thullaName = getPlayerName(room, thullaPlayerId);
  const pickupName = getPlayerName(room, pickupPlayerId);
  game.logs.push({
    message: `${thullaName} threw THULLA! ${pickupName} picks up ${trickCards.length} cards.`,
    type: 'warning',
  });

  game.currentTrick = { leaderId: thullaPlayerId, ledSuit: null, plays: [] };
  game.currentTurnIndex = game.turnOrder.indexOf(thullaPlayerId);
  game.isFirstTrick = false;
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
}

function getPlayerName(room, playerId) {
  return room.players.find((p) => p.id === playerId)?.name || 'Player';
}

export function getCurrentPlayerId(game) {
  return game.turnOrder[game.currentTurnIndex];
}

export const bhabhiCurrentPlayer = getCurrentPlayerId;

export function getLegalPlays(game, playerId) {
  const hand = game.hands[playerId] || [];
  if (hand.length === 0) return [];

  const { plays, ledSuit } = game.currentTrick;
  const isLead = plays.length === 0;

  if (game.isFirstTrick && isLead) {
    const ace = hand.find((c) => c.id === 'A-spades');
    if (ace) return [ace.id];
    return hand.map((c) => c.id);
  }

  if (isLead) {
    return hand.map((c) => c.id);
  }

  const suitCards = hand.filter((c) => c.suit === ledSuit);
  if (suitCards.length > 0) {
    return suitCards.map((c) => c.id);
  }
  return hand.map((c) => c.id);
}

export const playCard = playBhabhiCard;

export function playBhabhiCard(game, room, playerId, cardId) {
  if (game.phase !== 'playing') return { error: 'Game not in playing phase' };
  if (getCurrentPlayerId(game) !== playerId) return { error: 'Not your turn' };

  const legal = getLegalPlays(game, playerId);
  if (!legal.includes(cardId)) return { error: 'Illegal card play' };

  const hand = game.hands[playerId];
  const cardIndex = hand.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) return { error: 'Card not in hand' };

  const card = hand.splice(cardIndex, 1)[0];
  const { plays } = game.currentTrick;

  if (plays.length === 0) {
    game.currentTrick.ledSuit = card.suit;
  }

  game.currentTrick.plays.push({ playerId, card });
  game.logs.push({
    message: `${getPlayerName(room, playerId)} played ${formatCard(card)}`,
    type: 'info',
  });

  checkGotAway(game, playerId);
  if (endGameIfNeeded(game, room)) return { success: true };

  const isThulla = card.suit !== game.currentTrick.ledSuit;
  const activeRemaining = activePlayers(game).filter((id) => playerHasCards(game, id));
  const playersStillToPlay = activeRemaining.filter(
    (id) => !game.currentTrick.plays.some((p) => p.playerId === id)
  );

  if (isThulla) {
    resolveThullaTrick(game, room, playerId);
    return { success: true, thulla: true };
  }

  if (playersStillToPlay.length === 0) {
    resolveCleanTrick(game, room);
    return { success: true };
  }

  game.currentTurnIndex = advanceTurnIndex(game, game.currentTurnIndex);
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  return { success: true };
}

export function autoPlayBhabhi(game, room, playerId) {
  const legal = getLegalPlays(game, playerId);
  if (legal.length === 0) return { error: 'No legal plays' };
  const cardId = legal[Math.floor(Math.random() * legal.length)];
  return playBhabhiCard(game, room, playerId, cardId);
}

export function sanitizeBhabhiState(game, room, viewerId) {
  const players = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    avatarId: p.avatarId,
    isBot: p.isBot,
    disconnected: p.disconnected,
    cardCount: (game.hands[p.id] || []).length,
    gotAway: game.gotAway.includes(p.id),
    isHost: p.isHost,
  }));

  const myHand = game.hands[viewerId] || [];
  const currentPlayerId = getCurrentPlayerId(game);
  const legalPlays = currentPlayerId === viewerId ? getLegalPlays(game, viewerId) : [];

  return {
    mode: 'bhabhi',
    phase: game.phase,
    players,
    myHand,
    legalPlays,
    currentPlayerId,
    currentTrick: game.currentTrick,
    discardCount: game.discardPile.length,
    gotAway: game.gotAway,
    escapeOrder: game.escapeOrder,
    isFirstTrick: game.isFirstTrick,
    turnDeadline: game.turnDeadline,
    turnTimeoutMs: TURN_TIMEOUT_MS,
    logs: game.logs.slice(-20),
    bhabhi: game.bhabhi,
    escapeOrderNames: game.escapeOrder.map((id) => room.players.find((p) => p.id === id)?.name),
    bhabhiName: game.bhabhi ? room.players.find((p) => p.id === game.bhabhi)?.name : null,
  };
}

export const chooseBhabhiBotMove = getBhabhiBotMove;

export function getBhabhiBotMove(game, playerId) {
  const hand = game.hands[playerId] || [];
  const legalIds = getLegalPlays(game, playerId);
  if (legalIds.length === 0) return null;

  const legalCards = hand.filter((c) => legalIds.includes(c.id));
  const { ledSuit, plays } = game.currentTrick;
  const activeCount = activePlayers(game).filter((id) => playerHasCards(game, id)).length;

  if (plays.length === 0) {
    if (activeCount <= 2) {
      return legalCards.reduce((a, b) => (a.value > b.value ? a : b)).id;
    }
    return legalCards.reduce((a, b) => (a.value < b.value ? a : b)).id;
  }

  const hasLedSuit = hand.some((c) => c.suit === ledSuit);
  if (hasLedSuit) {
    return legalCards.reduce((a, b) => (a.value < b.value ? a : b)).id;
  }
  return legalCards.reduce((a, b) => (a.value < b.value ? a : b)).id;
}
