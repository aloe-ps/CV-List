import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// MPA構成: index.html / work.html / generator.html の3エントリ。
// 出力先 docs/ は GitHub Pages の公開ディレクトリ (legacy publish)。
// base "./" で /CV-List/ サブパス配信に対応する。
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "docs",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
        work: "work.html",
        generator: "generator.html",
      },
    },
  },
});
