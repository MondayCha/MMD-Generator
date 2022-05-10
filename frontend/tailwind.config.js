module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // React Hot Toast: https://github.com/timolins/react-hot-toast/issues/153
      animation: {
        enter: 'fadeInTop 300ms ease-out',
        leave: 'fadeOutBottom 300ms ease-in forwards',
      },
      keyframes: {
        fadeInTop: {
          '0%': {
            opacity: '0',
            transform: 'translate(0, 2rem)',
          },
          '100%': {
            opacity: '1',
            transform: 'translate(0)',
          },
        },
        fadeOutBottom: {
          '0%': {
            opacity: '1',
          },
          '100%': {
            opacity: '0',
          },
        },
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        light: {
          ...require('daisyui/src/colors/themes')['[data-theme=light]'],
          primary: '#0ea5e9',
          secondary: '#faa61a',
          warning: '#fb923c',
        },
      },
      {
        dark: {
          ...require('daisyui/src/colors/themes')['[data-theme=dark]'],
          primary: '#0284c7',
          secondary: '#faa61a',
          warning: '#ea580c',
        },
      },
    ],
  },
  darkMode: 'class',
};
