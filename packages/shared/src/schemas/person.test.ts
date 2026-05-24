import { describe, expect, it } from "vitest";
import { createPersonSchema, movePersonSchema, updatePersonSchema } from "./person.js";

describe("person schemas", () => {
	describe("createPersonSchema", () => {
		it("accepts valid root person (null managerId)", () => {
			const result = createPersonSchema.safeParse({
				name: "CEO",
				managerId: null,
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.title).toBe("");
			}
		});

		it("accepts valid child person with manager", () => {
			const result = createPersonSchema.safeParse({
				name: "Engineer",
				title: "Staff Engineer",
				managerId: "550e8400-e29b-41d4-a716-446655440000",
			});
			expect(result.success).toBe(true);
		});

		it("rejects empty name", () => {
			const result = createPersonSchema.safeParse({
				name: "",
				managerId: null,
			});
			expect(result.success).toBe(false);
		});

		it("rejects invalid UUID for managerId", () => {
			const result = createPersonSchema.safeParse({
				name: "Test",
				managerId: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});

		it("accepts optional dottedManagerId", () => {
			const result = createPersonSchema.safeParse({
				name: "Test",
				managerId: "550e8400-e29b-41d4-a716-446655440000",
				dottedManagerId: "660e8400-e29b-41d4-a716-446655440000",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("updatePersonSchema", () => {
		it("accepts partial updates", () => {
			const result = updatePersonSchema.safeParse({ title: "Senior" });
			expect(result.success).toBe(true);
		});

		it("accepts empty object", () => {
			const result = updatePersonSchema.safeParse({});
			expect(result.success).toBe(true);
		});
	});

	describe("movePersonSchema", () => {
		it("accepts valid managerId", () => {
			const result = movePersonSchema.safeParse({
				managerId: "550e8400-e29b-41d4-a716-446655440000",
			});
			expect(result.success).toBe(true);
		});

		it("accepts null managerId (promote to root)", () => {
			const result = movePersonSchema.safeParse({ managerId: null });
			expect(result.success).toBe(true);
		});
	});
});
