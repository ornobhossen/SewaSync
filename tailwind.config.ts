import type { Config } from 'tailwindcss';

/**
 * Palette and scale come straight from the SewaSync design system. Teal is the
 * only brand colour; amber, green and red are status colours and are never
 * used as decoration.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0F766E', dark: '#115E59', soft: '#CCFBF1' },
        accent: '#F59E0B',
        success: '#16A34A',
        danger: '#DC2626',
        ink: { DEFAULT: '#0B1220', muted: '#64748B' },
        surface: '#F8FAFC',
        card: '#FFFFFF',
        line: '#E2E8F0',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        hero: ['32px', { lineHeight: '38px', letterSpacing: '-0.02em' }],
        page: ['20px', { lineHeight: '26px', letterSpacing: '-0.015em' }],
        lead: ['17px', { lineHeight: '24px' }],
        body: ['15px', { lineHeight: '21px' }],
        label: ['13px', { lineHeight: '16px', letterSpacing: '0.06em' }],
        micro: ['11px', { lineHeight: '14px', letterSpacing: '0.08em' }],
      },
      borderRadius: {
        card: '16px',
        btn: '12px',
        sheet: '24px',
        fab: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(11,18,32,.06), 0 1px 3px rgba(11,18,32,.05)',
        lg: '0 12px 32px -8px rgba(11,18,32,.18), 0 2px 8px rgba(11,18,32,.08)',
      },
      transitionDuration: {
        150: '150ms',
        250: '250ms',
        300: '300ms',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-320px 0' }, '100%': { backgroundPosition: '320px 0' } },
        sheetIn: { from: { transform: 'translateY(14px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        toastIn: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
      animation: {
        shimmer: 'shimmer 1.1s linear infinite',
        'sheet-in': 'sheetIn 250ms cubic-bezier(.16,1,.3,1)',
        'toast-in': 'toastIn 150ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
