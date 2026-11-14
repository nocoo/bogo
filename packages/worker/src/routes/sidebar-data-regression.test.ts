import { describe, expect, it, vi } from "vitest";
import app from "../index.js";
import { createMockD1 } from "../test-utils/mock-d1.js";
import { detectCycle } from "./persons.js";

const workspace = "ws-regression";
const manager = "550e8400-e29b-41d4-a716-446655440000";
const dotted = "660e8400-e29b-41d4-a716-446655440001";
const row = {
	id: "person",
	workspace_id: workspace,
	name: "Member",
	title: "",
	manager_id: manager,
	dotted_manager_id: null,
	is_root: 0,
	sort_order: 0,
};

function request(method: string, path: string, body?: unknown) {
	return new Request(`http://localhost/api/w/${workspace}/${path}`, {
		method,
		headers: { host: "localhost", "Content-Type": "application/json" },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

const all = (results: unknown[]) => ({ results, success: true });

describe("sidebar workspace data boundary cases", () => {
	it("rejects an invalid field edit before any database write", async () => {
		const mock = createMockD1();
		const response = await app.fetch(request("PUT", "fields/field", { name: "" }), { DB: mock.db });
		expect(response.status).toBe(400);
		expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
		expect(mock.mockRun).not.toHaveBeenCalled();
	});
	it("keeps creation defaults and chart visibility in field bindings", async () => {
		const mock = createMockD1();
		const response = await app.fetch(
			request("POST", "fields", {
				name: "Office",
				fieldType: "text",
				showOnChart: true,
				required: true,
				defaultValue: "HQ",
			}),
			{ DB: mock.db },
		);
		expect(response.status).toBe(201);
		expect((await response.json()).data).toMatchObject({
			name: "Office",
			showOnChart: true,
			required: true,
			defaultValue: "HQ",
			options: null,
		});
		expect(mock.mockBind).toHaveBeenCalledWith(
			expect.any(String),
			workspace,
			"Office",
			"text",
			null,
			1,
			"HQ",
			1,
			expect.any(String),
		);
	});

	it.each([true, false])(
		"persists field chart visibility %s along with type and order",
		async (showOnChart) => {
			const mock = createMockD1();
			const response = await app.fetch(
				request("PUT", "fields/field", {
					name: "Rank",
					fieldType: "number",
					sortOrder: 3,
					required: false,
					showOnChart,
				}),
				{ DB: mock.db },
			);
			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ data: { updated: true } });
			expect(mock.mockBind).toHaveBeenCalledWith(
				"Rank",
				"number",
				0,
				3,
				showOnChart ? 1 : 0,
				"field",
				workspace,
			);
		},
	);

	it("accepts CLI options but preserves explicit body options", async () => {
		for (const options of [undefined, ["Body"]]) {
			const mock = createMockD1();
			const response = await app.fetch(
				request(
					"PUT",
					"fields/field?options=CLI,,Other",
					options ? { options } : { fieldType: "select" },
				),
				{ DB: mock.db },
			);
			expect(response.status).toBe(200);
			expect(mock.mockBind.mock.calls[0]).toContain(JSON.stringify(options ?? ["CLI", "Other"]));
		}
	});

	it("groups several person tags, normalizes empty color, and leaves untagged people empty", async () => {
		const mock = createMockD1();
		mock.mockAll
			.mockResolvedValueOnce(all([row, { ...row, id: "untagged" }]))
			.mockResolvedValueOnce(
				all([
					{ person_id: "person", id: "one", name: "One", color: "" },
					{ person_id: "person", id: "two", name: "Two", color: "#123456" },
				]),
			);
		const response = await app.fetch(request("GET", "persons"), { DB: mock.db });
		const data = (await response.json()).data;
		expect(data[0].tags).toEqual([
			{ id: "one", name: "One", color: null },
			{ id: "two", name: "Two", color: "#123456" },
		]);
		expect(data[1].tags).toEqual([]);
	});

	it("creates a person with a valid dotted manager and an omitted title", async () => {
		const mock = createMockD1();
		mock.mockFirst.mockResolvedValue({ id: manager });
		const response = await app.fetch(
			request("POST", "persons", { name: "New", managerId: manager, dottedManagerId: dotted }),
			{ DB: mock.db },
		);
		expect(response.status).toBe(201);
		expect((await response.json()).data).toMatchObject({ title: "", dottedManagerId: dotted });
		expect(mock.mockBind).toHaveBeenCalledWith(
			expect.any(String),
			workspace,
			"New",
			"",
			manager,
			dotted,
			null,
			expect.any(String),
			expect.any(String),
		);
	});

	it.each([null, dotted])(
		"updates dotted manager to %s without losing identity",
		async (dottedManagerId) => {
			const mock = createMockD1();
			mock.mockFirst.mockResolvedValue({ ...row, dotted_manager_id: dottedManagerId });
			const response = await app.fetch(request("PUT", "persons/person", { dottedManagerId }), {
				DB: mock.db,
			});
			expect(response.status).toBe(200);
			expect((await response.json()).data.dottedManagerId).toBe(dottedManagerId);
			expect(mock.mockBind).toHaveBeenCalledWith(
				dottedManagerId,
				expect.any(String),
				"person",
				workspace,
			);
		},
	);

	it("rejects an indirect manager cycle before writing the move", async () => {
		const mock = createMockD1();
		mock.mockFirst
			.mockResolvedValueOnce(row)
			.mockResolvedValueOnce({ id: manager })
			.mockResolvedValueOnce({ manager_id: "person" });
		const response = await app.fetch(
			request("PUT", "persons/person/move", { managerId: manager }),
			{ DB: mock.db },
		);
		expect(response.status).toBe(400);
		expect((await response.json()).error.code).toBe("CYCLE_DETECTED");
		expect(mock.mockRun).not.toHaveBeenCalled();
	});

	it("terminates existing corrupt manager loops and absent ancestor rows", async () => {
		const loop = createMockD1();
		loop.mockFirst.mockResolvedValue({ manager_id: manager });
		expect(await detectCycle(loop.db, workspace, "person", manager)).toBe(false);
		expect(loop.mockFirst).toHaveBeenCalledTimes(1);
		const missing = createMockD1();
		expect(await detectCycle(missing.db, workspace, "person", manager)).toBe(false);
	});

	it("merges document tags without leaking tags to another document", async () => {
		const mock = createMockD1();
		mock.mockFirst.mockResolvedValue({ id: "person" });
		mock.mockAll
			.mockResolvedValueOnce(
				all([
					{ id: "doc", workspace_id: workspace },
					{ id: "empty", workspace_id: workspace },
				]),
			)
			.mockResolvedValueOnce(
				all([
					{ document_id: "doc", id: "one", name: "One", color: null },
					{ document_id: "doc", id: "two", name: "Two", color: "#123456" },
				]),
			);
		const response = await app.fetch(request("GET", "persons/person/documents"), { DB: mock.db });
		const data = (await response.json()).data;
		expect(data[0].tags).toHaveLength(2);
		expect(data[0].tags[0].color).toBeNull();
		expect(data[1].tags).toEqual([]);
	});

	it("loads person tag counts and stats with zero-count defaults", async () => {
		const mock = createMockD1();
		mock.mockAll.mockResolvedValue(
			all([{ id: "tag", name: "Tag", scope: "person", sort_order: 0 }]),
		);
		const counted = await app.fetch(request("GET", "tags?scope=person&includeCounts=true"), {
			DB: mock.db,
		});
		expect((await counted.json()).data[0].assignedCount).toBe(0);
		expect(mock.mockPrepare.mock.calls[0][0]).toContain("tag_persons");
		const stats = await app.fetch(request("GET", "tags/stats?scope=person"), { DB: mock.db });
		expect((await stats.json()).data[0].count).toBe(0);
		const invalid = await app.fetch(request("GET", "tags/stats?scope=unknown"), { DB: mock.db });
		expect(invalid.status).toBe(400);
	});

	it.each(["tags", "tags/tag/documents/doc", "tags/tag/persons/person"])(
		"does not relabel unexpected storage failure at %s as a conflict",
		async (path) => {
			const mock = createMockD1();
			mock.mockFirst.mockResolvedValue({
				scope: path.includes("documents") ? "document" : "person",
			});
			mock.mockRun.mockRejectedValue(new Error("Disk unavailable"));
			const logger = vi.spyOn(console, "error").mockImplementation(() => {});
			try {
				const response = await app.fetch(
					request(
						path === "tags" ? "POST" : "PUT",
						path,
						path === "tags" ? { name: "Tag", scope: "person" } : undefined,
					),
					{ DB: mock.db },
				);
				expect(response.status).toBe(500);
				expect(logger).toHaveBeenCalled();
			} finally {
				logger.mockRestore();
			}
		},
	);
});
