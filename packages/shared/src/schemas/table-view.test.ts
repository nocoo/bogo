import { describe, expect, it } from "vitest";
import {
	builtinNameFromKey,
	columnKeySchema,
	createPersonTableViewSchema,
	fieldIdFromColumnKey,
	isBuiltinColumnKey,
	isSortableBuiltin,
	isUuidString,
	isValidDateYmd,
	isValidFiniteNumberString,
	updatePersonTableViewSchema,
	validateFilterWireShape,
} from "./table-view.js";

describe("columnKeySchema", () => {
	it("accepts builtin keys", () => {
		expect(columnKeySchema.safeParse("builtin:name").success).toBe(true);
		expect(columnKeySchema.safeParse("builtin:managerId").success).toBe(true);
		expect(columnKeySchema.safeParse("builtin:createdAt").success).toBe(true);
	});

	it("accepts field uuid keys", () => {
		expect(columnKeySchema.safeParse("field:019a0000-0000-7000-8000-000000000001").success).toBe(
			true,
		);
	});

	it("rejects unknown builtin and bad field keys", () => {
		expect(columnKeySchema.safeParse("builtin:sortOrder").success).toBe(false);
		expect(columnKeySchema.safeParse("field:not-a-uuid").success).toBe(false);
		expect(columnKeySchema.safeParse("name").success).toBe(false);
	});
});

describe("createPersonTableViewSchema", () => {
	const base = {
		name: "HR",
		columns: ["builtin:name", "builtin:title"],
	};

	it("accepts minimal create", () => {
		const r = createPersonTableViewSchema.safeParse(base);
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.filters).toBeUndefined();
			expect(r.data.isDefault).toBeUndefined();
			expect(r.data.sort).toBeUndefined();
		}
	});

	it("accepts sort null and filters", () => {
		const r = createPersonTableViewSchema.safeParse({
			...base,
			sort: null,
			filters: [{ key: "builtin:title", op: "contains", value: "eng" }],
			isDefault: true,
		});
		expect(r.success).toBe(true);
	});

	it("rejects empty name or empty columns", () => {
		expect(
			createPersonTableViewSchema.safeParse({ name: "", columns: ["builtin:name"] }).success,
		).toBe(false);
		expect(createPersonTableViewSchema.safeParse({ name: "X", columns: [] }).success).toBe(false);
	});

	it("rejects invalid column key", () => {
		expect(
			createPersonTableViewSchema.safeParse({
				name: "X",
				columns: ["builtin:nope"],
			}).success,
		).toBe(false);
	});
});

describe("updatePersonTableViewSchema", () => {
	it("rejects empty patch", () => {
		const r = updatePersonTableViewSchema.safeParse({});
		expect(r.success).toBe(false);
	});

	it("does not inject filters or isDefault defaults on partial name", () => {
		const r = updatePersonTableViewSchema.safeParse({ name: "Renamed" });
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data).toEqual({ name: "Renamed" });
			expect("filters" in r.data).toBe(false);
			expect("isDefault" in r.data).toBe(false);
			expect("sort" in r.data).toBe(false);
		}
	});

	it("accepts explicit null sort", () => {
		const r = updatePersonTableViewSchema.safeParse({ sort: null });
		expect(r.success).toBe(true);
		if (r.success) {
			expect(r.data.sort).toBeNull();
		}
	});

	it("accepts sortOrder only", () => {
		const r = updatePersonTableViewSchema.safeParse({ sortOrder: 2 });
		expect(r.success).toBe(true);
	});
});

describe("validateFilterWireShape", () => {
	it("requires null/omit for empty ops", () => {
		expect(validateFilterWireShape({ key: "builtin:name", op: "is_empty" })).toBeNull();
		expect(
			validateFilterWireShape({ key: "builtin:name", op: "is_empty", value: null }),
		).toBeNull();
		expect(
			validateFilterWireShape({ key: "builtin:name", op: "is_empty", value: "x" }),
		).not.toBeNull();
	});

	it("requires non-empty string array for in", () => {
		expect(validateFilterWireShape({ key: "builtin:tags", op: "in", value: ["a"] })).toBeNull();
		expect(validateFilterWireShape({ key: "builtin:tags", op: "in", value: [] })).not.toBeNull();
		expect(validateFilterWireShape({ key: "builtin:tags", op: "in", value: "a" })).not.toBeNull();
		expect(
			validateFilterWireShape({ key: "builtin:tags", op: "in", value: ["  "] }),
		).not.toBeNull();
	});

	it("requires non-empty trimmed string for other ops", () => {
		expect(validateFilterWireShape({ key: "builtin:name", op: "eq", value: "Alice" })).toBeNull();
		expect(validateFilterWireShape({ key: "builtin:name", op: "eq", value: "" })).not.toBeNull();
		expect(validateFilterWireShape({ key: "builtin:name", op: "eq", value: "   " })).not.toBeNull();
		expect(
			validateFilterWireShape({ key: "builtin:name", op: "contains", value: "" }),
		).not.toBeNull();
		expect(validateFilterWireShape({ key: "builtin:name", op: "eq", value: ["a"] })).not.toBeNull();
	});
});

describe("number and date helpers", () => {
	it("isValidFiniteNumberString matches fields.ts strictness", () => {
		expect(isValidFiniteNumberString("12")).toBe(true);
		expect(isValidFiniteNumberString("12.5")).toBe(true);
		expect(isValidFiniteNumberString("12abc")).toBe(false);
		expect(isValidFiniteNumberString("")).toBe(false);
		expect(isValidFiniteNumberString("abc")).toBe(false);
		expect(isValidFiniteNumberString("Infinity")).toBe(false);
	});

	it("isValidDateYmd checks calendar", () => {
		expect(isValidDateYmd("2026-07-17")).toBe(true);
		expect(isValidDateYmd("2026-13-40")).toBe(false);
		expect(isValidDateYmd("2026-02-30")).toBe(false);
		expect(isValidDateYmd("2026-7-17")).toBe(false);
	});
});

describe("column key helpers", () => {
	it("isBuiltinColumnKey / builtinNameFromKey", () => {
		expect(isBuiltinColumnKey("builtin:name")).toBe(true);
		expect(isBuiltinColumnKey("field:019a0000-0000-7000-8000-000000000001")).toBe(false);
		expect(builtinNameFromKey("builtin:title")).toBe("title");
		expect(builtinNameFromKey("field:019a0000-0000-7000-8000-000000000001")).toBeNull();
	});

	it("fieldIdFromColumnKey", () => {
		expect(fieldIdFromColumnKey("field:019a0000-0000-7000-8000-000000000001")).toBe(
			"019a0000-0000-7000-8000-000000000001",
		);
		expect(fieldIdFromColumnKey("builtin:name")).toBeNull();
	});

	it("isSortableBuiltin", () => {
		expect(isSortableBuiltin("name")).toBe(true);
		expect(isSortableBuiltin("tags")).toBe(false);
		expect(isSortableBuiltin("avatarUrl")).toBe(false);
	});

	it("isUuidString", () => {
		expect(isUuidString("019a0000-0000-7000-8000-000000000001")).toBe(true);
		expect(isUuidString("not-uuid")).toBe(false);
	});
});
