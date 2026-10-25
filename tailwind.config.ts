import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#162321',
        canvas: '#f5f7f3',
        mint: '#d8f3e3',
        leaf: '#2b7457',
        coral: '#ee856e',
        lilac: '#e8e0ff',
        sand: '#f8ead0'
      },
      boxShadow: {
        soft: '0 12px 36px rgba(35, 62, 52, 0.08)',
        float: '0 8px 22px rgba(43, 116, 87, 0.18)'
      },
      borderRadius: { '4xl': '2rem' }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};

export default config;
