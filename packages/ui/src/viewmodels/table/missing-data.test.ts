import type { ColumnKey, CustomFieldDefinition, Person, PersonTableView } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import { buildGrid } from "./apply-sort-filter";
import { nudgeColumn, reorderSelected } from "./column-picker";
import { indexPersons, resolveCell } from "./resolve-cell";

const fieldId = "019a0000-0000-7000-8000-0000000000f1";
const key = `field:${fieldId}` as const;
const definition: CustomFieldDefinition = {
	id: fieldId,
	workspaceId: "ws",
	name: "Value",
	fieldType: "number",
	options: null,
	sortOrder: 0,
	required: false,
	defaultValue: null,
	showOnChart: false,
	createdAt: "2026-01-01",
};
const person: Person = {
	id: "one",
	workspaceId: "ws",
	name: "One",
	title: "",
	managerId: null,
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: false,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	tags: [],
};
const view: PersonTableView = {
	id: "view",
	workspaceId: "ws",
	name: "People",
	columns: ["builtin:name", key],
	sort: { key, direction: "asc" },
	filters: [],
	isDefault: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

describe("table missing and legacy values", () => {
	it("renders empty identities and a missing dotted manager without inventing a reference", () => {
		const blank = { ...person, name: "", dottedManagerId: null };
		const persons = indexPersons([blank]);
		expect(resolveCell(blank, "builtin:name", [], new Map(), persons)).toMatchObject({
			display: "—",
			raw: null,
		});
		expect(resolveCell(blank, "builtin:dottedManagerId", [], new Map(), persons)).toMatchObject({
			display: "—",
			refId: null,
		});
		expect(resolveCell(blank, "invalid" as ColumnKey, [], new Map(), persons).raw).toBeNull();
	});

	it.each(["false", "legacy"])('renders stored boolean value "%s" faithfully', (value) => {
		const result = resolveCell(
			person,
			key,
			[{ ...definition, fieldType: "boolean" }],
			new Map([[`one:${fieldId}`, value]]),
			indexPersons([person]),
		);
		expect(result.display).toBe(value === "false" ? "No" : "legacy");
		expect(result.raw).toBe(value);
	});

	it("retains orphaned stored fields and treats empty defaults as empty", () => {
		const persons = indexPersons([person]);
		expect(resolveCell(person, key, [], new Map([[`one:${fieldId}`, "Legacy"]]), persons)).toEqual({
			display: "Legacy",
			raw: "Legacy",
			isDefault: false,
		});
		expect(
			resolveCell(person, key, [{ ...definition, defaultValue: "" }], new Map(), persons).raw,
		).toBeNull();
	});

	it.each([false, true])(
		"sorts finite numbers before invalid legacy values and blanks (reversed input %s)",
		(reverse) => {
			const people = [
				person,
				{ ...person, id: "two", name: "Two" },
				{ ...person, id: "three", name: "Three" },
				{ ...person, id: "blank", name: "Blank" },
			];
			const values = ["bad", "Infinity", "2"].map((value, i) => ({
				id: String(i),
				workspaceId: "ws",
				personId: people[i].id,
				fieldDefId: fieldId,
				value,
			}));
			const result = buildGrid(view, reverse ? people.reverse() : people, [definition], values);
			expect(result.rows.map((row) => row.person.id)).toEqual(["three", "one", "two", "blank"]);
		},
	);

	it("filters legacy invalid numeric and timestamp values instead of comparing NaN", () => {
		const values = [
			{ id: "v", workspaceId: "ws", personId: "one", fieldDefId: fieldId, value: "bad" },
		];
		expect(
			buildGrid(
				{ ...view, filters: [{ key, op: "gt", value: "0" }] },
				[person],
				[definition],
				values,
			).rows,
		).toEqual([]);
		const invalidDate = { ...person, createdAt: "not-a-date" };
		expect(
			buildGrid(
				{
					...view,
					columns: ["builtin:name", "builtin:createdAt"],
					sort: null,
					filters: [{ key: "builtin:createdAt", op: "eq", value: "2026-01-01" }],
				},
				[invalidDate],
				[],
				[],
			).rows,
		).toEqual([]);
	});

	it.each([false, true])("sorts boolean false and true in either input order (%s)", (reverse) => {
		const people = [person, { ...person, id: "root", isRoot: true }];
		const result = buildGrid(
			{
				...view,
				columns: ["builtin:name", "builtin:isRoot"],
				sort: { key: "builtin:isRoot", direction: "asc" },
			},
			reverse ? people.reverse() : people,
			[],
			[],
		);
		expect(result.rows.map((row) => row.person.id)).toEqual(["one", "root"]);
	});

	it("ties identical empty and explicit sort values deterministically by id", () => {
		const result = buildGrid(
			view,
			[
				{ ...person, id: "z" },
				{ ...person, id: "a" },
			],
			[definition],
			[],
		);
		expect(result.rows.map((row) => row.person.id)).toEqual(["a", "z"]);
	});

	it("ignores a stale custom-field sort even if the missing field is still selected", () => {
		const result = buildGrid(view, [person], [], []);
		expect(result.skippedSort).toBe(true);
		expect(result.rows[0].person.id).toBe("one");
	});

	it("ignores drag and nudge requests for missing columns and preserves no-op identity", () => {
		const keys: ColumnKey[] = ["builtin:name", "builtin:title"];
		expect(reorderSelected(keys, "builtin:tags", 0)).toBe(keys);
		expect(reorderSelected(keys, "builtin:name", 0)).toBe(keys);
		expect(nudgeColumn(keys, "builtin:tags", "left")).toBe(keys);
	});
});
