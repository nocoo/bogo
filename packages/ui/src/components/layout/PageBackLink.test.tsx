import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { PageBackLink } from "./PageBackLink";

describe("PageBackLink", () => {
	it("renders icon-only link to parent", () => {
		render(
			<MemoryRouter>
				<PageBackLink to="/table" ariaLabel="Back to Table" />
			</MemoryRouter>,
		);
		const link = screen.getByLabelText("Back to Table");
		expect(link.getAttribute("href")).toBe("/table");
		expect(link.textContent?.trim()).toBe("");
	});

	it("renders text variant with visible label", () => {
		render(
			<MemoryRouter>
				<PageBackLink to="/documents" ariaLabel="Back to documents">
					Documents
				</PageBackLink>
			</MemoryRouter>,
		);
		expect(screen.getByText("Documents")).toBeTruthy();
		expect(screen.getByLabelText("Back to documents").className).toContain("page-back");
	});

	it("invokes onClick when used as a button", () => {
		const onClick = vi.fn();
		render(<PageBackLink onClick={onClick} ariaLabel="Back to documents" />);
		fireEvent.click(screen.getByLabelText("Back to documents"));
		expect(onClick).toHaveBeenCalled();
	});

	it("navigates via router when clicked as Link", () => {
		render(
			<MemoryRouter initialEntries={["/people/x"]}>
				<Routes>
					<Route
						path="/people/:id"
						element={<PageBackLink to="/table" ariaLabel="Back to Table" />}
					/>
					<Route path="/table" element={<div>Table page</div>} />
				</Routes>
			</MemoryRouter>,
		);
		fireEvent.click(screen.getByLabelText("Back to Table"));
		expect(screen.getByText("Table page")).toBeTruthy();
	});
});
