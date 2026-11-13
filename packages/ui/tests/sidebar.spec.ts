import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
	await page.route("**/api/**", async (route) => {
		const path = new URL(route.request().url()).pathname;
		const data =
			path === "/api/me"
				? { name: "Sidebar User", email: "sidebar@example.test", avatar: null }
				: path === "/api/workspaces"
					? [{ id: "sidebar-workspace", name: "Sidebar workspace" }]
					: [];
		await route.fulfill({ json: { data } });
	});
});

for (const colorScheme of ["light", "dark"] as const) {
	test(`desktop identity stays stationary through collapse in ${colorScheme} mode`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme });
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/documents");
		const rail = page.locator("[data-basalt-sidebar]");
		const avatar = rail.getByRole("img", { name: "Avatar for Sidebar User", exact: true });
		await expect(avatar).toBeVisible();
		await expect(rail).toHaveJSProperty("clientWidth", 260);
		await expect(rail.getByText("sidebar@example.test", { exact: true })).toHaveCSS(
			"line-height",
			"16px",
		);
		const expanded = await avatar.boundingBox();
		expect(expanded).not.toBeNull();
		expect(expanded?.width).toBe(36);
		expect(expanded?.height).toBe(36);
		const brand = rail.locator('[data-slot="sidebar-brand-copy"]');
		await expect(brand).toBeVisible();
		await expect(brand.getByText("bogo", { exact: true })).toBeVisible();
		await expect(brand.getByText(/^v\d/)).toBeVisible();
		await rail.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
		await page.mouse.move(1000, 400);
		await expect(rail).toHaveJSProperty("clientWidth", 68);
		await expect(brand).toBeHidden();
		const collapsed = await avatar.boundingBox();
		expect(collapsed).not.toBeNull();
		expect(collapsed?.width).toBe(36);
		expect(collapsed?.height).toBe(36);
		expect(collapsed?.y).toBe(expanded?.y);
	});

	for (const width of [390, 700]) {
		test(`mobile drawer owns geometry at ${width}px in ${colorScheme} mode`, async ({ page }) => {
			await page.emulateMedia({ colorScheme });
			await page.setViewportSize({ width, height: 844 });
			await page.goto("/documents");
			const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
			await menu.click();
			const drawer = page.locator('[data-slot="sidebar-drawer"]');
			await expect(drawer).toBeVisible();
			await expect(menu).toHaveAttribute("aria-controls", (await drawer.getAttribute("id")) ?? "");
			await expect(menu).toHaveAttribute("aria-expanded", "true");
			await expect(drawer).toHaveCSS("padding-left", "0px");
			await expect(drawer).toHaveCSS("padding-right", "0px");
			await expect(drawer).toHaveJSProperty("clientWidth", 260);
			await expect(
				drawer.getByRole("button", { name: "Close navigation", exact: true }),
			).toBeVisible();
		});
	}
}

test("one Escape dismisses navigation and restores the menu without changing desktop preference", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 844 });
	await page.goto("/documents");
	await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
	await page.mouse.move(1000, 400);
	await expect(page.locator("[data-basalt-sidebar]")).toHaveJSProperty("clientWidth", 68);
	await page.setViewportSize({ width: 390, height: 844 });
	const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
	await menu.focus();
	await menu.press("Enter");
	const drawer = page.locator('[data-slot="sidebar-drawer"]');
	await expect(drawer).toBeVisible();
	await expect(drawer.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(drawer).toBeHidden();
	await expect(menu).toBeFocused();
	await expect(menu).toHaveAttribute("aria-expanded", "false");
	await page.setViewportSize({ width: 1280, height: 844 });
	await expect(page.locator("[data-basalt-sidebar]")).toHaveJSProperty("clientWidth", 68);
});

test("mobile route selection closes the drawer and preserves authentication chrome", async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/documents");
	const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
	await menu.click();
	const drawer = page.locator('[data-slot="sidebar-drawer"]');
	await expect(drawer.getByRole("link", { name: "Sign out", exact: true })).toHaveAttribute(
		"href",
		"/cdn-cgi/access/logout",
	);
	await drawer.getByRole("link", { name: "Table", exact: true }).click();
	await expect(page).toHaveURL(/\/table$/);
	await expect(drawer).toBeHidden();
	await expect(menu).toBeFocused();
	await menu.click();
	await expect(drawer.getByRole("link", { name: "Table", exact: true })).toHaveAttribute(
		"aria-current",
		"page",
	);
	await expect(drawer.getByText("sidebar@example.test", { exact: true })).toBeVisible();
});
