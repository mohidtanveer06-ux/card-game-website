import { useEffect, useState } from 'react';

const BHABHI_RULES = [
  {
    heading: '🎯 Objective',
    body: 'Be among the first players to get rid of all your cards ("got away"). The LAST player remaining with cards is the BHABHI (loser)!',
  },
  {
    heading: '🃏 Setup & First Trick',
    body: 'A standard 52-card deck is dealt evenly to all players. Whoever holds the Ace of Spades starts the first trick and MUST play the Ace of Spades as the lead card.',
  },
  {
    heading: '🎴 Valid Card Play',
    body: 'The leader plays any card to start a trick. All other players MUST follow the led suit if they have it. If you cannot follow suit, you may play any card (this is called throwing "Thulla").',
  },
  {
    heading: '🏆 Trick Resolution (Clean)',
    body: 'If everyone followed suit, the player who played the HIGHEST card of the led suit wins the trick. Cards go to the discard pile. The winner leads the next trick.',
  },
  {
    heading: '💥 Thulla (Breaking Suit)',
    body: 'If any player throws a card of a different suit (Thulla), the trick is resolved immediately. The player who played the HIGHEST card of the original led suit must PICK UP ALL cards from the trick into their hand, and they lead the next round.',
  },
  {
    heading: '🎭 Bluff Challenge (Thulla Bluff)',
    body: 'You can challenge any player who just played a card! If you suspect they threw Thulla but actually had the led suit in their hand, call the bluff. If caught lying, THEY pick up the trick. If you were wrong, YOU pick up the trick!',
  },
  {
    heading: '🏃 Got Away!',
    body: 'When you play your last card, you "got away" safely and are out of the game. Got-away players are skipped in turn order and cannot pick up cards or be challenged.',
  },
  {
    heading: '👑 End of Game',
    body: 'When only one player remains with cards, they are declared the BHABHI! Earlier escapees get better rankings (1st place = first person to empty their hand).',
  },
];

const BLUFF_RULES = [
  {
    heading: '🎯 Objective',
    body: 'Be the FIRST player to completely empty your hand to earn the highest ranking. The LAST player still holding any cards at the end is officially declared the LOSER!',
  },
  {
    heading: '🃏 Initial Setup & Dealing',
    body: 'A standard 52-card deck (13 ranks: 2 through Ace, 4 suits each) is shuffled and dealt evenly among all active players. Any remainder cards from an uneven deal are placed face-down in the central discard pile at the start to ensure fairness.',
  },
  {
    heading: '1️⃣ Starting a Fresh Round (Declaring a Rank)',
    body: 'When a new round begins (no rank is currently active), the active player has two options: (A) SKIP — immediately pass turn to the next player without adding cards, or (B) PLAY & DECLARE — play 1–4 cards face-down into the center pile and publicly DECLARE any single card rank of their choice (e.g. "3 Kings"). This sets the active declared rank for the current discard cycle.',
  },
  {
    heading: '2️⃣ Subsequent Turns After a Rank is Declared',
    body: 'Once a rank has been declared, every subsequent player (in turn order) has up to three valid actions: (A) SKIP — pass without modifying the pile, current declared rank stays active, (B) PLAY MATCHING CARDS — add 1–4 face-down cards to the pile, still claiming them to be the CURRENT active declared rank (you cannot change the rank), or (C) CALL BLUFF — challenge the most recent player who played cards into the pile.',
  },
  {
    heading: '🎭 Bluff Challenge Resolution',
    body: 'When Call Bluff is triggered, the MOST RECENT set of cards added is revealed to all players. The cards are verified against the declared rank of that play: (A) BLUFF CAUGHT (lied) — if ANY card does not match the declared rank, the player who played the false claim MUST collect ALL cards currently in the center pile into their hand. (B) FALSE CHALLENGE (honest play) — if ALL cards match the declared rank, the player who incorrectly called the bluff MUST collect ALL cards currently in the center pile into their hand. In both cases, the pile is emptied and the WINNER of the challenge (the honest side) gets the next turn to start a fresh round and declare a new rank.',
  },
  {
    heading: '🧹 "All Skip" Pile Clearing Rule',
    body: 'After a player plays cards and declares a rank, consecutive skip actions from all subsequent players are tracked. If EVERY player who follows in turn order skips, and the turn returns to the ORIGINAL player who placed the last cards AND that original player ALSO skips their consecutive turn — the ENTIRE center pile is PERMANENTLY cleared and removed from play. The turn then immediately passes to the player AFTER the original card-playing player, who can now declare a new rank and start a fresh cycle.',
  },
  {
    heading: '🏆 Rankings: Finishing Order + Loser',
    body: 'As soon as a player empties their entire hand, they are officially removed from active turn order and assigned a permanent rank: 1st Place (first to empty), 2nd Place, 3rd Place, and so on, in the order they finished. The game terminates when ONLY ONE player remains holding cards — that final player is declared the official LOSER.',
  },
  {
    heading: '✅ Important Rule Reminders',
    body: 'You can only call bluff on the player who made the most recent play (not on older plays). During a declared-rank cycle you cannot change the declared rank; you must play matching cards, skip, or challenge. Remainder cards at the start always go to the center pile — they are never dealt to any player and count toward the pile if a challenge is resolved on that first cycle.',
  },
];

export default function RuleModal({ initialMode = 'bhabhi' }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('openRules', onOpen);
    return () => window.removeEventListener('openRules', onOpen);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && open) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const rules = mode === 'bhabhi' ? BHABHI_RULES : BLUFF_RULES;
  const title = mode === 'bhabhi' ? 'Bhabhi Thulla Rules' : 'Bluff Rules';

  return (
    <div className="end-modal-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-labelledby="rules-title">
      <div
        className="end-modal rules-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, textAlign: 'left', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 id="rules-title" style={{ margin: 0, color: '#c9a227' }}>{title}</h2>
          <button
            type="button"
            className="btn-secondary"
            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
            onClick={() => setOpen(false)}
            aria-label="Close rules"
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            className={mode === 'bhabhi' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '0.5rem' }}
            onClick={() => setMode('bhabhi')}
          >
            Bhabhi Thulla
          </button>
          <button
            type="button"
            className={mode === 'bluff' ? 'btn-primary' : 'btn-secondary'}
            style={{ flex: 1, padding: '0.5rem' }}
            onClick={() => setMode('bluff')}
          >
            Bluff
          </button>
        </div>

        <div style={{ overflowY: 'auto', paddingRight: '0.25rem' }}>
          {rules.map((rule, i) => (
            <div key={i} style={{ marginBottom: '1rem' }}>
              <h3 style={{ margin: '0 0 0.35rem', color: '#f5f0e1', fontSize: '1rem' }}>{rule.heading}</h3>
              <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.85, lineHeight: 1.55 }}>{rule.body}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.25rem' }}>
          <button type="button" className="btn-primary" onClick={() => setOpen(false)}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}

export function RulesButton({ onClick, style }) {
  return (
    <button
      type="button"
      className="btn-secondary"
      style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', ...style }}
      onClick={onClick}
    >
      📖 Rules
    </button>
  );
}
