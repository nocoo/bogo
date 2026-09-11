import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.route("**/api/**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		const document = {
			id: "layout-doc",
			workspaceId: "layout-workspace",
			title: "Layout regression",
			content: "A long document.\n\n".repeat(60),
			version: 1,
			tags: [],
			updatedAt: "2026-09-10T08:00:00Z",
		};
		let data: unknown = [];
		if (path === "/api/workspaces") {
			data = [{ id: document.workspaceId, name: "Layout workspace" }];
		} else if (path.endsWith(`/documents/${document.id}`)) {
			data = document;
		} else if (path.endsWith("/versions")) {
			data = [
				{ id: "version-1", version: 1, title: document.title, createdAt: document.updatedAt },
			];
		}
		await route.fulfill({ json: { data } });
	});
});

test("sidebar logo and navigation share a stationary axis during both transitions", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto("/documents");
	await expect(page.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
	const frames = await page.evaluate(async () => {
		const samples: { logoX: number; logoY: number; iconXs: number[] }[] = [];
		const sample = () => {
			const logo = document.querySelector('aside img[alt="bogo"]')?.getBoundingClientRect();
			if (!logo) throw new Error("Sidebar logo is missing");
			samples.push({
				logoX: logo.x + logo.width / 2,
				logoY: logo.y + logo.height / 2,
				iconXs: [...document.querySelectorAll("aside nav button svg")].map((icon) => {
					const rect = icon.getBoundingClientRect();
					return rect.x + rect.width / 2;
				}),
			});
		};
		sample();
		for (const label of ["Collapse sidebar", "Expand sidebar"]) {
			const toggle = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
			if (!toggle) throw new Error(`${label} is missing`);
			toggle.click();
			const started = performance.now();
			do {
				await new Promise(requestAnimationFrame);
				sample();
			} while (performance.now() - started < 360);
		}
		return samples;
	});

	expect(frames.length).toBeGreaterThan(2);
	for (const frame of frames) {
		expect(Math.abs(frame.logoX - frames[0].logoX)).toBeLessThanOrEqual(0.5);
		expect(Math.abs(frame.logoY - frames[0].logoY)).toBeLessThanOrEqual(0.5);
		expect(frame.iconXs.length).toBeGreaterThan(0);
		for (const iconX of frame.iconXs) {
			expect(Math.abs(iconX - frame.logoX)).toBeLessThanOrEqual(0.5);
		}
	}
});

test("long mobile documents scroll inside the island and keep details reachable", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/documents/layout-doc");
	await expect(page.getByRole("textbox", { name: "Document title" })).toHaveValue(
		"Layout regression",
	);
	await expect(page.getByRole("heading", { name: "Version History", exact: true })).toBeAttached();
	expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(844);

	const details = page.getByRole("complementary", { name: "Document details" });
	await details.scrollIntoViewIfNeeded();
	await expect(details.getByLabel("Event date")).toBeInViewport();
	expect(await page.evaluate(() => window.scrollY)).toBe(0);
	const island = page.locator("main [data-basalt-surface-root]");
	expect(await island.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});
