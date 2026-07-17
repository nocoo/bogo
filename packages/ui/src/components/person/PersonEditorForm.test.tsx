import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonEditorForm } from "./PersonEditorForm.js";

vi.mock("../TagPicker.js", () => ({
	TagPicker: () => <div data-testid="tag-picker" />,
}));

vi.mock("../field/PersonFieldValues.js", () => ({
	PersonFieldValues: () => <div data-testid="person-field-values" />,
}));

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

const FIELD_DEF = {
	id: "fd-1",
	workspaceId: "ws-1",
	name: "Level",
	fieldType: "text" as const,
	options: null,
	defaultValue: null,
	required: false,
	showOnChart: false,
	sortOrder: 0,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const fieldValuesVm = {
	values: [],
	isLoading: false,
	error: null,
	setValue: vi.fn(),
	getValueFor: vi.fn(() => ""),
	validate: vi.fn(() => null),
	isSaving: false,
};

describe("PersonEditorForm", () => {
	it("renders page variant with Profile section heading", () => {
		render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
				variant="page"
			/>,
		);
		expect(screen.getByText("Profile")).toBeTruthy();
		expect(screen.getByText("Tags")).toBeTruthy();
		expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Alice");
	});

	it("shows custom fields and reporting sections on page when defs provided", () => {
		render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
				fieldDefs={[FIELD_DEF]}
				fieldValuesVm={fieldValuesVm}
				variant="page"
			/>,
		);
		expect(screen.getByText("Custom fields")).toBeTruthy();
		expect(screen.getByText("Reporting")).toBeTruthy();
		expect(screen.getByTestId("person-field-values")).toBeTruthy();
	});

	it("does not show custom fields heading when defs empty", () => {
		render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
				fieldDefs={[]}
				fieldValuesVm={fieldValuesVm}
				variant="page"
			/>,
		);
		expect(screen.queryByText("Custom fields")).toBeNull();
		expect(screen.queryByTestId("person-field-values")).toBeNull();
	});

	it("saves name change on page variant", () => {
		const onUpdate = vi.fn();
		render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={onUpdate}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
				variant="page"
			/>,
		);
		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice B" } });
		fireEvent.click(screen.getByText("Save"));
		expect(onUpdate).toHaveBeenCalledWith("p-alice", { name: "Alice B" });
	});

	it("calls onRemove when delete clicked on page variant", () => {
		const onRemove = vi.fn();
		render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={onRemove}
				isRemoving={false}
				variant="page"
			/>,
		);
		fireEvent.click(screen.getByLabelText("Delete Alice"));
		expect(onRemove).toHaveBeenCalledWith("p-alice");
	});

	it("syncs form state when person prop changes", () => {
		const { rerender } = render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
				variant="page"
			/>,
		);
		expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Alice");

		rerender(
			<PersonEditorForm
				person={BOB}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
				variant="page"
			/>,
		);
		expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Bob");
		expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Designer");
	});

	it("defaults to panel layout without Profile heading", () => {
		render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
			/>,
		);
		expect(screen.queryByText("Profile")).toBeNull();
		expect(screen.getByLabelText("Name")).toBeTruthy();
	});

	it("shows custom fields without section heading on panel variant", () => {
		render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
				fieldDefs={[FIELD_DEF]}
				fieldValuesVm={fieldValuesVm}
				variant="panel"
			/>,
		);
		expect(screen.queryByText("Custom fields")).toBeNull();
		expect(screen.getByTestId("person-field-values")).toBeTruthy();
	});

	it("does not save whitespace-only name", () => {
		const onUpdate = vi.fn();
		render(
			<PersonEditorForm
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={onUpdate}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				isRemoving={false}
				variant="page"
			/>,
		);
		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
		fireEvent.click(screen.getByText("Save"));
		expect(onUpdate).not.toHaveBeenCalled();
	});
});
