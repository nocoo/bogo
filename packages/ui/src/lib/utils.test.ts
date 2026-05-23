import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
	it("merges class names", () => {
		expect(cn("foo", "bar")).toBe("foo bar");
	});

	it("handles falsy classes", () => {
		const show = false;
		expect(cn("base", show && "hidden", "extra")).toBe("base extra");
	});

	it("deduplicates tailwind conflicts", () => {
		expect(cn("p-4", "p-2")).toBe("p-2");
	});
});
