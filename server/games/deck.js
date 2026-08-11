export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
export const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const RANK_VALUES = Object.fromEntries(RANKS.map((r, i) => [r, i]));

export function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
        symbol: SUIT_SYMBOLS[suit],
        color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black',
        value: RANK_VALUES[rank],
      });
    }
  }
  return deck;
}

export function shuffleDeck(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function dealEvenly(deck, playerIds) {
  const hands = Object.fromEntries(playerIds.map((id) => [id, []]));
  const n = playerIds.length;
  deck.forEach((card, i) => {
    hands[playerIds[i % n]].push(card);
  });
  return hands;
}

export function sortHand(hand) {
  const suitOrder = ['spades', 'hearts', 'diamonds', 'clubs'];
  return [...hand].sort((a, b) => {
    const suitDiff = suitOrder.indexOf(a.suit) - suitOrder.indexOf(b.suit);
    return suitDiff !== 0 ? suitDiff : b.value - a.value;
  });
}

export function formatCard(card) {
  return `${card.rank}${card.symbol}`;
}

export function cardLabel(card) {
  return `${card.rank}${card.symbol}`;
}

export function compareSameSuit(a, b) {
  return b.value - a.value;
}

export function findCard(hand, cardId) {
  return hand.find((c) => c.id === cardId);
}

export function removeCard(hand, cardId) {
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return null;
  return hand.splice(idx, 1)[0];
}

export function findAceOfSpades(hands) {
  for (const playerId of Object.keys(hands)) {
    const hand = hands[playerId];
    if (hand.some((card) => card.rank === 'A' && card.suit === 'spades')) {
      return playerId;
    }
  }
  return null;
}

export const BLUFF_RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
export const BLUFF_RANK_ORDER = Object.fromEntries(BLUFF_RANKS.map((rank, index) => [rank, index]));

export function nextBluffRank(rank) {
  const idx = BLUFF_RANKS.indexOf(rank);
  return BLUFF_RANKS[(idx + 1) % BLUFF_RANKS.length];
}
