/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand colors — kept for untouched dashboard/settings/auth views
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
        // Semantic design tokens (map to CSS vars)
        'g-bg':      'var(--color-bg)',
        'g-surface': 'var(--color-surface)',
        'g-border':  'var(--color-border)',
        'g-text':    'var(--color-text)',
        'g-muted':   'var(--color-text-muted)',
        'g-accent':  'var(--color-accent)',
        'g-primary': 'var(--color-primary)',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'monospace'],
      },
      backgroundImage: {
        'dot-grid': 'radial-gradient(circle, var(--color-dot) 0.75px, transparent 0.75px)',
      },
      backgroundSize: {
        'dot-grid': '120px 120px',
      },
      backdropBlur: {
        mica: '12px',
      },
    },
  },
  plugins: [],
}
