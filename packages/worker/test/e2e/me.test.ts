import { describe, expect, it } from "vitest";

const BASE = process.env.BOGO_E2E_BASE || "http://localhost:17036";

describe("GET /api/me", () => {
	it("returns email in data envelope", async () => {
		const res = await fetch(`${BASE}/api/me`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as { data: { email: string | null } };
		expect(body.data).toBeDefined();
		expect(typeof body.data.email).toBe("string");
	});
});
