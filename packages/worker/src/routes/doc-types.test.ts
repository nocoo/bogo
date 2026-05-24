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
const BASE = `/api/w/${WID}/doc-types`;

describe("doc-type routes", () => {
	describe("GET /api/w/:wid/doc-types", () => {
		it("returns document type list", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "dt-1",
						workspace_id: WID,
						name: "Meeting Notes",
						color: "#3b82f6",
						sort_order: 0,
						created_at: "2026-01-01T00:00:00Z",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", BASE), { DB: db, ENVIRONMENT: "test" });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data[0]).toEqual({
				id: "dt-1",
				workspaceId: WID,
				name: "Meeting Notes",
				color: "#3b82f6",
				sortOrder: 0,
				createdAt: "2026-01-01T00:00:00Z",
			});
		});

		it("maps null color", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "dt-2",
						workspace_id: WID,
						name: "Report",
						color: null,
						sort_order: 1,
						created_at: "2026-01-01T00:00:00Z",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", BASE), { DB: db, ENVIRONMENT: "test" });
			const json = await res.json();
			expect(json.data[0].color).toBeNull();
		});
	});

	describe("POST /api/w/:wid/doc-types", () => {
		it("creates document type", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("POST", BASE, { name: "1-on-1", color: "#10b981" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.name).toBe("1-on-1");
			expect(json.data.color).toBe("#10b981");
			expect(json.data.sortOrder).toBe(0);
		});

		it("creates without color", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("POST", BASE, { name: "Feedback" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.color).toBeNull();
		});

		it("rejects empty name", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", BASE, { name: "" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});
	});

	describe("PUT /api/w/:wid/doc-types/:id", () => {
		it("updates name", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/dt-1`, { name: "Updated" }), {
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
				makeRequest("PUT", `${BASE}/dt-1`, { color: "#ef4444", sortOrder: 5 }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(true);
		});

		it("returns 404 for missing type", async () => {
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
			const res = await app.fetch(makeRequest("PUT", `${BASE}/dt-1`, {}), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(false);
		});
	});

	describe("DELETE /api/w/:wid/doc-types/:id", () => {
		it("deletes document type", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: null }, // no documents using this type
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/dt-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});

		it("rejects delete when type is in use", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "d-1" } }, // a document uses this type
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/dt-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(409);
			const json = await res.json();
			expect(json.error.code).toBe("TYPE_IN_USE");
		});

		it("returns 404 for missing type", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: null }, // no documents using this type
				{ type: "run", value: { success: true, meta: { changes: 0 } } },
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});
});
