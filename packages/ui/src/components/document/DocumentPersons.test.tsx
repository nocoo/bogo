import type { DocumentPerson, Person } from "@bogo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentPersons } from "./DocumentPersons.js";

const PERSONS: Person[] = [
	{
		id: "p-1",
		workspaceId: "ws-1",
		name: "Alice",
		title: "Engineer",
		managerId: null,
		dottedManagerId: null,
		isRoot: true,
		sortOrder: 0,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
	},
	{
		id: "p-2",
		workspaceId: "ws-1",
		name: "Bob",
		title: "Designer",
		managerId: "p-1",
		dottedManagerId: null,
		isRoot: false,
		sortOrder: 1,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
	},
	{
		id: "p-3",
		workspaceId: "ws-1",
		name: "Carol",
		title: "PM",
		managerId: "p-1",
		dottedManagerId: null,
		isRoot: false,
		sortOrder: 2,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
	},
];

const LINKED: DocumentPerson[] = [
	{ workspaceId: "ws-1", documentId: "doc-1", personId: "p-1", role: "subject" },
];

function renderComponent(overrides: Partial<Parameters<typeof DocumentPersons>[0]> = {}) {
	const defaults = {
		persons: LINKED,
		allPersons: PERSONS,
		isLoading: false,
		personsError: null,
		allPersonsLoading: false,
		allPersonsError: null,
		onAdd: vi.fn(),
		isAdding: false,
		onRemove: vi.fn(),
		isRemoving: false,
		error: null,
		onDismissError: vi.fn(),
	};
	return { ...render(<DocumentPersons {...defaults} {...overrides} />), ...defaults, ...overrides };
}

describe("DocumentPersons", () => {
	it("shows loading state", () => {
		renderComponent({ isLoading: true });
		expect(screen.getByLabelText("Loading persons")).toBeTruthy();
	});

	it("shows empty state when no persons linked", () => {
		renderComponent({ persons: [] });
		expect(screen.getByText("No people associated yet.")).toBeTruthy();
	});

	it("renders linked persons with name and role", () => {
		renderComponent();
		expect(screen.getByText("Alice")).toBeTruthy();
		expect(screen.getByText("subject")).toBeTruthy();
	});

	it("shows person id as fallback when person not in allPersons", () => {
		const unknownLink: DocumentPerson[] = [
			{ workspaceId: "ws-1", documentId: "doc-1", personId: "p-unknown", role: "reviewer" },
		];
		renderComponent({ persons: unknownLink });
		expect(screen.getByText("p-unknown")).toBeTruthy();
	});

	it("only shows unlinked persons in the dropdown", () => {
		renderComponent();
		const select = screen.getByLabelText("Select person to add") as HTMLSelectElement;
		const options = Array.from(select.options).map((o) => o.text);
		expect(options).toContain("Bob");
		expect(options).toContain("Carol");
		expect(options).not.toContain("Alice");
	});

	it("calls onAdd with selected personId on add button click", () => {
		const onAdd = vi.fn();
		renderComponent({ onAdd });
		const select = screen.getByLabelText("Select person to add");
		fireEvent.change(select, { target: { value: "p-2" } });
		fireEvent.click(screen.getByLabelText("Add person"));
		expect(onAdd).toHaveBeenCalledWith({ personId: "p-2" }, expect.any(Object));
	});

	it("disables add button when no person selected", () => {
		renderComponent();
		const btn = screen.getByLabelText("Add person") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it("disables add button while isAdding", () => {
		renderComponent({ isAdding: true });
		const select = screen.getByLabelText("Select person to add");
		fireEvent.change(select, { target: { value: "p-2" } });
		const btn = screen.getByLabelText("Add person") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it("calls onRemove with personId when remove button clicked", () => {
		const onRemove = vi.fn();
		renderComponent({ onRemove });
		fireEvent.click(screen.getByLabelText("Remove Alice"));
		expect(onRemove).toHaveBeenCalledWith("p-1");
	});

	it("disables remove buttons while isRemoving", () => {
		renderComponent({ isRemoving: true });
		const btn = screen.getByLabelText("Remove Alice") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it("shows error message with dismiss button", () => {
		const onDismissError = vi.fn();
		renderComponent({ error: new Error("Duplicate"), onDismissError });
		expect(screen.getByText("Duplicate")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Dismiss association error"));
		expect(onDismissError).toHaveBeenCalled();
	});

	it("hides dropdown when all persons are already linked", () => {
		const allLinked: DocumentPerson[] = PERSONS.map((p) => ({
			workspaceId: "ws-1",
			documentId: "doc-1",
			personId: p.id,
			role: "subject",
		}));
		renderComponent({ persons: allLinked });
		expect(screen.queryByLabelText("Select person to add")).toBeNull();
	});

	it("resets selection after successful add", () => {
		const onAdd = vi.fn().mockImplementation((_input, opts) => {
			opts?.onSuccess?.();
		});
		renderComponent({ onAdd });
		const select = screen.getByLabelText("Select person to add") as HTMLSelectElement;
		fireEvent.change(select, { target: { value: "p-2" } });
		fireEvent.click(screen.getByLabelText("Add person"));
		expect(select.value).toBe("");
	});

	it("shows loading indicator and hides add selector when allPersonsLoading", () => {
		renderComponent({ allPersonsLoading: true });
		expect(screen.getByLabelText("Loading people")).toBeTruthy();
		expect(screen.queryByLabelText("Select person to add")).toBeNull();
	});

	it("shows allPersonsError message", () => {
		renderComponent({ allPersonsError: new Error("Network failure") });
		expect(screen.getByText("Failed to load people: Network failure")).toBeTruthy();
	});

	it("shows personsError message for association query failure", () => {
		renderComponent({ personsError: new Error("DB timeout"), persons: [] });
		expect(screen.getByText("Failed to load associations: DB timeout")).toBeTruthy();
		expect(screen.queryByText("No people associated yet.")).toBeNull();
		expect(screen.queryByLabelText("Select person to add")).toBeNull();
	});
});
