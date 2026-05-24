import { describe, expect, it } from "vitest";
import app from "../index.js";
import { createMockD1 } from "../test-utils/mock-d1.js";

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

describe("workspace routes", () => {
	describe("GET /api/workspaces", () => {
		it("returns empty list", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({ results: [], success: true });

			const res = await app.fetch(makeRequest("GET", "/api/workspaces"), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data).toEqual([]);
		});

		it("returns workspace list with mapped fields", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "ws-1",
						owner_id: "owner-1",
						name: "Test Workspace",
						created_at: "2026-01-01T00:00:00Z",
						updated_at: "2026-01-01T00:00:00Z",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", "/api/workspaces"), {
				DB: db,
				ENVIRONMENT: "test",
			});
			const json = await res.json();
			expect(json.data).toHaveLength(1);
			expect(json.data[0]).toEqual({
				id: "ws-1",
				ownerId: "owner-1",
				name: "Test Workspace",
				createdAt: "2026-01-01T00:00:00Z",
				updatedAt: "2026-01-01T00:00:00Z",
			});
		});
	});

	describe("POST /api/workspaces", () => {
		it("creates workspace with valid input", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", "/api/workspaces", { name: "New WS" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.name).toBe("New WS");
			expect(json.data.id).toBeDefined();
		});

		it("rejects empty name", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", "/api/workspaces", { name: "" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("VALIDATION_ERROR");
		});

		it("rejects missing body fields", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", "/api/workspaces", {}), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/workspaces/:id", () => {
		it("returns workspace by id", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue({
				id: "ws-1",
				owner_id: "owner-1",
				name: "My WS",
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-02T00:00:00Z",
			});

			const res = await app.fetch(makeRequest("GET", "/api/workspaces/ws-1"), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.id).toBe("ws-1");
			expect(json.data.name).toBe("My WS");
		});

		it("returns 404 for missing workspace", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue(null);

			const res = await app.fetch(makeRequest("GET", "/api/workspaces/nonexistent"), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
			const json = await res.json();
			expect(json.error.code).toBe("NOT_FOUND");
		});
	});

	describe("PUT /api/workspaces/:id", () => {
		it("updates workspace name", async () => {
			const { db, mockFirst, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });
			mockFirst.mockResolvedValue({
				id: "ws-1",
				owner_id: "owner-1",
				name: "Updated",
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-05-24T00:00:00Z",
			});

			const res = await app.fetch(makeRequest("PUT", "/api/workspaces/ws-1", { name: "Updated" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.name).toBe("Updated");
		});

		it("returns 404 when workspace not found", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 0 } });

			const res = await app.fetch(
				makeRequest("PUT", "/api/workspaces/nonexistent", { name: "Updated" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(404);
		});

		it("rejects invalid body", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("PUT", "/api/workspaces/ws-1", { name: "" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});
	});

	describe("DELETE /api/workspaces/:id", () => {
		it("deletes existing workspace", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("DELETE", "/api/workspaces/ws-1"), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});

		it("returns 404 for missing workspace", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 0 } });

			const res = await app.fetch(makeRequest("DELETE", "/api/workspaces/nonexistent"), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});
});
