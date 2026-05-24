import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider } from "../../contexts/workspace-context.js";
import { WorkspaceList } from "./WorkspaceList.js";

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.clearAllMocks();
});

function ok(data: unknown, status = 200) {
	return new Response(JSON.stringify({ data }), { status });
}

function err(status: number, code: string, message: string) {
	return new Response(JSON.stringify({ error: { code, message } }), { status });
}

function renderWithProviders(ui: ReactNode) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return render(
		<QueryClientProvider client={queryClient}>
			<WorkspaceProvider>{ui}</WorkspaceProvider>
		</QueryClientProvider>,
	);
}

const WS1 = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};
const WS2 = {
	id: "ws-2",
	ownerId: "u-1",
	name: "Lab",
	createdAt: "2026-01-02T00:00:00Z",
	updatedAt: "2026-01-02T00:00:00Z",
};

describe("WorkspaceList", () => {
	it("shows loading spinner initially", () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const { container } = renderWithProviders(<WorkspaceList />);
		expect(container.querySelector(".animate-spin")).not.toBeNull();
	});

	it("shows error state when fetch fails", async () => {
		mockFetch.mockResolvedValue(err(500, "INTERNAL", "Server down"));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Failed to load workspaces")).toBeTruthy());
		expect(screen.getByText("Server down")).toBeTruthy();
	});

	it("shows empty state when no workspaces", async () => {
		mockFetch.mockResolvedValue(ok([]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("No workspaces yet")).toBeTruthy());
	});

	it("renders workspace items when data is loaded", async () => {
		mockFetch.mockResolvedValue(ok([WS1, WS2]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());
		expect(screen.getByText("Lab")).toBeTruthy();
	});

	it("selects workspace on click and shows selected style", async () => {
		mockFetch.mockResolvedValue(ok([WS1, WS2]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		fireEvent.click(screen.getByText("Corp"));
		await waitFor(() => {
			const item = screen.getByText("Corp").closest("div[class*='primary/10']");
			expect(item).not.toBeNull();
		});
	});

	it("opens create form and creates workspace", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		fireEvent.click(screen.getByText("New"));
		const input = screen.getByPlaceholderText("Workspace name");
		expect(input).toBeTruthy();

		fireEvent.change(input, { target: { value: "New WS" } });

		const created = {
			id: "ws-new",
			ownerId: "u-1",
			name: "New WS",
			createdAt: "2026-05-24",
			updatedAt: "2026-05-24",
		};
		mockFetch.mockResolvedValue(ok(created, 201));
		fireEvent.click(screen.getByText("Create"));

		await waitFor(() => expect(screen.getByText("New WS")).toBeTruthy());
	});

	it("cancels create form on Cancel click", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		fireEvent.click(screen.getByText("New"));
		expect(screen.getByPlaceholderText("Workspace name")).toBeTruthy();

		fireEvent.click(screen.getByText("Cancel"));
		expect(screen.queryByPlaceholderText("Workspace name")).toBeNull();
	});

	it("renames workspace via inline edit", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		const renameBtn = screen.getByLabelText("Rename Corp");
		fireEvent.click(renameBtn);

		const input = screen.getByDisplayValue("Corp");
		fireEvent.change(input, { target: { value: "Renamed" } });

		const renamed = { ...WS1, name: "Renamed" };
		mockFetch.mockResolvedValueOnce(ok(renamed)).mockResolvedValueOnce(ok([renamed]));
		fireEvent.blur(input);

		await waitFor(() => expect(screen.getByText("Renamed")).toBeTruthy());
	});

	it("deletes workspace on delete button click", async () => {
		mockFetch.mockResolvedValue(ok([WS1, WS2]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		mockFetch.mockResolvedValueOnce(ok({ deleted: true })).mockResolvedValueOnce(ok([WS2]));
		const deleteBtn = screen.getByLabelText("Delete Corp");
		fireEvent.click(deleteBtn);

		await waitFor(() => expect(screen.queryByText("Corp")).toBeNull());
		expect(screen.getByText("Lab")).toBeTruthy();
	});

	it("submits rename on Enter key", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Rename Corp"));
		const input = screen.getByDisplayValue("Corp");
		fireEvent.change(input, { target: { value: "Renamed" } });

		const renamed = { ...WS1, name: "Renamed" };
		mockFetch.mockResolvedValueOnce(ok(renamed)).mockResolvedValueOnce(ok([renamed]));
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => expect(screen.getByText("Renamed")).toBeTruthy());
	});

	it("cancels rename on Escape key", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Rename Corp"));
		const input = screen.getByDisplayValue("Corp");
		fireEvent.change(input, { target: { value: "Nope" } });
		fireEvent.keyDown(input, { key: "Escape" });

		expect(screen.queryByDisplayValue("Nope")).toBeNull();
		expect(screen.getByText("Corp")).toBeTruthy();
	});

	it("does not propagate click on rename input", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Rename Corp"));
		const input = screen.getByDisplayValue("Corp");
		fireEvent.click(input);

		expect(input).toBeTruthy();
	});

	it("creates workspace on Enter key in create form", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		fireEvent.click(screen.getByText("New"));
		const input = screen.getByPlaceholderText("Workspace name");
		fireEvent.change(input, { target: { value: "KeyWS" } });

		const created = {
			id: "ws-key",
			ownerId: "u-1",
			name: "KeyWS",
			createdAt: "2026-05-24",
			updatedAt: "2026-05-24",
		};
		mockFetch.mockResolvedValue(ok(created, 201));
		fireEvent.keyDown(input, { key: "Enter" });

		await waitFor(() => expect(screen.getByText("KeyWS")).toBeTruthy());
	});

	it("cancels create form on Escape key", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		fireEvent.click(screen.getByText("New"));
		const input = screen.getByPlaceholderText("Workspace name");
		fireEvent.change(input, { target: { value: "Nope" } });
		fireEvent.keyDown(input, { key: "Escape" });

		expect(screen.queryByPlaceholderText("Workspace name")).toBeNull();
	});

	it("shows mutation error message", async () => {
		mockFetch.mockResolvedValue(ok([WS1]));
		renderWithProviders(<WorkspaceList />);
		await waitFor(() => expect(screen.getByText("Corp")).toBeTruthy());

		mockFetch
			.mockResolvedValueOnce(err(403, "FORBIDDEN", "Not allowed"))
			.mockResolvedValueOnce(ok([WS1]));
		const deleteBtn = screen.getByLabelText("Delete Corp");
		fireEvent.click(deleteBtn);

		await waitFor(() => expect(screen.getByText("Not allowed")).toBeTruthy());
	});
});
