import { describe, expect, it } from "vitest";
import { createFieldDefSchema, setFieldValueSchema, updateFieldDefSchema } from "./custom-field.js";

describe("custom field schemas", () => {
	describe("createFieldDefSchema", () => {
		it("accepts text field", () => {
			const result = createFieldDefSchema.safeParse({
				name: "Department",
				fieldType: "text",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.required).toBe(false);
			}
		});

		it("accepts select field with options", () => {
			const result = createFieldDefSchema.safeParse({
				name: "Location",
				fieldType: "select",
				options: ["Remote", "NYC", "SF"],
				required: true,
			});
			expect(result.success).toBe(true);
		});

		it("rejects invalid field type", () => {
			const result = createFieldDefSchema.safeParse({
				name: "Test",
				fieldType: "invalid",
			});
			expect(result.success).toBe(false);
		});

		it("accepts all valid field types", () => {
			for (const ft of ["text", "number", "date", "select", "boolean"]) {
				const result = createFieldDefSchema.safeParse({
					name: "Test",
					fieldType: ft,
				});
				expect(result.success).toBe(true);
			}
		});
	});

	describe("updateFieldDefSchema", () => {
		it("accepts partial update", () => {
			const result = updateFieldDefSchema.safeParse({ name: "New Name" });
			expect(result.success).toBe(true);
		});

		it("accepts sortOrder", () => {
			const result = updateFieldDefSchema.safeParse({ sortOrder: 5 });
			expect(result.success).toBe(true);
		});

		it("rejects negative sortOrder", () => {
			const result = updateFieldDefSchema.safeParse({ sortOrder: -1 });
			expect(result.success).toBe(false);
		});
	});

	describe("setFieldValueSchema", () => {
		it("accepts string value", () => {
			const result = setFieldValueSchema.safeParse({ value: "Engineering" });
			expect(result.success).toBe(true);
		});
	});
});
