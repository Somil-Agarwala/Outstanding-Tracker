/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"DM Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
