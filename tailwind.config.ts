import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Obsidian Aurora palette
        'void': '#000000',
        'surface': '#0A0A0C',
        'elevated': '#141416',
        'lava': {
          DEFAULT: '#F56E0F',
          light: '#FF8C3A',
          dark: '#D45D0D',
        },
        'ember': '#FF6B35',
        'amber': '#FFAD42',
        'dusty': '#6B6B78',
        'mist': '#9CA3AF',
        'snow': '#F0F0F2',

        // Legacy redirects (backward compatibility)
        'black': '#000000',
        'dark-gray': '#000000',
        'gray': {
          900: '#000000',
          800: '#0A0A0C',
          700: '#141416',
          600: '#2A2A2E',
          500: '#4A4A52',
          400: '#6B6B78',
          300: '#9CA3AF',
          200: '#D1D5DB',
          100: '#F3F4F6',
        },
        'white': '#F0F0F2',
        'orange': {
          500: '#F56E0F',
          400: '#FF8C3A',
          600: '#D45D0D',
        },
        // Legacy aliases
        'dog-orange': '#F56E0F',
        'dog-gray': {
          100: '#F3F4F6',
          200: '#D1D5DB',
          300: '#9CA3AF',
          400: '#6B6B78',
          500: '#4A4A52',
          600: '#2A2A2E',
          700: '#141416',
          800: '#0A0A0C',
          900: '#000000',
        },
        'dog-blue': '#3B82F6',
        'dog-green': '#10B981',
        'dog-red': '#EF4444',
        'dog-yellow': '#F59E0B',
      },
      fontFamily: {
        'mono': ['var(--font-mono)', 'JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['var(--font-display)', 'Syne', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1.125rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
      },
      spacing: {
        '1': '0.25rem',
        '2': '0.5rem',
        '3': '0.75rem',
        '4': '1rem',
        '6': '1.5rem',
        '8': '2rem',
        '12': '3rem',
        '16': '4rem',
        '18': '4.5rem',
        '20': '5rem',
        '24': '6rem',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '24px',
        '3xl': '40px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-orange': 'linear-gradient(135deg, #F56E0F, #FF8C3A)',
        'gradient-aurora': 'linear-gradient(135deg, #F56E0F, #FFAD42, #FF8C3A)',
        'grid-pattern': 'linear-gradient(rgba(245, 110, 15, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(245, 110, 15, 0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
        'glow': '0 0 20px rgba(245, 110, 15, 0.15), 0 0 60px rgba(245, 110, 15, 0.05)',
        'glow-lg': '0 0 30px rgba(245, 110, 15, 0.25), 0 0 80px rgba(245, 110, 15, 0.1)',
        'glow-subtle': '0 0 40px rgba(245, 110, 15, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in': 'slideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 3s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(245, 110, 15, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(245, 110, 15, 0.4)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breathe: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
