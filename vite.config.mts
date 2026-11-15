import { defineConfig } from "vite";

// The visualizer lives in ui/ and imports the graph library straight from src/.
export default defineConfig({
    root: "ui",
    base: "./",
    build: {
        outDir: "../dist-ui",
        emptyOutDir: true,
    },
});
