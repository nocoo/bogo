import { BOGO_VERSION, type LiveResponse } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import app from "./index";

describe("worker app", () => {
	it("GET /api/live returns status ok with correct version", async () => {
		const res = await app.request("/api/live", {
			headers: { host: "localhost:8787" },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as LiveResponse;
		expect(body.status).toBe("ok");
		expect(body.version).toBe(BOGO_VERSION);
		expect(body.component).toBe("worker");
	});
});
