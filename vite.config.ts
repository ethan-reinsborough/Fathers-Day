import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// Base path: "/" for local/dev, custom domain, or GitHub *user* pages.
// For a GitHub *project* page (user.github.io/gas-guru/) set BASE_PATH=/gas-guru/.
// The deploy workflow sets this automatically from the repo name.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  base,
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "apple-touch-icon.png",
        "icons/apple-splash.png",
      ],
      manifest: {
        name: "Gas Guru — NB Fuel Oracle",
        short_name: "Gas Guru",
        description:
          "Fuel prices, nearby stations and road-trip planning across New Brunswick.",
        theme_color: "#08110f",
        background_color: "#08110f",
        display: "standalone",
        orientation: "portrait",
        scope: base,
        start_url: base,
        categories: ["travel", "utilities", "navigation"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // The price data is small & changes a few times a day — always try the
        // network first so the app shows fresh prices, fall back to cache offline.
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.endsWith("/data/latest.json") ||
              url.pathname.endsWith("/data/history.json") ||
              url.pathname.endsWith("/data/stations.json"),
            handler: "NetworkFirst",
            options: {
              cacheName: "gas-guru-data-v2",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
