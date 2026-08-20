import type { CustomFieldDefinition, CustomFieldValue, Person } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import { buildPersonPreview, formatPreviewFieldValue } from "./use-person-preview.js";

const WEI: Person = {
	id: "p-wei",
	workspaceId: "ws-1",
	name: "Wei Chen",
	title: "CEO",
	managerId: null,
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	tags: [{ id: "t-mgr", name: "Manager", color: "#1d4ed8" }],
};

const MINA: Person = {
	id: "p-mina",
	workspaceId: "ws-1",
	name: "Mina Park",
	title: "VP Engineering",
	managerId: "p-wei",
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: false,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	tags: [],
};

const DEFS: CustomFieldDefinition[] = [
	{
		id: "f-dept",
		workspaceId: "ws-1",
		name: "Department",
		fieldType: "select",
		options: ["Engineering"],
		sortOrder: 1,
		required: false,
		defaultValue: null,
		showOnChart: true,
		createdAt: "2026-01-01",
	},
	{
		id: "f-loc",
		workspaceId: "ws-1",
		name: "Location",
		fieldType: "text",
		options: null,
		sortOrder: 2,
		required: false,
		defaultValue: null,
		showOnChart: false,
		createdAt: "2026-01-01",
	},
	{
		id: "f-on",
		workspaceId: "ws-1",
		name: "On-call",
		fieldType: "boolean",
		options: null,
		sortOrder: 0,
		required: false,
		defaultValue: null,
		showOnChart: true,
		createdAt: "2026-01-01",
	},
];

const VALUES: CustomFieldValue[] = [
	{ id: "v1", workspaceId: "ws-1", personId: "p-mina", fieldDefId: "f-dept", value: "Engineering" },
	{ id: "v2", workspaceId: "ws-1", personId: "p-mina", fieldDefId: "f-loc", value: "Seoul" },
	{ id: "v3", workspaceId: "ws-1", personId: "p-mina", fieldDefId: "f-on", value: "false" },
];

describe("formatPreviewFieldValue", () => {
	it("maps booleans", () => {
		const def = DEFS.find((d) => d.id === "f-on");
		expect(formatPreviewFieldValue("true", def)).toBe("Yes");
		expect(formatPreviewFieldValue("false", def)).toBe("No");
		expect(formatPreviewFieldValue("maybe", def)).toBe("maybe");
	});

	it("returns the raw value when the def is missing", () => {
		expect(formatPreviewFieldValue("x", undefined)).toBe("x");
	});

	it("keeps the calendar date in date displays", () => {
		const def: CustomFieldDefinition = {
			id: "f-start",
			workspaceId: "ws-1",
			name: "Start Date",
			fieldType: "date",
			options: null,
			sortOrder: 0,
			required: false,
			defaultValue: null,
			showOnChart: true,
			createdAt: "2026-01-01",
		};
		expect(formatPreviewFieldValue("2020-01-15", def)).toContain("2020-01-15");
	});
});

describe("buildPersonPreview", () => {
	it("returns empty when the person is unknown", () => {
		expect(buildPersonPreview("missing", [WEI], DEFS, VALUES)).toEqual({
			person: null,
			manager: null,
			fields: [],
		});
	});

	it("resolves manager and chart fields in sort order", () => {
		const preview = buildPersonPreview("p-mina", [WEI, MINA], DEFS, VALUES);
		expect(preview.person?.name).toBe("Mina Park");
		expect(preview.manager?.name).toBe("Wei Chen");
		expect(preview.fields).toEqual([
			{ name: "On-call", value: "No" },
			{ name: "Department", value: "Engineering" },
		]);
	});

	it("skips empty chart values and hidden fields", () => {
		const preview = buildPersonPreview("p-wei", [WEI], DEFS, [
			{ id: "v4", workspaceId: "ws-1", personId: "p-wei", fieldDefId: "f-dept", value: "" },
			{ id: "v5", workspaceId: "ws-1", personId: "p-wei", fieldDefId: "f-loc", value: "Singapore" },
		]);
		expect(preview.manager).toBeNull();
		expect(preview.fields).toEqual([]);
	});
});
