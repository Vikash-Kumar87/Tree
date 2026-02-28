/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          950: '#052e16',
        },
        brand: {
          purple: '#7c3aed',
          pink:   '#ec4899',
          blue:   '#3b82f6',
          teal:   '#14b8a6',
          orange: '#f97316',
          indigo: '#6366f1',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow':   'spin 3s linear infinite',
        'fade-in':     'fadeIn 0.5s ease-in-out',
        'slide-up':    'slideUp 0.4s ease-out',
        'bounce-in':   'bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        'float':       'float 3s ease-in-out infinite',
        'gradient-x':  'gradientX 4s ease infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        bounceIn: {
          '0%':   { transform: 'scale(0.85)', opacity: '0' },
          '100%': { transform: 'scale(1)',    opacity: '1' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%':     { transform: 'translateY(-8px)' },
        },
        gradientX: {
          '0%,100%': { backgroundPosition: '0% 50%' },
          '50%':     { backgroundPosition: '100% 50%' },
        },
      },
      backgroundImage: {
        'forest-gradient':  'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)',
        'app-gradient':     'linear-gradient(160deg, #f5f3ff 0%, #ede9fe 50%, #fce7f3 100%)',
        'navbar-gradient':  'linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #ec4899 100%)',
        'card-purple':      'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
        'card-blue':        'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
        'card-green':       'linear-gradient(135deg, #16a34a 0%, #14b8a6 100%)',
        'card-orange':      'linear-gradient(135deg, #f97316 0%, #ef4444 100%)',
        'card-indigo':      'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        'card-pink':        'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
        'hero-pattern':     "url('/forest-bg.svg')",
      },
    },
  },
  plugins: [],
}
