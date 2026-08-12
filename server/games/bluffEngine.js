import { createDeck, shuffleDeck, sortHand, BLUFF_RANKS, BLUFF_RANK_ORDER } from './deck.js';

const TURN_TIMEOUT_MS = 15000;
const REVEAL_DURATION_MS = 1500;

function dealEvenlyWithRemainder(deck, playerIds) {
  const n = playerIds.length;
  const perPlayer = Math.floor(deck.length / n);
  const remainderCount = deck.length - perPlayer * n;
  const hands = Object.fromEntries(playerIds.map((id) => [id, []]));
  for (let p = 0; p < n; p++) {
    const start = p * perPlayer;
    for (let i = 0; i < perPlayer; i++) {
      hands[playerIds[p]].push(deck[start + i]);
    }
  }
  const remainder = deck.slice(deck.length - remainderCount);
  return { hands, remainder };
}

function getPlayerName(room, playerId) {
  return room.players.find((p) => p.id === playerId)?.name || 'Player';
}

export function createBluffGame(room, playerIds = room.players.map((p) => p.id)) {
  const deck = shuffleDeck(createDeck());
  const { hands, remainder } = dealEvenlyWithRemainder(deck, playerIds);
  for (const id of playerIds) {
    hands[id] = sortHand(hands[id]);
  }

  const turnOrder = room.players.map((p) => p.id);

  return {
    type: 'bluff',
    mode: 'bluff',
    phase: 'playing',
    hands,
    centerPile: [...remainder],
    totalCleared: 0,
    turnOrder,
    currentTurnIndex: 0,
    currentDeclaredRank: null,
    lastPlay: null,
    consecutiveSkips: 0,
    challengeCaller: null,
    revealCards: null,
    revealEndsAt: null,
    revealNextState: null,
    turnDeadline: Date.now() + TURN_TIMEOUT_MS,
    logs: [],
    penalties: {},
    playerNames: Object.fromEntries(room.players.map((p) => [p.id, p.name])),
    finishedOrder: [],
    finishedNames: [],
    loser: null,
    standings: null,
    winner: null,
    lastChallengeResult: null,
  };
}

export function attachPlayerNames(game, room) {
  game.playerNames = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
}

export function getCurrentPlayerId(game) {
  return game.turnOrder[game.currentTurnIndex];
}

export const bluffCurrentPlayer = getCurrentPlayerId;

function activePlayers(game) {
  return game.turnOrder.filter((id) => !game.finishedOrder.includes(id));
}

function activePlayersWithCards(game) {
  return activePlayers(game).filter((id) => (game.hands[id]?.length || 0) > 0);
}

export function buildBluffStandings(game, room) {
  const placements = [];
  for (let i = 0; i < (game.finishedOrder || []).length; i++) {
    const playerId = game.finishedOrder[i];
    placements.push({
      playerId,
      name: getPlayerName(room, playerId),
      position: placements.length + 1,
      label: getPositionLabel(placements.length + 1),
      isLoser: false,
      score: computePositionScore(i, (game.finishedOrder?.length || 0) + 1),
    });
  }
  if (game.loser && !placements.some((p) => p.playerId === game.loser)) {
    placements.push({
      playerId: game.loser,
      name: getPlayerName(room, game.loser),
      position: placements.length + 1,
      label: getPositionLabel(placements.length + 1),
      isLoser: true,
      score: 0,
    });
  }
  return placements;
}

function computePositionScore(finishIndex, totalPlayers) {
  return Math.max(1, totalPlayers - finishIndex);
}

function getPositionLabel(position) {
  if (position === 1) return '1st';
  if (position === 2) return '2nd';
  if (position === 3) return '3rd';
  return `${position}th`;
}

function advanceTurnIndex(game, fromIndex) {
  const active = activePlayers(game).filter((id) => (game.hands[id]?.length || 0) > 0);
  if (active.length <= 1) return fromIndex;
  let idx = fromIndex;
  for (let i = 0; i < game.turnOrder.length; i++) {
    idx = (idx + 1) % game.turnOrder.length;
    const pid = game.turnOrder[idx];
    if (!game.finishedOrder.includes(pid) && (game.hands[pid]?.length || 0) > 0) {
      return idx;
    }
  }
  return fromIndex;
}

function findNextActiveIndex(game, startIndex) {
  let idx = startIndex;
  for (let i = 0; i < game.turnOrder.length; i++) {
    idx = (idx + 1) % game.turnOrder.length;
    const pid = game.turnOrder[idx];
    if (!game.finishedOrder.includes(pid) && (game.hands[pid]?.length || 0) > 0) {
      return idx;
    }
  }
  return startIndex;
}

