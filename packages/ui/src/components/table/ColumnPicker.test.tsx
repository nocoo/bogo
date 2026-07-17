import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ColumnMeta } from "@/viewmodels/table/column-catalog";
import { ColumnPicker } from "./ColumnPicker";

const catalog: ColumnMeta[] = [
	{ key: "builtin:name", label: "Name", sortable: true, filterable: true, kind: "text" },
	{ key: "builtin:title", label: "Title", sortable: true, filterable: true, kind: "text" },
	{
		key: "builtin:managerId",
		label: "Manager",
		sortable: true,
		filterable: true,
		kind: "person-ref",
	},
	{ key: "builtin:tags", label: "Tags", sortable: false, filterable: true, kind: "tags" },
];

describe("ColumnPicker", () => {
	it("renders selected and available sections", () => {
		render(
			<ColumnPicker
				selected={["builtin:name", "builtin:title"]}
				catalog={catalog}
				onChange={vi.fn()}
			/>,
		);
		expect(screen.getByLabelText("Selected columns")).toBeTruthy();
		expect(screen.getByLabelText("Available columns")).toBeTruthy();
		expect(screen.getByText("Name")).toBeTruthy();
		expect(screen.getByText("Title")).toBeTruthy();
		expect(screen.getByText("Manager")).toBeTruthy();
		expect(screen.getByText("Tags")).toBeTruthy();
		expect(screen.getByText("Required")).toBeTruthy();
	});

	it("adds a candidate via button", () => {
		const onChange = vi.fn();
		render(
			<ColumnPicker
				selected={["builtin:name", "builtin:title"]}
				catalog={catalog}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Add Manager"));
		expect(onChange).toHaveBeenCalledWith(["builtin:name", "builtin:title", "builtin:managerId"]);
	});

	it("removes a selected non-locked column", () => {
		const onChange = vi.fn();
		render(
			<ColumnPicker
				selected={["builtin:name", "builtin:title"]}
				catalog={catalog}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Remove Title"));
		expect(onChange).toHaveBeenCalledWith(["builtin:name"]);
	});

	it("nudges column left and right", () => {
		const onChange = vi.fn();
		render(
			<ColumnPicker
				selected={["builtin:name", "builtin:title", "builtin:tags"]}
				catalog={catalog}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByLabelText("Move Title right"));
		expect(onChange).toHaveBeenCalledWith(["builtin:name", "builtin:tags", "builtin:title"]);

		onChange.mockClear();
		fireEvent.click(screen.getByLabelText("Move Tags left"));
		expect(onChange).toHaveBeenCalledWith(["builtin:name", "builtin:tags", "builtin:title"]);
	});
});
