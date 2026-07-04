/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        ink: '#0E1B2C',
        'ink-soft': '#14263C',
        line: '#3D5A73',
        paper: '#E8DFC8',
        'blk-red': '#E8503A',
        'blk-blue': '#3A8FE8',
        'blk-yellow': '#F2C230',
        'blk-green': '#41C476',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Pretendard', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        body: ['Pretendard', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
