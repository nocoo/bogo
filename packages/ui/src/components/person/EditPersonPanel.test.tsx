import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditPersonPanel } from "./EditPersonPanel.js";

vi.mock("../TagPicker.js", () => ({
	TagPicker: () => <div data-testid="tag-picker" />,
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

const CHARLIE = {
	id: "p-charlie",
	workspaceId: "ws-1",
	name: "Charlie",
	title: "Intern",
	managerId: "p-alice",
	dottedManagerId: null,
	avatarUrl: null,
	isRoot: false,
	sortOrder: 3,
	createdAt: "2026-01-04",
	updatedAt: "2026-01-04",
	tags: [],
};

describe("EditPersonPanel", () => {
	it("shows name and title inputs pre-filled", () => {
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Alice");
		expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Engineer");
	});

	it("calls onUpdate with changed name", () => {
		const onUpdate = vi.fn();
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={onUpdate}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice2" } });
		fireEvent.click(screen.getByText("Save"));
		expect(onUpdate).toHaveBeenCalledWith("p-alice", { name: "Alice2" });
	});

	it("calls onUpdate with changed title", () => {
		const onUpdate = vi.fn();
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={onUpdate}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Senior Engineer" } });
		fireEvent.click(screen.getByText("Save"));
		expect(onUpdate).toHaveBeenCalledWith("p-alice", { title: "Senior Engineer" });
	});

	it("calls onUpdate with changed dotted manager", () => {
		const onUpdate = vi.fn();
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={onUpdate}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Dotted-line manager"), {
			target: { value: "p-bob" },
		});
		fireEvent.click(screen.getByText("Save"));
		expect(onUpdate).toHaveBeenCalledWith("p-alice", { dottedManagerId: "p-bob" });
	});

	it("does not call onUpdate when nothing changed", () => {
		const onUpdate = vi.fn();
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={onUpdate}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		fireEvent.click(screen.getByText("Save"));
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it("shows delete button for non-root person", () => {
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		expect(screen.getByLabelText("Delete Alice")).toBeTruthy();
	});

	it("hides delete button for root person", () => {
		render(
			<EditPersonPanel
				person={ROOT}
				persons={[ROOT, ALICE]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		expect(screen.queryByLabelText("Delete Org")).toBeNull();
	});

	it("calls onRemove when delete clicked", () => {
		const onRemove = vi.fn();
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={onRemove}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Delete Alice"));
		expect(onRemove).toHaveBeenCalledWith("p-alice");
	});

	it("calls onClose when close button clicked", () => {
		const onClose = vi.fn();
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={onClose}
				isRemoving={false}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Close edit panel"));
		expect(onClose).toHaveBeenCalled();
	});

	it("excludes self and direct manager from dotted manager options", () => {
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		const select = screen.getByLabelText("Dotted-line manager") as HTMLSelectElement;
		const options = Array.from(select.options).map((o) => o.value);
		expect(options).toContain("");
		expect(options).toContain("p-bob");
		expect(options).not.toContain("p-alice");
		expect(options).not.toContain("p-root");
	});

	it("disables delete button when isRemoving", () => {
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={true}
			/>,
		);
		const btn = screen.getByLabelText("Delete Alice") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it("clears dotted manager to null", () => {
		const aliceWithDotted = { ...ALICE, dottedManagerId: "p-bob" };
		const onUpdate = vi.fn();
		render(
			<EditPersonPanel
				person={aliceWithDotted}
				persons={[ROOT, aliceWithDotted, BOB]}
				onUpdate={onUpdate}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Dotted-line manager"), {
			target: { value: "" },
		});
		fireEvent.click(screen.getByText("Save"));
		expect(onUpdate).toHaveBeenCalledWith("p-alice", { dottedManagerId: null });
	});

	it("shows manager dropdown for non-root person", () => {
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		expect(screen.getByLabelText("Manager")).toBeTruthy();
	});

	it("hides manager dropdown for root person", () => {
		render(
			<EditPersonPanel
				person={ROOT}
				persons={[ROOT, ALICE]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		expect(screen.queryByLabelText("Manager")).toBeNull();
	});

	it("calls onMove when manager is changed", () => {
		const onMove = vi.fn();
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={onMove}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Manager"), { target: { value: "p-bob" } });
		expect(onMove).toHaveBeenCalledWith("p-alice", "p-bob");
	});

	it("excludes self and descendants from manager options", () => {
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB, CHARLIE]}
				onUpdate={vi.fn()}
				onMove={vi.fn()}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		const select = screen.getByLabelText("Manager") as HTMLSelectElement;
		const options = Array.from(select.options).map((o) => o.value);
		expect(options).toContain("p-root");
		expect(options).toContain("p-bob");
		expect(options).not.toContain("p-alice");
		expect(options).not.toContain("p-charlie");
	});

	it("does not call onMove when selecting current manager", () => {
		const onMove = vi.fn();
		render(
			<EditPersonPanel
				person={ALICE}
				persons={[ROOT, ALICE, BOB]}
				onUpdate={vi.fn()}
				onMove={onMove}
				onRemove={vi.fn()}
				onClose={vi.fn()}
				isRemoving={false}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Manager"), { target: { value: "p-root" } });
		expect(onMove).not.toHaveBeenCalled();
	});
});
