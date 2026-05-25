import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { PersonDocTimeline } from "./PersonDocTimeline.js";

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

function WorkspaceSwitcher({ children }: { children: ReactNode }) {
	const ctx = useWorkspaceContext();
	return (
		<>
			<button
				type="button"
				onClick={() =>
					ctx.switchWorkspace({
						id: "ws-1",
						ownerId: "u-1",
						name: "Corp",
						createdAt: "2026-01-01",
						updatedAt: "2026-01-01",
					})
				}
			>
				Switch
			</button>
			{children}
		</>
	);
}

function renderWithProviders(ui: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>
				<WorkspaceProvider>
					<WorkspaceSwitcher>{ui}</WorkspaceSwitcher>
				</WorkspaceProvider>
			</QueryClientProvider>
		</MemoryRouter>,
	);
}

describe("PersonDocTimeline", () => {
	it("shows loading state", async () => {
		mockFetch.mockReturnValue(
			new Promise(() => {
				/* never resolves */
			}),
		);
		renderWithProviders(<PersonDocTimeline personId="p-1" onClose={vi.fn()} />);
		fireEvent.click(screen.getByText("Switch"));

		await waitFor(() => {
			expect(screen.getByRole("heading", { name: "Documents" })).toBeTruthy();
		});
	});

	it("shows empty state when no documents", async () => {
		mockFetch.mockResolvedValue(ok([]));
		renderWithProviders(<PersonDocTimeline personId="p-1" onClose={vi.fn()} />);
		fireEvent.click(screen.getByText("Switch"));

		await waitFor(() => {
			expect(screen.getByText("No documents")).toBeTruthy();
		});
	});

	it("renders documents with timeline", async () => {
		mockFetch.mockResolvedValue(
			ok([
				{
					id: "doc-1",
					workspaceId: "ws-1",
					typeId: null,
					title: "Undated Doc",
					content: "",
					eventDate: null,
					version: 1,
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				},
				{
					id: "doc-2",
					workspaceId: "ws-1",
					typeId: null,
					title: "Dated Doc",
					content: "",
					eventDate: "2026-03-15",
					version: 1,
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				},
			]),
		);
		renderWithProviders(<PersonDocTimeline personId="p-1" onClose={vi.fn()} />);
		fireEvent.click(screen.getByText("Switch"));

		await waitFor(() => {
			expect(screen.getByText("Undated Doc")).toBeTruthy();
			expect(screen.getByText("Dated Doc")).toBeTruthy();
			expect(screen.getByText("2026-03-15")).toBeTruthy();
		});
	});

	it("calls onClose when close button clicked", async () => {
		mockFetch.mockResolvedValue(ok([]));
		const onClose = vi.fn();
		renderWithProviders(<PersonDocTimeline personId="p-1" onClose={onClose} />);
		fireEvent.click(screen.getByText("Switch"));

		await waitFor(() => {
			expect(screen.getByLabelText("Close timeline")).toBeTruthy();
		});
		fireEvent.click(screen.getByLabelText("Close timeline"));
		expect(onClose).toHaveBeenCalled();
	});
});
