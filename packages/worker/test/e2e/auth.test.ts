import { describe, expect, it } from "vitest";

// Minimal L2 E2E for the /api/auth/cli route. The full bearer auth lifecycle
// (login → CRUD with token → revoke → 401) lands in task #6 and replaces /
// extends these cases. Until then, the route gate just needs to observe at
// least one fetch() pointing at every declared route.

const BASE = process.env.BOGO_E2E_BASE || "http://localhost:17036";

describe("GET /api/auth/cli", () => {
	it("returns 302 with api_key / state / email when called via localhost with a loopback callback", async () => {
		const callback = encodeURIComponent("http://127.0.0.1:9999/callback");
		const res = await fetch(`${BASE}/api/auth/cli?callback=${callback}&state=e2e-state`, {
			redirect: "manual",
		});
		expect(res.status).toBe(302);
		const location = res.headers.get("location");
		expect(location).toBeTruthy();
		const url = new URL(location as string);
		expect(url.hostname).toBe("127.0.0.1");
		expect(url.pathname).toBe("/callback");
		expect(url.searchParams.get("api_key")).toMatch(/^bogo_[A-Za-z0-9_-]+$/);
		expect(url.searchParams.get("state")).toBe("e2e-state");
		expect(typeof url.searchParams.get("email")).toBe("string");
	});

	it("rejects a non-loopback callback with 400", async () => {
		const callback = encodeURIComponent("http://example.com:9999/callback");
		const res = await fetch(`${BASE}/api/auth/cli?callback=${callback}`, { redirect: "manual" });
		expect(res.status).toBe(400);
	});

	it("rejects when callback parameter is missing with 400", async () => {
		const res = await fetch(`${BASE}/api/auth/cli`, { redirect: "manual" });
		expect(res.status).toBe(400);
	});
});
