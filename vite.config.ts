import { defineConfig } from "vite";
import { api } from "./server/api.js";

export default defineConfig({
  root: "game",
  plugins: [api()],
  server: { open: true, port: 5173 },
});
