export const COLORS = {
  indigo:   '#4F46E5',
  green:    '#16A34A',
  yellow:   '#CA8A04',
  orange:   '#EA580C',
  red:      '#DC2626',
  slate300: '#CBD5E1',
} as const

export const STATE_COLORS: Record<string, string> = {
  THRIVING: COLORS.green,
  DECLINING: COLORS.yellow,
  DORMANT:  COLORS.orange,
  DEAD:     COLORS.red,
}
