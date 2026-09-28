// Vite 配置：只装 React 插件，端口固定 5173 方便课上演示。
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
