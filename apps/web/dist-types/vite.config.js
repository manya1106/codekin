import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["icon.svg"],
            manifest: {
                name: "Codekin - LeetCode Companion",
                short_name: "Codekin",
                description: "A playful companion for consistent coding practice.",
                theme_color: "#090b13",
                background_color: "#090b13",
                display: "standalone",
                start_url: "/",
                icons: [
                    { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
                ],
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,svg}"],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
                        handler: "CacheFirst",
                        options: { cacheName: "fonts", expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } },
                    },
                ],
            },
        }),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ["react", "react-dom"],
                    firebase: ["firebase/app", "firebase/auth", "firebase/firestore"],
                    motion: ["framer-motion"],
                },
            },
        },
    },
});
