import { describe, expect, it } from "vitest";
import app from "../index.js";
import { createMockD1, createSequenceD1 } from "../test-utils/mock-d1.js";

function makeRequest(method: string, path: string, body?: unknown) {
	const init: RequestInit = {
		method,
		headers: { host: "localhost:8787", "Content-Type": "application/json" },
	};
	if (body !== undefined) {
		init.body = JSON.stringify(body);
	}
	return new Request(`http://localhost:8787${path}`, init);
}

const WID = "ws-1";
const BASE = `/api/w/${WID}/table-views`;
const VIEW_ROW = {
	id: "view-1",
	workspace_id: WID,
	name: "All People",
	columns_json: '["builtin:name","builtin:title"]',
	sort_json: null,
	filters_json: "[]",
	is_default: 1,
	sort_order: 0,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
};

describe("table-views routes", () => {
	describe("GET /", () => {
		it("lists views", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({ results: [VIEW_ROW], success: true });
			const res = await app.fetch(makeRequest("GET", BASE), { DB: db, ENVIRONMENT: "test" });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data).toHaveLength(1);
			expect(json.data[0].name).toBe("All People");
			expect(json.data[0].isDefault).toBe(true);
			expect(json.data[0].columns).toEqual(["builtin:name", "builtin:title"]);
		});
	});

	describe("GET /:id", () => {
		it("returns 404 when missing", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue(null);
			const res = await app.fetch(makeRequest("GET", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});

		it("returns view", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue(VIEW_ROW);
			const res = await app.fetch(makeRequest("GET", `${BASE}/view-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.id).toBe("view-1");
			expect(json.data.sort).toBeNull();
		});
	});

	describe("POST /", () => {
		it("creates a view with server sort_order", async () => {
			const { db, mockAll, mockFirst, mockBatch } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			mockFirst.mockResolvedValue({ m: 0 });
			mockBatch.mockResolvedValue([]);

			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "HR",
					columns: ["builtin:name", "builtin:title"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.name).toBe("HR");
			expect(json.data.sortOrder).toBe(1);
			expect(json.data.isDefault).toBe(false);
			expect(mockBatch).toHaveBeenCalled();
		});

		it("creates default view with batch clear", async () => {
			const { db, mockAll, mockFirst, mockBatch } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			mockFirst.mockResolvedValue({ m: 1 });
			mockBatch.mockResolvedValue([]);
			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "Primary",
					columns: ["builtin:name"],
					isDefault: true,
					sort: { key: "builtin:name", direction: "asc" },
					filters: [{ key: "builtin:name", op: "contains", value: "a" }],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.isDefault).toBe(true);
			expect(json.data.sort).toEqual({ key: "builtin:name", direction: "asc" });
		});

		it("rejects missing builtin:name", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "Bad",
					columns: ["builtin:title"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("VALIDATION_ERROR");
		});

		it("rejects unknown field column", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "Bad",
					columns: ["builtin:name", "field:019a0000-0000-7000-8000-0000000000ff"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("UNKNOWN_FIELD");
		});

		it("rejects invalid sort", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "Bad",
					columns: ["builtin:name", "builtin:tags"],
					sort: { key: "builtin:tags", direction: "asc" },
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_SORT");
		});

		it("rejects invalid filter", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "Bad",
					columns: ["builtin:name"],
					filters: [{ key: "builtin:name", op: "eq", value: "" }],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_FILTER");
		});

		it("maps UNIQUE to DUPLICATE_NAME", async () => {
			const { db, mockAll, mockFirst, mockBatch } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			mockFirst.mockResolvedValue({ m: -1 });
			mockBatch.mockRejectedValue(new Error("UNIQUE constraint failed: person_table_views.name"));
			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "Dup",
					columns: ["builtin:name"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(409);
			const json = await res.json();
			expect(json.error.code).toBe("DUPLICATE_NAME");
		});

		it("accepts columns CSV and sort/filters JSON bridges", async () => {
			const { db, mockAll, mockFirst, mockBatch } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			mockFirst.mockResolvedValue({ m: null });
			mockBatch.mockResolvedValue([]);
			const sort = encodeURIComponent(JSON.stringify({ key: "builtin:name", direction: "desc" }));
			const filters = encodeURIComponent(
				JSON.stringify([{ key: "builtin:name", op: "contains", value: "x" }]),
			);
			const res = await app.fetch(
				makeRequest(
					"POST",
					`${BASE}?columns=builtin:name,builtin:title&sort=${sort}&filters=${filters}`,
					{ name: "CSV" },
				),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.columns).toEqual(["builtin:name", "builtin:title"]);
			expect(json.data.sort.direction).toBe("desc");
			expect(json.data.filters).toHaveLength(1);
			expect(json.data.sortOrder).toBe(0);
		});

		it("accepts sort=null query bridge", async () => {
			const { db, mockAll, mockFirst, mockBatch } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			mockFirst.mockResolvedValue({ m: 2 });
			mockBatch.mockResolvedValue([]);
			const res = await app.fetch(
				makeRequest("POST", `${BASE}?sort=null`, {
					name: "NoSort",
					columns: ["builtin:name"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.sort).toBeNull();
		});

		it("rejects invalid body schema", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", BASE, { name: "" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});

		it("handles invalid JSON body on create", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(
				new Request(`http://localhost:8787${BASE}`, {
					method: "POST",
					headers: { host: "localhost:8787", "Content-Type": "application/json" },
					body: "{not-json",
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
		});

		it("loads field defs with options and accepts field column", async () => {
			const fieldId = "019a0000-0000-7000-8000-0000000000aa";
			const { db, mockAll, mockFirst, mockBatch } = createMockD1();
			mockAll.mockResolvedValue({
				results: [{ id: fieldId, field_type: "select", options: '["A","B"]' }],
				success: true,
			});
			mockFirst.mockResolvedValue({ m: 0 });
			mockBatch.mockResolvedValue([]);
			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "WithField",
					columns: ["builtin:name", `field:${fieldId}`],
					filters: [{ key: `field:${fieldId}`, op: "eq", value: "A" }],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
		});

		it("rejects malformed filters query bridge via zod", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(
				makeRequest("POST", `${BASE}?filters=not-json`, {
					name: "X",
					columns: ["builtin:name"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
		});

		it("surfaces non-unique batch errors on create as 500", async () => {
			const { db, mockAll, mockFirst, mockBatch } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });
			mockFirst.mockResolvedValue({ m: 0 });
			mockBatch.mockRejectedValue(new Error("D1_ERROR: database is locked"));
			const res = await app.fetch(
				makeRequest("POST", BASE, { name: "X", columns: ["builtin:name"] }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(500);
		});

		it("accepts malformed sort query as validation failure", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(
				makeRequest("POST", `${BASE}?sort=not-json`, {
					name: "X",
					columns: ["builtin:name"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
		});
	});

	describe("PUT /:id", () => {
		it("renames without validating historical stale filters", async () => {
			const staleField = "field:019a0000-0000-7000-8000-0000000000de";
			const row = {
				...VIEW_ROW,
				columns_json: JSON.stringify(["builtin:name", staleField]),
				filters_json: JSON.stringify([{ key: staleField, op: "eq", value: "x" }]),
				sort_json: JSON.stringify({ key: staleField, direction: "asc" }),
			};
			const { db, prepare, batch } = createSequenceD1([
				{ type: "first", value: row },
				{ type: "all", value: { results: [], success: true } },
			]);
			batch.mockResolvedValue([]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/view-1`, { name: "Renamed" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.name).toBe("Renamed");
			expect(json.data.filters[0].key).toBe(staleField);
			expect(prepare).toHaveBeenCalled();
		});

		it("rejects clearing default", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue(VIEW_ROW);
			const res = await app.fetch(makeRequest("PUT", `${BASE}/view-1`, { isDefault: false }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("CANNOT_CLEAR_DEFAULT");
		});

		it("promotes default", async () => {
			const nonDefault = { ...VIEW_ROW, id: "view-2", is_default: 0, name: "Other" };
			const { db, mockFirst, mockAll, mockBatch } = createMockD1();
			mockFirst.mockResolvedValue(nonDefault);
			mockAll.mockResolvedValue({ results: [], success: true });
			mockBatch.mockResolvedValue([]);
			const res = await app.fetch(makeRequest("PUT", `${BASE}/view-2`, { isDefault: true }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.isDefault).toBe(true);
		});

		it("updates columns and strips removed sort/filter", async () => {
			const row = {
				...VIEW_ROW,
				sort_json: JSON.stringify({ key: "builtin:title", direction: "asc" }),
				filters_json: JSON.stringify([{ key: "builtin:title", op: "eq", value: "x" }]),
			};
			const { db, mockFirst, mockAll, mockBatch } = createMockD1();
			mockFirst.mockResolvedValue(row);
			mockAll.mockResolvedValue({ results: [], success: true });
			mockBatch.mockResolvedValue([]);
			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/view-1`, {
					columns: ["builtin:name"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.columns).toEqual(["builtin:name"]);
			expect(json.data.sort).toBeNull();
			expect(json.data.filters).toEqual([]);
		});

		it("validates new sort when sortTouched", async () => {
			const { db, mockFirst, mockAll } = createMockD1();
			mockFirst.mockResolvedValue(VIEW_ROW);
			mockAll.mockResolvedValue({ results: [], success: true });
			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/view-1`, {
					sort: { key: "builtin:tags", direction: "asc" },
					columns: ["builtin:name", "builtin:tags"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_SORT");
		});

		it("validates new filters when filtersTouched", async () => {
			const { db, mockFirst, mockAll } = createMockD1();
			mockFirst.mockResolvedValue(VIEW_ROW);
			mockAll.mockResolvedValue({ results: [], success: true });
			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/view-1`, {
					filters: [{ key: "builtin:name", op: "eq", value: "   " }],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_FILTER");
		});

		it("returns 404 when missing", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue(null);
			const res = await app.fetch(makeRequest("PUT", `${BASE}/missing`, { name: "X" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});

		it("rejects empty patch", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("PUT", `${BASE}/view-1`, {}), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});

		it("handles invalid JSON body on update", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(
				new Request(`http://localhost:8787${BASE}/view-1`, {
					method: "PUT",
					headers: { host: "localhost:8787", "Content-Type": "application/json" },
					body: "{bad",
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
		});

		it("rejects columns without builtin:name on update", async () => {
			const { db, mockFirst, mockAll } = createMockD1();
			mockFirst.mockResolvedValue(VIEW_ROW);
			mockAll.mockResolvedValue({ results: [], success: true });
			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/view-1`, { columns: ["builtin:title"] }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
		});

		it("maps UNIQUE on update", async () => {
			const { db, mockFirst, mockAll, mockBatch } = createMockD1();
			mockFirst.mockResolvedValue(VIEW_ROW);
			mockAll.mockResolvedValue({ results: [], success: true });
			mockBatch.mockRejectedValue(new Error("UNIQUE constraint failed"));
			const res = await app.fetch(makeRequest("PUT", `${BASE}/view-1`, { name: "Taken" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(409);
		});

		it("surfaces non-unique batch errors on update as 500", async () => {
			const { db, mockFirst, mockAll, mockBatch } = createMockD1();
			mockFirst.mockResolvedValue(VIEW_ROW);
			mockAll.mockResolvedValue({ results: [], success: true });
			mockBatch.mockRejectedValue(new Error("boom"));
			const res = await app.fetch(makeRequest("PUT", `${BASE}/view-1`, { name: "X" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(500);
		});

		it("accepts sort null on update", async () => {
			const row = {
				...VIEW_ROW,
				sort_json: JSON.stringify({ key: "builtin:name", direction: "asc" }),
			};
			const { db, mockFirst, mockAll, mockBatch } = createMockD1();
			mockFirst.mockResolvedValue(row);
			mockAll.mockResolvedValue({ results: [], success: true });
			mockBatch.mockResolvedValue([]);
			const res = await app.fetch(makeRequest("PUT", `${BASE}/view-1`, { sort: null }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			expect((await res.json()).data.sort).toBeNull();
		});

		it("rejects new unknown field in columns", async () => {
			const { db, mockFirst, mockAll } = createMockD1();
			mockFirst.mockResolvedValue(VIEW_ROW);
			mockAll.mockResolvedValue({ results: [], success: true });
			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/view-1`, {
					columns: ["builtin:name", "field:019a0000-0000-7000-8000-0000000000ff"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			expect((await res.json()).error.code).toBe("UNKNOWN_FIELD");
		});
	});

	describe("DELETE /:id", () => {
		it("blocks deleting last view", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst
				.mockResolvedValueOnce({ id: "view-1", is_default: 0 })
				.mockResolvedValueOnce({ c: 1 });
			const res = await app.fetch(makeRequest("DELETE", `${BASE}/view-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("CANNOT_DELETE_LAST_VIEW");
		});

		it("blocks deleting default when others exist", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst
				.mockResolvedValueOnce({ id: "view-1", is_default: 1 })
				.mockResolvedValueOnce({ c: 2 });
			const res = await app.fetch(makeRequest("DELETE", `${BASE}/view-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("CANNOT_DELETE_DEFAULT");
		});

		it("deletes non-default view", async () => {
			const { db, mockFirst, mockRun } = createMockD1();
			mockFirst
				.mockResolvedValueOnce({ id: "view-2", is_default: 0 })
				.mockResolvedValueOnce({ c: 2 });
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
			const res = await app.fetch(makeRequest("DELETE", `${BASE}/view-2`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});

		it("404 when missing", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue(null);
			const res = await app.fetch(makeRequest("DELETE", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});
});
