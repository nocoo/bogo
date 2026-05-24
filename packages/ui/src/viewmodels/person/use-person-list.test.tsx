import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { usePersonList } from "./use-person-list.js";

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

function useWithWorkspace() {
	const ctx = useWorkspaceContext();
	const vm = usePersonList();
	return { ctx, vm };
}

const ROOT = {
	id: "p-root",
	workspaceId: "ws-1",
	name: "Org",
	title: "Root",
	managerId: null,
	dottedManagerId: null,
	isRoot: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const ALICE = {
	id: "p-alice",
	workspaceId: "ws-1",
	name: "Alice",
	title: "Engineer",
	managerId: "p-root",
	dottedManagerId: null,
	isRoot: false,
	sortOrder: 1,
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
};

const BOB = {
	id: "p-bob",
	workspaceId: "ws-1",
	name: "Bob",
	title: "Designer",
	managerId: "p-root",
	dottedManagerId: null,
	isRoot: false,
	sortOrder: 2,
	createdAt: "2026-01-03",
	updatedAt: "2026-01-03",
};

describe("usePersonList", () => {
	describe("workspace gate", () => {
		it("does not fetch when no workspace is selected", () => {
			mockFetch.mockReturnValue(new Promise(() => undefined));
			const { result } = renderHook(() => usePersonList(), { wrapper: createWrapper() });
			expect(result.current.isLoading).toBe(false);
			expect(result.current.persons).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});
	});

	describe("loading state", () => {
		it("starts with isLoading=true after workspace selected", () => {
			mockFetch.mockReturnValue(new Promise(() => undefined));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);

			expect(result.current.vm.isLoading).toBe(true);
			expect(result.current.vm.persons).toEqual([]);
		});
	});

	describe("success state", () => {
		it("returns person list after fetch resolves", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);

			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));
			expect(result.current.vm.persons).toEqual([ROOT, ALICE, BOB]);
			expect(result.current.vm.error).toBeNull();
		});
	});

	describe("empty state", () => {
		it("returns empty array when no persons", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);

			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));
			expect(result.current.vm.persons).toEqual([]);
		});
	});

	describe("error state", () => {
		it("exposes error when fetch fails", async () => {
			mockFetch.mockResolvedValue(err(500, "INTERNAL", "DB down"));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);

			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));
			expect(result.current.vm.error).not.toBeNull();
			expect(result.current.vm.persons).toEqual([]);
		});
	});

	describe("create", () => {
		it("adds person to list on success", async () => {
			mockFetch.mockResolvedValue(ok([ROOT]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValue(ok(ALICE, 201));
			act(() => result.current.vm.create("Alice", "p-root"));

			await waitFor(() => expect(result.current.vm.persons).toHaveLength(2));
			expect(result.current.vm.persons[1]).toEqual(ALICE);
		});

		it("sets mutationError on create failure", async () => {
			mockFetch.mockResolvedValue(ok([ROOT]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValue(err(400, "VALIDATION", "Name required"));
			act(() => result.current.vm.create("", null));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
		});
	});

	describe("update (optimistic + rollback)", () => {
		it("optimistically updates name", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValue(ok({ ...ALICE, name: "Alice2" }));
			act(() => result.current.vm.update("p-alice", { name: "Alice2" }));

			await waitFor(() =>
				expect(result.current.vm.persons.find((p) => p.id === "p-alice")?.name).toBe("Alice2"),
			);
		});

		it("rolls back on update failure", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch
				.mockResolvedValueOnce(err(500, "INTERNAL", "DB error"))
				.mockResolvedValueOnce(ok([ROOT, ALICE]));
			act(() => result.current.vm.update("p-alice", { name: "Bad" }));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
			await waitFor(() =>
				expect(result.current.vm.persons.find((p) => p.id === "p-alice")?.name).toBe("Alice"),
			);
		});
	});

	describe("move (optimistic + rollback)", () => {
		it("optimistically updates managerId", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValue(ok({ moved: true }));
			act(() => result.current.vm.move("p-bob", "p-alice"));

			await waitFor(() =>
				expect(result.current.vm.persons.find((p) => p.id === "p-bob")?.managerId).toBe("p-alice"),
			);
		});

		it("rolls back managerId on move failure (cycle detected)", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch
				.mockResolvedValueOnce(err(400, "CYCLE", "Would create cycle"))
				.mockResolvedValueOnce(ok([ROOT, ALICE, BOB]));
			act(() => result.current.vm.move("p-root", "p-alice"));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
			await waitFor(() =>
				expect(result.current.vm.persons.find((p) => p.id === "p-root")?.managerId).toBeNull(),
			);
		});
	});

	describe("remove (optimistic + rollback)", () => {
		it("optimistically removes person from list", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValue(ok({ deleted: true }));
			act(() => result.current.vm.remove("p-bob"));

			await waitFor(() => expect(result.current.vm.persons).toHaveLength(2));
			expect(result.current.vm.persons.find((p) => p.id === "p-bob")).toBeUndefined();
		});

		it("rolls back on delete failure (has reports)", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch
				.mockResolvedValueOnce(err(400, "HAS_REPORTS", "Person has direct reports"))
				.mockResolvedValueOnce(ok([ROOT, ALICE, BOB]));
			act(() => result.current.vm.remove("p-root"));

			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());
			await waitFor(() => expect(result.current.vm.persons).toHaveLength(3));
		});
	});

	describe("clearMutationError", () => {
		it("clears mutation error", async () => {
			mockFetch.mockResolvedValue(ok([ROOT]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValue(err(400, "VALIDATION", "Bad"));
			act(() => result.current.vm.create("", null));
			await waitFor(() => expect(result.current.vm.mutationError).not.toBeNull());

			act(() => result.current.vm.clearMutationError());
			expect(result.current.vm.mutationError).toBeNull();
		});
	});

	describe("mutations before cache is populated", () => {
		it("create succeeds even when cache is empty", async () => {
			mockFetch
				.mockReturnValueOnce(new Promise(() => undefined))
				.mockResolvedValueOnce(ok(ALICE, 201));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);

			act(() => result.current.vm.create("Alice", "p-root"));
			await waitFor(() => expect(result.current.vm.persons).toContainEqual(ALICE));
		});

		it("update handles empty cache gracefully", async () => {
			mockFetch.mockReturnValueOnce(new Promise(() => undefined));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);

			mockFetch.mockResolvedValueOnce(ok({ ...ALICE, name: "Updated" }));
			act(() => result.current.vm.update("p-alice", { name: "Updated" }));

			await waitFor(() => expect(result.current.vm.persons).toEqual([]));
		});

		it("move handles empty cache gracefully", async () => {
			mockFetch.mockReturnValueOnce(new Promise(() => undefined));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);

			mockFetch.mockResolvedValueOnce(ok({ moved: true }));
			act(() => result.current.vm.move("p-alice", "p-bob"));

			await waitFor(() => expect(result.current.vm.isMoving).toBe(false));
			expect(result.current.vm.persons).toEqual([]);
		});

		it("remove handles empty cache gracefully", async () => {
			mockFetch.mockReturnValueOnce(new Promise(() => undefined));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });

			act(() =>
				result.current.ctx.switchWorkspace({
					id: "ws-1",
					ownerId: "u-1",
					name: "Corp",
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				}),
			);

			mockFetch.mockResolvedValueOnce(ok({ deleted: true }));
			act(() => result.current.vm.remove("p-alice"));

			await waitFor(() => expect(result.current.vm.isRemoving).toBe(false));
			expect(result.current.vm.persons).toEqual([]);
		});
	});
});
