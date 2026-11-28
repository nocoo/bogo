import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const rootDir = import.meta.dirname;

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(rootDir, "./src"),
			"@bogo/shared": resolve(rootDir, "../shared/src/index.ts"),
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
				"**/types.ts",
				// Pure presentation View/context shells — covered by L4 Playwright E2E
				"src/components/**",
				"src/views/**",
				"src/pages/**",
				"src/contexts/**",
				"src/app/**/{page,layout,loading,error,not-found}.tsx",
				"src/main.tsx",
				"src/App.tsx",
				"src/app.tsx",
			],
			thresholds: {
				statements: 90,
				lines: 90,
				functions: 90,
				branches: 85,
			},
		},
	},
});
