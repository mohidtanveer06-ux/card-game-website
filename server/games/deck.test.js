import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeck } from './deck.js';

test('card values follow descending order A > K > Q > ... > 2', () => {
  const deck = createDeck();
  const getValue = (rank) => deck.find((card) => card.rank === rank && card.suit === 'spades').value;

  assert.ok(getValue('A') > getValue('K'));
  assert.ok(getValue('K') > getValue('Q'));
  assert.ok(getValue('Q') > getValue('J'));
  assert.ok(getValue('10') > getValue('2'));
});
