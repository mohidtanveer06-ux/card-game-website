export const AVATARS = [
  { id: '0', emoji: '😎', bg: '#3498db' },
  { id: '1', emoji: '🦊', bg: '#e67e22' },
  { id: '2', emoji: '🐯', bg: '#f39c12' },
  { id: '3', emoji: '🦁', bg: '#d35400' },
  { id: '4', emoji: '🐼', bg: '#95a5a6' },
  { id: '5', emoji: '🐸', bg: '#27ae60' },
  { id: '6', emoji: '🦄', bg: '#9b59b6' },
  { id: '7', emoji: '🐙', bg: '#8e44ad' },
  { id: '8', emoji: '🦋', bg: '#1abc9c' },
  { id: '9', emoji: '🐉', bg: '#c0392b' },
  { id: '10', emoji: '🎭', bg: '#34495e' },
  { id: '11', emoji: '🤖', bg: '#7f8c8d' },
  { id: 'bot', emoji: '🤖', bg: '#566573' },
];

export function getAvatar(id) {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem('mt-cards-profile');
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { name: '', avatarId: '0' };
}

export function saveProfile(profile) {
  localStorage.setItem('mt-cards-profile', JSON.stringify(profile));
}
