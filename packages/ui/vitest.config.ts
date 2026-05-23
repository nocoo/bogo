import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "happy-dom",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json", "html"],
			include: ["src/lib/**/*.ts", "src/hooks/**/*.ts"],
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
