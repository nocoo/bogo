import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@bogo/shared": resolve(import.meta.dirname, "../shared/src/index.ts"),
		},
	},
	test: {
		allowOnly: false,
		passWithNoTests: false,
		globals: true,
		include: ["src/**/*.test.ts", "test/e2e/helpers/**/*.test.ts", "test/seeds/**/*.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/**/*.ts"],
			exclude: [
				"src/**/*.test.ts",
				"src/**/*.d.ts",
				"src/**/index.ts",
				"src/types.ts",
				"src/middleware/**",
				"src/test-utils/**",
			],
			thresholds: {
				lines: 80,
				branches: 80,
				functions: 80,
				statements: 80,
			},
		},
	},
});
