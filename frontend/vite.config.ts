import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendTarget = process.env.BACKEND_PROXY_TARGET || "http://localhost:3006";
const allowedHosts = [".ts.net", "localhost", ".localhost", ...(process.env.NEUROLAB_ALLOWED_HOSTS?.split(",").map((host) => host.trim()).filter(Boolean) ?? [])];
const websocketTarget = process.env.WEBSOCKET_PROXY_TARGET || "http://localhost:3007";
const proxy = {
  "/api": { target: backendTarget, changeOrigin: true },
  "/health": { target: backendTarget, changeOrigin: true },
  "/socket.io": { target: websocketTarget, changeOrigin: true, ws: true },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3005,
    strictPort: true,
    allowedHosts,
    proxy,
    fs: { allow: [".."] },
  },
  preview: { host: "0.0.0.0", port: 3005, strictPort: true, allowedHosts, proxy },
});
