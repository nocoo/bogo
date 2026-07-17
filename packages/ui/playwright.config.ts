import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? "github" : "list",
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},

	use: {
		baseURL: "http://localhost:27036",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	webServer: {
		// Apply D1 migrations into the Playwright persist dir before serving —
		// otherwise /api/w/* returns 500 (missing tables) while smoke still “passes”.
		command:
			"cd ../worker && bunx wrangler d1 migrations apply bogo --local --persist-to .wrangler/e2e-pw && bunx wrangler dev --port 27036 --local --persist-to .wrangler/e2e-pw",
		url: "http://localhost:27036/api/live",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
	},
});
