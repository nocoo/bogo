import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../../contexts/workspace-context.js";
import { useDocument } from "./use-document.js";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockFetch = vi.fn();

beforeEach(() => {
	vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
	vi.clearAllMocks();
	vi.unstubAllGlobals();
});

function ok(data: unknown, status = 200) {
	return new Response(JSON.stringify({ data }), { status });
}

function err(status: number, code: string, message: string) {
	return new Response(JSON.stringify({ error: { code, message } }), { status });
}

function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={queryClient}>
				<WorkspaceProvider>{children}</WorkspaceProvider>
			</QueryClientProvider>
		);
	};
}

function useWithWorkspace(docId: string) {
	const ctx = useWorkspaceContext();
	const vm = useDocument(docId);
	return { ctx, vm };
}

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const DOC = {
	id: "doc-1",
	workspaceId: "ws-1",
	typeId: "dt-1",
	title: "Q1 Report",
	content: "# Summary\nHello world",
	eventDate: "2026-03-01",
	version: 1,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const VERSION_1 = {
	id: "v-1",
	documentId: "doc-1",
	version: 1,
	title: "Q1 Report",
	content: "# Summary\nHello world",
	createdAt: "2026-01-01",
};

describe("useDocument", () => {
	it("does not fetch when no workspace selected", () => {
		const wrapper = createWrapper();
		const { result } = renderHook(() => useDocument("doc-1"), { wrapper });
		expect(result.current.document).toBeNull();
		expect(result.current.isLoading).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("fetches document detail and versions after workspace selection", async () => {
		mockFetch.mockResolvedValueOnce(ok(DOC)).mockResolvedValueOnce(ok([VERSION_1]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.document).not.toBeNull());
		expect(result.current.vm.document?.title).toBe("Q1 Report");
		await waitFor(() => expect(result.current.vm.versions).toHaveLength(1));
		expect(result.current.vm.versions[0].version).toBe(1);
	});

	it("exposes loading state while fetching", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.isLoading).toBe(true));
	});

	it("exposes error when fetch fails", async () => {
		mockFetch.mockResolvedValue(err(500, "INTERNAL", "DB error"));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.error).not.toBeNull());
		expect(result.current.vm.error?.message).toContain("DB error");
	});

	describe("update", () => {
		it("optimistically updates document and applies returned version", async () => {
			mockFetch.mockResolvedValueOnce(ok(DOC)).mockResolvedValueOnce(ok([VERSION_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.document).not.toBeNull());

			mockFetch
				.mockResolvedValueOnce(ok({ version: 2 }))
				.mockResolvedValueOnce(ok({ ...DOC, title: "Q1 Final", version: 2 }))
				.mockResolvedValueOnce(
					ok([VERSION_1, { ...VERSION_1, id: "v-2", version: 2, title: "Q1 Final" }]),
				);

			act(() => result.current.vm.update({ title: "Q1 Final" }));

			await waitFor(() => expect(result.current.vm.document?.title).toBe("Q1 Final"));
			await waitFor(() => expect(result.current.vm.document?.version).toBe(2));
		});

		it("rolls back on update failure", async () => {
			mockFetch.mockResolvedValueOnce(ok(DOC)).mockResolvedValueOnce(ok([VERSION_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.document).not.toBeNull());

			mockFetch
				.mockResolvedValueOnce(err(400, "VALIDATION", "Title too long"))
				.mockResolvedValueOnce(ok(DOC))
				.mockResolvedValueOnce(ok([VERSION_1]));

			act(() => {
				result.current.vm.update({ title: "" });
			});

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Title too long"));
			expect(result.current.vm.document?.title).toBe("Q1 Report");
		});

		it("exposes isUpdating state", async () => {
			mockFetch.mockResolvedValueOnce(ok(DOC)).mockResolvedValueOnce(ok([VERSION_1]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.document).not.toBeNull());

			mockFetch.mockReturnValueOnce(new Promise(() => undefined));

			act(() => result.current.vm.update({ title: "New" }));

			await waitFor(() => expect(result.current.vm.isUpdating).toBe(true));
		});
	});

	it("handles update when detail cache is undefined", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		mockFetch
			.mockResolvedValueOnce(ok({ version: 2 }))
			.mockResolvedValueOnce(ok(DOC))
			.mockResolvedValueOnce(ok([VERSION_1]));

		act(() => result.current.vm.update({ title: "X" }));

		await waitFor(() => expect(result.current.vm.isUpdating).toBe(false));
	});

	describe("addPerson", () => {
		it("optimistically adds person and settles", async () => {
			mockFetch
				.mockResolvedValueOnce(ok(DOC))
				.mockResolvedValueOnce(ok([VERSION_1]))
				.mockResolvedValueOnce(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.document).not.toBeNull());
			await waitFor(() => expect(result.current.vm.persons).toHaveLength(0));

			const linked = [
				{ workspaceId: "ws-1", documentId: "doc-1", personId: "p-1", role: "subject" },
			];
			mockFetch.mockResolvedValueOnce(ok({ added: true })).mockResolvedValueOnce(ok(linked));

			act(() => result.current.vm.addPerson({ personId: "p-1" }));

			await waitFor(() => expect(result.current.vm.persons).toHaveLength(1));
			expect(result.current.vm.persons[0].personId).toBe("p-1");
		});

		it("rolls back on add failure", async () => {
			mockFetch
				.mockResolvedValueOnce(ok(DOC))
				.mockResolvedValueOnce(ok([VERSION_1]))
				.mockResolvedValueOnce(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.document).not.toBeNull());

			mockFetch
				.mockResolvedValueOnce(err(409, "DUPLICATE", "Already linked"))
				.mockResolvedValueOnce(ok([]));

			act(() => result.current.vm.addPerson({ personId: "p-1" }));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Already linked"));
			expect(result.current.vm.persons).toHaveLength(0);
		});
	});

	describe("removePerson", () => {
		const LINKED = [{ workspaceId: "ws-1", documentId: "doc-1", personId: "p-1", role: "subject" }];

		it("optimistically removes person and settles", async () => {
			mockFetch
				.mockResolvedValueOnce(ok(DOC))
				.mockResolvedValueOnce(ok([VERSION_1]))
				.mockResolvedValueOnce(ok(LINKED));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.persons).toHaveLength(1));

			mockFetch.mockResolvedValueOnce(ok({ removed: true })).mockResolvedValueOnce(ok([]));

			act(() => result.current.vm.removePerson("p-1"));

			await waitFor(() => expect(result.current.vm.persons).toHaveLength(0));
		});

		it("rolls back on remove failure", async () => {
			mockFetch
				.mockResolvedValueOnce(ok(DOC))
				.mockResolvedValueOnce(ok([VERSION_1]))
				.mockResolvedValueOnce(ok(LINKED));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.persons).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(404, "NOT_FOUND", "Association not found"))
				.mockResolvedValueOnce(ok(LINKED));

			act(() => result.current.vm.removePerson("p-1"));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Association not found"));
			expect(result.current.vm.persons).toHaveLength(1);
		});
	});

	describe("addPerson with undefined cache", () => {
		it("restores empty array on failure when persons cache is truly undefined", async () => {
			mockFetch
				.mockResolvedValueOnce(ok(DOC))
				.mockResolvedValueOnce(ok([VERSION_1]))
				.mockReturnValueOnce(new Promise(() => undefined));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.document).not.toBeNull());
			expect(result.current.vm.isLoadingPersons).toBe(true);

			mockFetch
				.mockResolvedValueOnce(err(400, "INVALID_PERSON", "Person not found"))
				.mockResolvedValueOnce(ok([]));

			act(() => result.current.vm.addPerson({ personId: "p-bad" }));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Person not found"));
			await waitFor(() => expect(result.current.vm.persons).toHaveLength(0));
		});
	});

	describe("personsError", () => {
		it("exposes persons query error when fetch fails", async () => {
			mockFetch
				.mockResolvedValueOnce(ok(DOC))
				.mockResolvedValueOnce(ok([VERSION_1]))
				.mockResolvedValueOnce(err(500, "INTERNAL", "DB connection lost"));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace("doc-1"), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));

			await waitFor(() => expect(result.current.vm.personsError).not.toBeNull());
			expect(result.current.vm.personsError?.message).toContain("DB connection lost");
			expect(result.current.vm.persons).toHaveLength(0);
		});
	});
});
