import { describe, expect, it } from "vitest";

const BASE = process.env.BOGO_E2E_BASE || "http://localhost:17036";

function api(path: string, init?: RequestInit) {
	return fetch(`${BASE}${path}`, {
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

describe("workspace CRUD (real D1)", () => {
	let wsId: string;

	it("POST /api/workspaces creates workspace with root person", async () => {
		const res = await api("/api/workspaces", {
			method: "POST",
			body: JSON.stringify({ name: "E2E Corp", ownerId: "owner-1", rootPersonName: "CEO" }),
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		wsId = json.data.id;
		expect(json.data.name).toBe("E2E Corp");
	});

	it("GET /api/workspaces returns list", async () => {
		const res = await api("/api/workspaces");
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.length).toBeGreaterThan(0);
	});

	it("GET /api/workspaces/:id returns workspace", async () => {
		const res = await api(`/api/workspaces/${wsId}`);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.id).toBe(wsId);
	});

	it("PUT /api/workspaces/:id updates workspace", async () => {
		const res = await api(`/api/workspaces/${wsId}`, {
			method: "PUT",
			body: JSON.stringify({ name: "E2E Corp Updated" }),
		});
		expect(res.status).toBe(200);
	});

	describe("persons (real D1)", () => {
		let rootId: string;
		let childId: string;

		it("GET /api/w/:wid/persons returns persons including root", async () => {
			const res = await api(`/api/w/${wsId}/persons`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBeGreaterThan(0);
			const root = json.data.find((p: { isRoot: boolean }) => p.isRoot);
			expect(root).toBeDefined();
			rootId = root.id;
		});

		it("POST /api/w/:wid/persons creates child", async () => {
			const res = await api(`/api/w/${wsId}/persons`, {
				method: "POST",
				body: JSON.stringify({ name: "Engineer", title: "SWE", managerId: rootId }),
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			childId = json.data.id;
			expect(json.data.managerId).toBe(rootId);
		});

		it("GET /api/w/:wid/persons/:id returns person", async () => {
			const res = await api(`/api/w/${wsId}/persons/${childId}`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.name).toBe("Engineer");
		});

		it("PUT /api/w/:wid/persons/:id updates person", async () => {
			const res = await api(`/api/w/${wsId}/persons/${childId}`, {
				method: "PUT",
				body: JSON.stringify({ title: "Senior SWE" }),
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.title).toBe("Senior SWE");
		});

		it("PUT /api/w/:wid/persons/:id/move moves person", async () => {
			const res2 = await api(`/api/w/${wsId}/persons`, {
				method: "POST",
				body: JSON.stringify({ name: "Manager", managerId: rootId }),
			});
			const mgr = await res2.json();

			const res = await api(`/api/w/${wsId}/persons/${childId}/move`, {
				method: "PUT",
				body: JSON.stringify({ managerId: mgr.data.id }),
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.moved).toBe(true);
		});

		it("GET /api/w/:wid/persons/:id/documents returns person documents", async () => {
			const docRes = await api(`/api/w/${wsId}/documents`, {
				method: "POST",
				body: JSON.stringify({ title: "Person Doc", personIds: [rootId] }),
			});
			expect(docRes.status).toBe(201);

			const res = await api(`/api/w/${wsId}/persons/${rootId}/documents`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBeGreaterThan(0);
			expect(json.data[0].title).toBe("Person Doc");
		});

		it("DELETE /api/w/:wid/persons/:id deletes leaf", async () => {
			const res = await api(`/api/w/${wsId}/persons/${childId}`, {
				method: "DELETE",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});
	});

	describe("fields (real D1)", () => {
		let fieldId: string;
		let personId: string;

		it("POST /api/w/:wid/fields creates field", async () => {
			const res = await api(`/api/w/${wsId}/fields`, {
				method: "POST",
				body: JSON.stringify({ name: "Department", fieldType: "text" }),
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			fieldId = json.data.id;
		});

		it("GET /api/w/:wid/fields returns fields", async () => {
			const res = await api(`/api/w/${wsId}/fields`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBeGreaterThan(0);
		});

		it("PUT /api/w/:wid/fields/:id updates field", async () => {
			const res = await api(`/api/w/${wsId}/fields/${fieldId}`, {
				method: "PUT",
				body: JSON.stringify({ name: "Team" }),
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.updated).toBe(true);
		});

		it("PUT /api/w/:wid/fields/values/:personId/:fieldDefId sets value", async () => {
			const pRes = await api(`/api/w/${wsId}/persons`);
			const persons = await pRes.json();
			personId = persons.data[0].id;

			const res = await api(`/api/w/${wsId}/fields/values/${personId}/${fieldId}`, {
				method: "PUT",
				body: JSON.stringify({ value: "Engineering" }),
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.value).toBe("Engineering");
		});

		it("GET /api/w/:wid/fields/values/:personId returns values", async () => {
			const res = await api(`/api/w/${wsId}/fields/values/${personId}`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBeGreaterThan(0);
		});

		it("DELETE /api/w/:wid/fields/:id deletes field", async () => {
			const res = await api(`/api/w/${wsId}/fields/${fieldId}`, {
				method: "DELETE",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});
	});

	describe("doc-types (real D1)", () => {
		let typeId: string;

		it("POST /api/w/:wid/doc-types creates type", async () => {
			const res = await api(`/api/w/${wsId}/doc-types`, {
				method: "POST",
				body: JSON.stringify({ name: "Meeting Notes", color: "#3b82f6" }),
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			typeId = json.data.id;
		});

		it("GET /api/w/:wid/doc-types returns types", async () => {
			const res = await api(`/api/w/${wsId}/doc-types`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBeGreaterThan(0);
		});

		it("PUT /api/w/:wid/doc-types/:id updates type", async () => {
			const res = await api(`/api/w/${wsId}/doc-types/${typeId}`, {
				method: "PUT",
				body: JSON.stringify({ name: "Standup Notes" }),
			});
			expect(res.status).toBe(200);
		});

		it("DELETE /api/w/:wid/doc-types/:id deletes type", async () => {
			const res = await api(`/api/w/${wsId}/doc-types/${typeId}`, {
				method: "DELETE",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});
	});

	describe("documents (real D1)", () => {
		let docId: string;
		let personId: string;

		it("POST /api/w/:wid/documents creates document", async () => {
			const res = await api(`/api/w/${wsId}/documents`, {
				method: "POST",
				body: JSON.stringify({ title: "Q1 Review", content: "# Summary" }),
			});
			expect(res.status).toBe(201);
			const json = await res.json();
			docId = json.data.id;
			expect(json.data.version).toBe(1);
		});

		it("GET /api/w/:wid/documents returns documents", async () => {
			const res = await api(`/api/w/${wsId}/documents`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBeGreaterThan(0);
		});

		it("GET /api/w/:wid/documents/:id returns document", async () => {
			const res = await api(`/api/w/${wsId}/documents/${docId}`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.title).toBe("Q1 Review");
		});

		it("PUT /api/w/:wid/documents/:id updates document", async () => {
			const res = await api(`/api/w/${wsId}/documents/${docId}`, {
				method: "PUT",
				body: JSON.stringify({ title: "Q1 Review (Updated)", content: "# Updated" }),
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.version).toBe(2);
		});

		it("GET /api/w/:wid/documents/:id/versions returns versions", async () => {
			const res = await api(`/api/w/${wsId}/documents/${docId}/versions`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBe(2);
			// List of versions omits `content` — fetch a single version below.
			expect(json.data[0]).not.toHaveProperty("content");
		});

		it("GET /api/w/:wid/documents/:id/versions/:version returns one version with content", async () => {
			const res = await api(`/api/w/${wsId}/documents/${docId}/versions/1`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.version).toBe(1);
			expect(typeof json.data.content).toBe("string");
		});

		it("POST /api/w/:wid/documents/:id/persons adds person", async () => {
			const pRes = await api(`/api/w/${wsId}/persons`);
			const persons = await pRes.json();
			personId = persons.data[0].id;

			const res = await api(`/api/w/${wsId}/documents/${docId}/persons`, {
				method: "POST",
				body: JSON.stringify({ personId }),
			});
			expect(res.status).toBe(201);
		});

		it("GET /api/w/:wid/documents/:id/persons returns associations", async () => {
			const res = await api(`/api/w/${wsId}/documents/${docId}/persons`);
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.length).toBeGreaterThan(0);
		});

		it("DELETE /api/w/:wid/documents/:id/persons/:personId removes association", async () => {
			const res = await api(`/api/w/${wsId}/documents/${docId}/persons/${personId}`, {
				method: "DELETE",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.removed).toBe(true);
		});

		it("DELETE /api/w/:wid/documents/:id deletes document", async () => {
			const res = await api(`/api/w/${wsId}/documents/${docId}`, {
				method: "DELETE",
			});
			expect(res.status).toBe(200);
			const json = await res.json();
			expect(json.data.deleted).toBe(true);
		});
	});

	it("DELETE /api/workspaces/:id deletes workspace (after cleanup)", async () => {
		const pRes = await api(`/api/w/${wsId}/persons`);
		const persons = await pRes.json();
		const nonRoot = persons.data.filter((p: { isRoot: boolean }) => !p.isRoot);
		for (const p of nonRoot) {
			await api(`/api/w/${wsId}/persons/${p.id}`, { method: "DELETE" });
		}

		const res = await api(`/api/workspaces/${wsId}`, { method: "DELETE" });
		expect(res.status).toBe(200);
	});
});
