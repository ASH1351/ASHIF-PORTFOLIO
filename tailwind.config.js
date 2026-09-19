/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        bebas: ['"Bebas Neue"', 'Impact', 'sans-serif'],
        mono: ['"Space Grotesk"', 'monospace', 'sans-serif'],
        sans: ['"Outfit"', 'sans-serif'],
      },
      colors: {
        brand: {
          red: '#ff2a3b',
        }
      }
    },
  },
  plugins: [],
}
