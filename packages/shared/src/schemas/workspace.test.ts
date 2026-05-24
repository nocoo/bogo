import { describe, expect, it } from "vitest";
import { createWorkspaceSchema, updateWorkspaceSchema } from "./workspace.js";

describe("workspace schemas", () => {
	describe("createWorkspaceSchema", () => {
		it("accepts valid input", () => {
			const result = createWorkspaceSchema.safeParse({ name: "My Workspace" });
			expect(result.success).toBe(true);
		});

		it("rejects empty name", () => {
			const result = createWorkspaceSchema.safeParse({ name: "" });
			expect(result.success).toBe(false);
		});

		it("rejects name over 200 chars", () => {
			const result = createWorkspaceSchema.safeParse({ name: "a".repeat(201) });
			expect(result.success).toBe(false);
		});
	});

	describe("updateWorkspaceSchema", () => {
		it("accepts valid name", () => {
			const result = updateWorkspaceSchema.safeParse({ name: "Renamed" });
			expect(result.success).toBe(true);
		});
	});
});
