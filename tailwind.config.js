/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        arena: {
          bg: '#0b0f19',
          surface: '#131a2b',
          card: '#1a233a',
          border: '#2a3759',
          accent: '#f59e0b',
          glow: '#38bdf8'
        }
      }
    }
  },
  plugins: []
};
