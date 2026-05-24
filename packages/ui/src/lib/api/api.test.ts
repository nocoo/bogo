import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApi } from "./index.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.clearAllMocks();
});

function ok(data: unknown, status = 200) {
	return new Response(JSON.stringify({ data }), { status });
}

function sentBody(): unknown {
	const body = mockFetch.mock.calls[0][1]?.body;
	return body ? JSON.parse(body) : undefined;
}

describe("workspaceApi", () => {
	const { workspaces } = createApi();

	it("list fetches GET /api/workspaces and returns Workspace[]", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "ws-1", name: "Corp" }]));
		const result = await workspaces.list();
		expect(result).toEqual([{ id: "ws-1", name: "Corp" }]);
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ body: undefined }),
		);
	});

	it("get fetches GET /api/workspaces/:id", async () => {
		mockFetch.mockResolvedValue(ok({ id: "ws-1", name: "Corp" }));
		const result = await workspaces.get("ws-1");
		expect(result).toEqual({ id: "ws-1", name: "Corp" });
		expect(mockFetch).toHaveBeenCalledWith("/api/workspaces/ws-1", expect.any(Object));
	});

	it("create posts only { name } to /api/workspaces", async () => {
		mockFetch.mockResolvedValue(ok({ id: "ws-new", name: "New" }, 201));
		const result = await workspaces.create({ name: "New" });
		expect(sentBody()).toEqual({ name: "New" });
		expect(result).toEqual({ id: "ws-new", name: "New" });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/workspaces",
			expect.objectContaining({ method: "POST" }),
		);
	});

	it("update puts { name } to /api/workspaces/:id", async () => {
		mockFetch.mockResolvedValue(ok({ id: "ws-1", name: "Updated" }));
		const result = await workspaces.update("ws-1", { name: "Updated" });
		expect(sentBody()).toEqual({ name: "Updated" });
		expect(result).toEqual({ id: "ws-1", name: "Updated" });
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
		mockFetch.mockResolvedValue(ok([{ id: "p-1", name: "CEO", isRoot: true }]));
		const result = await persons.list("ws-1");
		expect(result).toEqual([{ id: "p-1", name: "CEO", isRoot: true }]);
		expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/persons", expect.any(Object));
	});

	it("get fetches single person", async () => {
		mockFetch.mockResolvedValue(ok({ id: "p-1", name: "Dev" }));
		const result = await persons.get("ws-1", "p-1");
		expect(result).toEqual({ id: "p-1", name: "Dev" });
	});

	it("create sends full person input and returns Person", async () => {
		const personData = {
			id: "p-new",
			name: "Dev",
			title: "SWE",
			managerId: "p-root",
			isRoot: false,
		};
		mockFetch.mockResolvedValue(ok(personData, 201));
		const result = await persons.create("ws-1", { name: "Dev", title: "SWE", managerId: "p-root" });
		expect(sentBody()).toEqual({ name: "Dev", title: "SWE", managerId: "p-root" });
		expect(result).toEqual(personData);
	});

	it("update sends partial fields and returns updated Person", async () => {
		mockFetch.mockResolvedValue(ok({ id: "p-1", name: "Updated", title: "Staff" }));
		const result = await persons.update("ws-1", "p-1", { name: "Updated" });
		expect(sentBody()).toEqual({ name: "Updated" });
		expect(result).toEqual({ id: "p-1", name: "Updated", title: "Staff" });
	});

	it("move sends { managerId } and returns { moved: true }", async () => {
		mockFetch.mockResolvedValue(ok({ moved: true }));
		const result = await persons.move("ws-1", "p-1", { managerId: "p-2" });
		expect(sentBody()).toEqual({ managerId: "p-2" });
		expect(result).toEqual({ moved: true });
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/persons/p-1/move",
			expect.objectContaining({ method: "PUT" }),
		);
	});

	it("delete sends DELETE and returns { deleted: true }", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		const result = await persons.delete("ws-1", "p-1");
		expect(result).toEqual({ deleted: true });
	});
});

describe("fieldApi", () => {
	const { fields } = createApi();

	it("listDefs fetches field definitions", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "f-1", name: "Dept", fieldType: "text" }]));
		const result = await fields.listDefs("ws-1");
		expect(result).toEqual([{ id: "f-1", name: "Dept", fieldType: "text" }]);
	});

	it("createDef posts field definition body", async () => {
		mockFetch.mockResolvedValue(ok({ id: "f-new", name: "Dept", fieldType: "text" }, 201));
		const result = await fields.createDef("ws-1", {
			name: "Dept",
			fieldType: "text",
			required: false,
		});
		expect(sentBody()).toEqual({ name: "Dept", fieldType: "text", required: false });
		expect(result).toEqual({ id: "f-new", name: "Dept", fieldType: "text" });
	});

	it("updateDef puts field changes and returns { updated: true }", async () => {
		mockFetch.mockResolvedValue(ok({ updated: true }));
		const result = await fields.updateDef("ws-1", "f-1", { name: "Team" });
		expect(sentBody()).toEqual({ name: "Team" });
		expect(result).toEqual({ updated: true });
	});

	it("deleteDef deletes field", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		const result = await fields.deleteDef("ws-1", "f-1");
		expect(result).toEqual({ deleted: true });
	});

	it("getValues fetches person field values", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "v-1", personId: "p-1", value: "Eng" }]));
		const result = await fields.getValues("ws-1", "p-1");
		expect(result).toEqual([{ id: "v-1", personId: "p-1", value: "Eng" }]);
	});

	it("setValue sends { value } and returns { personId, fieldDefId, value }", async () => {
		mockFetch.mockResolvedValue(ok({ personId: "p-1", fieldDefId: "f-1", value: "Engineering" }));
		const result = await fields.setValue("ws-1", "p-1", "f-1", { value: "Engineering" });
		expect(sentBody()).toEqual({ value: "Engineering" });
		expect(result).toEqual({ personId: "p-1", fieldDefId: "f-1", value: "Engineering" });
	});
});

