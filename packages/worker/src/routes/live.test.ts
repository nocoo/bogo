import { describe, expect, it, vi } from "vitest";
import { liveRoute } from "./live";

function createMockContext(dbProbeResult: unknown = { probe: 1 }) {
	const jsonFn = vi.fn().mockReturnValue(new Response());
	const db = {
		prepare: vi.fn().mockReturnValue({
			first: vi.fn().mockImplementation(async () => {
				if (dbProbeResult instanceof Error) throw dbProbeResult;
				return dbProbeResult;
			}),
		}),
	};
	return {
		json: jsonFn,
		env: { ENVIRONMENT: "test", DB: db },
	} as unknown as Parameters<typeof liveRoute>[0];
}

describe("liveRoute", () => {
	it("returns ok status with version when DB probe succeeds", async () => {
		const c = createMockContext({ probe: 1 });
		await liveRoute(c);

		expect(c.json).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "ok",
				component: "worker",
				version: expect.any(String),
				timestamp: expect.any(String),
				uptime: expect.any(Number),
			}),
			200,
			{ "Cache-Control": "no-store" },
		);
	});

	it("returns error status with 503 when DB probe fails", async () => {
		const c = createMockContext(new Error("D1 unavailable"));
		await liveRoute(c);

		expect(c.json).toHaveBeenCalledWith(
			expect.objectContaining({
				status: "error",
				component: "worker",
			}),
			503,
			{ "Cache-Control": "no-store" },
		);
	});

	it("returns uptime as non-negative number", async () => {
		const c = createMockContext({ probe: 1 });
		await liveRoute(c);

		const payload = (c.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(payload.uptime).toBeGreaterThanOrEqual(0);
	});
});
