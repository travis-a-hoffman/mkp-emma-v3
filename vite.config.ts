import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  appType: "spa",
  base: "/",
  build: {
    chunkSizeWarningLimit: 1500,
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          router: ["react-router-dom"],
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  define: {
    "import.meta.env.VITE_GOOGLE_MAPS_API_KEY": JSON.stringify(process.env.VITE_GOOGLE_MAPS_API_KEY),
    "import.meta.env.VITE_AUTH0_DOMAIN": JSON.stringify(process.env.VITE_AUTH0_DOMAIN),
    "import.meta.env.VITE_AUTH0_CLIENT_ID": JSON.stringify(process.env.VITE_AUTH0_CLIENT_ID),
  },
  assetsInclude: ["site.webmanifest", "**/*.json", "**/*.png", "**/*.ico"],
})
