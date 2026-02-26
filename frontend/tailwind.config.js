/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy brand scale (kept for compatibility during migration)
        brand: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Replic design system palette
        primary:  '#C1502D', // Burnt Sienna — CTAs, active states
        dark:     '#2F1847', // Deep Indigo — dark backgrounds, headings
        plum:     '#624763', // Dusty Plum — secondary elements, hover
        blush:    '#EABFCB', // Blush — badges, chips, highlights
        surface:  '#F5EAE0', // Warm White — page bg, cards
        ink:      '#1A1025', // Near-black (warm) — body text
        muted:    '#8C7D8E', // Mid gray — secondary / placeholder
        'surface-2': '#EDE0D5', // Slightly deeper warm — borders, alt bg
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono:    ['"DM Mono"', '"Courier New"', 'monospace'],
        sans:    ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        replic: {
          'primary':          '#C1502D',
          'primary-content':  '#ffffff',
          'secondary':        '#624763',
          'secondary-content':'#ffffff',
          'accent':           '#EABFCB',
          'accent-content':   '#1A1025',
          'neutral':          '#2F1847',
          'neutral-content':  '#ffffff',
          'base-100':         '#F5EAE0',
          'base-200':         '#EDE0D5',
          'base-300':         '#DDD0C8',
          'base-content':     '#1A1025',
          'info':             '#7dd3fc',
          'info-content':     '#0c4a6e',
          'success':          '#86efac',
          'success-content':  '#14532d',
          'warning':          '#fde68a',
          'warning-content':  '#78350f',
          'error':            '#fca5a5',
          'error-content':    '#7f1d1d',
        },
      },
    ],
    logs: false,
  },
}
