import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Aurora node-type palette (placeholder — tune per spec §6 Board view)
        "node-event": "#e85d75",
        "node-person": "#f4a261",
        "node-org": "#2a9d8f",
        "node-faction": "#264653",
        "node-place": "#a8dadc",
        "node-phenomenon": "#9d4edd",
        "node-concept": "#6c757d",
        "node-artifact": "#e9c46a",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
