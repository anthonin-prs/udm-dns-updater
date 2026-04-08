import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        "surface-hover": "var(--surface-hover)",
        border: "var(--border)",
        "text-secondary": "var(--text-secondary)",
        "text-tertiary": "var(--text-tertiary)",
        "unifi-blue": "var(--unifi-blue)",
        "unifi-blue-hover": "var(--unifi-blue-hover)",
        danger: "var(--danger)",
        "danger-hover": "var(--danger-hover)",
        success: "var(--success)",
      },
    },
  },
  plugins: [],
};
export default config;
