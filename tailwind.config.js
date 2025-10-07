/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{html,js}',
    './src/**/*.js'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#4f46e5', // indigo-600
          dark: '#4338ca'
        }
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.06), 0 1px 1px rgb(0 0 0 / 0.04)'
      },
      borderRadius: {
        xl: '0.75rem'
      }
    }
  },
  plugins: []
};

