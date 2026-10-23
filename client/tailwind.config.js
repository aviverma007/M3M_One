/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef8f6', 100: '#d5eee9', 200: '#acdcd3', 300: '#7bc4b8', 400: '#4aa799', 500: '#2f8b7e', 600: '#236f65', 700: '#1f5952', 800: '#1c4843', 900: '#193c38', 950: '#0a2220' },
        ink: { 50: '#f6f7f8', 100: '#eceef1', 200: '#d5d9e0', 300: '#b0b7c3', 400: '#858fa1', 500: '#667186', 600: '#515a6e', 700: '#434a5a', 800: '#3a3f4c', 900: '#1f232b' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
};
