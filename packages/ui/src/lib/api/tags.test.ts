import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tagApi } from "./tags.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

function createClient() {
	return {
		request: vi.fn().mockResolvedValue([]),
	};
}

describe("tagApi", () => {
	it("lists tags without params", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.list("ws-1");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags");
	});

	it("lists tags with scope filter", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.list("ws-1", "document");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags?scope=document");
	});

	it("lists tags with scope and includeCounts", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.list("ws-1", "person", true);
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags?scope=person&includeCounts=true");
	});

	it("lists tags with includeCounts but no scope", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.list("ws-1", undefined, true);
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags?includeCounts=true");
	});

	it("creates a tag", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.create("ws-1", { name: "Bug", scope: "document" });
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags", {
			method: "POST",
			body: { name: "Bug", scope: "document" },
		});
	});

	it("updates a tag", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.update("ws-1", "tag-1", { name: "Feature" });
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags/tag-1", {
			method: "PUT",
			body: { name: "Feature" },
		});
	});

	it("deletes a tag", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.delete("ws-1", "tag-1");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags/tag-1", {
			method: "DELETE",
		});
	});

	it("assigns a tag to a document", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.assign("ws-1", "tag-1", "documents", "doc-1");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags/tag-1/documents/doc-1", {
			method: "PUT",
		});
	});

	it("unassigns a tag from a person", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.unassign("ws-1", "tag-2", "persons", "p-1");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags/tag-2/persons/p-1", {
			method: "DELETE",
		});
	});

	it("fetches stats with scope", async () => {
		const client = createClient();
		const api = tagApi(client as never);
		await api.stats("ws-1", "document");
		expect(client.request).toHaveBeenCalledWith("/api/w/ws-1/tags/stats?scope=document");
	});
});
