import { useQueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./app-providers.js";
import { useWorkspaceContext } from "./workspace-context.js";

function wrapper({ children }: { children: ReactNode }) {
	return <AppProviders>{children}</AppProviders>;
}

describe("AppProviders", () => {
	it("provides a QueryClient to children", () => {
		const { result } = renderHook(() => useQueryClient(), { wrapper });
		expect(result.current).toBeDefined();
		expect(result.current.getDefaultOptions().queries?.staleTime).toBe(30_000);
	});

	it("provides WorkspaceContext to children", () => {
		const { result } = renderHook(() => useWorkspaceContext(), { wrapper });
		expect(result.current.workspaceId).toBeNull();
		expect(result.current.switchWorkspace).toBeTypeOf("function");
	});
});
