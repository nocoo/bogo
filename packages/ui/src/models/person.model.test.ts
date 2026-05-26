import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { personKeys, personModel } from "./person.model.js";

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

describe("personKeys", () => {
	it("all returns key scoped to workspace", () => {
		expect(personKeys.all("ws-1")).toEqual(["persons", "ws-1"]);
	});

	it("all includes tagIds when provided", () => {
		expect(personKeys.all("ws-1", ["t-1"])).toEqual(["persons", "ws-1", { tagIds: ["t-1"] }]);
	});

	it("all ignores empty tagIds array", () => {
		expect(personKeys.all("ws-1", [])).toEqual(["persons", "ws-1"]);
	});

	it("detail returns key with workspace and person id", () => {
		expect(personKeys.detail("ws-1", "p-1")).toEqual(["persons", "ws-1", "p-1"]);
	});
});

describe("personModel", () => {
	describe("listQueryOptions", () => {
		it("generates correct queryKey scoped to workspace", () => {
			const opts = personModel.listQueryOptions("ws-1");
			expect(opts.queryKey).toEqual(["persons", "ws-1"]);
		});

		it("includes tagIds in queryKey when provided", () => {
			const opts = personModel.listQueryOptions("ws-1", ["t-1"]);
			expect(opts.queryKey).toEqual(["persons", "ws-1", { tagIds: ["t-1"] }]);
		});

		it("is disabled when wid is empty", () => {
			const opts = personModel.listQueryOptions("");
			expect(opts.enabled).toBe(false);
		});

		it("queryFn calls GET /api/w/:wid/persons", async () => {
			mockFetch.mockResolvedValue(ok([{ id: "p-1", name: "Alice" }]));
			const opts = personModel.listQueryOptions("ws-1");
			const queryFn = opts.queryFn as (...args: unknown[]) => Promise<unknown>;
			const result = await queryFn({});
			expect(result).toEqual([{ id: "p-1", name: "Alice" }]);
			expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/persons", expect.any(Object));
		});
	});

	describe("detailQueryOptions", () => {
		it("generates correct queryKey", () => {
			const opts = personModel.detailQueryOptions("ws-1", "p-1");
			expect(opts.queryKey).toEqual(["persons", "ws-1", "p-1"]);
		});

		it("is disabled when wid or id is empty", () => {
			expect(personModel.detailQueryOptions("", "p-1").enabled).toBe(false);
			expect(personModel.detailQueryOptions("ws-1", "").enabled).toBe(false);
		});

		it("queryFn calls GET /api/w/:wid/persons/:id", async () => {
			mockFetch.mockResolvedValue(ok({ id: "p-1", name: "Alice" }));
			const opts = personModel.detailQueryOptions("ws-1", "p-1");
			const queryFn = opts.queryFn as (...args: unknown[]) => Promise<unknown>;
			const result = await queryFn({});
			expect(result).toEqual({ id: "p-1", name: "Alice" });
			expect(mockFetch).toHaveBeenCalledWith("/api/w/ws-1/persons/p-1", expect.any(Object));
		});
	});

	describe("createMutationOptions", () => {
		it("mutationFn calls POST /api/w/:wid/persons", async () => {
			mockFetch.mockResolvedValue(ok({ id: "p-new", name: "Bob" }, 201));
			const opts = personModel.createMutationOptions("ws-1");
			const result = await opts.mutationFn({ name: "Bob", title: "", managerId: null });
			expect(result).toEqual({ id: "p-new", name: "Bob" });
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/w/ws-1/persons",
				expect.objectContaining({ method: "POST" }),
			);
		});
	});

	describe("updateMutationOptions", () => {
		it("mutationFn calls PUT /api/w/:wid/persons/:id", async () => {
			mockFetch.mockResolvedValue(ok({ id: "p-1", name: "Updated" }));
			const opts = personModel.updateMutationOptions("ws-1");
			const result = await opts.mutationFn({ id: "p-1", input: { name: "Updated" } });
			expect(result).toEqual({ id: "p-1", name: "Updated" });
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/w/ws-1/persons/p-1",
				expect.objectContaining({ method: "PUT" }),
			);
		});
	});

	describe("moveMutationOptions", () => {
		it("mutationFn calls PUT /api/w/:wid/persons/:id/move", async () => {
			mockFetch.mockResolvedValue(ok({ moved: true }));
			const opts = personModel.moveMutationOptions("ws-1");
			const result = await opts.mutationFn({ id: "p-2", input: { managerId: "p-1" } });
			expect(result).toEqual({ moved: true });
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/w/ws-1/persons/p-2/move",
				expect.objectContaining({ method: "PUT" }),
			);
		});
	});

	describe("deleteMutationOptions", () => {
		it("mutationFn calls DELETE /api/w/:wid/persons/:id", async () => {
			mockFetch.mockResolvedValue(ok({ deleted: true }));
			const opts = personModel.deleteMutationOptions("ws-1");
			const result = await opts.mutationFn("p-1");
			expect(result).toEqual({ deleted: true });
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/w/ws-1/persons/p-1",
				expect.objectContaining({ method: "DELETE" }),
			);
		});
	});
});
