import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { documentKeys, documentModel } from "./document.model.js";

const mockFetch = vi.fn();
beforeEach(() => vi.stubGlobal("fetch", mockFetch));
afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

function ok(data: unknown) {
	return new Response(JSON.stringify({ data }), { status: 200 });
}

describe("documentKeys", () => {
	it("all returns key scoped to workspace", () => {
		expect(documentKeys.all("ws-1")).toEqual(["documents", "ws-1"]);
	});

	it("all includes tagIds when provided", () => {
		expect(documentKeys.all("ws-1", ["t-1"])).toEqual(["documents", "ws-1", { tagIds: ["t-1"] }]);
	});

	it("all ignores empty tagIds array", () => {
		expect(documentKeys.all("ws-1", [])).toEqual(["documents", "ws-1"]);
	});
});

describe("documentModel", () => {
	it("listQueryOptions generates correct queryKey", () => {
		const opts = documentModel.listQueryOptions("ws-1");
		expect(opts.queryKey).toEqual(["documents", "ws-1"]);
	});

	it("listQueryOptions includes tagIds in queryKey", () => {
		const opts = documentModel.listQueryOptions("ws-1", ["t-1"]);
		expect(opts.queryKey).toEqual(["documents", "ws-1", { tagIds: ["t-1"] }]);
	});

	it("listQueryOptions is disabled when wid is empty", () => {
		const opts = documentModel.listQueryOptions("");
		expect(opts.enabled).toBe(false);
	});

	it("listQueryOptions queryFn calls API", async () => {
		mockFetch.mockResolvedValue(ok([{ id: "d-1" }]));
		const opts = documentModel.listQueryOptions("ws-1");
		const queryFn = opts.queryFn as (...args: unknown[]) => Promise<unknown>;
		const result = await queryFn({});
		expect(result).toEqual([{ id: "d-1" }]);
	});

	it("listQueryOptions queryFn passes tagIds to API", async () => {
		mockFetch.mockResolvedValue(ok([]));
		const opts = documentModel.listQueryOptions("ws-1", ["t-1", "t-2"]);
		const queryFn = opts.queryFn as (...args: unknown[]) => Promise<unknown>;
		await queryFn({});
		expect(mockFetch).toHaveBeenCalledWith(
			"/api/w/ws-1/documents?tagIds=t-1,t-2",
			expect.any(Object),
		);
	});
});
