import type { CustomFieldDefinition } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import type { ColumnMeta } from "./column-catalog.js";
import { validateFilterDraft, validateFilterValue } from "./validate-filter-draft.js";

const nameMeta: ColumnMeta = {
	key: "builtin:name",
	label: "Name",
	sortable: true,
	filterable: true,
	kind: "text",
};
const numKey = "field:019a0000-0000-7000-8000-0000000000n1" as const;
const numMeta: ColumnMeta = {
	key: numKey,
	label: "Score",
	sortable: true,
	filterable: true,
	kind: "number",
};
const numDef: CustomFieldDefinition = {
	id: "019a0000-0000-7000-8000-0000000000n1",
	workspaceId: "ws",
	name: "Score",
	fieldType: "number",
	options: null,
	sortOrder: 0,
	required: false,
	defaultValue: null,
	showOnChart: false,
	createdAt: "2026-01-01T00:00:00Z",
};

describe("validateFilterValue", () => {
	it("rejects non-numeric eq on number columns", () => {
		expect(validateFilterValue({ key: numKey, op: "eq", value: "abc" }, numMeta, numDef)).toMatch(
			/finite number/,
		);
		expect(validateFilterValue({ key: numKey, op: "eq", value: "12" }, numMeta, numDef)).toBeNull();
	});

	it("rejects is_empty with non-null value via wire shape", () => {
		expect(
			validateFilterValue(
				{ key: "builtin:title", op: "is_empty", value: "garbage" },
				{
					key: "builtin:title",
					label: "Title",
					sortable: true,
					filterable: true,
					kind: "text",
				},
				undefined,
			),
		).toMatch(/omit value|null/i);
		expect(
			validateFilterValue(
				{ key: "builtin:title", op: "is_empty", value: null },
				{
					key: "builtin:title",
					label: "Title",
					sortable: true,
					filterable: true,
					kind: "text",
				},
				undefined,
			),
		).toBeNull();
	});
});

describe("validateFilterDraft", () => {
	it("accepts valid text filter", () => {
		expect(
			validateFilterDraft([{ key: "builtin:name", op: "contains", value: "a" }], [nameMeta], []),
		).toBeNull();
	});

	it("rejects empty value and bad number", () => {
		expect(
			validateFilterDraft([{ key: "builtin:name", op: "eq", value: "  " }], [nameMeta], []),
		).toMatch(/non-empty|required/i);
		expect(
			validateFilterDraft([{ key: numKey, op: "eq", value: "nope" }], [numMeta], [numDef]),
		).toMatch(/number/i);
	});

	it("rejects illegal op for kind", () => {
		expect(
			validateFilterDraft([{ key: numKey, op: "contains", value: "1" }], [numMeta], [numDef]),
		).toMatch(/not allowed/i);
	});

	it("validates date, boolean, select, and in arrays", () => {
		const dateKey = "field:019a0000-0000-7000-8000-0000000000d1" as const;
		const dateMeta: ColumnMeta = {
			key: dateKey,
			label: "When",
			sortable: true,
			filterable: true,
			kind: "date",
		};
		const boolMeta: ColumnMeta = {
			key: "builtin:isRoot",
			label: "Root",
			sortable: true,
			filterable: true,
			kind: "boolean",
		};
		const selectId = "019a0000-0000-7000-8000-0000000000bb";
		const selectKey = `field:${selectId}` as const;
		const selectMeta: ColumnMeta = {
			key: selectKey,
			label: "Lvl",
			sortable: true,
			filterable: true,
			kind: "select",
		};
		const selectDef: CustomFieldDefinition = {
			...numDef,
			id: selectId,
			name: "Lvl",
			fieldType: "select",
			options: ["A", "B"],
		};
		const tagsMeta: ColumnMeta = {
			key: "builtin:tags",
			label: "Tags",
			sortable: false,
			filterable: true,
			kind: "tags",
		};

		expect(
			validateFilterDraft([{ key: dateKey, op: "eq", value: "2026-13-01" }], [dateMeta], []),
		).toMatch(/YYYY-MM-DD/);
		expect(
			validateFilterDraft([{ key: "builtin:isRoot", op: "eq", value: "yes" }], [boolMeta], []),
		).toMatch(/Yes or No/);
		expect(
			validateFilterDraft([{ key: selectKey, op: "eq", value: "Z" }], [selectMeta], [selectDef]),
		).toMatch(/option/i);
		expect(
			validateFilterDraft([{ key: selectKey, op: "in", value: [] }], [selectMeta], [selectDef]),
		).toMatch(/non-empty|at least one/i);
		expect(
			validateFilterDraft(
				[{ key: "builtin:tags", op: "in", value: ["not-a-uuid"] }],
				[tagsMeta],
				[],
			),
		).toMatch(/tag ids/i);
		expect(
			validateFilterDraft([{ key: selectKey, op: "in", value: ["A"] }], [selectMeta], [selectDef]),
		).toBeNull();
		expect(
			validateFilterDraft([{ key: selectKey, op: "in", value: ["Z"] }], [selectMeta], [selectDef]),
		).toMatch(/not a valid option/);
		expect(validateFilterDraft([{ key: "missing", op: "eq", value: "x" }], [nameMeta], [])).toMatch(
			/Unknown column/,
		);
		const unfilterable: ColumnMeta = {
			key: "builtin:avatarUrl",
			label: "Avatar",
			sortable: false,
			filterable: false,
			kind: "avatar",
		};
		expect(
			validateFilterDraft([{ key: "builtin:avatarUrl", op: "eq", value: "x" }], [unfilterable], []),
		).toMatch(/not filterable/);
	});
});
