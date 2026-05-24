import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VersionDiff } from "./VersionDiff.js";

vi.mock("@pierre/diffs/react", () => ({
	MultiFileDiff: vi.fn(({ oldFile, newFile, options }) => (
		<div data-testid="multi-file-diff">
			<span data-testid="old-contents">{oldFile.contents}</span>
			<span data-testid="new-contents">{newFile.contents}</span>
			<span data-testid="diff-style">{options?.diffStyle}</span>
		</div>
	)),
}));

const V1 = {
	id: "v-1",
	documentId: "doc-1",
	version: 1,
	title: "Draft",
	content: "Hello world",
	createdAt: "2026-01-01",
};

const V2 = {
	id: "v-2",
	documentId: "doc-1",
	version: 2,
	title: "Final",
	content: "Hello world!\nNew line.",
	createdAt: "2026-01-02",
};

describe("VersionDiff", () => {
	it("renders version comparison header", () => {
		render(<VersionDiff oldVersion={V1} newVersion={V2} />);
		expect(screen.getByText("Comparing v1 → v2")).toBeTruthy();
	});

	it("shows title diff when titles differ", () => {
		render(<VersionDiff oldVersion={V1} newVersion={V2} />);
		expect(screen.getByText("Draft")).toBeTruthy();
		expect(screen.getByText("Final")).toBeTruthy();
	});

	it("does not show title diff when titles match", () => {
		const sameTitle = { ...V2, title: "Draft" };
		render(<VersionDiff oldVersion={V1} newVersion={sameTitle} />);
		expect(screen.queryByText("→")).toBeNull();
	});

	it("passes correct props to MultiFileDiff", () => {
		render(<VersionDiff oldVersion={V1} newVersion={V2} />);
		expect(screen.getByTestId("old-contents").textContent).toBe("Hello world");
		expect(screen.getByTestId("new-contents").textContent).toBe("Hello world!\nNew line.");
		expect(screen.getByTestId("diff-style").textContent).toBe("unified");
	});
});
