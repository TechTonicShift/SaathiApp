/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        ink: '#171512', muted: '#6E6962', paper: '#FBF7F0', card: '#FFFFFF',
        coral: '#E85D3F', peach: '#F9D7CA', sage: '#DCE9D8', line: '#E8E0D7',
      },
    },
  },
  plugins: [],
};
