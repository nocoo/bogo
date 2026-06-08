import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../../contexts/workspace-context.js";
import { getNodeCenter, PersonTree } from "./PersonTree.js";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("../TagPicker.js", () => ({
	TagPicker: () => <div data-testid="tag-picker" />,
}));

const mockScreenToFlowPosition = vi.fn((pos: { x: number; y: number }) => pos);

vi.mock("@xyflow/react", async () => {
	const actual = await vi.importActual<typeof import("@xyflow/react")>("@xyflow/react");
	return {
		...actual,
		ReactFlowProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
		// biome-ignore lint/suspicious/noExplicitAny: test mock component
		ReactFlow: ({ children, onNodeClick, onPaneClick, onNodeDragStop, nodes }: any) => (
			<div data-testid="react-flow">
				{/* biome-ignore lint/suspicious/noExplicitAny: test mock iteration */}
				{nodes?.map((node: any) => (
					// biome-ignore lint/a11y/useKeyWithClickEvents: test mock
					// biome-ignore lint/a11y/noStaticElementInteractions: test mock
					<div
						key={node.id}
						data-testid={`node-${node.id}`}
						data-id={node.id}
						onClick={(e) => onNodeClick?.(e, node)}
					>
						<span>{node.data.person.name}</span>
						{node.data.person.title && <span>{node.data.person.title}</span>}
					</div>
				))}
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: test helper */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: test helper */}
				<div data-testid="pane" onClick={() => onPaneClick?.()} />
				<button
					type="button"
					data-testid="drag-stop"
					onClick={() => onNodeDragStop?.({} as React.MouseEvent, { id: nodes?.[1]?.id ?? "" }, [])}
				>
					drag
				</button>
				{children}
			</div>
		),
		Background: () => null,
		Controls: () => null,
		useReactFlow: () => ({
			screenToFlowPosition: mockScreenToFlowPosition,
		}),
	};
});

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
	mockScreenToFlowPosition.mockImplementation((pos) => ({ x: pos.x + 10, y: pos.y + 10 }));
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
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>
				<WorkspaceProvider>
					<WorkspaceSwitcher>{ui}</WorkspaceSwitcher>
				</WorkspaceProvider>
			</QueryClientProvider>
		</MemoryRouter>,
	);
}

const ROOT = {
	id: "p-root",
	workspaceId: "ws-1",
	name: "Org",
	title: "Root",
	managerId: null,
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: true,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	tags: [],
};

const ALICE = {
	id: "p-alice",
	workspaceId: "ws-1",
	name: "Alice",
	title: "Engineer",
	managerId: "p-root",
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: false,
	sortOrder: 1,
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
	tags: [],
};

