import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "../../contexts/workspace-context.js";
import { WorkspaceSelector } from "./WorkspaceSelector.js";

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

const WORKSPACES = [
	{ id: "ws-1", ownerId: "u-1", name: "Alpha", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
	{ id: "ws-2", ownerId: "u-1", name: "Beta", createdAt: "2026-01-02", updatedAt: "2026-01-02" },
];

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<WorkspaceProvider>
					<MemoryRouter>{children}</MemoryRouter>
				</WorkspaceProvider>
			</QueryClientProvider>
		);
	};
}

describe("WorkspaceSelector", () => {
	it("shows 'Select workspace' when loaded with none selected", async () => {
		mockFetch.mockResolvedValueOnce(ok(WORKSPACES));
		render(<WorkspaceSelector />, { wrapper: createWrapper() });
		const { findByText } = screen;
		expect(await findByText("Select workspace")).toBeTruthy();
	});

	it("opens dropdown and shows workspaces on click", async () => {
		mockFetch.mockResolvedValueOnce(ok(WORKSPACES));
		render(<WorkspaceSelector />, { wrapper: createWrapper() });

		const btn = await screen.findByLabelText("Select workspace");
		fireEvent.click(btn);

		expect(await screen.findByText("Alpha")).toBeTruthy();
		expect(await screen.findByText("Beta")).toBeTruthy();
	});

	it("selects workspace on item click", async () => {
		mockFetch.mockResolvedValueOnce(ok(WORKSPACES));
		render(<WorkspaceSelector />, { wrapper: createWrapper() });

		const btn = await screen.findByLabelText("Select workspace");
		fireEvent.click(btn);
		const alpha = await screen.findByText("Alpha");
		fireEvent.click(alpha);

		expect(screen.getByText("Alpha")).toBeTruthy();
	});

	it("closes dropdown on outside click", async () => {
		mockFetch.mockResolvedValueOnce(ok(WORKSPACES));
		render(<WorkspaceSelector />, { wrapper: createWrapper() });

		const btn = await screen.findByLabelText("Select workspace");
		fireEvent.click(btn);
		await screen.findByText("Alpha");

		fireEvent.mouseDown(document.body);

		expect(screen.queryByText("Alpha")).toBeNull();
	});

	it("shows loading state while fetching", () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		render(<WorkspaceSelector />, { wrapper: createWrapper() });
		expect(screen.getByText("Loading…")).toBeTruthy();
	});

	it("shows empty state when no workspaces", async () => {
		mockFetch.mockResolvedValueOnce(ok([]));
		render(<WorkspaceSelector />, { wrapper: createWrapper() });

		const btn = await screen.findByLabelText("Select workspace");
		fireEvent.click(btn);
		expect(await screen.findByText("No workspaces")).toBeTruthy();
	});

	it("has manage workspaces button", async () => {
		mockFetch.mockResolvedValueOnce(ok(WORKSPACES));
		render(<WorkspaceSelector />, { wrapper: createWrapper() });
		expect(screen.getByLabelText("Manage workspaces")).toBeTruthy();
	});
});
