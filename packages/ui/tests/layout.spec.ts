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

test("sidebar logo and navigation follow the shared rail geometry", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto("/documents");
	await expect(page.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();

	const geometry = () =>
		page.evaluate(() => {
			const rail = document.querySelector("[data-basalt-sidebar]")?.getBoundingClientRect();
			const mark =
				document.querySelector("aside [data-basalt-sidebar-brand] img") ??
				document.querySelector('aside a[href="/"] img');
			const logo = mark?.getBoundingClientRect();
			const row = document.querySelector("aside nav [data-sidebar-row]")?.getBoundingClientRect();
			if (!rail || !logo || !row) throw new Error("Sidebar geometry is missing");
			return {
				railWidth: Math.round(rail.width),
				logoLeft: Math.round(logo.x - rail.x),
				logoCentre: logo.x + logo.width / 2 - rail.x,
				rowLeft: Math.round(row.x - rail.x),
			};
		});

	const expanded = await geometry();
	expect(expanded.railWidth).toBe(260);
	expect(expanded.logoLeft - expanded.rowLeft).toBe(12);

	await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
	await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
	await page.waitForTimeout(400);

	const collapsed = await geometry();
	expect(collapsed.railWidth).toBe(68);
	expect(Math.abs(collapsed.logoCentre - collapsed.railWidth / 2)).toBeLessThanOrEqual(1);
});

test("expanded sidebar exposes Cloudflare Access sign out", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await page.goto("/");
	await expect(page.getByRole("link", { name: "Sign out", exact: true })).toHaveAttribute(
		"href",
		"/cdn-cgi/access/logout",
	);
});

test("mobile navigation drawer opens, dismisses, and returns focus to the menu button", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/documents");
	const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
	await menu.click();
	const drawer = page.getByRole("dialog");
	await expect(drawer).toBeVisible();
	await expect(drawer.getByRole("button", { name: "Close navigation", exact: true })).toBeVisible();
	await drawer.getByRole("button", { name: "Close navigation", exact: true }).click();
	await expect(drawer).toBeHidden();
	await expect(menu).toBeFocused();
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
