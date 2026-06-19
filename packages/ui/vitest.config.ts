import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
		},
	},
	test: {
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
				"src/contexts/**/*.tsx",
				"src/components/workspace/**/*.tsx",
				"src/components/person/**/*.tsx",
				"src/components/field/**/*.tsx",
				"src/components/document/**/*.tsx",
			],
			exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/*.d.ts", "src/**/index.ts"],
			thresholds: {
				lines: 95,
				branches: 90,
				functions: 95,
				statements: 95,
			},
		},
	},
});
