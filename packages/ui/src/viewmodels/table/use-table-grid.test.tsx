import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "@/contexts/workspace-context";
import { useTableGrid } from "./use-table-grid.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

function ok(data: unknown) {
	return new Response(JSON.stringify({ data }), { status: 200 });
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

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const VIEW = {
	id: "v1",
	workspaceId: "ws-1",
	name: "All People",
	columns: ["builtin:name", "builtin:title"],
	sort: null,
	filters: [],
	isDefault: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const PERSON = {
	id: "p1",
	workspaceId: "ws-1",
	name: "Alice",
	title: "Eng",
	managerId: null,
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: true,
	sortOrder: 0,
	createdAt: "2026-07-17T12:00:00.000Z",
	updatedAt: "2026-07-17T12:00:00.000Z",
	tags: [],
};

function useWithWs() {
	const ctx = useWorkspaceContext();
	const grid = useTableGrid(VIEW);
	return { ctx, grid };
}

describe("useTableGrid", () => {
	it("builds grid from persons fields and values", async () => {
		mockFetch.mockImplementation((url: string) => {
			const u = String(url);
			if (u.includes("/persons")) return Promise.resolve(ok([PERSON]));
			if (u.includes("/fields/values")) return Promise.resolve(ok([]));
			if (u.includes("/fields")) return Promise.resolve(ok([]));
			return Promise.resolve(ok([]));
		});
		const { result } = renderHook(() => useWithWs(), { wrapper: createWrapper() });
		act(() => {
			result.current.ctx.switchWorkspace(WS);
		});
		await waitFor(() => expect(result.current.grid.grid).not.toBeNull());
		expect(result.current.grid.grid?.rows[0]?.person.name).toBe("Alice");
	});
});
