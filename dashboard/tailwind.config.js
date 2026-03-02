/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gov: {
          primary: '#1a3c5e',
          secondary: '#2563eb',
          accent: '#f59e0b',
          success: '#16a34a',
          danger: '#dc2626',
        },
        mode: {
          car: '#FF5252',
          bus: '#2E88F0',
          auto: '#FF9800',
          walk: '#4CAF50',
          bicycle: '#9C27B0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
