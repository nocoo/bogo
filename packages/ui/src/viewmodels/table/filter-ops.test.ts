import { describe, expect, it } from "vitest";
import { isFilterOpAllowedForKind, opsForKind } from "./filter-ops.js";

describe("filter-ops", () => {
	it("lists ops for known kinds", () => {
		expect(opsForKind("number")).toContain("gt");
		expect(opsForKind("number")).not.toContain("contains");
		expect(opsForKind("person-ref")).toContain("contains");
		expect(opsForKind("tags")).toEqual(["in", "is_empty", "is_not_empty"]);
		expect(opsForKind("avatar")).toEqual([]);
	});

	it("detects illegal historical ops", () => {
		expect(isFilterOpAllowedForKind("number", "contains")).toBe(false);
		expect(isFilterOpAllowedForKind("number", "eq")).toBe(true);
		expect(isFilterOpAllowedForKind("text", "contains")).toBe(true);
		expect(isFilterOpAllowedForKind("avatar", "eq")).toBe(false);
	});
});
