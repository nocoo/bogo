import { describe, expect, it } from "vitest";
import {
	type FieldDefMeta,
	filterKindOf,
	isSortableResolved,
	isStaleColumn,
	parseColumnsJson,
	parseFiltersJson,
	parseSortJson,
	resolveColumn,
	stripRemovedColumnRefs,
	validateColumnsStructure,
	validateFilterAgainstColumn,
	validateNewFieldKeys,
	validateSortAgainstColumns,
} from "./table-view-logic.js";

const FIELD_ID = "019a0000-0000-7000-8000-0000000000aa";
const FIELD_KEY = `field:${FIELD_ID}`;
const PERSON_ID = "019a0000-0000-7000-8000-0000000000bb";

function defsMap(entries: FieldDefMeta[] = []): Map<string, FieldDefMeta> {
	const m = new Map<string, FieldDefMeta>();
	for (const e of entries) m.set(e.id, e);
	return m;
}

describe("table-view-logic", () => {
	it("validateColumnsStructure requires name and uniqueness", () => {
		expect(validateColumnsStructure(["builtin:title"])).not.toBeNull();
		expect(validateColumnsStructure(["builtin:name", "builtin:name"])).not.toBeNull();
		expect(validateColumnsStructure(["builtin:name", "builtin:title"])).toBeNull();
	});

	it("validateNewFieldKeys allows retained stale, rejects new unknown", () => {
		const defs = defsMap([]);
		expect(validateNewFieldKeys([FIELD_KEY, "builtin:name"], null, defs)).not.toBeNull();
		expect(
			validateNewFieldKeys([FIELD_KEY, "builtin:name"], [FIELD_KEY, "builtin:name"], defs),
		).toBeNull();
		const withDef = defsMap([{ id: FIELD_ID, fieldType: "text", options: null }]);
		expect(validateNewFieldKeys([FIELD_KEY, "builtin:name"], null, withDef)).toBeNull();
		expect(validateNewFieldKeys(["builtin:name"], null, defs)).toBeNull();
	});

	it("validateSortAgainstColumns covers null, not-in-columns, stale, unsortable, ok", () => {
		const cols = ["builtin:name", "builtin:tags", FIELD_KEY, "builtin:avatarUrl"];
		const empty = defsMap();
		expect(validateSortAgainstColumns(null, cols, empty)).toBeNull();
		expect(
			validateSortAgainstColumns({ key: "builtin:title", direction: "asc" }, cols, empty),
		).not.toBeNull();
		expect(
			validateSortAgainstColumns({ key: "builtin:name", direction: "asc" }, cols, empty),
		).toBeNull();
		expect(
			validateSortAgainstColumns({ key: "builtin:tags", direction: "asc" }, cols, empty),
		).not.toBeNull();
		expect(
			validateSortAgainstColumns({ key: "builtin:avatarUrl", direction: "asc" }, cols, empty),
		).not.toBeNull();
		expect(
			validateSortAgainstColumns({ key: FIELD_KEY, direction: "asc" }, cols, empty),
		).not.toBeNull();
		const withDef = defsMap([{ id: FIELD_ID, fieldType: "text", options: null }]);
		expect(
			validateSortAgainstColumns({ key: FIELD_KEY, direction: "desc" }, cols, withDef),
		).toBeNull();
	});

	it("validateFilterAgainstColumn enforces wire shape and types", () => {
		const selectId = "019a0000-0000-7000-8000-0000000000cc";
		const selectKey = `field:${selectId}`;
		const cols = [
			"builtin:name",
			"builtin:createdAt",
			"builtin:isRoot",
			"builtin:managerId",
			"builtin:tags",
			"builtin:avatarUrl",
			FIELD_KEY,
			selectKey,
		];
		const defs = defsMap([
			{ id: FIELD_ID, fieldType: "number", options: null },
			{ id: selectId, fieldType: "select", options: ["A", "B"] },
		]);

		expect(
			validateFilterAgainstColumn({ key: "builtin:name", op: "eq", value: "Alice" }, cols, defs),
		).toBeNull();
		expect(
			validateFilterAgainstColumn({ key: "builtin:name", op: "eq", value: "" }, cols, defs),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn({ key: "builtin:name", op: "is_empty" }, cols, defs),
		).toBeNull();
		expect(
			validateFilterAgainstColumn({ key: "builtin:name", op: "is_empty", value: "x" }, cols, defs),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn(
				{ key: "builtin:createdAt", op: "eq", value: "2026-07-17" },
				cols,
				defs,
			),
		).toBeNull();
		expect(
			validateFilterAgainstColumn(
				{ key: "builtin:createdAt", op: "eq", value: "2026-13-01" },
				cols,
				defs,
			),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn({ key: "builtin:isRoot", op: "eq", value: "true" }, cols, defs),
		).toBeNull();
		expect(
			validateFilterAgainstColumn({ key: "builtin:isRoot", op: "eq", value: "yes" }, cols, defs),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn(
				{ key: "builtin:managerId", op: "eq", value: PERSON_ID },
				cols,
				defs,
			),
		).toBeNull();
		expect(
			validateFilterAgainstColumn(
				{ key: "builtin:managerId", op: "in", value: [PERSON_ID] },
				cols,
				defs,
			),
		).toBeNull();
		expect(
			validateFilterAgainstColumn(
				{ key: "builtin:managerId", op: "in", value: ["nope"] },
				cols,
				defs,
			),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn(
				{ key: "builtin:tags", op: "in", value: [PERSON_ID] },
				cols,
				defs,
			),
		).toBeNull();
		expect(
			validateFilterAgainstColumn({ key: "builtin:tags", op: "eq", value: "x" }, cols, defs),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn({ key: "builtin:avatarUrl", op: "eq", value: "x" }, cols, defs),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn({ key: FIELD_KEY, op: "eq", value: "12abc" }, cols, defs),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn({ key: FIELD_KEY, op: "eq", value: "12" }, cols, defs),
		).toBeNull();
		expect(
			validateFilterAgainstColumn({ key: selectKey, op: "eq", value: "A" }, cols, defs),
		).toBeNull();
		expect(
			validateFilterAgainstColumn({ key: selectKey, op: "eq", value: "Z" }, cols, defs),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn({ key: selectKey, op: "in", value: ["A"] }, cols, defs),
		).toBeNull();
		expect(
			validateFilterAgainstColumn({ key: selectKey, op: "in", value: ["Z"] }, cols, defs),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn({ key: "builtin:title", op: "eq", value: "x" }, cols, defs),
		).not.toBeNull();
		const staleKey = "field:019a0000-0000-7000-8000-0000000000de";
		expect(
			validateFilterAgainstColumn(
				{ key: staleKey, op: "eq", value: "x" },
				[...cols, staleKey],
				defs,
			),
		).not.toBeNull();
		expect(
			validateFilterAgainstColumn(
				{ key: "builtin:name", op: "in", value: "not-array" as unknown as string[] },
				cols,
				defs,
			),
		).not.toBeNull();
	});

	it("stripRemovedColumnRefs clears sort and filters", () => {
		const r = stripRemovedColumnRefs(["builtin:name"], { key: "builtin:title", direction: "asc" }, [
			{ key: "builtin:title", op: "eq", value: "x" },
			{ key: "builtin:name", op: "is_empty" },
		]);
		expect(r.sort).toBeNull();
		expect(r.filters).toEqual([{ key: "builtin:name", op: "is_empty" }]);
		const keep = stripRemovedColumnRefs(
			["builtin:name", "builtin:title"],
			{ key: "builtin:title", direction: "asc" },
			[{ key: "builtin:title", op: "eq", value: "x" }],
		);
		expect(keep.sort?.key).toBe("builtin:title");
	});

	it("resolveColumn, filterKindOf, isStale, isSortable, parsers", () => {
		const defs = defsMap([
			{ id: FIELD_ID, fieldType: "select", options: ["A"] },
			{ id: "019a0000-0000-7000-8000-0000000000dd", fieldType: "date", options: null },
			{ id: "019a0000-0000-7000-8000-0000000000ee", fieldType: "boolean", options: null },
			{ id: "019a0000-0000-7000-8000-0000000000ff", fieldType: "text", options: null },
		]);
		expect(resolveColumn("builtin:name", defs)).toEqual({ status: "builtin", name: "name" });
		expect(resolveColumn(FIELD_KEY, defs).status).toBe("field");
		expect(resolveColumn(`field:019a0000-0000-7000-8000-0000000000bb`, defs).status).toBe("stale");
		expect(isStaleColumn({ status: "stale", id: "x" })).toBe(true);
		expect(isSortableResolved({ status: "builtin", name: "name" })).toBe(true);
		expect(isSortableResolved({ status: "stale", id: "x" })).toBe(false);
		expect(
			isSortableResolved({ status: "field", id: FIELD_ID, fieldType: "text", options: null }),
		).toBe(true);

		expect(filterKindOf({ status: "builtin", name: "createdAt" })).toBe("date-day");
		expect(filterKindOf({ status: "builtin", name: "updatedAt" })).toBe("date-day");
		expect(filterKindOf({ status: "builtin", name: "tags" })).toBe("tags");
		expect(filterKindOf({ status: "builtin", name: "managerId" })).toBe("person-ref");
		expect(filterKindOf({ status: "builtin", name: "dottedManagerId" })).toBe("person-ref");
		expect(filterKindOf({ status: "builtin", name: "isRoot" })).toBe("boolean");
		expect(filterKindOf({ status: "builtin", name: "avatarUrl" })).toBe("none");
		expect(filterKindOf({ status: "builtin", name: "title" })).toBe("text");
		expect(
			filterKindOf({
				status: "field",
				id: "x",
				fieldType: "date",
				options: null,
			}),
		).toBe("date");
		expect(
			filterKindOf({
				status: "field",
				id: "x",
				fieldType: "boolean",
				options: null,
			}),
		).toBe("boolean");
		expect(
			filterKindOf({
				status: "field",
				id: "x",
				fieldType: "number",
				options: null,
			}),
		).toBe("number");
		expect(filterKindOf({ status: "stale", id: "x" })).toBe("none");

		expect(parseColumnsJson('["builtin:name"]')).toEqual(["builtin:name"]);
		expect(parseSortJson(null)).toBeNull();
		expect(parseSortJson('{"key":"builtin:name","direction":"asc"}')).toEqual({
			key: "builtin:name",
			direction: "asc",
		});
		expect(parseFiltersJson("[]")).toEqual([]);
	});

	it("covers field type date filter and tags value format edge", () => {
		const dateId = "019a0000-0000-7000-8000-0000000000d1";
		const dateKey = `field:${dateId}`;
		const defs = defsMap([{ id: dateId, fieldType: "date", options: null }]);
		const cols = ["builtin:name", dateKey, "builtin:tags"];
		expect(
			validateFilterAgainstColumn({ key: dateKey, op: "eq", value: "2026-01-01" }, cols, defs),
		).toBeNull();
		// tags with eq is rejected at op allow-list before value format
		expect(
			validateFilterAgainstColumn({ key: "builtin:tags", op: "contains", value: "x" }, cols, defs),
		).not.toBeNull();
	});
});
