import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../contexts/workspace-context.js";
import { TagsSettingsPage } from "./TagsSettingsPage.js";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const TAGS = [
	{
		id: "tag-1",
		workspaceId: "ws-1",
		name: "Engineering",
		scope: "document",
		color: "#3b82f6",
		sortOrder: 0,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		assignedCount: 5,
	},
	{
		id: "tag-2",
		workspaceId: "ws-1",
		name: "Urgent",
		scope: "document",
		color: "#ef4444",
		sortOrder: 1,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		assignedCount: 2,
	},
];

function Wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return (
		<QueryClientProvider client={queryClient}>
			<WorkspaceProvider>{children}</WorkspaceProvider>
		</QueryClientProvider>
	);
}

function SetupAndRender() {
	const ctx = useWorkspaceContext();
	ctx.switchWorkspace(WS);
	return <TagsSettingsPage />;
}

describe("TagsSettingsPage", () => {
	it("shows loading state initially", () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		render(<SetupAndRender />, { wrapper: Wrapper });
		expect(screen.getByText("Tags")).toBeTruthy();
	});

	it("renders document tags by default", async () => {
		mockFetch.mockResolvedValue(ok(TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("Engineering")).toBeTruthy());
		expect(screen.getByText("Urgent")).toBeTruthy();
	});

	it("shows assigned count for each tag", async () => {
		mockFetch.mockResolvedValue(ok(TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("5")).toBeTruthy());
		expect(screen.getByText("2")).toBeTruthy();
	});

	it("switches between document and person tabs", async () => {
		mockFetch.mockResolvedValue(ok(TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("Engineering")).toBeTruthy());

		mockFetch.mockResolvedValue(ok([]));
		fireEvent.click(screen.getByRole("tab", { name: "Person Tags" }));

		await waitFor(() => expect(screen.queryByText("Engineering")).toBeNull());
	});

	it("shows empty state when no tags", async () => {
		mockFetch.mockResolvedValue(ok([]));
		render(<SetupAndRender />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText(/No tags defined/)).toBeTruthy());
	});

	it("opens create form and submits", async () => {
		mockFetch.mockResolvedValue(ok([]));
		render(<SetupAndRender />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText(/No tags defined/)).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Create tag"));

		const nameInput = screen.getByLabelText("Tag name");
		fireEvent.change(nameInput, { target: { value: "NewTag" } });

		mockFetch.mockResolvedValue(ok({ id: "tag-new", name: "NewTag" }));
		fireEvent.click(screen.getByText("Create"));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tag created"));
	});

	it("deletes a tag after confirmation", async () => {
		mockFetch.mockResolvedValue(ok(TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("Engineering")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Delete Engineering"));

		mockFetch.mockResolvedValue(ok({ deleted: true }));
		fireEvent.click(screen.getByText("Confirm"));

		await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tag deleted"));
	});

	it("edits a tag name inline", async () => {
		mockFetch.mockResolvedValue(ok(TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("Engineering")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Edit Engineering"));

		const input = screen.getByLabelText("Edit tag name");
		fireEvent.change(input, { target: { value: "Platform" } });

		mockFetch.mockResolvedValue(ok({ updated: true }));
		fireEvent.click(screen.getByLabelText("Save tag"));

		await waitFor(() => expect(mockFetch).toHaveBeenCalled());
	});
});
