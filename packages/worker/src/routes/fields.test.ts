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
const BASE = `/api/w/${WID}/fields`;

describe("field routes", () => {
	describe("GET /api/w/:wid/fields", () => {
		it("returns field definitions", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "f-1",
						workspace_id: WID,
						name: "Department",
						field_type: "text",
						options: null,
						sort_order: 0,
						required: 1,
						default_value: null,
						created_at: "2026-01-01T00:00:00Z",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", BASE), { DB: db, ENVIRONMENT: "test" });
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data[0]).toEqual({
				id: "f-1",
				workspaceId: WID,
				name: "Department",
				fieldType: "text",
				options: null,
				sortOrder: 0,
				required: true,
				defaultValue: null,
				createdAt: "2026-01-01T00:00:00Z",
			});
		});

		it("parses JSON options", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "f-2",
						workspace_id: WID,
						name: "Location",
						field_type: "select",
						options: '["NYC","SF","Remote"]',
						sort_order: 1,
						required: 0,
						default_value: "Remote",
						created_at: "2026-01-01T00:00:00Z",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", BASE), { DB: db, ENVIRONMENT: "test" });
			const json = await res.json();
			expect(json.data[0].options).toEqual(["NYC", "SF", "Remote"]);
			expect(json.data[0].defaultValue).toBe("Remote");
		});
	});

	describe("POST /api/w/:wid/fields", () => {
		it("creates text field", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(
				makeRequest("POST", BASE, { name: "Department", fieldType: "text" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.name).toBe("Department");
			expect(json.data.fieldType).toBe("text");
			expect(json.data.required).toBe(false);
		});

		it("creates select field with options", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(
				makeRequest("POST", BASE, {
					name: "Location",
					fieldType: "select",
					options: ["NYC", "SF"],
					required: true,
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(201);
			const json = await res.json();
			expect(json.data.options).toEqual(["NYC", "SF"]);
			expect(json.data.required).toBe(true);
		});

		it("rejects invalid field type", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("POST", BASE, { name: "X", fieldType: "invalid" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});

		describe("CLI query → body bridge for options", () => {
			it("accepts options as a query CSV when body omits it", async () => {
				const { db } = createSequenceD1([
					{ type: "run", value: { success: true, meta: { changes: 1 } } },
				]);

				const res = await app.fetch(
					makeRequest("POST", `${BASE}?options=NYC,SF,LON`, {
						name: "Location",
						fieldType: "select",
					}),
					{ DB: db, ENVIRONMENT: "test" },
				);
				expect(res.status).toBe(201);
				const json = await res.json();
				expect(json.data.options).toEqual(["NYC", "SF", "LON"]);
			});

			it("does not invent options when neither body nor query provides it", async () => {
				const { db } = createSequenceD1([
					{ type: "run", value: { success: true, meta: { changes: 1 } } },
				]);

				const res = await app.fetch(
					makeRequest("POST", BASE, { name: "Notes", fieldType: "text" }),
					{ DB: db, ENVIRONMENT: "test" },
				);
				expect(res.status).toBe(201);
				const json = await res.json();
				expect(json.data.options).toBeNull();
			});

			it("prefers body options over query CSV when both are present", async () => {
				const { db } = createSequenceD1([
					{ type: "run", value: { success: true, meta: { changes: 1 } } },
				]);

				const res = await app.fetch(
					makeRequest("POST", `${BASE}?options=FROM_QUERY`, {
						name: "Region",
						fieldType: "select",
						options: ["FROM_BODY"],
					}),
					{ DB: db, ENVIRONMENT: "test" },
				);
				expect(res.status).toBe(201);
				const json = await res.json();
				expect(json.data.options).toEqual(["FROM_BODY"]);
			});
		});
	});

	describe("PUT /api/w/:wid/fields/:id", () => {
		it("updates field name", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/f-1`, { name: "Team" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(true);
		});

		it("updates options, required, defaultValue, sortOrder", async () => {
			const { db } = createSequenceD1([
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/f-1`, {
					options: ["A", "B"],
					required: true,
					defaultValue: "A",
					sortOrder: 3,
				}),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(true);
		});

		it("returns 404 for missing field", async () => {
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
			const res = await app.fetch(makeRequest("PUT", `${BASE}/f-1`, {}), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(false);
		});

		describe("CLI query → body bridge for options", () => {
			it("accepts options as a query CSV when body omits it", async () => {
				const { db } = createSequenceD1([
					{ type: "run", value: { success: true, meta: { changes: 1 } } },
				]);

				const res = await app.fetch(makeRequest("PUT", `${BASE}/f-1?options=A,B,C`, {}), {
					DB: db,
					ENVIRONMENT: "test",
				});
				expect(res.status).toBe(200);
				const json = await res.json();
				expect(json.data.updated).toBe(true);
			});

			it("does not invent options when neither body nor query provides it", async () => {
				const { db } = createMockD1();
				const res = await app.fetch(makeRequest("PUT", `${BASE}/f-1`, {}), {
					DB: db,
					ENVIRONMENT: "test",
				});
				expect(res.status).toBe(200);
				const json = await res.json();
				// No options query, no body options → no update column → updated:false
				expect(json.data.updated).toBe(false);
			});

			it("prefers body options over query CSV when both are present", async () => {
				const { db } = createSequenceD1([
					{ type: "run", value: { success: true, meta: { changes: 1 } } },
				]);

				const res = await app.fetch(
					makeRequest("PUT", `${BASE}/f-1?options=FROM_QUERY`, {
						options: ["FROM_BODY"],
					}),
					{ DB: db, ENVIRONMENT: "test" },
				);
				expect(res.status).toBe(200);
				const json = await res.json();
				expect(json.data.updated).toBe(true);
			});
		});
	});

	describe("DELETE /api/w/:wid/fields/:id", () => {
		it("deletes field definition", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 1 } });

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/f-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});

		it("returns 404 for missing field", async () => {
			const { db, mockRun } = createMockD1();
			mockRun.mockResolvedValue({ success: true, meta: { changes: 0 } });

			const res = await app.fetch(makeRequest("DELETE", `${BASE}/missing`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(404);
		});
	});

	describe("GET /api/w/:wid/fields/values/:personId", () => {
		it("returns field values for person", async () => {
			const { db, mockAll } = createMockD1();
			mockAll.mockResolvedValue({
				results: [
					{
						id: "v-1",
						workspace_id: WID,
						person_id: "p-1",
						field_def_id: "f-1",
						value: "Engineering",
					},
				],
				success: true,
			});

			const res = await app.fetch(makeRequest("GET", `${BASE}/values/p-1`), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data[0]).toEqual({
				id: "v-1",
				workspaceId: WID,
				personId: "p-1",
				fieldDefId: "f-1",
				value: "Engineering",
			});
		});
	});

	describe("PUT /api/w/:wid/fields/values/:personId/:fieldDefId", () => {
		it("sets text field value (upsert)", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "text", options: null } }, // field def
				{ type: "first", value: { id: "p-1" } }, // person exists
				{ type: "run", value: { success: true, meta: { changes: 1 } } }, // upsert
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "Sales" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.value).toBe("Sales");
		});

		it("returns 404 for missing field definition", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: null }, // field def NOT found
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-1/f-missing`, { value: "X" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(404);
		});

		it("returns 404 for missing person", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "text", options: null } }, // field def exists
				{ type: "first", value: null }, // person NOT found
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-missing/f-1`, { value: "X" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(404);
		});

		it("rejects invalid number value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "number", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "not-a-number" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_VALUE");
		});

		it("rejects Infinity as number value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "number", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "Infinity" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_VALUE");
		});

		it("rejects whitespace-only number value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "number", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "  " }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_VALUE");
		});

		it("rejects invalid date value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "date", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "yesterday" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_VALUE");
		});

		it("rejects impossible date like 2026-99-99", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "date", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "2026-99-99" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_VALUE");
		});

		it("rejects invalid boolean value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "boolean", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "yes" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_VALUE");
		});

		it("rejects invalid select value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "select", options: '["A","B","C"]' } },
				{ type: "first", value: { id: "p-1" } }, // person exists
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "D" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_VALUE");
		});

		it("rejects select value when field has no options", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "select", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "anything" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(400);
			const json = await res.json();
			expect(json.error.code).toBe("INVALID_VALUE");
		});

		it("accepts valid select value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "select", options: '["NYC","SF"]' } },
				{ type: "first", value: { id: "p-1" } }, // person exists
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "NYC" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.value).toBe("NYC");
		});

		it("accepts valid number value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "number", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "42.5" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
		});

		it("accepts valid date value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "date", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(
				makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "2026-05-24" }),
				{ DB: db, ENVIRONMENT: "test" },
			);
			expect(res.status).toBe(200);
		});

		it("accepts valid boolean value", async () => {
			const { db } = createSequenceD1([
				{ type: "first", value: { field_type: "boolean", options: null } },
				{ type: "first", value: { id: "p-1" } }, // person exists
				{ type: "run", value: { success: true, meta: { changes: 1 } } },
			]);

			const res = await app.fetch(makeRequest("PUT", `${BASE}/values/p-1/f-1`, { value: "true" }), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(200);
		});

		it("rejects missing value", async () => {
			const { db } = createMockD1();
			const res = await app.fetch(makeRequest("PUT", `${BASE}/values/p-1/f-1`, {}), {
				DB: db,
				ENVIRONMENT: "test",
			});
			expect(res.status).toBe(400);
		});
	});
});
