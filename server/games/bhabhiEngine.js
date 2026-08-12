import { createDeck, shuffleDeck, dealEvenly, sortHand, formatCard, findAceOfSpades } from './deck.js';

const TURN_TIMEOUT_MS = 15000;
const CHALLENGE_WINDOW_MS = 5000;

export function createBhabhiGame(room, playerIds = room.players.map((p) => p.id)) {
  const deck = shuffleDeck(createDeck());
  const hands = dealEvenlyStandard(deck, playerIds);
  for (const id of playerIds) {
    hands[id] = sortHand(hands[id]);
  }

  let aceHolder = findAceOfSpades(hands);
  if (!aceHolder) aceHolder = playerIds[0];

  const turnOrder = [...room.players.map((p) => p.id)];
  const aceIndex = Math.max(0, turnOrder.indexOf(aceHolder));

  return {
    type: 'bhabhi',
    mode: 'bhabhi',
    phase: 'playing',
    hands,
    discardPile: [],
    currentTrick: { leaderId: aceHolder, ledSuit: null, plays: [] },
    turnOrder,
    currentTurnIndex: aceIndex,
    gotAway: [],
    escapeOrder: [],
    escapeOrderNames: [],
    isFirstTrick: true,
    turnDeadline: Date.now() + TURN_TIMEOUT_MS,
    logs: [],
    winner: null,
    bhabhi: null,
    challengeWindowEnd: null,
    challengeCaller: null,
    revealCards: null,
    lastPlay: null,
    playerNames: Object.fromEntries(room.players.map((p) => [p.id, p.name])),
    roundScores: {},
    penalties: {},
  };
}

export function attachPlayerNames(game, room) {
  game.playerNames = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
}

function dealEvenlyStandard(deck, playerIds) {
  const hands = Object.fromEntries(playerIds.map((id) => [id, []]));
  const n = playerIds.length;
  for (let i = 0; i < deck.length; i++) {
    hands[playerIds[i % n]].push(deck[i]);
  }
  return hands;
}

function activePlayers(game) {
  return game.turnOrder.filter((id) => !game.gotAway.includes(id));
}

function playerHasCards(game, playerId) {
  return (game.hands[playerId] || []).length > 0;
}

function advanceTurnIndex(game, fromIndex) {
  const active = activePlayers(game).filter((id) => playerHasCards(game, id));
  if (active.length <= 1) return fromIndex;
  let idx = fromIndex;
  for (let i = 0; i < game.turnOrder.length; i++) {
    idx = (idx + 1) % game.turnOrder.length;
    const pid = game.turnOrder[idx];
    if (!game.gotAway.includes(pid) && playerHasCards(game, pid)) return idx;
  }
  return fromIndex;
}

function checkGotAway(game, playerId, room) {
  if (game.hands[playerId].length === 0 && !game.gotAway.includes(playerId)) {
    game.gotAway.push(playerId);
    game.escapeOrder.push(playerId);
    const name = getPlayerName(room, playerId);
    game.escapeOrderNames.push(name);
    game.logs.push({ message: `${name} got away safely!`, type: 'success' });
  }
}

function endGameIfNeeded(game, room) {
  const remaining = activePlayers(game).filter((id) => playerHasCards(game, id));
  if (remaining.length <= 1) {
    game.phase = 'ended';
    if (remaining.length === 1) {
      game.bhabhi = remaining[0];
      const bhabhiName = getPlayerName(room, game.bhabhi);
      game.logs.push({ message: `${bhabhiName} is the BHABHI (loser)!`, type: 'danger' });
      game.winner = game.escapeOrder[game.escapeOrder.length - 1] || null;
    } else if (remaining.length === 0) {
      game.winner = game.escapeOrder[game.escapeOrder.length - 1] || null;
    }
    return true;
  }
  return false;
}

