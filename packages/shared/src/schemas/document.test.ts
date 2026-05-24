import { describe, expect, it } from "vitest";
import { createDocumentSchema, updateDocumentSchema } from "./document.js";

describe("document schemas", () => {
	describe("createDocumentSchema", () => {
		it("accepts minimal input", () => {
			const result = createDocumentSchema.safeParse({ title: "My Doc" });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.content).toBe("");
				expect(result.data.personIds).toEqual([]);
			}
		});

		it("accepts full input", () => {
			const result = createDocumentSchema.safeParse({
				title: "1:1 Notes",
				content: "# Meeting\n\nDiscussed goals.",
				typeId: "550e8400-e29b-41d4-a716-446655440000",
				eventDate: "2026-05-20",
				personIds: ["660e8400-e29b-41d4-a716-446655440000"],
			});
			expect(result.success).toBe(true);
		});

		it("rejects empty title", () => {
			const result = createDocumentSchema.safeParse({ title: "" });
			expect(result.success).toBe(false);
		});

		it("rejects invalid date format", () => {
			const result = createDocumentSchema.safeParse({
				title: "Test",
				eventDate: "not-a-date",
			});
			expect(result.success).toBe(false);
		});

		it("accepts null typeId and eventDate", () => {
			const result = createDocumentSchema.safeParse({
				title: "Evergreen",
				typeId: null,
				eventDate: null,
			});
			expect(result.success).toBe(true);
		});
	});

	describe("updateDocumentSchema", () => {
		it("accepts partial update", () => {
			const result = updateDocumentSchema.safeParse({ title: "Updated" });
			expect(result.success).toBe(true);
		});

		it("accepts content-only update", () => {
			const result = updateDocumentSchema.safeParse({
				content: "New content",
			});
			expect(result.success).toBe(true);
		});
	});
});