function checkFinished(game, room) {
  const active = activePlayers(game);
  for (const pid of active) {
    if ((game.hands[pid]?.length || 0) === 0 && !game.finishedOrder.includes(pid)) {
      game.finishedOrder.push(pid);
      game.finishedNames.push(getPlayerName(room, pid));
      game.logs.push({
        message: `${getPlayerName(room, pid)} finished ${getPositionLabel(game.finishedOrder.length)}!`,
        type: 'success',
      });
    }
  }
  const remaining = activePlayersWithCards(game);
  if (remaining.length <= 1) {
    game.phase = 'ended';
    if (remaining.length === 1) {
      game.loser = remaining[0];
      game.logs.push({
        message: `${getPlayerName(room, game.loser)} is the LOSER!`,
        type: 'danger',
      });
    }
    game.winner = game.finishedOrder[0] || null;
    game.standings = buildBluffStandings(game, room);
    return true;
  }
  return false;
}

export function skipBluffTurn(game, room) {
  if (game.phase !== 'playing') return { error: 'Not in playing phase' };
  const playerId = getCurrentPlayerId(game);
  let pileCleared = false;

  if (game.currentDeclaredRank && game.lastPlay) {
    game.consecutiveSkips++;
    game.logs.push({
      message: `${getPlayerName(room, playerId)} skips.`,
      type: 'info',
    });

    const totalActive = activePlayersWithCards(game).length;
    if (totalActive > 0 && game.consecutiveSkips >= totalActive && game.centerPile.length > 0) {
      const clearedCount = game.centerPile.length;
      game.totalCleared = (game.totalCleared || 0) + clearedCount;
      game.centerPile = [];
      game.currentDeclaredRank = null;
      const originalPlayerId = game.lastPlay?.playerId || playerId;
      game.lastPlay = null;
      const originalIndex = game.turnOrder.indexOf(originalPlayerId);
      game.currentTurnIndex = findNextActiveIndex(game, originalIndex);
      game.consecutiveSkips = 0;
      game.logs.push({
        message: `All players skipped! ${clearedCount} card(s) permanently cleared from the pile. New round.`,
        type: 'bluff',
      });
      pileCleared = true;
      game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
      if (checkFinished(game, room)) return { success: true, pileCleared, ended: true };
      return { success: true, pileCleared };
    }

    game.currentTurnIndex = advanceTurnIndex(game, game.currentTurnIndex);
  } else {
    game.logs.push({
      message: `${getPlayerName(room, playerId)} skips (fresh round).`,
      type: 'info',
    });
    game.currentTurnIndex = advanceTurnIndex(game, game.currentTurnIndex);
  }

  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  game.lastChallengeResult = null;

  if (checkFinished(game, room)) return { success: true, pileCleared, ended: true };
  return { success: true, pileCleared };
}

export function playBluffDeclareRank(game, room, playerId, cardIds, declaredRank) {
  if (game.phase !== 'playing') return { error: 'Not in playing phase' };
  if (getCurrentPlayerId(game) !== playerId) return { error: 'Not your turn' };
  if (!BLUFF_RANKS.includes(declaredRank)) return { error: `Invalid rank: ${declaredRank}` };
  if (!cardIds || cardIds.length < 1 || cardIds.length > 4) return { error: 'Play 1 to 4 cards' };

  const hand = game.hands[playerId];
  const cards = [];
  for (const id of cardIds) {
    const idx = hand.findIndex((c) => c.id === id);
    if (idx === -1) return { error: 'Invalid card' };
    cards.push(hand.splice(idx, 1)[0]);
  }

  game.centerPile.push(...cards);
  game.currentDeclaredRank = declaredRank;
  game.lastPlay = {
    playerId,
    declaredRank,
    count: cards.length,
    cardIds: cards.map((c) => c.id),
    cards,
    playedAt: Date.now(),
  };
  game.consecutiveSkips = 0;
  game.lastChallengeResult = null;

  game.logs.push({
    message: `${getPlayerName(room, playerId)} plays ${cards.length} card(s) and declares ${declaredRank}`,
    type: 'info',
  });

  if (checkFinished(game, room)) {
    game.currentTurnIndex = advanceTurnIndex(game, game.currentTurnIndex);
    return { success: true, ended: true };
  }

  game.currentTurnIndex = advanceTurnIndex(game, game.currentTurnIndex);
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  if (checkFinished(game, room)) return { success: true, ended: true };
  return { success: true };
}