function drawFromDiscardForLeader(game, leaderId) {
  if (game.gotAway.includes(leaderId)) return;
  if (playerHasCards(game, leaderId)) return;
  while (game.discardPile.length > 0 && game.hands[leaderId].length === 0) {
    const idx = Math.floor(Math.random() * game.discardPile.length);
    const card = game.discardPile.splice(idx, 1)[0];
    game.hands[leaderId].push(card);
  }
  game.hands[leaderId] = sortHand(game.hands[leaderId]);
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
  checkGotAway(game, highest.playerId, room);
  if (endGameIfNeeded(game, room)) return;

  let leaderId = highest.playerId;

  if (game.gotAway.includes(leaderId)) {
    const remaining = activePlayers(game).filter((id) => playerHasCards(game, id));
    leaderId = remaining[0] || leaderId;
  } else {
    drawFromDiscardForLeader(game, leaderId);
    if (!playerHasCards(game, leaderId) && game.discardPile.length === 0) {
      const remaining = activePlayers(game).filter((id) => playerHasCards(game, id));
      leaderId = remaining[0] || leaderId;
    }
  }

  game.currentTrick = { leaderId, ledSuit: null, plays: [] };
  game.currentTurnIndex = game.turnOrder.indexOf(leaderId);
  game.isFirstTrick = false;
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
}

function resolveThullaTrick(game, room, thullaPlayerId) {
  const { ledSuit, plays } = game.currentTrick;
  const suitPlays = plays.filter((p) => p.card.suit === ledSuit);

  let pickupPlayerId;
  let highestVal = -1;
  for (const play of suitPlays) {
    if (play.card.value > highestVal) {
      highestVal = play.card.value;
      pickupPlayerId = play.playerId;
    }
  }
  if (!pickupPlayerId) pickupPlayerId = thullaPlayerId;

  const trickCards = plays.map((p) => p.card);
  if (!game.gotAway.includes(pickupPlayerId)) {
    game.hands[pickupPlayerId].push(...trickCards);
    game.hands[pickupPlayerId] = sortHand(game.hands[pickupPlayerId]);
  } else {
    game.discardPile.push(...trickCards);
  }

  const thullaName = getPlayerName(room, thullaPlayerId);
  const pickupName = getPlayerName(room, pickupPlayerId);
  game.logs.push({
    message: `${thullaName} threw THULLA! ${pickupName} picks up ${trickCards.length} cards.`,
    type: 'thulla',
  });

  game.currentTrick = { leaderId: pickupPlayerId, ledSuit: null, plays: [] };
  game.currentTurnIndex = game.turnOrder.indexOf(pickupPlayerId);
  game.isFirstTrick = false;
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
}

function getPlayerName(room, playerId) {
  return room.players.find((p) => p.id === playerId)?.name || 'Player';
}

export function buildBhabhiStandings(game, room) {
  const placements = [];
  for (let i = 0; i < (game.escapeOrder || []).length; i++) {
    const playerId = game.escapeOrder[i];
    placements.push({
      playerId,
      name: getPlayerName(room, playerId),
      position: placements.length + 1,
      label: getPositionLabel(placements.length + 1),
      isBhabhi: false,
      score: computePositionScore(i, game.escapeOrder.length + 1),
    });
  }

  if (game.bhabhi && !placements.some((entry) => entry.playerId === game.bhabhi)) {
    placements.push({
      playerId: game.bhabhi,
      name: getPlayerName(room, game.bhabhi),
      position: placements.length + 1,
      label: getPositionLabel(placements.length + 1),
      isBhabhi: true,
      score: 0,
    });
  }

  return placements;
}

function computePositionScore(escapeIndex, totalPlayers) {
  return Math.max(1, totalPlayers - escapeIndex);
}

