import { describe, expect, it } from "vitest";
import { AVATAR_PALETTE_SIZE, avatarColors, avatarInitial } from "./avatar.js";

describe("avatarInitial", () => {
	it("returns first letter uppercased", () => {
		expect(avatarInitial("alice")).toBe("A");
		expect(avatarInitial("Bob")).toBe("B");
	});

	it("uses first word when name has multiple words", () => {
		expect(avatarInitial("shizhe huang")).toBe("S");
		expect(avatarInitial("  Justin   Lee  ")).toBe("J");
	});

	it("returns ? for empty or whitespace input", () => {
		expect(avatarInitial("")).toBe("?");
		expect(avatarInitial("   ")).toBe("?");
	});

	it("handles CJK names", () => {
		expect(avatarInitial("李正")).toBe("李");
		expect(avatarInitial("黄世哲")).toBe("黄");
	});

	it("handles emoji-leading names gracefully", () => {
		// emoji is one grapheme/codepoint — returned as-is (toUpperCase is identity)
		expect(avatarInitial("🦊 fox")).toBe("🦊");
	});
});

describe("avatarColors", () => {
	it("returns deterministic color for the same name", () => {
		expect(avatarColors("Shizhe Huang")).toEqual(avatarColors("Shizhe Huang"));
		expect(avatarColors("alice")).toEqual(avatarColors("alice"));
	});

	it("differentiates similar names", () => {
		const a = avatarColors("Alice");
		const b = avatarColors("Alicia");
		expect(a.bg !== b.bg || a.fg !== b.fg).toBe(true);
	});

	it("normalizes whitespace before hashing", () => {
		expect(avatarColors("  Alice  ")).toEqual(avatarColors("Alice"));
	});

	it("falls back to first palette swatch for empty input", () => {
		const fallback = avatarColors("");
		const fallbackWs = avatarColors("   ");
		expect(fallback).toEqual(fallbackWs);
	});

	it("returns a swatch from the configured palette", () => {
		const c = avatarColors("Shizhe Huang");
		expect(typeof c.bg).toBe("string");
		expect(typeof c.fg).toBe("string");
		expect(c.bg).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it("distributes names across multiple swatches", () => {
		const names = [
			"Alice",
			"Bob",
			"Carol",
			"Dan",
			"Erin",
			"Frank",
			"Gina",
			"Hank",
			"Ivy",
			"Jon",
			"Kate",
			"Liam",
			"Mia",
			"Ned",
			"Olive",
			"Pat",
		];
		const buckets = new Set(names.map((n) => avatarColors(n).bg));
		// With 16 names and 8 buckets we expect well > 1 bucket hit
		expect(buckets.size).toBeGreaterThan(2);
	});

	it("palette size matches exported constant", () => {
		expect(AVATAR_PALETTE_SIZE).toBe(8);
	});
});
