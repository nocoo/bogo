import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
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

describe("WorkspaceContext", () => {
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
});
