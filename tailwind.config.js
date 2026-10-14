/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // True-black base with iOS-style elevated greys — the app is used in
        // gyms, often in low light, and pure black reads best on OLED phones.
        ink: {
          950: '#000000',
          900: '#1c1c1e',
          850: '#242426',
          800: '#2c2c2e',
          700: '#3a3a3c',
          600: '#48484a',
          500: '#8e8e93',
          400: '#a1a1a6',
          300: '#c7c7cc',
          200: '#e5e5ea',
          100: '#f5f5f7',
        },
        // One loud accent for "now / do this / done" — a training-log lime.
        accent: {
          300: '#d4f59a',
          400: '#c6ef72',
          500: '#b5e655',
          600: '#9fcf3f',
          900: '#2f3d14',
        },
        good: '#34c759',
        warn: '#ff9f0a',
        bad: '#ff453a',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Assistant', 'Heebo', 'system-ui', 'Segoe UI', 'sans-serif'],
        num: ['ui-rounded', 'SF Pro Rounded', 'Assistant', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
        '4xl': '1.75rem',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.92)' },
          '60%': { transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 220ms ease-out both',
        pop: 'pop 200ms ease-out both',
      },
    },
  },
  plugins: [],
};
