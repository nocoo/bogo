import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PersonAvatarCluster } from "./PersonAvatarCluster.js";

const PEOPLE = [
	{ id: "p-1", name: "Alice" },
	{ id: "p-2", name: "Bob" },
	{ id: "p-3", name: "Carol" },
	{ id: "p-4", name: "Dan" },
	{ id: "p-5", name: "Erin" },
	{ id: "p-6", name: "Frank" },
];

describe("PersonAvatarCluster", () => {
	it("renders nothing when people list is empty", () => {
		const { container } = render(<PersonAvatarCluster people={[]} />);
		expect(container.firstChild).toBeNull();
	});

	it("renders all people when count <= max", () => {
		render(<PersonAvatarCluster people={PEOPLE.slice(0, 3)} max={4} />);
		expect(screen.getByLabelText("Avatar for Alice")).toBeTruthy();
		expect(screen.getByLabelText("Avatar for Bob")).toBeTruthy();
		expect(screen.getByLabelText("Avatar for Carol")).toBeTruthy();
		// no overflow chip
		expect(screen.queryByText(/^\+\d+$/)).toBeNull();
	});

	it("collapses overflow into a +N bubble", () => {
		render(<PersonAvatarCluster people={PEOPLE} max={4} />);
		// 4 avatars + +2 bubble
		expect(screen.getByLabelText("Avatar for Alice")).toBeTruthy();
		expect(screen.getByLabelText("Avatar for Dan")).toBeTruthy();
		expect(screen.queryByLabelText("Avatar for Erin")).toBeNull();
		expect(screen.getByText("+2")).toBeTruthy();
	});

	it("uses the requested max", () => {
		render(<PersonAvatarCluster people={PEOPLE} max={2} />);
		expect(screen.getByText("+4")).toBeTruthy();
	});

	it("exposes a count summary via title", () => {
		const { container } = render(<PersonAvatarCluster people={PEOPLE.slice(0, 3)} />);
		const root = container.firstChild as HTMLElement;
		expect(root.getAttribute("title")).toBe("3 people associated");
	});

	it("uses singular 'person' for one entry", () => {
		const { container } = render(<PersonAvatarCluster people={[PEOPLE[0]]} />);
		const root = container.firstChild as HTMLElement;
		expect(root.getAttribute("title")).toBe("1 person associated");
	});

	it("applies xs size class to overflow bubble", () => {
		render(<PersonAvatarCluster people={PEOPLE} max={2} size="xs" />);
		const bubble = screen.getByText("+4");
		expect(bubble.className).toContain("h-5");
	});

	it("applies md size class to overflow bubble", () => {
		render(<PersonAvatarCluster people={PEOPLE} max={2} size="md" />);
		const bubble = screen.getByText("+4");
		expect(bubble.className).toContain("h-7");
	});
});
