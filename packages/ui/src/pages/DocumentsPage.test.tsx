import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chooseSelect } from "../test-select.js";
import { DocumentsPage } from "./DocumentsPage.js";

vi.mock("../viewmodels/document/use-doc-types.js", () => ({
	useDocTypes: vi.fn(),
}));

vi.mock("../viewmodels/document/use-documents.js", () => ({
	useDocuments: vi.fn(),
}));

vi.mock("../viewmodels/person/use-person-list.js", () => ({
	usePersonList: vi.fn(),
}));

vi.mock("../components/TagFilter.js", () => ({
	TagFilter: () => <div data-testid="tag-filter" />,
}));

vi.mock("../components/DocumentFilters.js", () => ({
	DocumentFilters: () => <div data-testid="document-filters" />,
	countActive: () => 0,
	EMPTY_FILTERS: {
		keyword: "",
		typeId: "all",
		dateFrom: "",
		dateTo: "",
		tagIds: [],
		personIds: [],
	},
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/react-query")>();
	return {
		...actual,
		useQuery: vi.fn(() => ({ data: [], isLoading: false, error: null })),
	};
});

vi.mock("../contexts/workspace-context.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../contexts/workspace-context.js")>();
	return {
		...actual,
		useWorkspaceContext: vi.fn(),
	};
});

import { useWorkspaceContext } from "../contexts/workspace-context.js";
import { useDocTypes } from "../viewmodels/document/use-doc-types.js";
import { useDocuments } from "../viewmodels/document/use-documents.js";
import { usePersonList } from "../viewmodels/person/use-person-list.js";

const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);
const mockUseDocTypes = vi.mocked(useDocTypes);
const mockUseDocuments = vi.mocked(useDocuments);
const mockUsePersonList = vi.mocked(usePersonList);

const DOC_A = {
	id: "doc-1",
	workspaceId: "ws-1",
	typeId: "dt-1",
	title: "Q1 Report",
	content: "# Summary",
	eventDate: "2026-03-01",
	version: 1,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
	tags: [],
	personIds: ["p-mina", "p-theo"],
};

const DOC_B = {
	id: "doc-2",
	workspaceId: "ws-1",
	typeId: null,
	title: "Draft Notes",
	content: "",
	eventDate: null,
	version: 3,
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
	tags: [],
};

function baseDocTypesVm() {
	return {
		types: [
			{
				id: "dt-1",
				workspaceId: "ws-1",
				name: "Report",
				color: "#3b82f6",
				sortOrder: 0,
				createdAt: "2026-01-01",
			},
		],
		isLoading: false,
		error: null,
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		reorder: vi.fn(),
		isCreating: false,
		isUpdating: false,
		isRemoving: false,
	};
}

function basePersonListVm(persons: { id: string; name: string; avatarUrl: string | null }[] = []) {
	return {
		persons: persons.map((p) => ({
			...p,
			workspaceId: "ws-1",
			title: "",
			managerId: null,
			dottedManagerId: null,
			isRoot: false,
			sortOrder: 0,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
			tags: [],
		})),
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
	};
}

function baseDocumentsVm() {
	return {
		documents: [DOC_A, DOC_B],
		isLoading: false,
		error: null,
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		isCreating: false,
		isUpdating: false,
		isRemoving: false,
	};
}

describe("DocumentsPage", () => {
	beforeEach(() => {
		mockUsePersonList.mockReturnValue(basePersonListVm());
	});

	it("shows workspace gate when no workspace selected", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: null,
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue(baseDocumentsVm());

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText(/Select a workspace/)).toBeTruthy();
	});

	it("shows loading state", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue({ ...baseDocumentsVm(), documents: [], isLoading: true });

		const { container } = render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		expect(container.querySelector(".animate-spin")).not.toBeNull();
	});

	it("shows error state", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue({
			...baseDocumentsVm(),
			documents: [],
			error: new Error("DB down"),
		});

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText(/DB down/)).toBeTruthy();
	});

	it("shows empty state when no documents", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue({ ...baseDocumentsVm(), documents: [] });

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("No documents yet")).toBeTruthy();
	});

	it("renders document list with type badge and version", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue(baseDocumentsVm());

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("Q1 Report")).toBeTruthy();
		expect(screen.getByText("Draft Notes")).toBeTruthy();
		expect(screen.getByText("Report")).toBeTruthy();
		expect(screen.getByText("v1")).toBeTruthy();
		expect(screen.getByText("v3")).toBeTruthy();
		expect(screen.getByText("2026-03-01")).toBeTruthy();
	});

	it("opens create form and submits", () => {
		const create = vi.fn();
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue({ ...baseDocumentsVm(), create });

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		fireEvent.click(screen.getByLabelText("Create document"));
		expect(screen.getByLabelText("Title")).toBeTruthy();

		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "My Doc" } });
		fireEvent.click(screen.getByText("Create"));

		expect(create).toHaveBeenCalledWith({
			title: "My Doc",
			content: "",
			personIds: [],
			typeId: null,
		});
	});

	it("does not submit create with empty title", () => {
		const create = vi.fn();
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue({ ...baseDocumentsVm(), create });

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		fireEvent.click(screen.getByLabelText("Create document"));
		fireEvent.click(screen.getByText("Create"));

		expect(create).not.toHaveBeenCalled();
	});

	it("calls remove on delete button click", () => {
		const remove = vi.fn();
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue({ ...baseDocumentsVm(), remove });

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		fireEvent.click(screen.getByLabelText("Delete Q1 Report"));
		expect(remove).toHaveBeenCalledWith("doc-1");
	});

	it("allows type selection in create form", () => {
		const create = vi.fn();
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue({ ...baseDocumentsVm(), create });

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		fireEvent.click(screen.getByLabelText("Create document"));
		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Typed" } });
		chooseSelect("Type", "Report");
		fireEvent.click(screen.getByText("Create"));

		expect(create).toHaveBeenCalledWith({
			title: "Typed",
			content: "",
			personIds: [],
			typeId: "dt-1",
		});
	});

	it("shows associated people on each document row", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue(baseDocumentsVm());
		mockUsePersonList.mockReturnValue(
			basePersonListVm([
				{ id: "p-mina", name: "Mina Park", avatarUrl: null },
				{ id: "p-theo", name: "Theo Alvarez", avatarUrl: null },
			]),
		);

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		expect(screen.getByText("People on Q1 Report")).toBeTruthy();
		expect(screen.getByLabelText("Avatar for Mina Park")).toBeTruthy();
		expect(screen.getByLabelText("Avatar for Theo Alvarez")).toBeTruthy();
		expect(screen.queryByText("People on Draft Notes")).toBeNull();
	});

	it("document row links to detail page", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
			pendingId: null,
			hydrate: vi.fn(),
		});
		mockUseDocTypes.mockReturnValue(baseDocTypesVm());
		mockUseDocuments.mockReturnValue(baseDocumentsVm());

		render(
			<MemoryRouter>
				<DocumentsPage />
			</MemoryRouter>,
		);
		const link = screen.getByLabelText("Open Q1 Report");
		expect(link.getAttribute("href")).toBe("/documents/doc-1");
	});
});