function getPositionLabel(position) {
  if (position === 1) return '1st';
  if (position === 2) return '2nd';
  if (position === 3) return '3rd';
  return `${position}th`;
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
  const leaderId = game.currentTrick.leaderId;

  if (game.isFirstTrick && isLead && leaderId === playerId) {
    const ace = hand.find((c) => c.id === 'A-spades');
    if (ace) return [ace.id];
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
  if (game.phase !== 'playing' && game.phase !== 'challengeWindow') {
    return { error: 'Game not in playing phase' };
  }
  if (game.phase === 'challengeWindow') {
    return { error: 'Wait for challenge resolution' };
  }
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
  game.lastPlay = { playerId, card };
  game.logs.push({
    message: `${getPlayerName(room, playerId)} played ${formatCard(card)}`,
    type: 'play',
  });

  checkGotAway(game, playerId, room);
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

export function callThullaBluff(game, room, callerId) {
  if (game.phase !== 'playing' || !game.lastPlay) return { error: 'No play to challenge' };
  if (callerId === game.lastPlay.playerId) return { error: 'Cannot challenge yourself' };

  const lastPlayer = game.lastPlay.playerId;
  const lastCard = game.lastPlay.card;
  const ledSuit = game.currentTrick.ledSuit;
  const hand = game.hands[lastPlayer] || [];

  const hadMatchingSuit = hand.some((c) => c.suit === ledSuit);
  const lied = lastCard.suit !== ledSuit && hadMatchingSuit;

  const { plays } = game.currentTrick;
  const trickCards = plays.map((p) => p.card);

  let loserId;
  if (lied) {
    loserId = lastPlayer;
  } else {
    loserId = callerId;
  }

  if (!game.gotAway.includes(loserId)) {
    game.hands[loserId].push(...trickCards);
    game.hands[loserId] = sortHand(game.hands[loserId]);
  }

  game.penalties[loserId] = (game.penalties[loserId] || 0) + 1;
  game.revealCards = [lastCard];
  game.challengeCaller = callerId;

  game.logs.push({
    message: lied
      ? `${getPlayerName(room, callerId)} called bluff on ${getPlayerName(room, lastPlayer)} — caught! Had ${ledSuit} but threw Thulla. ${getPlayerName(room, loserId)} picks up.`
      : `${getPlayerName(room, callerId)} called bluff on ${getPlayerName(room, lastPlayer)} — wrong! No ${ledSuit} available. ${getPlayerName(room, loserId)} picks up.`,
    type: 'bluff',
  });

  const leaderId = lied ? callerId : lastPlayer;
  game.currentTrick = { leaderId, ledSuit: null, plays: [] };
  game.currentTurnIndex = Math.max(0, game.turnOrder.indexOf(leaderId));
  game.isFirstTrick = false;
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  game.lastPlay = null;

  return { success: true, lied, revealCards: game.revealCards };
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
  const isMyTurn = currentPlayerId === viewerId;
  const handCounts = Object.fromEntries(room.players.map((p) => [p.id, (game.hands[p.id] || []).length]));

  const canChallenge =
    game.phase === 'playing' &&
    !!game.lastPlay &&
    game.lastPlay.playerId !== viewerId &&
    !game.gotAway.includes(viewerId);

  return {
    type: 'bhabhi',
    mode: 'bhabhi',
    phase: game.phase,
    players,
    myHand,
    legalPlays,
    playableCardIds: legalPlays,
    isMyTurn,
    currentPlayerId,
    currentTurnPlayerId: currentPlayerId,
    handCounts,
    currentTrick: game.currentTrick,
    discardCount: game.discardPile.length,
    gotAway: game.gotAway,
    escapeOrder: game.escapeOrder,
    isFirstTrick: game.isFirstTrick,
    turnDeadline: game.turnDeadline,
    turnTimeoutMs: TURN_TIMEOUT_MS,
    logs: game.logs.slice(-20),
    bhabhi: game.bhabhi,
    escapeOrderNames: (game.escapeOrder || []).map((id) => room.players.find((p) => p.id === id)?.name),
    bhabhiName: game.bhabhi ? room.players.find((p) => p.id === game.bhabhi)?.name : null,
    canChallenge,
    challengeWindowMs: CHALLENGE_WINDOW_MS,
    revealCards: game.revealCards,
    challengeCaller: game.challengeCaller,
    canShowRules: true,
    lastPlay: game.lastPlay
      ? {
          playerId: game.lastPlay.playerId,
          card: game.lastPlay.card,
        }
      : null,
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
      return legalCards.reduce((a, b) => (a.value > b.value ? a : b));
    }
    return legalCards.reduce((a, b) => (a.value < b.value ? a : b));
  }

  const hasLedSuit = hand.some((c) => c.suit === ledSuit);
  if (hasLedSuit) {
    return legalCards.reduce((a, b) => (a.value < b.value ? a : b));
  }
  return legalCards.reduce((a, b) => (a.value < b.value ? a : b));
}

export function shouldBotCallBhabhiBluff(game, viewerId) {
  if (!game.lastPlay || game.lastPlay.playerId === viewerId) return false;
  if (game.gotAway.includes(viewerId)) return false;
  const pileSize = game.currentTrick.plays.length;
  if (pileSize >= 3) return Math.random() < 0.3;
  return Math.random() < 0.08;
}

export { CHALLENGE_WINDOW_MS, TURN_TIMEOUT_MS as BHABHI_TURN_TIMEOUT_MS };
