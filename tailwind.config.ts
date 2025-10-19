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
        // Primary Colors
        'black': '#000000',
        'dark-gray': '#0a0a0a',
        'gray': {
          900: '#111111',
          800: '#1a1a1a',
          700: '#2a2a2a',
          600: '#404040',
          500: '#666666',
          400: '#999999',
          300: '#cccccc',
          200: '#e5e5e5',
          100: '#f5f5f5',
        },
        'white': '#ffffff',
        'orange': {
          500: '#f7931a',
          400: '#ffa726',
          600: '#e65100',
        },
        // Legacy colors for compatibility
        'dog-orange': '#f7931a',
        'dog-gray': {
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#cccccc',
          400: '#999999',
          500: '#666666',
          600: '#404040',
          700: '#2a2a2a',
          800: '#1a1a1a',
          900: '#111111',
        },
        'dog-blue': '#3B82F6',
        'dog-green': '#10B981',
        'dog-red': '#EF4444',
        'dog-yellow': '#F59E0B',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Inter', 'system-ui', 'sans-serif'],
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
        '24': '6rem',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-orange': 'linear-gradient(135deg, #f7931a, #ffa726)',
        'grid-pattern': 'linear-gradient(rgba(247, 147, 26, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(247, 147, 26, 0.1) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '20px 20px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glow': '0 0 20px rgba(247, 147, 26, 0.3)',
        'glow-lg': '0 0 30px rgba(247, 147, 26, 0.6)',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(247, 147, 26, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(247, 147, 26, 0.6)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}

export default config