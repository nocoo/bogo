import type { DocumentType } from "@bogo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocTypePicker } from "./DocTypePicker.js";

const TYPES: DocumentType[] = [
	{
		id: "dt-1",
		workspaceId: "ws-1",
		name: "Connect",
		color: "#8b5cf6",
		sortOrder: 0,
		createdAt: "2026-01-01",
	},
	{
		id: "dt-2",
		workspaceId: "ws-1",
		name: "Meeting",
		color: "#10b981",
		sortOrder: 1,
		createdAt: "2026-01-01",
	},
];

describe("DocTypePicker", () => {
	it("renders the selected type name", () => {
		render(<DocTypePicker types={TYPES} value="dt-1" onChange={vi.fn()} />);
		expect(screen.getByText("Connect")).toBeTruthy();
	});

	it("renders 'No type' label when value is null", () => {
		render(<DocTypePicker types={TYPES} value={null} onChange={vi.fn()} />);
		expect(screen.getByText("No type")).toBeTruthy();
	});

	it("opens the menu on click and lists all types plus Unset", () => {
		render(<DocTypePicker types={TYPES} value="dt-1" onChange={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Change document type"));

		const options = screen.getAllByRole("option");
		// Unset + 2 types
		expect(options.length).toBe(3);
		expect(screen.getAllByText("Connect").length).toBeGreaterThan(0);
		expect(screen.getByText("Meeting")).toBeTruthy();
		expect(screen.getAllByText("No type").length).toBeGreaterThan(0);
	});

	it("calls onChange with the selected typeId", () => {
		const onChange = vi.fn();
		render(<DocTypePicker types={TYPES} value="dt-1" onChange={onChange} />);
		fireEvent.click(screen.getByLabelText("Change document type"));
		fireEvent.click(screen.getByText("Meeting"));
		expect(onChange).toHaveBeenCalledWith("dt-2");
	});

	it("calls onChange with null when selecting 'No type'", () => {
		const onChange = vi.fn();
		render(<DocTypePicker types={TYPES} value="dt-1" onChange={onChange} />);
		fireEvent.click(screen.getByLabelText("Change document type"));
		// pick the menu row, not the trigger button
		const noTypeOption = screen
			.getAllByRole("option")
			.find((el) => el.textContent?.includes("No type"));
		fireEvent.click(noTypeOption ?? screen.getAllByText("No type")[1]);
		expect(onChange).toHaveBeenCalledWith(null);
	});

	it("marks the currently selected type with aria-selected", () => {
		render(<DocTypePicker types={TYPES} value="dt-2" onChange={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Change document type"));
		const meetingOption = screen
			.getAllByRole("option")
			.find((el) => el.textContent?.includes("Meeting"));
		expect(meetingOption?.getAttribute("aria-selected")).toBe("true");
	});

	it("shows an empty-state message when no types are defined", () => {
		render(<DocTypePicker types={[]} value={null} onChange={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Change document type"));
		expect(screen.getByText("No types defined")).toBeTruthy();
	});

	it("respects the disabled prop", () => {
		render(<DocTypePicker types={TYPES} value="dt-1" onChange={vi.fn()} disabled={true} />);
		const btn = screen.getByLabelText("Change document type") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
		fireEvent.click(btn);
		expect(screen.queryAllByRole("option").length).toBe(0);
	});

	it("closes the menu after picking", () => {
		render(<DocTypePicker types={TYPES} value="dt-1" onChange={vi.fn()} />);
		fireEvent.click(screen.getByLabelText("Change document type"));
		expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
		fireEvent.click(screen.getByText("Meeting"));
		expect(screen.queryAllByRole("option").length).toBe(0);
	});

	it("closes the menu on outside click", () => {
		render(
			<div>
				<button type="button">outside</button>
				<DocTypePicker types={TYPES} value="dt-1" onChange={vi.fn()} />
			</div>,
		);
		fireEvent.click(screen.getByLabelText("Change document type"));
		expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
		fireEvent.mouseDown(screen.getByText("outside"));
		expect(screen.queryAllByRole("option").length).toBe(0);
	});
});
