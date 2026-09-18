import type { Config } from "tailwindcss";

/**
 * Placeholder Tailwind config so Joy's screens run standalone. This should
 * be replaced/merged with Akash's token file (colors, spacing scale,
 * shadcn theme extension) rather than diverging from it — per T8, no new
 * one-off values should be introduced in operator screens without
 * checking with Akash first.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
