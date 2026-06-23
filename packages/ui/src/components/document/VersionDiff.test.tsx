import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const getVersion = vi.fn();
vi.mock("../../lib/api/index.js", () => ({
	api: {
		documents: {
			getVersion: (...args: unknown[]) => getVersion(...args),
		},
	},
}));

// Imported after the mocks so the lazy `api` reference resolves correctly.
import { VersionDiff } from "./VersionDiff.js";

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

function renderDiff(props: {
	wid: string;
	documentId: string;
	oldVersion: number;
	newVersion: number;
}) {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<VersionDiff {...props} />
		</QueryClientProvider>,
	);
}

describe("VersionDiff", () => {
	beforeEach(() => {
		getVersion.mockReset();
		// Default: return v1 / v2 keyed by version number.
		getVersion.mockImplementation(async (_wid: string, _id: string, v: number) =>
			v === 1 ? V1 : V2,
		);
	});

	it("renders version comparison header", async () => {
		renderDiff({ wid: "w-1", documentId: "doc-1", oldVersion: 1, newVersion: 2 });
		await waitFor(() => screen.getByText("Comparing v1 → v2"));
		await screen.findByTestId("multi-file-diff");
	});

	it("shows title diff when titles differ", async () => {
		renderDiff({ wid: "w-1", documentId: "doc-1", oldVersion: 1, newVersion: 2 });
		await waitFor(() => screen.getByText("Draft"));
		expect(screen.getByText("Final")).toBeTruthy();
		await screen.findByTestId("multi-file-diff");
	});

	it("does not show title diff when titles match", async () => {
		getVersion.mockImplementation(async (_wid: string, _id: string, v: number) =>
			v === 1 ? V1 : { ...V2, title: "Draft" },
		);
		renderDiff({ wid: "w-1", documentId: "doc-1", oldVersion: 1, newVersion: 2 });
		await screen.findByTestId("multi-file-diff");
		expect(screen.queryByText("→")).toBeNull();
	});

	it("passes correct props including lang and themes", async () => {
		renderDiff({ wid: "w-1", documentId: "doc-1", oldVersion: 1, newVersion: 2 });
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
