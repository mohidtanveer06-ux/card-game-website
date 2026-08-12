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
    body: 'Be the FIRST player to completely empty their hand. Play cards face-down while declaring a rank — but others may call your bluff!',
  },
  {
    heading: '🃏 The Rank Cycle',
    body: 'Players must claim to play cards of the currently required rank, starting from Ace (A) and descending through K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2, then back to A.',
  },
  {
    heading: '🎴 Making a Play',
    body: 'On your turn, play 1–4 cards face-down and declare them to be of the required rank. You can be honest OR lie about the actual ranks. After you play, there is a short challenge window.',
  },
  {
    heading: '🎭 Calling a Bluff',
    body: 'Any other player can challenge the claim within the challenge window. The played cards are revealed: if the claimant was LYING (any card does not match the declared rank), THEY must pick up the ENTIRE center pile. If the claimant was honest, the CHALLENGER picks up the pile!',
  },
  {
    heading: '⏭️ Passing the Challenge',
    body: 'If nobody calls the bluff before the window ends, the play is accepted as legitimate, the cards remain in the center pile, and the turn passes to the next player with the next rank in the cycle.',
  },
  {
    heading: '🏆 Winning',
    body: 'The first player to play their last cards AND survive any resulting challenge (if called and honest, or not challenged at all) wins the game!',
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
