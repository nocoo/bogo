import type { CustomFieldDefinition } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import { builtinColumnMetas, resolveColumnMeta } from "./column-catalog.js";

describe("column-catalog", () => {
	it("lists builtin metas", () => {
		const metas = builtinColumnMetas();
		expect(metas.some((m) => m.key === "builtin:name")).toBe(true);
		expect(metas.find((m) => m.key === "builtin:tags")?.sortable).toBe(false);
	});

	it("resolves field defs and stale fields", () => {
		const def: CustomFieldDefinition = {
			id: "019a0000-0000-7000-8000-0000000000f1",
			workspaceId: "ws",
			name: "Dept",
			fieldType: "select",
			options: ["A"],
			sortOrder: 0,
			required: false,
			defaultValue: null,
			showOnChart: false,
			createdAt: "2026-01-01T00:00:00Z",
		};
		const meta = resolveColumnMeta(`field:${def.id}`, [def]);
		expect(meta.label).toBe("Dept");
		expect(meta.kind).toBe("select");

		const missing = resolveColumnMeta("field:019a0000-0000-7000-8000-0000000000de", []);
		expect(missing.label).toBe("Missing field");
		expect(missing.sortable).toBe(false);

		expect(resolveColumnMeta("builtin:createdAt", []).kind).toBe("date-day");
		expect(resolveColumnMeta(`field:${def.id}`, [{ ...def, fieldType: "number" }]).kind).toBe(
			"number",
		);
		expect(resolveColumnMeta(`field:${def.id}`, [{ ...def, fieldType: "boolean" }]).kind).toBe(
			"boolean",
		);
		expect(resolveColumnMeta(`field:${def.id}`, [{ ...def, fieldType: "date" }]).kind).toBe("date");
		expect(resolveColumnMeta(`field:${def.id}`, [{ ...def, fieldType: "text" }]).kind).toBe("text");
	});
});