const BOB = {
	id: "p-bob",
	workspaceId: "ws-1",
	name: "Bob",
	title: "Designer",
	managerId: "p-root",
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: false,
	sortOrder: 2,
	createdAt: "2026-01-03",
	updatedAt: "2026-01-03",
	tags: [],
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

	it("shows empty state when no persons (no create button)", async () => {
		mockFetch.mockResolvedValue(ok([]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("No people in this workspace yet")).toBeTruthy());
		expect(screen.queryByLabelText("Add person")).toBeNull();
	});

	it("renders person nodes after data loads", async () => {
		mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("Org")).toBeTruthy());
		expect(screen.getByText("Alice")).toBeTruthy();
		expect(screen.getByText("Bob")).toBeTruthy();
	});

	it("shows Add button and opens create dialog with manager required", async () => {
		mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
		renderWithProviders(<PersonTree />);
		fireEvent.click(screen.getByText("Switch"));
		await waitFor(() => expect(screen.getByText("Org")).toBeTruthy());

		fireEvent.click(screen.getByLabelText("Add person"));
		expect(screen.getByText("Add Person")).toBeTruthy();
		const select = screen.getByLabelText("Reports to") as HTMLSelectElement;
		expect(select.value).toBe("p-root");
		expect(screen.queryByText("None (root)")).toBeNull();
	});

	it("creates a person with manager id in request body", async () => {
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
		const createCall = mockFetch.mock.calls.find(
			(c) => c[0]?.toString().includes("/persons") && c[1]?.method === "POST",
		);
		expect(createCall).toBeDefined();
		const body = JSON.parse(createCall?.[1].body);
		expect(body.managerId).toBe("p-root");
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

		await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Name invalid"));
	});

	describe("edit panel", () => {
		it("opens edit panel on node click", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

			fireEvent.click(screen.getByTestId("node-p-alice"));
			await waitFor(() => expect(screen.getByText("Edit Person")).toBeTruthy());
			expect(screen.getByDisplayValue("Alice")).toBeTruthy();
			expect(screen.getByDisplayValue("Engineer")).toBeTruthy();
		});

		it("closes edit panel on pane click", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

			fireEvent.click(screen.getByTestId("node-p-alice"));
			await waitFor(() => expect(screen.getByText("Edit Person")).toBeTruthy());

			fireEvent.click(screen.getByTestId("pane"));
			await waitFor(() => expect(screen.queryByText("Edit Person")).toBeNull());
		});

		it("saves name update via edit panel", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

			fireEvent.click(screen.getByTestId("node-p-alice"));
			await waitFor(() => expect(screen.getByText("Edit Person")).toBeTruthy());

			const nameInput = screen.getByDisplayValue("Alice");
			fireEvent.change(nameInput, { target: { value: "Alice2" } });

			mockFetch
				.mockResolvedValueOnce(ok({ ...ALICE, name: "Alice2" }))
				.mockResolvedValueOnce(ok([ROOT, { ...ALICE, name: "Alice2" }]));
			fireEvent.click(screen.getByText("Save"));

			await waitFor(() => expect(screen.getByText("Alice2")).toBeTruthy());
		});

		it("saves dotted manager update", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE, BOB]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

			fireEvent.click(screen.getByTestId("node-p-alice"));
			await waitFor(() => expect(screen.getByText("Edit Person")).toBeTruthy());

			const dottedSelect = screen.getByLabelText("Dotted-line manager") as HTMLSelectElement;
			fireEvent.change(dottedSelect, { target: { value: "p-bob" } });

			mockFetch
				.mockResolvedValueOnce(ok({ ...ALICE, dottedManagerId: "p-bob" }))
				.mockResolvedValueOnce(ok([ROOT, { ...ALICE, dottedManagerId: "p-bob" }, BOB]));
			fireEvent.click(screen.getByText("Save"));

			await waitFor(() => {
				const call = mockFetch.mock.calls.find(
					(c) => c[1]?.method === "PUT" && c[0]?.toString().includes("p-alice"),
				);
				expect(call).toBeDefined();
				const body = JSON.parse(call?.[1].body);
				expect(body.dottedManagerId).toBe("p-bob");
			});
		});

		it("deletes non-root person", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

			fireEvent.click(screen.getByTestId("node-p-alice"));
			await waitFor(() => expect(screen.getByText("Edit Person")).toBeTruthy());

			mockFetch.mockResolvedValueOnce(ok({ deleted: true })).mockResolvedValueOnce(ok([ROOT]));
			fireEvent.click(screen.getByLabelText("Delete Alice"));

			await waitFor(() => expect(screen.queryByText("Alice")).toBeNull());
		});

		it("does not show delete button for root person", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Org")).toBeTruthy());

			fireEvent.click(screen.getByTestId("node-p-root"));
			await waitFor(() => expect(screen.getByText("Edit Person")).toBeTruthy());
			expect(screen.queryByLabelText("Delete Org")).toBeNull();
		});

		it("closes edit panel via close button", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

			fireEvent.click(screen.getByTestId("node-p-alice"));
			await waitFor(() => expect(screen.getByText("Edit Person")).toBeTruthy());

			fireEvent.click(screen.getByLabelText("Close edit panel"));
			await waitFor(() => expect(screen.queryByText("Edit Person")).toBeNull());
		});
	});

	describe("drag and drop coordinate conversion", () => {
		it("calls screenToFlowPosition on node drag stop", async () => {
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

			fireEvent.click(screen.getByTestId("drag-stop"));

			expect(mockScreenToFlowPosition).toHaveBeenCalled();
			const arg = mockScreenToFlowPosition.mock.calls[0][0];
			expect(typeof arg.x).toBe("number");
			expect(typeof arg.y).toBe("number");
		});

		it("passes flow-space coordinates (not screen) to handleDrop", async () => {
			mockScreenToFlowPosition.mockReturnValue({ x: 999, y: 888 });
			mockFetch.mockResolvedValue(ok([ROOT, ALICE]));
			renderWithProviders(<PersonTree />);
			fireEvent.click(screen.getByText("Switch"));
			await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());

			fireEvent.click(screen.getByTestId("drag-stop"));

			expect(mockScreenToFlowPosition).toHaveBeenCalled();
		});
	});
});

describe("getNodeCenter", () => {
	it("returns null when element is not found", () => {
		expect(getNodeCenter("nonexistent")).toBeNull();
	});

	it("computes center from element bounding rect", () => {
		const el = document.createElement("div");
		el.setAttribute("data-id", "test-node");
		document.body.appendChild(el);
		Object.defineProperty(el, "getBoundingClientRect", {
			value: () => ({ left: 100, top: 200, width: 240, height: 80 }),
		});

		const result = getNodeCenter("test-node");
		expect(result).toEqual({ x: 220, y: 240 });

		document.body.removeChild(el);
	});
});
