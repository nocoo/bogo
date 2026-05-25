import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "./workspace-context.js";

function createWrapper() {
	return function Wrapper({ children }: { children: ReactNode }) {
		return <WorkspaceProvider>{children}</WorkspaceProvider>;
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
	name: "Personal",
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
};

describe("WorkspaceContext", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		localStorage.clear();
	});

	it("starts with null workspace", () => {
		const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });
		expect(result.current.workspaceId).toBeNull();
		expect(result.current.workspace).toBeNull();
	});

	it("switchWorkspace updates both workspace and workspaceId", () => {
		const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

		act(() => result.current.switchWorkspace(WS1));
		expect(result.current.workspaceId).toBe("ws-1");
		expect(result.current.workspace).toEqual(WS1);
	});

	it("switchWorkspace(null) clears selection", () => {
		const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

		act(() => result.current.switchWorkspace(WS1));
		expect(result.current.workspaceId).toBe("ws-1");

		act(() => result.current.switchWorkspace(null));
		expect(result.current.workspaceId).toBeNull();
		expect(result.current.workspace).toBeNull();
	});

	it("throws when used outside provider", () => {
		expect(() => {
			renderHook(() => useWorkspaceContext());
		}).toThrow("useWorkspaceContext must be used within WorkspaceProvider");
	});

	describe("localStorage persistence", () => {
		it("switchWorkspace writes ID to localStorage", () => {
			const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

			act(() => result.current.switchWorkspace(WS1));
			expect(localStorage.getItem("bogo:workspace-id")).toBe("ws-1");
		});

		it("switchWorkspace(null) removes from localStorage", () => {
			localStorage.setItem("bogo:workspace-id", "ws-1");
			const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

			act(() => result.current.switchWorkspace(null));
			expect(localStorage.getItem("bogo:workspace-id")).toBeNull();
		});

		it("pendingId reads cached ID on mount", () => {
			localStorage.setItem("bogo:workspace-id", "ws-1");
			const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

			expect(result.current.pendingId).toBe("ws-1");
		});
	});

	describe("hydrate", () => {
		it("selects cached workspace when it exists in list", () => {
			localStorage.setItem("bogo:workspace-id", "ws-2");
			const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

			act(() => result.current.hydrate([WS1, WS2]));
			expect(result.current.workspaceId).toBe("ws-2");
			expect(result.current.workspace).toEqual(WS2);
		});

		it("selects first workspace when cached ID is not in list", () => {
			localStorage.setItem("bogo:workspace-id", "ws-gone");
			const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

			act(() => result.current.hydrate([WS1, WS2]));
			expect(result.current.workspaceId).toBe("ws-1");
			expect(result.current.workspace).toEqual(WS1);
		});

		it("selects first workspace when no cached ID", () => {
			const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

			act(() => result.current.hydrate([WS1, WS2]));
			expect(result.current.workspaceId).toBe("ws-1");
		});

		it("does nothing when workspace already selected", () => {
			const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

			act(() => result.current.switchWorkspace(WS2));
			act(() => result.current.hydrate([WS1]));
			expect(result.current.workspaceId).toBe("ws-2");
		});

		it("does nothing with empty list", () => {
			const { result } = renderHook(() => useWorkspaceContext(), { wrapper: createWrapper() });

			act(() => result.current.hydrate([]));
			expect(result.current.workspaceId).toBeNull();
		});
	});
});
