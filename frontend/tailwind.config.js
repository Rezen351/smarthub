import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#fafafa',
        surface: '#ffffff',
        primary: {
          DEFAULT: '#000000',
          hover: '#333333',
        },
        accent: {
          DEFAULT: '#0070f3',
          hover: '#0051a8',
        },
        danger: {
          DEFAULT: '#e00',
          hover: '#c00',
        },
        text: {
          primary: '#171717',
          secondary: '#666666',
          light: '#999999',
        },
        border: '#eaeaea',
      },
      fontFamily: {
        inter: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        none: 'none',
        sm: '0 2px 4px rgba(0,0,0,0.02)',
        md: '0 4px 12px rgba(0,0,0,0.05)',
        lg: '0 12px 24px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
