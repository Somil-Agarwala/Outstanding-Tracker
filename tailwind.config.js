/** @type {import('tailwindcss').Config} */

// Warm neutrals from the PayTrack design. slate and gray both map here so
// screens that still use those class names pick up the new look.
const neutral = {
  50:  '#faf9f5',
  100: '#f2f1ed',
  200: '#e3e1db',
  300: '#cfccc4',
  400: '#8b9199',
  500: '#5b6169',
  600: '#474c53',
  700: '#33373c',
  800: '#22252a',
  900: '#15171a',
  950: '#0c0d0f',
}

// Brand teal. indigo maps here so older accent classes become the brand colour.
const teal = {
  50:  '#eef4f6',
  100: '#d9e7ec',
  200: '#b5cfd8',
  300: '#8db2bf',
  400: '#5e8d9d',
  500: '#3a6b7c',
  600: '#1f4e5f',
  700: '#1a4251',
  800: '#123542',
  900: '#0d2833',
  950: '#081a22',
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Archivo', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        slate: neutral,
        gray: neutral,
        indigo: teal,
        brand: { DEFAULT: '#1f4e5f', dark: '#123542', soft: '#a8c4ce' },
        ink: '#15171a',
        muted: '#5b6169',
        faint: '#8b9199',
        dim: '#cfccc4',
        paper: '#f1f0ec',
        surface: '#faf9f5',
        line: { DEFAULT: '#e3e1db', soft: '#f2f1ed', input: '#d8d5cd' },
        track: '#eceae4',
        bad:  { DEFAULT: '#a6321f', bg: '#fdf6f4', line: '#e8c4b8', ink: '#5b3029' },
        warn: { DEFAULT: '#8f5a0c', bg: '#fffdf5', line: '#ecdcb8', ink: '#6b4a14' },
        good: { DEFAULT: '#2d6a4a', bg: '#f2f8f4', line: '#c4dcce', ink: '#1f4a34' },
        red:     { 50: '#fdf6f4', 100: '#f9e6e1', 200: '#e8c4b8', 500: '#c0452f', 600: '#a6321f', 700: '#a6321f', 800: '#7d2517' },
        amber:   { 50: '#fffdf5', 100: '#fbf3dc', 200: '#ecdcb8', 400: '#c98a1f', 500: '#b0741a', 600: '#8f5a0c', 700: '#8f5a0c' },
        orange:  { 50: '#fffdf5', 100: '#fbf3dc', 200: '#ecdcb8', 400: '#c98a1f', 500: '#b0741a', 600: '#8f5a0c', 700: '#8f5a0c' },
        emerald: { 50: '#f2f8f4', 100: '#e1efe6', 200: '#c4dcce', 400: '#4f8f6b', 500: '#3b7a57', 600: '#2d6a4a', 700: '#2d6a4a' },
        blue:    { 50: '#eef4f6', 100: '#d9e7ec', 200: '#b5cfd8', 600: '#1f4e5f', 700: '#1f4e5f' },
      },
    },
  },
  plugins: [],
}
