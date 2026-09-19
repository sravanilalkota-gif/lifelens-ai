/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      spacing: {
        13: '3.25rem',
        15: '3.75rem',
        18: '4.5rem',
      },
      colors: {
        brand: {
          50: '#f2f4ff',
          100: '#e6e9ff',
          200: '#cdd3ff',
          300: '#a7b1ff',
          400: '#7c88ff',
          500: '#5b62f5',
          600: '#4640e0',
          700: '#3a31b8',
          800: '#312b93',
          900: '#2c2873',
        },
        ink: {
          900: '#12131a',
          800: '#1d1f2a',
          700: '#2b2e3d',
          500: '#5b6072',
          400: '#7c8194',
          300: '#a6abbd',
          100: '#eceef5',
          50: '#f6f7fb',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,19,26,0.04), 0 8px 24px -12px rgba(18,19,26,0.12)',
        lift: '0 2px 4px rgba(18,19,26,0.05), 0 18px 40px -18px rgba(18,19,26,0.25)',
        brand: '0 12px 30px -10px rgba(70,64,224,0.55)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'sheet-up': {
          '0%': { opacity: '0', transform: 'translateY(24px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.25)', opacity: '0' },
          '100%': { transform: 'scale(1.25)', opacity: '0' },
        },
        'scan-line': {
          '0%,100%': { transform: 'translateY(0%)' },
          '50%': { transform: 'translateY(320%)' },
        },
        pop: {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '60%': { transform: 'scale(1.04)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 0.25s ease-out both',
        'sheet-up': 'sheet-up 0.28s cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.24,0,0.38,1) infinite',
        'scan-line': 'scan-line 2.4s ease-in-out infinite',
        pop: 'pop 0.32s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};