describe("docTypeApi", () => {
	const { docTypes } = createApi();

	it("list fetches doc types", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "dt-1", name: "Notes" }]));
		const result = await docTypes.list("ws-1");
		expect(result).toEqual([{ id: "dt-1", name: "Notes" }]);
	});

	it("create posts { name, color } and returns DocumentType", async () => {
		mockFetch.mockResolvedValue(ok({ id: "dt-new", name: "Notes", color: "#3b82f6" }, 201));
		const result = await docTypes.create("ws-1", { name: "Notes", color: "#3b82f6" });
		expect(sentBody()).toEqual({ name: "Notes", color: "#3b82f6" });
		expect(result).toEqual({ id: "dt-new", name: "Notes", color: "#3b82f6" });
	});

	it("update puts doc type changes", async () => {
		mockFetch.mockResolvedValue(ok({ updated: true }));
		const result = await docTypes.update("ws-1", "dt-1", { name: "Meeting Notes" });
		expect(sentBody()).toEqual({ name: "Meeting Notes" });
		expect(result).toEqual({ updated: true });
	});

	it("delete removes doc type and returns { deleted: true }", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		const result = await docTypes.delete("ws-1", "dt-1");
		expect(result).toEqual({ deleted: true });
	});
});

describe("documentApi", () => {
	const { documents } = createApi();

	it("list fetches documents", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "d-1", title: "Q1" }]));
		const result = await documents.list("ws-1");
		expect(result).toEqual([{ id: "d-1", title: "Q1" }]);
	});

	it("get fetches single document with full shape", async () => {
		mockFetch.mockResolvedValue(ok({ id: "d-1", title: "Q1", version: 1 }));
		const result = await documents.get("ws-1", "d-1");
		expect(result).toEqual({ id: "d-1", title: "Q1", version: 1 });
	});

	it("create sends full document input and returns Document", async () => {
		const docData = { id: "d-new", title: "Q1 Review", version: 1 };
		mockFetch.mockResolvedValue(ok(docData, 201));
		const result = await documents.create("ws-1", {
			title: "Q1 Review",
			content: "# Summary",
			personIds: ["p-1"],
		});
		expect(sentBody()).toEqual({ title: "Q1 Review", content: "# Summary", personIds: ["p-1"] });
		expect(result).toEqual(docData);
	});

	it("update sends partial fields and returns { version }", async () => {
		mockFetch.mockResolvedValue(ok({ version: 2 }));
		const result = await documents.update("ws-1", "d-1", { title: "Updated" });
		expect(sentBody()).toEqual({ title: "Updated" });
		expect(result).toEqual({ version: 2 });
	});

	it("delete removes document and returns { deleted: true }", async () => {
		mockFetch.mockResolvedValue(ok({ deleted: true }));
		const result = await documents.delete("ws-1", "d-1");
		expect(result).toEqual({ deleted: true });
	});

	it("listVersions fetches version history", async () => {
		mockFetch.mockResolvedValue(ok([{ version: 1 }, { version: 2 }]));
		const result = await documents.listVersions("ws-1", "d-1");
		expect(result).toEqual([{ version: 1 }, { version: 2 }]);
	});

	it("listPersons fetches DocumentPerson associations", async () => {
		const assoc = { workspaceId: "ws-1", documentId: "d-1", personId: "p-1", role: "subject" };
		mockFetch.mockResolvedValue(ok([assoc]));
		const result = await documents.listPersons("ws-1", "d-1");
		expect(result).toEqual([assoc]);
	});

	it("addPerson sends { personId, role } and returns { added: true }", async () => {
		mockFetch.mockResolvedValue(ok({ added: true }, 201));
		const result = await documents.addPerson("ws-1", "d-1", { personId: "p-1", role: "subject" });
		expect(sentBody()).toEqual({ personId: "p-1", role: "subject" });
		expect(result).toEqual({ added: true });
	});

	it("removePerson deletes association and returns { removed: true }", async () => {
		mockFetch.mockResolvedValue(ok({ removed: true }));
		const result = await documents.removePerson("ws-1", "d-1", "p-1");
		expect(result).toEqual({ removed: true });
	});
});
