import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(rootDir, "./src"),
		},
	},
	test: {
		allowOnly: false,
		passWithNoTests: false,
		globals: true,
		environment: "happy-dom",
		setupFiles: ["./test-setup.ts"],
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: [
				"src/lib/**/*.ts",
				"src/hooks/**/*.ts",
				"src/models/**/*.ts",
				"src/viewmodels/**/*.ts",
			],
			exclude: [
				"src/**/*.test.ts",
				"src/**/*.test.tsx",
				"src/**/*.d.ts",
				"src/**/index.ts",
				// Pure presentation View/context shells — covered by L4 Playwright E2E
				"src/components/**",
				"src/contexts/**",
			],
			thresholds: {
				lines: 95,
				branches: 95,
				functions: 95,
				statements: 95,
			},
		},
	},
});
