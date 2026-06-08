import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreatePersonDialog, EmptyPersonState } from "./CreatePersonDialog.js";

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

describe("CreatePersonDialog", () => {
	it("defaults manager to root person", () => {
		render(
			<CreatePersonDialog
				persons={[ROOT, ALICE]}
				onSubmit={vi.fn()}
				onClose={vi.fn()}
				isCreating={false}
			/>,
		);
		const select = screen.getByLabelText("Reports to") as HTMLSelectElement;
		expect(select.value).toBe("p-root");
	});

	it("submits with name and selected manager", () => {
		const onSubmit = vi.fn();
		render(
			<CreatePersonDialog
				persons={[ROOT, ALICE]}
				onSubmit={onSubmit}
				onClose={vi.fn()}
				isCreating={false}
			/>,
		);
		const nameInput = screen.getByPlaceholderText("Person name");
		fireEvent.change(nameInput, { target: { value: "Bob" } });

		const select = screen.getByLabelText("Reports to") as HTMLSelectElement;
		fireEvent.change(select, { target: { value: "p-alice" } });

		fireEvent.click(screen.getByText("Create"));
		expect(onSubmit).toHaveBeenCalledWith("Bob", "p-alice");
	});

	it("submits on Enter key", () => {
		const onSubmit = vi.fn();
		render(
			<CreatePersonDialog
				persons={[ROOT]}
				onSubmit={onSubmit}
				onClose={vi.fn()}
				isCreating={false}
			/>,
		);
		const nameInput = screen.getByPlaceholderText("Person name");
		fireEvent.change(nameInput, { target: { value: "Bob" } });
		fireEvent.keyDown(nameInput, { key: "Enter" });
		expect(onSubmit).toHaveBeenCalledWith("Bob", "p-root");
	});

	it("calls onClose on Escape key", () => {
		const onClose = vi.fn();
		render(
			<CreatePersonDialog
				persons={[ROOT]}
				onSubmit={vi.fn()}
				onClose={onClose}
				isCreating={false}
			/>,
		);
		const nameInput = screen.getByPlaceholderText("Person name");
		fireEvent.keyDown(nameInput, { key: "Escape" });
		expect(onClose).toHaveBeenCalled();
	});

	it("calls onClose on close button", () => {
		const onClose = vi.fn();
		render(
			<CreatePersonDialog
				persons={[ROOT]}
				onSubmit={vi.fn()}
				onClose={onClose}
				isCreating={false}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Close create dialog"));
		expect(onClose).toHaveBeenCalled();
	});

	it("disables Create button when name is empty", () => {
		render(
			<CreatePersonDialog
				persons={[ROOT]}
				onSubmit={vi.fn()}
				onClose={vi.fn()}
				isCreating={false}
			/>,
		);
		const button = screen.getByText("Create");
		expect((button as HTMLButtonElement).disabled).toBe(true);
	});

	it("disables Create button when isCreating", () => {
		render(
			<CreatePersonDialog
				persons={[ROOT]}
				onSubmit={vi.fn()}
				onClose={vi.fn()}
				isCreating={true}
			/>,
		);
		const button = screen.getByText("Creating...");
		expect((button as HTMLButtonElement).disabled).toBe(true);
	});

	it("does not submit with empty name (whitespace only)", () => {
		const onSubmit = vi.fn();
		render(
			<CreatePersonDialog
				persons={[ROOT]}
				onSubmit={onSubmit}
				onClose={vi.fn()}
				isCreating={false}
			/>,
		);
		const nameInput = screen.getByPlaceholderText("Person name");
		fireEvent.change(nameInput, { target: { value: "   " } });
		fireEvent.click(screen.getByText("Create"));
		expect(onSubmit).not.toHaveBeenCalled();
	});
});

describe("EmptyPersonState", () => {
	it("renders informational text without create button", () => {
		render(<EmptyPersonState />);
		expect(screen.getByText("No people in this workspace yet")).toBeTruthy();
		expect(screen.getByText("The workspace root person is created automatically")).toBeTruthy();
	});
});
