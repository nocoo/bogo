import { expect, test } from "@playwright/test";

test("homepage loads with correct title", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveTitle(/Bogo/i);
});

test("/api/live returns health response", async ({ request }) => {
	const res = await request.get("/api/live");
	expect(res.ok()).toBe(true);

	const body = await res.json();
	expect(body.status).toBe("ok");
	expect(body.component).toBe("worker");
});

test("all SPA pages render without errors", async ({ page }) => {
	const pages = [
		"/",
		"/documents",
		"/documents/test-id",
		"/people",
		"/workspaces",
		"/settings",
		"/settings/doc-types",
		"/settings/fields",
		"/settings/tags",
	];

	for (const path of pages) {
		await page.goto(path);
		await expect(page.locator("main")).toBeVisible();
	}
});
