import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { useDocTypes } from "./use-doc-types.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

function ok(data: unknown, status = 200) {
	return new Response(JSON.stringify({ data }), { status });
}

function err(status: number, code: string, message: string) {
	return new Response(JSON.stringify({ error: { code, message } }), { status });
}

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<WorkspaceProvider>{children}</WorkspaceProvider>
			</QueryClientProvider>
		);
	};
}

function useWithWorkspace() {
	const ctx = useWorkspaceContext();
	const vm = useDocTypes();
	return { ctx, vm };
}

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const TYPE_A = {
	id: "dt-1",
	workspaceId: "ws-1",
	name: "Meeting Notes",
	color: "#3b82f6",
	sortOrder: 0,
	createdAt: "2026-01-01",
};

const TYPE_B = {
	id: "dt-2",
	workspaceId: "ws-1",
	name: "Policy",
	color: "#ef4444",
	sortOrder: 1,
	createdAt: "2026-01-02",
};

describe("useDocTypes", () => {
	it("does not fetch when no workspace selected", () => {
		const wrapper = createWrapper();
		const { result } = renderHook(() => useDocTypes(), { wrapper });
		expect(result.current.types).toEqual([]);
		expect(result.current.isLoading).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("fetches doc types after workspace selection", async () => {
		mockFetch.mockResolvedValue(ok([TYPE_A, TYPE_B]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.types).toHaveLength(2));
		expect(result.current.vm.types[0].name).toBe("Meeting Notes");
		expect(result.current.vm.types[1].name).toBe("Policy");
	});

	it("exposes loading state while fetching", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.isLoading).toBe(true));
	});

	it("exposes error when fetch fails", async () => {
		mockFetch.mockResolvedValue(err(500, "INTERNAL", "DB error"));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.error).not.toBeNull());
		expect(result.current.vm.error?.message).toContain("DB error");
	});

	describe("create", () => {
		it("appends new type on success", async () => {
			mockFetch.mockResolvedValue(ok([TYPE_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.types).toHaveLength(1));

			const newType = { ...TYPE_B, id: "dt-new" };
			mockFetch.mockResolvedValueOnce(ok(newType, 201));

			act(() => result.current.vm.create({ name: "Policy", color: "#ef4444" }));

			await waitFor(() => expect(result.current.vm.types).toHaveLength(2));
			expect(result.current.vm.types[1].id).toBe("dt-new");
		});

		it("exposes isCreating state", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockReturnValueOnce(new Promise(() => undefined));

			act(() => result.current.vm.create({ name: "Review" }));

			await waitFor(() => expect(result.current.vm.isCreating).toBe(true));
		});

		it("sets mutationError on create failure", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValueOnce(err(400, "VALIDATION", "Name required"));

			act(() => result.current.vm.create({ name: "" }));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
			expect(result.current.vm.mutationError?.message).toContain("Name required");
		});
	});

	describe("update", () => {
		it("optimistically updates type", async () => {
			mockFetch.mockResolvedValue(ok([TYPE_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.types).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(ok({ updated: true }))
				.mockResolvedValueOnce(ok([{ ...TYPE_A, name: "Standup Notes" }]));

			act(() => result.current.vm.update("dt-1", { name: "Standup Notes" }));

			await waitFor(() => expect(result.current.vm.types[0].name).toBe("Standup Notes"));
		});

		it("rolls back on update failure", async () => {
			mockFetch.mockResolvedValue(ok([TYPE_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.types).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(400, "VALIDATION", "Bad name"))
				.mockResolvedValueOnce(ok([TYPE_A]));

			act(() => result.current.vm.update("dt-1", { name: "" }));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
			expect(result.current.vm.types[0].name).toBe("Meeting Notes");
		});
	});

	describe("delete", () => {
		it("optimistically removes type", async () => {
			mockFetch.mockResolvedValue(ok([TYPE_A, TYPE_B]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.types).toHaveLength(2));

			mockFetch.mockResolvedValueOnce(ok({ deleted: true })).mockResolvedValueOnce(ok([TYPE_B]));

			act(() => result.current.vm.remove("dt-1"));

			await waitFor(() => expect(result.current.vm.types).toHaveLength(1));
			expect(result.current.vm.types[0].id).toBe("dt-2");
		});

		it("rolls back on delete failure (in-use)", async () => {
			mockFetch.mockResolvedValue(ok([TYPE_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.types).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(409, "IN_USE", "Type has documents"))
				.mockResolvedValueOnce(ok([TYPE_A]));

			act(() => result.current.vm.remove("dt-1"));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
			expect(result.current.vm.mutationError?.message).toContain("Type has documents");
			expect(result.current.vm.types).toHaveLength(1);
		});

		it("rolls back on delete failure (404)", async () => {
			mockFetch.mockResolvedValue(ok([TYPE_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.types).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(404, "NOT_FOUND", "Type not found"))
				.mockResolvedValueOnce(ok([TYPE_A]));

			act(() => result.current.vm.remove("dt-1"));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
			expect(result.current.vm.mutationError?.message).toContain("Type not found");
			expect(result.current.vm.types).toHaveLength(1);
		});
	});

	describe("reorder", () => {
		it("reorders via update with sortOrder", async () => {
			mockFetch.mockResolvedValue(ok([TYPE_A, TYPE_B]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.types).toHaveLength(2));

			mockFetch
				.mockResolvedValueOnce(ok({ updated: true }))
				.mockResolvedValueOnce(ok([{ ...TYPE_A, sortOrder: 1 }, TYPE_B]));

			act(() => result.current.vm.reorder("dt-1", 1));

			await waitFor(() => expect(result.current.vm.types[0].sortOrder).toBe(1));
		});
	});

	it("clears mutation error", async () => {
		mockFetch.mockResolvedValue(ok([]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

		mockFetch.mockResolvedValueOnce(err(400, "VALIDATION", "Bad"));

		act(() => result.current.vm.create({ name: "" }));

		await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());

		act(() => result.current.vm.clearMutationError());
		expect(result.current.vm.mutationError).toBeNull();
	});
});
