import type { LiveResponse } from "@bogo/shared";
import { describe, expect, it } from "vitest";

const BASE = process.env.BOGO_E2E_BASE || "http://localhost:17036";

describe("GET /api/live", () => {
	it("returns 200 with liveness payload", async () => {
		const res = await fetch(`${BASE}/api/live`);
		expect(res.status).toBe(200);

		const body = (await res.json()) as LiveResponse;
		expect(body.status).toBe("ok");
		expect(body.component).toBe("worker");
		expect(body.version).toBeDefined();
		expect(body.uptime).toBeGreaterThanOrEqual(0);
	});

	it("returns Cache-Control: no-store", async () => {
		const res = await fetch(`${BASE}/api/live`);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("returns ISO timestamp", async () => {
		const res = await fetch(`${BASE}/api/live`);
		const body = (await res.json()) as LiveResponse;
		expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
	});
});

describe("Access auth (localhost bypass)", () => {
	it("/api/live is public (no auth required)", async () => {
		const res = await fetch(`${BASE}/api/live`);
		expect(res.status).toBe(200);
	});

	it("unregistered /api/* routes return 404 via localhost bypass", async () => {
		const res = await fetch(`${BASE}/api/nonexistent`);
		expect(res.status).toBe(404);
	});
});
