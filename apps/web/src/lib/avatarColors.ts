export interface AvatarColors {
  bg: string
  color: string
}

const AVATAR_PALETTE: AvatarColors[] = [
  { bg: '#DCE6E1', color: '#3D5A4C' }, // sage
  { bg: '#E8DFF7', color: '#6D3FC4' }, // purple
  { bg: '#FBDDE7', color: '#C22D66' }, // pink
  { bg: '#D8F3E3', color: '#1F8A4C' }, // mint
  { bg: '#FBEFC2', color: '#9A7A0A' }, // yellow
  { bg: '#FBDCD3', color: '#C2492C' }, // coral
  { bg: '#D4F3EA', color: '#0F8F76' }, // teal-mint
  { bg: '#E5DFF9', color: '#6247AA' }, // lavender
]

// Deterministic hash so the same person always gets the same avatar color,
// without storing a color per person anywhere.
export function avatarColorsFor(seed: string): AvatarColors {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

export function initialsFor(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return initials || '?'
}
