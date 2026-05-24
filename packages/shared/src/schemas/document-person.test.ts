import { describe, expect, it } from "vitest";
import { addDocPersonSchema } from "./document-person.js";

describe("document-person schemas", () => {
	describe("addDocPersonSchema", () => {
		it("accepts valid personId with default role", () => {
			const result = addDocPersonSchema.safeParse({
				personId: "550e8400-e29b-41d4-a716-446655440000",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.role).toBe("subject");
			}
		});

		it("accepts custom role", () => {
			const result = addDocPersonSchema.safeParse({
				personId: "550e8400-e29b-41d4-a716-446655440000",
				role: "reviewer",
			});
			expect(result.success).toBe(true);
		});

		it("rejects invalid UUID", () => {
			const result = addDocPersonSchema.safeParse({
				personId: "not-a-uuid",
			});
			expect(result.success).toBe(false);
		});
	});
});
