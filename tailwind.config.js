/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        'ink-soft': 'rgb(var(--color-ink-soft) / <alpha-value>)',
        'ink-card': 'rgb(var(--color-ink-card) / <alpha-value>)',
        'ink-border': 'rgb(var(--color-ink-border) / <alpha-value>)',
        fg: 'rgb(var(--color-fg) / <alpha-value>)',
        'fg-soft': 'rgb(var(--color-fg-soft) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        'muted-soft': 'rgb(var(--color-muted-soft) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        alert: '#ef4444',
        'alert-amber': '#f59e0b',
        safe: '#10b981',
        'safe-soft': '#34d399',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'glow-alert': 'glowAlert 2s ease-in-out infinite',
        'glow-safe': 'glowSafe 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowAlert: {
          '0%, 100%': { boxShadow: '0 0 24px rgba(239, 68, 68, 0.25)' },
          '50%': { boxShadow: '0 0 48px rgba(239, 68, 68, 0.5)' },
        },
        glowSafe: {
          '0%, 100%': { boxShadow: '0 0 24px rgba(16, 185, 129, 0.2)' },
          '50%': { boxShadow: '0 0 48px rgba(16, 185, 129, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};
