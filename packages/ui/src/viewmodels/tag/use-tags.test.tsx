import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { useTags } from "./use-tags.js";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
	const vm = useTags("document");
	return { ctx, vm };
}

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const TAG_A = {
	id: "tag-1",
	workspaceId: "ws-1",
	name: "Engineering",
	scope: "document",
	color: "#3b82f6",
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	assignedCount: 5,
};

const TAG_B = {
	id: "tag-2",
	workspaceId: "ws-1",
	name: "Design",
	scope: "document",
	color: "#ec4899",
	sortOrder: 1,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	assignedCount: 3,
};

describe("useTags", () => {
	it("does not fetch when no workspace selected", () => {
		const wrapper = createWrapper();
		const { result } = renderHook(() => useTags("document"), { wrapper });
		expect(result.current.tags).toEqual([]);
		expect(result.current.isLoading).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("fetches tags after workspace selection", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A, TAG_B]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.tags).toHaveLength(2));
		expect(result.current.vm.tags[0].name).toBe("Engineering");
		expect(result.current.vm.tags[1].name).toBe("Design");
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

	it("creates a tag and shows success toast", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));

		mockFetch.mockResolvedValue(ok({ id: "tag-3", name: "New Tag" }));
		act(() => result.current.vm.create({ name: "New Tag", scope: "document" }));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tag created"));
	});

	it("shows error toast on create failure", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));

		mockFetch.mockResolvedValue(err(400, "VALIDATION", "Name taken"));
		act(() => result.current.vm.create({ name: "Engineering", scope: "document" }));

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
	});

	it("optimistically updates tag on edit", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));

		mockFetch.mockResolvedValue(ok({ updated: true }));
		act(() => result.current.vm.update("tag-1", { name: "Platform" }));

		await waitFor(() => expect(result.current.vm.tags[0].name).toBe("Platform"));
	});

	it("rolls back optimistic update on error", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));

		mockFetch.mockResolvedValue(err(500, "INTERNAL", "fail"));
		act(() => result.current.vm.update("tag-1", { name: "Platform" }));

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		await waitFor(() => expect(result.current.vm.tags[0].name).toBe("Engineering"));
	});

	it("optimistically removes tag on delete", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A, TAG_B]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(2));

		mockFetch.mockResolvedValue(ok({ deleted: true }));
		act(() => result.current.vm.remove("tag-1"));

		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));
		expect(result.current.vm.tags[0].id).toBe("tag-2");
	});

	it("shows success toast on delete", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));

		mockFetch.mockResolvedValue(ok({ deleted: true }));
		act(() => result.current.vm.remove("tag-1"));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tag deleted"));
	});

	it("rolls back delete on error", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));

		mockFetch.mockResolvedValue(err(500, "INTERNAL", "fail"));
		act(() => result.current.vm.remove("tag-1"));

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));
	});

	it("exposes isPending states for mutations", async () => {
		mockFetch.mockResolvedValue(ok([TAG_A]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		await waitFor(() => expect(result.current.vm.tags).toHaveLength(1));

		expect(result.current.vm.isCreating).toBe(false);
		expect(result.current.vm.isUpdating).toBe(false);
		expect(result.current.vm.isRemoving).toBe(false);
	});
});
