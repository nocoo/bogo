import type { Document } from "@bogo/shared";
import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS } from "../components/DocumentFilters.js";
import { applyFilters } from "./DocumentsPage.js";

function doc(overrides: Partial<Document> = {}): Document {
	return {
		id: "d-1",
		workspaceId: "ws-1",
		typeId: null,
		title: "Untitled",
		content: "",
		eventDate: null,
		version: 1,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		tags: [],
		personIds: [],
		...overrides,
	};
}

describe("applyFilters", () => {
	const docs: Document[] = [
		doc({
			id: "a",
			title: "Q1 Roadmap",
			typeId: "dt-strategy",
			eventDate: "2026-03-15",
			tags: [{ id: "t-plan", name: "plan", color: null }],
			personIds: ["p-alice"],
		}),
		doc({
			id: "b",
			title: "Performance Review",
			typeId: "dt-connect",
			eventDate: "2026-04-30",
			tags: [
				{ id: "t-review", name: "review", color: null },
				{ id: "t-plan", name: "plan", color: null },
			],
			personIds: ["p-bob"],
		}),
		doc({ id: "c", title: "Notes", typeId: null, eventDate: null }),
	];

	it("returns all docs when no filters are active", () => {
		expect(applyFilters(docs, EMPTY_FILTERS)).toHaveLength(3);
	});

	it("filters by keyword (case-insensitive substring on title)", () => {
		const r = applyFilters(docs, { ...EMPTY_FILTERS, keyword: "roadmap" });
		expect(r).toHaveLength(1);
		expect(r[0].id).toBe("a");
	});

	it("filters by typeId", () => {
		expect(applyFilters(docs, { ...EMPTY_FILTERS, typeId: "dt-connect" })).toHaveLength(1);
	});

	it("filters by typeId='none' (no type assigned)", () => {
		const r = applyFilters(docs, { ...EMPTY_FILTERS, typeId: "none" });
		expect(r).toHaveLength(1);
		expect(r[0].id).toBe("c");
	});

	it("filters by date range — both ends inclusive", () => {
		const r = applyFilters(docs, {
			...EMPTY_FILTERS,
			dateFrom: "2026-03-01",
			dateTo: "2026-04-01",
		});
		expect(r).toHaveLength(1);
		expect(r[0].id).toBe("a");
	});

	it("filters by date range — excludes docs without eventDate", () => {
		const r = applyFilters(docs, { ...EMPTY_FILTERS, dateFrom: "2026-01-01" });
		expect(r.map((d) => d.id).sort()).toEqual(["a", "b"]);
	});

	it("filters by tagIds — AND semantics", () => {
		// both "review" and "plan" → only b
		const r = applyFilters(docs, { ...EMPTY_FILTERS, tagIds: ["t-review", "t-plan"] });
		expect(r).toHaveLength(1);
		expect(r[0].id).toBe("b");
	});

	it("filters by tagIds — single tag matches any doc carrying it", () => {
		const r = applyFilters(docs, { ...EMPTY_FILTERS, tagIds: ["t-plan"] });
		expect(r.map((d) => d.id).sort()).toEqual(["a", "b"]);
	});

	it("filters by personIds", () => {
		const r = applyFilters(docs, { ...EMPTY_FILTERS, personIds: ["p-alice"] });
		expect(r).toHaveLength(1);
		expect(r[0].id).toBe("a");
	});

	it("combines all filters with AND semantics", () => {
		const r = applyFilters(docs, {
			...EMPTY_FILTERS,
			keyword: "performance",
			typeId: "dt-connect",
			tagIds: ["t-review"],
			personIds: ["p-bob"],
		});
		expect(r).toHaveLength(1);
		expect(r[0].id).toBe("b");
	});

	it("treats missing personIds field as no people", () => {
		const orphan = doc({ id: "z", title: "z" });
		(orphan as { personIds?: string[] }).personIds = undefined;
		const r = applyFilters([orphan], { ...EMPTY_FILTERS, personIds: ["p-anyone"] });
		expect(r).toHaveLength(0);
	});
});
