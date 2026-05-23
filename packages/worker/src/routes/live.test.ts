import { describe, expect, it, vi } from "vitest";
import { liveRoute } from "./live";

function createMockContext() {
	const jsonFn = vi.fn().mockReturnValue(new Response());
	return {
		json: jsonFn,
		env: { ENVIRONMENT: "test" },
	} as unknown as Parameters<typeof liveRoute>[0];
}

describe("liveRoute", () => {
	it("returns ok status with version", async () => {
		const c = createMockContext();
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

	it("returns uptime as non-negative number", async () => {
		const c = createMockContext();
		await liveRoute(c);

		const payload = (c.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
		expect(payload.uptime).toBeGreaterThanOrEqual(0);
	});
});
