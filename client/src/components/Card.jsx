import { useState } from 'react';
import SafeImage, { FALLBACK_SVG } from './SafeImage.jsx';

export default function Card({
  card,
  faceDown = false,
  playable = false,
  selected = false,
  small = false,
  onClick,
  dealing = false,
  imageUrl = null,
}) {
  const [renderFailed, setRenderFailed] = useState(false);

  if (faceDown || !card) {
    return (
      <div
        className={`playing-card face-down ${small ? 'small' : ''} ${dealing ? 'dealing' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        aria-label={faceDown ? 'Face down card' : 'Empty card slot'}
        onError={() => setRenderFailed(true)}
      />
    );
  }

  const label = `${card.rank || '?'}${card.symbol || ''}`;
  const colorClass = card.color || (card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black');
  const useImage = imageUrl && !renderFailed;

  const handleImageError = () => {
    console.warn(`[Card] Failed to load card image for ${label}, falling back to CSS card`);
    setRenderFailed(true);
  };

  return (
    <div
      className={`playing-card ${colorClass} ${playable ? 'playable' : ''} ${selected ? 'selected' : ''} ${small ? 'small' : ''} ${dealing ? 'dealing' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={label}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {useImage ? (
        <SafeImage
          src={imageUrl}
          alt={label}
          className="card-image-overlay"
          fallbackSrc={FALLBACK_SVG}
          onError={handleImageError}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '6px',
          }}
        />
      ) : (
        <>
          <span className="card-corner top">{label}</span>
          <span className="card-suit-center" aria-hidden="true">
            {card.symbol || '♠'}
          </span>
          <span className="card-corner bottom">{label}</span>
        </>
      )}
    </div>
  );
}
