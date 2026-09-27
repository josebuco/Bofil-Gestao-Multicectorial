// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        filename: "sw.js",
        devOptions: { enabled: false },
        manifest: false,
        workbox: {
          globPatterns: ["**/*.{js,css,woff,woff2,png,svg,ico}"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // Páginas: tenta a rede, usa a cópia guardada quando não há internet.
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/api/") &&
                !url.pathname.startsWith("/_serverFn"),
              handler: "NetworkFirst",
              options: {
                cacheName: "bofil-pages",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 },
              },
            },
            {
              urlPattern: ({ url }) => /fonts\.(googleapis|gstatic)\.com$/.test(url.host),
              handler: "CacheFirst",
              options: {
                cacheName: "bofil-fonts",
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\/_build\/|\.(js|css|woff2?|png|svg|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "bofil-assets",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 },
              },
            },
          ],
        },
      }),
    ],
  },
});
