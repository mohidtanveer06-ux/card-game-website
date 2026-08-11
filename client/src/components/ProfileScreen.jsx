import { AVATARS } from '../utils/profile';

export default function ProfileScreen({ profile, onChange, onContinue }) {
  const valid = profile.name.trim().length >= 2 && profile.name.trim().length <= 16;

  return (
    <div className="screen-container">
      <div className="card-panel">
        <h1 className="splash-title">MT Cards Online</h1>
        <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: '1.5rem' }}>
          Premium card games with friends
        </p>

        <label htmlFor="name" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
          Your name
        </label>
        <input
          id="name"
          className="input-field"
          type="text"
          placeholder="2–16 characters"
          maxLength={16}
          value={profile.name}
          onChange={(e) => onChange({ ...profile, name: e.target.value })}
        />

        <p style={{ margin: '1.25rem 0 0.5rem', fontSize: '0.875rem' }}>Pick an avatar</p>
        <div className="avatar-grid">
          {AVATARS.filter((a) => a.id !== 'bot').map((avatar) => (
            <button
              key={avatar.id}
              type="button"
              className={`avatar-option ${profile.avatarId === avatar.id ? 'selected' : ''}`}
              style={{ background: avatar.bg }}
              onClick={() => onChange({ ...profile, avatarId: avatar.id })}
              aria-label={`Avatar ${avatar.emoji}`}
            >
              {avatar.emoji}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ width: '100%', marginTop: '1.5rem' }}
          disabled={!valid}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
