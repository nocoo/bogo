import { describe, expect, it } from "vitest";
import {
	addColumn,
	ensureNameColumn,
	isLockedColumn,
	LOCKED_COLUMN_KEY,
	nudgeColumn,
	removeColumn,
	reorderSelected,
} from "./column-picker.js";

describe("column-picker", () => {
	it("locks name column", () => {
		expect(isLockedColumn(LOCKED_COLUMN_KEY)).toBe(true);
		expect(isLockedColumn("builtin:title")).toBe(false);
	});

	it("ensureNameColumn prepends when missing", () => {
		expect(ensureNameColumn(["builtin:title"])).toEqual(["builtin:name", "builtin:title"]);
		expect(ensureNameColumn(["builtin:name", "builtin:title"])).toEqual([
			"builtin:name",
			"builtin:title",
		]);
	});

	it("reorders selected by key to index", () => {
		const keys = ["builtin:name", "builtin:title", "builtin:managerId"] as const;
		expect(reorderSelected([...keys], "builtin:managerId", 1)).toEqual([
			"builtin:name",
			"builtin:managerId",
			"builtin:title",
		]);
		expect(reorderSelected([...keys], "builtin:title", 0)).toEqual([
			"builtin:title",
			"builtin:name",
			"builtin:managerId",
		]);
	});

	it("adds and removes columns; name cannot be removed", () => {
		const base = ["builtin:name", "builtin:title"] as const;
		expect(addColumn([...base], "builtin:tags")).toEqual([
			"builtin:name",
			"builtin:title",
			"builtin:tags",
		]);
		expect(addColumn([...base], "builtin:title")).toEqual([...base]);
		expect(removeColumn([...base], "builtin:title")).toEqual(["builtin:name"]);
		expect(removeColumn([...base], "builtin:name")).toEqual([...base]);
	});

	it("nudges left and right", () => {
		const keys = ["builtin:name", "builtin:title", "builtin:tags"] as const;
		expect(nudgeColumn([...keys], "builtin:title", "left")).toEqual([
			"builtin:title",
			"builtin:name",
			"builtin:tags",
		]);
		expect(nudgeColumn([...keys], "builtin:title", "right")).toEqual([
			"builtin:name",
			"builtin:tags",
			"builtin:title",
		]);
		expect(nudgeColumn([...keys], "builtin:name", "left")).toEqual([...keys]);
		expect(nudgeColumn([...keys], "builtin:tags", "right")).toEqual([...keys]);
	});
});
