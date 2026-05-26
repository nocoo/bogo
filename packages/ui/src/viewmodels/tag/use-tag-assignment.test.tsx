import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { useTagAssignment } from "./use-tag-assignment.js";

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

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

function useWithWorkspace(scope: "document" | "person") {
	const ctx = useWorkspaceContext();
	const vm = useTagAssignment(scope);
	return { ctx, vm };
}

describe("useTagAssignment", () => {
	it("assigns a tag to a document", async () => {
		mockFetch.mockResolvedValue(ok({ assigned: true }));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("document"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		act(() => result.current.vm.assign("tag-1", "doc-1"));

		await waitFor(() => expect(mockFetch).toHaveBeenCalled());
		const url = mockFetch.mock.calls.find((c) => c[0].includes("/tags/"))?.[0];
		expect(url).toContain("/tags/tag-1/documents/doc-1");
	});

	it("unassigns a tag from a document", async () => {
		mockFetch.mockResolvedValue(ok({ removed: true }));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("document"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		act(() => result.current.vm.unassign("tag-1", "doc-1"));

		await waitFor(() => expect(mockFetch).toHaveBeenCalled());
		const call = mockFetch.mock.calls.find((c) => c[0].includes("/tags/"));
		expect(call?.[0]).toContain("/tags/tag-1/documents/doc-1");
		expect(call?.[1]?.method).toBe("DELETE");
	});

	it("assigns a tag to a person", async () => {
		mockFetch.mockResolvedValue(ok({ assigned: true }));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("person"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		act(() => result.current.vm.assign("tag-2", "p-1"));

		await waitFor(() => expect(mockFetch).toHaveBeenCalled());
		const url = mockFetch.mock.calls.find((c) => c[0].includes("/tags/"))?.[0];
		expect(url).toContain("/tags/tag-2/persons/p-1");
	});

	it("shows error toast on assign failure", async () => {
		mockFetch.mockResolvedValue(err(400, "SCOPE_MISMATCH", "Tag scope does not match"));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("document"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		act(() => result.current.vm.assign("tag-1", "doc-1"));

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
	});

	it("shows error toast on unassign failure", async () => {
		mockFetch.mockResolvedValue(err(500, "INTERNAL", "DB error"));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("document"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));
		act(() => result.current.vm.unassign("tag-1", "doc-1"));

		await waitFor(() => expect(toast.error).toHaveBeenCalled());
	});

	it("exposes isPending states", async () => {
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("document"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		expect(result.current.vm.isAssigning).toBe(false);
		expect(result.current.vm.isUnassigning).toBe(false);
	});
});
