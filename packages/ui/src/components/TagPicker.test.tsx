import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../contexts/workspace-context.js";
import { TagPicker } from "./TagPicker.js";

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

const ALL_TAGS = [
	{
		id: "tag-1",
		workspaceId: "ws-1",
		name: "Engineering",
		scope: "document",
		color: "#3b82f6",
		sortOrder: 0,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
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
	},
];

const ASSIGNED_TAGS = [{ id: "tag-1", name: "Engineering", color: "#3b82f6" }];

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

function SetupAndRender({ assignedTags = ASSIGNED_TAGS }: { assignedTags?: typeof ASSIGNED_TAGS }) {
	const ctx = useWorkspaceContext();
	ctx.switchWorkspace(WS);
	return <TagPicker scope="document" entityId="doc-1" assignedTags={assignedTags} />;
}

describe("TagPicker", () => {
	it("renders assigned tag badges", () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });
		expect(screen.getByText("Engineering")).toBeTruthy();
	});

	it("shows 'Add tags' when no tags assigned", () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		render(<SetupAndRender assignedTags={[]} />, { wrapper: Wrapper });
		expect(screen.getByText("Add tags")).toBeTruthy();
	});

	it("opens dropdown on click and shows all tags", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		fireEvent.click(screen.getByLabelText("Manage tags"));

		await waitFor(() => expect(screen.getByText("Urgent")).toBeTruthy());
	});

	it("shows check mark for assigned tags", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		fireEvent.click(screen.getByLabelText("Manage tags"));

		await waitFor(() => expect(screen.getByText("Urgent")).toBeTruthy());
		const buttons = screen.getAllByRole("button");
		const engButton = buttons.find((b) => b.textContent?.includes("Engineering"));
		expect(engButton?.querySelector("svg")).toBeTruthy();
	});

	it("calls assign when clicking unassigned tag", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		fireEvent.click(screen.getByLabelText("Manage tags"));
		await waitFor(() => expect(screen.getByText("Urgent")).toBeTruthy());

		mockFetch.mockResolvedValue(ok({ assigned: true }));
		const buttons = screen.getAllByRole("button");
		const urgentButton = buttons.find((b) => b.textContent?.includes("Urgent"));
		if (urgentButton) {
			fireEvent.click(urgentButton);
		}

		await waitFor(() => {
			const assignCall = mockFetch.mock.calls.find(
				(c) =>
					typeof c[0] === "string" &&
					c[0].includes("tag-2") &&
					(c[1] as RequestInit)?.method === "PUT",
			);
			expect(assignCall).toBeTruthy();
		});
	});

	it("calls unassign when clicking assigned tag", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		render(<SetupAndRender />, { wrapper: Wrapper });

		fireEvent.click(screen.getByLabelText("Manage tags"));
		await waitFor(() => expect(screen.getByText("Urgent")).toBeTruthy());

		mockFetch.mockResolvedValue(ok({ removed: true }));
		const engTexts = screen.getAllByText("Engineering");
		const dropdownEng = engTexts[engTexts.length - 1];
		const btn = dropdownEng.closest("button");
		if (btn) {
			fireEvent.click(btn);
		}

		await waitFor(() => {
			const unassignCall = mockFetch.mock.calls.find(
				(c) =>
					typeof c[0] === "string" &&
					c[0].includes("tag-1") &&
					(c[1] as RequestInit)?.method === "DELETE",
			);
			expect(unassignCall).toBeTruthy();
		});
	});

	it("shows empty state when no tags exist", async () => {
		mockFetch.mockResolvedValue(ok([]));
		render(<SetupAndRender assignedTags={[]} />, { wrapper: Wrapper });

		fireEvent.click(screen.getByLabelText("Manage tags"));

		await waitFor(() => expect(screen.getByText("No tags available")).toBeTruthy());
	});
});
