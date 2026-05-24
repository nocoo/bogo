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
const BASE = `/api/w/${WID}/documents`;

describe("document routes", () => {
	describe("GET /api/w/:wid/documents", () => {
		it("returns document list", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "d-1",
						workspace_id: WID,
						type_id: "t-1",
						title: "Meeting Notes",
						content: "# Notes",
						event_date: "2026-05-20",
						version: 2,
						created_at: "2026-05-20T00:00:00Z",
						updated_at: "2026-05-21T00:00:00Z",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", BASE), { DB: db, ENVIRONMENT: "test" });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data[0].title).toBe("Meeting Notes");
			expect(json.data[0].typeId).toBe("t-1");
			expect(json.data[0].version).toBe(2);
		});
	});

	describe("POST /api/w/:wid/documents", () => {
		it("creates document with initial version", async () => {
			const { db, mockBatch } = createMockD1();
			mockBatch.mockResolvedValue([]);

			const res = await app.fetch(makeRequest("POST", BASE, { title: "New Doc" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.title).toBe("New Doc");
			expect(json.data.version).toBe(1);
			expect(json.data.content).toBe("");
		});

		it("creates document with personIds", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "550e8400-e29b-41d4-a716-446655440000" } }, // person exists
			]);
			(db as unknown as { batch: () => Promise<unknown[]> }).batch = async () => [];

			const res = await app.fetch(
				makeRequest("POST", BASE, {
					title: "Review",
					personIds: ["550e8400-e29b-41d4-a716-446655440000"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.title).toBe("Review");
		});

		it("rejects invalid typeId", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: null }, // doc type NOT found
			]);

			const res = await app.fetch(
				makeRequest("POST", BASE, {
					title: "Doc",
					typeId: "550e8400-e29b-41d4-a716-446655440000",
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_TYPE");
		});

		it("rejects invalid personId", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: null }, // person NOT found
			]);

			const res = await app.fetch(
				makeRequest("POST", BASE, {
					title: "Doc",
					personIds: ["550e8400-e29b-41d4-a716-446655440000"],
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_PERSON");
		});

		it("rejects empty title", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", BASE, { title: "" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/w/:wid/documents/:id", () => {
		it("returns document", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue({
				id: "d-1",
				workspace_id: WID,
				type_id: null,
				title: "Doc",
				content: "Content",
				event_date: null,
				version: 1,
				created_at: "2026-01-01T00:00:00Z",
				updated_at: "2026-01-01T00:00:00Z",
			});

			const res = await app.fetch(makeRequest("GET", `${BASE}/d-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.id).toBe("d-1");
		});

		it("returns 404", async () => {
			const { db, mockFirst } = createMockD1();
			mockFirst.mockResolvedValue(null);

			const res = await app.fetch(makeRequest("GET", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});

	describe("PUT /api/w/:wid/documents/:id", () => {
		it("updates document and increments version", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { version: 3, title: "Old", content: "Old content" } },
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/d-1`, { title: "Updated", content: "New content" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.version).toBe(4);
		});

		it("updates typeId and eventDate", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { version: 1, title: "Doc", content: "Content" } },
			]);
			(db as unknown as { batch: () => Promise<unknown[]> }).batch = async () => [];

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/d-1`, {
					typeId: "550e8400-e29b-41d4-a716-446655440000",
					eventDate: "2026-06-01",
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.version).toBe(2);
		});

		it("returns 404 for missing document", async () => {
			const { db } = createSequenceD1([{ type: "first", value: null }]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/missing`, { title: "X" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});

	describe("DELETE /api/w/:wid/documents/:id", () => {
		it("deletes document", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/d-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});

		it("returns 404", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 0 } });

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});

	describe("GET /api/w/:wid/documents/:id/versions", () => {
		it("returns version history", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "d-1" } }, // document exists in workspace
				{
					type: "all",
					value: {
						results: [
							{
								id: "v-2",
								document_id: "d-1",
								version: 2,
								title: "Updated",
								content: "New",
								created_at: "2026-05-21T00:00:00Z",
							},
							{
								id: "v-1",
								document_id: "d-1",
								version: 1,
								title: "Initial",
								content: "Old",
								created_at: "2026-05-20T00:00:00Z",
							},
						],
						success: true,
					},
				},
			]);

			const res = await app.fetch(makeRequest("GET", `${BASE}/d-1/versions`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data).toHaveLength(2);
			expect(json.data[0].version).toBe(2);
		});

		it("returns 404 when document not in workspace", async () => {
			const { db } = createSequenceD1([{ type: "first", value: null }]);

			const res = await app.fetch(makeRequest("GET", `${BASE}/other-doc/versions`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});

	describe("document-person associations", () => {
		it("GET /:id/persons returns associations", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [{ workspace_id: WID, document_id: "d-1", person_id: "p-1", role: "subject" }],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", `${BASE}/d-1/persons`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data[0].personId).toBe("p-1");
		});

		it("POST /:id/persons adds association", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { id: "550e8400-e29b-41d4-a716-446655440000" } }, // person exists
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(
				makeRequest("POST", `${BASE}/d-1/persons`, {
					personId: "550e8400-e29b-41d4-a716-446655440000",
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
		});

		it("POST /:id/persons rejects non-existent person", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: null }, // person NOT found
			]);

			const res = await app.fetch(
				makeRequest("POST", `${BASE}/d-1/persons`, {
					personId: "550e8400-e29b-41d4-a716-446655440000",
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_PERSON");
		});

		it("DELETE /:id/persons/:personId removes association", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/d-1/persons/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.removed).toBe(true);
		});
		it("POST /:id/persons rejects invalid body", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", `${BASE}/d-1/persons`, {}), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});

		it("DELETE /:id/persons/:personId returns 404", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 0 } });

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/d-1/persons/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});
});
