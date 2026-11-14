import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "github" : "list",
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},

	use: {
		baseURL: "http://127.0.0.1:27036",
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	webServer: {
		command: "bun ../../tests/helpers/test-worker.ts 27036",
		url: "http://127.0.0.1:27036/api/live",
		reuseExistingServer: false,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
	},
});
