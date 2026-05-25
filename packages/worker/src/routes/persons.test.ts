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
const BASE = `/api/w/${WID}/persons`;
const UUID1 = "550e8400-e29b-41d4-a716-446655440000";
const UUID2 = "660e8400-e29b-41d4-a716-446655440001";

describe("person routes", () => {
	describe("GET /api/w/:wid/persons", () => {
		it("returns empty list", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });

			const res = await app.fetch(makeRequest("GET", BASE), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data).toEqual([]);
		});

		it("maps DB rows to Person shape", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "p-1",
						workspace_id: WID,
						name: "CEO",
						title: "Chief",
						manager_id: null,
						dotted_manager_id: null,
						is_root: 1,
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
			const json = await res.json();
			expect(json.data[0]).toEqual({
				id: "p-1",
				workspaceId: WID,
				name: "CEO",
				title: "Chief",
				managerId: null,
				dottedManagerId: null,
				isRoot: true,
				sortOrder: 0,
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});
		});
	});

	describe("POST /api/w/:wid/persons", () => {
		it("rejects creating root person directly", async () => {
			const { db } = createMockD1();

			const res = await app.fetch(makeRequest("POST", BASE, { name: "CEO", managerId: null }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("CANNOT_CREATE_ROOT");
		});

		it("creates child person", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1 } }, // parent exists
				{ type: "run", value: { success: true, meta: { changes: 1 } } }, // insert
			]);

			const res = await app.fetch(
				makeRequest("POST", BASE, { name: "Engineer", title: "Staff", managerId: UUID1 }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.isRoot).toBe(false);
		});

		it("rejects invalid parent", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: null }, // parent not found
			]);

			const res = await app.fetch(makeRequest("POST", BASE, { name: "Orphan", managerId: UUID1 }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_PARENT");
		});

		it("rejects invalid dottedManagerId", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1 } }, // parent exists
				{ type: "first", value: null }, // dotted manager NOT found
			]);

			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "Engineer",
					managerId: UUID1,
					dottedManagerId: UUID2,
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_DOTTED_MANAGER");
		});

		it("rejects empty name", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", BASE, { name: "", managerId: null }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/w/:wid/persons/:id", () => {
		it("returns person", async () => {
			const { db } = createSequenceD1([
				{
					type: "first",
					value: {
						id: "p-1",
						workspace_id: WID,
						name: "Dev",
						title: "SWE",
						manager_id: "p-0",
						dotted_manager_id: null,
						is_root: 0,
						sort_order: 1,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
					},
				},
			]);

			const res = await app.fetch(makeRequest("GET", `${BASE}/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.id).toBe("p-1");
			expect(json.data.managerId).toBe("p-0");
		});

		it("returns 404 when not found", async () => {
			const { db } = createSequenceD1([{ type: "first", value: null }]);

			const res = await app.fetch(makeRequest("GET", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});

	describe("PUT /api/w/:wid/persons/:id", () => {
		it("updates person name and title", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "p-1" } }, // exists check
				{ type: "run", value: { success: true, meta: { changes: 1 } } }, // update
				{
					type: "first",
					value: {
						id: "p-1",
						workspace_id: WID,
						name: "New Name",
						title: "New Title",
						manager_id: "p-0",
						dotted_manager_id: null,
						is_root: 0,
						sort_order: 0,
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-05-24T00:00:00Z",
					},
				}, // re-fetch
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/p-1`, { name: "New Name", title: "New Title" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.name).toBe("New Name");
			expect(json.data.title).toBe("New Title");
		});

		it("returns 404 for non-existent person", async () => {
			const { db } = createSequenceD1([{ type: "first", value: null }]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/missing`, { name: "X" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});

		it("returns updated:false for empty update body", async () => {
			const { db } = createSequenceD1([{ type: "first", value: { id: "p-1" } }]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/p-1`, {}), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(false);
		});

		it("rejects invalid body", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("PUT", `${BASE}/p-1`, { name: "" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});

		it("rejects invalid dottedManagerId in update", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "p-1" } }, // exists check
				{ type: "first", value: null }, // dotted manager NOT found
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/p-1`, { dottedManagerId: UUID2 }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_DOTTED_MANAGER");
		});
	});

	describe("PUT /api/w/:wid/persons/:id/move", () => {
		it("rejects moving root under a manager", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1, is_root: 1 } }, // person is root
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/${UUID1}/move`, { managerId: UUID2 }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("CANNOT_MOVE_ROOT");
		});

		it("rejects moving under self", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1, is_root: 0 } }, // person exists
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/${UUID1}/move`, { managerId: UUID1 }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("CYCLE_DETECTED");
		});

		it("returns 404 for unknown person", async () => {
			const { db } = createSequenceD1([{ type: "first", value: null }]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/missing/move`, { managerId: UUID1 }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(404);
		});

		it("rejects when new manager not found", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1, is_root: 0 } }, // person exists
				{ type: "first", value: null }, // new parent NOT found
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/${UUID1}/move`, { managerId: UUID2 }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_PARENT");
		});

		it("succeeds with valid move", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1, is_root: 0 } }, // person exists
				{ type: "first", value: { id: UUID2 } }, // new parent found
				{ type: "first", value: { manager_id: null } }, // cycle check: parent's manager is null (root)
				{ type: "run", value: { success: true, meta: { changes: 1 } } }, // update
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/${UUID1}/move`, { managerId: UUID2 }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.moved).toBe(true);
		});

		it("promotes to root (null managerId)", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1, is_root: 0 } }, // person exists
				{ type: "first", value: null }, // no existing root (other than self)
				{ type: "run", value: { success: true, meta: { changes: 1 } } }, // update
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/${UUID1}/move`, { managerId: null }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.moved).toBe(true);
		});

		it("rejects promote-to-root when root exists", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1, is_root: 0 } }, // person exists
				{ type: "first", value: { id: "other-root" } }, // another root already exists
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/${UUID1}/move`, { managerId: null }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(409);
			const json = await res.json();
			expect(json.error.code).toBe("CONFLICT");
		});

		it("rejects invalid managerId format", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/${UUID1}/move`, { managerId: "not-uuid" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("VALIDATION_ERROR");
		});
	});

	describe("DELETE /api/w/:wid/persons/:id", () => {
		it("deletes leaf person", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "p-1", is_root: 0 } }, // person exists, not root
				{ type: "first", value: null }, // no children
				{ type: "first", value: null }, // no dotted refs
				{ type: "run", value: { success: true, meta: { changes: 1 } } }, // delete
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});

		it("rejects delete of root person", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "p-root", is_root: 1 } }, // person is root
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/p-root`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("CANNOT_DELETE_ROOT");
		});

		it("rejects delete with direct reports", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "p-1", is_root: 0 } }, // person exists, not root
				{ type: "first", value: { id: "child-1" } }, // has children
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("HAS_REPORTS");
		});

		it("rejects delete with dotted manager references", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "p-1", is_root: 0 } }, // person exists, not root
				{ type: "first", value: null }, // no direct children
				{ type: "first", value: { id: "other-person" } }, // has dotted refs
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("HAS_DOTTED_REPORTS");
		});

		it("returns 404 when person not found", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: null }, // person not found
			]);

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});

	describe("GET /api/w/:wid/persons/:id/documents", () => {
		it("returns documents for a person", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: UUID1 } },
				{
					type: "all",
					value: {
						results: [
							{
								id: "doc-1",
								workspace_id: WID,
								type_id: null,
								title: "Review",
								content: "content",
								event_date: null,
								version: 1,
								created_at: "2026-01-01T00:00:00Z",
								updated_at: "2026-01-01T00:00:00Z",
							},
						],
						success: true,
					},
				},
			]);

			const res = await app.fetch(makeRequest("GET", `${BASE}/${UUID1}/documents`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data).toHaveLength(1);
			expect(json.data[0].title).toBe("Review");
			expect(json.data[0].eventDate).toBeNull();
		});

		it("returns 404 when person not found", async () => {
			const { db } = createSequenceD1([{ type: "first", value: null }]);

			const res = await app.fetch(makeRequest("GET", `${BASE}/missing/documents`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});
});
