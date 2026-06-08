import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../../contexts/workspace-context.js";
import { usePersonTree } from "./use-person-tree.js";

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
	const vm = usePersonTree();
	return { ctx, vm };
}

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const ROOT = {
	id: "p-root",
	workspaceId: "ws-1",
	name: "Org",
	title: "Root",
	managerId: null,
	dottedManagerId: null,
	avatarUrl: null,
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
	avatarUrl: null,
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
	avatarUrl: null,
	isRoot: false,
	sortOrder: 2,
	createdAt: "2026-01-03",
	updatedAt: "2026-01-03",
};

describe("usePersonTree", () => {
	it("computes nodes and edges from person list", async () => {
		mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
		const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.isLoading).toBe(false));
		expect(result.current.vm.nodes).toHaveLength(3);
		expect(result.current.vm.edges).toHaveLength(2);
		expect(result.current.vm.nodes[0].type).toBe("person");
	});

	it("returns empty layout when no persons", async () => {
		mockFetch.mockResolvedValue(ok([]));
		const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.isLoading).toBe(false));
		expect(result.current.vm.nodes).toHaveLength(0);
		expect(result.current.vm.edges).toHaveLength(0);
	});

	it("tracks selected person", async () => {
		mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
		const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

		expect(result.current.vm.selectedPersonId).toBeNull();
		act(() => result.current.vm.selectPerson("p-alice"));
		expect(result.current.vm.selectedPersonId).toBe("p-alice");
		act(() => result.current.vm.selectPerson(null));
		expect(result.current.vm.selectedPersonId).toBeNull();
	});

	describe("handleDrop", () => {
		it("blocks root node move", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			const aliceNode = result.current.vm.nodes.find((n) => n.id === "p-alice");
			expect(aliceNode).toBeDefined();
			act(() =>
				result.current.vm.handleDrop("p-root", {
					x: (aliceNode?.position.x ?? 0) + 120,
					y: (aliceNode?.position.y ?? 0) + 40,
				}),
			);

			expect(result.current.vm.dropError).toBe("Cannot move the root node");
		});

		it("blocks cycle-creating move", async () => {
			const bobUnderAlice = { ...BOB, managerId: "p-alice" };
			mockFetch.mockResolvedValue(ok([ROOT, ALICE, bobUnderAlice]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			const bobNode = result.current.vm.nodes.find((n) => n.id === "p-bob");
			expect(bobNode).toBeDefined();
			act(() =>
				result.current.vm.handleDrop("p-alice", {
					x: (bobNode?.position.x ?? 0) + 120,
					y: (bobNode?.position.y ?? 0) + 40,
				}),
			);

			expect(result.current.vm.dropError).toBe("Cannot move: would create a cycle");
		});

		it("calls move on valid drop", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			const aliceNode = result.current.vm.nodes.find((n) => n.id === "p-alice");
			expect(aliceNode).toBeDefined();
			mockFetch.mockResolvedValue(ok({ moved: true }));
			act(() =>
				result.current.vm.handleDrop("p-bob", {
					x: (aliceNode?.position.x ?? 0) + 120,
					y: (aliceNode?.position.y ?? 0) + 40,
				}),
			);

			await waitFor(() =>
				expect(result.current.vm.persons.find((p) => p.id === "p-bob")?.managerId).toBe("p-alice"),
			);
		});

		it("clears drop error", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			const aliceNode = result.current.vm.nodes.find((n) => n.id === "p-alice");
			expect(aliceNode).toBeDefined();
			act(() =>
				result.current.vm.handleDrop("p-root", {
					x: (aliceNode?.position.x ?? 0) + 120,
					y: (aliceNode?.position.y ?? 0) + 40,
				}),
			);
			expect(result.current.vm.dropError).not.toBeNull();

			act(() => result.current.vm.clearDropError());
			expect(result.current.vm.dropError).toBeNull();
		});

		it("ignores drop when no target found", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			act(() => result.current.vm.handleDrop("p-alice", { x: 9999, y: 9999 }));
			expect(result.current.vm.dropError).toBeNull();
		});

		it("ignores drop on same manager", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			const { result } = renderHook(() => useWithWorkspace(), { wrapper: createWrapper() });
			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			const rootNode = result.current.vm.nodes.find((n) => n.id === "p-root");
			expect(rootNode).toBeDefined();
			act(() =>
				result.current.vm.handleDrop("p-alice", {
					x: (rootNode?.position.x ?? 0) + 120,
					y: (rootNode?.position.y ?? 0) + 40,
				}),
			);
			expect(result.current.vm.dropError).toBeNull();
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});
});
