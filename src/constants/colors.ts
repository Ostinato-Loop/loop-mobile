export const Colors = {
  background:   '#0A1F16',
  foreground:   '#ECFDF5',
  surface:      '#0D2419',
  surfaceElev:  '#112E1E',
  primary:      '#00FF88',
  primaryFg:    '#041A0D',
  accent:       '#FF7A00',
  accentFg:     '#041A0D',
  muted:        '#0F2C1C',
  mutedFg:      '#5A9E76',
  border:       '#163828',
  input:        '#122B1F',
  destructive:  '#FF2E2E',
  live:         '#FF2E2E',
  orange:       '#FF7A00',
  neonGlow:     '#4DFFA8',
  transparent:  'transparent',
  black:        '#000000',
  white:        '#FFFFFF',
} as const;

export const AvatarGradients = [
  ['#10b981', '#14b8a6'],
  ['#d946ef', '#a855f7'],
  ['#f59e0b', '#f97316'],
  ['#0ea5e9', '#3b82f6'],
  ['#f43f5e', '#ec4899'],
  ['#00FF88', '#00D96F'],
] as const;

export function avatarGradient(uid: string): readonly [string, string] {
  let n = 0;
  for (let i = 0; i < uid.length; i++) n += uid.charCodeAt(i);
  return AvatarGradients[n % AvatarGradients.length];
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
