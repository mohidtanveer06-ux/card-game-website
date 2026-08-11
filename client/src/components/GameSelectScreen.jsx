const MODES = [
  {
    id: 'bhabhi',
    title: 'Bhabhi Thulla',
    description:
      'Get rid of all your cards. Last player holding cards is the Bhabhi (loser). Follow suit or throw Thulla!',
  },
  {
    id: 'bluff',
    title: 'Bluff',
    description:
      'Play 1–4 cards face-down declaring a rank. Others can call your bluff. First to empty their hand wins.',
  },
];

export default function GameSelectScreen({ selected, onSelect, onContinue, onBack }) {
  return (
    <div className="screen-container">
      <div className="card-panel" style={{ maxWidth: '520px' }}>
        <h2 style={{ textAlign: 'center', color: '#c9a227', marginTop: 0 }}>Choose Game</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', margin: '1.5rem 0' }}>
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={`mode-card ${selected === mode.id ? 'selected' : ''}`}
              onClick={() => onSelect(mode.id)}
            >
              <h3>{mode.title}</h3>
              <p>{mode.description}</p>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={!selected}
            onClick={onContinue}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
