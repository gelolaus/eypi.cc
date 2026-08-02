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
        'eypi-gold': {
          DEFAULT: '#DEAC4B',
          dark: '#c9a84c',
          hover: '#d4b55a',
        },
        // Semantic design tokens (map to CSS vars)
        'g-bg': 'var(--color-bg)',
        'g-surface': 'var(--color-surface)',
        'g-border': 'var(--color-border)',
        'g-text': 'var(--color-text)',
        'g-muted': 'var(--color-text-muted)',
        'g-primary': 'var(--color-primary)',
        'g-primary-fg': 'var(--color-primary-fg)',
        'g-brand': 'var(--color-brand)',
        'g-accent': 'var(--color-primary)',
        'g-destructive': 'var(--color-destructive)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['Syne', 'ui-sans-serif', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        xl: 'calc(var(--radius) * 1.4)',
        '2xl': 'calc(var(--radius) * 1.8)',
      },
    },
  },
  plugins: [],
}