export function playBluffMatching(game, room, playerId, cardIds) {
  if (game.phase !== 'playing') return { error: 'Not in playing phase' };
  if (getCurrentPlayerId(game) !== playerId) return { error: 'Not your turn' };
  if (!game.currentDeclaredRank || !game.lastPlay) return { error: 'No active rank declared; you must declare a rank with your play.' };
  if (!cardIds || cardIds.length < 1 || cardIds.length > 4) return { error: 'Play 1 to 4 cards' };

  const declaredRank = game.currentDeclaredRank;
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
    playedAt: Date.now(),
  };
  game.consecutiveSkips = 0;
  game.lastChallengeResult = null;

  game.logs.push({
    message: `${getPlayerName(room, playerId)} adds ${cards.length} card(s) as ${declaredRank}`,
    type: 'info',
  });

  if (checkFinished(game, room)) {
    game.currentTurnIndex = advanceTurnIndex(game, game.currentTurnIndex);
    return { success: true, ended: true };
  }

  game.currentTurnIndex = advanceTurnIndex(game, game.currentTurnIndex);
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  if (checkFinished(game, room)) return { success: true, ended: true };
  return { success: true };
}

export function callBluff(game, room, callerId) {
  if (game.phase !== 'playing') return { error: 'Cannot call bluff now' };
  if (!game.lastPlay) return { error: 'No play to challenge' };
  if (callerId === game.lastPlay.playerId) return { error: 'Cannot challenge yourself' };
  if (!game.currentDeclaredRank) return { error: 'Nothing declared to challenge' };
  if (game.finishedOrder.includes(callerId)) return { error: 'Already finished, cannot challenge' };

  const { playerId, declaredRank, cards, count } = game.lastPlay;
  const lied = cards.some((c) => c.rank !== declaredRank);
  const loserId = lied ? playerId : callerId;
  const winnerId = lied ? callerId : playerId;
  const pileSize = game.centerPile.length;

  if (!game.finishedOrder.includes(loserId)) {
    game.hands[loserId].push(...game.centerPile);
    game.hands[loserId] = sortHand(game.hands[loserId]);
  }
  game.centerPile = [];

  game.revealCards = cards;
  game.phase = 'reveal';
  game.challengeCaller = callerId;
  game.revealEndsAt = Date.now() + REVEAL_DURATION_MS;
  game.penalties = game.penalties || {};
  game.penalties[loserId] = (game.penalties[loserId] || 0) + 1;

  game.lastChallengeResult = {
    lied,
    playerId,
    callerId,
    winnerId,
    loserId,
    declaredRank,
    pileSize,
    claimedCount: count,
  };

  game.consecutiveSkips = 0;
  game.currentDeclaredRank = null;
  game.lastPlay = null;

  const nextIndex = (game.turnOrder.indexOf(winnerId) + 1) % game.turnOrder.length;
  let turnIdx = game.turnOrder.indexOf(winnerId);
  for (let i = 0; i < game.turnOrder.length; i++) {
    const pid = game.turnOrder[turnIdx];
    if (!game.finishedOrder.includes(pid) && (game.hands[pid]?.length || 0) > 0) {
      break;
    }
    turnIdx = (turnIdx + 1) % game.turnOrder.length;
  }

  game.logs.push({
    message: lied
      ? `${getPlayerName(room, callerId)} called BLUFF on ${getPlayerName(room, playerId)} — CAUGHT LYING! ${getPlayerName(room, loserId)} picks up ALL ${pileSize} cards. New round.`
      : `${getPlayerName(room, callerId)} called BLUFF on ${getPlayerName(room, playerId)} — WRONG! ${getPlayerName(room, loserId)} picks up ALL ${pileSize} cards. New round.`,
    type: 'bluff',
  });

  game.revealNextState = {
    currentTurnIndex: turnIdx,
  };

  return { success: true, lied, revealCards: cards, pileSize };
}

export function finishReveal(game) {
  if (game.phase !== 'reveal') return { error: 'Not in reveal phase' };
  if (game.revealNextState) {
    game.currentTurnIndex = game.revealNextState.currentTurnIndex;
  }
  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;
  game.challengeCaller = null;
  game.revealCards = null;
  game.revealEndsAt = null;
  game.revealNextState = null;
  game.phase = 'playing';
  if (checkFinished(game, { players: Object.entries(game.playerNames || {}).map(([id, name]) => ({ id, name })) })) {
    return { success: true, ended: true };
  }
  return { success: true };
}

