import { createDeck, shuffleDeck } from './server/games/deck.js';
import {
  createBhabhiGame,
  attachPlayerNames as attachBhabhiNames,
  buildBhabhiStandings,
  getLegalPlays,
  playBhabhiCard,
  callThullaBluff,
  chooseBhabhiBotMove,
  getCurrentPlayerId as bhabhiCurrentPid,
} from './server/games/bhabhiEngine.js';
import {
  createBluffGame,
  attachPlayerNames as attachBluffNames,
  playBluffCards,
  callBluff,
  passBluff,
  finishReveal,
  chooseBluffBotPlay,
  getCurrentPlayerId as bluffCurrentPid,
} from './server/games/bluffEngine.js';

function mockRoom(playerCount, prefix = 'p') {
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `${prefix}${i}`, name: `Player_${prefix}_${i}` });
  }
  return { players, playerIds: players.map((p) => p.id), hostId: players[0].id, bots: players.slice(1).map((p) => p.id) };
}

function runOneBhabhi(playerCount, allowChallenges = true) {
  const room = mockRoom(playerCount, 'bh');
  const game = createBhabhiGame(room);
  attachBhabhiNames(game, room);

  let turns = 0;
  const maxTurns = 2000;

  while (!game.winner && turns < maxTurns) {
    turns++;
    const pid = bhabhiCurrentPid(game);
    if (!pid) {
      break;
    }
    if (game.gotAway.includes(pid) || !(game.hands[pid]?.length > 0)) {
      game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
      continue;
    }

    if (allowChallenges && game.phase === 'playing' && game.lastPlay && Math.random() < 0.06 && turns % 3 === 0) {
      const challengers = room.playerIds.filter(
        (p) => !game.gotAway.includes(p) && p !== game.lastPlay?.playerId && game.hands[p]?.length > 0
      );
      if (challengers.length > 0) {
        const caller = challengers[Math.floor(Math.random() * challengers.length)];
        callThullaBluff(game, room, caller);
        continue;
      }
    }

    const move = chooseBhabhiBotMove(game, pid);
    const cardId = move?.id || move;
    if (!cardId) {
      game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
      continue;
    }

    const legal = getLegalPlays(game, pid);
    if (!legal.includes(cardId)) {
      throw new Error(`Illegal move: ${cardId} not in [${legal.join(',')}] for ${pid} at turn ${turns} phase=${game.phase}`);
    }

    const res = playBhabhiCard(game, room, pid, cardId);
    if (res?.error) {
      game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
    }
  }

  if (!game.winner) throw new Error(`Bhabhi ${playerCount}p failed to finish in ${maxTurns} turns. Hands: ${JSON.stringify(Object.fromEntries(Object.entries(game.hands).map(([k, v]) => [k, v.length])))}`);
  const standings = buildBhabhiStandings(game, room);
  if (standings.length !== playerCount) throw new Error(`Bhabhi standings mismatch: got ${standings.length} want ${playerCount}`);
  const bhabhiCount = standings.filter((s) => s.isBhabhi).length;
  if (bhabhiCount !== 1) throw new Error(`Bhabhi count should be exactly 1: got ${bhabhiCount}`);
  return { turns, standings };
}

function runOneBluff(playerCount, allowChallenges = true) {
  const room = mockRoom(playerCount, 'bf');
  const game = createBluffGame(room);
  attachBluffNames(game, room);

  let turns = 0;
  const maxTurns = 5000;
  let challenges = 0;

  while (!game.winner && turns < maxTurns) {
    turns++;

    if (game.phase === 'reveal') {
      finishReveal(game);
      continue;
    }

    if (game.phase === 'challengeWindow') {
      if (allowChallenges && game.canChallenge && Math.random() < 0.28) {
        const challengers = room.playerIds.filter(
          (p) => game.hands[p] && game.hands[p].length > 0 && p !== game.lastPlay?.playerId
        );
        if (challengers.length > 0) {
          const caller = challengers[Math.floor(Math.random() * challengers.length)];
          callBluff(game, room, caller);
          challenges++;
          continue;
        }
      }
      passBluff(game);
      continue;
    }

    if (game.phase === 'playing') {
      const pid = bluffCurrentPid(game);
      if (!pid || !game.hands[pid] || game.hands[pid].length === 0) {
        game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
        continue;
      }
      const move = chooseBluffBotPlay(game, pid);
      if (!move || !move.cardIds || move.cardIds.length === 0) {
        game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
        continue;
      }
      const res = playBluffCards(game, room, pid, move.cardIds, move.declaredRank);
      if (res?.error) {
        game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
      }
      continue;
    }

    game.currentTurnIndex = (game.currentTurnIndex + 1) % game.turnOrder.length;
  }

  if (!game.winner) throw new Error(`Bluff ${playerCount}p failed to finish in ${maxTurns} turns (challenges=${challenges})`);
  return { turns, challenges };
}

const TOTAL_SESSIONS = 60;
const B_COUNTS = [2, 3, 4, 5, 6, 7, 8];
const BF_COUNTS = [2, 3, 4, 5, 6];
const results = [];
const START = Date.now();

let failures = 0;
for (let i = 0; i < TOTAL_SESSIONS; i++) {
  const isBhabhi = i % 2 === 0;
  const counts = isBhabhi ? B_COUNTS : BF_COUNTS;
  const count = counts[i % counts.length];
  const allowChallenges = i % 4 !== 0;
  try {
    if (isBhabhi) {
      const r = runOneBhabhi(count, allowChallenges);
      results.push({ game: 'Bhabhi', count, turns: r.turns, status: 'ok', standings: r.standings.length, ch: allowChallenges ? 'on' : 'off' });
    } else {
      const r = runOneBluff(count, allowChallenges);
      results.push({ game: 'Bluff', count, turns: r.turns, status: 'ok', challenges: r.challenges, ch: allowChallenges ? 'on' : 'off' });
    }
  } catch (e) {
    failures++;
    results.push({ game: isBhabhi ? 'Bhabhi' : 'Bluff', count, status: 'fail', error: e.message });
    console.error('FAIL:', { game: isBhabhi ? 'Bhabhi' : 'Bluff', count }, e.message);
    if (failures > 5) break;
  }
}

const durMs = Date.now() - START;
console.log('\n========== SIMULATION RESULTS ==========');
console.log(`Total sessions: ${TOTAL_SESSIONS}  |  OK: ${results.filter((r) => r.status === 'ok').length}  |  Fail: ${failures}  |  Duration: ${durMs}ms`);
console.log('Per-game breakdown:');
for (const g of ['Bhabhi', 'Bluff']) {
  const sub = results.filter((r) => r.game === g);
  const ok = sub.filter((r) => r.status === 'ok');
  const avgTurns = Math.round(ok.reduce((s, r) => s + (r.turns || 0), 0) / Math.max(1, ok.length));
  const counts = [...new Set(sub.map((r) => r.count))].sort((a, b) => a - b);
  const totalCh = ok.reduce((s, r) => s + (r.challenges || 0), 0);
  console.log(`  ${g}: ${sub.length} runs (avg ${avgTurns} turns, ${totalCh} total challenges), player counts: ${counts.join(', ')}`);
}
console.log('========================================\n');

if (failures > 0) process.exit(1);
