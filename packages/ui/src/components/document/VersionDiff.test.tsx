import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VersionDiff } from "./VersionDiff.js";

vi.mock("@pierre/diffs/react", () => ({
	MultiFileDiff: vi.fn(({ oldFile, newFile, options }) => (
		<div data-testid="multi-file-diff">
			<span data-testid="old-contents">{oldFile.contents}</span>
			<span data-testid="old-lang">{oldFile.lang}</span>
			<span data-testid="new-contents">{newFile.contents}</span>
			<span data-testid="new-lang">{newFile.lang}</span>
			<span data-testid="diff-style">{options?.diffStyle}</span>
			<span data-testid="theme-dark">{options?.theme?.dark}</span>
			<span data-testid="theme-light">{options?.theme?.light}</span>
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
	it("renders version comparison header", async () => {
		render(<VersionDiff oldVersion={V1} newVersion={V2} />);
		expect(screen.getByText("Comparing v1 → v2")).toBeTruthy();
		await screen.findByTestId("multi-file-diff");
	});

	it("shows title diff when titles differ", async () => {
		render(<VersionDiff oldVersion={V1} newVersion={V2} />);
		expect(screen.getByText("Draft")).toBeTruthy();
		expect(screen.getByText("Final")).toBeTruthy();
		await screen.findByTestId("multi-file-diff");
	});

	it("does not show title diff when titles match", async () => {
		const sameTitle = { ...V2, title: "Draft" };
		render(<VersionDiff oldVersion={V1} newVersion={sameTitle} />);
		expect(screen.queryByText("→")).toBeNull();
		await screen.findByTestId("multi-file-diff");
	});

	it("passes correct props including lang and themes", async () => {
		render(<VersionDiff oldVersion={V1} newVersion={V2} />);
		const diff = await screen.findByTestId("multi-file-diff");
		expect(diff).toBeTruthy();
		expect(screen.getByTestId("old-contents").textContent).toBe("Hello world");
		expect(screen.getByTestId("old-lang").textContent).toBe("markdown");
		expect(screen.getByTestId("new-contents").textContent).toBe("Hello world!\nNew line.");
		expect(screen.getByTestId("new-lang").textContent).toBe("markdown");
		expect(screen.getByTestId("diff-style").textContent).toBe("unified");
		expect(screen.getByTestId("theme-dark").textContent).toBe("github-dark");
		expect(screen.getByTestId("theme-light").textContent).toBe("github-light");
	});
});
