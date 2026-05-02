import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        theme: {
          main: "var(--bg-main)",
          card: "var(--bg-card)",
          panel: "var(--bg-panel)",
          text: "var(--text-primary)",
          muted: "var(--text-muted)",
          border: "var(--border-color)",
          accent: "var(--theme-accent, var(--border-color))", // NOVA PAMETNA BOJA!
        }
      },
      borderRadius: {
        'box': "var(--radius-box)",
      },
      boxShadow: {
        'glow': "var(--border-glow)",
      }
    },
  },
  plugins: [],
};
export default config;