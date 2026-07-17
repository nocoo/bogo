import type { CustomFieldDefinition, Person } from "@bogo/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { indexFieldValues, indexPersons, resolveCell, utcDay } from "./resolve-cell.js";

afterEach(() => {
	vi.useRealTimers();
});

const FIELD_ID = "019a0000-0000-7000-8000-0000000000f1";
const FIELD_KEY = `field:${FIELD_ID}` as const;

const basePerson: Person = {
	id: "p1",
	workspaceId: "ws",
	name: "Alice",
	title: "Eng",
	managerId: null,
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: true,
	sortOrder: 0,
	createdAt: "2026-07-17T12:00:00.000Z",
	updatedAt: "2026-07-17T12:00:00.000Z",
	tags: [{ id: "t1", name: "Senior", color: null }],
};

const levelDef: CustomFieldDefinition = {
	id: FIELD_ID,
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

describe("resolveCell", () => {
	it("resolves builtins", () => {
		const persons = indexPersons([basePerson]);
		expect(resolveCell(basePerson, "builtin:name", [], new Map(), persons).display).toBe("Alice");
		expect(resolveCell(basePerson, "builtin:isRoot", [], new Map(), persons).raw).toBe("true");
		expect(resolveCell(basePerson, "builtin:tags", [], new Map(), persons).display).toBe("Senior");
	});

	it("resolves manager name via lookup", () => {
		const boss: Person = { ...basePerson, id: "boss", name: "Boss", isRoot: true };
		const report: Person = {
			...basePerson,
			id: "p2",
			name: "Bob",
			managerId: "boss",
			isRoot: false,
		};
		const persons = indexPersons([boss, report]);
		const cell = resolveCell(report, "builtin:managerId", [], new Map(), persons);
		expect(cell.display).toBe("Boss");
		expect(cell.refId).toBe("boss");
	});

	it("uses stored field value then default", () => {
		const persons = indexPersons([basePerson]);
		const withDefault = resolveCell(basePerson, FIELD_KEY, [levelDef], new Map(), persons);
		expect(withDefault.isDefault).toBe(true);
		expect(withDefault.display).toBe("L3");

		const values = indexFieldValues([
			{
				id: "v1",
				workspaceId: "ws",
				personId: "p1",
				fieldDefId: FIELD_ID,
				value: "L5",
			},
		]);
		const stored = resolveCell(basePerson, FIELD_KEY, [levelDef], values, persons);
		expect(stored.display).toBe("L5");
		expect(stored.isDefault).toBe(false);
	});

	it("utcDay extracts UTC date", () => {
		expect(utcDay("2026-07-17T23:30:00.000Z")).toBe("2026-07-17");
		expect(utcDay("not-a-date")).toBeNull();
	});

	it("resolves title avatar dotted manager created/updated and boolean field", () => {
		const boss = { ...basePerson, id: "boss", name: "Boss" };
		const p: Person = {
			...basePerson,
			title: "",
			avatarUrl: "https://x/y.png",
			dottedManagerId: "boss",
			isRoot: false,
		};
		const persons = indexPersons([boss, p]);
		expect(resolveCell(p, "builtin:title", [], new Map(), persons).display).toBe("—");
		expect(resolveCell(p, "builtin:avatarUrl", [], new Map(), persons).raw).toBe("https://x/y.png");
		expect(resolveCell(p, "builtin:dottedManagerId", [], new Map(), persons).display).toBe("Boss");
		expect(resolveCell(p, "builtin:createdAt", [], new Map(), persons).raw).toContain("2026");
		expect(resolveCell(p, "builtin:updatedAt", [], new Map(), persons).raw).toContain("2026");

		const boolDef: CustomFieldDefinition = {
			...levelDef,
			id: FIELD_ID,
			fieldType: "boolean",
			defaultValue: null,
		};
		const values = indexFieldValues([
			{
				id: "v",
				workspaceId: "ws",
				personId: "p1",
				fieldDefId: FIELD_ID,
				value: "true",
			},
		]);
		expect(resolveCell({ ...p, id: "p1" }, FIELD_KEY, [boolDef], values, persons).display).toBe(
			"Yes",
		);
		expect(resolveCell(p, "builtin:managerId", [], new Map(), persons).display).toBe("—");
	});

	it("appends calendar distance for date fields", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 6, 17)); // 2026-07-17 local
		const dateDef: CustomFieldDefinition = {
			...levelDef,
			fieldType: "date",
			defaultValue: null,
		};
		const persons = indexPersons([basePerson]);
		const values = indexFieldValues([
			{
				id: "v",
				workspaceId: "ws",
				personId: "p1",
				fieldDefId: FIELD_ID,
				value: "2025-04-22",
			},
		]);
		const cell = resolveCell(basePerson, FIELD_KEY, [dateDef], values, persons);
		expect(cell.raw).toBe("2025-04-22");
		expect(cell.display).toBe("2025-04-22 (1y 2m 25d)");
	});

	it("handles missing manager lookup and empty stored field", () => {
		const p: Person = {
			...basePerson,
			managerId: "ghost",
			dottedManagerId: "ghost",
			tags: [],
		};
		const persons = indexPersons([p]);
		expect(resolveCell(p, "builtin:managerId", [], new Map(), persons).display).toBe("—");
		expect(resolveCell(p, "builtin:dottedManagerId", [], new Map(), persons).display).toBe("—");
		expect(resolveCell(p, "builtin:tags", [], new Map(), persons).display).toBe("—");
		expect(resolveCell(p, "builtin:avatarUrl", [], new Map(), persons).display).toBe("—");

		const values = indexFieldValues([
			{
				id: "v",
				workspaceId: "ws",
				personId: "p1",
				fieldDefId: FIELD_ID,
				value: "",
			},
		]);
		// empty stored falls through to default L3
		const cell = resolveCell(basePerson, FIELD_KEY, [levelDef], values, persons);
		expect(cell.isDefault).toBe(true);
	});
});
