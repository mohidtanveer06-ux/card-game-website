export default function Card({ card, faceDown = false, playable = false, selected = false, small = false, onClick, dealing = false }) {
  if (faceDown || !card) {
    return (
      <div
        className={`playing-card face-down ${small ? 'small' : ''} ${dealing ? 'dealing' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      />
    );
  }

  const label = `${card.rank}${card.symbol}`;
  const colorClass = card.color || (card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black');

  return (
    <div
      className={`playing-card ${colorClass} ${playable ? 'playable' : ''} ${selected ? 'selected' : ''} ${small ? 'small' : ''} ${dealing ? 'dealing' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={label}
    >
      <span className="card-corner top">{label}</span>
      <span className="card-suit-center">{card.symbol}</span>
      <span className="card-corner bottom">{label}</span>
    </div>
  );
}
