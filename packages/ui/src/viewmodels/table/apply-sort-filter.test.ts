import type { CustomFieldDefinition, Person, PersonTableView } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import { buildGrid } from "./apply-sort-filter.js";

function person(partial: Partial<Person> & { id: string; name: string }): Person {
	return {
		workspaceId: "ws",
		title: "",
		managerId: null,
		dottedManagerId: null,
		avatarUrl: null,
		isRoot: false,
		sortOrder: 0,
		createdAt: "2026-07-17T12:00:00.000Z",
		updatedAt: "2026-07-17T12:00:00.000Z",
		tags: [],
		...partial,
	};
}

const viewBase: PersonTableView = {
	id: "v1",
	workspaceId: "ws",
	name: "All People",
	columns: ["builtin:name", "builtin:title"],
	sort: null,
	filters: [],
	isDefault: true,
	sortOrder: 0,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};

describe("buildGrid", () => {
	it("defaults to name ASC", () => {
		const persons = [person({ id: "b", name: "Bob" }), person({ id: "a", name: "Alice" })];
		const grid = buildGrid(viewBase, persons, [], []);
		expect(grid.rows.map((r) => r.person.name)).toEqual(["Alice", "Bob"]);
		expect(grid.total).toBe(2);
	});

	it("sorts by column and filters with contains", () => {
		const persons = [
			person({ id: "a", name: "Alice", title: "Engineer" }),
			person({ id: "b", name: "Bob", title: "PM" }),
		];
		const view: PersonTableView = {
			...viewBase,
			sort: { key: "builtin:title", direction: "desc" },
			filters: [{ key: "builtin:title", op: "contains", value: "eng" }],
		};
		const grid = buildGrid(view, persons, [], []);
		expect(grid.filteredCount).toBe(1);
		expect(grid.rows[0]?.person.name).toBe("Alice");
	});

	it("sorts manager by resolved name", () => {
		const boss = person({ id: "boss", name: "Zed", isRoot: true });
		const other = person({ id: "m2", name: "Ann", isRoot: true });
		const p1 = person({ id: "c1", name: "Child1", managerId: "boss" });
		const p2 = person({ id: "c2", name: "Child2", managerId: "m2" });
		const view: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:managerId"],
			sort: { key: "builtin:managerId", direction: "asc" },
		};
		const grid = buildGrid(view, [boss, other, p1, p2], [], []);
		// empty managers (boss/other root) sink to bottom; among children Ann before Zed
		const named = grid.rows.filter((r) => r.cells["builtin:managerId"]?.raw);
		expect(named.map((r) => r.cells["builtin:managerId"]?.display)).toEqual(["Ann", "Zed"]);
	});

	it("applies defaultValue in cells", () => {
		const def: CustomFieldDefinition = {
			id: "019a0000-0000-7000-8000-0000000000f1",
			workspaceId: "ws",
			name: "Level",
			fieldType: "text",
			options: null,
			sortOrder: 0,
			required: false,
			defaultValue: "L3",
			showOnChart: false,
			createdAt: "2026-01-01T00:00:00Z",
		};
		const key = `field:${def.id}` as const;
		const view: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
		};
		const grid = buildGrid(view, [person({ id: "a", name: "A" })], [def], []);
		expect(grid.rows[0]?.cells[key]?.isDefault).toBe(true);
		expect(grid.rows[0]?.cells[key]?.display).toBe("L3");
	});

	it("filters createdAt by UTC day", () => {
		const p = person({
			id: "a",
			name: "A",
			createdAt: "2026-07-17T23:00:00.000Z",
		});
		const view: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:createdAt"],
			filters: [{ key: "builtin:createdAt", op: "eq", value: "2026-07-17" }],
		};
		const grid = buildGrid(view, [p], [], []);
		expect(grid.filteredCount).toBe(1);
	});

	it("skips empty string eq semantics via is_empty only path", () => {
		const persons = [person({ id: "a", name: "Alice", title: "" })];
		const view: PersonTableView = {
			...viewBase,
			filters: [{ key: "builtin:title", op: "is_empty" }],
		};
		const grid = buildGrid(view, persons, [], []);
		expect(grid.filteredCount).toBe(1);
	});

	it("sorts numbers and booleans; skips stale sort", () => {
		const fieldId = "019a0000-0000-7000-8000-0000000000a1";
		const key = `field:${fieldId}` as const;
		const def: CustomFieldDefinition = {
			id: fieldId,
			workspaceId: "ws",
			name: "N",
			fieldType: "number",
			options: null,
			sortOrder: 0,
			required: false,
			defaultValue: null,
			showOnChart: false,
			createdAt: "2026-01-01T00:00:00Z",
		};
		const persons = [
			person({ id: "a", name: "A", isRoot: false }),
			person({ id: "b", name: "B", isRoot: true }),
		];
		const values = [
			{
				id: "1",
				workspaceId: "ws",
				personId: "a",
				fieldDefId: fieldId,
				value: "10",
			},
			{
				id: "2",
				workspaceId: "ws",
				personId: "b",
				fieldDefId: fieldId,
				value: "2",
			},
		];
		const view: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
			sort: { key, direction: "asc" },
		};
		const grid = buildGrid(view, persons, [def], values);
		expect(grid.rows.map((r) => r.person.id)).toEqual(["b", "a"]);

		const stale: PersonTableView = {
			...viewBase,
			columns: ["builtin:name"],
			sort: { key: "field:019a0000-0000-7000-8000-0000000000de", direction: "asc" },
		};
		const g2 = buildGrid(stale, persons, [], []);
		expect(g2.skippedSort).toBe(true);

		const boolView: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:isRoot"],
			sort: { key: "builtin:isRoot", direction: "desc" },
		};
		const g3 = buildGrid(boolView, persons, [], []);
		expect(g3.rows[0]?.person.isRoot).toBe(true);
	});

	it("filters neq/contains/date ops and tag in", () => {
		const persons = [
			person({
				id: "a",
				name: "Alice",
				title: "Engineer",
				tags: [{ id: "t1", name: "X", color: null }],
			}),
			person({ id: "b", name: "Bob", title: "PM", tags: [] }),
		];
		const v1: PersonTableView = {
			...viewBase,
			filters: [{ key: "builtin:name", op: "neq", value: "Alice" }],
		};
		expect(buildGrid(v1, persons, [], []).rows.map((r) => r.person.id)).toEqual(["b"]);

		const v2: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:tags"],
			filters: [{ key: "builtin:tags", op: "in", value: ["t1"] }],
		};
		expect(buildGrid(v2, persons, [], []).filteredCount).toBe(1);

		const v3: PersonTableView = {
			...viewBase,
			filters: [{ key: "builtin:title", op: "not_contains", value: "eng" }],
		};
		expect(buildGrid(v3, persons, [], []).rows[0]?.person.id).toBe("b");

		const v4: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:createdAt"],
			filters: [
				{ key: "builtin:createdAt", op: "gte", value: "2026-07-01" },
				{ key: "builtin:createdAt", op: "lte", value: "2026-07-31" },
			],
		};
		expect(buildGrid(v4, persons, [], []).filteredCount).toBe(2);

		const v5: PersonTableView = {
			...viewBase,
			filters: [{ key: "builtin:name", op: "eq", value: "alice" }],
		};
		expect(buildGrid(v5, persons, [], []).filteredCount).toBe(1);

		const v6: PersonTableView = {
			...viewBase,
			filters: [{ key: "field:019a0000-0000-7000-8000-0000000000de", op: "eq", value: "x" }],
		};
		const g6 = buildGrid(v6, persons, [], []);
		expect(g6.skippedFilters).toBeGreaterThan(0);
	});

	it("filters number and person-ref and is_not_empty", () => {
		const fieldId = "019a0000-0000-7000-8000-0000000000b2";
		const key = `field:${fieldId}` as const;
		const def: CustomFieldDefinition = {
			id: fieldId,
			workspaceId: "ws",
			name: "N",
			fieldType: "number",
			options: null,
			sortOrder: 0,
			required: false,
			defaultValue: null,
			showOnChart: false,
			createdAt: "2026-01-01T00:00:00Z",
		};
		const boss = person({ id: "boss", name: "Boss", isRoot: true });
		const a = person({ id: "a", name: "A", managerId: "boss", title: "Has" });
		const b = person({ id: "b", name: "B", title: "" });
		const values = [
			{ id: "1", workspaceId: "ws", personId: "a", fieldDefId: fieldId, value: "5" },
			{ id: "2", workspaceId: "ws", personId: "b", fieldDefId: fieldId, value: "15" },
		];
		const vNum: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
			filters: [{ key, op: "gt", value: "10" }],
		};
		expect(buildGrid(vNum, [a, b], [def], values).rows.map((r) => r.person.id)).toEqual(["b"]);

		const vRef: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:managerId"],
			filters: [{ key: "builtin:managerId", op: "eq", value: "boss" }],
		};
		// person-ref eq matches person id
		expect(buildGrid(vRef, [boss, a, b], [], []).filteredCount).toBe(1);

		const vRefByName: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:managerId"],
			filters: [{ key: "builtin:managerId", op: "eq", value: "Boss" }],
		};
		// person-ref eq also matches resolved display name (case-insensitive)
		expect(buildGrid(vRefByName, [boss, a, b], [], []).filteredCount).toBe(1);

		const vRefContains: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:managerId"],
			filters: [{ key: "builtin:managerId", op: "contains", value: "bos" }],
		};
		expect(buildGrid(vRefContains, [boss, a, b], [], []).filteredCount).toBe(1);

		const vRefNotContains: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:managerId"],
			filters: [{ key: "builtin:managerId", op: "not_contains", value: "boss" }],
		};
		// only rows with a manager name that does not contain "boss"
		expect(buildGrid(vRefNotContains, [boss, a, b], [], []).filteredCount).toBe(0);

		const vRefInByName: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:managerId"],
			filters: [{ key: "builtin:managerId", op: "in", value: ["Boss"] }],
		};
		expect(buildGrid(vRefInByName, [boss, a, b], [], []).filteredCount).toBe(1);

		const vEmpty: PersonTableView = {
			...viewBase,
			filters: [{ key: "builtin:title", op: "is_not_empty" }],
		};
		expect(buildGrid(vEmpty, [a, b], [], []).rows.map((r) => r.person.id)).toEqual(["a"]);

		const vRefIn: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:managerId"],
			filters: [{ key: "builtin:managerId", op: "in", value: ["boss"] }],
		};
		expect(buildGrid(vRefIn, [boss, a, b], [], []).filteredCount).toBe(1);

		const vNumOps: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
			filters: [{ key, op: "lte", value: "5" }],
		};
		expect(buildGrid(vNumOps, [a, b], [def], values).rows.map((r) => r.person.id)).toEqual(["a"]);

		const vNumEq: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
			filters: [{ key, op: "eq", value: "15" }],
		};
		expect(buildGrid(vNumEq, [a, b], [def], values).filteredCount).toBe(1);

		const vNumNeq: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
			filters: [{ key, op: "neq", value: "5" }],
		};
		expect(buildGrid(vNumNeq, [a, b], [def], values).rows[0]?.person.id).toBe("b");

		const vBool: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:isRoot"],
			filters: [{ key: "builtin:isRoot", op: "eq", value: "true" }],
		};
		expect(buildGrid(vBool, [boss, a], [], []).rows.map((r) => r.person.id)).toEqual(["boss"]);

		const vDayNeq: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:createdAt"],
			filters: [{ key: "builtin:createdAt", op: "neq", value: "2020-01-01" }],
		};
		expect(buildGrid(vDayNeq, [a], [], []).filteredCount).toBe(1);

		const vDayGt: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:createdAt"],
			filters: [{ key: "builtin:createdAt", op: "gt", value: "2020-01-01" }],
		};
		expect(buildGrid(vDayGt, [a], [], []).filteredCount).toBe(1);

		const selectId = "019a0000-0000-7000-8000-0000000000c3";
		const selectKey = `field:${selectId}` as const;
		const selectDef: CustomFieldDefinition = {
			id: selectId,
			workspaceId: "ws",
			name: "S",
			fieldType: "select",
			options: ["A", "B"],
			sortOrder: 0,
			required: false,
			defaultValue: null,
			showOnChart: false,
			createdAt: "2026-01-01T00:00:00Z",
		};
		const selectVals = [
			{ id: "s1", workspaceId: "ws", personId: "a", fieldDefId: selectId, value: "A" },
			{ id: "s2", workspaceId: "ws", personId: "b", fieldDefId: selectId, value: "B" },
		];
		const vSel: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", selectKey],
			filters: [{ key: selectKey, op: "in", value: ["A"] }],
		};
		expect(buildGrid(vSel, [a, b], [selectDef], selectVals).rows.map((r) => r.person.id)).toEqual([
			"a",
		]);

		const vSelEq: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", selectKey],
			filters: [{ key: selectKey, op: "eq", value: "B" }],
		};
		expect(buildGrid(vSelEq, [a, b], [selectDef], selectVals).filteredCount).toBe(1);

		// desc sort by name
		const vDesc: PersonTableView = {
			...viewBase,
			sort: { key: "builtin:name", direction: "desc" },
		};
		expect(buildGrid(vDesc, [a, b], [], []).rows.map((r) => r.person.name)).toEqual(["B", "A"]);

		const dateId = "019a0000-0000-7000-8000-0000000000d4";
		const dateKey = `field:${dateId}` as const;
		const dateDef: CustomFieldDefinition = {
			id: dateId,
			workspaceId: "ws",
			name: "D",
			fieldType: "date",
			options: null,
			sortOrder: 0,
			required: false,
			defaultValue: null,
			showOnChart: false,
			createdAt: "2026-01-01T00:00:00Z",
		};
		const dateVals = [
			{ id: "d1", workspaceId: "ws", personId: "a", fieldDefId: dateId, value: "2026-01-10" },
			{ id: "d2", workspaceId: "ws", personId: "b", fieldDefId: dateId, value: "2026-02-01" },
		];
		const vDate: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", dateKey],
			filters: [{ key: dateKey, op: "lt", value: "2026-01-15" }],
			sort: { key: dateKey, direction: "desc" },
		};
		const gDate = buildGrid(vDate, [a, b], [dateDef], dateVals);
		expect(gDate.filteredCount).toBe(1);
		expect(gDate.rows[0]?.person.id).toBe("a");

		// empty title neq should not match empty cells
		const vNeqEmpty: PersonTableView = {
			...viewBase,
			filters: [{ key: "builtin:title", op: "neq", value: "x" }],
		};
		const emptyTitle = person({ id: "e", name: "E", title: "" });
		expect(buildGrid(vNeqEmpty, [emptyTitle], [], []).filteredCount).toBe(0);

		// tags is_empty / is_not_empty
		const tagged = person({
			id: "t",
			name: "Tagged",
			tags: [{ id: "t1", name: "X", color: null }],
		});
		const vTagsEmpty: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:tags"],
			filters: [{ key: "builtin:tags", op: "is_empty" }],
		};
		expect(buildGrid(vTagsEmpty, [tagged, b], [], []).rows.every((r) => r.person.id !== "t")).toBe(
			true,
		);
		const vTagsNotEmpty: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:tags"],
			filters: [{ key: "builtin:tags", op: "is_not_empty" }],
		};
		expect(buildGrid(vTagsNotEmpty, [tagged, b], [], []).rows.map((r) => r.person.id)).toEqual([
			"t",
		]);

		// stale field still listed in columns → filter skipped
		const staleKey = "field:019a0000-0000-7000-8000-0000000000de" as const;
		const vStaleCol: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", staleKey],
			filters: [{ key: staleKey, op: "eq", value: "x" }],
		};
		const gStale = buildGrid(vStaleCol, [a], [], []);
		expect(gStale.skippedFilters).toBe(1);
		expect(gStale.filteredCount).toBe(1);

		// name-sort tie-break by id
		const twin1 = person({ id: "z", name: "Same" });
		const twin2 = person({ id: "y", name: "Same" });
		const vTie: PersonTableView = { ...viewBase, sort: null };
		expect(buildGrid(vTie, [twin1, twin2], [], []).rows.map((r) => r.person.id)).toEqual([
			"y",
			"z",
		]);

		// unsortable sort key (tags)
		const vUnsort: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:tags"],
			sort: { key: "builtin:tags", direction: "asc" },
		};
		expect(buildGrid(vUnsort, [a], [], []).skippedSort).toBe(true);

		// boolean neq
		const vBoolNeq: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:isRoot"],
			filters: [{ key: "builtin:isRoot", op: "neq", value: "true" }],
		};
		expect(buildGrid(vBoolNeq, [boss, a], [], []).rows.every((r) => !r.person.isRoot)).toBe(true);

		// person-ref neq
		const vRefNeq: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:managerId"],
			filters: [{ key: "builtin:managerId", op: "neq", value: "boss" }],
		};
		// empty manager cells don't match neq
		expect(buildGrid(vRefNeq, [boss, a], [], []).filteredCount).toBe(0);

		// number gte/lt
		const vGte: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
			filters: [{ key, op: "gte", value: "15" }],
		};
		expect(buildGrid(vGte, [a, b], [def], values).rows.map((r) => r.person.id)).toEqual(["b"]);
		const vLt: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
			filters: [{ key, op: "lt", value: "10" }],
		};
		expect(buildGrid(vLt, [a, b], [def], values).rows.map((r) => r.person.id)).toEqual(["a"]);

		// date field comparison ops (non-day ISO fields use string compare)
		const vDateGte: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", dateKey],
			filters: [{ key: dateKey, op: "gte", value: "2026-02-01" }],
		};
		expect(buildGrid(vDateGte, [a, b], [dateDef], dateVals).rows.map((r) => r.person.id)).toEqual([
			"b",
		]);
		const vDateGt: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", dateKey],
			filters: [{ key: dateKey, op: "gt", value: "2026-01-10" }],
		};
		expect(buildGrid(vDateGt, [a, b], [dateDef], dateVals).filteredCount).toBe(1);
		const vDateLte: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", dateKey],
			filters: [{ key: dateKey, op: "lte", value: "2026-01-10" }],
		};
		expect(buildGrid(vDateLte, [a, b], [dateDef], dateVals).rows[0]?.person.id).toBe("a");
		const vSelNeq: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", selectKey],
			filters: [{ key: selectKey, op: "neq", value: "A" }],
		};
		expect(buildGrid(vSelNeq, [a, b], [selectDef], selectVals).rows[0]?.person.id).toBe("b");

		// day lt
		const vDayLt: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", "builtin:createdAt"],
			filters: [{ key: "builtin:createdAt", op: "lt", value: "2099-01-01" }],
		};
		expect(buildGrid(vDayLt, [a], [], []).filteredCount).toBe(1);

		// illegal op for current kind (e.g. text→number type change left contains) → skip
		const vStaleOp: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", key],
			filters: [{ key, op: "contains", value: "1" }],
		};
		const gIllegalOp = buildGrid(vStaleOp, [a, b], [def], values);
		expect(gIllegalOp.skippedFilters).toBe(1);
		expect(gIllegalOp.filteredCount).toBe(2);

		// select `in` with padded values matches stored option
		const vSelInPad: PersonTableView = {
			...viewBase,
			columns: ["builtin:name", selectKey],
			filters: [{ key: selectKey, op: "in", value: [" A "] }],
		};
		expect(
			buildGrid(vSelInPad, [a, b], [selectDef], selectVals).rows.map((r) => r.person.id),
		).toEqual(["a"]);
	});
});
