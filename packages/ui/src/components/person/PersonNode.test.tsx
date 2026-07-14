import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonNode } from "./PersonNode.js";

vi.mock("@xyflow/react", () => ({
	Handle: () => null,
	Position: { Top: "top", Bottom: "bottom" },
}));

const BASE_PROPS = {
	id: "p-1",
	type: "person" as const,
	data: {
		person: {
			id: "p-1",
			workspaceId: "ws-1",
			name: "Alice",
			title: "Engineer",
			managerId: null,
			dottedManagerId: null,
			avatarUrl: null,
			isRoot: false,
			sortOrder: 0,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
			tags: [],
		},
		fields: [] as { fieldDefId: string; name: string; value: string }[],
	},
	selected: false,
	isConnectable: false,
	positionAbsoluteX: 0,
	positionAbsoluteY: 0,
	zIndex: 0,
};

describe("PersonNode", () => {
	it("renders person name and title", () => {
		// biome-ignore lint/suspicious/noExplicitAny: test mock props
		render(<PersonNode {...(BASE_PROPS as any)} />);
		expect(screen.getByText("Alice")).toBeTruthy();
		expect(screen.getByText("Engineer")).toBeTruthy();
	});

	it("does not render title when empty", () => {
		const props = {
			...BASE_PROPS,
			data: { ...BASE_PROPS.data, person: { ...BASE_PROPS.data.person, title: "" } },
		};
		// biome-ignore lint/suspicious/noExplicitAny: test mock props
		render(<PersonNode {...(props as any)} />);
		expect(screen.getByText("Alice")).toBeTruthy();
		expect(screen.queryByText("Engineer")).toBeNull();
	});

	it("applies selected style when selected", () => {
		const props = { ...BASE_PROPS, selected: true };
		// biome-ignore lint/suspicious/noExplicitAny: test mock props
		const { container } = render(<PersonNode {...(props as any)} />);
		const node = container.firstChild as HTMLElement;
		expect(node.className).toContain("border-primary");
	});

	it("applies default style when not selected", () => {
		// biome-ignore lint/suspicious/noExplicitAny: test mock props
		const { container } = render(<PersonNode {...(BASE_PROPS as any)} />);
		const node = container.firstChild as HTMLElement;
		expect(node.className).toContain("border-border");
	});

	it("renders chart fields in the order given", () => {
		const props = {
			...BASE_PROPS,
			data: {
				...BASE_PROPS.data,
				fields: [
					{ fieldDefId: "fd-1", name: "Department", value: "Engineering" },
					{ fieldDefId: "fd-2", name: "Level", value: "Senior" },
				],
			},
		};
		// biome-ignore lint/suspicious/noExplicitAny: test mock props
		const { container } = render(<PersonNode {...(props as any)} />);
		const items = container.querySelectorAll("li");
		expect(items).toHaveLength(2);
		// Order preserved — caller (PersonTree) sorts by field def sortOrder
		// before passing rows in; the node itself must NOT reorder.
		expect(items[0].textContent).toContain("Department");
		expect(items[0].textContent).toContain("Engineering");
		expect(items[1].textContent).toContain("Level");
		expect(items[1].textContent).toContain("Senior");
	});

	it("renders empty-value fields with an em-dash placeholder", () => {
		const props = {
			...BASE_PROPS,
			data: {
				...BASE_PROPS.data,
				fields: [{ fieldDefId: "fd-1", name: "Department", value: "" }],
			},
		};
		// biome-ignore lint/suspicious/noExplicitAny: test mock props
		const { container } = render(<PersonNode {...(props as any)} />);
		expect(container.textContent).toContain("Department");
		expect(container.textContent).toContain("—");
	});
});
