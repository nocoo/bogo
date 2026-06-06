import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../contexts/workspace-context.js";
import { TagFilter } from "./TagFilter.js";

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

function SetupAndRender({
	selected,
	onChange,
}: {
	selected: string[];
	onChange: (ids: string[]) => void;
}) {
	const ctx = useWorkspaceContext();
	ctx.switchWorkspace(WS);
	return <TagFilter scope="document" selected={selected} onChange={onChange} />;
}

describe("TagFilter", () => {
	it("renders nothing when no tags available", async () => {
		mockFetch.mockResolvedValue(ok([]));
		const { container } = render(<SetupAndRender selected={[]} onChange={vi.fn()} />, {
			wrapper: Wrapper,
		});
		await waitFor(() => expect(container.querySelector("button")).toBeNull());
	});

	it("renders tag buttons for all tags", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		render(<SetupAndRender selected={[]} onChange={vi.fn()} />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("Engineering")).toBeTruthy());
		expect(screen.getByText("Urgent")).toBeTruthy();
	});

	it("highlights selected tags", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		render(<SetupAndRender selected={["tag-1"]} onChange={vi.fn()} />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("Engineering")).toBeTruthy());
		const engBtn = screen.getByLabelText("Remove filter Engineering");
		expect(engBtn.getAttribute("aria-pressed")).toBe("true");
	});

	it("calls onChange with added tag id on click", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		const onChange = vi.fn();
		render(<SetupAndRender selected={[]} onChange={onChange} />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("Urgent")).toBeTruthy());
		fireEvent.click(screen.getByLabelText("Add filter Urgent"));

		expect(onChange).toHaveBeenCalledWith(["tag-2"]);
	});

	it("calls onChange with removed tag id on click", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		const onChange = vi.fn();
		render(<SetupAndRender selected={["tag-1", "tag-2"]} onChange={onChange} />, {
			wrapper: Wrapper,
		});

		await waitFor(() => expect(screen.getByText("Engineering")).toBeTruthy());
		fireEvent.click(screen.getByLabelText("Remove filter Engineering"));

		expect(onChange).toHaveBeenCalledWith(["tag-2"]);
	});

	it("shows clear button when tags selected", async () => {
		mockFetch.mockResolvedValue(ok(ALL_TAGS));
		const onChange = vi.fn();
		render(<SetupAndRender selected={["tag-1"]} onChange={onChange} />, { wrapper: Wrapper });

		await waitFor(() => expect(screen.getByText("Clear")).toBeTruthy());
		fireEvent.click(screen.getByLabelText("Clear tag filter"));

		expect(onChange).toHaveBeenCalledWith([]);
	});
});
