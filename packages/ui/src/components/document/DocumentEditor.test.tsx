import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentVM } from "../../viewmodels/document/use-document.js";
import { DocumentEditor } from "./DocumentEditor.js";

function createVM(overrides: Partial<DocumentVM> = {}): DocumentVM {
	return {
		document: {
			id: "doc-1",
			workspaceId: "ws-1",
			typeId: "dt-1",
			title: "Q1 Report",
			content: "# Summary",
			eventDate: "2026-03-01",
			version: 1,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
		},
		versions: [],
		isLoading: false,
		isLoadingVersions: false,
		error: null,
		update: vi.fn(),
		isUpdating: false,
		mutationError: null,
		clearMutationError: vi.fn(),
		...overrides,
	};
}

describe("DocumentEditor", () => {
	it("shows loading state", () => {
		const vm = createVM({ document: null, isLoading: true });
		const { container } = render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		expect(container.querySelector(".animate-spin")).not.toBeNull();
	});

	it("shows error state", () => {
		const vm = createVM({ document: null, error: new Error("Not found") });
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		expect(screen.getByText(/Not found/)).toBeTruthy();
	});

	it("shows not found when document is null", () => {
		const vm = createVM({ document: null });
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		expect(screen.getByText("Document not found")).toBeTruthy();
	});

	it("renders title and content from document", () => {
		const vm = createVM();
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		expect(screen.getByLabelText("Document title")).toBeTruthy();
		expect((screen.getByLabelText("Document title") as HTMLInputElement).value).toBe("Q1 Report");
		expect((screen.getByLabelText("Document content") as HTMLTextAreaElement).value).toBe(
			"# Summary",
		);
	});

	it("shows version number", () => {
		const vm = createVM();
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		expect(screen.getByText("v1")).toBeTruthy();
	});

	it("calls onBack when back button clicked", () => {
		const onBack = vi.fn();
		const vm = createVM();
		render(<DocumentEditor vm={vm} onBack={onBack} />);
		fireEvent.click(screen.getByLabelText("Back to documents"));
		expect(onBack).toHaveBeenCalled();
	});

	it("disables save when not dirty", () => {
		const vm = createVM();
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		const btn = screen.getByLabelText("Save document") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it("enables save after editing title", () => {
		const vm = createVM();
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		fireEvent.change(screen.getByLabelText("Document title"), {
			target: { value: "Updated Title" },
		});
		const btn = screen.getByLabelText("Save document") as HTMLButtonElement;
		expect(btn.disabled).toBe(false);
	});

	it("shows unsaved changes indicator", () => {
		const vm = createVM();
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		fireEvent.change(screen.getByLabelText("Document content"), {
			target: { value: "New content" },
		});
		expect(screen.getByText("Unsaved changes")).toBeTruthy();
	});

	it("calls update with only changed fields on save", () => {
		const update = vi.fn();
		const vm = createVM({ update });
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);

		fireEvent.change(screen.getByLabelText("Document title"), {
			target: { value: "New Title" },
		});
		fireEvent.click(screen.getByLabelText("Save document"));

		expect(update).toHaveBeenCalledWith({ title: "New Title" });
	});

	it("calls update with content when content changes", () => {
		const update = vi.fn();
		const vm = createVM({ update });
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);

		fireEvent.change(screen.getByLabelText("Document content"), {
			target: { value: "New body" },
		});
		fireEvent.click(screen.getByLabelText("Save document"));

		expect(update).toHaveBeenCalledWith({ content: "New body" });
	});

	it("does not call update when dirty but no actual changes", () => {
		const update = vi.fn();
		const vm = createVM({ update });
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);

		fireEvent.change(screen.getByLabelText("Document title"), {
			target: { value: "Q1 Report" },
		});
		fireEvent.click(screen.getByLabelText("Save document"));

		expect(update).not.toHaveBeenCalled();
	});

	it("shows mutation error with dismiss", () => {
		const clearMutationError = vi.fn();
		const vm = createVM({
			mutationError: new Error("Conflict"),
			clearMutationError,
		});
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		expect(screen.getByText(/Conflict/)).toBeTruthy();

		fireEvent.click(screen.getByLabelText("Dismiss error"));
		expect(clearMutationError).toHaveBeenCalled();
	});

	it("renders version list when versions exist", () => {
		const vm = createVM({
			versions: [
				{
					id: "v-1",
					documentId: "doc-1",
					version: 1,
					title: "Q1 Report",
					content: "# Summary",
					createdAt: "2026-01-01",
				},
				{
					id: "v-2",
					documentId: "doc-1",
					version: 2,
					title: "Q1 Final",
					content: "# Final",
					createdAt: "2026-01-02",
				},
			],
		});
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		expect(screen.getByText("Version History")).toBeTruthy();
		expect(screen.getByText("v2")).toBeTruthy();
		expect(screen.getByText("Q1 Final")).toBeTruthy();
	});

	it("highlights current version in version list", () => {
		const vm = createVM({
			versions: [
				{
					id: "v-1",
					documentId: "doc-1",
					version: 1,
					title: "Q1 Report",
					content: "# Summary",
					createdAt: "2026-01-01",
				},
			],
		});
		const { container } = render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		const highlighted = container.querySelector(".bg-primary\\/10");
		expect(highlighted).not.toBeNull();
		expect(highlighted?.textContent).toContain("v1");
	});

	it("disables save while updating", () => {
		const vm = createVM({ isUpdating: true });
		render(<DocumentEditor vm={vm} onBack={vi.fn()} />);
		const btn = screen.getByLabelText("Save document") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});
});
