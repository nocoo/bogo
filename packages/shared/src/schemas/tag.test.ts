import { describe, expect, it } from "vitest";
import { createTagSchema, updateTagSchema } from "./tag.js";

describe("tag schemas", () => {
	describe("createTagSchema", () => {
		it("accepts valid document tag", () => {
			const result = createTagSchema.safeParse({
				name: "Engineering",
				scope: "document",
				color: "#3b82f6",
			});
			expect(result.success).toBe(true);
		});

		it("accepts valid person tag without color", () => {
			const result = createTagSchema.safeParse({
				name: "Senior",
				scope: "person",
			});
			expect(result.success).toBe(true);
		});

		it("accepts null color", () => {
			const result = createTagSchema.safeParse({
				name: "Test",
				scope: "document",
				color: null,
			});
			expect(result.success).toBe(true);
		});

		it("accepts sortOrder", () => {
			const result = createTagSchema.safeParse({
				name: "Priority",
				scope: "document",
				sortOrder: 5,
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.sortOrder).toBe(5);
			}
		});

		it("rejects missing name", () => {
			const result = createTagSchema.safeParse({ scope: "document" });
			expect(result.success).toBe(false);
		});

		it("rejects empty name", () => {
			const result = createTagSchema.safeParse({ name: "", scope: "document" });
			expect(result.success).toBe(false);
		});

		it("rejects name over 50 chars", () => {
			const result = createTagSchema.safeParse({
				name: "a".repeat(51),
				scope: "document",
			});
			expect(result.success).toBe(false);
		});

		it("rejects invalid scope", () => {
			const result = createTagSchema.safeParse({ name: "Tag", scope: "team" });
			expect(result.success).toBe(false);
		});

		it("rejects missing scope", () => {
			const result = createTagSchema.safeParse({ name: "Tag" });
			expect(result.success).toBe(false);
		});

		it("rejects invalid hex color", () => {
			const result = createTagSchema.safeParse({
				name: "Tag",
				scope: "document",
				color: "red",
			});
			expect(result.success).toBe(false);
		});

		it("rejects hex without hash", () => {
			const result = createTagSchema.safeParse({
				name: "Tag",
				scope: "document",
				color: "3b82f6",
			});
			expect(result.success).toBe(false);
		});

		it("rejects short hex", () => {
			const result = createTagSchema.safeParse({
				name: "Tag",
				scope: "document",
				color: "#f00",
			});
			expect(result.success).toBe(false);
		});
	});

	describe("updateTagSchema", () => {
		it("accepts partial name update", () => {
			const result = updateTagSchema.safeParse({ name: "Renamed" });
			expect(result.success).toBe(true);
		});

		it("accepts color update", () => {
			const result = updateTagSchema.safeParse({ color: "#ef4444" });
			expect(result.success).toBe(true);
		});

		it("accepts null color (reset)", () => {
			const result = updateTagSchema.safeParse({ color: null });
			expect(result.success).toBe(true);
		});

		it("accepts sortOrder update", () => {
			const result = updateTagSchema.safeParse({ sortOrder: 3 });
			expect(result.success).toBe(true);
		});

		it("accepts empty object", () => {
			const result = updateTagSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it("rejects invalid color", () => {
			const result = updateTagSchema.safeParse({ color: "not-a-color" });
			expect(result.success).toBe(false);
		});
	});
});
