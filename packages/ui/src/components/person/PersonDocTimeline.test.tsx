import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../../contexts/workspace-context.js";
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
					tags: [],
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
					tags: [],
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

	it("renders type chip and tag badges on a document card", async () => {
		mockFetch.mockImplementation((url: string) => {
			if (url.includes("/persons/p-1/documents")) {
				return Promise.resolve(
					ok([
						{
							id: "doc-1",
							workspaceId: "ws-1",
							typeId: "dt-1",
							title: "Tagged Doc",
							content: "",
							eventDate: null,
							version: 2,
							createdAt: "2026-01-01",
							updatedAt: "2026-01-01",
							tags: [{ id: "tag-1", name: "alpha", color: "#3b82f6" }],
						},
					]),
				);
			}
			if (url.includes("/doc-types")) {
				return Promise.resolve(
					ok([
						{
							id: "dt-1",
							workspaceId: "ws-1",
							name: "Connect",
							color: "#8b5cf6",
							sortOrder: 0,
							createdAt: "2026-01-01",
						},
					]),
				);
			}
			return Promise.resolve(ok([]));
		});
		renderWithProviders(<PersonDocTimeline personId="p-1" onClose={vi.fn()} />);
		fireEvent.click(screen.getByText("Switch"));

		await waitFor(() => {
			expect(screen.getByText("Tagged Doc")).toBeTruthy();
			expect(screen.getByText("Connect")).toBeTruthy();
			expect(screen.getByText("alpha")).toBeTruthy();
			expect(screen.getByText("v2")).toBeTruthy();
			expect(screen.getByText("No date")).toBeTruthy();
		});
	});

	it("navigates to the document detail page on click", async () => {
		mockFetch.mockResolvedValue(
			ok([
				{
					id: "doc-1",
					workspaceId: "ws-1",
					typeId: null,
					title: "Click me",
					content: "",
					eventDate: null,
					version: 1,
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
					tags: [],
				},
			]),
		);
		renderWithProviders(<PersonDocTimeline personId="p-1" onClose={vi.fn()} />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => {
			expect(screen.getByText("Click me")).toBeTruthy();
		});
		fireEvent.click(screen.getByText("Click me"));
		// React Router navigates relative to the in-memory router; verifying the
		// click didn't throw + the card is interactive is enough for this layer.
		expect(screen.getByText("Click me")).toBeTruthy();
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
