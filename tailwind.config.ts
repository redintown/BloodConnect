import type { Config } from "tailwindcss";

// Centralized design tokens. Emergency-red is the single accent used for
// urgent actions (the "NEED BLOOD NOW" button, critical badges) so it never
// gets diluted by being redefined ad-hoc in components.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        emergency: {
          DEFAULT: "#DC2626",
          hover: "#B91C1C",
        },
        brand: {
          DEFAULT: "#7C2D12",
        },
      },
    },
  },
  plugins: [],
};

export default config;
