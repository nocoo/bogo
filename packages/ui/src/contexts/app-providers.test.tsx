import { useLinkComponent } from "@nocoo/basalt/providers/link";
import { useQueryClient } from "@tanstack/react-query";
import { render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { AppProviders } from "./app-providers.js";
import { useWorkspaceContext } from "./workspace-context.js";

function wrapper({ children }: { children: ReactNode }) {
	return <AppProviders>{children}</AppProviders>;
}

function LinkConsumer() {
	const CustomLink = useLinkComponent();
	if (typeof CustomLink === "string") {
		return null;
	}
	return (
		<>
			<CustomLink href="https://example.com">External</CustomLink>
			<CustomLink href="/settings">Internal</CustomLink>
		</>
	);
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

	it("configures LinkProvider with external anchor and internal router link", () => {
		render(
			<MemoryRouter>
				<AppProviders>
					<LinkConsumer />
				</AppProviders>
			</MemoryRouter>,
		);
		const ext = screen.getByRole("link", { name: "External" });
		expect(ext.tagName).toBe("A");
		expect(ext.getAttribute("href")).toBe("https://example.com");

		const int = screen.getByRole("link", { name: "Internal" });
		expect(int.getAttribute("href")).toBe("/settings");
	});
});
