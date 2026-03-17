// Bitcoin Intelligence Design System — Typed Design Tokens

export const colors = {
  bg: {
    void: '#04060A',
    base: '#080C12',
    surface: '#0D1117',
    elevated: '#111820',
    overlay: '#161E2A',
  },
  border: {
    subtle: 'rgba(255,255,255,0.04)',
    default: 'rgba(255,255,255,0.08)',
    strong: 'rgba(255,255,255,0.14)',
    focus: 'rgba(247,147,26,0.5)',
  },
  accent: {
    primary: '#F7931A',
    primaryDim: 'rgba(247,147,26,0.15)',
    primaryGlow: 'rgba(247,147,26,0.25)',
    data: '#00D4FF',
    dataDim: 'rgba(0,212,255,0.12)',
    dataGlow: 'rgba(0,212,255,0.2)',
    positive: '#00E676',
    positiveDim: 'rgba(0,230,118,0.12)',
    negative: '#FF4560',
    negativeDim: 'rgba(255,69,96,0.12)',
  },
  text: {
    primary: '#F0F4F8',
    secondary: '#8B95A1',
    tertiary: '#4A5568',
    accent: '#F7931A',
    data: '#00D4FF',
  },
} as const

export const gradients = {
  bitcoin: 'linear-gradient(135deg, #F7931A 0%, #FFB347 100%)',
  data: 'linear-gradient(135deg, #00D4FF 0%, #0099CC 100%)',
  surface: 'linear-gradient(180deg, #0D1117 0%, #080C12 100%)',
  glowBitcoin: 'radial-gradient(ellipse at center, rgba(247,147,26,0.15) 0%, transparent 70%)',
  glowData: 'radial-gradient(ellipse at center, rgba(0,212,255,0.12) 0%, transparent 70%)',
} as const

export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.4)',
  md: '0 4px 16px rgba(0,0,0,0.5)',
  lg: '0 8px 32px rgba(0,0,0,0.6)',
  xl: '0 16px 64px rgba(0,0,0,0.7)',
  bitcoin: '0 0 40px rgba(247,147,26,0.2), 0 0 80px rgba(247,147,26,0.08)',
  data: '0 0 40px rgba(0,212,255,0.15), 0 0 80px rgba(0,212,255,0.06)',
} as const

export const typography = {
  families: {
    display: "'Syne', sans-serif",
    sans: "'DM Sans', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  sizes: {
    xs: { size: '11px', lineHeight: '1.4' },
    sm: { size: '13px', lineHeight: '1.5' },
    base: { size: '15px', lineHeight: '1.6' },
    lg: { size: '18px', lineHeight: '1.4' },
    xl: { size: '24px', lineHeight: '1.3' },
    '2xl': { size: '32px', lineHeight: '1.2' },
    hero: { size: '64px', lineHeight: '1.0', letterSpacing: '-0.02em' },
    mega: { size: '96px', lineHeight: '0.95', letterSpacing: '-0.03em' },
  },
} as const

export const spacing = [2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192] as const

export const radii = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  full: '9999px',
} as const

export const animation = {
  easing: {
    default: 'cubic-bezier(0.16, 1, 0.3, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  duration: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  },
} as const

export type ColorToken = typeof colors
export type GradientToken = typeof gradients
export type ShadowToken = typeof shadows
export type TypographyToken = typeof typography
export type RadiiToken = typeof radii
