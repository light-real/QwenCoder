import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// 本地开发时，Vite proxy 通过系统代理 7890 转发到 Binance
const { HttpsProxyAgent } = require("https-proxy-agent");
const localProxy = new HttpsProxyAgent("http://127.0.0.1:7890");

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni()],
  base: "./",
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      // 将 /fapi 代理到 Binance 合约 API，解决跨域问题
      "/fapi": {
        target: "https://fapi.binance.com",
        changeOrigin: true,
        secure: true,
        agent: localProxy,
      },
    },
  },
});
