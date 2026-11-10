import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import enkaProxy from "./enka-proxy.ts";
export default defineConfig({ base: "./", plugins: [react(), enkaProxy()] });
