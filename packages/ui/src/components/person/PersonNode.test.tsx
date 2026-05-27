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
			isRoot: false,
			sortOrder: 0,
			createdAt: "2026-01-01",
			updatedAt: "2026-01-01",
			tags: [],
		},
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
			data: { person: { ...BASE_PROPS.data.person, title: "" } },
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
});
