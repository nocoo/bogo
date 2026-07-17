import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "@/contexts/workspace-context";
import { useTableViews } from "./use-table-views.js";

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
	columns: ["builtin:name"],
	sort: null,
	filters: [],
	isDefault: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

function useWithWs(viewId: string | null) {
	const ctx = useWorkspaceContext();
	const vm = useTableViews(viewId);
	return { ctx, vm };
}

describe("useTableViews", () => {
	it("loads views and picks default / selected", async () => {
		mockFetch.mockImplementation((url: string) => {
			if (String(url).includes("/table-views")) return Promise.resolve(ok([VIEW]));
			return Promise.resolve(ok([]));
		});
		const { result } = renderHook(() => useWithWs(null), { wrapper: createWrapper() });
		act(() => {
			result.current.ctx.switchWorkspace(WS);
		});
		await waitFor(() => expect(result.current.vm.views).toHaveLength(1));
		expect(result.current.vm.activeView?.id).toBe("v1");
	});

	it("creates a view", async () => {
		const created = { ...VIEW, id: "v2", name: "HR", isDefault: false };
		mockFetch.mockImplementation((url: string, init?: RequestInit) => {
			if (String(url).includes("/table-views") && init?.method === "POST") {
				return Promise.resolve(ok(created, 201));
			}
			if (String(url).includes("/table-views")) return Promise.resolve(ok([VIEW]));
			return Promise.resolve(ok([]));
		});
		const { result } = renderHook(() => useWithWs(null), { wrapper: createWrapper() });
		act(() => {
			result.current.ctx.switchWorkspace(WS);
		});
		await waitFor(() => expect(result.current.vm.views).toHaveLength(1));
		await act(async () => {
			const v = await result.current.vm.createView({
				name: "HR",
				columns: ["builtin:name"],
			});
			expect(v.id).toBe("v2");
		});
	});

	it("updates and deletes a view; respects selectedViewId", async () => {
		const other = { ...VIEW, id: "v2", name: "Other", isDefault: false };
		mockFetch.mockImplementation((url: string, init?: RequestInit) => {
			const u = String(url);
			if (u.includes("/table-views") && init?.method === "PUT") {
				return Promise.resolve(ok({ ...other, name: "Renamed" }));
			}
			if (u.includes("/table-views") && init?.method === "DELETE") {
				return Promise.resolve(ok({ deleted: true }));
			}
			if (u.includes("/table-views")) return Promise.resolve(ok([VIEW, other]));
			return Promise.resolve(ok([]));
		});
		const { result } = renderHook(() => useWithWs("v2"), { wrapper: createWrapper() });
		act(() => {
			result.current.ctx.switchWorkspace(WS);
		});
		await waitFor(() => expect(result.current.vm.views).toHaveLength(2));
		expect(result.current.vm.activeView?.id).toBe("v2");
		await act(async () => {
			await result.current.vm.updateView("v2", { name: "Renamed" });
			await result.current.vm.deleteView("v2");
		});
	});
});
