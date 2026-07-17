import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/viewmodels/person/use-person-list", () => ({
	usePersonList: vi.fn(),
}));

vi.mock("@/viewmodels/field/use-field-defs", () => ({
	useFieldDefs: vi.fn(() => ({
		defs: [],
		isLoading: false,
		error: null,
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		reorder: vi.fn(),
		isCreating: false,
		isUpdating: false,
		isRemoving: false,
	})),
}));

vi.mock("@/viewmodels/field/use-field-values", () => ({
	useFieldValues: vi.fn(() => ({
		values: [],
		isLoading: false,
		error: null,
		setValue: vi.fn(),
		removeValue: vi.fn(),
		isSetting: false,
		isRemoving: false,
	})),
}));

vi.mock("@/contexts/workspace-context", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/contexts/workspace-context")>();
	return {
		...actual,
		useWorkspaceContext: vi.fn(),
	};
});

vi.mock("@/components/person/PersonEditorForm", () => ({
	PersonEditorForm: ({
		person,
		onRemove,
	}: {
		person: { id: string; name: string };
		onRemove: (id: string) => void;
	}) => (
		<div data-testid="person-editor-form">
			<span>{person.name}</span>
			<button type="button" onClick={() => onRemove(person.id)}>
				Delete mock
			</button>
		</div>
	),
}));

import { useWorkspaceContext } from "@/contexts/workspace-context";
import { usePersonList } from "@/viewmodels/person/use-person-list";
import { PersonEditorPage } from "./PersonEditorPage";

const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);
const mockUsePersonList = vi.mocked(usePersonList);

const ALICE = {
	id: "p-alice",
	workspaceId: "ws-1",
	name: "Alice",
	title: "Engineer",
	managerId: null,
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: false,
	sortOrder: 1,
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
	tags: [],
};

function basePersonList(overrides = {}) {
	return {
		persons: [ALICE],
		isLoading: false,
		error: null,
		create: vi.fn(),
		update: vi.fn(),
		move: vi.fn(),
		remove: vi.fn(),
		isCreating: false,
		isMoving: false,
		isRemoving: false,
		mutationError: null,
		clearMutationError: vi.fn(),
		...overrides,
	};
}

function withWorkspace(workspaceId: string | null) {
	mockUseWorkspaceContext.mockReturnValue({
		workspaceId,
		workspace: null,
		switchWorkspace: vi.fn(),
		pendingId: null,
		hydrate: vi.fn(),
	});
}

function renderAtPath(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/people/:id" element={<PersonEditorPage />} />
				<Route path="/table" element={<div>Table page</div>} />
				<Route path="/people" element={<div>People page</div>} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("PersonEditorPage", () => {
	it("shows workspace gate when no workspace selected", () => {
		withWorkspace(null);
		mockUsePersonList.mockReturnValue(basePersonList());

		renderAtPath("/people/p-alice");
		expect(screen.getByText(/Select a workspace to edit people/)).toBeTruthy();
	});

	it("shows loading state while persons load", () => {
		withWorkspace("ws-1");
		mockUsePersonList.mockReturnValue(basePersonList({ isLoading: true, persons: [] }));

		const { container } = renderAtPath("/people/p-alice");
		expect(container.querySelector(".animate-spin")).toBeTruthy();
	});

	it("shows not-found when person id is unknown", () => {
		withWorkspace("ws-1");
		mockUsePersonList.mockReturnValue(basePersonList());

		renderAtPath("/people/missing");
		expect(screen.getByText("Person not found.")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Back to Table"));
		expect(screen.getByText("Table page")).toBeTruthy();
	});

	it("renders editor form for found person with back control", () => {
		withWorkspace("ws-1");
		mockUsePersonList.mockReturnValue(basePersonList());

		renderAtPath("/people/p-alice");
		expect(screen.getByTestId("person-editor-form")).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Alice" })).toBeTruthy();
		expect(screen.getByText("Engineer")).toBeTruthy();
		expect(screen.getByLabelText("Back to Table")).toBeTruthy();
	});

	it("back link returns to Table", () => {
		withWorkspace("ws-1");
		mockUsePersonList.mockReturnValue(basePersonList());

		renderAtPath("/people/p-alice");
		fireEvent.click(screen.getByLabelText("Back to Table"));
		expect(screen.getByText("Table page")).toBeTruthy();
	});

	it("shows No title placeholder when person has empty title", () => {
		withWorkspace("ws-1");
		mockUsePersonList.mockReturnValue(basePersonList({ persons: [{ ...ALICE, title: "" }] }));

		renderAtPath("/people/p-alice");
		expect(screen.getByRole("heading", { name: "Alice" })).toBeTruthy();
		expect(screen.getByText("No title")).toBeTruthy();
		expect(screen.queryByText("Engineer")).toBeNull();
	});

	it("navigates to table after remove", () => {
		const remove = vi.fn();
		withWorkspace("ws-1");
		mockUsePersonList.mockReturnValue(basePersonList({ remove }));

		renderAtPath("/people/p-alice");
		fireEvent.click(screen.getByText("Delete mock"));
		expect(remove).toHaveBeenCalledWith("p-alice");
		expect(screen.getByText("Table page")).toBeTruthy();
	});
});
