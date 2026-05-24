import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		include: ["src/**/*.test.ts", "test/e2e/helpers/**/*.test.ts"],
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
				lines: 95,
				branches: 90,
				functions: 95,
				statements: 95,
			},
		},
	},
});
