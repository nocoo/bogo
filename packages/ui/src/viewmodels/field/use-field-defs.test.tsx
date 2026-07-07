import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkspaceContext, WorkspaceProvider } from "../../contexts/workspace-context.js";
import { useFieldDefs } from "./use-field-defs.js";

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
	const vm = useFieldDefs();
	return { ctx, vm };
}

const WS = {
	id: "ws-1",
	ownerId: "u-1",
	name: "Corp",
	createdAt: "2026-01-01",
	updatedAt: "2026-01-01",
};

const DEF_TEXT = {
	id: "fd-1",
	workspaceId: "ws-1",
	name: "Department",
	fieldType: "text" as const,
	options: null,
	sortOrder: 0,
	required: false,
	defaultValue: null,
	createdAt: "2026-01-01",
};

const DEF_SELECT = {
	id: "fd-2",
	workspaceId: "ws-1",
	name: "Level",
	fieldType: "select" as const,
	options: ["Junior", "Senior", "Staff"],
	sortOrder: 1,
	required: true,
	defaultValue: "Junior",
	createdAt: "2026-01-02",
};

describe("useFieldDefs", () => {
	it("does not fetch when no workspace selected", () => {
		const wrapper = createWrapper();
		const { result } = renderHook(() => useFieldDefs(), { wrapper });
		expect(result.current.defs).toEqual([]);
		expect(result.current.isLoading).toBe(false);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("fetches field definitions after workspace selection", async () => {
		mockFetch.mockResolvedValue(ok([DEF_TEXT, DEF_SELECT]));
		const wrapper = createWrapper();
		const { result } = renderHook(() => useWithWorkspace(), { wrapper });

		act(() => result.current.ctx.switchWorkspace(WS));

		await waitFor(() => expect(result.current.vm.defs).toHaveLength(2));
		expect(result.current.vm.defs[0].name).toBe("Department");
		expect(result.current.vm.defs[1].name).toBe("Level");
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
		it("appends new definition on success", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));

			const newDef = { ...DEF_SELECT, id: "fd-new" };
			mockFetch.mockResolvedValueOnce(ok(newDef, 201));

			act(() =>
				result.current.vm.create({
					name: "Level",
					fieldType: "select",
					options: ["Junior", "Senior"],
					required: true,
				}),
			);

			await waitFor(() => expect(result.current.vm.defs).toHaveLength(2));
			expect(result.current.vm.defs[1].id).toBe("fd-new");
		});

		it("exposes isCreating state", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockReturnValueOnce(new Promise(() => undefined));

			act(() => result.current.vm.create({ name: "Foo", fieldType: "text", required: false }));

			await waitFor(() => expect(result.current.vm.isCreating).toBe(true));
		});

		it("toasts error on create failure", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			mockFetch.mockResolvedValueOnce(err(400, "VALIDATION", "Name required"));

			act(() => result.current.vm.create({ name: "", fieldType: "text", required: false }));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Name required"));
		});
	});

	describe("update", () => {
		it("optimistically updates definition", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(ok({ updated: true }))
				.mockResolvedValueOnce(ok([{ ...DEF_TEXT, name: "Dept" }]));

			act(() => result.current.vm.update("fd-1", { name: "Dept" }));

			await waitFor(() => expect(result.current.vm.defs[0].name).toBe("Dept"));
			await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Field saved"));
		});

		it("rolls back on update failure", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(400, "VALIDATION", "Bad name"))
				.mockResolvedValueOnce(ok([DEF_TEXT]));

			act(() => result.current.vm.update("fd-1", { name: "" }));

			await waitFor(() => expect(toast.error).toHaveBeenCalled());
			expect(result.current.vm.defs[0].name).toBe("Department");
		});

		it("exposes isUpdating state", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));

			mockFetch.mockReturnValueOnce(new Promise(() => undefined));

			act(() => result.current.vm.update("fd-1", { name: "X" }));

			await waitFor(() => expect(result.current.vm.isUpdating).toBe(true));
		});
	});

	describe("delete", () => {
		it("optimistically removes definition", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT, DEF_SELECT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(2));

			mockFetch
				.mockResolvedValueOnce(ok({ deleted: true }))
				.mockResolvedValueOnce(ok([DEF_SELECT]));

			act(() => result.current.vm.remove("fd-1"));

			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));
			expect(result.current.vm.defs[0].id).toBe("fd-2");
		});

		it("rolls back on delete failure (in-use)", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(409, "IN_USE", "Field has values"))
				.mockResolvedValueOnce(ok([DEF_TEXT]));

			act(() => result.current.vm.remove("fd-1"));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Field has values"));
			expect(result.current.vm.defs).toHaveLength(1);
		});

		it("rolls back on delete failure (404)", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));

			mockFetch
				.mockResolvedValueOnce(err(404, "NOT_FOUND", "Field not found"))
				.mockResolvedValueOnce(ok([DEF_TEXT]));

			act(() => result.current.vm.remove("fd-1"));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Field not found"));
			expect(result.current.vm.defs).toHaveLength(1);
		});

		it("exposes isRemoving state", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));

			mockFetch.mockReturnValueOnce(new Promise(() => undefined));

			act(() => result.current.vm.remove("fd-1"));

			await waitFor(() => expect(result.current.vm.isRemoving).toBe(true));
		});
	});

	describe("reorder", () => {
		it("updates sortOrder optimistically", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT, DEF_SELECT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(2));

			mockFetch
				.mockResolvedValueOnce(ok({ updated: true }))
				.mockResolvedValueOnce(ok([{ ...DEF_TEXT, sortOrder: 5 }, DEF_SELECT]));

			act(() => result.current.vm.reorder("fd-1", 5));

			await waitFor(() => expect(result.current.vm.defs[0].sortOrder).toBe(5));
			expect(toast.success).not.toHaveBeenCalledWith("Field saved");
		});

		it("rolls back sortOrder on reorder failure", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT, DEF_SELECT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(2));

			mockFetch
				.mockResolvedValueOnce(err(500, "INTERNAL", "swap failed"))
				.mockResolvedValueOnce(ok([DEF_TEXT, DEF_SELECT]));

			act(() => result.current.vm.reorder("fd-1", 99));

			await waitFor(() => expect(toast.error).toHaveBeenCalledWith("swap failed"));
			await waitFor(() =>
				expect(result.current.vm.defs.find((d) => d.id === "fd-1")?.sortOrder).toBe(0),
			);
		});
	});

	describe("workspace isolation", () => {
		it("sends requests scoped to current workspace", async () => {
			mockFetch.mockResolvedValue(ok([]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.isLoading).toBe(false));

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining("/api/w/ws-1/fields"),
				expect.anything(),
			);
		});

		it("refetches when workspace changes", async () => {
			mockFetch.mockResolvedValue(ok([DEF_TEXT]));
			const wrapper = createWrapper();
			const { result } = renderHook(() => useWithWorkspace(), { wrapper });

			act(() => result.current.ctx.switchWorkspace(WS));
			await waitFor(() => expect(result.current.vm.defs).toHaveLength(1));

			const WS2 = { ...WS, id: "ws-2", name: "Other" };
			mockFetch.mockResolvedValue(ok([DEF_SELECT]));

			act(() => result.current.ctx.switchWorkspace(WS2));
			await waitFor(() => expect(result.current.vm.defs[0]?.name).toBe("Level"));
		});
	});
});
