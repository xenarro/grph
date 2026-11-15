import { defineConfig, Plugin } from "vite";

// What the built page may load: its own scripts and styles, the Google Fonts stylesheet and fonts, and
// images from itself or data: URLs (the icon). No inline scripts or styles, no eval, no plugins, no
// forms, no other sites. Even if some text ever reached the page as markup, nothing in it would run.
// The dev server needs inline scripts for live reload, so only the build gets it.
export const CONTENT_SECURITY_POLICY = [
    "default-src 'none'",
    "script-src 'self'",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
    return {
        name: "content-security-policy",
        apply: "build",
        transformIndexHtml: () => [{
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: CONTENT_SECURITY_POLICY },
            injectTo: "head-prepend",
        }],
    };
}

// The visualizer lives in ui/ and imports the graph library straight from src/.
export default defineConfig({
    root: "ui",
    base: "./",
    plugins: [contentSecurityPolicy()],
    build: {
        outDir: "../dist-ui",
        emptyOutDir: true,
    },
});
