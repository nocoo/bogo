import type { DocumentType, Person, Tag } from "@bogo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentFilters, EMPTY_FILTERS } from "./DocumentFilters.js";

const TYPES: DocumentType[] = [
	{
		id: "dt-1",
		workspaceId: "ws-1",
		name: "Connect",
		color: "#8b5cf6",
		sortOrder: 0,
		createdAt: "2026-01-01",
	},
];

const TAGS: Tag[] = [
	{
		id: "t-1",
		workspaceId: "ws-1",
		name: "plan",
		scope: "document",
		color: null,
		sortOrder: 0,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
	},
];

const PEOPLE: Person[] = [
	{
		id: "p-1",
		workspaceId: "ws-1",
		name: "Alice",
		title: "",
		managerId: null,
		dottedManagerId: null,
		avatarUrl: null,
		isRoot: true,
		sortOrder: 0,
		createdAt: "2026-01-01",
		updatedAt: "2026-01-01",
		tags: [],
	},
];

describe("DocumentFilters", () => {
	it("is collapsed by default — panel is not in the DOM", () => {
		render(
			<DocumentFilters
				value={EMPTY_FILTERS}
				onChange={vi.fn()}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={PEOPLE}
			/>,
		);
		expect(screen.queryByLabelText("Keyword")).toBeNull();
	});

	it("expands when the toggle is clicked", () => {
		render(
			<DocumentFilters
				value={EMPTY_FILTERS}
				onChange={vi.fn()}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={PEOPLE}
			/>,
		);
		fireEvent.click(screen.getByText("Filters"));
		expect(screen.getByLabelText("Keyword")).toBeTruthy();
		expect(screen.getByLabelText("Type")).toBeTruthy();
		expect(screen.getByLabelText("Date from")).toBeTruthy();
		expect(screen.getByLabelText("Date to")).toBeTruthy();
	});

	it("shows active-count badge and Clear shortcut when filters are set", () => {
		const onChange = vi.fn();
		render(
			<DocumentFilters
				value={{ ...EMPTY_FILTERS, keyword: "foo", tagIds: ["t-1"] }}
				onChange={onChange}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={PEOPLE}
			/>,
		);
		expect(screen.getByText("2")).toBeTruthy();
		fireEvent.click(screen.getByLabelText("Clear all filters"));
		expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
	});

	it("fires onChange when keyword changes", () => {
		const onChange = vi.fn();
		render(
			<DocumentFilters
				value={EMPTY_FILTERS}
				onChange={onChange}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={PEOPLE}
			/>,
		);
		fireEvent.click(screen.getByText("Filters"));
		fireEvent.change(screen.getByLabelText("Keyword"), { target: { value: "alpha" } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ keyword: "alpha" }));
	});

	it("fires onChange with the picked typeId", () => {
		const onChange = vi.fn();
		render(
			<DocumentFilters
				value={EMPTY_FILTERS}
				onChange={onChange}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={PEOPLE}
			/>,
		);
		fireEvent.click(screen.getByText("Filters"));
		fireEvent.change(screen.getByLabelText("Type"), { target: { value: "dt-1" } });
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ typeId: "dt-1" }));
	});

	it("toggles a tag on click", () => {
		const onChange = vi.fn();
		render(
			<DocumentFilters
				value={EMPTY_FILTERS}
				onChange={onChange}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={PEOPLE}
			/>,
		);
		fireEvent.click(screen.getByText("Filters"));
		fireEvent.click(screen.getByLabelText("Add tag filter plan"));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tagIds: ["t-1"] }));
	});

	it("toggles a person on click", () => {
		const onChange = vi.fn();
		render(
			<DocumentFilters
				value={EMPTY_FILTERS}
				onChange={onChange}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={PEOPLE}
			/>,
		);
		fireEvent.click(screen.getByText("Filters"));
		fireEvent.click(screen.getByLabelText("Add person filter Alice"));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ personIds: ["p-1"] }));
	});

	it("removes a tag when clicked while active", () => {
		const onChange = vi.fn();
		render(
			<DocumentFilters
				value={{ ...EMPTY_FILTERS, tagIds: ["t-1"] }}
				onChange={onChange}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={PEOPLE}
			/>,
		);
		fireEvent.click(screen.getByText("Filters"));
		fireEvent.click(screen.getByLabelText("Remove tag filter plan"));
		expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [] }));
	});

	it("shows an empty-state message when no tags exist", () => {
		render(
			<DocumentFilters
				value={EMPTY_FILTERS}
				onChange={vi.fn()}
				docTypes={TYPES}
				allTags={[]}
				allPersons={PEOPLE}
			/>,
		);
		fireEvent.click(screen.getByText("Filters"));
		expect(screen.getByText("No tags defined")).toBeTruthy();
	});

	it("shows an empty-state message when no people exist", () => {
		render(
			<DocumentFilters
				value={EMPTY_FILTERS}
				onChange={vi.fn()}
				docTypes={TYPES}
				allTags={TAGS}
				allPersons={[]}
			/>,
		);
		fireEvent.click(screen.getByText("Filters"));
		expect(screen.getByText("No people defined")).toBeTruthy();
	});
});
