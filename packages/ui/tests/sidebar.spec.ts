import { expect, type Locator, test } from "@playwright/test";

async function paintedArea(locator: Locator) {
	return locator.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		let left = rect.left;
		let right = rect.right;
		let top = rect.top;
		let bottom = rect.bottom;
		for (let parent = element.parentElement; parent; parent = parent.parentElement) {
			const style = getComputedStyle(parent);
			const clip = parent.getBoundingClientRect();
			if (style.overflowX !== "visible") {
				left = Math.max(left, clip.left);
				right = Math.min(right, clip.right);
			}
			if (style.overflowY !== "visible") {
				top = Math.max(top, clip.top);
				bottom = Math.min(bottom, clip.bottom);
			}
		}
		return { width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
	});
}

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
		const version = brand.getByText(/^v\d/);
		await expect(version).toBeVisible();
		for (const copy of [brand.getByText("bogo", { exact: true }), version]) {
			const painted = await paintedArea(copy);
			expect(painted.width).toBeGreaterThan(0);
			expect(painted.height).toBeGreaterThan(0);
		}
		const logo = rail.locator('[data-slot="sidebar-brand-logo"] img');
		expect((await logo.boundingBox())?.width).toBe(24);
		expect((await logo.boundingBox())?.height).toBe(24);
		await rail.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
		await page.mouse.move(1000, 400);
		await expect(rail).toHaveJSProperty("clientWidth", 68);
		await expect(brand).toBeHidden();
		const collapsed = await avatar.boundingBox();
		expect(collapsed).not.toBeNull();
		expect(collapsed?.width).toBe(36);
		expect(collapsed?.height).toBe(36);
		expect(collapsed?.y).toBe(expanded?.y);
		await test.info().attach("desktop-avatar-geometry", {
			body: JSON.stringify({ expanded, collapsed }),
			contentType: "application/json",
		});
	});

	for (const width of [390, 700]) {
		test(`mobile drawer owns geometry at ${width}px in ${colorScheme} mode`, async ({ page }) => {
			await page.emulateMedia({ colorScheme });
			await page.setViewportSize({ width, height: 844 });
			await page.goto("/documents");
			const menu = page.getByRole("button", {
				name: "Open navigation menu",
				exact: true,
				includeHidden: true,
			});
			await menu.click();
			const drawer = page.locator('[data-slot="sidebar-drawer"]');
			await expect(drawer).toBeVisible();
			await test.info().attach("drawer-geometry", {
				body: JSON.stringify(
					await drawer.evaluate((element) => {
						const rect = element.getBoundingClientRect();
						const style = getComputedStyle(element);
						return {
							width: rect.width,
							paddingLeft: style.paddingLeft,
							paddingRight: style.paddingRight,
						};
					}),
				),
				contentType: "application/json",
			});
			await expect(menu).toHaveAttribute("aria-controls", (await drawer.getAttribute("id")) ?? "");
			await expect(menu).toHaveAttribute("aria-expanded", "true");
			await expect(drawer).toHaveCSS("padding-left", "0px");
			await expect(drawer).toHaveCSS("padding-right", "0px");
			await expect.poll(async () => (await drawer.boundingBox())?.width).toBe(320);
			await expect(drawer.locator("[data-basalt-sidebar]")).toHaveJSProperty("clientWidth", 260);
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
	await expect(page.getByRole("tooltip")).toHaveCount(0);
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

for (const photoAvailable of [true, false]) {
	test(`sidebar retains identity with an ${photoAvailable ? "available" : "unavailable"} profile photo`, async ({
		page,
	}) => {
		await page.route("**/api/me", (route) =>
			route.fulfill({
				json: {
					data: {
						name: "Sidebar User",
						email: "sidebar@example.test",
						avatar: photoAvailable ? "/test-profile-photo.svg" : "/missing-test-avatar",
					},
				},
			}),
		);
		await page.route("**/missing-test-avatar", (route) =>
			route.fulfill({ status: 404, body: "Missing test photo" }),
		);
		await page.route("**/test-profile-photo.svg", (route) =>
			route.fulfill({
				contentType: "image/svg+xml",
				body: '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48"><rect width="96" height="48" fill="navy" /></svg>',
			}),
		);
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto("/documents");
		const avatar = page.getByRole("img", { name: "Avatar for Sidebar User", exact: true });
		if (photoAvailable) {
			await expect(avatar.locator("img")).toBeVisible();
			await expect(avatar.locator("img")).toHaveJSProperty("naturalWidth", 96);
			await expect(avatar.locator("img")).toHaveJSProperty("naturalHeight", 48);
			await expect(avatar.locator("img")).toHaveCSS("object-fit", "cover");
		} else {
			await expect(avatar.getByText("S", { exact: true })).toBeVisible();
		}
		expect((await avatar.boundingBox())?.width).toBe(36);
		expect((await avatar.boundingBox())?.height).toBe(36);
		await expect(page.getByRole("link", { name: "Sign out", exact: true })).toHaveAttribute(
			"href",
			"/cdn-cgi/access/logout",
		);
	});
}

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

for (const colorScheme of ["light", "dark"] as const) {
	for (const width of [390, 700]) {
		for (const opening of ["keyboard", "pointer"] as const) {
			test(`first Escape restores ${opening} opener at ${width}px in ${colorScheme} mode`, async ({
				page,
			}) => {
				await page.emulateMedia({ colorScheme });
				await page.setViewportSize({ width, height: 844 });
				await page.goto("/documents");
				const menu = page.getByRole("button", { name: "Open navigation menu", exact: true });
				if (opening === "keyboard") {
					await menu.focus();
					await menu.press("Enter");
				} else {
					await menu.click();
				}
				const drawer = page.locator('[data-slot="sidebar-drawer"]');
				await expect(
					drawer.getByRole("button", { name: "Close navigation", exact: true }),
				).toBeFocused();
				await expect(page.getByRole("tooltip")).toHaveCount(0);
				await page.keyboard.press("Escape");
				await expect(drawer).toBeHidden();
				await expect(menu).toBeFocused();
				await expect(menu).toHaveAttribute("aria-expanded", "false");
			});
		}
	}
}
