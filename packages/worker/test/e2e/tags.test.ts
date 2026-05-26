import { describe, expect, it } from "vitest";

const BASE = process.env.BOGO_E2E_BASE || "http://localhost:17036";

function api(path: string, init?: RequestInit) {
	return fetch(`${BASE}${path}`, {
		headers: { "Content-Type": "application/json" },
		...init,
	});
}

describe("tag CRUD (real D1)", () => {
	let wsId: string;
	let tagDocId: string;
	let tagPersonId: string;
	let personId: string;
	let docId: string;

	it("setup: create workspace", async () => {
		const res = await api("/api/workspaces", {
			method: "POST",
			body: JSON.stringify({ name: "Tag E2E", ownerId: "owner-1", rootPersonName: "Root" }),
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		wsId = json.data.id;
	});

	it("POST /api/w/:wid/tags creates document tag", async () => {
		const res = await api(`/api/w/${wsId}/tags`, {
			method: "POST",
			body: JSON.stringify({ name: "Engineering", scope: "document", color: "#3b82f6" }),
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		tagDocId = json.data.id;
		expect(json.data.name).toBe("Engineering");
		expect(json.data.scope).toBe("document");
		expect(json.data.color).toBe("#3b82f6");
	});

	it("POST /api/w/:wid/tags creates person tag", async () => {
		const res = await api(`/api/w/${wsId}/tags`, {
			method: "POST",
			body: JSON.stringify({ name: "Senior", scope: "person" }),
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		tagPersonId = json.data.id;
		expect(json.data.scope).toBe("person");
		expect(json.data.color).toBeNull();
	});

	it("POST /api/w/:wid/tags returns 409 on duplicate", async () => {
		const res = await api(`/api/w/${wsId}/tags`, {
			method: "POST",
			body: JSON.stringify({ name: "Engineering", scope: "document" }),
		});
		expect(res.status).toBe(409);
	});

	it("GET /api/w/:wid/tags returns all tags", async () => {
		const res = await api(`/api/w/${wsId}/tags`);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.length).toBe(2);
	});

	it("GET /api/w/:wid/tags returns tags filtered by scope", async () => {
		const res = await api(`/api/w/${wsId}/tags?scope=document`);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.length).toBe(1);
		expect(json.data[0].name).toBe("Engineering");
	});

	it("GET /api/w/:wid/tags with includeCounts returns assignedCount", async () => {
		const res = await api(`/api/w/${wsId}/tags?scope=document&includeCounts=true`);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data[0].assignedCount).toBe(0);
	});

	it("PUT /api/w/:wid/tags/:id updates tag", async () => {
		const res = await api(`/api/w/${wsId}/tags/${tagDocId}`, {
			method: "PUT",
			body: JSON.stringify({ name: "Eng", color: "#ef4444" }),
		});
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.updated).toBe(true);
	});

	it("setup: create person and document for assignment", async () => {
		const personsRes = await api(`/api/w/${wsId}/persons`);
		const personsJson = await personsRes.json();
		personId = personsJson.data[0].id;

		const docRes = await api(`/api/w/${wsId}/documents`, {
			method: "POST",
			body: JSON.stringify({ title: "Test Doc", content: "content" }),
		});
		expect(docRes.status).toBe(201);
		const docJson = await docRes.json();
		docId = docJson.data.id;
	});

	it("PUT /api/w/:wid/tags/:id/documents/:docId assigns tag to document", async () => {
		const res = await api(`/api/w/${wsId}/tags/${tagDocId}/documents/${docId}`, {
			method: "PUT",
		});
		expect(res.status).toBe(200);
	});

	it("PUT /api/w/:wid/tags/:id/documents/:docId is idempotent", async () => {
		const res = await api(`/api/w/${wsId}/tags/${tagDocId}/documents/${docId}`, {
			method: "PUT",
		});
		expect(res.status).toBe(200);
	});

	it("PUT /api/w/:wid/tags/:id/persons/:personId assigns tag to person", async () => {
		const res = await api(`/api/w/${wsId}/tags/${tagPersonId}/persons/${personId}`, {
			method: "PUT",
		});
		expect(res.status).toBe(200);
	});

	it("PUT /api/w/:wid/tags/:id/persons/:personId rejects scope mismatch", async () => {
		const res = await api(`/api/w/${wsId}/tags/${tagDocId}/persons/${personId}`, {
			method: "PUT",
		});
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json.error.code).toBe("SCOPE_MISMATCH");
	});

	it("GET /api/w/:wid/tags/stats returns distribution", async () => {
		const noScopeRes = await api(`/api/w/${wsId}/tags/stats`);
		expect(noScopeRes.status).toBe(400);

		const params = new URLSearchParams({ scope: "document" });
		const res = await api(`/api/w/${wsId}/tags/stats?${params}`);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.length).toBeGreaterThan(0);
		const tag = json.data.find((t: { id: string }) => t.id === tagDocId);
		expect(tag.count).toBe(1);
	});

	it("DELETE /api/w/:wid/tags/:id/documents/:docId unassigns tag", async () => {
		const res = await api(`/api/w/${wsId}/tags/${tagDocId}/documents/${docId}`, {
			method: "DELETE",
		});
		expect(res.status).toBe(200);
	});

	it("DELETE /api/w/:wid/tags/:id/persons/:personId unassigns tag", async () => {
		const res = await api(`/api/w/${wsId}/tags/${tagPersonId}/persons/${personId}`, {
			method: "DELETE",
		});
		expect(res.status).toBe(200);
	});

	it("DELETE /api/w/:wid/tags/:id deletes tag", async () => {
		const res = await api(`/api/w/${wsId}/tags/${tagDocId}`, { method: "DELETE" });
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.deleted).toBe(true);
	});

	it("cleanup: delete workspace", async () => {
		await api(`/api/w/${wsId}/documents/${docId}`, { method: "DELETE" });
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
