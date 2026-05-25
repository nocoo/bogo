import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { useWorkspaceList } from "./use-workspace-list.js";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

const WS1 = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};
const WS2 = {
	id: "ws-2",
	ownerId: "u-1",
	name: "Lab",
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
};

describe("useWorkspaceList", () => {
	describe("loading state", () => {
		it("starts with isLoading=true and empty workspaces", () => {
			mockFetch.mockReturnValue(new Promise(() => undefined));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });

			expect(result.current.isLoading).toBe(true);
			expect(result.current.workspaces).toEqual([]);
			expect(result.current.error).toBeNull();
		});
	});

	describe("success state", () => {
		it("returns workspace list after fetch resolves", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });

			await waitFor(() => expect(result.current.isLoading).toBe(false));
			expect(result.current.workspaces).toEqual([WS1, WS2]);
			expect(result.current.error).toBeNull();
		});
	});

	describe("empty state", () => {
		it("returns empty array when server returns []", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });

			await waitFor(() => expect(result.current.isLoading).toBe(false));
			expect(result.current.workspaces).toEqual([]);
		});
	});

	describe("error state", () => {
		it("exposes error when fetch fails", async () => {
			mockFetch.mockResolvedValue(err(500, "INTERNAL", "Server down"));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });

			await waitFor(() => expect(result.current.isLoading).toBe(false));
			expect(result.current.error).not.toBeNull();
			expect(result.current.workspaces).toEqual([]);
		});
	});

	describe("select", () => {
		it("tracks selected workspace id", async () => {
			mockFetch.mockResolvedValue(ok([WS1]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });

			await waitFor(() => expect(result.current.isLoading).toBe(false));

			expect(result.current.selectedId).toBeNull();
			act(() => result.current.select("ws-1"));
			expect(result.current.selectedId).toBe("ws-1");
			act(() => result.current.select(null));
			expect(result.current.selectedId).toBeNull();
		});
	});

	describe("create", () => {
		it("adds workspace to list on success", async () => {
			mockFetch.mockResolvedValue(ok([WS1]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			const created = {
				id: "ws-new",
				ownerId: "u-1",
				name: "New",
				createdAt: "2026-05-24",
				updatedAt: "2026-05-24",
			};
			mockFetch.mockResolvedValue(ok(created, 201));
			act(() => result.current.create("New"));

			await waitFor(() => expect(result.current.workspaces).toHaveLength(2));
			expect(result.current.workspaces[1]).toEqual(created);
			expect(result.current.isCreating).toBe(false);
		});

		it("toasts error on create failure", async () => {
			mockFetch.mockResolvedValue(ok([WS1]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			mockFetch.mockResolvedValue(err(400, "VALIDATION", "Name required"));
			act(() => result.current.create(""));

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
		});
	});

	describe("rename (optimistic update + rollback)", () => {
		it("optimistically updates name then settles", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			const updated = { ...WS1, name: "Renamed" };
			mockFetch.mockResolvedValue(ok(updated));
			act(() => result.current.rename("ws-1", "Renamed"));

			await waitFor(() =>
				expect(result.current.workspaces.find((w) => w.id === "ws-1")?.name).toBe("Renamed"),
			);
		});

		it("rolls back on rename failure", async () => {
			mockFetch.mockResolvedValue(ok([WS1]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			mockFetch
				.mockResolvedValueOnce(err(500, "INTERNAL", "DB error"))
				.mockResolvedValueOnce(ok([WS1]));
			act(() => result.current.rename("ws-1", "Bad"));

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			await waitFor(() =>
				expect(result.current.workspaces.find((w) => w.id === "ws-1")?.name).toBe("Corp"),
			);
		});

		it("updates context workspace.name on rename of selected workspace", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(
				() => ({ vm: useWorkspaceList(), ctx: useWorkspaceContext() }),
				{ wrapper: createWrapper() },
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			act(() => result.current.vm.select("ws-1"));
			expect(result.current.ctx.workspace?.name).toBe("Corp");

			const updated = { ...WS1, name: "Renamed", updatedAt: "2026-05-24T15:00:00Z" };
			mockFetch.mockResolvedValue(ok(updated));
			act(() => result.current.vm.rename("ws-1", "Renamed"));

			await waitFor(() => expect(result.current.ctx.workspace?.name).toBe("Renamed"));
			expect(result.current.ctx.workspace?.updatedAt).toBe("2026-05-24T15:00:00Z");
		});

		it("restores context workspace.name on rename failure of selected workspace", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(
				() => ({ vm: useWorkspaceList(), ctx: useWorkspaceContext() }),
				{ wrapper: createWrapper() },
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			act(() => result.current.vm.select("ws-1"));
			expect(result.current.ctx.workspace?.name).toBe("Corp");

			mockFetch
				.mockResolvedValueOnce(err(500, "INTERNAL", "DB error"))
				.mockResolvedValueOnce(ok([WS1, WS2]));
			act(() => result.current.vm.rename("ws-1", "Bad"));

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			await waitFor(() => expect(result.current.ctx.workspace?.name).toBe("Corp"));
		});
	});

	describe("remove (optimistic update + rollback)", () => {
		it("optimistically removes workspace from list", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			mockFetch.mockResolvedValue(ok({ deleted: true }));
			act(() => result.current.remove("ws-1"));

			await waitFor(() => expect(result.current.workspaces).toHaveLength(1));
			expect(result.current.workspaces[0].id).toBe("ws-2");
		});

		it("clears selectedId when selected workspace is deleted", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			act(() => result.current.select("ws-1"));
			expect(result.current.selectedId).toBe("ws-1");

			mockFetch.mockResolvedValue(ok({ deleted: true }));
			act(() => result.current.remove("ws-1"));

			await waitFor(() => expect(result.current.selectedId).toBeNull());
		});

		it("rolls back on delete failure", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			mockFetch
				.mockResolvedValueOnce(err(403, "FORBIDDEN", "Not allowed"))
				.mockResolvedValueOnce(ok([WS1, WS2]));
			act(() => result.current.remove("ws-1"));

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			await waitFor(() => expect(result.current.workspaces).toHaveLength(2));
		});

		it("restores selectedId when delete of selected workspace fails", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });
			await waitFor(() => expect(result.current.isLoading).toBe(false));

			act(() => result.current.select("ws-1"));
			expect(result.current.selectedId).toBe("ws-1");

			mockFetch
				.mockResolvedValueOnce(err(403, "FORBIDDEN", "Not allowed"))
				.mockResolvedValueOnce(ok([WS1, WS2]));
			act(() => result.current.remove("ws-1"));

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			await waitFor(() => expect(result.current.selectedId).toBe("ws-1"));
		});
	});

	describe("select writes to WorkspaceContext", () => {
		it("select sets workspace in global context", async () => {
			mockFetch.mockResolvedValue(ok([WS1, WS2]));
			const { result } = renderHook(
				() => ({ vm: useWorkspaceList(), ctx: useWorkspaceContext() }),
				{ wrapper: createWrapper() },
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			act(() => result.current.vm.select("ws-1"));
			expect(result.current.ctx.workspaceId).toBe("ws-1");
			expect(result.current.ctx.workspace).toEqual(WS1);
		});
	});

	describe("mutations before cache is populated", () => {
		it("create succeeds even when cache is empty", async () => {
			const created = {
				id: "ws-new",
				ownerId: "u-1",
				name: "First",
				createdAt: "2026-05-24",
				updatedAt: "2026-05-24",
			};
			mockFetch
				.mockReturnValueOnce(new Promise(() => undefined))
				.mockResolvedValueOnce(ok(created, 201));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });

			act(() => result.current.create("First"));
			await waitFor(() => expect(result.current.workspaces).toContainEqual(created));
		});

		it("rename handles empty cache gracefully", async () => {
			mockFetch.mockReturnValueOnce(new Promise(() => undefined));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });

			mockFetch.mockResolvedValueOnce(ok({ id: "ws-1", name: "Renamed" }));
			act(() => result.current.rename("ws-1", "Renamed"));

			await waitFor(() => expect(result.current.isRenaming).toBe(false));
			expect(result.current.workspaces).toEqual([]);
		});

		it("remove handles empty cache gracefully", async () => {
			mockFetch.mockReturnValueOnce(new Promise(() => undefined));
			const { result } = renderHook(() => useWorkspaceList(), { wrapper: createWrapper() });

			mockFetch.mockResolvedValueOnce(ok({ deleted: true }));
			act(() => result.current.remove("ws-1"));

			await waitFor(() => expect(result.current.isRemoving).toBe(false));
			expect(result.current.workspaces).toEqual([]);
		});
	});
});
