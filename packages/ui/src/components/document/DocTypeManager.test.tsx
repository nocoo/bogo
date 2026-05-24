import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocTypesVM } from "../../viewmodels/document/use-doc-types.js";
import { DocTypeManager } from "./DocTypeManager.js";

function createVM(overrides: Partial<DocTypesVM> = {}): DocTypesVM {
	return {
		types: [],
		isLoading: false,
		error: null,
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		reorder: vi.fn(),
		isCreating: false,
		isUpdating: false,
		isRemoving: false,
		mutationError: null,
		clearMutationError: vi.fn(),
		...overrides,
	};
}

const TYPE_A = {
	id: "dt-1",
	workspaceId: "ws-1",
	name: "Meeting Notes",
	color: "#3b82f6",
	sortOrder: 0,
	createdAt: "2026-01-01",
};

const TYPE_B = {
	id: "dt-2",
	workspaceId: "ws-1",
	name: "Policy",
	color: "#ef4444",
	sortOrder: 1,
	createdAt: "2026-01-02",
};

const TYPE_NO_COLOR = {
	id: "dt-3",
	workspaceId: "ws-1",
	name: "Draft",
	color: null,
	sortOrder: 2,
	createdAt: "2026-01-03",
};

describe("DocTypeManager", () => {
	it("shows loading spinner", () => {
		const vm = createVM({ isLoading: true });
		const { container } = render(<DocTypeManager vm={vm} />);
		expect(container.querySelector(".animate-spin")).not.toBeNull();
	});

	it("shows error state", () => {
		const vm = createVM({ error: new Error("Connection failed") });
		render(<DocTypeManager vm={vm} />);
		expect(screen.getByText(/Connection failed/)).toBeTruthy();
	});

	it("shows empty state when no types", () => {
		const vm = createVM();
		render(<DocTypeManager vm={vm} />);
		expect(screen.getByText("No document types defined yet")).toBeTruthy();
	});

	it("renders type list with color swatches", () => {
		const vm = createVM({ types: [TYPE_A, TYPE_B] });
		render(<DocTypeManager vm={vm} />);
		expect(screen.getByLabelText(`Edit ${TYPE_A.name}`)).toBeTruthy();
		expect(screen.getByLabelText(`Edit ${TYPE_B.name}`)).toBeTruthy();
		expect(screen.getByLabelText(`Change color for ${TYPE_A.name}`)).toBeTruthy();
	});

	it("renders color swatch with fallback when color is null", () => {
		const vm = createVM({ types: [TYPE_NO_COLOR] });
		render(<DocTypeManager vm={vm} />);
		expect(screen.getByLabelText(`Change color for ${TYPE_NO_COLOR.name}`)).toBeTruthy();
	});

	it("shows mutation error with dismiss", () => {
		const clearMutationError = vi.fn();
		const vm = createVM({
			mutationError: new Error("Name required"),
			clearMutationError,
		});
		render(<DocTypeManager vm={vm} />);
		expect(screen.getByText(/Name required/)).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Dismiss error"));
		expect(clearMutationError).toHaveBeenCalled();
	});

	describe("create", () => {
		it("opens create form and submits", () => {
			const create = vi.fn();
			const vm = createVM({ create });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Add document type"));
			expect(screen.getByText("New Document Type")).toBeTruthy();

			fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Invoice" } });
			fireEvent.click(screen.getByText("Create"));

			expect(create).toHaveBeenCalledWith({ name: "Invoice", color: "#3b82f6" });
		});

		it("does not submit with empty name", () => {
			const create = vi.fn();
			const vm = createVM({ create });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Add document type"));
			fireEvent.click(screen.getByText("Create"));

			expect(create).not.toHaveBeenCalled();
		});

		it("allows color selection", () => {
			const create = vi.fn();
			const vm = createVM({ create });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Add document type"));
			fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Review" } });
			fireEvent.click(screen.getByLabelText("Color #ef4444"));
			fireEvent.click(screen.getByText("Create"));

			expect(create).toHaveBeenCalledWith({ name: "Review", color: "#ef4444" });
		});

		it("cancels create form", () => {
			const vm = createVM();
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Add document type"));
			expect(screen.getByText("New Document Type")).toBeTruthy();

			fireEvent.click(screen.getByLabelText("Cancel create"));
			expect(screen.queryByText("New Document Type")).toBeNull();
		});

		it("shows creating state", () => {
			const vm = createVM({ isCreating: true });
			render(<DocTypeManager vm={vm} />);
			fireEvent.click(screen.getByLabelText("Add document type"));
			expect(screen.getByText("Creating...")).toBeTruthy();
		});
	});

	describe("inline edit", () => {
		it("enters edit mode on click and saves on Enter", () => {
			const update = vi.fn();
			const vm = createVM({ types: [TYPE_A], update });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Edit ${TYPE_A.name}`));
			const input = screen.getByLabelText(`Edit name for ${TYPE_A.name}`);
			fireEvent.change(input, { target: { value: "Standup Notes" } });
			fireEvent.keyDown(input, { key: "Enter" });

			expect(update).toHaveBeenCalledWith("dt-1", { name: "Standup Notes" });
		});

		it("cancels edit on Escape", () => {
			const update = vi.fn();
			const vm = createVM({ types: [TYPE_A], update });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Edit ${TYPE_A.name}`));
			const input = screen.getByLabelText(`Edit name for ${TYPE_A.name}`);
			fireEvent.change(input, { target: { value: "Changed" } });
			fireEvent.keyDown(input, { key: "Escape" });

			expect(update).not.toHaveBeenCalled();
			expect(screen.getByLabelText(`Edit ${TYPE_A.name}`)).toBeTruthy();
		});

		it("does not update if name unchanged", () => {
			const update = vi.fn();
			const vm = createVM({ types: [TYPE_A], update });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Edit ${TYPE_A.name}`));
			const input = screen.getByLabelText(`Edit name for ${TYPE_A.name}`);
			fireEvent.keyDown(input, { key: "Enter" });

			expect(update).not.toHaveBeenCalled();
		});
	});

	describe("delete", () => {
		it("calls remove on delete click", () => {
			const remove = vi.fn();
			const vm = createVM({ types: [TYPE_A], remove });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Delete ${TYPE_A.name}`));
			expect(remove).toHaveBeenCalledWith("dt-1");
		});
	});

	describe("reorder", () => {
		it("calls reorder on move up", () => {
			const reorder = vi.fn();
			const vm = createVM({ types: [TYPE_A, TYPE_B], reorder });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Move ${TYPE_B.name} up`));
			expect(reorder).toHaveBeenCalledWith("dt-2", TYPE_A.sortOrder);
			expect(reorder).toHaveBeenCalledWith("dt-1", TYPE_B.sortOrder);
		});

		it("calls reorder on move down", () => {
			const reorder = vi.fn();
			const vm = createVM({ types: [TYPE_A, TYPE_B], reorder });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Move ${TYPE_A.name} down`));
			expect(reorder).toHaveBeenCalledWith("dt-1", TYPE_B.sortOrder);
			expect(reorder).toHaveBeenCalledWith("dt-2", TYPE_A.sortOrder);
		});

		it("disables move up on first item", () => {
			const vm = createVM({ types: [TYPE_A, TYPE_B] });
			render(<DocTypeManager vm={vm} />);
			const btn = screen.getByLabelText(`Move ${TYPE_A.name} up`) as HTMLButtonElement;
			expect(btn.disabled).toBe(true);
		});

		it("disables move down on last item", () => {
			const vm = createVM({ types: [TYPE_A, TYPE_B] });
			render(<DocTypeManager vm={vm} />);
			const btn = screen.getByLabelText(`Move ${TYPE_B.name} down`) as HTMLButtonElement;
			expect(btn.disabled).toBe(true);
		});
	});

	describe("color edit", () => {
		it("opens color picker on swatch click and updates color", () => {
			const update = vi.fn();
			const vm = createVM({ types: [TYPE_A], update });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Change color for ${TYPE_A.name}`));
			expect(screen.getByLabelText("Select color #ef4444")).toBeTruthy();

			fireEvent.click(screen.getByLabelText("Select color #ef4444"));
			expect(update).toHaveBeenCalledWith("dt-1", { color: "#ef4444" });
		});

		it("closes color picker after selection", () => {
			const update = vi.fn();
			const vm = createVM({ types: [TYPE_A], update });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Change color for ${TYPE_A.name}`));
			expect(screen.getByLabelText("Select color #10b981")).toBeTruthy();

			fireEvent.click(screen.getByLabelText("Select color #10b981"));
			expect(screen.queryByLabelText("Select color #10b981")).toBeNull();
		});

		it("toggles color picker off on second click", () => {
			const vm = createVM({ types: [TYPE_A] });
			render(<DocTypeManager vm={vm} />);

			fireEvent.click(screen.getByLabelText(`Change color for ${TYPE_A.name}`));
			expect(screen.getByLabelText("Select color #ef4444")).toBeTruthy();

			fireEvent.click(screen.getByLabelText(`Change color for ${TYPE_A.name}`));
			expect(screen.queryByLabelText("Select color #ef4444")).toBeNull();
		});
	});
});
