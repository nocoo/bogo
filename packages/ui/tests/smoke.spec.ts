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
		"/people/test-id",
		"/table",
		"/workspaces",
		"/settings",
		"/settings/doc-types",
		"/settings/fields",
		"/settings/tags",
	];

	const serverErrors: string[] = [];
	page.on("response", (res) => {
		const status = res.status();
		const url = res.url();
		// Fail on 5xx for app API — static 404s for deep SPA routes are fine
		if (status >= 500 && url.includes("/api/")) {
			serverErrors.push(`${status} ${url}`);
		}
	});

	for (const path of pages) {
		await page.goto(path);
		await expect(page.locator("main")).toBeVisible();
	}

	expect(serverErrors, `API 5xx during smoke:\n${serverErrors.join("\n")}`).toEqual([]);
});

test("table page exposes view chrome after load", async ({ page }) => {
	const serverErrors: string[] = [];
	page.on("response", (res) => {
		if (res.status() >= 500 && res.url().includes("/api/")) {
			serverErrors.push(`${res.status()} ${res.url()}`);
		}
	});

	await page.goto("/table");
	await expect(page.locator("main")).toBeVisible();
	// Toolbar / empty gate — either workspace gate copy or view switcher
	const gate = page.getByText(/Select a workspace to open the people table/i);
	const views = page.getByLabel("Table views");
	await expect(gate.or(views)).toBeVisible({ timeout: 10_000 });
	expect(serverErrors, `API 5xx on /table:\n${serverErrors.join("\n")}`).toEqual([]);
});
