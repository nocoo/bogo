import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterValueInput } from "./FilterValueInput";

describe("FilterValueInput", () => {
	it("renders boolean select", () => {
		const onChange = vi.fn();
		render(
			<FilterValueInput
				filter={{ key: "builtin:isRoot", op: "eq", value: "true" }}
				meta={{
					key: "builtin:isRoot",
					label: "Root",
					sortable: true,
					filterable: true,
					kind: "boolean",
				}}
				def={undefined}
				personTags={[]}
				onChange={onChange}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Filter value"), { target: { value: "false" } });
		expect(onChange).toHaveBeenCalledWith("false");
	});

	it("renders nothing for is_empty", () => {
		const { container } = render(
			<FilterValueInput
				filter={{ key: "builtin:name", op: "is_empty", value: null }}
				meta={{
					key: "builtin:name",
					label: "Name",
					sortable: true,
					filterable: true,
					kind: "text",
				}}
				def={undefined}
				personTags={[]}
				onChange={vi.fn()}
			/>,
		);
		expect(container.textContent).toBe("");
	});

	it("toggles select multi options", () => {
		const onChange = vi.fn();
		const def = {
			id: "fd",
			workspaceId: "ws",
			name: "L",
			fieldType: "select" as const,
			options: ["A", "B"],
			sortOrder: 0,
			required: false,
			defaultValue: null,
			showOnChart: false,
			createdAt: "2026-01-01",
		};
		render(
			<FilterValueInput
				filter={{ key: "field:fd", op: "in", value: ["A"] }}
				meta={{
					key: "field:fd",
					label: "L",
					sortable: true,
					filterable: true,
					kind: "select",
				}}
				def={def}
				personTags={[]}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByText("B"));
		expect(onChange).toHaveBeenCalledWith(["A", "B"]);
	});

	it("toggles tag chips", () => {
		const onChange = vi.fn();
		render(
			<FilterValueInput
				filter={{ key: "builtin:tags", op: "in", value: [] }}
				meta={{
					key: "builtin:tags",
					label: "Tags",
					sortable: false,
					filterable: true,
					kind: "tags",
				}}
				def={undefined}
				personTags={[{ id: "t1", name: "Eng" }]}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByText("Eng"));
		expect(onChange).toHaveBeenCalledWith(["t1"]);
	});

	it("removes selected tag chip when pressed again", () => {
		const onChange = vi.fn();
		render(
			<FilterValueInput
				filter={{ key: "builtin:tags", op: "in", value: ["t1"] }}
				meta={{
					key: "builtin:tags",
					label: "Tags",
					sortable: false,
					filterable: true,
					kind: "tags",
				}}
				def={undefined}
				personTags={[{ id: "t1", name: "Eng" }]}
				onChange={onChange}
			/>,
		);
		fireEvent.click(screen.getByText("Eng"));
		expect(onChange).toHaveBeenCalledWith([]);
	});

	it("shows empty tags message", () => {
		render(
			<FilterValueInput
				filter={{ key: "builtin:tags", op: "in", value: [] }}
				meta={{
					key: "builtin:tags",
					label: "Tags",
					sortable: false,
					filterable: true,
					kind: "tags",
				}}
				def={undefined}
				personTags={[]}
				onChange={vi.fn()}
			/>,
		);
		expect(screen.getByText(/No person tags/)).toBeTruthy();
	});

	it("renders number and date inputs", () => {
		const onNum = vi.fn();
		const { rerender } = render(
			<FilterValueInput
				filter={{ key: "field:n", op: "gt", value: "1" }}
				meta={{
					key: "field:n",
					label: "N",
					sortable: true,
					filterable: true,
					kind: "number",
				}}
				def={undefined}
				personTags={[]}
				onChange={onNum}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Filter value"), { target: { value: "2" } });
		expect(onNum).toHaveBeenCalledWith("2");

		const onDate = vi.fn();
		rerender(
			<FilterValueInput
				filter={{ key: "field:d", op: "eq", value: "2026-01-01" }}
				meta={{
					key: "field:d",
					label: "D",
					sortable: true,
					filterable: true,
					kind: "date",
				}}
				def={undefined}
				personTags={[]}
				onChange={onDate}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Filter value"), {
			target: { value: "2026-02-02" },
		});
		expect(onDate).toHaveBeenCalledWith("2026-02-02");
	});

	it("renders person-ref text and freeform in", () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<FilterValueInput
				filter={{ key: "builtin:managerId", op: "eq", value: "Bob" }}
				meta={{
					key: "builtin:managerId",
					label: "Manager",
					sortable: true,
					filterable: true,
					kind: "person-ref",
				}}
				def={undefined}
				personTags={[]}
				onChange={onChange}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Filter value"), { target: { value: "Ann" } });
		expect(onChange).toHaveBeenCalledWith("Ann");

		rerender(
			<FilterValueInput
				filter={{ key: "builtin:managerId", op: "in", value: ["a"] }}
				meta={{
					key: "builtin:managerId",
					label: "Manager",
					sortable: true,
					filterable: true,
					kind: "person-ref",
				}}
				def={undefined}
				personTags={[]}
				onChange={onChange}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Filter values"), {
			target: { value: "a, b" },
		});
		expect(onChange).toHaveBeenCalledWith(["a", "b"]);
	});

	it("renders select single dropdown", () => {
		const onChange = vi.fn();
		render(
			<FilterValueInput
				filter={{ key: "field:s", op: "eq", value: "A" }}
				meta={{
					key: "field:s",
					label: "S",
					sortable: true,
					filterable: true,
					kind: "select",
				}}
				def={{
					id: "s",
					workspaceId: "ws",
					name: "S",
					fieldType: "select",
					options: ["A", "B"],
					sortOrder: 0,
					required: false,
					defaultValue: null,
					showOnChart: false,
					createdAt: "2026-01-01",
				}}
				personTags={[]}
				onChange={onChange}
			/>,
		);
		fireEvent.change(screen.getByLabelText("Filter value"), { target: { value: "B" } });
		expect(onChange).toHaveBeenCalledWith("B");
	});
});
