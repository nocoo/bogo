import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { PersonTree } from "./PersonTree.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
	vi.stubGlobal(
		"ResizeObserver",
		class {
			observe() {
				/* noop */
			}
			unobserve() {
				/* noop */
			}
			disconnect() {
				/* noop */
			}
		},
	);
	vi.stubGlobal(
		"DOMMatrixReadOnly",
		class {
			m22 = 1;
		},
	);
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
		<QueryClientProvider client={queryClient}>
			<WorkspaceProvider>
				<WorkspaceSwitcher>{ui}</WorkspaceSwitcher>
			</WorkspaceProvider>
		</QueryClientProvider>,
	);
}

const ROOT = {
	id: "p-root",
	workspaceId: "ws-1",
	name: "Org",
	title: "Root",
	managerId: null,
	dottedManagerId: null,
	isRoot: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const ALICE = {
	id: "p-alice",
	workspaceId: "ws-1",
	name: "Alice",
	title: "Engineer",
	managerId: "p-root",
	dottedManagerId: null,
	isRoot: false,
	sortOrder: 1,
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
};

const BOB = {
	id: "p-bob",
	workspaceId: "ws-1",
	name: "Bob",
	title: "Designer",
	managerId: "p-root",
	dottedManagerId: null,
	isRoot: false,
	sortOrder: 2,
	createdAt: "2026-01-03",
	updatedAt: "2026-01-03",
};

describe("PersonTree", () => {
	it("shows workspace gate message when no workspace selected", () => {
		renderWithProviders(<PersonTree />);
		expect(screen.getByText("Select a workspace first")).toBeTruthy();
	});

	it("shows loading spinner after workspace selection", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const { container } = renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(container.querySelector(".animate-spin")).not.toBeNull());
	});

	it("shows error state when fetch fails", async () => {
		mockFetch.mockResolvedValue(err(500, "INTERNAL", "DB down"));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("Failed to load people")).toBeTruthy());
		expect(screen.getByText("DB down")).toBeTruthy();
	});

	it("shows empty state when no persons", async () => {
		mockFetch.mockResolvedValue(ok([]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("No people in this workspace yet")).toBeTruthy());
	});

	it("renders person nodes after data loads", async () => {
		mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("Org")).toBeTruthy());
		expect(screen.getByText("Alice")).toBeTruthy();
		expect(screen.getByText("Bob")).toBeTruthy();
	});

	it("shows Add button and opens create dialog", async () => {
		mockFetch.mockResolvedValue(ok([ROOT]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("Org")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Add person"));
		expect(screen.getByText("Add Person")).toBeTruthy();
		expect(screen.getByLabelText("Close create dialog")).toBeTruthy();
	});

	it("creates a person from the dialog", async () => {
		mockFetch.mockResolvedValue(ok([ROOT]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("Org")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Add person"));
		const nameInput = screen.getByPlaceholderText("Person name");
		fireEvent.change(nameInput, { target: { value: "New Person" } });

		mockFetch.mockResolvedValueOnce(ok(ALICE, 201)).mockResolvedValueOnce(ok([ROOT, ALICE]));
		fireEvent.click(screen.getByText("Create"));

		await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());
	});

	it("closes create dialog on Cancel", async () => {
		mockFetch.mockResolvedValue(ok([ROOT]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("Org")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Add person"));
		expect(screen.getByText("Add Person")).toBeTruthy();
		fireEvent.click(screen.getByText("Cancel"));
		expect(screen.queryByText("Add Person")).toBeNull();
	});

	it("shows empty-state add button and opens dialog", async () => {
		mockFetch.mockResolvedValue(ok([]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("No people in this workspace yet")).toBeTruthy());

		fireEvent.click(screen.getByText("Add first person"));
		expect(screen.getByText("Add Person")).toBeTruthy();
	});

	it("shows mutation error and dismisses it", async () => {
		mockFetch.mockResolvedValue(ok([ROOT]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("Org")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Add person"));
		const nameInput = screen.getByPlaceholderText("Person name");
		fireEvent.change(nameInput, { target: { value: "Bad" } });

		mockFetch.mockResolvedValueOnce(err(400, "VALIDATION", "Name invalid"));
		fireEvent.click(screen.getByText("Create"));

		await waitFor(() => expect(screen.getByText("Name invalid")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Dismiss error"));
		await waitFor(() => expect(screen.queryByText("Name invalid")).toBeNull());
	});
});
