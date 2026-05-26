import { describe, expect, it } from "vitest";
import app from "../index.js";
import { createMockD1, createSequenceD1 } from "../test-utils/mock-d1.js";

function makeRequest(method: string, path: string, body?: unknown) {
	const init: RequestInit = {
		method,
		headers: { host: "localhost:8787", "Content-Type": "application/json" },
	};
	if (body) {
		init.body = JSON.stringify(body);
	}
	return new Request(`http://localhost:8787${path}`, init);
}

const WID = "ws-1";
const BASE = `/api/w/${WID}/tags`;

describe("tag routes", () => {
	describe("GET /api/w/:wid/tags", () => {
		it("returns tag list filtered by scope", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "tag-1",
						workspace_id: WID,
						name: "Engineering",
						scope: "document",
						color: "#3b82f6",
						sort_order: 0,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", `${BASE}?scope=document`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data[0]).toEqual({
				id: "tag-1",
				workspaceId: WID,
				name: "Engineering",
				scope: "document",
				color: "#3b82f6",
				sortOrder: 0,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});
		});

		it("returns tags with counts when includeCounts=true", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "tag-1",
						workspace_id: WID,
						name: "Engineering",
						scope: "document",
						color: "#3b82f6",
						sort_order: 0,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
						assigned_count: 5,
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", `${BASE}?scope=document&includeCounts=true`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data[0].assignedCount).toBe(5);
		});

		it("returns empty array when no tags", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });

			const res = await app.fetch(makeRequest("GET", `${BASE}?scope=person`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data).toEqual([]);
		});

		it("returns all tags when no scope specified", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "tag-1",
						workspace_id: WID,
						name: "A",
						scope: "document",
						color: null,
						sort_order: 0,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", BASE), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBe(1);
		});
	});

	describe("POST /api/w/:wid/tags", () => {
		it("creates a tag", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(
				makeRequest("POST", BASE, { name: "Engineering", scope: "document", color: "#3b82f6" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.name).toBe("Engineering");
			expect(json.data.scope).toBe("document");
			expect(json.data.color).toBe("#3b82f6");
			expect(json.data.sortOrder).toBe(0);
		});

		it("creates a tag without color", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("POST", BASE, { name: "Senior", scope: "person" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.color).toBeNull();
		});

		it("rejects empty name", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", BASE, { name: "", scope: "document" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("VALIDATION_ERROR");
		});

		it("rejects missing scope", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", BASE, { name: "Tag" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});

		it("rejects invalid color", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(
				makeRequest("POST", BASE, { name: "Tag", scope: "document", color: "red" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
		});

		it("returns 409 on duplicate name", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockRejectedValue(
				new Error("UNIQUE constraint failed: tags.workspace_id, tags.scope, tags.name"),
			);

			const res = await app.fetch(makeRequest("POST", BASE, { name: "Dup", scope: "document" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(409);
			const json = await res.json();
			expect(json.error.code).toBe("DUPLICATE");
		});
	});

	describe("PUT /api/w/:wid/tags/:id", () => {
		it("updates name", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1`, { name: "Renamed" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(true);
		});

		it("updates color and sortOrder", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/tag-1`, { color: "#ef4444", sortOrder: 3 }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(true);
		});

		it("allows setting color to null", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1`, { color: null }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
		});

		it("returns 404 for missing tag", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 0 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/missing`, { name: "X" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});

		it("returns updated:false for empty body", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1`, {}), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(false);
		});
	});

	describe("DELETE /api/w/:wid/tags/:id", () => {
		it("deletes a tag", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/tag-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});

		it("returns 404 for missing tag", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 0 } } },
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});

	describe("PUT /api/w/:wid/tags/:id/documents/:docId", () => {
		it("assigns tag to document", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { scope: "document" } },
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1/documents/doc-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.assigned).toBe(true);
		});

		it("rejects scope mismatch", async () => {
			const { db } = createSequenceD1([{ type: "first", value: { scope: "person" } }]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1/documents/doc-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("SCOPE_MISMATCH");
		});

		it("returns 404 for missing tag", async () => {
			const { db } = createSequenceD1([{ type: "first", value: null }]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/missing/documents/doc-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});

		it("returns INVALID_REFERENCE on FK violation", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { scope: "document" } },
				{ type: "run", value: null },
			]);
			const stmt = (db.prepare as ReturnType<typeof import("vitest").vi.fn>).mock.results;
			const lastStmt = stmt[stmt.length - 1]?.value;
			if (lastStmt?.bind) {
				lastStmt.bind.mockReturnValue({
					...lastStmt,
					run: async () => {
						throw new Error("FOREIGN KEY constraint failed");
					},
				});
			}

			const { db: db2 } = createSequenceD1([
				{ type: "first", value: { scope: "document" } },
				{ type: "run", value: null },
			]);
			const prep = db2.prepare as ReturnType<typeof import("vitest").vi.fn>;
			let callIdx = 0;
			prep.mockImplementation(() => {
				callIdx++;
				if (callIdx === 1) {
					return {
						bind: () => ({
							first: async () => ({ scope: "document" }),
						}),
					};
				}
				return {
					bind: () => ({
						run: async () => {
							throw new Error("FOREIGN KEY constraint failed");
						},
					}),
				};
			});

			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1/documents/doc-1`), {
				DB: db2,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_REFERENCE");
		});
	});

	describe("DELETE /api/w/:wid/tags/:id/documents/:docId", () => {
		it("unassigns tag from document", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/tag-1/documents/doc-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.removed).toBe(true);
		});
	});

	describe("PUT /api/w/:wid/tags/:id/persons/:personId", () => {
		it("assigns tag to person", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { scope: "person" } },
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1/persons/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.assigned).toBe(true);
		});

		it("rejects scope mismatch", async () => {
			const { db } = createSequenceD1([{ type: "first", value: { scope: "document" } }]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1/persons/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("SCOPE_MISMATCH");
		});

		it("returns 404 for missing tag", async () => {
			const { db } = createSequenceD1([{ type: "first", value: null }]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/missing/persons/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});

		it("returns INVALID_REFERENCE on FK violation", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { scope: "person" } },
				{ type: "run", value: null },
			]);
			const prep = db.prepare as ReturnType<typeof import("vitest").vi.fn>;
			let callIdx = 0;
			prep.mockImplementation(() => {
				callIdx++;
				if (callIdx === 1) {
					return {
						bind: () => ({
							first: async () => ({ scope: "person" }),
						}),
					};
				}
				return {
					bind: () => ({
						run: async () => {
							throw new Error("FOREIGN KEY constraint failed");
						},
					}),
				};
			});

			const res = await app.fetch(makeRequest("PUT", `${BASE}/tag-1/persons/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_REFERENCE");
		});
	});

	describe("DELETE /api/w/:wid/tags/:id/persons/:personId", () => {
		it("unassigns tag from person", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/tag-1/persons/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.removed).toBe(true);
		});
	});

	describe("GET /api/w/:wid/tags/stats", () => {
		it("returns tag distribution", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{ id: "tag-1", name: "Eng", color: "#3b82f6", sort_order: 0, count: 5 },
					{ id: "tag-2", name: "Design", color: null, sort_order: 1, count: 0 },
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", `${BASE}/stats?scope=document`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data).toEqual([
				{ id: "tag-1", name: "Eng", color: "#3b82f6", sortOrder: 0, count: 5 },
				{ id: "tag-2", name: "Design", color: null, sortOrder: 1, count: 0 },
			]);
		});

		it("rejects missing scope", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("GET", `${BASE}/stats`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});
	});
});