export function autoPlayBluff(game, room, playerId) {
  const hand = game.hands[playerId] || [];
  if (hand.length === 0) return { error: 'No cards' };

  if (!game.currentDeclaredRank) {
    const matching = hand.slice(0, Math.min(hand.length, Math.floor(Math.random() * 3) + 1));
    const rank = matching[0].rank;
    return playBluffDeclareRank(game, room, playerId, matching.map((c) => c.id), rank);
  }

  if (Math.random() < 0.25) {
    return skipBluffTurn(game, room);
  }

  const requiredRank = game.currentDeclaredRank;
  const matching = hand.filter((c) => c.rank === requiredRank);
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

  return playBluffMatching(game, room, playerId, cardIds);
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

  const currentPlayerId = getCurrentPlayerId(game);
  const isMyTurn = currentPlayerId === viewerId;
  const handCounts = Object.fromEntries(room.players.map((p) => [p.id, (game.hands[p.id] || []).length]));

  const canCallBluff =
    game.phase === 'playing' &&
    !!game.lastPlay &&
    game.lastPlay.playerId !== viewerId &&
    !!game.currentDeclaredRank &&
    (game.hands[viewerId]?.length || 0) > 0 &&
    !game.finishedOrder.includes(viewerId);

  const canDeclareRank =
    game.phase === 'playing' &&
    isMyTurn &&
    game.currentDeclaredRank === null &&
    (game.hands[viewerId]?.length || 0) > 0;

  const canPlayMatching =
    game.phase === 'playing' &&
    isMyTurn &&
    !!game.currentDeclaredRank &&
    !!game.lastPlay &&
    (game.hands[viewerId]?.length || 0) > 0;

  const canSkip =
    game.phase === 'playing' &&
    isMyTurn &&
    (game.hands[viewerId]?.length || 0) > 0;

  return {
    type: 'bluff',
    mode: 'bluff',
    phase: game.phase,
    players,
    myHand: game.hands[viewerId] || [],
    currentPlayerId,
    currentTurnPlayerId: currentPlayerId,
    isMyTurn,
    handCounts,
    currentDeclaredRank: game.currentDeclaredRank,
    centerPileCount: game.centerPile.length,
    totalCleared: game.totalCleared || 0,
    lastPlay: game.lastPlay
      ? {
          playerId: game.lastPlay.playerId,
          declaredRank: game.lastPlay.declaredRank,
          count: game.lastPlay.count,
          playedAt: game.lastPlay.playedAt,
        }
      : null,
    consecutiveSkips: game.consecutiveSkips || 0,
    revealCards: game.revealCards,
    revealEndsAt: game.revealEndsAt,
    turnDeadline: game.phase === 'reveal' ? game.revealEndsAt : game.turnDeadline,
    turnTimeoutMs: game.phase === 'reveal' ? REVEAL_DURATION_MS : TURN_TIMEOUT_MS,
    logs: game.logs.slice(-20),
    winner: game.winner,
    winnerName: game.winner ? room.players.find((p) => p.id === game.winner)?.name : null,
    loser: game.loser,
    loserName: game.loser ? room.players.find((p) => p.id === game.loser)?.name : null,
    finishedOrder: game.finishedOrder || [],
    finishedNames: game.finishedNames || [],
    standings: game.standings,
    rankOrder: BLUFF_RANK_ORDER,
    availableRanks: BLUFF_RANKS,
    canCallBluff,
    canDeclareRank,
    canPlayMatching,
    canSkip,
    challengeCaller: game.challengeCaller,
    canShowRules: true,
    lastChallengeResult: game.lastChallengeResult
      ? {
          lied: game.lastChallengeResult.lied,
          playerId: game.lastChallengeResult.playerId,
          callerId: game.lastChallengeResult.callerId,
          winnerId: game.lastChallengeResult.winnerId,
          loserId: game.lastChallengeResult.loserId,
          declaredRank: game.lastChallengeResult.declaredRank,
          pileSize: game.lastChallengeResult.pileSize,
          claimedCount: game.lastChallengeResult.claimedCount,
        }
      : null,
  };
}

export function getBluffBotPlay(game, playerId) {
  const hand = game.hands[playerId] || [];
  if (hand.length === 0) return null;

  if (!game.currentDeclaredRank) {
    const pick = hand.slice(0, Math.min(hand.length, Math.floor(Math.random() * 3) + 1));
    return {
      action: 'declare',
      cardIds: pick.map((c) => c.id),
      declaredRank: pick[0].rank,
    };
  }

  if (Math.random() < 0.22) {
    return { action: 'skip' };
  }

  const requiredRank = game.currentDeclaredRank;
  const matching = hand.filter((c) => c.rank === requiredRank);
  const count = Math.min(Math.floor(Math.random() * 4) + 1, hand.length);

  if (matching.length > 0 && Math.random() < 0.65) {
    const ids = matching.slice(0, Math.min(count, matching.length)).map((c) => c.id);
    while (ids.length < count && hand.length > ids.length) {
      const extra = hand.find((c) => !ids.includes(c.id));
      if (extra) ids.push(extra.id);
    }
    return { action: 'match', cardIds: ids };
  }

  return {
    action: 'match',
    cardIds: hand.slice(0, count).map((c) => c.id),
  };
}

export function shouldBotCallBluff(game) {
  if (game.phase !== 'playing' || !game.lastPlay) return false;
  const pileSize = game.centerPile.length;
  if (pileSize > 8) return Math.random() < 0.5;
  return Math.random() < 0.12;
}

export { TURN_TIMEOUT_MS as BLUFF_TURN_TIMEOUT_MS, REVEAL_DURATION_MS };
