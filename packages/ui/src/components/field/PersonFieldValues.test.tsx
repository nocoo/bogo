import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FieldValuesVM } from "../../viewmodels/field/use-field-values.js";
import { PersonFieldValues } from "./PersonFieldValues.js";

function createVM(overrides: Partial<FieldValuesVM> = {}): FieldValuesVM {
	return {
		values: [],
		isLoading: false,
		error: null,
		setValue: vi.fn(),
		getValueFor: vi.fn().mockReturnValue(""),
		validate: vi.fn().mockReturnValue(null),
		isSaving: false,
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

const DEF_NUMBER = {
	id: "fd-2",
	workspaceId: "ws-1",
	name: "Salary",
	fieldType: "number" as const,
	options: null,
	sortOrder: 1,
	required: true,
	defaultValue: null,
	createdAt: "2026-01-02",
};

const DEF_DATE = {
	id: "fd-3",
	workspaceId: "ws-1",
	name: "Start Date",
	fieldType: "date" as const,
	options: null,
	sortOrder: 2,
	required: false,
	defaultValue: null,
	createdAt: "2026-01-03",
};

const DEF_SELECT = {
	id: "fd-4",
	workspaceId: "ws-1",
	name: "Level",
	fieldType: "select" as const,
	options: ["Junior", "Senior", "Staff"],
	sortOrder: 3,
	required: false,
	defaultValue: null,
	createdAt: "2026-01-04",
};

const DEF_BOOLEAN = {
	id: "fd-5",
	workspaceId: "ws-1",
	name: "Active",
	fieldType: "boolean" as const,
	options: null,
	sortOrder: 4,
	required: false,
	defaultValue: null,
	createdAt: "2026-01-05",
};

describe("PersonFieldValues", () => {
	it("shows loading spinner", () => {
		const vm = createVM({ isLoading: true });
		const { container } = render(<PersonFieldValues defs={[DEF_TEXT]} vm={vm} />);
		expect(container.querySelector(".animate-spin")).not.toBeNull();
	});

	it("returns null when defs is empty", () => {
		const vm = createVM();
		const { container } = render(<PersonFieldValues defs={[]} vm={vm} />);
		expect(container.innerHTML).toBe("");
	});

	it("renders heading and field labels", () => {
		const vm = createVM();
		render(<PersonFieldValues defs={[DEF_TEXT, DEF_NUMBER]} vm={vm} />);
		expect(screen.getByText("Custom Fields")).toBeTruthy();
		expect(screen.getByText("Department")).toBeTruthy();
		expect(screen.getByText("Salary")).toBeTruthy();
	});

	it("shows required indicator for required fields", () => {
		const vm = createVM();
		render(<PersonFieldValues defs={[DEF_NUMBER]} vm={vm} />);
		expect(screen.getByText("*")).toBeTruthy();
	});

	it("renders text input for text field", () => {
		const vm = createVM({ getValueFor: vi.fn().mockReturnValue("Engineering") });
		render(<PersonFieldValues defs={[DEF_TEXT]} vm={vm} />);
		const input = screen.getByLabelText("Department") as HTMLInputElement;
		expect(input.type).toBe("text");
		expect(input.value).toBe("Engineering");
	});

	it("renders number input for number field", () => {
		const vm = createVM({ getValueFor: vi.fn().mockReturnValue("50000") });
		render(<PersonFieldValues defs={[DEF_NUMBER]} vm={vm} />);
		const input = screen.getByLabelText(/Salary/) as HTMLInputElement;
		expect(input.type).toBe("number");
		expect(input.value).toBe("50000");
	});

	it("renders date input for date field", () => {
		const vm = createVM({ getValueFor: vi.fn().mockReturnValue("2026-03-15") });
		render(<PersonFieldValues defs={[DEF_DATE]} vm={vm} />);
		const input = screen.getByLabelText("Start Date") as HTMLInputElement;
		expect(input.type).toBe("date");
		expect(input.value).toBe("2026-03-15");
	});

	it("renders select for select field with options", () => {
		const vm = createVM({ getValueFor: vi.fn().mockReturnValue("Senior") });
		render(<PersonFieldValues defs={[DEF_SELECT]} vm={vm} />);
		const select = screen.getByLabelText("Level") as HTMLSelectElement;
		expect(select.value).toBe("Senior");
		expect(screen.getByText("Junior")).toBeTruthy();
		expect(screen.getByText("Staff")).toBeTruthy();
	});

	it("renders select for boolean field with Yes/No", () => {
		const vm = createVM({ getValueFor: vi.fn().mockReturnValue("true") });
		render(<PersonFieldValues defs={[DEF_BOOLEAN]} vm={vm} />);
		const select = screen.getByLabelText("Active") as HTMLSelectElement;
		expect(select.value).toBe("true");
		expect(screen.getByText("Yes")).toBeTruthy();
		expect(screen.getByText("No")).toBeTruthy();
	});

	it("calls setValue on blur when validation passes", () => {
		const setValue = vi.fn();
		const validate = vi.fn().mockReturnValue(null);
		const vm = createVM({ setValue, validate });
		render(<PersonFieldValues defs={[DEF_TEXT]} vm={vm} />);

		const input = screen.getByLabelText("Department");
		fireEvent.change(input, { target: { value: "Sales" } });
		fireEvent.blur(input);

		expect(validate).toHaveBeenCalledWith(DEF_TEXT, "Sales");
		expect(setValue).toHaveBeenCalledWith("fd-1", "Sales");
	});

	it("shows validation error on blur when validation fails", () => {
		const setValue = vi.fn();
		const validate = vi.fn().mockReturnValue("Invalid value");
		const vm = createVM({ setValue, validate });
		render(<PersonFieldValues defs={[DEF_TEXT]} vm={vm} />);

		const input = screen.getByLabelText("Department");
		fireEvent.change(input, { target: { value: "bad" } });
		fireEvent.blur(input);

		expect(screen.getByRole("alert")).toBeTruthy();
		expect(screen.getByText("Invalid value")).toBeTruthy();
		expect(setValue).not.toHaveBeenCalled();
	});

	it("clears validation error on change after error", () => {
		const validate = vi.fn().mockReturnValue("Invalid value");
		const vm = createVM({ validate });
		render(<PersonFieldValues defs={[DEF_TEXT]} vm={vm} />);

		const input = screen.getByLabelText("Department");
		fireEvent.change(input, { target: { value: "bad" } });
		fireEvent.blur(input);
		expect(screen.getByRole("alert")).toBeTruthy();

		fireEvent.change(input, { target: { value: "good" } });
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("does not call setValue when value unchanged", () => {
		const setValue = vi.fn();
		const getValueFor = vi.fn().mockReturnValue("Engineering");
		const vm = createVM({ setValue, getValueFor });
		render(<PersonFieldValues defs={[DEF_TEXT]} vm={vm} />);

		const input = screen.getByLabelText("Department");
		fireEvent.blur(input);

		expect(setValue).not.toHaveBeenCalled();
	});

	it("saves select field value on change and blur", () => {
		const setValue = vi.fn();
		const validate = vi.fn().mockReturnValue(null);
		const vm = createVM({ setValue, validate });
		render(<PersonFieldValues defs={[DEF_SELECT]} vm={vm} />);

		const select = screen.getByLabelText("Level") as HTMLSelectElement;
		fireEvent.change(select, { target: { value: "Senior" } });
		fireEvent.blur(select);

		expect(setValue).toHaveBeenCalledWith("fd-4", "Senior");
	});

	it("saves boolean field value on change and blur", () => {
		const setValue = vi.fn();
		const validate = vi.fn().mockReturnValue(null);
		const vm = createVM({ setValue, validate });
		render(<PersonFieldValues defs={[DEF_BOOLEAN]} vm={vm} />);

		const select = screen.getByLabelText("Active") as HTMLSelectElement;
		fireEvent.change(select, { target: { value: "true" } });
		fireEvent.blur(select);

		expect(setValue).toHaveBeenCalledWith("fd-5", "true");
	});

	it("saves date field value on change and blur", () => {
		const setValue = vi.fn();
		const validate = vi.fn().mockReturnValue(null);
		const vm = createVM({ setValue, validate });
		render(<PersonFieldValues defs={[DEF_DATE]} vm={vm} />);

		const input = screen.getByLabelText("Start Date") as HTMLInputElement;
		fireEvent.change(input, { target: { value: "2026-06-01" } });
		fireEvent.blur(input);

		expect(setValue).toHaveBeenCalledWith("fd-3", "2026-06-01");
	});

	it("saves number field value on change and blur", () => {
		const setValue = vi.fn();
		const validate = vi.fn().mockReturnValue(null);
		const vm = createVM({ setValue, validate });
		render(<PersonFieldValues defs={[DEF_NUMBER]} vm={vm} />);

		const input = screen.getByLabelText(/Salary/) as HTMLInputElement;
		fireEvent.change(input, { target: { value: "75000" } });
		fireEvent.blur(input);

		expect(setValue).toHaveBeenCalledWith("fd-2", "75000");
	});

	it("renders all field types together", () => {
		const vm = createVM();
		render(
			<PersonFieldValues
				defs={[DEF_TEXT, DEF_NUMBER, DEF_DATE, DEF_SELECT, DEF_BOOLEAN]}
				vm={vm}
			/>,
		);
		expect(screen.getByLabelText("Department")).toBeTruthy();
		expect(screen.getByLabelText(/Salary/)).toBeTruthy();
		expect(screen.getByLabelText("Start Date")).toBeTruthy();
		expect(screen.getByLabelText("Level")).toBeTruthy();
		expect(screen.getByLabelText("Active")).toBeTruthy();
	});
});
