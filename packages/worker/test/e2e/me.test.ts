import { describe, expect, it } from "vitest";

const BASE = process.env.BOGO_E2E_BASE || "http://localhost:17036";

describe("GET /api/me", () => {
	it("returns email in data envelope", async () => {
		const res = await fetch(`${BASE}/api/me`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as {
			data: { email: string | null; name: string | null; avatar: string | null };
		};
		expect(body.data).toBeDefined();
		expect(typeof body.data.email).toBe("string");
		expect("name" in body.data).toBe(true);
		expect("avatar" in body.data).toBe(true);
		expect(body.data.name === null || typeof body.data.name === "string").toBe(true);
		expect(body.data.avatar === null || typeof body.data.avatar === "string").toBe(true);
	});
});
