import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo-mb.png"],
      manifest: {
        name: "MetaBoard",
        short_name: "MetaBoard",
        description: "Transforme uma planilha Google Sheets em um quadro Kanban moderno.",
        start_url: "/",
        display: "standalone",
        background_color: "#fafafa",
        theme_color: "#7c3aed",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        // GET share target: a plain navigation with query params, no service
        // worker fetch interception needed (that's only required for POST/files).
        share_target: {
          action: "/share-target",
          method: "GET",
          params: { title: "title", text: "text", url: "url" },
        },
      },
      workbox: {
        // Precache the static app shell only — Sheets/OpenAI data must never
        // be served stale from cache.
        navigateFallbackDenylist: [/^\/api\//, /^\/share-target/],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.startsWith("/api/") || url.hostname.endsWith("googleapis.com"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 8080,
  },
});
