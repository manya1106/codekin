/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#090b13",
        panel: "#111522",
        lime: "#b9f46b",
        violet: "#9277ff",
        cyan: "#55dfea",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["Space Mono", "monospace"] },
      boxShadow: { glow: "0 0 40px rgba(146,119,255,.18)" },
    },
  },
  plugins: [],
};
