import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonChip } from "./PersonChip.js";

describe("PersonChip", () => {
	it("renders the person's name", () => {
		render(<PersonChip name="Shizhe Huang" />);
		expect(screen.getByText("Shizhe Huang")).toBeTruthy();
	});

	it("renders subtitle when provided", () => {
		render(<PersonChip name="Shizhe Huang" subtitle="Manager" />);
		expect(screen.getByText("Manager")).toBeTruthy();
	});

	it("omits subtitle when not provided", () => {
		render(<PersonChip name="Shizhe Huang" />);
		expect(screen.queryByText("Manager")).toBeNull();
	});

	it("shows remove button when onRemove is provided", () => {
		render(<PersonChip name="Shizhe Huang" onRemove={vi.fn()} />);
		expect(screen.getByLabelText("Remove Shizhe Huang")).toBeTruthy();
	});

	it("calls onRemove when remove button clicked", () => {
		const onRemove = vi.fn();
		render(<PersonChip name="Shizhe Huang" onRemove={onRemove} />);
		fireEvent.click(screen.getByLabelText("Remove Shizhe Huang"));
		expect(onRemove).toHaveBeenCalled();
	});

	it("disables remove button while removing", () => {
		render(<PersonChip name="Shizhe Huang" onRemove={vi.fn()} isRemoving={true} />);
		const btn = screen.getByLabelText("Remove Shizhe Huang") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it("hides remove button when onRemove is not provided", () => {
		render(<PersonChip name="Shizhe Huang" />);
		expect(screen.queryByLabelText("Remove Shizhe Huang")).toBeNull();
	});

	it("renders the avatar via PersonAvatar", () => {
		render(<PersonChip name="Alice" />);
		expect(screen.getByLabelText("Avatar for Alice")).toBeTruthy();
	});
});
