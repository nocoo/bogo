import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceProvider, useWorkspaceContext } from "../../contexts/workspace-context.js";
import { useDocuments } from "./use-documents.js";

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

function useWithWorkspace() {
	const ctx = useWorkspaceContext();
	const vm = useDocuments();
	return { ctx, vm };
}

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const DOC_A = {
	id: "doc-1",
	workspaceId: "ws-1",
	typeId: "dt-1",
	title: "Q1 Report",
	content: "# Summary",
	eventDate: "2026-03-01",
	version: 1,
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const DOC_B = {
	id: "doc-2",
	workspaceId: "ws-1",
	typeId: null,
	title: "Draft Notes",
	content: "",
	eventDate: null,
	version: 1,
	createdAt: "2026-01-02",
	updatedAt: "2026-01-02",
};

describe("useDocuments", () => {
	it("does not fetch when no workspace selected", () => {
		const wrapper = createWrapper();
		const { result } = renderHook(() => useDocuments(), { wrapper });
		expect(result.current.documents).toEqual([]);
		expect(result.current.isLoading).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("fetches documents after workspace selection", async () => {
		mockFetch.mockResolvedValue(ok([DOC_A, DOC_B]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.documents).toHaveLength(2));
		expect(result.current.vm.documents[0].title).toBe("Q1 Report");
		expect(result.current.vm.documents[1].title).toBe("Draft Notes");
	});

	it("exposes loading state while fetching", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.isLoading).toBe(true));
	});

	it("exposes error when fetch fails", async () => {
		mockFetch.mockResolvedValue(err(500, "INTERNAL", "DB error"));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.error).not.toBeNull());
		expect(result.current.vm.error?.message).toContain("DB error");
	});

	describe("create", () => {
		it("appends new document on success", async () => {
			mockFetch.mockResolvedValue(ok([DOC_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.documents).toHaveLength(1));

			const newDoc = { ...DOC_B, id: "doc-new" };
			mockFetch.mockResolvedValueOnce(ok(newDoc, 201));

			act(() => result.current.vm.create({ title: "Draft Notes", content: "", personIds: [] }));

			await waitFor(() => expect(result.current.vm.documents).toHaveLength(2));
			expect(result.current.vm.documents[1].id).toBe("doc-new");
		});

		it("exposes isCreating state", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockReturnValueOnce(new Promise(() => undefined));

			act(() => result.current.vm.create({ title: "New", content: "", personIds: [] }));

			await waitFor(() => expect(result.current.vm.isCreating).toBe(true));
		});

		it("toasts error on create failure", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValueOnce(err(400, "VALIDATION", "Title required"));

			act(() => result.current.vm.create({ title: "", content: "", personIds: [] }));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Title required"));
		});
	});

	describe("update", () => {
		it("optimistically updates document and applies returned version", async () => {
			mockFetch.mockResolvedValue(ok([DOC_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.documents).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(ok({ version: 2 }))
				.mockResolvedValueOnce(ok([{ ...DOC_A, title: "Q1 Final", version: 2 }]));

			act(() => result.current.vm.update("doc-1", { title: "Q1 Final" }));

			await waitFor(() => expect(result.current.vm.documents[0].title).toBe("Q1 Final"));
			await waitFor(() => expect(result.current.vm.documents[0].version).toBe(2));
		});

		it("rolls back on update failure", async () => {
			mockFetch.mockResolvedValue(ok([DOC_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.documents).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(400, "VALIDATION", "Bad title"))
				.mockResolvedValueOnce(ok([DOC_A]));

			act(() => result.current.vm.update("doc-1", { title: "" }));

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			expect(result.current.vm.documents[0].title).toBe("Q1 Report");
		});
	});

	describe("delete", () => {
		it("optimistically removes document", async () => {
			mockFetch.mockResolvedValue(ok([DOC_A, DOC_B]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.documents).toHaveLength(2));

			mockFetch.mockResolvedValueOnce(ok({ deleted: true })).mockResolvedValueOnce(ok([DOC_B]));

			act(() => result.current.vm.remove("doc-1"));

			await waitFor(() => expect(result.current.vm.documents).toHaveLength(1));
			expect(result.current.vm.documents[0].id).toBe("doc-2");
		});

		it("rolls back on delete failure", async () => {
			mockFetch.mockResolvedValue(ok([DOC_A]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.documents).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(409, "HAS_PERSONS", "Document has associations"))
				.mockResolvedValueOnce(ok([DOC_A]));

			act(() => result.current.vm.remove("doc-1"));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Document has associations"));
			expect(result.current.vm.documents).toHaveLength(1);
		});
	});

	it("handles create when cache is empty (undefined fallback)", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		const newDoc = { ...DOC_A, id: "doc-fresh" };
		mockFetch.mockResolvedValueOnce(ok(newDoc, 201));

		act(() => result.current.vm.create({ title: "Fresh", content: "", personIds: [] }));

		await waitFor(() => expect(result.current.vm.documents).toHaveLength(1));
		expect(result.current.vm.documents[0].id).toBe("doc-fresh");
	});

	it("handles update when cache is undefined", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		mockFetch.mockResolvedValueOnce(ok({ version: 2 })).mockResolvedValueOnce(ok([]));

		act(() => result.current.vm.update("doc-x", { title: "X" }));

		await waitFor(() => expect(result.current.vm.isUpdating).toBe(false));
	});

	it("handles delete when cache is undefined", async () => {
		mockFetch.mockReturnValue(new Promise(() => undefined));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		mockFetch.mockResolvedValueOnce(ok({ deleted: true })).mockResolvedValueOnce(ok([]));

		act(() => result.current.vm.remove("doc-x"));

		await waitFor(() => expect(result.current.vm.isRemoving).toBe(false));
	});
});
