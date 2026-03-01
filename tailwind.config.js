/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'apc-blue': '#34418F',
        'apc-gold': '#DEAC4B',
        'apc-bg': '#FAFAF9',
        'mica-navy': {
          DEFAULT: 'rgba(15, 23, 42, 0.25)',
          input: 'rgba(15, 23, 42, 0.2)',
          opaque: 'rgba(15, 23, 42, 0.85)',
          card: 'rgba(15, 23, 42, 0.6)',
          row: 'rgba(15, 23, 42, 0.15)',
          'row-hover': 'rgba(15, 23, 42, 0.25)',
          header: 'rgba(15, 23, 42, 0.9)',
          panel: 'rgba(15, 23, 42, 0.92)',
          modal: 'rgba(15, 23, 42, 0.95)',
        },
        'eypi-gold': {
          DEFAULT: '#DEAC4B',
          dark: '#c9a84c',
          hover: '#d4b55a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'dot-grid':
          'radial-gradient(circle, #34418F 0.5px, transparent 0.5px)',
      },
      backgroundSize: {
        'dot-grid': '24px 24px',
      },
      backdropBlur: {
        mica: '12px',
      },
    },
  },
  plugins: [],
}
