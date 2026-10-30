import type { Config } from 'tailwindcss';

// الألوان كلها عبر متغيرات CSS (انظر src/app/globals.css) ليعمل الوضع الداكن تلقائياً
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-latin)', 'var(--font-arabic)', 'Segoe UI', 'Tahoma', 'system-ui', 'sans-serif']
      },
      fontWeight: { light: '300', normal: '400', bold: '700', extrabold: '800' },
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          soft: 'var(--color-primary-soft)',
          on: 'var(--color-on-primary)'
        },
        bg: 'var(--color-bg)',
        surface: { DEFAULT: 'var(--color-surface)', raised: 'var(--color-surface-raised)' },
        ink: { DEFAULT: 'var(--color-ink)', muted: 'var(--color-ink-muted)' },
        line: 'var(--color-line)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)'
      },
      borderRadius: { card: '14px', control: '10px' },
      minHeight: { touch: '44px', 'touch-lg': '64px' }
    }
  },
  plugins: []
};

export default config;
