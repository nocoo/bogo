import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApi } from "./index.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.restoreAllMocks();
});

function ok(data: unknown, status = 200) {
	return new Response(JSON.stringify({ data }), { status });
}

describe("workspaceApi", () => {
	const { workspaces } = createApi();

	it("list fetches GET /api/workspaces", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "ws-1", name: "Corp" }]));
		const result = await workspaces.list();
		expect(result).toEqual([{ id: "ws-1", name: "Corp" }]);
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ body: undefined }),
		);
	});

	it("get fetches GET /api/workspaces/:id", async () => {
		mockFetch.mockResolvedValue(ok({ id: "ws-1" }));
		await workspaces.get("ws-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/workspaces/ws-1", expect.any(Object));
	});

	it("create posts to /api/workspaces", async () => {
		mockFetch.mockResolvedValue(ok({ id: "ws-new" }, 201));
		await workspaces.create({ name: "New", ownerId: "u-1", rootPersonName: "CEO" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("update puts to /api/workspaces/:id", async () => {
		mockFetch.mockResolvedValue(ok({ id: "ws-1" }));
		await workspaces.update("ws-1", { name: "Updated" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/workspaces/ws-1",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("delete sends DELETE /api/workspaces/:id", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		const result = await workspaces.delete("ws-1");
		expect(result).toEqual({ deleted: true });
	});
});

describe("personApi", () => {
	const { persons } = createApi();

	it("list fetches persons for workspace", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "p-1" }]));
		await persons.list("ws-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/persons", expect.any(Object));
	});

	it("get fetches single person", async () => {
		mockFetch.mockResolvedValue(ok({ id: "p-1" }));
		await persons.get("ws-1", "p-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/persons/p-1", expect.any(Object));
	});

	it("create posts new person", async () => {
		mockFetch.mockResolvedValue(ok({ id: "p-new" }, 201));
		await persons.create("ws-1", { name: "Dev", title: "SWE", managerId: "p-root" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/persons",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("update puts person changes", async () => {
		mockFetch.mockResolvedValue(ok({ id: "p-1", name: "Updated" }));
		await persons.update("ws-1", "p-1", { name: "Updated" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/persons/p-1",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("move puts to /move endpoint", async () => {
		mockFetch.mockResolvedValue(ok({ moved: true }));
		const result = await persons.move("ws-1", "p-1", { managerId: "p-2" });
		expect(result).toEqual({ moved: true });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/persons/p-1/move",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("delete sends DELETE", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		await persons.delete("ws-1", "p-1");
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/persons/p-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});

describe("fieldApi", () => {
	const { fields } = createApi();

	it("listDefs fetches field definitions", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "f-1" }]));
		await fields.listDefs("ws-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/fields", expect.any(Object));
	});

	it("createDef posts new field", async () => {
		mockFetch.mockResolvedValue(ok({ id: "f-new" }, 201));
		await fields.createDef("ws-1", { name: "Dept", fieldType: "text", required: false });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/fields",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("updateDef puts field changes", async () => {
		mockFetch.mockResolvedValue(ok({ updated: true }));
		await fields.updateDef("ws-1", "f-1", { name: "Team" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/fields/f-1",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("deleteDef deletes field", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		await fields.deleteDef("ws-1", "f-1");
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/fields/f-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("getValues fetches person field values", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "v-1" }]));
		await fields.getValues("ws-1", "p-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/fields/values/p-1", expect.any(Object));
	});

	it("setValue puts field value", async () => {
		mockFetch.mockResolvedValue(ok({ id: "v-1", value: "Engineering" }));
		await fields.setValue("ws-1", "p-1", "f-1", { value: "Engineering" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/fields/values/p-1/f-1",
			expect.objectContaining({ method: "PUT" }),
		);
	});
});

describe("docTypeApi", () => {
	const { docTypes } = createApi();

	it("list fetches doc types", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "dt-1" }]));
		await docTypes.list("ws-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/doc-types", expect.any(Object));
	});

	it("create posts new doc type", async () => {
		mockFetch.mockResolvedValue(ok({ id: "dt-new" }, 201));
		await docTypes.create("ws-1", { name: "Notes" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/doc-types",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("update puts doc type changes", async () => {
		mockFetch.mockResolvedValue(ok({ updated: true }));
		await docTypes.update("ws-1", "dt-1", { name: "Meeting Notes" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/doc-types/dt-1",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("delete removes doc type", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		await docTypes.delete("ws-1", "dt-1");
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/doc-types/dt-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});

describe("documentApi", () => {
	const { documents } = createApi();

	it("list fetches documents", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "d-1" }]));
		await documents.list("ws-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/documents", expect.any(Object));
	});

	it("get fetches single document", async () => {
		mockFetch.mockResolvedValue(ok({ id: "d-1" }));
		await documents.get("ws-1", "d-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/documents/d-1", expect.any(Object));
	});

	it("create posts new document", async () => {
		mockFetch.mockResolvedValue(ok({ id: "d-new" }, 201));
		await documents.create("ws-1", { title: "Q1 Review", content: "# Summary", personIds: [] });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/documents",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("update puts document changes", async () => {
		mockFetch.mockResolvedValue(ok({ id: "d-1", version: 2 }));
		await documents.update("ws-1", "d-1", { title: "Updated" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/documents/d-1",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("delete removes document", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		await documents.delete("ws-1", "d-1");
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/documents/d-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});

	it("listVersions fetches version history", async () => {
		mockFetch.mockResolvedValue(ok([{ version: 1 }, { version: 2 }]));
		await documents.listVersions("ws-1", "d-1");
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/documents/d-1/versions",
			expect.any(Object),
		);
	});

	it("listPersons fetches associated persons", async () => {
		mockFetch.mockResolvedValue(ok([{ personId: "p-1" }]));
		await documents.listPersons("ws-1", "d-1");
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/documents/d-1/persons", expect.any(Object));
	});

	it("addPerson posts person association", async () => {
		mockFetch.mockResolvedValue(ok({ personId: "p-1" }, 201));
		await documents.addPerson("ws-1", "d-1", { personId: "p-1", role: "subject" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/documents/d-1/persons",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("removePerson deletes person association", async () => {
		mockFetch.mockResolvedValue(ok({ removed: true }));
		await documents.removePerson("ws-1", "d-1", "p-1");
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/documents/d-1/persons/p-1",
			expect.objectContaining({ method: "DELETE" }),
		);
	});
});
