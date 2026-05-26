import { describe, expect, it } from "vitest";
import app from "../index";

describe("GET /api/me", () => {
	it("returns email for localhost", async () => {
		const res = await app.request("/api/me", {
			headers: { host: "localhost:8787" },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { data: { email: string } };
		expect(body.data.email).toBe("dev@localhost");
	});
});
