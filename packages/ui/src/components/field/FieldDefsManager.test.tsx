import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FieldDefsVM } from "../../viewmodels/field/use-field-defs.js";
import { FieldDefsManager } from "./FieldDefsManager.js";

function createVM(overrides: Partial<FieldDefsVM> = {}): FieldDefsVM {
	return {
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
		mutationError: null,
		clearMutationError: vi.fn(),
		...overrides,
	};
}

const DEF_TEXT = {
	id: "fd-1",
	workspaceId: "ws-1",
	name: "Department",
	fieldType: "text" as const,
	options: null,
	sortOrder: 0,
	required: false,
	defaultValue: null,
	createdAt: "2026-01-01",
};

const DEF_SELECT = {
	id: "fd-2",
	workspaceId: "ws-1",
	name: "Level",
	fieldType: "select" as const,
	options: ["Junior", "Senior", "Staff"],
	sortOrder: 1,
	required: true,
	defaultValue: "Junior",
	createdAt: "2026-01-02",
};

const DEF_NUMBER = {
	id: "fd-3",
	workspaceId: "ws-1",
	name: "Salary",
	fieldType: "number" as const,
	options: null,
	sortOrder: 2,
	required: false,
	defaultValue: null,
	createdAt: "2026-01-03",
};

describe("FieldDefsManager", () => {
	it("shows loading spinner", () => {
		const vm = createVM({ isLoading: true });
		const { container } = render(<FieldDefsManager vm={vm} />);
		expect(container.querySelector(".animate-spin")).not.toBeNull();
	});

	it("shows error state", () => {
		const vm = createVM({ error: new Error("DB down") });
		render(<FieldDefsManager vm={vm} />);
		expect(screen.getByText(/Failed to load field definitions/)).toBeTruthy();
		expect(screen.getByText(/DB down/)).toBeTruthy();
	});

	it("shows empty state when no defs", () => {
		const vm = createVM();
		render(<FieldDefsManager vm={vm} />);
		expect(screen.getByText("No custom fields defined yet")).toBeTruthy();
	});

	it("renders field definitions with name and type", () => {
		const vm = createVM({ defs: [DEF_TEXT, DEF_SELECT] });
		render(<FieldDefsManager vm={vm} />);
		expect(screen.getByText("Department")).toBeTruthy();
		expect(screen.getByText("Text")).toBeTruthy();
		expect(screen.getByText("Level")).toBeTruthy();
		expect(screen.getByText("Select")).toBeTruthy();
		expect(screen.getByText("Required")).toBeTruthy();
		expect(screen.getByText("3 options")).toBeTruthy();
	});

	it("shows and hides create form", () => {
		const vm = createVM();
		render(<FieldDefsManager vm={vm} />);

		fireEvent.click(screen.getByLabelText("Add field definition"));
		expect(screen.getByText("New Field")).toBeTruthy();

		fireEvent.click(screen.getByLabelText("Cancel create"));
		expect(screen.queryByText("New Field")).toBeNull();
	});

	it("creates a text field", () => {
		const create = vi.fn();
		const vm = createVM({ create });
		render(<FieldDefsManager vm={vm} />);

		fireEvent.click(screen.getByLabelText("Add field definition"));
		fireEvent.change(screen.getByPlaceholderText("Field name"), {
			target: { value: "Location" },
		});
		fireEvent.click(screen.getByText("Create"));

		expect(create).toHaveBeenCalledWith({
			name: "Location",
			fieldType: "text",
			required: false,
		});
	});

	it("creates a select field with options", () => {
		const create = vi.fn();
		const vm = createVM({ create });
		render(<FieldDefsManager vm={vm} />);

		fireEvent.click(screen.getByLabelText("Add field definition"));
		fireEvent.change(screen.getByPlaceholderText("Field name"), {
			target: { value: "Status" },
		});
		fireEvent.change(screen.getByLabelText("Type"), { target: { value: "select" } });
		fireEvent.change(screen.getByPlaceholderText("Option 1, Option 2, ..."), {
			target: { value: "Active, Inactive" },
		});
		fireEvent.click(screen.getByText("Create"));

		expect(create).toHaveBeenCalledWith({
			name: "Status",
			fieldType: "select",
			options: ["Active", "Inactive"],
			required: false,
		});
	});

	it("creates a required field", () => {
		const create = vi.fn();
		const vm = createVM({ create });
		render(<FieldDefsManager vm={vm} />);

		fireEvent.click(screen.getByLabelText("Add field definition"));
		fireEvent.change(screen.getByPlaceholderText("Field name"), {
			target: { value: "Dept" },
		});
		fireEvent.click(screen.getByText("Required"));
		fireEvent.click(screen.getByText("Create"));

		expect(create).toHaveBeenCalledWith({
			name: "Dept",
			fieldType: "text",
			required: true,
		});
	});

	it("disables create button when name is empty", () => {
		const vm = createVM();
		render(<FieldDefsManager vm={vm} />);

		fireEvent.click(screen.getByLabelText("Add field definition"));
		const createBtn = screen.getByText("Create") as HTMLButtonElement;
		expect(createBtn.disabled).toBe(true);
	});

	it("calls remove on delete click", () => {
		const remove = vi.fn();
		const vm = createVM({ defs: [DEF_TEXT], remove });
		render(<FieldDefsManager vm={vm} />);

		fireEvent.click(screen.getByLabelText("Delete Department"));
		expect(remove).toHaveBeenCalledWith("fd-1");
	});

	it("shows mutation error and dismisses it", () => {
		const clearMutationError = vi.fn();
		const vm = createVM({
			defs: [DEF_TEXT],
			mutationError: new Error("Field has values"),
			clearMutationError,
		});
		render(<FieldDefsManager vm={vm} />);

		expect(screen.getByText("Field has values")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Dismiss error"));
		expect(clearMutationError).toHaveBeenCalled();
	});

	describe("reorder", () => {
		it("calls reorder when moving up", () => {
			const reorder = vi.fn();
			const vm = createVM({ defs: [DEF_TEXT, DEF_SELECT, DEF_NUMBER], reorder });
			render(<FieldDefsManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Move Level up"));
			expect(reorder).toHaveBeenCalledWith("fd-2", 0);
			expect(reorder).toHaveBeenCalledWith("fd-1", 1);
		});

		it("calls reorder when moving down", () => {
			const reorder = vi.fn();
			const vm = createVM({ defs: [DEF_TEXT, DEF_SELECT, DEF_NUMBER], reorder });
			render(<FieldDefsManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Move Level down"));
			expect(reorder).toHaveBeenCalledWith("fd-2", 2);
			expect(reorder).toHaveBeenCalledWith("fd-3", 1);
		});

		it("disables move up for first item", () => {
			const vm = createVM({ defs: [DEF_TEXT, DEF_SELECT] });
			render(<FieldDefsManager vm={vm} />);

			const btn = screen.getByLabelText("Move Department up") as HTMLButtonElement;
			expect(btn.disabled).toBe(true);
		});

		it("disables move down for last item", () => {
			const vm = createVM({ defs: [DEF_TEXT, DEF_SELECT] });
			render(<FieldDefsManager vm={vm} />);

			const btn = screen.getByLabelText("Move Level down") as HTMLButtonElement;
			expect(btn.disabled).toBe(true);
		});
	});

	describe("inline edit", () => {
		it("enters edit mode on name click and saves on blur", () => {
			const update = vi.fn();
			const vm = createVM({ defs: [DEF_TEXT], update });
			render(<FieldDefsManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Edit Department"));
			const input = screen.getByLabelText("Edit name for Department") as HTMLInputElement;
			expect(input.value).toBe("Department");

			fireEvent.change(input, { target: { value: "Dept" } });
			fireEvent.blur(input);

			expect(update).toHaveBeenCalledWith("fd-1", { name: "Dept" });
		});

		it("saves on Enter key", () => {
			const update = vi.fn();
			const vm = createVM({ defs: [DEF_TEXT], update });
			render(<FieldDefsManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Edit Department"));
			const input = screen.getByLabelText("Edit name for Department");
			fireEvent.change(input, { target: { value: "Dept2" } });
			fireEvent.keyDown(input, { key: "Enter" });

			expect(update).toHaveBeenCalledWith("fd-1", { name: "Dept2" });
		});

		it("cancels edit on Escape", () => {
			const update = vi.fn();
			const vm = createVM({ defs: [DEF_TEXT], update });
			render(<FieldDefsManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Edit Department"));
			const input = screen.getByLabelText("Edit name for Department");
			fireEvent.change(input, { target: { value: "Changed" } });
			fireEvent.keyDown(input, { key: "Escape" });

			expect(update).not.toHaveBeenCalled();
			expect(screen.getByText("Department")).toBeTruthy();
		});

		it("does not call update when name unchanged", () => {
			const update = vi.fn();
			const vm = createVM({ defs: [DEF_TEXT], update });
			render(<FieldDefsManager vm={vm} />);

			fireEvent.click(screen.getByLabelText("Edit Department"));
			const input = screen.getByLabelText("Edit name for Department");
			fireEvent.blur(input);

			expect(update).not.toHaveBeenCalled();
		});
	});
});
