import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%, 60%": { transform: "translateX(-6px)" },
          "40%, 80%": { transform: "translateX(6px)" },
        },
      },
      animation: {
        shake: "shake 0.4s ease-in-out",
      },
      colors: {
        brand: {
          50: "#f0f4ff",
          100: "#dde8ff",
          200: "#c0d4ff",
          300: "#93b5ff",
          400: "#5f8bff",
          500: "#3b62f7",
          600: "#2443ed",
          700: "#1c33d4",
          800: "#1e2eab",
          900: "#1e2d86",
          950: "#161d52",
        },
      },
    },
  },
  plugins: [],
};

export default config;
