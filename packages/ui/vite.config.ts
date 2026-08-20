import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = import.meta.dirname;

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		{
			name: "restore-static-gitkeep",
			closeBundle() {
				writeFileSync(resolve(rootDir, "../worker/static/.gitkeep"), "");
			},
		},
	],
	resolve: {
		alias: {
			"@": resolve(rootDir, "./src"),
		},
	},
	build: {
		outDir: "../worker/static",
		emptyOutDir: true,
	},
	server: {
		port: 7036,
		allowedHosts: ["bogo.dev.hexly.ai"],
		proxy: {
			"/api": {
				target: "http://localhost:8787",
				changeOrigin: true,
			},
		},
	},
});
