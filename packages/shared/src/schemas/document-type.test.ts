import { describe, expect, it } from "vitest";
import { createDocTypeSchema, updateDocTypeSchema } from "./document-type.js";

describe("document type schemas", () => {
	describe("createDocTypeSchema", () => {
		it("accepts name only", () => {
			const result = createDocTypeSchema.safeParse({ name: "Meeting Notes" });
			expect(result.success).toBe(true);
		});

		it("accepts name with color", () => {
			const result = createDocTypeSchema.safeParse({
				name: "Review",
				color: "#4CAF50",
			});
			expect(result.success).toBe(true);
		});

		it("rejects empty name", () => {
			const result = createDocTypeSchema.safeParse({ name: "" });
			expect(result.success).toBe(false);
		});
	});

	describe("updateDocTypeSchema", () => {
		it("accepts sortOrder update", () => {
			const result = updateDocTypeSchema.safeParse({ sortOrder: 3 });
			expect(result.success).toBe(true);
		});

		it("accepts null color", () => {
			const result = updateDocTypeSchema.safeParse({ color: null });
			expect(result.success).toBe(true);
		});
	});
});
