import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("../viewmodels/document/use-document.js", () => ({
	useDocument: vi.fn(),
}));

vi.mock("../viewmodels/person/use-person-list.js", () => ({
	usePersonList: vi.fn(),
}));

vi.mock("../contexts/workspace-context.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../contexts/workspace-context.js")>();
	return {
		...actual,
		useWorkspaceContext: vi.fn(),
	};
});

import { useWorkspaceContext } from "../contexts/workspace-context.js";
import { useDocument } from "../viewmodels/document/use-document.js";
import { usePersonList } from "../viewmodels/person/use-person-list.js";
import { DocumentEditorPage } from "./DocumentEditorPage.js";

const mockUseWorkspaceContext = vi.mocked(useWorkspaceContext);
const mockUseDocument = vi.mocked(useDocument);
const mockUsePersonList = vi.mocked(usePersonList);

function baseVM(overrides = {}) {
	return {
		document: null,
		versions: [],
		persons: [],
		isLoading: false,
		isLoadingVersions: false,
		isLoadingPersons: false,
		error: null,
		update: vi.fn(),
		isUpdating: false,
		mutationError: null,
		clearMutationError: vi.fn(),
		addPerson: vi.fn(),
		isAddingPerson: false,
		removePerson: vi.fn(),
		isRemovingPerson: false,
		personError: null,
		clearPersonError: vi.fn(),
		...overrides,
	};
}

function basePersonListVM() {
	return {
		persons: [],
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

function renderAtPath(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/documents/:id" element={<DocumentEditorPage />} />
			</Routes>
		</MemoryRouter>,
	);
}

describe("DocumentEditorPage", () => {
	it("shows workspace gate when no workspace selected", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: null,
			workspace: null,
			switchWorkspace: vi.fn(),
		});
		mockUseDocument.mockReturnValue(baseVM());
		mockUsePersonList.mockReturnValue(basePersonListVM());

		renderAtPath("/documents/doc-1");
		expect(screen.getByText(/Select a workspace/)).toBeTruthy();
	});

	it("remounts editor when document id changes via navigation", () => {
		mockUseWorkspaceContext.mockReturnValue({
			workspaceId: "ws-1",
			workspace: null,
			switchWorkspace: vi.fn(),
		});
		mockUsePersonList.mockReturnValue(basePersonListVM());

		mockUseDocument.mockImplementation((id: string) => {
			return baseVM({
				document: {
					id,
					workspaceId: "ws-1",
					typeId: null,
					title: id === "doc-1" ? "First" : "Second",
					content: "",
					eventDate: null,
					version: 1,
					createdAt: "2026-01-01",
					updatedAt: "2026-01-01",
				},
			});
		});

		function NavHelper() {
			const navigate = useNavigate();
			return (
				<button type="button" onClick={() => navigate("/documents/doc-2")}>
					Go to doc-2
				</button>
			);
		}

		render(
			<MemoryRouter initialEntries={["/documents/doc-1"]}>
				<Routes>
					<Route
						path="/documents/:id"
						element={
							<>
								<DocumentEditorPage />
								<NavHelper />
							</>
						}
					/>
				</Routes>
			</MemoryRouter>,
		);

		expect((screen.getByLabelText("Document title") as HTMLInputElement).value).toBe("First");

		fireEvent.click(screen.getByText("Go to doc-2"));

		expect((screen.getByLabelText("Document title") as HTMLInputElement).value).toBe("Second");
	});
});
