import { describe, expect, it } from "vitest";
import { generateId } from "./id.js";

describe("generateId", () => {
	it("returns a valid UUID format", () => {
		const id = generateId();
		expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	});

	it("generates unique IDs", () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateId()));
		expect(ids.size).toBe(100);
	});

	it("embeds current timestamp in high bits", () => {
		const before = Date.now();
		const id = generateId();
		const after = Date.now();
		const hex = id.replace(/-/g, "").slice(0, 12);
		const embedded = Number.parseInt(hex, 16);
		expect(embedded).toBeGreaterThanOrEqual(before);
		expect(embedded).toBeLessThanOrEqual(after);
	});
});
