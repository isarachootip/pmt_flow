/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class', // We enforce purely light theme
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          soft: 'var(--primary-soft)',
          softer: 'var(--primary-softer)',
        },
        text: {
          DEFAULT: 'var(--text)',
          secondary: 'var(--text-secondary)',
          placeholder: 'var(--text-placeholder)',
          'on-primary': 'var(--text-on-primary)',
        },
        surface: {
          bg: 'var(--bg)',
          subtle: 'var(--bg-subtle)',
          card: 'var(--card)',
          border: 'var(--border)',
          'border-soft': 'var(--border-soft)',
          'grid-line': 'var(--grid-line)',
        },
        st: {
          pending: 'var(--st-pending)',
          progress: 'var(--st-progress)',
          done: 'var(--st-done)',
          overdue: 'var(--st-overdue)',
          rework: 'var(--st-rework)',
          neutral: 'var(--st-neutral)',
        }
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
        pop: 'var(--shadow-pop)',
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans Thai', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient': 'var(--hero-gradient)',
      }
    },
  },
  plugins: [],
};
