import { describe, expect, it } from "vitest";
import { PRESET_HEX_VALUES, getTagColors } from "./tag-colors.js";

describe("getTagColors", () => {
	it("returns fallback gray for null color", () => {
		const tokens = getTagColors(null);
		expect(tokens).toEqual({ bg: "#f3f4f6", text: "#374151", border: "#d1d5db" });
	});

	it("returns preset tokens for known hex", () => {
		const tokens = getTagColors("#3b82f6");
		expect(tokens).toEqual({ bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" });
	});

	it("is case-insensitive for preset lookup", () => {
		const tokens = getTagColors("#3B82F6");
		expect(tokens).toEqual({ bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" });
	});

	it("computes tokens for custom hex not in preset", () => {
		const tokens = getTagColors("#ff00ff");
		expect(tokens.bg).toMatch(/^rgb\(/);
		expect(tokens.text).toMatch(/^rgb\(/);
		expect(tokens.border).toMatch(/^rgb\(/);
	});

	it("computes accessible contrast for light colors", () => {
		const tokens = getTagColors("#ffff00");
		expect(tokens.text).toMatch(/^rgb\(/);
		const match = tokens.text.match(/rgb\((\d+),(\d+),(\d+)\)/);
		expect(match).not.toBeNull();
		const r = Number(match?.[1]);
		const g = Number(match?.[2]);
		const b = Number(match?.[3]);
		expect(r + g + b).toBeLessThan(255 * 3);
	});

	it("exposes 12 preset hex values", () => {
		expect(PRESET_HEX_VALUES).toHaveLength(12);
		for (const hex of PRESET_HEX_VALUES) {
			expect(hex).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});
