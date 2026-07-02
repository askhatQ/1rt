export const colors = {
  bg: '#0B0D12',
  card: '#1D2129',
  cardSelected: '#291914',
  track: '#292E37',
  orange: '#FF5A36',
  green: '#34D399',
  blue: '#5B9CFF',
  white: '#FFFFFF',
  gray: '#8B93A7',
  dimGray: '#4F5763',
} as const;

export const accentColors = [colors.orange, colors.green, colors.blue] as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

export const radii = {
  card: 16,
  cta: 28,
} as const;

export const spacing = {
  screenHorizontal: 24,
  cardGap: 12,
} as const;

export const layout = {
  cardWidth: 327,
} as const;
