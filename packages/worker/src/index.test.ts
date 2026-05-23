import type { LiveResponse } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import app from "./index";

describe("worker app", () => {
	it("GET /api/live returns status ok", async () => {
		const res = await app.request("/api/live", {
			headers: { host: "localhost:8787" },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as LiveResponse;
		expect(body.status).toBe("ok");
		expect(body.version).toBe("0.1.0");
		expect(body.component).toBe("worker");
	});
});
