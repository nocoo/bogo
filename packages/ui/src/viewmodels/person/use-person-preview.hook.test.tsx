import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../../contexts/workspace-context.js";
import { usePersonPreview } from "./use-person-preview.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
	mockFetch.mockResolvedValue(
		new Response(JSON.stringify({ data: [] }), {
			status: 200,
			headers: { "content-type": "application/json" },
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	function Bind({ children }: { children: ReactNode }) {
		const ctx = useWorkspaceContext();
		useEffect(() => {
			if (!ctx.workspaceId) ctx.switchWorkspace(WS);
		}, [ctx]);
		if (!ctx.workspaceId) return null;
		return children;
	}
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<WorkspaceProvider>
					<Bind>{children}</Bind>
				</WorkspaceProvider>
			</QueryClientProvider>
		);
	};
}

describe("usePersonPreview", () => {
	it("returns an empty preview while lists are loading", async () => {
		const { result } = renderHook(() => usePersonPreview("p-1"), { wrapper: createWrapper() });
		await waitFor(() => {
			expect(result.current.person).toBeNull();
			expect(result.current.manager).toBeNull();
			expect(result.current.fields).toEqual([]);
		});
	});
});
