/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'apc-blue': '#34418F',
        'apc-gold': '#DEAC4B',
        'apc-bg': '#FAFAF9',
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
