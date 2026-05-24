import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceKeys, workspaceModel } from "./workspace.model.js";

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

describe("workspaceKeys", () => {
	it("all returns static key", () => {
		expect(workspaceKeys.all).toEqual(["workspaces"]);
	});

	it("detail returns key with id", () => {
		expect(workspaceKeys.detail("ws-1")).toEqual(["workspaces", "ws-1"]);
	});
});

describe("workspaceModel", () => {
	describe("listQueryOptions", () => {
		it("generates correct queryKey", () => {
			const opts = workspaceModel.listQueryOptions();
			expect(opts.queryKey).toEqual(["workspaces"]);
		});

		it("queryFn calls GET /api/workspaces", async () => {
			mockFetch.mockResolvedValue(ok([{ id: "ws-1", name: "Corp" }]));
			const opts = workspaceModel.listQueryOptions();
			expect(opts.queryFn).toBeDefined();
			const queryFn = opts.queryFn as (...args: unknown[]) => Promise<unknown>;
			const result = await queryFn({});
			expect(result).toEqual([{ id: "ws-1", name: "Corp" }]);
			expect(mockFetch).toHaveBeenCalledWith("/api/workspaces", expect.any(Object));
		});
	});

	describe("detailQueryOptions", () => {
		it("generates correct queryKey with id", () => {
			const opts = workspaceModel.detailQueryOptions("ws-1");
			expect(opts.queryKey).toEqual(["workspaces", "ws-1"]);
		});

		it("queryFn calls GET /api/workspaces/:id", async () => {
			mockFetch.mockResolvedValue(ok({ id: "ws-1", name: "Corp" }));
			const opts = workspaceModel.detailQueryOptions("ws-1");
			expect(opts.queryFn).toBeDefined();
			const queryFn = opts.queryFn as (...args: unknown[]) => Promise<unknown>;
			const result = await queryFn({});
			expect(result).toEqual({ id: "ws-1", name: "Corp" });
			expect(mockFetch).toHaveBeenCalledWith("/api/workspaces/ws-1", expect.any(Object));
		});
	});

	describe("createMutationOptions", () => {
		it("mutationFn calls POST /api/workspaces with { name }", async () => {
			mockFetch.mockResolvedValue(ok({ id: "ws-new", name: "New" }, 201));
			const opts = workspaceModel.createMutationOptions();
			const result = await opts.mutationFn({ name: "New" });
			expect(result).toEqual({ id: "ws-new", name: "New" });
			const body = mockFetch.mock.calls[0][1]?.body;
			expect(JSON.parse(body)).toEqual({ name: "New" });
		});
	});

	describe("updateMutationOptions", () => {
		it("mutationFn calls PUT /api/workspaces/:id with { name }", async () => {
			mockFetch.mockResolvedValue(ok({ id: "ws-1", name: "Renamed" }));
			const opts = workspaceModel.updateMutationOptions();
			const result = await opts.mutationFn({ id: "ws-1", input: { name: "Renamed" } });
			expect(result).toEqual({ id: "ws-1", name: "Renamed" });
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/workspaces/ws-1",
				expect.objectContaining({ method: "PUT" }),
			);
		});
	});

	describe("deleteMutationOptions", () => {
		it("mutationFn calls DELETE /api/workspaces/:id", async () => {
			mockFetch.mockResolvedValue(ok({ deleted: true }));
			const opts = workspaceModel.deleteMutationOptions();
			const result = await opts.mutationFn("ws-1");
			expect(result).toEqual({ deleted: true });
			expect(mockFetch).toHaveBeenCalledWith(
				"/api/workspaces/ws-1",
				expect.objectContaining({ method: "DELETE" }),
			);
		});
	});
});
